import { loadFont } from "@remotion/google-fonts/Roboto";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const { fontFamily } = loadFont("normal", { weights: ["300", "400", "500", "700"] });

export const C = {
  bg: "#F8FAFD", surface: "#FFFFFF", ink: "#1F1F1F", muted: "#444746", faint: "#747775", line: "#E1E3E1",
  blue: "#0B57D0", blueSoft: "#D3E3FD", blueInk: "#041E49", amber: "#FFA000", orange: "#F57C00", yellow: "#FFCA28",
  red: "#B3261E", green: "#188038", purple: "#9334E6", teal: "#12B5CB", dark: "#131314", darkInk: "#E3E3E3",
};

export const LEAD = 0.4; // seconds of silence before the voiceover starts in each scene

/** Spring that starts `delay` seconds into the scene. */
export function useIn(delay = 0, damping = 200) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay * fps, fps, config: { damping } });
}

/** Whole-scene fade in/out so cuts feel smooth. */
export const SceneFade: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = C.bg }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o = interpolate(f, [0, 10, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: bg, fontFamily, opacity: o }}>{children}</AbsoluteFill>;
};

/** Slow pan/zoom across a still, like a camera move. */
export const KenBurns: React.FC<{ src: string; from?: [number, number, number]; to?: [number, number, number]; dim?: number }> = ({ src, from = [1.12, 0.5, 0.5], to = [1.25, 0.55, 0.45], dim = 0 }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(f, [0, durationInFrames], [0, 1], { easing: Easing.inOut(Easing.quad) });
  const s = from[0] + (to[0] - from[0]) * t;
  const x = from[1] + (to[1] - from[1]) * t;
  const y = from[2] + (to[2] - from[2]) * t;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${s}) translate(${(0.5 - x) * 100}%, ${(0.5 - y) * 100}%)` }} />
      {dim > 0 && <AbsoluteFill style={{ background: `rgba(10,12,16,${dim})` }} />}
    </AbsoluteFill>
  );
};

type Key = { t: number; x: number; y: number; s: number };
/** A browser window showing a real screenshot, with a camera that glides between focus points (t = seconds). */
export const Screen: React.FC<{ src: string; keys: Key[]; width?: number; left?: number; top?: number; url?: string }> = ({ src, keys, width = 1500, left, top = 172, url = "f2f-web-lc64mw36wq-as.a.run.app" }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = f / fps;
  const ts = keys.map((k) => k.t);
  const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const s = keys.length > 1 ? interpolate(sec, ts, keys.map((k) => k.s), ease) : keys[0].s;
  let x = keys.length > 1 ? interpolate(sec, ts, keys.map((k) => k.x), ease) : keys[0].x;
  let y = keys.length > 1 ? interpolate(sec, ts, keys.map((k) => k.y), ease) : keys[0].y;
  x = Math.min(Math.max(x, 0.5 / s), 1 - 0.5 / s);
  y = Math.min(Math.max(y, 0.5 / s), 1 - 0.5 / s);
  const h = width * 0.625;
  const enter = useIn(0);
  return (
    <div style={{ position: "absolute", left: left ?? (1920 - width) / 2, top, width, borderRadius: 18, overflow: "hidden", background: C.surface,
      boxShadow: "0 30px 80px rgba(32,33,36,0.28)", border: `1px solid ${C.line}`, transform: `translateY(${(1 - enter) * 40}px)`, opacity: enter }}>
      <div style={{ height: 44, background: "#F1F3F4", display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: `1px solid ${C.line}` }}>
        {["#F28B82", "#FDD663", "#81C995"].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
        <span style={{ marginLeft: 18, flex: 1, height: 28, borderRadius: 14, background: "#FFFFFF", color: C.faint, fontSize: 17, display: "flex", alignItems: "center", padding: "0 16px" }}>{url}</span>
      </div>
      <div style={{ width, height: h, overflow: "hidden", position: "relative" }}>
        <Img src={staticFile(src)} style={{ width, height: h, objectFit: "cover", transformOrigin: "50% 50%", transform: `scale(${s}) translate(${(0.5 - x) * 100}%, ${(0.5 - y) * 100}%)` }} />
      </div>
    </div>
  );
};

/** A label that pops in at `at` seconds. */
export const Callout: React.FC<{ at: number; x: number; y: number; w?: number; color?: string; title?: string; children: React.ReactNode; dark?: boolean }> = ({ at, x, y, w = 520, color = C.blue, title, children, dark }) => {
  const p = useIn(at, 14);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `scale(${0.85 + 0.15 * p}) translateY(${(1 - p) * 20}px)`, opacity: Math.min(1, p * 1.4),
      background: dark ? C.dark : C.surface, color: dark ? C.darkInk : C.ink, borderRadius: 18, padding: "18px 24px", borderLeft: `8px solid ${color}`,
      boxShadow: "0 18px 40px rgba(32,33,36,0.25)" }}>
      {title && <div style={{ fontSize: 22, fontWeight: 500, color, marginBottom: 6, letterSpacing: 0.3 }}>{title}</div>}
      <div style={{ fontSize: 30, lineHeight: 1.3, fontWeight: 500 }}>{children}</div>
    </div>
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string; at?: number; x?: number; y?: number }> = ({ children, color = C.blue, at = 0, x = 120, y = 60 }) => {
  const p = useIn(at);
  return <div style={{ position: "absolute", left: x, top: y, fontSize: 26, fontWeight: 500, letterSpacing: 4, color, opacity: p, transform: `translateX(${(1 - p) * -30}px)` }}>{children}</div>;
};

/** Captions: the scene's narration, one sentence at a time, timed by sentence length. */
export const Captions: React.FC<{ text: string; voSeconds: number; dark?: boolean }> = ({ text, voSeconds, dark }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = f / fps - LEAD;
  const parts = text.split(/(?<=[.!?])\s+/);
  const total = parts.reduce((n, p) => n + p.length, 0);
  let acc = 0;
  let current = "";
  for (const p of parts) {
    const start = (acc / total) * voSeconds;
    acc += p.length;
    const end = (acc / total) * voSeconds;
    if (sec >= start - 0.05 && sec < end + 0.25) current = p;
  }
  if (!current || sec < -0.1 || sec > voSeconds + 0.6) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 1500, background: dark ? "rgba(255,255,255,0.12)" : "rgba(19,19,20,0.78)", color: "#FFFFFF", fontSize: 32, lineHeight: 1.35,
        padding: "10px 26px", borderRadius: 14, textAlign: "center", fontFamily }}>{current}</div>
    </div>
  );
};

export const Logo: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFCA28" /><stop offset="0.55" stopColor="#FFA000" /><stop offset="1" stopColor="#F4511E" /></linearGradient></defs>
    <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#lg)" />
    <path d="M13 31c0-9 6-16 14-16h6" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    <path d="M29 10l5 5-5 5M20 31l5 5 9-10" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="13" cy="31" r="3" fill="#fff" />
  </svg>
);
