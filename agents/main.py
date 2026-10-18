"""Field-to-Fix agent API (Cloud Run: f2f-agents)."""
from __future__ import annotations

import base64
import io
import json
import uuid
from datetime import timedelta

import google.auth
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google.auth.transport import requests as g_requests
from google.cloud import pubsub_v1, storage
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()  # local runs read agents/.env; on Cloud Run the env vars are set by the deploy

from f2f import gemini  # noqa: E402
from f2f.auth import User, current_user, require
from f2f.config import settings
from f2f import analytics, demo
from f2f.pipeline import ask, intake, investigate, link, signal
from f2f.schemas import ApproveIn, AskIn, ClaimExtraction, ClaimIn, SupplierResponseIn
from f2f.tools import bq, fs

app = FastAPI(title="Field-to-Fix agents")
app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def warm_link_cache() -> None:
    """Load claim embeddings in the background so the first filed claim links in seconds."""
    import threading

    def warm():
        try:
            link._EMB.update({r["claim_id"]: r for r in bq._q(
                f"""SELECT s.claim_id, s.embedding, s.translated_text, d.city
                    FROM {settings.table('claims_structured')} s
                    JOIN {settings.table('claims_raw')} r USING (claim_id)
                    LEFT JOIN {settings.table('dealers')} d USING (dealer_id)""")})
        except Exception:
            pass
        if settings.agent_engine:  # connect to the Ask agent on Vertex AI Agent Engine ahead of the first question
            try:
                from f2f import adk_agents
                adk_agents.remote_agent()
            except Exception:
                pass

    threading.Thread(target=warm, daemon=True).start()


@app.get("/health")
def health():
    return {"ok": True, "project": settings.project, "models": [settings.model_fast, settings.model_reason]}


# ---------------- uploads ----------------
class SignIn(BaseModel):
    filename: str
    content_type: str


@app.post("/uploads/sign")
def sign_upload(body: SignIn, user: User = Depends(require("dealer", "supplier", "analyst"))):
    creds, _ = google.auth.default()
    creds.refresh(g_requests.Request())
    name = f"uploads/{user.uid}/{uuid.uuid4().hex}-{body.filename.replace('/', '_')}"
    blob = storage.Client(project=settings.project).bucket(settings.bucket).blob(name)
    kwargs = {}
    if hasattr(creds, "service_account_email"):  # on Cloud Run: sign through the IAM API
        kwargs = {"service_account_email": creds.service_account_email, "access_token": creds.token}
    url = blob.generate_signed_url(version="v4", expiration=timedelta(minutes=15), method="PUT",
                                   content_type=body.content_type, **kwargs)
    return {"upload_url": url, "gs_uri": f"gs://{settings.bucket}/{name}"}


# ---------------- claims ----------------
@app.post("/claims/prefill", response_model=ClaimExtraction)
def prefill(body: ClaimIn, user: User = Depends(require("dealer", "analyst"))):
    """Live field fill for the dealer form."""
    return intake.extract(body.note_text, body.photo_uris, body.audio_uri)


@app.post("/claims")
def submit_claim(body: ClaimIn, user: User = Depends(require("dealer", "analyst"))):
    """File a claim and link it to an open case right away: read, translate, embed, match."""
    # Only files in our own bucket (sample photos or signed-URL uploads) may be handed to Gemini.
    if any(not u.startswith(f"gs://{settings.bucket}/") for u in body.photo_uris + ([body.audio_uri] if body.audio_uri else [])):
        raise HTTPException(400, "Photos must be uploaded through Field-to-Fix")
    claim_id = f"C-{90000 + uuid.uuid4().int % 10000:05d}"
    row = {
        "claim_id": claim_id, "dealer_id": body.dealer_id, "vin": body.vin,
        "claim_date": body.claim_date or settings.as_of, "mileage_km": body.mileage_km,
        "note_text": body.note_text, "photo_uri": body.photo_uris[0] if body.photo_uris else None,
        "audio_uri": body.audio_uri, "labor_code": None, "cost_inr": 4200,
    }
    return link.file_and_link(row, body.photo_uris)


@app.get("/claims/mine")
def my_claims(dealer_id: str = "D-PUN-01", user: User = Depends(require("dealer", "analyst"))):
    return analytics.dealer_claims(dealer_id)


