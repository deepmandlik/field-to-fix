"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusChip } from "@/components/chips";
import { BarList, Stat } from "@/components/charts";
import { IArrow, ICheck } from "@/components/icons";
import { api } from "@/lib/api";
import { pct, useCases } from "@/lib/data";
import { useSession } from "@/lib/session";

const DEFAULT_ORG = "S-KAV";
const CONTACT: Record<string, string> = { "S-KAV": "Suresh Iyer" };

export default function SupplierPortal() {
  const cases = useCases();
  const { isDemo } = useSession();
  // Suppliers that have (or will have) an 8D from this OEM. The judge account can act for any of them;
  // a real supplier login only ever receives its own cases (Firestore rules), so it sees just its company.
  const orgs = useMemo(() => {
    const m = new Map<string, string>();
    (cases ?? []).forEach((c) => c.supplier_id && m.set(c.supplier_id, c.supplier_name ?? c.supplier_id));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [cases]);
  const [ORG, setOrg] = useState<string>(DEFAULT_ORG);
  useEffect(() => {
    if (!cases) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem("f2f.actingOrg"); } catch {}
    const open = (o: string | null) => !!o && cases.some((c) => c.supplier_id === o && c.status === "sent_to_supplier");
    const newest = cases.find((c) => c.status === "sent_to_supplier")?.supplier_id;  // cases arrive newest-updated first
    const pick = !isDemo ? (cases.find((c) => c.supplier_id)?.supplier_id ?? DEFAULT_ORG) : open(saved) ? saved! : newest ?? saved ?? DEFAULT_ORG;
    setOrg(pick);
    try { localStorage.setItem("f2f.actingOrg", pick); } catch {}
  }, [cases?.length, cases?.map((c) => c.status).join(), isDemo]);
  const choose = (o: string) => { setOrg(o); try { localStorage.setItem("f2f.actingOrg", o); } catch {} };
  const orgName = orgs.find((o) => o.id === ORG)?.name ?? "Kaveri Hoses Pvt Ltd";
  const mine = (cases ?? []).filter((c) => c.supplier_id === ORG && ["sent_to_supplier", "supplier_responded", "closed"].includes(c.status));
  const waiting = (cases ?? []).filter((c) => c.supplier_id === ORG && ["detected", "investigating", "sqe_review"].includes(c.status));
  const [open, setOpen] = useState<string | null>(null);
  const batches = mine.flatMap((c) => c.trace?.batches ?? []);
  const failing = batches.filter((b: any) => mine.some((c) => c.trace?.suspect_batches?.includes(b.batch_id))).reduce((n: number, b: any) => n + b.failing_vins, 0);
  const fleet = batches.filter((b: any) => mine.some((c) => c.trace?.suspect_batches?.includes(b.batch_id))).reduce((n: number, b: any) => n + b.fleet_vins, 0);
  const ppm = fleet ? Math.round((failing / fleet) * 1e6) : 0;
  const atRisk = mine.reduce((n, c) => n + (c.trace?.other_models_at_risk?.reduce((m: number, x: any) => m + x.vins_at_risk, 0) ?? 0), 0);

  return (
    <>
      <div className="page-head"><div className="grow">
        <span className="label">Step 4 · {CONTACT[ORG] ?? "Quality manager"} · {orgName} (Tier-1)</span>
        <h1>8D requests from your customer</h1>
        <p>You see only cases that involve your parts. Each comes with the OEM's evidence: field claims, the batches involved, stock to contain and the AI's root-cause hypotheses.</p>
      </div>
        {isDemo && orgs.length > 1 && (
          <label className="row small" style={{ gap: 8 }}>
            <span className="faint">Acting for</span>
            <select className="select" style={{ width: "auto", height: 36 }} value={ORG} onChange={(e) => choose(e.target.value)} aria-label="Supplier company">
              {orgs.map((o) => {
                const n = (cases ?? []).filter((c) => c.supplier_id === o.id && c.status === "sent_to_supplier").length;
                return <option key={o.id} value={o.id}>{o.name}{n ? ` · ${n} open 8D` : ""}</option>;
              })}
            </select>
          </label>
        )}
      </div>

      <div className="grid g4 eq">
        <Stat label="Open 8D requests" value={mine.filter((c) => c.status === "sent_to_supplier").length} sub={`${mine.length} total`} hot={mine.some((c) => c.status === "sent_to_supplier")} />
        <Stat label="Failure rate, suspect batches" value={ppm ? `${(ppm / 1e4).toFixed(1)}%` : "—"} sub={`${failing} failed of ${fleet.toLocaleString()} vehicles built with them`} />
        <Stat label="Vehicles to inspect" value={atRisk.toLocaleString()} sub="fitted with suspect batches, no claims yet" />
        <Stat label="Under OEM review" value={waiting.length} sub="may reach you soon" />
      </div>

      {mine.length === 0 && (
        <div className="card empty">No 8D requests right now.{waiting.length > 0 && " The OEM is still reviewing a case that involves your parts."}</div>
      )}
      {mine.map((c) => {
        const isOpen = open === c.id || (mine.length === 1 && open === null);
        return (
          <div key={c.id} className="card">
            <button className="row" style={{ width: "100%", border: 0, background: "none", padding: "18px 22px", cursor: "pointer", textAlign: "left", gap: 14 }}
              onClick={() => setOpen(isOpen ? "" : c.id)} aria-expanded={isOpen}>
              <span className={`sev ${c.level}`} />
              <span className="grow"><b style={{ fontWeight: 500, fontSize: 16 }}>{c.title}</b>
                <div className="faint small">{c.id} · {c.trace?.part_name} · batches {c.trace?.suspect_batches?.join(", ")} · {c.count} claims</div></span>
              <StatusChip status={c.status} /><span className="faint">{isOpen ? "▴" : "▾"}</span>
            </button>
            {isOpen && <Respond c={c} />}
          </div>
        );
      })}
    </>
  );
}

