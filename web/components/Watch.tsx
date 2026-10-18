"use client";

/* Field-to-Fix on the wrist. Three jobs fit a watch: get alerted, make a yes/no decision, dictate a claim.
   Everything else (reading an 8D, editing) stays on the phone or laptop. Same API, same live data. */
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { DEMO_CASE, NEXT_TEXT, OWNER, STATUS_LABEL, useCases, type Case } from "@/lib/data";
import { persona, useSession, type Role } from "@/lib/session";

type Screen = { k: "home" } | { k: "case"; id: string } | { k: "dictate" } | { k: "ask"; id: string } | { k: "done"; title: string; body: string };

const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch {} };
const PHRASES = [
  { k: "Hindi", text: "कूलेंट लीक, क्लैंप ढीला मिला। क्लैंप बदला।" },
  { k: "Bahasa", text: "Klem selang kendor, coolant bocor. Klem diganti." },
  { k: "English", text: "Coolant leak at hose clamp after cold start. Replaced clamp." },
];

export function WatchApp({ round = false }: { round?: boolean }) {
  const { role } = useSession();
  const cases = useCases();
  const [screen, setScreen] = useState<Screen>({ k: "home" });
  const [alert, setAlert] = useState<Case | null>(null);
  const [now, setNow] = useState(new Date());
  const seen = useRef<Record<string, string> | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);

  // A case that moves into my queue raises a wrist alert, like a push notification would.
  useEffect(() => {
    if (!cases) return;
    const cur = Object.fromEntries(cases.map((c) => [c.id, c.status]));
    if (seen.current) {
      const fresh = cases.find((c) => seen.current![c.id] !== c.status && OWNER[c.status] === role);
      if (fresh) { setAlert(fresh); buzz([120, 60, 120]); }
    }
    seen.current = cur;
  }, [cases, role]);

  // A wrist only shows what is worth an interruption: critical and warning cases, never the low "watch" tier.
  const mine = (cases ?? []).filter((c) => OWNER[c.status] === role && !["closed", "dismissed"].includes(c.status) && c.level !== "watch")
    .sort((a, b) => (b.growth_x ?? 0) - (a.growth_x ?? 0));
  const critical = (cases ?? []).filter((c) => c.level === "critical" && !["closed", "dismissed"].includes(c.status)).length;
  const p = persona(role);
  const back = () => setScreen({ k: "home" });

  return (
    <div className={`wa ${round ? "round" : ""}`}>
      <div className="wa-status"><span>{p.initials}</span><b>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b></div>
      <div className="wa-body">
        {screen.k === "home" && (
          <>
            <div className="wa-ring" style={{ ["--p" as any]: Math.min(1, mine.length / 3) }}>
              <b>{role === "dealer" ? "🎤" : mine.length}</b><span>{role === "dealer" ? "new claim" : mine.length === 1 ? "needs you" : "need you"}</span>
            </div>
            {critical > 0 && <div className="wa-pill red">{critical} critical</div>}
            {role === "dealer" && <button className="wa-btn" onClick={() => setScreen({ k: "dictate" })}>Dictate a claim</button>}
            {mine.slice(0, 3).map((c) => (
              <button key={c.id} className="wa-card" onClick={() => setScreen({ k: "case", id: c.id })}>
                <i className={`wa-dot ${c.level}`} /><span><b>{c.title}</b><small>{STATUS_LABEL[c.status]} · {c.count} claims</small></span>
              </button>
            ))}
            {role !== "dealer" && mine.length === 0 && <div className="wa-muted">Nothing waiting for you.</div>}
            {["analyst", "sqe", "exec"].includes(role) && <button className="wa-btn ghost" onClick={() => setScreen({ k: "ask", id: DEMO_CASE })}>Ask Gemini</button>}
          </>
        )}
        {screen.k === "case" && <WatchCase id={screen.id} cases={cases} role={role} onBack={back}
          onDone={(t, b) => { buzz(80); setScreen({ k: "done", title: t, body: b }); }} onAsk={(id) => setScreen({ k: "ask", id })} />}
        {screen.k === "dictate" && <Dictate onBack={back} onDone={(t, b) => { buzz([80, 40, 80]); setScreen({ k: "done", title: t, body: b }); }} />}
        {screen.k === "ask" && <WatchAsk id={screen.id} onBack={back} />}
        {screen.k === "done" && (
          <div className="wa-done"><div className="wa-check">✓</div><b>{screen.title}</b><p>{screen.body}</p>
            <button className="wa-btn" onClick={back}>Done</button></div>
        )}
      </div>
      {alert && (
        <div className="wa-alert" role="alertdialog" aria-label="New task">
          <span className="wa-pill">Needs you now</span>
          <b>{alert.title}</b>
          <p>{NEXT_TEXT[alert.status]}</p>
          <button className="wa-btn" onClick={() => { setScreen({ k: "case", id: alert.id }); setAlert(null); }}>Open</button>
          <button className="wa-btn ghost" onClick={() => setAlert(null)}>Later</button>
        </div>
      )}
    </div>
  );
}

