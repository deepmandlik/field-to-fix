import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, staticFile } from "remotion";
import { C, LEAD, SceneFade } from "./kit";
import * as S from "./scenes";
import timing from "./timing.json";
import { CloseV2, Karaoke, makeRec, makeWatchRec, TitleV2 } from "./v2";

const FPS = 30;
const TAIL = 0.9;
const MAX_RATE = 1.25;

const REC = {
  login: makeRec({ src: "r1-login.mp4", eyebrow: "LIVE ON CLOUD RUN", color: C.blue, title: "One judge account, five roles, a guided tour",
    keys: [{ t: 0, x: 0.62, y: 0.45, s: 1.25 }, { t: 4.5, x: 0.6, y: 0.4, s: 1.0 }],
    callouts: [{ at: 2.5, title: "Firebase Auth", body: "Tick “I’m a judge” and sign in", color: C.amber }, { at: 6, title: "Start here", body: "Story, roles and live numbers", color: C.blue }] }),
  claim: makeRec({ src: "r2-claim.mp4", eyebrow: "STEP 1 · DEALER", color: C.orange, title: "A Hindi note and a photo, linked in seconds",
    keys: [{ t: 0, x: 0.45, y: 0.4, s: 1.15 }, { t: 6, x: 0.62, y: 0.45, s: 1.25 }, { t: 12, x: 0.6, y: 0.4, s: 1.05 }],
    callouts: [{ at: 1.5, title: "Any language + photo", body: "“कूलेंट लीक, क्लैंप बदला”", color: C.orange },
      { at: 7, title: "Gemini sees the photo", body: "The clamp is visibly cracked", color: C.purple },
      { at: 13, title: "Linked · analyst notified", body: "Coolant-leak case · 0.97", color: C.green, dark: true, chime: true }] }),
  investigate: makeRec({ src: "r3-investigate.mp4", eyebrow: "STEP 2 · ANALYST", color: "#1A73E8", title: "One click: five agents investigate, live",
    keys: [{ t: 0, x: 0.55, y: 0.35, s: 1.1 }, { t: 5, x: 0.58, y: 0.55, s: 1.35 }, { t: 18, x: 0.58, y: 0.5, s: 1.2 }, { t: 24, x: 0.55, y: 0.5, s: 1.05 }],
    callouts: [{ at: 5, title: "Trace", body: "Two clamp batches, one supplier", color: C.teal },
      { at: 10, title: "Early warning", body: "307 cars at risk, 0 claims yet", color: C.red },
      { at: 15, title: "Hypothesise + Draft", body: "Cited 8D in about a minute", color: C.purple },
      { at: 20, title: "Firestore realtime", body: "Every step streams to every screen", color: C.green, dark: true }] }),
  ask: makeRec({ src: "r4-ask.mp4", eyebrow: "ROOT CAUSE · ASK", color: C.purple, title: "Ask questions, get cited answers",
    keys: [{ t: 0, x: 0.5, y: 0.4, s: 1.1 }, { t: 2.5, x: 0.83, y: 0.35, s: 1.9 }],
    callouts: [{ at: 2.5, title: "Grounded in the case", body: "Gemini uses tools, cites claims and PFMEA rows", color: C.purple }] }),
  eightd: makeRec({ src: "r5-8d.mp4", eyebrow: "STEP 3 · SUPPLIER QUALITY", color: C.purple, title: "The 8D report, drafted and cited",
    keys: [{ t: 0, x: 0.6, y: 0.45, s: 1.25 }],
    callouts: [{ at: 2, title: "From BigQuery", body: "Parts to quarantine, by location", color: C.blue }, { at: 5, title: "A person decides", body: "Every edit is tracked", color: C.green }] }),
  watchapprove: makeWatchRec({ src: "r6-watch-approve.mp4", broll: "broll-lunch.jpg", eyebrow: "ON THE WRIST", title: "At lunch? Approve with one firm hold", focus: [0.3, 0.43],
    callouts: [{ at: 1.5, title: "Your turn", body: "The watch shows the case", color: C.blue }, { at: 3.6, title: "Hold for 1 second", body: "No accidental approvals", color: C.green, dark: true, chime: true }] }),
  supplier: makeRec({ src: "r7-supplier.mp4", eyebrow: "STEP 4 · TIER-1 SUPPLIER", color: "#8C5000", title: "Gemini checks the supplier’s answer too", bg: "#FFF8E6",
    keys: [{ t: 0, x: 0.55, y: 0.4, s: 1.15 }, { t: 6, x: 0.75, y: 0.35, s: 1.6 }],
    callouts: [{ at: 2, title: "Supplier says", body: "A torque tool drifted", color: C.faint }, { at: 5.5, title: "Evidence says", body: "Clamp band hardness", color: C.purple },
      { at: 8.5, title: "4 gaps flagged", body: "Before the OEM accepts", color: C.red, dark: true }] }),
  sendback: makeRec({ src: "r8-sendback.mp4", eyebrow: "STEP 5 · DECISION", color: C.purple, title: "Send it back, with a full audit trail",
    keys: [{ t: 0, x: 0.6, y: 0.4, s: 1.15 }, { t: 4, x: 0.5, y: 0.5, s: 1.05 }],
    callouts: [{ at: 1.5, title: "One click", body: "Send back with the 4 gaps", color: C.red }, { at: 4.5, title: "Activity tree", body: "Every agent step and decision", color: C.blue }] }),
  dictate: makeWatchRec({ src: "r9-watch-dictate.mp4", eyebrow: "ON THE SHOP FLOOR", title: "Gloves on? Dictate the claim on the watch", focus: [0.31, 0.43],
    callouts: [{ at: 1.5, title: "Wear OS", body: "Speak or pick a phrase, any language", color: C.orange }, { at: 6, title: "Read and linked", body: "Analyst notified", color: C.green, dark: true, chime: true }] }),
  overview: makeRec({ src: "r10-overview.mp4", eyebrow: "STEP 6 · HEAD OF QUALITY", color: C.green, title: "Cost, cases and risk, on any screen",
    keys: [{ t: 0, x: 0.5, y: 0.5, s: 1.05 }],
    callouts: [{ at: 2, title: "Network view", body: "Claims, cost by category, case funnel", color: C.green }] }),
};
const CLIP: Record<string, number> = { login: 12.3, claim: 23.4, investigate: 34.7, ask: 9.8, eightd: 10.9, watchapprove: 8.4, supplier: 15.7, sendback: 12.3, dictate: 14.7, overview: 9.1 };
const INTRO: Record<string, number> = { watchapprove: 3.2 };

