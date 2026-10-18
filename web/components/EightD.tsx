"use client";

import { useEffect, useState } from "react";
import { downloadPdf } from "@/lib/api";
import { STATUS_LABEL, fmtTime, pct } from "@/lib/data";
import { PERSONAS } from "@/lib/session";
import { LogoMark } from "./Logo";

const SECTIONS: { k: string; title: string; who: "ai" | "oem" | "sup" }[] = [
  { k: "D0", title: "Prepare & emergency response", who: "oem" },
  { k: "D1", title: "Team", who: "oem" },
  { k: "D2", title: "Problem description", who: "ai" },
  { k: "D3", title: "Interim containment", who: "ai" },
  { k: "D4", title: "Root cause", who: "ai" },
  { k: "D5", title: "Permanent corrective action", who: "ai" },
  { k: "D6", title: "Implement & validate", who: "sup" },
  { k: "D7", title: "Prevent recurrence", who: "sup" },
  { k: "D8", title: "Close & recognise the team", who: "oem" },
];
const WHO = { ai: { t: "AI draft · OEM approves", cls: "ai" }, oem: { t: "OEM", cls: "" }, sup: { t: "Supplier", cls: "sup" } };

export function EightDDoc({ c, role, busy, act, onCite }: { c: any; role: string; busy: boolean; act: (p: string, b?: any) => void; onCite: (x: string) => void }) {
  const editable = role === "sqe" && c.status === "sqe_review";
  const e8 = c.eight_d ?? {};
  const t = c.trace ?? {};
  const [draft, setDraft] = useState<Record<string, { text: string }>>({});
  useEffect(() => {
    const d: Record<string, { text: string }> = {};
    SECTIONS.forEach((s) => (d[s.k] = { text: e8[s.k]?.text ?? "" }));
    if (!d.D0.text) d.D0.text = `Field cluster detected by the Signal agent on ${c.first_seen ? "the claim stream" : "—"}: ${c.count} claims, ${c.growth_x?.toFixed?.(1)}× baseline. Analyst escalated for investigation.`;
    setDraft(d);
  }, [c.eight_d]); // eslint-disable-line react-hooks/exhaustive-deps

  const sup = (k: string) => e8[`${k}_supplier`]?.text as string | undefined;
  const team = [PERSONAS[2], PERSONAS[1], PERSONAS[3], PERSONAS[4]];
  const closed = c.status === "closed";

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row wrap" style={{ maxWidth: 920, margin: "0 auto", width: "100%" }}>
        <span className="grow muted small">{editable ? "You can edit any AI-drafted section before approving. Edits are tracked." : `Status: ${STATUS_LABEL[c.status]}`}</span>
        <button className="btn outline sm" onClick={() => downloadPdf(c.id)}>Export PDF</button>
        {editable && <>
          <button className="btn text sm" disabled={busy} onClick={() => act(`/cases/${c.id}/action`, { action: "request_evidence", note: "Need more evidence" })}>Request more evidence</button>
          <button className="btn sm" disabled={busy} onClick={() => act(`/cases/${c.id}/action`, { action: "approve", eight_d: draft })}>Approve & send to supplier</button>
        </>}
        {role === "sqe" && c.status === "supplier_responded" && (c.supplier_check?.complete === false ? <>
          <span className="chip amber">AI found {c.supplier_check.gaps.length} gaps</span>
          <button className="btn text sm" disabled={busy} onClick={() => act(`/cases/${c.id}/action`, { action: "accept_supplier", note: `Accepted despite ${c.supplier_check.gaps.length} AI-flagged gaps` })}>Accept anyway</button>
          <button className="btn sm" disabled={busy} onClick={() => act(`/cases/${c.id}/action`, { action: "reject_supplier", note: `Address the ${c.supplier_check.gaps.length} gaps flagged by the completeness check` })}>Send back with gaps</button>
        </> : <>
          <button className="btn danger sm" disabled={busy} onClick={() => act(`/cases/${c.id}/action`, { action: "reject_supplier", note: "Address the listed gaps" })}>Send back</button>
          <button className="btn sm" disabled={busy} onClick={() => act(`/cases/${c.id}/action`, { action: "accept_supplier" })}>Accept & close case</button>
        </>)}
      </div>

      <article className="doc">
        <header className="doc-head">
          <LogoMark size={40} />
          <div><div className="label">8D PROBLEM-SOLVING REPORT</div><h2>{c.title}</h2></div>
          <div style={{ textAlign: "right" }}><div className="mono">{c.id}-8D</div>
            <span className={`chip ${closed ? "green" : c.status === "sqe_review" ? "amber" : "blue"}`}>{STATUS_LABEL[c.status]}</span></div>
        </header>
        <div className="doc-meta">
          <div><b>Part</b>{t.part_name ?? "—"}</div><div><b>Part no.</b><span className="mono">{t.part_no ?? "—"}</span></div>
          <div><b>Supplier</b>{c.supplier_name ?? "—"}</div><div><b>Customer</b>OEM · Plant {t.plants?.[0]?.id ?? "—"}</div>
          <div><b>Field claims</b>{c.count}</div><div><b>First claim</b>{c.first_seen}</div>
          <div><b>Suspect batches</b><span className="mono">{t.suspect_batches?.join(", ") ?? "—"}</span></div>
          <div><b>VINs at risk</b>{t.other_models_at_risk?.reduce((n: number, m: any) => n + m.vins_at_risk, 0) ?? 0} (no claims yet)</div>
        </div>

        {SECTIONS.map((s) => {
          const sec = e8[s.k] ?? {};
          const supText = sup(s.k);
          const done = s.who === "sup" ? !!supText : s.k === "D8" ? closed : !!(draft[s.k]?.text || sec.text);
          const cls = done && s.who !== "ai" ? "ok" : WHO[s.who].cls;
          const canEdit = editable && s.who !== "sup" && s.k !== "D8";
          return (
            <section key={s.k} className="d-sec">
              <span className={`d-num ${cls}`}>{s.k}</span>
              <div className="d-body">
                <h4>{s.title}<span className={`chip ${s.who === "ai" ? "blue" : s.who === "sup" ? "amber" : ""}`}>{WHO[s.who].t}</span>
                  {sec.edited_by && <span className="chip">edited by SQE</span>}</h4>

                {s.k === "D1" ? (
                  <table className="doc-t"><thead><tr><th>Name</th><th>Role</th><th>Organisation</th></tr></thead>
                    <tbody>{team.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.title}</td><td>{p.org}</td></tr>)}
                      <tr><td>Field-to-Fix agents</td><td>Intake, Signal, Trace, Hypothesise, Draft</td><td>Gemini on Vertex AI</td></tr></tbody></table>
                ) : canEdit ? (
                  <textarea id={`d-${s.k}`} className="textarea" value={draft[s.k]?.text ?? ""} onChange={(e) => setDraft({ ...draft, [s.k]: { text: e.target.value } })} />
                ) : (
                  <p>{(s.who === "sup" ? supText : s.k === "D8" ? (closed ? `Closed ${fmtTime(c.closed_at)}. Supplier response accepted by supplier quality.` : "") : sec.text || draft[s.k]?.text)
                    || <span className="faint">{s.who === "sup" ? "Waiting for the supplier's response." : s.k === "D8" ? "Completed when supplier quality accepts the response." : "—"}</span>}</p>
                )}

                {s.k === "D2" && t.models && (
                  <table className="doc-t"><tbody>
                    <tr><th>Models</th><td>{t.models.map((m: any) => `${m.id} (${pct(m.share)})`).join(", ")}</td></tr>
                    <tr><th>Plants · build weeks</th><td>{t.plants.map((p: any) => p.id).join(", ")} · {t.build_weeks.map((w: any) => w.id).join(", ")}</td></tr>
                    <tr><th>Batch concentration</th><td>{t.batches.slice(0, 3).map((b: any) => `${b.batch_id} ${pct(b.share)} (lift ${b.lift}×)`).join(" · ")}</td></tr>
                  </tbody></table>
                )}
                {s.k === "D3" && t.stock?.length > 0 && (
                  <table className="doc-t"><thead><tr><th>Batch</th><th>Location</th><th>Type</th><th style={{ textAlign: "right" }}>Qty to quarantine</th></tr></thead>
                    <tbody>{t.stock.filter((x: any) => x.qty_on_hand > 0).map((x: any, i: number) => (
                      <tr key={i}><td className="mono">{x.batch_id}</td><td>{x.location}</td><td>{x.location_type}</td><td style={{ textAlign: "right" }} className="num">{x.qty_on_hand.toLocaleString()}</td></tr>))}
                      {t.other_models_at_risk?.map((m: any) => <tr key={m.model}><td colSpan={3}>Fitted vehicles, {m.model} (no claims yet) — inspect at next service</td><td style={{ textAlign: "right" }} className="num">{m.vins_at_risk} VINs</td></tr>)}
                    </tbody></table>
                )}
                {s.k === "D4" && supText && <p style={{ marginTop: 8 }}><b style={{ fontWeight: 500 }}>Supplier confirmation:</b> {supText}</p>}
                {s.k === "D5" && supText && <p style={{ marginTop: 8 }}><b style={{ fontWeight: 500 }}>Supplier action:</b> {supText}</p>}
                {sec.cites?.length > 0 && <div className="row wrap small" style={{ marginTop: 8 }}><span className="faint">Sources:</span>{sec.cites.map((x: string) => <button key={x} className="cite" onClick={() => onCite(x)}>{x}</button>)}</div>}
              </div>
            </section>
          );
        })}

        {c.supplier_check && (
          <section className="d-sec"><span className={`d-num ${c.supplier_check.complete ? "ok" : "sup"}`}>AI</span>
            <div className="d-body"><h4>Completeness check of the supplier response<span className={`chip ${c.supplier_check.complete ? "green" : "amber"}`}>{c.supplier_check.complete ? "complete" : `${c.supplier_check.gaps.length} gaps`}</span></h4>
              {c.supplier_check.complete ? <p>No gaps found.</p> : <ul style={{ margin: 0, paddingLeft: 18 }}>{c.supplier_check.gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>}</div></section>
        )}
        <p className="faint small" style={{ marginTop: 16 }}>Generated by Field-to-Fix. AI-drafted sections cite their sources; quantities come from BigQuery, not from the model.</p>
      </article>
    </div>
  );
}