/** Press and hold to confirm: a stray tap while eating lunch can't approve an 8D. */
function Hold({ label, onConfirm, danger }: { label: string; onConfirm: () => void; danger?: boolean }) {
  const [p, setP] = useState(0);
  const t = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = () => {
    buzz(15);
    const t0 = Date.now();
    t.current = setInterval(() => {
      const v = Math.min(1, (Date.now() - t0) / 1100);
      setP(v);
      if (v >= 1) { stop(); onConfirm(); }
    }, 30);
  };
  const stop = () => { if (t.current) clearInterval(t.current); t.current = null; setP(0); };
  return (
    <button className={`wa-btn hold ${danger ? "danger" : ""}`} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop}
      onKeyDown={(e) => { if (e.key === "Enter" && !t.current) start(); }} onKeyUp={stop} style={{ ["--p" as any]: p }}>
      <span>{p > 0 ? "Keep holding…" : `Hold to ${label}`}</span>
    </button>
  );
}

function WatchCase({ id, cases, role, onBack, onDone, onAsk }: {
  id: string; cases: Case[] | null; role: Role; onBack: () => void; onDone: (t: string, b: string) => void; onAsk: (id: string) => void;
}) {
  const c = cases?.find((x) => x.id === id);
  const [err, setErr] = useState<string | null>(null);
  if (!c) return <div className="wa-muted">Loading…</div>;
  const atRisk = c.trace?.other_models_at_risk?.reduce((n: number, m: any) => n + m.vins_at_risk, 0) ?? 0;
  const gaps = c.supplier_check?.complete === false ? c.supplier_check.gaps.length : 0;
  const post = async (path: string, body: any, t: string, b: string) => {
    try { await api(path, { method: "POST", json: body }); onDone(t, b); } catch (e: any) { setErr(e.message); }
  };
  return (
    <>
      <button className="wa-back" onClick={onBack}>‹ Back</button>
      <b className="wa-title">{c.title}</b>
      <div className="wa-stats">
        <span><b>{c.count}</b>claims</span><span><b>{c.growth_x >= 10 ? Math.round(c.growth_x) : c.growth_x?.toFixed(1)}×</b>growth</span>
        {atRisk > 0 && <span><b>{atRisk}</b>at risk</span>}
      </div>
      {c.supplier_name && <div className="wa-muted">{c.supplier_name} · {c.trace?.suspect_batches?.join(", ")}</div>}
      {c.status === "investigating" && <div className="wa-pill blue">Agents working…</div>}
      {role === "analyst" && c.status === "detected" &&
        <Hold label="investigate" onConfirm={() => post(`/cases/${id}/investigate`, {}, "Agents started", "You'll get a tap when the 8D is ready.")} />}
      {role === "sqe" && c.status === "sqe_review" && <>
        <div className="wa-muted">8D drafted by AI, {c.eight_d?.D4?.cites?.length ?? 0} sources cited.</div>
        <Hold label="approve 8D" onConfirm={() => post(`/cases/${id}/action`, { action: "approve", note: "Approved from watch" }, "8D sent", `${c.supplier_name ?? "Supplier"} has the request.`)} />
      </>}
      {role === "sqe" && c.status === "supplier_responded" && (gaps
        ? <><div className="wa-pill amber">AI found {gaps} gaps</div>
            <Hold label="send back" onConfirm={() => post(`/cases/${id}/action`, { action: "reject_supplier", note: `Sent back from watch: ${gaps} gaps` }, "Sent back", "Supplier must close the gaps.")} /></>
        : <Hold label="accept & close" onConfirm={() => post(`/cases/${id}/action`, { action: "accept_supplier", note: "Accepted from watch" }, "Case closed", "Audit trail updated.")} />)}
      {role === "supplier" && c.status === "sent_to_supplier" && <div className="wa-muted">New 8D request. Respond from your laptop; we'll keep the evidence pack ready.</div>}
      {["analyst", "sqe", "exec"].includes(role) && c.trace && <button className="wa-btn ghost" onClick={() => onAsk(id)}>Ask Gemini</button>}
      {err && <div className="wa-pill red">{err}</div>}
    </>
  );
}

function Dictate({ onBack, onDone }: { onBack: () => void; onDone: (t: string, b: string) => void }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const SR = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

  const listen = () => {
    if (!SR) return;
    const r = new SR();
    r.lang = "hi-IN";
    r.interimResults = true;
    r.onresult = (e: any) => setText(Array.from(e.results).map((x: any) => x[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  };
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      const vins = await api<any[]>("/demo/vins");
      const r = await api<any>("/claims", { method: "POST", json: { vin: vins[0]?.vin, dealer_id: "D-PUN-01", note_text: text, mileage_km: 18200, photo_uris: [] } });
      onDone(r.linked ? `Linked to ${r.linked.case_id}` : "Claim filed", r.linked ? `${r.extraction.component}, ${r.linked.similarity.toFixed(2)} match. Analyst notified.` : r.extraction.component);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <>
      <button className="wa-back" onClick={onBack}>‹ Back</button>
      {!text && <>
        <button className={`wa-mic ${listening ? "on" : ""}`} onClick={listen} disabled={!SR} aria-label="Speak your note">🎤</button>
        <div className="wa-muted">{SR ? (listening ? "Listening…" : "Tap and speak, any language") : "Pick a phrase"}</div>
        {PHRASES.map((x) => <button key={x.k} className="wa-card" onClick={() => setText(x.text)}><span><b>{x.k}</b><small>{x.text}</small></span></button>)}
      </>}
      {text && <>
        <div className="wa-quote">“{text}”</div>
        <button className="wa-btn" disabled={busy} onClick={send}>{busy ? "Gemini reading…" : "File claim"}</button>
        <button className="wa-btn ghost" onClick={() => setText("")}>Redo</button>
      </>}
      {err && <div className="wa-pill red">{err}</div>}
    </>
  );
}

function WatchAsk({ id, onBack }: { id: string; onBack: () => void }) {
  const [a, setA] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = async (q: string) => {
    setBusy(true); setA(null);
    try {
      const r = await api<any>(`/cases/${id}/ask`, { method: "POST", json: { question: `${q} Answer in at most 25 words.` } });
      setA(r.text); buzz(40);
    } catch (e: any) { setA(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <button className="wa-back" onClick={onBack}>‹ Back</button>
      {!a && !busy && ["Which batch is bad?", "Which cities?", "What's the root cause?"].map((q) => (
        <button key={q} className="wa-card" onClick={() => ask(q)}><span><b>{q}</b></span></button>))}
      {busy && <div className="wa-muted">Gemini is thinking…</div>}
      {a && <><div className="wa-quote">{a}</div><button className="wa-btn ghost" onClick={() => setA(null)}>Ask another</button></>}
    </>
  );
}
