"""Link one freshly filed claim to an open case, in seconds instead of the monthly warranty review.

Each open case is represented by the centroid of its claims' embeddings. A new claim joins the
nearest case when cosine similarity clears LINK_THRESHOLD; otherwise it waits for the next scan.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone

import numpy as np
from google.cloud import firestore

from .. import gemini
from ..config import settings
from ..tools import bq, fs
from . import intake

LINK_THRESHOLD = 0.93
_EMB: dict[str, dict] = {}  # claim_id -> {embedding, translated_text, city}
OPEN = ("detected", "investigating", "sqe_review", "sent_to_supplier", "supplier_responded")


def _cos(a: np.ndarray, b: np.ndarray) -> float:
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def file_and_link(row: dict, photo_uris: list[str]) -> dict:
    timings = {}

    t = time.time()
    x = intake.extract(row["note_text"], photo_uris, row.get("audio_uri"))
    timings["read_ms"] = int((time.time() - t) * 1000)

    t = time.time()
    vec = gemini.embed([intake.embedding_text(x)])[0]
    timings["embed_ms"] = int((time.time() - t) * 1000)

    bq.insert_rows("claims_raw", [row])
    bq.insert_rows("claims_structured", [{
        "claim_id": row["claim_id"], **x.model_dump(), "embedding": vec,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }])

    t = time.time()
    cases = [s for s in fs.db().collection("cases").stream() if s.to_dict().get("status") in OPEN]
    all_ids = sorted({cid for s in cases for cid in s.to_dict().get("claim_ids", [])})
    missing = [i for i in all_ids if i not in _EMB]
    if missing:  # claims never change once written, so each is fetched from BigQuery once per instance
        for r in bq._q(
            f"""SELECT s.claim_id, s.embedding, s.translated_text, d.city
                FROM {settings.table('claims_structured')} s
                JOIN {settings.table('claims_raw')} r USING (claim_id)
                LEFT JOIN {settings.table('dealers')} d USING (dealer_id)
                WHERE s.claim_id IN UNNEST(@ids)""", ids=missing):
            _EMB[r["claim_id"]] = r
    emb = _EMB
    _EMB[row["claim_id"]] = {"claim_id": row["claim_id"], "embedding": vec, "translated_text": x.translated_text, "city": None}
    q = np.array(vec)
    candidates = []
    for s in cases:
        d = s.to_dict()
        rows = [emb[c] for c in d.get("claim_ids", []) if c in emb]
        if not rows:
            continue
        m = np.array([r["embedding"] for r in rows])
        candidates.append({"case_id": s.id, "title": d.get("title"), "status": d.get("status"),
                           "similarity": round(_cos(q, m.mean(axis=0)), 3), "_rows": rows, "_m": m})
    candidates.sort(key=lambda c: -c["similarity"])
    timings["match_ms"] = int((time.time() - t) * 1000)

    linked = None
    if candidates and candidates[0]["similarity"] >= LINK_THRESHOLD:
        best = candidates[0]
        sims = [_cos(q, v) for v in best["_m"]]
        order = np.argsort(sims)[::-1][:3]
        similar = [{"claim_id": best["_rows"][i]["claim_id"], "city": best["_rows"][i]["city"],
                    "text": best["_rows"][i]["translated_text"], "similarity": round(sims[i], 3)} for i in order]
        fs.case_ref(best["case_id"]).update({
            "claim_ids": firestore.ArrayUnion([row["claim_id"]]),
            "count": firestore.Increment(1),
            "recent_count": firestore.Increment(1),
            "new_claims": firestore.ArrayUnion([row["claim_id"]]),
            "updated_at": fs.now(),
        })
        fs.event(best["case_id"], "intake",
                 f"New claim {row['claim_id']} ({x.lang}) linked in {sum(timings.values()) / 1000:.1f}s · similarity {best['similarity']:.2f}")
        linked = {k: v for k, v in best.items() if not k.startswith("_")} | {"similar": similar}

    return {
        "claim_id": row["claim_id"],
        "extraction": x.model_dump(),
        "timings": timings,
        "linked": linked,
        "candidates": [{k: v for k, v in c.items() if not k.startswith("_")} for c in candidates[:3]],
        "threshold": LINK_THRESHOLD,
    }
