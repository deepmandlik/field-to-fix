"""Agent 2 — Signal: cluster recent claims by meaning and flag clusters growing faster than baseline."""
from __future__ import annotations

from collections import Counter
from datetime import date, timedelta

import numpy as np
from sklearn.cluster import HDBSCAN

from .. import gemini
from ..config import settings
from ..schemas import ClusterLabel
from ..tools import bq, fs

RECENT_DAYS = 21
WINDOW_DAYS = 120
MIN_RECENT = 8
MERGE_SIM = 0.92

LABEL_SYSTEM = """You name warranty failure clusters for automotive quality engineers.
Given sample claims from one cluster, return a short, specific label (max 6 words, e.g. 'Coolant leak at hose clamp'),
the component, the failure mode and a 1-5 severity. Use only what the claims say."""


def _as_date(d) -> date:
    return d if isinstance(d, date) else date.fromisoformat(str(d))


def weekly_series(dates: list[date], as_of: date, weeks: int = 12) -> list[int]:
    out = [0] * weeks
    for d in dates:
        w = (as_of - d).days // 7
        if 0 <= w < weeks:
            out[weeks - 1 - w] += 1
    return out


def run() -> dict:
    as_of = date.fromisoformat(settings.as_of)
    rows = bq.recent_claims_with_embeddings(WINDOW_DAYS)
    if len(rows) < 20:
        return {"claims": len(rows), "clusters": 0, "cases": []}

    X = np.array([r["embedding"] for r in rows], dtype=float)
    X = X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-9)
    labels = HDBSCAN(min_cluster_size=10, min_samples=5).fit_predict(X)

    # Density clustering can split one failure into near-identical clusters (e.g. "screen reboots"
    # vs "head unit restarts"). Merge clusters whose centroids are nearly the same direction.
    labs = sorted(set(labels) - {-1})
    cent = {l: X[labels == l].mean(axis=0) for l in labs}
    parent = {l: l for l in labs}

    def root(l):
        while parent[l] != l:
            l = parent[l]
        return l

    for i, a in enumerate(labs):
        for b in labs[i + 1:]:
            ca, cb = cent[a], cent[b]
            if float(ca @ cb / (np.linalg.norm(ca) * np.linalg.norm(cb))) > MERGE_SIM:
                parent[root(b)] = root(a)
    labels = np.array([root(l) if l != -1 else -1 for l in labels])

    baseline_days = WINDOW_DAYS - RECENT_DAYS
    found = []
    for lab in sorted(set(labels) - {-1}):
        members = [r for r, l in zip(rows, labels) if l == lab]
        dates = [_as_date(r["claim_date"]) for r in members]
        recent = sum(1 for d in dates if (as_of - d).days < RECENT_DAYS)
        base = len(dates) - recent
        growth = (recent / RECENT_DAYS) / (max(base, 1) / baseline_days)
        found.append({"members": members, "dates": dates, "recent": recent, "growth": round(growth, 2)})

    cases = []
    for c in sorted(found, key=lambda c: -c["growth"]):
        if c["recent"] < MIN_RECENT:
            continue
        top = Counter((m["component"].lower(), m["failure_mode"].lower()) for m in c["members"]).most_common(1)[0][0]
        signature = f"{top[0]}::{top[1]}"
        existing = fs.open_case_for_cluster(signature)
        ids = [m["claim_id"] for m in c["members"]]
        level = "critical" if c["growth"] >= 2.5 else "warning" if c["growth"] >= 1.5 else "watch"
        stats = {
            "claim_ids": ids,
            "count": len(ids),
            "recent_count": c["recent"],
            "growth_x": c["growth"],
            "level": level,
            "weekly": weekly_series(c["dates"], as_of),
            "first_seen": min(c["dates"]).isoformat(),
        }
        if existing:
            fs.update_case(existing["id"], stats)
            cases.append(existing["id"])
            continue
        sample = "\n".join(f"- [{m['claim_id']}] {m['translated_text']}" for m in c["members"][:15])
        lab = gemini.structured(settings.model_fast, LABEL_SYSTEM, [sample], ClusterLabel)
        case_id = fs.create_case({
            **stats,
            "signature": signature,
            "title": lab.label,
            "component": lab.component,
            "failure_mode": lab.failure_mode,
            "severity": lab.severity,
            "status": "detected",
            "approvals": [],
        })
        cases.append(case_id)
    return {"claims": len(rows), "clusters": len(found), "cases": cases}
