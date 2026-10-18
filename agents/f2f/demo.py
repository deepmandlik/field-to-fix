"""Judge-demo helpers: snapshot a finished investigation and reset cases so the story can be replayed."""
from __future__ import annotations

from google.cloud import firestore

from .tools import fs

ANALYSIS_FIELDS = ("trace", "hypotheses", "eight_d", "pfmea", "control_plan", "recommended_checks",
                   "open_questions", "supplier_id", "supplier_name", "investigated_at", "investigation_seconds")
CLEAR_FIELDS = ANALYSIS_FIELDS + ("supplier_check", "new_claims", "closed_at")


def snapshot(case_id: str) -> None:
    case = fs.get_case(case_id) or {}
    events = [e.to_dict() for e in fs.case_ref(case_id).collection("events").order_by("at").stream()]
    data = {k: case[k] for k in ANALYSIS_FIELDS if k in case}
    if "eight_d" in data:  # keep the AI draft, not later supplier or SQE edits
        data["eight_d"] = {k: v for k, v in data["eight_d"].items() if not k.endswith("_supplier")}
    fs.db().collection("meta").document(f"snap-{case_id}").set({**data, "events": events})


def _clear_sub(case_id: str, name: str) -> None:
    for d in fs.case_ref(case_id).collection(name).stream():
        d.reference.delete()


def reset(mode: str) -> dict:
    """Every case goes back to Detected.
    mode 'fresh': Investigate calls Gemini live (~1-2 min, uses quota).
    mode 'analysed': Investigate replays the recorded investigation in ~15 s, labelled as a replay."""
    done = []
    for s in fs.db().collection("cases").stream():
        cid = s.id
        snap = fs.db().collection("meta").document(f"snap-{cid}").get()
        _clear_sub(cid, "events")
        _clear_sub(cid, "messages")
        update = {k: firestore.DELETE_FIELD for k in CLEAR_FIELDS}
        update.update({"status": "detected", "approvals": [], "updated_at": fs.now(),
                       "replay_available": mode == "analysed" and snap.exists})
        fs.case_ref(cid).update(update)
        fs.event(cid, "signal", f"Cluster detected: {s.to_dict().get('title')}", 100)
        done.append(cid)
    return {"reset": done, "mode": mode}


def replay(case_id: str) -> None:
    """Re-run a recorded investigation step by step, so the demo works without Gemini quota."""
    import time

    d = fs.db().collection("meta").document(f"snap-{case_id}").get().to_dict()
    events = [e for e in d.pop("events", []) if e.get("agent") in ("trace", "hypothesise", "draft_8d")]
    fs.update_case(case_id, {"status": "investigating", "replay_available": False})
    fs.event(case_id, "replay", "Replaying a recorded live run of the agents (no Gemini calls). Choose Investigate live for a fresh run.", 0)
    for e in events:
        time.sleep(1.8 if e.get("status") == "running" else 1.2)
        fs.event(case_id, e["agent"], e["message"], e.get("pct"), e.get("status", "done"))
        if e["agent"] == "trace" and e.get("pct") == 35:
            fs.update_case(case_id, {k: d[k] for k in ("trace", "supplier_id", "supplier_name") if k in d})
        if e["agent"] == "hypothesise" and e.get("pct") == 70:
            fs.update_case(case_id, {k: d[k] for k in ("hypotheses", "pfmea", "control_plan", "recommended_checks") if k in d})
    d.setdefault("investigation_seconds", 79)  # measured duration of the recorded live run
    fs.update_case(case_id, {**d, "status": "sqe_review", "investigated_at": fs.now()})
