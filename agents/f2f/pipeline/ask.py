"""Ask — a case-scoped agent.

The case facts (claim stats, trace, hypotheses, PFMEA, 8D draft, recent claims) are gathered up front and sent with
the question, so most answers take one model call. One tool, `get_claims`, stays available for questions that need
more claims than the sample shows. Runs as a Google ADK agent (on Vertex AI Agent Engine when deployed), with the
direct Gen AI SDK path as a fallback.
"""
from __future__ import annotations

import json
import logging
import re
from collections import Counter

from google.genai import types

from .. import gemini
from ..config import settings
from ..tools import bq, fs

log = logging.getLogger(__name__)
CITE_RE = re.compile(r"\b(C-\d+|R-\d+|CP-\d+)\b")
SAMPLE = 120  # claims sent with every question (covers a whole case); the local tool can page beyond it

from f2f_engine.agent import SYSTEM  # noqa: E402  (one prompt for the deployed and the in-process agent)

CLAIM_KEYS = ("claim_id", "city", "claim_date", "mileage_km", "translated_text", "condition", "photo_findings")


def case_facts(case: dict, rows: list[dict]) -> dict:
    km = sorted(r["mileage_km"] or 0 for r in rows)
    e8 = case.get("eight_d") or {}
    return {
        "case": {k: case.get(k) for k in ("id", "title", "component", "failure_mode", "count", "growth_x", "first_seen", "status")},
        "claim_stats": {
            "claims": len(rows),
            "by_city": Counter(r["city"] or r["dealer_id"] for r in rows).most_common(),
            "by_language": Counter(r["lang"] for r in rows).most_common(),
            "by_condition": Counter(r["condition"] for r in rows).most_common(8),
            "by_month": sorted(Counter(str(r["claim_date"])[:7] for r in rows).items()),
            "mileage_km": {"min": km[0] if km else None, "median": km[len(km) // 2] if km else None, "max": km[-1] if km else None},
        },
        "trace": case.get("trace", {}),
        "hypotheses": case.get("hypotheses", []),
        "pfmea_rows": case.get("pfmea", []),
        "control_plan_rows": case.get("control_plan", []),
        "eight_d": {k: (e8.get(k) or {}).get("text", "") for k in ("D2", "D3", "D4", "D5")},
        "claims_sample": [{k: r[k] for k in CLAIM_KEYS} for r in rows[:SAMPLE]],
    }


def answer(case_id: str, question: str, uid: str | None = None) -> dict:
    case = fs.get_case(case_id)
    if not case:
        raise ValueError("case not found")
    case = {**case, "id": case_id}
    rows = _claims(case["claim_ids"])

    def get_claims(offset: int = 0, limit: int = 30) -> str:
        """Return claims in this case beyond the sample (id, city, date, mileage, translated text, condition, photo findings)."""
        o, n = max(0, int(offset or 0)), max(1, min(int(limit or 30), 80))  # the model sends numbers as floats
        return json.dumps([{k: r[k] for k in CLAIM_KEYS} for r in rows[o:o + n]], default=str)

    history = fs.recent_messages(case_id, 8)
    convo = "\n".join(f"{'Engineer' if m['role'] == 'user' else 'Assistant'}: {m['text']}" for m in history)
    message = (f"Case facts (JSON):\n{json.dumps(case_facts(case, rows), default=str)}\n\n"
               + (f"Conversation so far:\n{convo}\n\n" if convo else "") + f"Question: {question}")

    fs.add_message(case_id, "user", question, uid=uid)
    text, via = "", None
    from .. import adk_agents
    if settings.agent_engine:
        try:
            text, via = adk_agents.ask_remote(message), "Vertex AI Agent Engine"
        except Exception:
            log.exception("Agent Engine Ask failed; running the ADK agent in-process")
    if not text and adk_agents.enabled():
        try:
            text, via = adk_agents.ask(SYSTEM, [get_claims], message), "Google ADK"
        except Exception:  # never let the orchestration layer break Ask
            log.exception("ADK Ask failed; using the direct path")
    if not text:
        text, via = _direct(message, [get_claims]), "Gemini"
    text = text or "I couldn't find an answer in this case's data."
    cites = sorted(set(CITE_RE.findall(text)))
    fs.add_message(case_id, "assistant", text, cites, via=via)
    return {"text": text, "cites": cites, "via": via}


_CLAIMS: dict[tuple, list[dict]] = {}  # claim rows per case, so follow-up questions skip BigQuery


def _claims(ids: list[str]) -> list[dict]:
    key = tuple(sorted(ids))
    if key not in _CLAIMS:
        if len(_CLAIMS) > 50:
            _CLAIMS.clear()
        _CLAIMS[key] = bq.get_claims(ids)
    return _CLAIMS[key]


def _direct(message: str, tools: list) -> str:
    resp = gemini.with_retry(
        gemini.client().models.generate_content,
        model=settings.model_fast,
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=message)])],
        config=types.GenerateContentConfig(system_instruction=SYSTEM, tools=tools, temperature=0.2, thinking_config=gemini.thinking()),
    )
    return resp.text or ""