@app.get("/analytics/summary")
def analytics_summary(user: User = Depends(current_user)):
    return analytics.summary()


@app.get("/demo/vins")
def demo_vins(user: User = Depends(current_user)):
    return analytics.sample_vins()


class ResetIn(BaseModel):
    mode: str = "analysed"


@app.post("/demo/reset")
def demo_reset(body: ResetIn, user: User = Depends(current_user)):
    if not user.is_demo:
        raise HTTPException(403, "Only the judge demo account can reset the demo")
    return demo.reset("fresh" if body.mode == "fresh" else "analysed")


@app.post("/pubsub/claims")
async def pubsub_claims(request: Request, user: User = Depends(require("system"))):
    envelope = await request.json()
    row = json.loads(base64.b64decode(envelope["message"]["data"]))
    intake.process([row])
    return {"ok": True}


# ---------------- signals & cases ----------------
@app.post("/signal/run")
def run_signal(user: User = Depends(require("analyst"))):
    return signal.run()


@app.get("/cases/{case_id}/claims")
def case_claims(case_id: str, limit: int = 500, user: User = Depends(current_user)):
    case = _visible_case(case_id, user)
    return bq.get_claims(case["claim_ids"][:limit])


class InvestigateIn(BaseModel):
    mode: str = "auto"  # "live" runs the agents on Gemini; "replay" replays the recorded live run; "auto" = replay if recorded


@app.post("/cases/{case_id}/investigate")
def start_investigation(case_id: str, bg: BackgroundTasks, body: InvestigateIn | None = None,
                        user: User = Depends(require("analyst"))):
    case = _visible_case(case_id, user)
    if case["status"] not in ("detected", "investigating"):
        raise HTTPException(409, f"Case is already {case['status']}")
    fs.append_approval(case_id, user.uid, user.role, "investigate", None)
    mode = (body.mode if body else "auto")
    use_replay = mode == "replay" or (mode == "auto" and case.get("replay_available"))
    if use_replay and not case.get("replay_available"):
        raise HTTPException(409, "No recorded run to replay for this case")
    bg.add_task(demo.replay if use_replay else _safe_investigate, case_id)
    return {"started": True}


def _safe_investigate(case_id: str) -> None:
    try:
        investigate.run(case_id)
    except Exception as e:  # surface failures in the UI instead of a silent stall
        fs.event(case_id, "error", f"Investigation failed: {e}", None, "error")
        fs.update_case(case_id, {"status": "detected"})
        raise


@app.post("/cases/{case_id}/ask")
def ask_case(case_id: str, body: AskIn, user: User = Depends(require("analyst", "sqe", "exec"))):
    _visible_case(case_id, user)
    return ask.answer(case_id, body.question, user.uid)


TRANSITIONS = {
    "dismiss": ({"analyst"}, {"detected"}, "dismissed"),
    "approve": ({"sqe"}, {"sqe_review"}, "sent_to_supplier"),
    "request_evidence": ({"sqe"}, {"sqe_review"}, "detected"),
    "accept_supplier": ({"sqe"}, {"supplier_responded"}, "closed"),
    "reject_supplier": ({"sqe"}, {"supplier_responded"}, "sent_to_supplier"),
}


@app.post("/cases/{case_id}/action")
def case_action(case_id: str, body: ApproveIn, user: User = Depends(current_user)):
    case = _visible_case(case_id, user)
    roles, from_states, to_state = TRANSITIONS[body.action]
    if user.role not in roles:
        raise HTTPException(403, f"Only {', '.join(roles)} can {body.action.replace('_', ' ')}")
    if case["status"] not in from_states:
        raise HTTPException(409, f"Case is {case['status']}; cannot {body.action.replace('_', ' ')}")
    update = {"status": to_state}
    if to_state == "closed":
        update["closed_at"] = fs.now()
    if body.eight_d:
        merged = case.get("eight_d", {})
        for k, v in body.eight_d.items():
            if k in merged and v.get("text") != merged[k].get("text"):
                merged[k] = {**merged[k], "text": v["text"], "edited_by": user.uid}
        update["eight_d"] = merged
    fs.update_case(case_id, update)
    fs.append_approval(case_id, user.uid, user.role, body.action, body.note)
    fs.event(case_id, "workflow", f"{user.role.upper()} · {body.action.replace('_', ' ')} → {to_state.replace('_', ' ')}", None)
    return {"status": to_state}


