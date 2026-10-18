"use client";

import { useState } from "react";
import { useActAs } from "@/components/Guide";
import { WatchApp } from "@/components/Watch";
import { PERSONAS, useSession } from "@/lib/session";

const JOBS = [
  { t: "Get tapped when it's your turn", b: "A case that moves into your queue buzzes your wrist: \"8D ready for review\", \"Supplier responded, 3 gaps\". No need to watch a dashboard." },
  { t: "Decide with one hold", b: "Investigate, approve an 8D, send a reply back. Press and hold to confirm, so a stray tap at lunch never approves anything." },
  { t: "Dictate a claim with greasy hands", b: "The technician speaks the note in Hindi, Bahasa or English. Gemini reads it and links it to a case before the gloves come off." },
  { t: "Ask one question", b: "\"Which batch is bad?\" Gemini answers in one line, grounded in the case data, with the full answer on the phone." },
];

export default function WatchDemo() {
  const { role, isDemo } = useSession();
  const act = useActAs();
  const [device, setDevice] = useState<"apple" | "wear">("apple");

  return (
    <>
      <div className="page-head">
        <div className="grow"><span className="label">Field-to-Fix on the wrist</span>
          <h1>When the phone is in a locker and the laptop is at the desk</h1>
          <p>Technicians wear gloves, engineers walk the line, managers are at lunch. The watch app keeps the loop moving with only
            the three things a wrist does well: alert, decide, dictate. It uses the same API and live data as the web app.</p></div>
      </div>

      <div className="grid g-2-3">
        <div className="card card-pad stack watch-stage">
          <div className="row wrap" style={{ justifyContent: "center" }}>
            <div className="seg" role="tablist" aria-label="Watch type">
              <button role="tab" aria-selected={device === "apple"} onClick={() => setDevice("apple")}>Apple Watch</button>
              <button role="tab" aria-selected={device === "wear"} onClick={() => setDevice("wear")}>Wear OS</button>
            </div>
          </div>
          <div className="fill center" style={{ alignItems: "center" }}>
            <div className={`watch-frame ${device}`}>
              <div className="watch-screen"><WatchApp round={device === "wear"} /></div>
              {device === "apple" && <i className="crown" aria-hidden="true" />}
            </div>
          </div>
          {isDemo && (
            <div className="row wrap" style={{ justifyContent: "center", gap: 6 }}>
              <span className="faint small">Wear it as:</span>
              {PERSONAS.map((p) => (
                <button key={p.id} className={`chip ${role === p.id ? "blue" : ""}`} style={{ border: 0, cursor: "pointer" }}
                  onClick={() => act(p.id, "/watch")}>{p.name.split(" ")[0]} · {p.title.split(" ")[0]}</button>))}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="grid g2">
            {JOBS.map((j, i) => (
              <div key={j.t} className="card card-pad stack" style={{ gap: 8 }}>
                <span className="chip blue" style={{ alignSelf: "flex-start" }}>{i + 1}</span>
                <h3>{j.t}</h3><p className="muted small" style={{ lineHeight: 1.55 }}>{j.b}</p>
              </div>
            ))}
          </div>
          <div className="card card-pad stack fill">
            <h3>Try it</h3>
            <ol className="stack" style={{ margin: 0, paddingLeft: 18, gap: 6 }}>
              <li>Wear it as <b style={{ fontWeight: 500 }}>Ravi</b> and tap <b style={{ fontWeight: 500 }}>Dictate a claim</b>. Speak, or pick a phrase. It links to the coolant case.</li>
              <li>Switch to <b style={{ fontWeight: 500 }}>Ananya</b>, open the case, hold to investigate.</li>
              <li>Switch to <b style={{ fontWeight: 500 }}>Kenji</b>. When the 8D is ready, the watch buzzes; hold to approve.</li>
            </ol>
            <p className="faint small">On a real watch or phone, open <span className="mono">/w</span> for the full-screen watch view.</p>
            <h3 style={{ marginTop: 6 }}>How it ships</h3>
            <div className="kv">
              <span>Wear OS</span><b>Compose app + Tile; Firebase Auth; FCM push for "your turn" alerts</b>
              <span>Apple Watch</span><b>SwiftUI app + complication; APNs via Firebase; Siri dictation</b>
              <span>Backend</span><b>Unchanged: the same Cloud Run API, Firestore listeners and Gemini agents</b>
              <span>Offline</span><b>Dictated claims queue on the watch and send when the phone reconnects</b>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