function Respond({ c }: { c: any }) {
  const [f, setF] = useState({ D4_root_cause: "", D5_corrective_action: "", D6_implementation: "", D7_prevention: "" });
  const [state, setState] = useState<{ busy?: boolean; drafting?: boolean; err?: string; result?: any }>({});
  const e8 = c.eight_d ?? {};
  const t = c.trace ?? {};
  const canRespond = c.status === "sent_to_supplier";
  // The Kaveri clamp case keeps its scripted reply (the demo story: the supplier blames torque, Gemini flags the gaps).
  // Every other case gets a reply drafted by Gemini from that case's own part, batches, root cause and PFMEA rows.
  const scripted = c.supplier_id === "S-KAV" && t.part_no === "P-1001";
  async function fillExample() {
    if (scripted) return setF(example);
    setState({ drafting: true });
    try { setF(await api(`/cases/${c.id}/supplier-draft`, { method: "POST", json: {} })); setState({}); }
    catch (err: any) { setState({ err: err.message }); }
  }
  const example = {
    D4_root_cause: "Confirmed: Station 6 torque tool on Line 2 was 3 weeks past calibration and had drifted to 3.6 Nm (spec 4.5 ±0.3). Batches KAV-26W31/W32 built in that window.",
    D5_corrective_action: "Recalibrated the tool; added a torque-angle monitored DC nutrunner with OK/NOK interlock at Station 6.",
    D6_implementation: "Installed 2026-10-20. 100% torque data logged; 1,200 parts at 4.4–4.6 Nm, Cpk 1.67.",
    D7_prevention: "PFMEA R-14 detection rating updated 6→2. Control plan CP-06 changed to 100% electronic torque check; calibration interval cut to 1 month with system lock-out.",
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try { setState({ result: await api(`/cases/${c.id}/supplier-response`, { method: "POST", json: f }) }); }
    catch (err: any) { setState({ err: err.message }); }
  }
  const field = (k: keyof typeof f, label: string, hint: string) => (
    <div className="field"><label htmlFor={`${c.id}-${k}`}>{label}</label>
      <textarea id={`${c.id}-${k}`} className="textarea" placeholder={hint} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} required /></div>
  );
  return (
    <div className="grid g2" style={{ padding: "0 22px 22px", alignItems: "start" }}>
      <div className="stack">
        <span className="label">What the OEM found</span>
        {["D2", "D3", "D4"].map((k) => e8[k]?.text && (
          <div key={k} className="src"><b className="mono">{k}</b> {e8[k].text}</div>))}
        <span className="label" style={{ marginTop: 6 }}>Failures by batch</span>
        <BarList data={(t.batches ?? []).slice(0, 4).map((b: any) => ({ name: b.batch_id, value: b.failing_vins, sub: `lift ${b.lift}×` }))} hot={(n) => t.suspect_batches?.includes(n)} />
        <span className="faint small">{t.batches?.[0] ? `${pct(t.batches[0].share)} of failing vehicles carry ${t.batches[0].batch_id}.` : ""}</span>
        <Link className="btn text sm" style={{ alignSelf: "flex-start" }} href={`/case/${c.id}?tab=8d`}>Open the full 8D <IArrow size={16} /></Link>
      </div>
      {canRespond ? (
        <form onSubmit={submit} className="stack">
          <div className="row"><span className="label grow">Your 8D response</span>
            <button type="button" className="btn text sm" disabled={state.drafting} onClick={fillExample}>
              {state.drafting ? <><span className="spin" /> Drafting for this case…</> : "Fill an example response"}</button></div>
          {field("D4_root_cause", "D4 · Confirmed root cause", "What you found at your plant, with data")}
          {field("D5_corrective_action", "D5 · Permanent corrective action", "The fix that removes the cause")}
          {field("D6_implementation", "D6 · Implementation and validation", "When, and the proof it works")}
          {field("D7_prevention", "D7 · Prevent recurrence", "PFMEA and control plan updates")}
          {state.err && <div className="error">{state.err}</div>}
          <button className="btn" disabled={state.busy}>{state.busy ? <><span className="spin" /> AI is checking your response…</> : "Submit 8D response"}</button>
        </form>
      ) : (
        <div className="stack">
          <div className="notice"><ICheck /> Response submitted · {c.status === "closed" ? "accepted by the OEM. Case closed." : "waiting for OEM review."}</div>
          {(c.supplier_check || state.result) && <Check r={c.supplier_check ?? state.result} />}
        </div>
      )}
    </div>
  );
}

function Check({ r }: { r: { complete: boolean; gaps: string[] } }) {
  return (
    <div className="card card-pad stack" style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
      <div className="row"><h3 className="grow">AI completeness check</h3><span className={`chip ${r.complete ? "green" : "amber"}`}>{r.complete ? "complete" : `${r.gaps.length} gaps`}</span></div>
      {r.complete ? <p className="muted">No gaps found against the OEM's evidence.</p> : <ul style={{ margin: 0, paddingLeft: 18 }}>{r.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>}
    </div>
  );
}
