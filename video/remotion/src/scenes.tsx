import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, Callout, Eyebrow, fontFamily, KenBurns, Logo, Screen, useIn } from "./kit";

const Title: React.FC<{ children: React.ReactNode; at?: number; color?: string }> = ({ children, at = 0.1, color = C.ink }) => {
  const p = useIn(at);
  return <div style={{ position: "absolute", left: 120, top: 84, width: 1700, fontSize: 46, fontWeight: 500, color, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>{children}</div>;
};
const sec = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; };

/* 1 · cold open: the failure in the field */
export const Open: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const half = Math.round(durationInFrames * 0.5);
  const note = "कूलेंट लीक, क्लैंप बदला।";
  const now = sec();
  const t = now - 3.6;
  const blink = Math.round(now * 2) % 2;
  const shown = note.slice(0, Math.max(0, Math.floor(t * 9)));
  const card = useIn(3.3, 16);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={half + 10}><KenBurns src="broll-coolant.jpg" from={[1.08, 0.55, 0.6]} to={[1.3, 0.62, 0.68]} /></Sequence>
      <Sequence from={half}><KenBurns src="broll-note.jpg" from={[1.1, 0.5, 0.45]} to={[1.22, 0.58, 0.45]} /></Sequence>
      <div style={{ position: "absolute", left: 80, top: 70, fontFamily, color: "#fff", fontSize: 28, fontWeight: 500, letterSpacing: 3, textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>PUNE · 18,200 KM</div>
      {t > -0.3 && (
        <div style={{ position: "absolute", right: 110, top: 300, width: 620, background: "rgba(255,255,255,0.96)", borderRadius: 20, padding: "26px 30px", fontFamily,
          boxShadow: "0 20px 50px rgba(0,0,0,.35)", opacity: card, transform: `scale(${0.9 + 0.1 * card})` }}>
          <div style={{ fontSize: 22, color: C.faint, fontWeight: 500, letterSpacing: 1 }}>WARRANTY CLAIM · REPAIR NOTE</div>
          <div style={{ fontSize: 44, marginTop: 10, color: C.ink, minHeight: 60 }}>{shown}<span style={{ opacity: blink }}>|</span></div>
        </div>
      )}
      <div style={{ display: "none" }}>{fps}</div>
    </AbsoluteFill>
  );
};

/* 2 · the problem in numbers */
const LANG_NOTES = ["कूलेंट लीक, क्लैंप ढीला", "Klem selang kendor", "Brake squeal at low speed", "ब्लूटूथ से स्क्रीन रीस्टार्ट", "Kaca jendela lambat", "Battery drained after 2 days", "AC ठंडा नहीं कर रहा", "Air masuk saat hujan", "Wiper stops mid-sweep"];
export const Problem: React.FC = () => {
  const s = sec();
  const weeks = Math.min(7, Math.floor(interpolate(s, [4.2, 6.2], [0, 7], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const big = useIn(4.0);
  const r1 = useIn(7.6), r2 = useIn(10.4), r3 = useIn(12.4);
  return (
    <AbsoluteFill style={{ background: C.dark, fontFamily }}>
      <div style={{ position: "absolute", top: 70, left: 0, display: "flex", gap: 22, transform: `translateX(${-s * 140}px)`, whiteSpace: "nowrap" }}>
        {[...LANG_NOTES, ...LANG_NOTES, ...LANG_NOTES].map((n, i) => (
          <div key={i} style={{ padding: "16px 24px", borderRadius: 14, background: "#1E1F20", color: "#BDC1C6", fontSize: 28, border: "1px solid #3C4043" }}>{n}</div>))}
      </div>
      <Eyebrow color={C.yellow} y={190}>THE PROBLEM</Eyebrow>
      <div style={{ position: "absolute", left: 120, top: 300, opacity: big, transform: `scale(${0.9 + 0.1 * big})`, transformOrigin: "left center" }}>
        <div style={{ fontSize: 230, fontWeight: 500, color: C.yellow, lineHeight: 1 }}>{weeks} {weeks === 1 ? "week" : "weeks"}</div>
        <div style={{ fontSize: 40, color: "#BDC1C6", marginTop: 16 }}>to confirm the root cause of one failure</div>
      </div>
      {[{ p: r1, n: "+9 weeks", d: "to fix it at the supplier", top: 300 }, { p: r2, n: "Bad parts", d: "keep shipping meanwhile", top: 500 }, { p: r3, n: "$58B", d: "a year in warranty cost", top: 700 }].map((r) => (
        <div key={r.n} style={{ position: "absolute", left: 1150, top: r.top, width: 660, opacity: r.p, transform: `translateX(${(1 - r.p) * 60}px)`, borderLeft: `6px solid ${C.amber}`, paddingLeft: 30 }}>
          <div style={{ fontSize: 76, fontWeight: 500, color: "#fff" }}>{r.n}</div>
          <div style={{ fontSize: 34, color: "#BDC1C6" }}>{r.d}</div>
        </div>
      ))}
      <div style={{ position: "absolute", left: 120, bottom: 120, fontSize: 22, color: "#80868B" }}>Source: McKinsey survey of OEM quality leaders, 2025</div>
    </AbsoluteFill>
  );
};

/* 3 · title */
export const TitleCard: React.FC = () => {
  const l = useIn(0.2, 12), a = useIn(1.6), b = useIn(2.5), c = useIn(3.4);
  const line = (p: number, t: string, col: string) => <div style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)`, color: col }}>{t}</div>;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 0% 0%, #FFE9B8 0%, #F8FAFD 55%)", fontFamily, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, transform: `scale(${0.7 + 0.3 * l})`, opacity: l }}>
        <Logo size={150} /><div style={{ fontSize: 120, fontWeight: 500, color: C.ink, letterSpacing: -2 }}>Field-to-Fix</div>
      </div>
      <div style={{ marginTop: 50, fontSize: 64, fontWeight: 400, lineHeight: 1.3, textAlign: "center" }}>
        {line(a, "Dealers file it.", C.orange)}{line(b, "Car makers approve it.", C.blue)}{line(c, "Suppliers solve it.", C.green)}
      </div>
    </AbsoluteFill>
  );
};

/* 4 · five people, five agents */
const PEOPLE = [["RK", "Dealer", "#E8710A"], ["AR", "Analyst", "#1A73E8"], ["KS", "Supplier quality", "#9334E6"], ["SI", "Tier-1 supplier", "#12B5CB"], ["MS", "Head of quality", "#188038"]];
const AGENTS = ["Intake", "Signal", "Trace", "Hypothesise", "Draft 8D"];
export const People: React.FC = () => {
  const s = sec();
  const lineW = interpolate(s, [1.2, 3.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily }}>
      <Eyebrow>WHO IT IS FOR</Eyebrow>
      <div style={{ position: "absolute", left: 120, top: 100, fontSize: 52, fontWeight: 500, color: C.ink }}>Five people, one live case</div>
      <div style={{ position: "absolute", left: 260, top: 380, width: 1400 * lineW, height: 6, background: C.blue, borderRadius: 3 }} />
      {PEOPLE.map(([i, n, col], k) => {
        const p = useIn(0.4 + k * 0.45, 12);
        return (
          <div key={n} style={{ position: "absolute", left: 160 + k * 350, top: 300, width: 200, textAlign: "center", opacity: p, transform: `scale(${0.6 + 0.4 * p})` }}>
            <div style={{ width: 160, height: 160, borderRadius: 80, margin: "0 auto", background: col, color: "#fff", fontSize: 56, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 30px rgba(0,0,0,.18)" }}>{i}</div>
            <div style={{ fontSize: 30, fontWeight: 500, marginTop: 18, color: C.ink }}>{n}</div>
          </div>
        );
      })}
      {AGENTS.map((a, k) => {
        const p = useIn(4.6 + k * 0.5, 14);
        return (
          <div key={a} style={{ position: "absolute", left: 120 + k * 344, top: 700, width: 320, padding: "22px 0", textAlign: "center", borderRadius: 18, background: C.surface,
            boxShadow: "0 6px 18px rgba(60,64,67,.15)", borderTop: `6px solid ${C.amber}`, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
            <div style={{ fontSize: 20, color: C.faint, fontWeight: 500, letterSpacing: 2 }}>GEMINI AGENT {k + 1}</div>
            <div style={{ fontSize: 34, fontWeight: 500, color: C.ink, marginTop: 6 }}>{a}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* 5 · dealer files a claim */
export const FileClaim: React.FC = () => {
  const { durationInFrames, fps } = useVideoConfig();
  const cut = Math.round(4.2 * fps);
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily }}>
      <Eyebrow color={C.orange}>STEP 1 · DEALER</Eyebrow>
      <Title>A claim in Hindi, with a photo</Title>
      <Sequence durationInFrames={cut + 8}><Screen src="04-claim-processing.jpg" width={1180} left={80} keys={[{ t: 0, x: 0.5, y: 0.5, s: 1 }, { t: 2.5, x: 0.8, y: 0.45, s: 1.7 }]} /></Sequence>
      <Sequence from={cut} durationInFrames={durationInFrames - cut}><Screen src="05-claim-result.jpg" width={1180} left={80} keys={[{ t: 0, x: 0.5, y: 0.3, s: 1.2 }, { t: 1.8, x: 0.33, y: 0.25, s: 2.1 }, { t: 4.4, x: 0.86, y: 0.25, s: 2.1 }]} /></Sequence>
      <Callout at={1.4} x={1300} y={200} w={540} color={C.orange} title="Gemini reads the note">“Coolant leak, clamp replaced”</Callout>
      <Callout at={5.6} x={1300} y={420} w={540} color={C.purple} title="Gemini sees the photo">The clamp is visibly cracked</Callout>
      <Callout at={8.4} x={1300} y={640} w={540} color={C.green} title="Linked in ~6 seconds">Coolant-leak case · 0.97 match</Callout>
    </AbsoluteFill>
  );
};

/* 6 · analyst investigates */
export const Investigate: React.FC = () => {
  const { durationInFrames, fps } = useVideoConfig();
  const cut = Math.round(7.5 * fps);
  return (
    <AbsoluteFill style={{ background: C.surface, fontFamily }}>
      <Eyebrow color="#1A73E8">STEP 2 · ANALYST</Eyebrow>
      <Title>One click: the agents trace it to a supplier batch</Title>
      <Sequence durationInFrames={cut + 8}><Screen src="07-agent-log-live.jpg" width={1180} left={80} keys={[{ t: 0, x: 0.5, y: 0.4, s: 1 }, { t: 2.2, x: 0.55, y: 0.62, s: 1.6 }, { t: 7, x: 0.55, y: 0.66, s: 1.7 }]} /></Sequence>
      <Sequence from={cut} durationInFrames={durationInFrames - cut}><Screen src="08-case-overview.jpg" width={1180} left={80} keys={[{ t: 0, x: 0.5, y: 0.2, s: 1.3 }, { t: 2, x: 0.86, y: 0.8, s: 2.1 }, { t: 6, x: 0.6, y: 0.15, s: 1.6 }]} /></Sequence>
      <Callout at={4.2} x={1300} y={180} w={540} color={C.teal} title="Trace">89% of failures share two clamp batches</Callout>
      <Callout at={8.6} x={1300} y={410} w={540} color={C.red} title="Early warning">307 cars of another model, before they fail</Callout>
      <Callout at={13.6} x={1300} y={640} w={540} color={C.blue} title="59 seconds" dark>Click to a cited 8D draft</Callout>
    </AbsoluteFill>
  );
};

/* 7 · root cause and Ask */
export const RootCause: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, fontFamily }}>
    <Eyebrow color={C.purple}>ROOT CAUSE · ASK</Eyebrow>
    <Title>Every answer points back to its evidence</Title>
    <Screen src="09-root-cause-ask.jpg" width={1180} left={80} keys={[{ t: 0, x: 0.45, y: 0.35, s: 1.4 }, { t: 3, x: 0.86, y: 0.28, s: 2.2 }]} />
    <Callout at={3.2} x={1300} y={330} w={540} color={C.purple} title="Ask, from case data only">Pune (23), Jakarta (9), Lucknow (8)</Callout>
  </AbsoluteFill>
);

/* 8 · 8D report */
export const EightD: React.FC = () => (
  <AbsoluteFill style={{ background: C.surface, fontFamily }}>
    <Eyebrow color={C.purple}>STEP 3 · SUPPLIER QUALITY</Eyebrow>
    <Title>The 8D report, drafted and cited</Title>
    <Screen src="10-8d-report.jpg" width={1180} left={80} keys={[{ t: 0, x: 0.6, y: 0.25, s: 1.3 }, { t: 7, x: 0.6, y: 0.75, s: 1.5 }]} />
    <Callout at={3} x={1300} y={300} w={540} color={C.blue} title="Quantities from BigQuery">Not from the model</Callout>
    <Callout at={5.6} x={1300} y={520} w={540} color={C.green} title="A person decides">Kenji edits and approves</Callout>
  </AbsoluteFill>
);

/* 9 · supplier and the AI completeness check */
export const Supplier: React.FC = () => (
  <AbsoluteFill style={{ background: "#FFF8E6", fontFamily }}>
    <Eyebrow color="#8C5000">STEP 4 · TIER-1 SUPPLIER</Eyebrow>
    <Title>The AI checks the supplier’s answer too</Title>
    <Screen src="12-supplier-ai-check.jpg" width={1180} left={80} keys={[{ t: 0, x: 0.4, y: 0.35, s: 1.3 }, { t: 3.2, x: 0.8, y: 0.22, s: 2 }]} />
    <Callout at={1} x={1300} y={210} w={540} color={C.faint} title="Supplier says">A torque tool drifted</Callout>
    <Callout at={3.4} x={1300} y={420} w={540} color={C.purple} title="Evidence says">Clamp hardness, Tier-2</Callout>
    <Callout at={5.4} x={1300} y={630} w={540} color={C.red} title="4 gaps flagged" dark>Default: send it back</Callout>
  </AbsoluteFill>
);

/* 10 · on the wrist */
const WATCHES = [["w1-apple-analyst.jpg", "Buzz: your turn", 2.6], ["w2-apple-sqe-case.jpg", "Hold to approve", 4.6], ["w5-apple-linked.jpg", "Dictate a claim", 7]] as const;
export const Watch: React.FC = () => {
  const s = sec();
  const split = interpolate(s, [0.8, 2.2], [1920, 860], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: split, height: 1080, overflow: "hidden" }}>
        <KenBurns src="broll-lunch.jpg" from={[1.15, 0.5, 0.5]} to={[1.35, 0.6, 0.62]} />
      </div>
      <div style={{ position: "absolute", left: 920, top: 70, fontSize: 26, fontWeight: 500, letterSpacing: 4, color: C.blue, opacity: s > 1.6 ? 1 : 0 }}>ON THE WRIST</div>
      {WATCHES.map(([src, label, at], k) => {
        const p = useIn(at, 13);
        return (
          <div key={src} style={{ position: "absolute", left: 900 + k * 330, top: 250, width: 320, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>
            <Img src={staticFile(src)} style={{ width: 300, height: 358, objectFit: "contain" }} />
            <div style={{ fontSize: 32, fontWeight: 500, color: C.ink, marginTop: 18 }}>{label}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 920, top: 780, width: 920, fontSize: 30, color: C.muted, opacity: useIn(8) }}>Apple Watch and Wear OS · same live data, same API</div>
    </AbsoluteFill>
  );
};

/* 11 · every screen */
export const Everywhere: React.FC = () => {
  const a = useIn(1.6, 14), b = useIn(2.4, 14);
  return (
    <AbsoluteFill style={{ background: C.surface, fontFamily }}>
      <Eyebrow color={C.green}>STEP 5 · HEAD OF QUALITY</Eyebrow>
      <Title>One live system, from a monitor to a phone</Title>
      <Screen src="14-overview.jpg" width={1180} left={80} keys={[{ t: 0, x: 0.5, y: 0.5, s: 1 }, { t: 5, x: 0.55, y: 0.45, s: 1.15 }]} />
      {[["p1-phone-claim.jpg", 1330, 190, a], ["p2-phone-case.jpg", 1590, 250, b]].map(([src, x, y, p]) => (
        <Img key={src as string} src={staticFile(src as string)} style={{ position: "absolute", left: x as number, top: y as number, width: 250, height: 540, objectFit: "cover", borderRadius: 34,
          border: "7px solid #202124", boxShadow: "0 20px 40px rgba(0,0,0,.3)", opacity: p as number, transform: `translateY(${(1 - (p as number)) * 80}px)` }} />
      ))}
    </AbsoluteFill>
  );
};

/* 12 · architecture */
const BOX = (l: number, t: number, w: number, title: string, sub: string, col: string, at: number) => ({ l, t, w, title, sub, col, at });
const BOXES = [
  BOX(110, 330, 330, "People", "Web · phone · watch", C.ink, 0.3),
  BOX(540, 330, 360, "Cloud Run · web", "Next.js, Firebase Auth", C.blue, 1.0),
  BOX(1000, 330, 380, "Cloud Run · agents", "Five agents + Ask", C.blue, 1.8),
  BOX(1480, 250, 360, "Vertex AI · Gemini", "Flash, Pro, embeddings, image", C.amber, 2.8),
  BOX(1480, 450, 360, "BigQuery", "Claims, batches, PFMEA", C.amber, 3.4),
  BOX(1480, 650, 360, "Cloud Storage", "Photos, voice", C.amber, 4.0),
  BOX(540, 650, 360, "Firestore", "Live cases, agent log", C.green, 4.8),
  BOX(1000, 650, 380, "Pub/Sub · Scheduler", "Async intake, hourly scan", C.green, 5.4),
];
export const Architecture: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, fontFamily }}>
    <Eyebrow>BUILT ON GOOGLE CLOUD</Eyebrow>
    <div style={{ position: "absolute", left: 120, top: 100, fontSize: 52, fontWeight: 500, color: C.ink }}>Two Cloud Run services, five agents, one live database</div>
    {BOXES.map((b) => {
      const p = useIn(b.at, 14);
      return (
        <div key={b.title} style={{ position: "absolute", left: b.l, top: b.t, width: b.w, padding: "24px 26px", borderRadius: 20, background: C.surface, borderTop: `7px solid ${b.col}`,
          boxShadow: "0 8px 22px rgba(60,64,67,.16)", opacity: p, transform: `scale(${0.85 + 0.15 * p})` }}>
          <div style={{ fontSize: 34, fontWeight: 500, color: C.ink }}>{b.title}</div>
          <div style={{ fontSize: 26, color: C.muted, marginTop: 6 }}>{b.sub}</div>
        </div>
      );
    })}
    {[[440, 400, 100, 1.0], [900, 400, 100, 1.8]].map(([x, y, w, at], k) => {
      const p = useIn(at as number);
      return <div key={k} style={{ position: "absolute", left: x, top: y, width: (w as number) * p, height: 6, background: C.blue, borderRadius: 3 }} />;
    })}
    <div style={{ position: "absolute", left: 120, top: 900, fontSize: 28, color: C.muted, opacity: useIn(6) }}>No API keys: one service account · region asia-southeast1</div>
  </AbsoluteFill>
);

/* 13 · impact */
export const Impact: React.FC = () => {
  const s = sec();
  const today = interpolate(s, [0.3, 1.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const f2f = useIn(2.2, 12);
  const stats: [string, string, string][] = [["~6 s", "claim linked", C.blue], ["59 s", "cited 8D draft", C.blue], ["307", "cars flagged early", C.red], ["4 gaps", "caught in the reply", "#8C5000"]];
  return (
    <AbsoluteFill style={{ background: C.surface, fontFamily }}>
      <Eyebrow color={C.green}>IMPACT</Eyebrow>
      <div style={{ position: "absolute", left: 120, top: 100, fontSize: 52, fontWeight: 500, color: C.ink }}>From about 19 weeks to the same day</div>
      <div style={{ position: "absolute", left: 120, top: 280, fontSize: 32, fontWeight: 500 }}>Today</div>
      <div style={{ position: "absolute", left: 420, top: 270, width: 1200 * today, height: 64, borderRadius: 12, overflow: "hidden", display: "flex" }}>
        <div style={{ width: "15%", background: "#9AA0A6" }} /><div style={{ width: "36%", background: C.orange }} /><div style={{ width: "49%", background: C.red }} />
      </div>
      <div style={{ position: "absolute", left: 1650, top: 280, fontSize: 34, fontWeight: 500, opacity: today }}>~19 wks</div>
      <div style={{ position: "absolute", left: 120, top: 400, fontSize: 32, fontWeight: 500 }}>Field-to-Fix</div>
      <div style={{ position: "absolute", left: 420, top: 390, width: 40, height: 64, borderRadius: 12, background: C.green, transform: `scaleX(${f2f})`, transformOrigin: "left" }} />
      <div style={{ position: "absolute", left: 490, top: 400, fontSize: 34, fontWeight: 500, color: C.green, opacity: f2f }}>&lt; 1 day</div>
      {stats.map(([n, d, col], k) => {
        const p = useIn(2.8 + k * 0.35, 14);
        return (
          <div key={n} style={{ position: "absolute", left: 120 + k * 430, top: 560, width: 400, padding: 30, borderRadius: 22, background: C.bg, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
            <div style={{ fontSize: 84, fontWeight: 500, color: col }}>{n}</div>
            <div style={{ fontSize: 30, color: C.muted }}>{d}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 120, top: 860, fontSize: 22, color: C.faint }}>Baseline: McKinsey survey. Field-to-Fix figures measured on synthetic demo data.</div>
    </AbsoluteFill>
  );
};

/* 14 · close */
export const Close: React.FC = () => {
  const l = useIn(0.4, 14), u = useIn(2.6);
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <KenBurns src="broll-factory.jpg" from={[1.1, 0.5, 0.5]} to={[1.22, 0.6, 0.5]} dim={0.62} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: l, transform: `scale(${0.8 + 0.2 * l})` }}>
          <Logo size={130} /><div style={{ fontSize: 110, fontWeight: 500 }}>Field-to-Fix</div>
        </div>
        <div style={{ fontSize: 46, marginTop: 30, color: "#E8EAED", opacity: l }}>Dealers file it. Car makers approve it. Suppliers solve it.</div>
        <div style={{ marginTop: 50, fontSize: 36, padding: "16px 34px", borderRadius: 999, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.35)", opacity: u }}>
          Try it live · f2f-web-lc64mw36wq-as.a.run.app
        </div>
        <div style={{ marginTop: 26, fontSize: 26, color: "#BDC1C6", opacity: u }}>Google Cloud AI Builder Cup 2026 · Manufacturing</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
