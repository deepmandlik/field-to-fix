"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DEMO_CASE, NEXT_TEXT, OWNER, storyProgress, useCases } from "@/lib/data";
import { PERSONAS, persona, useSession, type Role } from "@/lib/session";
import { IArrow, IClose, IHelp, IReset, ISpark } from "./icons";
import { LogoMark } from "./Logo";

export function Avatar({ role, sm }: { role: Role; sm?: boolean }) {
  const p = persona(role);
  return <span className={`avatar ${sm ? "sm" : ""}`} style={{ background: p.color }} aria-hidden="true">{p.initials}</span>;
}

/** Switch the demo account to another persona and go where that person works. */
export function useActAs() {
  const { setActingRole, isDemo } = useSession();
  const router = useRouter();
  return (r: Role, href?: string) => {
    if (isDemo) setActingRole(r);
    router.push(href ?? persona(r).home);
  };
}

export const STORY: { role: Role; title: string; body: string; href: string }[] = [
  { role: "dealer", title: "File a new warranty claim", body: "Write the repair note in Hindi. Watch AI read it and link it to an open case in seconds.", href: "/claim" },
  { role: "analyst", title: "Investigate the cluster", body: "Open the coolant-leak case and run the agents: trace, root cause, 8D draft.", href: `/case/${DEMO_CASE}` },
  { role: "sqe", title: "Approve the 8D", body: "Review the AI-drafted 8D, edit it, approve and send it to the supplier.", href: `/case/${DEMO_CASE}?tab=8d` },
  { role: "supplier", title: "Respond to the 8D", body: "As Kaveri Hoses, confirm the root cause. AI checks the response for gaps.", href: "/supplier" },
  { role: "sqe", title: "Review the response", body: "AI flags gaps in the supplier's answer. Send it back, or accept to close with a full audit trail.", href: `/case/${DEMO_CASE}?tab=8d` },
  { role: "exec", title: "See the impact", body: "Warranty cost, open cases and days-to-root-cause on one page.", href: "/overview" },
];

export function DemoGuide() {
  const { isDemo, role } = useSession();
  const cases = useCases();
  const act = useActAs();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { try { setOpen(localStorage.getItem("f2f.guideOpen") !== "0"); } catch {} }, []);
  if (!isDemo) return null;
  const flagship = cases?.find((c) => c.id === DEMO_CASE);
  const { done, current } = storyProgress(flagship);
  const toggle = () => { setOpen(!open); try { localStorage.setItem("f2f.guideOpen", open ? "0" : "1"); } catch {} };

  async function reset(mode: "fresh" | "analysed") {
    setBusy(mode);
    try { await api("/demo/reset", { method: "POST", json: { mode } }); act("dealer", "/start"); }
    finally { setBusy(null); }
  }

  return (
    <aside className="guide" aria-label="Judge demo guide">
      <div className="guide-head" onClick={toggle} role="button" aria-expanded={open}>
        <ISpark /><b>Judge demo guide · step {Math.min(current + 1, 6)} of 6</b><span className="small">{open ? "Hide" : "Show"}</span>
      </div>
      {open && (
        <div className="guide-body">
          {STORY.map((s, i) => {
            const state = done[i] ? "done" : i === current ? "now" : "";
            const p = persona(s.role);
            return (
              <div key={i} className={`gstep ${state}`}>
                <span className="n">{done[i] ? "✓" : i + 1}</span>
                <div className="stack" style={{ gap: 4 }}>
                  <div className="row"><b className="grow" style={{ fontWeight: 500 }}>{s.title}</b></div>
                  <p>{p.name} · {p.title}</p>
                  {i === current && <>
                    <p>{s.body}</p>
                    <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => act(s.role, s.href)}>
                      {role === s.role ? "Go" : `Switch to ${p.name.split(" ")[0]}`} <IArrow size={16} />
                    </button>
                  </>}
                </div>
              </div>
            );
          })}
          <div className="row wrap" style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 4 }}>
            <span className="small faint grow">Replay the story</span>
            <button className="btn text sm" disabled={!!busy} onClick={() => reset("analysed")} title="Cases go back to Detected; Investigate replays the recorded agent run in about 15 seconds">
              <IReset size={16} />{busy === "analysed" ? "Resetting…" : "Quick reset"}</button>
            <button className="btn text sm" disabled={!!busy} onClick={() => reset("fresh")} title="Cases go back to Detected; Investigate calls Gemini live (about 1–2 minutes)">
              {busy === "fresh" ? "Resetting…" : "Full reset"}</button>
          </div>
        </div>
      )}
    </aside>
  );
}

