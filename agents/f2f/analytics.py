"""Dashboard aggregates from BigQuery. One scan of claims, grouped in Python, cached briefly."""
from __future__ import annotations

import time
from collections import Counter, defaultdict
from datetime import date

from .config import settings
from .tools import bq

CATEGORIES = [  # (label, keywords) checked in order against the extracted component
    ("Coolant hose", ("clamp", "hose", "coolant", "radiator")),
    ("Brakes", ("brake",)),
    ("Infotainment", ("infotainment", "head unit", "screen", "display", "bluetooth")),
    ("Air conditioning", ("ac ", "a/c", "compressor", "air con", "cooling")),
    ("Windows", ("window", "regulator")),
    ("Battery", ("battery",)),
    ("Door seals", ("seal", "door", "water")),
    ("Wipers", ("wiper",)),
    ("Fuel system", ("fuel", "pump")),
]
_cache: dict = {"at": 0.0, "data": None}


def category(component: str) -> str:
    c = f" {(component or '').lower()} "
    if "ac compressor" in c or c.strip().startswith("ac"):
        return "Air conditioning"
    for label, keys in CATEGORIES:
        if any(k in c for k in keys):
            return label
    return "Other"


def summary(force: bool = False) -> dict:
    if not force and _cache["data"] and time.time() - _cache["at"] < 60:
        return _cache["data"]
    rows = bq._q(f"""
        SELECT r.claim_id, r.dealer_id, d.city, d.country, r.claim_date, r.mileage_km, r.cost_inr,
               s.lang, s.component, s.severity
        FROM {settings.table('claims_raw')} r
        JOIN {settings.table('claims_structured')} s USING (claim_id)
        LEFT JOIN {settings.table('dealers')} d USING (dealer_id)""")
    as_of = date.fromisoformat(settings.as_of)
    weeks = 16
    by_cat_week: dict[str, list[int]] = defaultdict(lambda: [0] * weeks)
    cost = Counter()
    cats = Counter()
    langs = Counter()
    cities = Counter()
    dealers: dict[str, dict] = {}
    sev = Counter()
    last30 = 0
    for r in rows:
        d = r["claim_date"] if isinstance(r["claim_date"], date) else date.fromisoformat(str(r["claim_date"]))
        cat = category(r["component"])
        w = (as_of - d).days // 7
        if 0 <= w < weeks:
            by_cat_week[cat][weeks - 1 - w] += 1
        if (as_of - d).days < 30:
            last30 += 1
        cost[cat] += r["cost_inr"] or 0
        cats[cat] += 1
        langs[r["lang"] or "?"] += 1
        cities[r["city"] or r["dealer_id"]] += 1
        sev[int(r["severity"] or 0)] += 1
        dd = dealers.setdefault(r["dealer_id"], {"dealer_id": r["dealer_id"], "city": r["city"], "claims": 0, "cats": Counter()})
        dd["claims"] += 1
        dd["cats"][cat] += 1
    top = [c for c, _ in cats.most_common(5)]
    series = [{"name": c, "values": by_cat_week[c]} for c in top]
    other = [sum(by_cat_week[c][i] for c in by_cat_week if c not in top) for i in range(weeks)]
    series.append({"name": "Other", "values": other})
    data = {
        "as_of": settings.as_of,
        "claims": len(rows),
        "claims_30d": last30,
        "cost_inr": sum(cost.values()),
        "avg_mileage": round(sum(r["mileage_km"] or 0 for r in rows) / max(len(rows), 1)),
        "weekly": series,
        "week_labels": [f"W-{weeks - 1 - i}" if i < weeks - 1 else "This wk" for i in range(weeks)],
        "by_category": [{"name": c, "claims": n, "cost_inr": cost[c]} for c, n in cats.most_common()],
        "languages": [{"name": k, "value": v} for k, v in langs.most_common()],
        "cities": [{"name": k, "value": v} for k, v in cities.most_common(8)],
        "severity": [{"name": str(k), "value": sev[k]} for k in sorted(sev)],
        "dealers": [{**{k: v for k, v in d.items() if k != "cats"}, "top_issue": d["cats"].most_common(1)[0][0]}
                    for d in sorted(dealers.values(), key=lambda d: -d["claims"])],
    }
    _cache.update(at=time.time(), data=data)
    return data


def dealer_claims(dealer_id: str, limit: int = 12) -> list[dict]:
    return bq._q(f"""
        SELECT r.claim_id, r.vin, r.claim_date, r.mileage_km, r.note_text, s.lang, s.translated_text,
               s.component, s.failure_mode, s.severity
        FROM {settings.table('claims_raw')} r
        JOIN {settings.table('claims_structured')} s USING (claim_id)
        WHERE r.dealer_id = @d
        ORDER BY r.claim_date DESC, r.claim_id DESC LIMIT @n""", d=dealer_id, n=limit)


def sample_vins() -> list[dict]:
    """VINs for the judge demo: Swift-X cars fitted with the suspect clamp batch, plus a control car."""
    bad = bq._q(f"""
        SELECT v.vin, v.model, v.build_date, p.batch_id
        FROM {settings.table('vehicles')} v JOIN {settings.table('vin_parts')} p USING (vin)
        WHERE p.part_no = 'P-1001' AND p.batch_id IN ('KAV-26W31','KAV-26W32') AND v.model = 'Swift-X'
          AND v.vin NOT IN (SELECT vin FROM {settings.table('claims_raw')})
        ORDER BY v.vin LIMIT 3""")
    other = bq._q(f"""
        SELECT v.vin, v.model, v.build_date, p.batch_id
        FROM {settings.table('vehicles')} v JOIN {settings.table('vin_parts')} p USING (vin)
        WHERE p.part_no = 'P-1002' AND v.model = 'City-Z' ORDER BY v.vin LIMIT 1""")
    return [{**r, "build_date": str(r["build_date"]), "hint": "suspect clamp batch"} for r in bad] + \
           [{**r, "build_date": str(r["build_date"]), "hint": "control vehicle"} for r in other]
