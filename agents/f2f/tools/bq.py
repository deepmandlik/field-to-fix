"""Typed, read-mostly BigQuery tools. Agents call these; they never write SQL themselves."""
from __future__ import annotations

from functools import lru_cache

import numpy as np
from google.cloud import bigquery

from ..config import settings


@lru_cache
def bq() -> bigquery.Client:
    return bigquery.Client(project=settings.project, location=settings.bq_location)


def _q(sql: str, **params) -> list[dict]:
    qp = []
    for k, v in params.items():
        if isinstance(v, list):
            qp.append(bigquery.ArrayQueryParameter(k, "STRING", v))
        elif isinstance(v, int):
            qp.append(bigquery.ScalarQueryParameter(k, "INT64", v))
        else:
            qp.append(bigquery.ScalarQueryParameter(k, "STRING", v))
    job = bq().query(sql, job_config=bigquery.QueryJobConfig(query_parameters=qp))
    return [dict(r) for r in job.result()]


# ---------- writes used by intake ----------
def insert_rows(table: str, rows: list[dict]) -> None:
    if not rows:
        return
    errors = bq().insert_rows_json(f"{settings.project}.{settings.bq_dataset}.{table}", rows)
    if errors:
        raise RuntimeError(f"BigQuery insert into {table} failed: {errors[:3]}")


# ---------- signal ----------
def recent_claims_with_embeddings(days: int = 120) -> list[dict]:
    return _q(
        f"""
        SELECT s.claim_id, s.component, s.failure_mode, s.severity, s.translated_text,
               s.embedding, r.claim_date, r.vin
        FROM {settings.table('claims_structured')} s
        JOIN {settings.table('claims_raw')} r USING (claim_id)
        WHERE r.claim_date >= DATE_SUB(DATE(@as_of), INTERVAL @days DAY)
        """,
        as_of=settings.as_of, days=days,
    )


# ---------- trace ----------
def get_claims(claim_ids: list[str]) -> list[dict]:
    return _q(
        f"""
        SELECT r.claim_id, r.vin, r.dealer_id, d.city, r.claim_date, r.mileage_km, r.cost_inr, r.note_text,
               r.photo_uri, s.lang, s.translated_text, s.component, s.failure_mode,
               s.condition, s.severity, s.photo_findings, s.confidence
        FROM {settings.table('claims_raw')} r
        JOIN {settings.table('claims_structured')} s USING (claim_id)
        LEFT JOIN {settings.table('dealers')} d USING (dealer_id)
        WHERE r.claim_id IN UNNEST(@ids)
        ORDER BY r.claim_date DESC
        """,
        ids=claim_ids,
    )


def trace_vins(claim_ids: list[str]) -> dict:
    """For a cluster: which plants, models, suppliers and batches the failing VINs share."""
    rows = _q(
        f"""
        WITH c AS (SELECT DISTINCT vin FROM {settings.table('claims_raw')} WHERE claim_id IN UNNEST(@ids))
        SELECT v.vin, v.model, v.plant_id, v.line, FORMAT_DATE('%G-W%V', v.build_date) AS build_week,
               p.part_no, pc.part_name, p.supplier_id, s.name AS supplier_name, s.tier, p.batch_id
        FROM c
        JOIN {settings.table('vehicles')} v USING (vin)
        JOIN {settings.table('vin_parts')} p USING (vin)
        JOIN {settings.table('parts')} pc USING (part_no)
        JOIN {settings.table('suppliers')} s USING (supplier_id)
        """,
        ids=claim_ids,
    )
    return {"rows": rows, "n": len({r["vin"] for r in rows}) or 1}


def share(rows: list[dict], key: str, n_vins: int) -> list[dict]:
    """Fraction of distinct failing VINs that have each value of `key`."""
    vins_by: dict[str, set] = {}
    for r in rows:
        vins_by.setdefault(r[key], set()).add(r["vin"])
    counts = {k: len(v) for k, v in vins_by.items()}
    out = [{"id": k, "count": v, "share": round(v / n_vins, 3)} for k, v in counts.items()]
    return sorted(out, key=lambda x: -x["count"])


def batch_concentration(claim_ids: list[str], part_no: str) -> list[dict]:
    """Share of failing VINs per batch of one part, vs that batch's share of all production."""
    return _q(
        f"""
        WITH failing AS (
          SELECT DISTINCT p.batch_id, p.vin
          FROM {settings.table('claims_raw')} r
          JOIN {settings.table('vin_parts')} p USING (vin)
          WHERE r.claim_id IN UNNEST(@ids) AND p.part_no = @part
        ),
        fleet AS (
          SELECT batch_id, COUNT(*) AS fleet_vins
          FROM {settings.table('vin_parts')} WHERE part_no = @part GROUP BY batch_id
        )
        SELECT f.batch_id, b.supplier_id, s.name AS supplier_name, b.prod_week,
               COUNT(DISTINCT f.vin) AS failing_vins, fl.fleet_vins
        FROM failing f
        JOIN {settings.table('batches')} b USING (batch_id)
        JOIN {settings.table('suppliers')} s ON s.supplier_id = b.supplier_id
        JOIN fleet fl USING (batch_id)
        GROUP BY 1,2,3,4,6
        ORDER BY failing_vins DESC
        """,
        ids=claim_ids, part=part_no,
    )


def other_models_using_batches(batch_ids: list[str], exclude_models: list[str]) -> list[dict]:
    return _q(
        f"""
        SELECT v.model, COUNT(DISTINCT v.vin) AS vins_at_risk
        FROM {settings.table('vin_parts')} p
        JOIN {settings.table('vehicles')} v USING (vin)
        WHERE p.batch_id IN UNNEST(@b) AND v.model NOT IN UNNEST(@m)
        GROUP BY 1 ORDER BY 2 DESC
        """,
        b=batch_ids, m=exclude_models or ["-"],
    )


def stock_for_batches(batch_ids: list[str]) -> list[dict]:
    return _q(
        f"""
        SELECT batch_id, location, location_type, qty_on_hand
        FROM {settings.table('stock')} WHERE batch_id IN UNNEST(@b)
        ORDER BY qty_on_hand DESC
        """,
        b=batch_ids,
    )


# ---------- hypothesise ----------
def search_pfmea(query_vec: list[float], top_k: int = 8) -> list[dict]:
    """Cosine search over PFMEA rows. The table is small, so this runs in memory."""
    rows = _q(f"SELECT * FROM {settings.table('pfmea_rows')}")
    if not rows:
        return []
    m = np.array([r["embedding"] for r in rows], dtype=float)
    q = np.array(query_vec, dtype=float)
    sims = m @ q / (np.linalg.norm(m, axis=1) * np.linalg.norm(q) + 1e-9)
    order = np.argsort(-sims)[:top_k]
    out = []
    for i in order:
        r = {k: v for k, v in rows[i].items() if k != "embedding"}
        r["similarity"] = round(float(sims[i]), 3)
        out.append(r)
    return out


def control_plan_for_steps(steps: list[str]) -> list[dict]:
    return _q(
        f"SELECT * FROM {settings.table('control_plan_rows')} WHERE process_step IN UNNEST(@s)",
        s=steps or ["-"],
    )


# ---------- overview ----------
def overview_counts() -> dict:
    rows = _q(
        f"""
        SELECT COUNT(*) AS claims, SUM(cost_inr) AS cost_inr,
               COUNTIF(claim_date >= DATE_SUB(DATE(@as_of), INTERVAL 30 DAY)) AS claims_30d
        FROM {settings.table('claims_raw')}
        """,
        as_of=settings.as_of,
    )
    return rows[0] if rows else {}