/** Banner on a case: who acts next, with a one-click persona switch for the demo account. */
export function NextAction({ status, caseId }: { status: string; caseId: string }) {
  const { role, isDemo } = useSession();
  const act = useActAs();
  const owner = OWNER[status];
  if (!owner) return null;
  const p = persona(owner);
  const mine = owner === role;
  const href = owner === "supplier" ? "/supplier" : owner === "exec" ? "/overview" : `/case/${caseId}${owner === "sqe" ? "?tab=8d" : ""}`;
  return (
    <div className="next-action">
      <span className="avatar" style={{ background: p.color }}>{p.initials}</span>
      <div className="grow">
        <div className="label" style={{ color: "var(--primary-ink)" }}>{mine ? "Your move" : `Waiting on ${p.name} · ${p.title}`}</div>
        <div>{NEXT_TEXT[status]}</div>
      </div>
      {!mine && isDemo && <button className="btn" onClick={() => act(owner, href)}>Continue as {p.name.split(" ")[0]} <IArrow size={16} /></button>}
    </div>
  );
}

const SLIDES = [
  { k: "The problem", t: "Field failures take about 7 weeks to trace", b: "Warranty claims arrive as short dealer notes in many languages. Analysts review them by hand, so a cluster of 40 failures goes unnoticed until it is 400. Automakers spend about $58B a year on warranty." },
  { k: "The solution", t: "Gemini agents read every claim and do the investigation", b: "Intake reads notes, photos and voice in any language. Signal clusters claims and spots growth. Trace finds the supplier batch. Hypothesise checks the PFMEA. Draft writes the 8D with citations. People approve." },
  { k: "The people", t: "Five roles, one connected flow", b: "Dealer files it → Analyst investigates → Supplier-quality engineer approves the 8D → Tier-1 supplier fixes it → Head of quality sees the impact. The demo account can be each of them." },
  { k: "Start", t: "Follow the guide in the corner", b: "Begin as Ravi at the Pune dealership and file a claim in Hindi. The orange guide panel tells you who to switch to next. You can replay the whole story with Reset." },
];

export function Welcome() {
  const { user, isDemo } = useSession();
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!user) return;
    try { if (!localStorage.getItem("f2f.welcomed")) setShow(true); } catch { setShow(true); }
  }, [user]);
  useEffect(() => {
    const h = () => { setI(0); setShow(true); };
    window.addEventListener("f2f:welcome", h);
    return () => window.removeEventListener("f2f:welcome", h);
  }, []);
  if (!show) return null;
  const close = () => { setShow(false); try { localStorage.setItem("f2f.welcomed", "1"); } catch {} };
  const s = SLIDES[i];
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="welcome-t">
      <div className="modal">
        <div className="row"><LogoMark size={40} /><span className="grow label">{s.k}</span>
          <button className="icon-btn" onClick={close} aria-label="Close"><IClose /></button></div>
        <h2 id="welcome-t" style={{ fontSize: 26 }}>{s.t}</h2>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>{s.b}</p>
        {i === 2 && (
          <div className="stack" style={{ gap: 8 }}>
            {PERSONAS.map((p) => (
              <div key={p.id} className="row"><span className="avatar sm" style={{ background: p.color }}>{p.initials}</span>
                <span className="grow"><b style={{ fontWeight: 500 }}>{p.step}. {p.name}</b> <span className="muted">· {p.title}, {p.org}</span></span></div>
            ))}
          </div>
        )}
        <div className="row">
          <span className="slide-dots grow">{SLIDES.map((_, j) => <i key={j} className={j === i ? "on" : ""} />)}</span>
          {i > 0 && <button className="btn text" onClick={() => setI(i - 1)}>Back</button>}
          {i < SLIDES.length - 1
            ? <button className="btn" onClick={() => setI(i + 1)}>Next</button>
            : <button className="btn" onClick={close}>{isDemo ? "Start the demo" : "Get started"}</button>}
        </div>
      </div>
    </div>
  );
}

