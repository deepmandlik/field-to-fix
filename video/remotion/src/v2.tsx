import React from "react";
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, Callout, Eyebrow, fontFamily, KenBurns, LEAD, Logo, useIn } from "./kit";

const sec = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; };

/* ---------- karaoke captions: the spoken word lights up, no grey box ---------- */
export const Karaoke: React.FC<{ text: string; voSeconds: number; dark?: boolean }> = ({ text, voSeconds, dark }) => {
  const t = sec() - LEAD;
  if (t < -0.15 || t > voSeconds + 0.5) return null;
  const words = text.split(/\s+/);
  const weights = words.map((w) => w.length + 2 + (/[,.;:!?]$/.test(w) ? 4 : 0)); // pauses after punctuation
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  const starts = weights.map((w) => { const s = (acc / total) * voSeconds; acc += w; return s; });
  let active = starts.findIndex((s, i) => t >= s && (i === starts.length - 1 || t < starts[i + 1]));
  if (active < 0) active = t < 0 ? 0 : words.length - 1;
  // chunk into lines of ~7 words that break after punctuation where possible
  const chunks: number[][] = [];
  let cur: number[] = [];
  words.forEach((w, i) => { cur.push(i); if (cur.length >= 7 || (cur.length >= 4 && /[,.;:!?]$/.test(w))) { chunks.push(cur); cur = []; } });
  if (cur.length) chunks.push(cur);
  const chunk = chunks.find((c) => c.includes(active)) ?? chunks[0];
  const ink = dark ? "#FFFFFF" : C.ink;
  const dim = dark ? "rgba(255,255,255,0.72)" : "#5F6368";
  const hiBg = dark ? C.amber : C.blue;
  const hiInk = dark ? "#1F1F1F" : "#FFFFFF";
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 30, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "4px 12px", fontFamily,
      fontSize: 40, fontWeight: 500, textShadow: dark ? "0 2px 10px rgba(0,0,0,.65)" : "0 1px 0 rgba(255,255,255,.9)" }}>
      {chunk.map((i) => (
        <span key={i} style={{ color: i === active ? hiInk : i < active ? ink : dim, background: i === active ? hiBg : "transparent",
          padding: "2px 10px", borderRadius: 10, transition: "none", textShadow: i === active ? "none" : undefined }}>{words[i]}</span>
      ))}
    </div>
  );
};

