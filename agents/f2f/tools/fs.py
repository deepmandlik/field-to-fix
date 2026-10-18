"""Firestore: live case state. The web app reads these documents directly; only the API writes them."""
from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache

from google.cloud import firestore

from ..config import settings


@lru_cache
def db() -> firestore.Client:
    return firestore.Client(project=settings.project)


def now() -> datetime:
    return datetime.now(timezone.utc)


def case_ref(case_id: str):
    return db().collection("cases").document(case_id)


def get_case(case_id: str) -> dict | None:
    snap = case_ref(case_id).get()
    return {"id": snap.id, **snap.to_dict()} if snap.exists else None


def open_case_for_cluster(signature: str) -> dict | None:
    """Avoid duplicate cases when the hourly scan re-finds the same cluster."""
    q = (db().collection("cases")
         .where(filter=firestore.FieldFilter("signature", "==", signature))
         .where(filter=firestore.FieldFilter("status", "in", ["detected", "investigating", "sqe_review", "sent_to_supplier", "supplier_responded"]))
         .limit(1))
    for s in q.stream():
        return {"id": s.id, **s.to_dict()}
    return None


def next_case_id() -> str:
    counter = db().collection("meta").document("counters")

    @firestore.transactional
    def bump(tx):
        snap = counter.get(transaction=tx)
        n = (snap.to_dict() or {}).get("case", 140) + 1 if snap.exists else 141
        tx.set(counter, {"case": n}, merge=True)
        return n

    return f"F2F-{bump(db().transaction()):04d}"


def create_case(data: dict) -> str:
    case_id = next_case_id()
    case_ref(case_id).set({**data, "created_at": now(), "updated_at": now()})
    event(case_id, "signal", f"Cluster detected: {data.get('title')}", 100)
    return case_id


def update_case(case_id: str, data: dict) -> None:
    case_ref(case_id).set({**data, "updated_at": now()}, merge=True)


def event(case_id: str, agent: str, message: str, pct: int | None = None, status: str = "done") -> None:
    """Append one progress line. The UI listens to this subcollection and streams it."""
    case_ref(case_id).collection("events").add(
        {"agent": agent, "message": message, "pct": pct, "status": status, "at": now()}
    )


def add_message(case_id: str, role: str, text: str, cites: list[str] | None = None, uid: str | None = None,
                via: str | None = None) -> None:
    case_ref(case_id).collection("messages").add(
        {"role": role, "text": text, "cites": cites or [], "uid": uid, "via": via, "at": now()}
    )


def recent_messages(case_id: str, limit: int = 10) -> list[dict]:
    q = (case_ref(case_id).collection("messages")
         .order_by("at", direction=firestore.Query.DESCENDING).limit(limit))
    return [s.to_dict() for s in q.stream()][::-1]


def append_approval(case_id: str, uid: str, role: str, action: str, note: str | None) -> None:
    case_ref(case_id).update({
        "approvals": firestore.ArrayUnion([{"uid": uid, "role": role, "action": action, "note": note, "at": now()}]),
        "updated_at": now(),
    })