// id -> [component, min seconds, dark captions]
const STATIC: Record<string, [React.FC<any>, number, boolean]> = {
  open: [S.Open, 7.8, true], problem: [S.Problem, 0, true], title: [TitleV2, 7.5, true], people: [S.People, 9.5, false],
  architecture: [S.Architecture, 9.5, false], impact: [S.Impact, 7, false], close: [CloseV2, 8.5, true],
};

const plan = timing.map((t) => {
  const vo = LEAD + t.seconds + TAIL;
  if (REC[t.id as keyof typeof REC]) {
    const clip = CLIP[t.id], intro = INTRO[t.id] ?? 0;
    const secs = Math.max(vo, intro + clip / MAX_RATE);
    const rate = clip / (secs - intro);
    return { ...t, Comp: REC[t.id as keyof typeof REC], props: { rate } as any, dark: false, frames: Math.round(secs * FPS) };
  }
  const [Comp, min, dark] = STATIC[t.id];
  return { ...t, Comp, props: {} as any, dark, frames: Math.round(Math.max(min, vo) * FPS) };
});
const TOTAL = plan.reduce((n, p) => n + p.frames, 0);

const Video: React.FC = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: "#131314" }}>
      {plan.map((p) => {
        const start = from;
        from += p.frames;
        return (
          <Sequence key={p.id} from={start} durationInFrames={p.frames} name={p.id}>
            <SceneFade bg={p.dark ? "#131314" : "#F8FAFD"}><p.Comp {...p.props} /></SceneFade>
            <Sequence from={Math.round(LEAD * FPS)}><Audio src={staticFile(`${p.id}.wav`)} /></Sequence>
            {/* minimal sound design: soft whoosh on each cut, a light pop per callout, a chime on successes */}
            <Sequence durationInFrames={24}><Audio src={staticFile("sfx-whoosh.wav")} volume={0.16} /></Sequence>
            {((p.Comp as any).cues ?? []).map((c: { at: number; chime: boolean }, i: number) => (
              <Sequence key={i} from={Math.round(c.at * FPS)} durationInFrames={c.chime ? 40 : 6}>
                <Audio src={staticFile(c.chime ? "sfx-chime.wav" : "sfx-pop.wav")} volume={c.chime ? 0.22 : 0.18} />
              </Sequence>
            ))}
            {p.id === "close" && <Sequence from={Math.round(0.3 * FPS)} durationInFrames={40}><Audio src={staticFile("sfx-chime.wav")} volume={0.25} /></Sequence>}
            {p.id === "title" && <Sequence from={Math.round(0.2 * FPS)} durationInFrames={24}><Audio src={staticFile("sfx-whoosh.wav")} volume={0.22} /></Sequence>}
            <Karaoke text={p.text} voSeconds={p.seconds} dark={p.dark || (p.id === "watchapprove")} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const Root: React.FC = () => (
  <Composition id="F2F" component={Video} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
);
