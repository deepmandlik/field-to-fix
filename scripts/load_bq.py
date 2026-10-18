"""Create the f2f BigQuery tables, load data/seed/*.jsonl, embed PFMEA rows and run Intake on every claim.

Usage (from repo root, with agents/.venv active):
  python scripts/load_bq.py            # full: Gemini Flash reads every claim (honest pipeline, ~5 min)
  python scripts/load_bq.py --fast     # dev: skip extraction, use templated fields, still embeds
  python scripts/load_bq.py --reset    # drop and recreate tables first
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "agents"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / "agents" / ".env")

from google.cloud import bigquery  # noqa: E402

from f2f import gemini  # noqa: E402
from f2f.config import settings  # noqa: E402
from f2f.pipeline import intake  # noqa: E402

S, F, I, D, R = "STRING", "FLOAT64", "INT64", "DATE", "REPEATED"
SCHEMAS = {
    "vehicles": [("vin", S), ("model", S), ("plant_id", S), ("line", S), ("build_date", D)],
    "vin_parts": [("vin", S), ("part_no", S), ("supplier_id", S), ("batch_id", S)],
    "batches": [("batch_id", S), ("supplier_id", S), ("part_no", S), ("prod_week", S), ("qty", I)],
    "stock": [("batch_id", S), ("location", S), ("location_type", S), ("qty_on_hand", I)],
    "parts": [("part_no", S), ("part_name", S)],
    "suppliers": [("supplier_id", S), ("name", S), ("tier", I), ("parent_id", S)],
    "dealers": [("dealer_id", S), ("city", S), ("country", S)],
    "plants": [("plant_id", S), ("name", S)],
    "claims_raw": [("claim_id", S), ("dealer_id", S), ("vin", S), ("claim_date", D), ("mileage_km", I),
                   ("note_text", S), ("photo_uri", S), ("audio_uri", S), ("labor_code", S), ("cost_inr", I)],
    "claims_structured": [("claim_id", S), ("lang", S), ("translated_text", S), ("component", S),
                          ("failure_mode", S), ("symptom", S), ("condition", S), ("severity", I),
                          ("photo_findings", S), ("confidence", F), ("embedding", F, R), ("processed_at", "TIMESTAMP")],
    "pfmea_rows": [("row_id", S), ("doc", S), ("process_step", S), ("failure_mode", S), ("effect", S), ("cause", S),
                   ("prevention", S), ("detection", S), ("severity", I), ("occurrence", I), ("detection_rating", I),
                   ("rpn", I), ("embedding", F, R)],
    "control_plan_rows": [("row_id", S), ("process_step", S), ("characteristic", S), ("method", S),
                          ("frequency", S), ("reaction_plan", S)],
}
FAST_FIELDS = {  # used only with --fast
    "clamp_leak": ("coolant hose clamp", "leak at joint", "coolant loss / low coolant warning", "after cold start", 3),
    "brake_squeal": ("front brake pads", "noise", "squeal when braking at low speed", "low speed braking", 2),
    "infotainment_reboot": ("infotainment head unit", "reboot", "screen restarts", "bluetooth connect", 2),
    "ac_weak": ("AC compressor", "insufficient cooling", "AC not cold", "hot afternoon", 2),
    "window_noise": ("window regulator", "noise / slow", "window slow and grinding", "window up", 1),
    "battery_drain": ("12V battery", "discharged", "no start", "after parking", 4),
    "door_seal_leak": ("rear door seal", "water ingress", "water in footwell", "rain", 2),
    "wiper_stall": ("wiper motor", "stall", "wiper stops mid sweep", "high speed", 3),
    "fuel_pump_whine": ("fuel pump module", "noise", "whine and hesitation", "idle", 3),
}


def read(name: str) -> list[dict]:
    with open(ROOT / "data" / "seed" / f"{name}.jsonl", encoding="utf-8") as f:
        return [json.loads(line) for line in f]


def schema(cols):
    return [bigquery.SchemaField(c[0], c[1], mode=c[2] if len(c) > 2 else "NULLABLE") for c in cols]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true")
    ap.add_argument("--reset", action="store_true")
    a = ap.parse_args()

    client = bigquery.Client(project=settings.project, location=settings.bq_location)
    ds = f"{settings.project}.{settings.bq_dataset}"
    client.create_dataset(bigquery.Dataset(ds), exists_ok=True)

    for name, cols in SCHEMAS.items():
        tid = f"{ds}.{name}"
        if a.reset:
            client.delete_table(tid, not_found_ok=True)
        client.create_table(bigquery.Table(tid, schema=schema(cols)), exists_ok=True)

    def load(name: str, rows: list[dict]) -> None:
        job = client.load_table_from_json(rows, f"{ds}.{name}", job_config=bigquery.LoadJobConfig(
            schema=schema(SCHEMAS[name]), write_disposition="WRITE_TRUNCATE"))
        job.result()
        print(f"loaded {name:20s} {len(rows):>7,d}")

    for name in ("vehicles", "vin_parts", "batches", "stock", "parts", "suppliers", "dealers", "plants",
                 "claims_raw", "control_plan_rows"):
        load(name, read(name))

    pf = read("pfmea_rows")
    vecs = gemini.embed([f"{r['process_step']}. {r['failure_mode']}. Effect: {r['effect']}. Cause: {r['cause']}" for r in pf],
                        task_type="RETRIEVAL_DOCUMENT")
    load("pfmea_rows", [{**r, "embedding": v} for r, v in zip(pf, vecs)])

    claims = read("claims_raw")
    if a.fast:
        truth = {t["claim_id"]: t["failure"] for t in read("claims_truth")}
        rows = []
        for c in claims:
            comp, fm, sym, cond, sev = FAST_FIELDS[truth[c["claim_id"]]]
            rows.append({"claim_id": c["claim_id"], "lang": "xx", "translated_text": c["note_text"], "component": comp,
                         "failure_mode": fm, "symptom": sym, "condition": cond, "severity": sev,
                         "photo_findings": "no photo", "confidence": 1.0})
        vecs = gemini.embed([f"{r['component']} | {r['failure_mode']} | {r['symptom']} | {r['translated_text']}" for r in rows])
        ts = datetime.now(timezone.utc).isoformat()
        load("claims_structured", [{**r, "embedding": v, "processed_at": ts} for r, v in zip(rows, vecs)])
    else:
        # Resumable: each finished chunk is appended to a cache, so a quota error never loses work.
        cache = ROOT / "data" / "seed" / "claims_structured.cache.jsonl"
        done = {}
        if cache.exists():
            for line in cache.read_text(encoding="utf-8").splitlines():
                r = json.loads(line)
                done[r["claim_id"]] = r
        todo = [c for c in claims if c["claim_id"] not in done]
        print(f"intake: {len(done)} cached, {len(todo)} to process")
        for i in range(0, len(todo), 30):
            out = intake.process(todo[i:i + 30], write=False)
            with open(cache, "a", encoding="utf-8") as f:
                for r in out:
                    done[r["claim_id"]] = r
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
            print(f"intake {len(done)}/{len(claims)}  e.g. {out[0]['claim_id']}: {out[0]['component']} / {out[0]['failure_mode']} [{out[0]['lang']}]", flush=True)
        load("claims_structured", [done[c["claim_id"]] for c in claims])
    print("done")


if __name__ == "__main__":
    main()