const HELP: { match: (p: string) => boolean; title: string; points: string[] }[] = [
  { match: (p) => p.startsWith("/start"), title: "Start here", points: ["This page explains the story and the five roles.", "Use the journey cards or the orange guide to move between roles in order.", "The demo account switches roles instantly; real accounts have one fixed role."] },
  { match: (p) => p.startsWith("/claim"), title: "Filing a warranty claim", points: ["Pick a sample VIN and an example note (Hindi, Bahasa or English), or write your own.", "On submit, Gemini reads the note (and photo), translates it, extracts the failure, embeds it and compares it with every open case.", "If it matches a case, the claim joins it instantly and the analyst sees it. No monthly review wait.", "The timeline at the bottom compares this with the traditional process."] },
  { match: (p) => p === "/cases", title: "Cases", points: ["Each row is a failure cluster found by the Signal agent from claim meaning, not keywords.", "Rows are ranked by growth × severity. Red = growing fast.", "The chart shows claims per week by category; the hot category is highlighted.", "Open a case to investigate it."] },
  { match: (p) => p.startsWith("/case/"), title: "Case workspace", points: ["Overview: the numbers, the trace to supplier batch, and time saved.", "Evidence: every claim with original language text.", "Root cause: AI hypotheses with citations to PFMEA and control plan, plus Ask, a chat grounded in this case.", "8D report: the formal document the supplier receives. Activity: the lifecycle tree and full audit trail.", "The blue banner tells you who must act next."] },
  { match: (p) => p.startsWith("/supplier"), title: "Supplier portal", points: ["The Tier-1 supplier only sees its own cases.", "It gets the OEM's evidence: claims, batches, stock to contain, and the AI hypotheses.", "When it submits D4–D7, Gemini checks the response for gaps before the OEM reviews it."] },
  { match: (p) => p.startsWith("/watch"), title: "Field-to-Fix on a watch", points: ["The watch does three things: alert you when a case reaches you, let you decide with press-and-hold, and take a dictated claim.", "Switch who is wearing it with the chips under the watch. It is the same live data and API as the web app.", "Approvals need a 1-second hold so an accidental tap cannot approve an 8D.", "Open /w on a real watch or phone browser for the full-screen version."] },
  { match: (p) => p.startsWith("/overview"), title: "Quality overview", points: ["Claims, cost and open cases across the whole network.", "Time to root cause: industry baseline vs. what Field-to-Fix measured on this data.", "Case funnel shows where cases sit in the 8D workflow."] },
];

export function PageHelp() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const h = HELP.find((x) => x.match(path));
  if (!h) return null;
  return (
    <>
      <button className="help-btn" onClick={() => setOpen(true)}><IHelp size={16} /><span className="hide-sm">How this page works</span></button>
      {open && (
        <div className="scrim" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row"><h2 className="grow">{h.title}</h2><button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><IClose /></button></div>
            <ol className="stack" style={{ paddingLeft: 20, margin: 0, gap: 8 }}>{h.points.map((p, i) => <li key={i} style={{ lineHeight: 1.55 }}>{p}</li>)}</ol>
            <div className="row"><span className="grow" /><button className="btn text" onClick={() => { setOpen(false); window.dispatchEvent(new Event("f2f:welcome")); }}>Replay intro</button>
              <button className="btn" onClick={() => setOpen(false)}>Got it</button></div>
          </div>
        </div>
      )}
    </>
  );
}