class Completeness(BaseModel):
    complete: bool
    gaps: list[str]


SUPPLIER_DRAFT = """You are the quality manager at the Tier-1 supplier named in the input. Write your company's 8D response
(D4–D7) to the OEM for THIS case only. Stay consistent with the OEM's evidence: name the actual part and the suspect
batches, confirm a root cause in line with the top hypothesis, and cite the PFMEA (R-..) and control-plan (CP-..) row
ids given in the input. Use concrete, plausible plant data (dates after 2026-10-17, quantities, test results).
1-3 sentences per section. Plain engineering English."""


@app.post("/cases/{case_id}/supplier-draft", response_model=SupplierResponseIn)
def supplier_draft(case_id: str, user: User = Depends(require("supplier"))):
    """A case-specific example reply for the supplier form (demo helper; the supplier edits it before sending)."""
    case = _visible_case(case_id, user)
    t = case.get("trace") or {}
    facts = {"supplier": case.get("supplier_name"), "part": {k: t.get(k) for k in ("part_no", "part_name")},
             "suspect_batches": t.get("suspect_batches"), "plants": t.get("plants"), "build_weeks": t.get("build_weeks"),
             "hypotheses": (case.get("hypotheses") or [])[:2], "pfmea": case.get("pfmea"), "control_plan": case.get("control_plan"),
             "oem_8d": {k: (case.get("eight_d") or {}).get(k, {}).get("text") for k in ("D2", "D3", "D4", "D5")}}
    return gemini.structured(settings.model_fast, SUPPLIER_DRAFT, [json.dumps(facts, default=str)], SupplierResponseIn)


@app.post("/cases/{case_id}/supplier-response")
def supplier_response(case_id: str, body: SupplierResponseIn, user: User = Depends(require("supplier"))):
    case = _visible_case(case_id, user)
    if case["status"] != "sent_to_supplier":
        raise HTTPException(409, "This case is not waiting for a supplier response")
    check = gemini.structured(
        settings.model_fast,
        "You check a supplier's 8D response for completeness against the OEM's problem description and evidence. "
        "List concrete gaps (e.g. a suspect batch not addressed, no verification data, no PFMEA update). Be brief. "
        "The supplier answers D4-D7 only: do not flag D0-D3 or D8 as missing.",
        [json.dumps({"oem_8d": case.get("eight_d"), "trace": case.get("trace"), "supplier_response": body.model_dump()}, default=str)],
        Completeness,
    )
    e8 = case.get("eight_d", {})
    for k, field in (("D4", "D4_root_cause"), ("D5", "D5_corrective_action"), ("D6", "D6_implementation"), ("D7", "D7_prevention")):
        e8[f"{k}_supplier"] = {"text": getattr(body, field), "cites": [], "source": "supplier", "edited_by": user.uid}
    fs.update_case(case_id, {"eight_d": e8, "status": "supplier_responded", "supplier_check": check.model_dump()})
    fs.event(case_id, "workflow", f"Supplier responded · AI completeness check: {'complete' if check.complete else f'{len(check.gaps)} gaps'}", None)
    return check


@app.get("/cases/{case_id}/8d.pdf")
def eight_d_pdf(case_id: str, user: User = Depends(current_user)):
    from f2f.report import build_pdf

    case = _visible_case(case_id, user)
    return StreamingResponse(io.BytesIO(build_pdf(case)), media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{case_id}-8D.pdf"'})


@app.get("/overview")
def overview(user: User = Depends(require("exec", "analyst", "sqe"))):
    counts = bq.overview_counts()
    status: dict[str, int] = {}
    for s in fs.db().collection("cases").stream():
        st = s.to_dict().get("status", "detected")
        status[st] = status.get(st, 0) + 1
    return {**counts, "cases_by_status": status}


def _visible_case(case_id: str, user: User) -> dict:
    case = fs.get_case(case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    if user.role == "supplier" and case.get("supplier_id") != user.org_id:
        raise HTTPException(404, "Case not found")
    return case