/* ---------- a real screen recording in a browser frame, with a camera ---------- */
type Key = { t: number; x: number; y: number; s: number };
export const RecFrame: React.FC<{ src: string; rate: number; keys?: Key[]; width?: number; left?: number; top?: number; startAt?: number }> = ({ src, rate, keys = [{ t: 0, x: 0.5, y: 0.5, s: 1 }], width = 1180, left = 80, top = 172, startAt = 0 }) => {
  const t = sec();
  const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const ts = keys.map((k) => k.t);
  const s = keys.length > 1 ? interpolate(t, ts, keys.map((k) => k.s), ease) : keys[0].s;
  let x = keys.length > 1 ? interpolate(t, ts, keys.map((k) => k.x), ease) : keys[0].x;
  let y = keys.length > 1 ? interpolate(t, ts, keys.map((k) => k.y), ease) : keys[0].y;
  x = Math.min(Math.max(x, 0.5 / s), 1 - 0.5 / s);
  y = Math.min(Math.max(y, 0.5 / s), 1 - 0.5 / s);
  const h = width * 0.625;
  const enter = useIn(0);
  return (
    <div style={{ position: "absolute", left, top, width, borderRadius: 18, overflow: "hidden", background: C.surface, boxShadow: "0 30px 80px rgba(32,33,36,0.28)",
      border: `1px solid ${C.line}`, opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}>
      <div style={{ height: 44, background: "#F1F3F4", display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: `1px solid ${C.line}` }}>
        {["#F28B82", "#FDD663", "#81C995"].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
        <span style={{ marginLeft: 18, flex: 1, height: 28, borderRadius: 14, background: "#FFFFFF", color: C.faint, fontSize: 17, display: "flex", alignItems: "center", padding: "0 16px", fontFamily }}>
          f2f-web-lc64mw36wq-as.a.run.app</span>
        <span style={{ fontSize: 15, color: C.red, fontFamily, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <i style={{ width: 9, height: 9, borderRadius: 5, background: C.red, display: "inline-block", opacity: Math.round(t * 1.6) % 2 ? 1 : 0.35 }} />LIVE DEMO</span>
      </div>
      <div style={{ width, height: h, overflow: "hidden" }}>
        <OffthreadVideo src={staticFile(src)} playbackRate={rate} startFrom={startAt} muted
          style={{ width, height: h, objectFit: "cover", transformOrigin: "50% 50%", transform: `scale(${s}) translate(${(0.5 - x) * 100}%, ${(0.5 - y) * 100}%)` }} />
      </div>
    </div>
  );
};

const Heading: React.FC<{ eyebrow: string; color: string; title: string }> = ({ eyebrow, color, title }) => {
  const p = useIn(0.15);
  return (<>
    <Eyebrow color={color}>{eyebrow}</Eyebrow>
    <div style={{ position: "absolute", left: 120, top: 92, width: 1700, fontSize: 46, fontWeight: 500, color: C.ink, fontFamily, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>{title}</div>
  </>);
};

export type CalloutSpec = { at: number; title: string; body: string; color: string; dark?: boolean };
export const makeRec = (o: { src: string; eyebrow: string; color: string; title: string; keys?: Key[]; callouts: CalloutSpec[]; bg?: string }) => {
  const Comp: React.FC<{ rate: number }> = ({ rate }) => (
    <AbsoluteFill style={{ background: o.bg ?? C.bg, fontFamily }}>
      <Heading eyebrow={o.eyebrow} color={o.color} title={o.title} />
      <RecFrame src={o.src} rate={rate} keys={o.keys} />
      {o.callouts.map((c, i) => (
        <Callout key={i} at={c.at} x={1300} y={190 + i * 190} w={540} color={c.color} title={c.title} dark={c.dark}>{c.body}</Callout>
      ))}
    </AbsoluteFill>
  );
  return Comp;
};

/* ---------- watch scene: lunch b-roll, then the recording zoomed on the watch ---------- */
export const makeWatchRec = (o: { src: string; eyebrow: string; title: string; focus: [number, number]; callouts: CalloutSpec[]; broll?: string }) => {
  const Comp: React.FC<{ rate: number }> = ({ rate }) => {
    const { fps, durationInFrames } = useVideoConfig();
    const intro = o.broll ? Math.round(3.2 * fps) : 0;
    const [fx, fy] = o.focus;
    return (
      <AbsoluteFill style={{ background: C.bg, fontFamily }}>
        {o.broll && <Sequence durationInFrames={intro + 10}><KenBurns src={o.broll} from={[1.12, 0.5, 0.5]} to={[1.3, 0.6, 0.62]} /></Sequence>}
        <Sequence from={intro} durationInFrames={durationInFrames - intro}>
          <AbsoluteFill style={{ background: C.bg }}>
            <Heading eyebrow={o.eyebrow} color={C.blue} title={o.title} />
            <RecFrame src={o.src} rate={rate} keys={[{ t: 0, x: 0.5, y: 0.5, s: 1.05 }, { t: 1.2, x: fx, y: fy, s: 2.3 }]} />
            {o.callouts.map((c, i) => (
              <Callout key={i} at={c.at} x={1300} y={240 + i * 200} w={540} color={c.color} title={c.title} dark={c.dark}>{c.body}</Callout>
            ))}
          </AbsoluteFill>
        </Sequence>
      </AbsoluteFill>
    );
  };
  return Comp;
};

/* ---------- a title sequence with some energy ---------- */
const TITLE = "Field-to-Fix";
export const TitleV2: React.FC = () => {
  const t = sec();
  const { fps } = useVideoConfig();
  const logo = useIn(0.15, 9);
  const ring = interpolate(t, [0.4, 1.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lines: [string, string][] = [["Dealers file it.", C.orange], ["Car makers approve it.", "#8AB4F8"], ["Suppliers solve it.", "#81C995"]];
  const sweep = interpolate(t, [1.3, 2.4], [-30, 130], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const credit = useIn(3.8);
  return (
    <AbsoluteFill style={{ background: "#0B0F17", fontFamily, overflow: "hidden" }}>
      {[[C.amber, 0.25, 0.3, 0], [C.blue, 0.75, 0.65, 2], ["#34A853", 0.55, 0.15, 4]].map(([col, x, y, ph], i) => (
        <div key={i} style={{ position: "absolute", width: 900, height: 900, borderRadius: 450, background: col as string, opacity: 0.22, filter: "blur(140px)",
          left: (x as number) * 1920 - 450 + Math.sin(t * 0.6 + (ph as number)) * 80, top: (y as number) * 1080 - 450 + Math.cos(t * 0.5 + (ph as number)) * 60 }} />
      ))}
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.06), transparent 60%)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
          <div style={{ position: "relative", transform: `scale(${0.3 + 0.7 * logo}) rotate(${(1 - logo) * -25}deg)`, opacity: logo }}>
            <div style={{ position: "absolute", left: -30, top: -30, width: 220, height: 220, borderRadius: 60, border: `3px solid ${C.amber}`,
              opacity: 1 - ring, transform: `scale(${0.8 + ring * 0.6})` }} />
            <Logo size={160} />
          </div>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 700, color: "#FFFFFF", letterSpacing: -3, position: "relative" }}>
            {TITLE.split("").map((ch, i) => {
              const p = Math.max(0, Math.min(1, (t - 0.45 - i * 0.045) * 4));
              return <span key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 50}px)`, display: "inline-block" }}>{ch}</span>;
            })}
            <span style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%)",
              backgroundSize: "300% 100%", backgroundPosition: `${100 - sweep}% 0`, mixBlendMode: "overlay" }} />
          </div>
        </div>
        <div style={{ marginTop: 56, display: "flex", gap: 34, fontSize: 54, fontWeight: 500 }}>
          {lines.map(([l, col], i) => {
            const p = useIn(1.7 + i * 0.75, 12);
            return <span key={l} style={{ color: col, opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${0.9 + 0.1 * p})`, display: "inline-block" }}>{l}</span>;
          })}
        </div>
        <div style={{ marginTop: 60, display: "flex", gap: 18, opacity: credit, transform: `translateY(${(1 - credit) * 16}px)` }}>
          <span style={{ fontSize: 26, color: "#E8EAED", padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.06)" }}>
            Google Cloud AI Builder Cup 2026 · Manufacturing</span>
          <span style={{ fontSize: 26, color: "#E8EAED", padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.06)" }}>
            Deep Mandlik · Pranali Shinde</span>
        </div>
      </AbsoluteFill>
      <div style={{ display: "none" }}>{fps}</div>
    </AbsoluteFill>
  );
};

/* ---------- close with the new line ---------- */
export const CloseV2: React.FC = () => {
  const l = useIn(0.3, 12), q = useIn(1.4), u = useIn(2.6);
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <KenBurns src="broll-factory.jpg" from={[1.1, 0.5, 0.5]} to={[1.22, 0.6, 0.5]} dim={0.66} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: l, transform: `scale(${0.8 + 0.2 * l})` }}>
          <Logo size={130} /><div style={{ fontSize: 110, fontWeight: 700 }}>Field-to-Fix</div>
        </div>
        <div style={{ fontSize: 50, marginTop: 34, color: "#FFFFFF", opacity: q, transform: `translateY(${(1 - q) * 20}px)` }}>
          So you never have to hear <span style={{ color: C.yellow }}>“failed to fix.”</span></div>
        <div style={{ marginTop: 46, fontSize: 32, padding: "14px 32px", borderRadius: 999, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.35)", opacity: u }}>
          Try it live · f2f-web-lc64mw36wq-as.a.run.app</div>
        <div style={{ marginTop: 22, fontSize: 26, color: "#BDC1C6", opacity: u }}>Deep Mandlik · Pranali Shinde · Google Cloud AI Builder Cup 2026</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
