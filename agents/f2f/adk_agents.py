"""Google Agent Development Kit (ADK) orchestration.

- Investigation: an ADK SequentialAgent runs three agents in order — Trace → Hypothesise → Draft 8D.
  Each is a custom ADK agent wrapping a deterministic step (BigQuery tools, validated citations), so ADK
  owns the orchestration and event stream while we keep full control of what the model may cite.
- Ask: an ADK LlmAgent with case-scoped Python tools (claim stats, trace, PFMEA, hypotheses).

If ADK is unavailable or fails before any step has run, both fall back to the direct Gen AI SDK path,
so the demo never breaks. Set USE_ADK=0 to force the direct path.
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from typing import Any, AsyncGenerator, Callable

from google.genai import types

from . import gemini
from .config import settings

log = logging.getLogger(__name__)
APP = "field-to-fix"

# ADK's Gemini model reads these to reach Vertex AI with the service account (no API key).
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "TRUE")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", settings.project)
os.environ.setdefault("GOOGLE_CLOUD_LOCATION", settings.gemini_location)


def enabled() -> bool:
    if os.getenv("USE_ADK", "1") != "1":
        return False
    try:
        import google.adk  # noqa: F401  (availability check)
        return True
    except Exception:  # not installed in this environment
        return False


class StepError(Exception):
    """A pipeline step itself failed (e.g. BigQuery or Gemini): surface it, don't re-run the pipeline."""


def _run(agent, message: str, state: dict | None = None) -> list:
    """Run an ADK agent once in a fresh in-memory session and return its events."""
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService

    async def go() -> list:
        sessions = InMemorySessionService()
        sid = uuid.uuid4().hex
        await sessions.create_session(app_name=APP, user_id="f2f", session_id=sid, state=state or {})
        runner = Runner(app_name=APP, agent=agent, session_service=sessions)
        msg = types.Content(role="user", parts=[types.Part.from_text(text=message)])
        return [e async for e in runner.run_async(user_id="f2f", session_id=sid, new_message=msg)]

    return asyncio.run(go())


# ---------------------------------------------------------------- investigation

_STATE: dict[str, dict] = {}  # working state per case for the running pipeline (holds non-JSON values)


def _step_agent(name: str, description: str, fn: Callable[[dict], dict], first: bool = False):
    from google.adk.agents import BaseAgent
    from google.adk.events import Event

    class StepAgent(BaseAgent):
        async def _run_async_impl(self, ctx) -> AsyncGenerator[Event, None]:
            case_id = ctx.session.state["case_id"]
            try:
                if first:
                    _STATE[case_id] = await asyncio.to_thread(fn, case_id)
                else:
                    _STATE[case_id] = await asyncio.to_thread(fn, _STATE[case_id])
            except Exception as e:
                raise StepError(f"{name}: {e}") from e
            ctx.session.state[f"{name}_done"] = True
            yield Event(author=self.name, invocation_id=ctx.invocation_id,
                        content=types.Content(role="model", parts=[types.Part.from_text(text=f"{name} done")]))

    return StepAgent(name=name, description=description)


def investigation_agent():
    from google.adk.agents import SequentialAgent

    from .pipeline import investigate as inv

    return SequentialAgent(
        name="investigation",
        description="Trace a failure cluster to supplier batches, rank cited root causes, draft the 8D.",
        sub_agents=[
            _step_agent("trace", "Trace failing VINs to plant, part, supplier and batch (BigQuery tools).", inv.trace_step, first=True),
            _step_agent("hypothesise", "Rank root causes against PFMEA and control plan (Gemini, cited).", inv.hypothesise_step),
            _step_agent("draft_8d", "Draft 8D D2–D5 with validated citations (Gemini).", inv.draft_step),
        ],
    )


def run_investigation(case_id: str) -> None:
    from .pipeline import investigate as inv
    from .tools import fs

    fs.event(case_id, "adk", "Google ADK SequentialAgent: Trace → Hypothesise → Draft 8D", 1)
    try:
        _run(investigation_agent(), f"Investigate case {case_id}", {"case_id": case_id})
        fs.update_case(case_id, {"orchestrator": "Google ADK · SequentialAgent"})
    except StepError:
        raise
    except BaseExceptionGroup as eg:  # asyncio wraps task errors
        step = next((e for e in eg.exceptions if isinstance(e, StepError)), None)
        if step:
            raise step
        log.exception("ADK orchestration failed; running the direct pipeline")
        inv.run_direct(case_id)
    except Exception:
        if _STATE.get(case_id) is None:
            log.exception("ADK orchestration failed before any step; running the direct pipeline")
            inv.run_direct(case_id)
        else:
            raise
    finally:
        _STATE.pop(case_id, None)


# ---------------------------------------------------------------- ask

def ask_agent(system: str, tools: list[Callable[..., Any]] | None = None):
    from f2f_engine.agent import build

    return build(settings.model_fast, tools)


def ask(system: str, tools: list[Callable[..., Any]], message: str) -> str:
    """Answer one question with the in-process ADK LlmAgent (same agent as on Agent Engine, plus a claims tool)."""
    final = ""
    for e in _run(ask_agent(system, tools), message):
        if e.content and e.content.parts and e.author == "ask":
            text = "".join(p.text or "" for p in e.content.parts if getattr(p, "text", None))
            if text.strip():
                final = text
    return final.strip()


# ---------------------------------------------------------------- Vertex AI Agent Engine

_remote = None
_remote_lock = __import__("threading").Lock()


def remote_agent():
    """The deployed Ask agent on Vertex AI Agent Engine (looked up once, then reused)."""
    global _remote
    with _remote_lock:
        if _remote is None:
            import vertexai
            from vertexai import agent_engines

            region = settings.agent_engine.split("/locations/")[1].split("/")[0]
            vertexai.init(project=settings.project, location=region)
            _remote = agent_engines.get(settings.agent_engine)
        return _remote


def ask_remote(message: str) -> str:
    """Ask the agent on Agent Engine; give up after AGENT_ENGINE_TIMEOUT seconds so Ask never hangs."""
    from concurrent.futures import ThreadPoolExecutor

    def go() -> str:
        final = ""
        for e in remote_agent().stream_query(user_id="f2f", message=message):
            for p in (e.get("content") or {}).get("parts", []):
                if p.get("text"):
                    final = p["text"]
        return final.strip()

    pool = ThreadPoolExecutor(max_workers=1)
    try:
        return pool.submit(go).result(timeout=settings.agent_engine_timeout)
    finally:
        pool.shutdown(wait=False)
