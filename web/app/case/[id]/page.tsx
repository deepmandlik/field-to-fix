"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { LevelChip, StatusChip } from "@/components/chips";
import { BarList, Columns, Donut, Stat } from "@/components/charts";
import { EightDDoc } from "@/components/EightD";
import { NextAction } from "@/components/Guide";
import { ActivityTree, Lifecycle } from "@/components/Lifecycle";
import { IDoc, IEvidence, IHome, ISpark, ITree } from "@/components/icons";
import { TimeGap } from "@/components/TimeGap";
import { api } from "@/lib/api";
import { STATUS_LABEL, STATUS_ORDER, pct, useCase } from "@/lib/data";
import { useSession } from "@/lib/session";

type Tab = "overview" | "evidence" | "rootcause" | "8d" | "activity";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <IHome size={16} /> },
  { id: "evidence", label: "Evidence", icon: <IEvidence size={16} /> },
  { id: "rootcause", label: "Root cause & Ask", icon: <ISpark size={16} /> },
  { id: "8d", label: "8D report", icon: <IDoc size={16} /> },
  { id: "activity", label: "Activity", icon: <ITree size={16} /> },
];
const LANG: Record<string, string> = { en: "English", hi: "Hindi", id: "Bahasa", th: "Thai", ja: "Japanese" };

export default function CasePageWrap() {
  return <Suspense fallback={<p className="muted">Loading case…</p>}><CasePage /></Suspense>;
}

