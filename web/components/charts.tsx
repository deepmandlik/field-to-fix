"use client";

import { useEffect, useRef, useState } from "react";

/** Measure the element so charts draw at their real pixel size and fill whatever space the card gives them. */
function useBox(minH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 600, h: minH });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(160, Math.round(e.contentRect.width));
      const h = Math.max(minH, Math.round(e.contentRect.height));
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [minH]);
  return { ref, ...box };
}

/* Small SVG charts drawn to scale from one linear scale per axis. Colors come from theme tokens. */
export const PALETTE = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];

function niceMax(v: number) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return <div className="legend">{items.map((i) => <span key={i.name}><i style={{ background: i.color }} />{i.name}</span>)}</div>;
}

/** Stacked area over weeks. series[i].values all share `labels`. */
export function StackedArea({ series, labels, height = 220, highlight }: {
  series: { name: string; values: number[] }[]; labels: string[]; height?: number; highlight?: string;
}) {
  const box = useBox(height);
  const W = box.w, H = box.h, L = 34, R = 8, T = 10, B = 24;
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0));
  const max = niceMax(Math.max(...totals, 1));
  const x = (i: number) => L + (i / Math.max(n - 1, 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, max / 2, max];
  const acc = new Array(n).fill(0);
  const layers = series.map((s, si) => {
    const lo = acc.slice();
    s.values.forEach((v, i) => (acc[i] += v || 0));
    const hi = acc.slice();
    const d = `M${hi.map((v, i) => `${x(i)},${y(v)}`).join(" L")} L${lo.map((v, i) => `${x(n - 1 - i)},${y(lo[n - 1 - i])}`).join(" L")} Z`;
    const color = PALETTE[si % PALETTE.length];
    const dim = highlight && s.name !== highlight;
    return <path key={s.name} d={d} fill={color} opacity={dim ? 0.25 : 0.85} stroke="var(--surface)" strokeWidth={0.5} />;
  });
  return (
    <div className="stack fill" style={{ gap: 8 }}>
      <div ref={box.ref} className="chart-box" style={{ minHeight: height }}>
      <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Claims per week by category">
        {ticks.map((t) => <g key={t}><line className="grid-line" x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text></g>)}
        {layers}
        {labels.map((l, i) => (i % (W < 420 ? 5 : 3) === 0 || i === n - 1) && <text key={i} x={x(i)} y={H - 6} textAnchor={i === n - 1 ? "end" : "middle"}>{l}</text>)}
      </svg>
      </div>
      <Legend items={series.map((s, i) => ({ name: s.name, color: PALETTE[i % PALETTE.length] }))} />
    </div>
  );
}

/** Vertical columns, e.g. claims per week or a mileage histogram. */
export function Columns({ data, height = 180, color = "var(--c1)", hotFrom }: {
  data: { name: string; value: number }[]; height?: number; color?: string; hotFrom?: number; width?: number;
}) {
  const box = useBox(height);
  const W = box.w, H = box.h, L = 30, R = 6, T = 10, B = 24;
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const bw = (W - L - R) / Math.max(data.length, 1);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const every = bw < 34 ? Math.ceil(34 / bw) : 1;
  return (
    <div ref={box.ref} className="chart-box fill" style={{ minHeight: height }}>
    <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Column chart">
      {[0, max / 2, max].map((t) => <g key={t}><line className="grid-line" x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text></g>)}
      {data.map((d, i) => (
        <g key={d.name}>
          <rect x={L + i * bw + bw * 0.15} y={y(d.value)} width={bw * 0.7} height={Math.max(0, y(0) - y(d.value))} rx={3}
            fill={hotFrom != null && i >= hotFrom ? "var(--red)" : color}><title>{`${d.name}: ${d.value}`}</title></rect>
          {(i % every === 0 || i === data.length - 1) && <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle">{d.name}</text>}
        </g>
      ))}
    </svg>
    </div>
  );
}

export function Donut({ data, size = 150, center }: { data: { name: string; value: number }[]; size?: number; center?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 52, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="row wrap" style={{ gap: 18, justifyContent: "center" }}>
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Share chart">
        <circle cx={70} cy={70} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={18} />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = <circle key={d.name} cx={70} cy={70} r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={18}
            strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 70 70)"><title>{`${d.name}: ${d.value}`}</title></circle>;
          off += len;
          return el;
        })}
        <text x={70} y={68} textAnchor="middle" style={{ fontSize: 22, fill: "var(--ink)" }}>{center ?? total}</text>
        <text x={70} y={86} textAnchor="middle" style={{ fontSize: 10 }}>total</text>
      </svg>
      <div className="stack" style={{ gap: 6 }}>
        {data.map((d, i) => (
          <div key={d.name} className="row small"><i style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length] }} />
            <span className="grow">{d.name}</span><b className="num">{Math.round((d.value / total) * 100)}%</b></div>
        ))}
      </div>
    </div>
  );
}

export function BarList({ data, format = (v: number) => v.toLocaleString(), hot, fill }: {
  data: { name: string; value: number; sub?: string }[]; format?: (v: number) => string; hot?: (name: string) => boolean; fill?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={`barlist ${fill ? "fill" : ""}`}>
      {data.map((d) => (
        <div key={d.name} className="br">
          <span>{d.name}{d.sub && <span className="faint"> · {d.sub}</span>}</span><b className="num">{format(d.value)}</b>
          <span className="track"><i className={hot?.(d.name) ? "hot" : ""} style={{ width: `${(d.value / max) * 100}%` }} /></span>
        </div>
      ))}
    </div>
  );
}

export function Spark({ data, level, w = 120, h = 32 }: { data: number[]; level?: string; w?: number; h?: number }) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (w - 4) + 2, h - 3 - (v / max) * (h - 6)]);
  const color = level === "critical" ? "var(--red)" : level === "warning" ? "var(--fb-orange)" : "var(--c1)";
  const line = pts.map((p) => p.join(",")).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Weekly claims, latest ${data[data.length - 1]}`}>
      <polygon points={`2,${h - 2} ${line} ${w - 2},${h - 2}`} fill={color} opacity={0.12} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  );
}

export function Stat({ label, value, sub, pct, hot }: { label: string; value: React.ReactNode; sub?: React.ReactNode; pct?: number; hot?: boolean }) {
  return (
    <div className={`card stat ${hot ? "hot" : ""}`}>
      <span className="label">{label}</span>
      <span className="v">{value}</span>
      {sub && <span className="d">{sub}</span>}
      {pct != null && <span className="bar"><i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></span>}
    </div>
  );
}
