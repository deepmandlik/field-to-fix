"use client";

import Link from "next/link";
import { BarList, Stat } from "@/components/charts";
import { STORY, useActAs } from "@/components/Guide";
import { IArrow } from "@/components/icons";
import { TimeGap } from "@/components/TimeGap";
import { DEMO_CASE, inr, storyProgress, useCases, useSummary } from "@/lib/data";
import { PERSONAS, persona, useSession } from "@/lib/session";

const AGENTS = [
  { n: "Intake", m: "Gemini 2.5 Flash", d: "Reads the note, photo and voice in any language; extracts component, failure, condition, severity." },
  { n: "Signal", m: "Gemini embeddings + HDBSCAN", d: "Groups claims by meaning and flags clusters growing faster than their baseline." },
  { n: "Trace", m: "BigQuery tools", d: "Joins failing VINs to plant, part, supplier and batch; computes each batch's lift over the fleet." },
  { n: "Hypothesise", m: "Gemini 2.5 Pro", d: "Checks the cluster against the PFMEA and control plan; ranks root causes with citations." },
  { n: "Draft 8D", m: "Gemini 2.5 Pro", d: "Writes D2–D5 with containment quantities from the stock table. A person approves." },
];

export default function Start() {
  const { role, isDemo } = useSession();
  const act = useActAs();
  const cases = useCases();
  const s = useSummary();
  const flagship = cases?.find((c) => c.id === DEMO_CASE);
  const { done, current } = storyProgress(flagship);
  const nextStep = STORY[current] ?? STORY[0];
  const open = cases?.filter((c) => !["closed", "dismissed"].includes(c.status)) ?? [];

  return (
    <>
      <section className="hero">
        <span className="chip blue" style={{ alignSelf: "flex-start" }}>Google Cloud AI Builder Cup 2026 · Manufacturing</span>
        <h1>Dealers file it. OEMs approve it. Suppliers solve it.</h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 760, lineHeight: 1.6 }}>
          Car makers take about seven weeks to find the root cause of a field failure, while defective parts keep shipping.
          Field-to-Fix connects the dealer, the OEM and the supplier with Gemini agents, so a failure pattern is caught,
          traced to the exact supplier batch and turned into a cited 8D report the same day.
        </p>
        <div className="row wrap">
          {isDemo
            ? <button className="btn" style={{ height: 46 }} onClick={() => act(nextStep.role, nextStep.href)}>
                {current === 0 ? "Start the walkthrough" : `Continue: ${nextStep.title}`} <IArrow size={18} /></button>
            : <Link className="btn" href={persona(role).home}>Go to my work <IArrow size={18} /></Link>}
          <button className="btn outline" style={{ height: 46 }} onClick={() => window.dispatchEvent(new Event("f2f:welcome"))}>Watch the 4-step intro</button>
        </div>
      </section>

      <div className="grid g4 eq">
        <Stat label="Warranty claims read by AI" value={s?.claims ?? "—"} sub={`${s?.claims_30d ?? "—"} in the last 30 days · 3 languages`} />
        <Stat label="Open failure cases" value={open.length || "—"} sub={`${open.filter((c) => c.level === "critical").length} critical`} hot={open.some((c) => c.level === "critical")} />
        <Stat label="Warranty cost in window" value={s ? inr(s.cost_inr) : "—"} sub="dealer claims paid" />
        <Stat label="Vehicles at risk, no claims yet" value={flagship?.trace?.other_models_at_risk?.reduce((n: number, m: any) => n + m.vins_at_risk, 0)?.toLocaleString() ?? "—"} sub="same suspect batch, other models" />
      </div>

      <div className="section-title"><h2>The journey, one role at a time</h2>{isDemo && <span className="faint small">Click a card to become that person</span>}</div>
      <div className="journey">
        {PERSONAS.map((p) => {
          const stepIdx = STORY.findIndex((x, i) => x.role === p.id && (i >= current || p.id !== "sqe"));
          const isNow = STORY[current]?.role === p.id;
          const isDone = STORY.every((x, i) => x.role !== p.id || done[i]);
          return (
            <div key={p.id} className={`jcard ${isNow ? "now" : ""}`}>
              <div className="row"><span className="k grow">STEP {p.step}</span>{isDone && <span className="chip green">done</span>}{isNow && <span className="chip blue">next</span>}</div>
              <div className="row"><span className="avatar" style={{ background: p.color }}>{p.initials}</span>
                <div><b style={{ fontWeight: 500 }}>{p.name}</b><div className="faint small">{p.title}<br />{p.org}</div></div></div>
              <p className="muted small" style={{ lineHeight: 1.5 }}>{p.does}</p>
              {isDemo && <button className={`btn ${isNow ? "" : "tonal"} sm`} style={{ marginTop: "auto", alignSelf: "flex-start" }}
                onClick={() => act(p.id, stepIdx >= 0 ? STORY[stepIdx].href : p.home)}>Be {p.name.split(" ")[0]}</button>}
            </div>
          );
        })}
      </div>

      <div className="grid g-2-1">
        <div className="card card-pad stack">
          <div className="row"><h3 className="grow">Closing the time gap</h3><span className="chip green">same-day 8D</span></div>
          <TimeGap investigationSeconds={flagship?.investigation_seconds} />
        </div>
        <div className="card card-pad stack">
          <h3>Where claims come from</h3>
          <BarList fill data={(s?.cities ?? []).slice(0, 6).map((c: any) => ({ name: c.name, value: c.value }))} />
          <div className="row wrap small faint">{(s?.languages ?? []).map((l: any) => <span key={l.name} className="chip">{{ en: "English", hi: "Hindi", id: "Bahasa" }[l.name as string] ?? l.name} · {l.value}</span>)}</div>
        </div>
      </div>

      <div className="card card-pad row wrap" style={{ gap: 20 }}>
        <div className="grow" style={{ minWidth: 260 }}>
          <span className="label">Works on every screen</span>
          <h3 style={{ marginTop: 4 }}>Laptop for the investigation, phone on the shop floor, watch at lunch</h3>
          <p className="muted small" style={{ marginTop: 6, lineHeight: 1.55 }}>The same live data adapts from a 2K monitor down to a phone. On Apple Watch and Wear OS, people get a buzz when a case reaches them, approve with a press-and-hold, and dictate claims by voice.</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {["🖥️ Monitor", "💻 Laptop", "📱 Phone", "⌚ Watch"].map((d) => <span key={d} className="chip" style={{ height: 32, fontSize: 13 }}>{d}</span>)}
        </div>
        <Link className="btn" href="/watch">See the watch app</Link>
      </div>

      <div className="section-title"><h2>Five agents on Google Cloud</h2></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {AGENTS.map((a, i) => (
          <div key={a.n} className="card card-pad stack" style={{ gap: 8 }}>
            <span className="row"><span className="chip blue">Agent {i + 1}</span></span>
            <h3>{a.n}</h3><span className="faint small">{a.m}</span>
            <p className="muted small" style={{ lineHeight: 1.55 }}>{a.d}</p>
          </div>
        ))}
      </div>
      <p className="faint small">Runs on Cloud Run (asia-southeast1) with Vertex AI Gemini, BigQuery, Firestore realtime, Cloud Storage and Firebase Auth. Data is synthetic: 6,400 vehicles and 630 claims.</p>
    </>
  );
}