function CasePage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { user, role } = useSession();
  const { c, events, messages } = useCase(id);
  const [claims, setClaims] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "overview");
  const [hl, setHl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { const t = sp.get("tab") as Tab; if (t) setTab(t); }, [sp]);
  useEffect(() => {
    if (!user || !c?.claim_ids) return;
    api(`/cases/${id}/claims?limit=500`).then(setClaims).catch((e) => setErr(e.message));
  }, [id, user, c?.claim_ids?.length]);

  const cite = (x: string) => {
    setHl(x);
    setTab(x.startsWith("C-") ? "evidence" : "rootcause");
    setTimeout(() => document.getElementById(`src-${x}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };

  async function act(path: string, body?: any) {
    setBusy(true); setErr(null);
    try { await api(path, { method: "POST", json: body ?? {} }); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (c === undefined) return <p className="muted">Loading case…</p>;
  if (c === null) return <div className="empty">Case not found.</div>;
  const running = c.status === "investigating";
  const idx = STATUS_ORDER.indexOf(c.status);

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <span className="label mono">{c.id} · first claim {c.first_seen} · {c.count} claims</span>
          <h1 style={{ marginTop: 4 }}>{c.title}</h1>
          <div className="row wrap" style={{ marginTop: 10 }}>
            <StatusChip status={c.status} /><LevelChip level={c.level} growth={c.growth_x} />
            {c.supplier_name && <span className="chip">{c.supplier_name}</span>}
            {c.trace?.part_name && <span className="chip">{c.trace.part_name}</span>}
            {c.new_claims?.length > 0 && <span className="chip amber">+{c.new_claims.length} claim{c.new_claims.length > 1 ? "s" : ""} filed today</span>}
          </div>
        </div>
        <div className="row wrap">
          {role === "analyst" && c.status === "detected" && <>
            <button className="btn" disabled={busy} onClick={() => act(`/cases/${id}/investigate`, { mode: "live" })}
              title="Five Gemini agents, orchestrated by Google ADK, run live on this case (about a minute)"><ISpark size={18} />Investigate live · ~1 min</button>
            {c.replay_available && <button className="btn outline" disabled={busy} onClick={() => act(`/cases/${id}/investigate`, { mode: "replay" })}
              title="Replays a recorded live run in 15 seconds, with no Gemini calls">Quick replay · 15 s</button>}
            <button className="btn outline" disabled={busy} onClick={() => act(`/cases/${id}/action`, { action: "dismiss", note: "Not a real pattern" })}>Dismiss</button>
          </>}
          {running && <span className="chip blue"><span className="spin" /> Agents working</span>}
        </div>
      </div>
      {err && <div className="error" role="alert">{err}</div>}

      <div className="card card-pad stack" style={{ gap: 16 }}>
        <div className="stepper" aria-label="Case progress">
          {STATUS_ORDER.map((s, i) => (
            <div key={s} className={`step ${i < idx || c.status === "closed" ? "done" : i === idx ? "now" : ""}`}>
              <span className="bubble">{i < idx || c.status === "closed" ? "✓" : i + 1}</span>{STATUS_LABEL[s]}
            </div>
          ))}
        </div>
        <NextAction status={c.status} caseId={c.id} />
      </div>

      {(running || (events.length > 0 && tab === "overview")) && <AgentLog events={events} running={running} />}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} disabled={t.id === "8d" && !c.eight_d}>
            <span className="row" style={{ gap: 6 }}>{t.icon}{t.label}</span></button>
        ))}
      </div>

      {tab === "overview" && <Overview c={c} claims={claims} />}
      {tab === "evidence" && <Evidence claims={claims} hl={hl} fresh={c.new_claims ?? []} />}
      {tab === "rootcause" && <RootCause c={c} hl={hl} cite={cite} messages={messages} canAsk={["analyst", "sqe", "exec"].includes(role)} />}
      {tab === "8d" && c.eight_d && <EightDDoc c={c} role={role} busy={busy} act={act} onCite={cite} />}
      {tab === "activity" && (
        <div className="grid g2">
          <div className="card card-pad stack sticky-col"><h3>Lifecycle</h3><Lifecycle status={c.status} approvals={c.approvals ?? []} /></div>
          <div className="card card-pad stack"><h3>Activity tree</h3><ActivityTree c={c} events={events} /></div>
        </div>
      )}
    </>
  );
}

const inr = (v: number) => v >= 1e7 ? `₹${(v / 1e7).toFixed(1)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : `₹${Math.round(v / 1000)}k`;

// What waiting costs, from this case's own claims: today's claim rate × average claim cost, plus the at-risk
// vehicles failing at the rate the suspect batches already show. Compared with the usual ~19-week cycle.
function CostOfWaiting({ c, claims, atRisk }: { c: any; claims: any[]; atRisk: number }) {
  const costs = claims.map((x) => x.cost_inr).filter((v) => v > 0);
  if (!costs.length) return null;
  const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
  const perDay = ((c.recent_count ?? 0) / 21) * avg;
  const sus = (c.trace?.batches ?? []).filter((b: any) => c.trace.suspect_batches.includes(b.batch_id));
  const fleet = sus.reduce((n: number, b: any) => n + (b.fleet_vins || 0), 0);
  const failRate = fleet ? sus.reduce((n: number, b: any) => n + b.failing_vins, 0) / fleet : 0;
  const exposure = atRisk * failRate * avg;
  const avoided = perDay * 19 * 7 + exposure;
  return (
    <div className="card card-pad stack cow">
      <div className="row wrap"><h3 className="grow">Cost of waiting</h3>
        <span className="faint small">estimated from this case’s {costs.length} claims · avg claim {inr(avg)}</span></div>
      <div className="grid g3 eq">
        <div className="cow-k"><span className="label">Every day this stays open</span><span className="v num">{inr(perDay)}</span>
          <span className="d">{((c.recent_count ?? 0) / 21).toFixed(1)} new claims a day × avg claim cost</span></div>
        <div className="cow-k"><span className="label">If the at-risk cars fail too</span><span className="v num">{c.trace ? inr(exposure) : "—"}</span>
          <span className="d">{c.trace ? `${atRisk} cars × ${(failRate * 100).toFixed(1)}% failure rate seen in the suspect batches` : "known after Trace"}</span></div>
        <div className="cow-k hot"><span className="label">Avoided by acting today</span><span className="v num">{inr(avoided)}</span>
          <span className="d">vs the usual ~19 weeks from first claims to a supplier fix</span></div>
      </div>
    </div>
  );
}

function AgentLog({ events, running }: { events: any[]; running: boolean }) {
  return (
    <div className="card card-pad stack" style={running ? { boxShadow: "0 0 0 2px var(--primary), var(--shadow)" } : undefined}>
      <div className="row"><h3 className="grow">Agent log</h3>
        {events.some((e) => e.agent === "adk") && <span className="chip">Google ADK · SequentialAgent</span>}
        {events.some((e) => e.agent === "replay") ? <span className="chip amber">recorded run</span> : running && <span className="chip blue"><span className="spin" />live</span>}</div>
      <div className="agentlog" aria-live="polite">
        {events.slice(-7).map((e, i, arr) => {
          const st = e.status === "running" && !(running && i === arr.length - 1) ? "done" : e.status;
          return (
          <div key={i} className={`l ${st}`}>
            <span>{st === "running" ? <span className="spin" /> : st === "error" ? "✕" : "✓"}</span>
            <span className="chip" style={{ height: 20 }}>{e.agent}</span>
            <span style={{ color: "var(--ink)" }}>{e.message}</span>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function Overview({ c, claims }: { c: any; claims: any[] }) {
  const t = c.trace;
  const atRisk = t?.other_models_at_risk?.reduce((n: number, m: any) => n + m.vins_at_risk, 0) ?? 0;
  const stock = t?.stock?.reduce((n: number, s: any) => n + s.qty_on_hand, 0) ?? 0;
  const byCity = useMemo(() => count(claims.map((x) => x.city ?? x.dealer_id)), [claims]);
  const byLang = useMemo(() => count(claims.map((x) => LANG[x.lang] ?? x.lang)), [claims]);
  const byCond = useMemo(() => count(claims.map((x) => x.condition).filter((v) => v && v !== "unknown")), [claims]);
  const kmStats = useMemo(() => { const v = claims.map((x) => x.mileage_km ?? 0).sort((a, b) => a - b);
    return { median: v[Math.floor(v.length / 2)] ?? 0, p90: v[Math.floor(v.length * 0.9)] ?? 0 }; }, [claims]);
  const km = useMemo(() => {
    // Bins span up to the 95th percentile so one outlier can't squash the chart; the rest go in a final "+" bin.
    const vals = claims.map((x) => x.mileage_km ?? 0).sort((a, b) => a - b);
    if (!vals.length) return [];
    const top = vals[Math.floor(vals.length * 0.95)] || vals[vals.length - 1] || 1;
    const raw = top / 6;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((v) => v >= raw) ?? raw;
    const n = Math.max(1, Math.ceil(top / step));
    const fmt = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : `${v}`);
    const bins = Array.from({ length: n }, (_, i) => ({ name: fmt(i * step), value: vals.filter((v) => v >= i * step && v < (i + 1) * step).length }));
    const over = vals.filter((v) => v >= n * step).length;
    if (over) bins.push({ name: `${fmt(n * step)}+`, value: over });
    return bins;
  }, [claims]);
  const weeks = (c.weekly ?? []).map((v: number, i: number, a: number[]) => ({ name: i === a.length - 1 ? "now" : `-${a.length - 1 - i}w`, value: v }));
  const maxShare = Math.max(...(t?.batches ?? []).map((b: any) => b.share), 0.01);

  return (
    <>
      <div className="grid g4 eq">
        <Stat label="Claims in this case" value={c.count} sub={`${c.recent_count} in the last 3 weeks`} hot={c.level === "critical"} />
        <Stat label="Growth vs baseline" value={`${c.growth_x >= 10 ? Math.round(c.growth_x) : c.growth_x?.toFixed(1)}×`} sub="claims per day, last 21 days vs before" />
        <Stat label="Vehicles at risk, no claims yet" value={t ? atRisk.toLocaleString() : "—"} sub={t ? t.other_models_at_risk.map((m: any) => m.model).join(", ") || "none" : "after trace"} hot={atRisk > 0} />
        <Stat label="Suspect parts to contain" value={t ? stock.toLocaleString() : "—"} sub={t ? `in ${t.stock.length} locations` : "after trace"} />
      </div>
      <CostOfWaiting c={c} claims={claims} atRisk={atRisk} />
      <div className="grid g-2-1">
        <div className="card card-pad stack"><div className="row"><h3 className="grow">Claims per week</h3><span className="faint small">red = last 3 weeks</span></div>
          <Columns data={weeks} hotFrom={weeks.length - 3} height={220} /></div>
        <div className="card card-pad stack">
          <h3>Languages</h3>
          <div className="fill center"><Donut data={byLang} size={136} /></div>
          <div className="label" style={{ marginTop: 4 }}>Most reported conditions</div>
          <BarList data={byCond.slice(0, 4)} />
        </div>
      </div>
      <div className="grid g3">
        <div className="card card-pad stack"><h3>Dealer cities</h3><BarList data={byCity.slice(0, 6)} fill /></div>
        <div className="card card-pad stack"><div className="row"><h3 className="grow">Odometer at failure</h3><span className="faint small">km</span></div>
          <Columns data={km} height={180} color="var(--c2)" />
          <div className="row small muted wrap" style={{ justifyContent: "space-between" }}>
            <span>Median <b className="num">{kmStats.median.toLocaleString()} km</b></span><span>90th pct <b className="num">{kmStats.p90.toLocaleString()} km</b></span></div>
        </div>
        <div className="card card-pad stack">
          <h3>Trace to supplier batch</h3>
          {!t ? <div className="fill center muted">Not traced yet. The analyst starts the investigation.</div> : <>
            <span className="faint small">{t.vins} VINs · {t.part_name} · {t.supplier}</span>
            <div className="barlist fill">
              {t.batches.slice(0, 5).map((b: any) => (
                <div key={b.batch_id} className="br"><span className="mono">{b.batch_id}{b.lift ? <span className="faint"> · lift {b.lift}×</span> : null}</span><b className="num">{pct(b.share)}</b>
                  <span className="track"><i className={t.suspect_batches.includes(b.batch_id) ? "hot" : ""} style={{ width: `${(b.share / maxShare) * 100}%` }} /></span></div>
              ))}
            </div>
            <span className="faint small">Lift = share of failing cars ÷ share of all cars built with that batch. Red = over 1.5×.</span>
          </>}
        </div>
      </div>
      <div className="card card-pad stack"><div className="row"><h3 className="grow">Time to an 8D: before and after</h3>
        {c.investigation_seconds && <span className="chip green">investigation took {c.investigation_seconds}s</span>}</div>
        <TimeGap investigationSeconds={c.investigation_seconds} /></div>
    </>
  );
}

function count(xs: string[]) {
  const m = new Map<string, number>();
  xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function Evidence({ claims, hl, fresh }: { claims: any[]; hl: string | null; fresh: string[] }) {
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("all");
  const [orig, setOrig] = useState(true);
  const langs = Array.from(new Set(claims.map((x) => x.lang)));
  const shown = claims.filter((x) => (lang === "all" || x.lang === lang) && (!q || `${x.translated_text} ${x.note_text} ${x.city} ${x.claim_id}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(fresh.includes(b.claim_id)) - Number(fresh.includes(a.claim_id)));
  return (
    <div className="card card-pad stack">
      <div className="row wrap">
        <h3 className="grow">{shown.length} of {claims.length} claims</h3>
        <input id="ev-search" className="input" style={{ width: 240, height: 36 }} placeholder="Search notes, cities, ids" value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="ev-lang" className="select" style={{ width: 150, height: 36 }} value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="all">All languages</option>{langs.map((l) => <option key={l} value={l}>{LANG[l] ?? l}</option>)}</select>
        <label className="check small"><input id="ev-orig" type="checkbox" checked={orig} onChange={(e) => setOrig(e.target.checked)} />Original text</label>
      </div>
      <div className="grid g2">
        {shown.map((x) => (
          <div key={x.claim_id} id={`src-${x.claim_id}`} className={`claim ${hl === x.claim_id ? "hl" : ""} ${fresh.includes(x.claim_id) ? "new" : ""}`}>
            <div className="row small"><b className="mono">{x.claim_id}</b><span className="muted">{x.city ?? x.dealer_id} · {x.mileage_km?.toLocaleString()} km · {String(x.claim_date)}</span>
              <span className="grow" />{fresh.includes(x.claim_id) && <span className="chip amber">new today</span>}<span className="chip">{LANG[x.lang] ?? x.lang}</span></div>
            <span>{x.translated_text}</span>
            {orig && x.lang !== "en" && <span className="orig">{x.note_text}</span>}
            <span className="faint small">{x.component} · {x.failure_mode} · {x.condition !== "unknown" ? x.condition : "condition not stated"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RootCause({ c, hl, cite, messages, canAsk }: any) {
  const cited = new Set((c.hypotheses ?? []).flatMap((h: any) => h.pfmea_row_ids));
  const rows = [...(c.pfmea ?? []).filter((r: any) => cited.has(r.row_id)), ...(c.control_plan ?? [])];
  return (
    <div className="grid g-2-1" style={{ alignItems: "start" }}>
      <div className="stack">
        {!c.hypotheses && <div className="card card-pad muted">{c.status === "detected" ? "Run the investigation to rank root causes." : "The agents are working…"}</div>}
        {c.hypotheses?.map((h: any, i: number) => (
          <div key={i} className={`card hyp ${i === 0 ? "top" : ""}`}>
            <div className="row"><span className="chip blue">#{i + 1}</span><b className="grow" style={{ fontWeight: 500, fontSize: 15 }}>{h.cause}</b><span className="mono">{h.confidence.toFixed(2)}</span></div>
            <div className="meter"><i style={{ width: pct(h.confidence) }} /></div>
            <p className="muted" style={{ lineHeight: 1.6 }}>{h.reasoning}</p>
            {h.control_gap && h.control_gap !== "none identified" && <p><b style={{ fontWeight: 500 }}>Control gap:</b> {h.control_gap}</p>}
            <div className="row wrap small"><span className="faint">Evidence:</span>
              {[...h.pfmea_row_ids, ...h.evidence_claim_ids.slice(0, 5)].map((x: string) => <button key={x} className="cite" onClick={() => cite(x)}>{x}</button>)}
              {h.evidence_claim_ids.length > 5 && <span className="faint">+{h.evidence_claim_ids.length - 5} claims</span>}
              {h.needs_check && <span className="chip amber">needs engineer check</span>}</div>
          </div>
        ))}
        {rows.length > 0 && (
          <div className="card card-pad stack">
            <h3>Sources · PFMEA and control plan</h3>
            {rows.map((r: any) => (
              <div key={r.row_id} id={`src-${r.row_id}`} className={`src ${hl === r.row_id ? "hl" : ""}`}>
                <b className="mono">{r.row_id}</b> · {r.process_step}<br />
                {r.failure_mode ? <>{r.failure_mode} → {r.effect}. <span className="muted">Cause: {r.cause}. Detection: {r.detection}.</span> <span className="chip">RPN {r.rpn}</span></>
                  : <>{r.characteristic} · {r.method} · <b style={{ fontWeight: 500 }}>{r.frequency}</b></>}
              </div>
            ))}
          </div>
        )}
      </div>
      {canAsk && c.trace && <Ask id={c.id} messages={messages} onCite={cite} />}
    </div>
  );
}

function Ask({ id, messages, onCite }: { id: string; messages: any[]; onCite: (x: string) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const seen = useRef(messages.length);
  useEffect(() => {
    if (messages.length > seen.current) end.current?.scrollIntoView({ block: "nearest" });
    seen.current = messages.length;
  }, [messages.length]);
  async function send(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    try { await api(`/cases/${id}/ask`, { method: "POST", json: { question: text } }); setQ(""); }
    finally { setBusy(false); }
  }
  const render = (t: string) => t.split(/(\b(?:C-\d+|R-\d+|CP-\d+B?)\b)/g).map((p, i) =>
    /^(C-\d+|R-\d+|CP-\d+B?)$/.test(p) ? <button key={i} className="cite" onClick={() => onCite(p)}>{p}</button> : <span key={i}>{p}</span>);
  return (
    <div className="card card-pad chat" style={{ position: "sticky", top: 72 }}>
      <div className="row"><ISpark /><h3 className="grow">Ask about this case</h3></div>
      <p className="faint small">Gemini answers from this case's data only, using tools, and cites claims and PFMEA rows.</p>
      <div className="stack" style={{ maxHeight: 420, overflowY: "auto", gap: 8 }}>
        {messages.map((m, i) => <div key={i} className={`msg ${m.role}`}>{render(m.text)}
          {m.role === "assistant" && m.via && <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>via {m.via}</div>}</div>)}
        {busy && <div className="msg assistant"><span className="spin" /> Thinking…</div>}
        <div ref={end} />
      </div>
      <div className="suggest">
        {["Why is batch W32 also affected?", "Which cities report it most?", "What should the supplier check first?"].map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy}>{s}</button>))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="row">
        <input id="ask" className="input" placeholder="Ask a question" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" disabled={busy}>Ask</button>
      </form>
    </div>
  );
}
