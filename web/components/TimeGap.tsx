"use client";

/** Traditional warranty-to-countermeasure timeline vs Field-to-Fix, drawn on one day scale. */
export function TimeGap({ investigationSeconds, linkSeconds }: { investigationSeconds?: number; linkSeconds?: number }) {
  // Industry baseline (McKinsey survey of OEM quality leaders): ~7 weeks to confirmed root cause,
  // then 9-10 weeks to deploy countermeasures. Detection lag from monthly warranty review is shown separately.
  const trad = [
    { name: "Waiting for monthly review", days: 21, color: "var(--c6)" },
    { name: "Root cause: ~7 weeks", days: 49, color: "var(--fb-orange)" },
    { name: "Countermeasure: ~9–10 weeks", days: 66, color: "var(--red)" },
  ];
  const total = trad.reduce((s, x) => s + x.days, 0);
  const inv = investigationSeconds ?? 90;
  const link = linkSeconds ?? 6;
  const f2f = [
    { name: `Claim linked · ${link.toFixed(0)} s`, days: 0.6, color: "var(--c2)" },
    { name: `Agents investigate · ${Math.round(inv)} s`, days: 0.6, color: "var(--c1)" },
    { name: "SQE approves 8D · same day", days: 1.2, color: "var(--green)" },
  ];
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="gap-row">
        <span><b style={{ fontWeight: 500 }}>Today</b><br /><span className="faint small">industry baseline</span></span>
        <div className="gap-track">{trad.map((t) => <span key={t.name} title={t.name} style={{ width: `${(t.days / total) * 100}%`, background: t.color }}>{t.name}</span>)}</div>
        <b className="num" style={{ textAlign: "right" }}>~{Math.round(total / 7)} weeks</b>
      </div>
      <div className="gap-row">
        <span><b style={{ fontWeight: 500 }}>Field-to-Fix</b><br /><span className="faint small">measured here</span></span>
        <div className="gap-track">{f2f.map((t) => <span key={t.name} title={t.name} style={{ width: `${(t.days / total) * 100}%`, minWidth: 6, background: t.color }} />)}
          <span style={{ color: "var(--ink)", padding: "0 10px", border: 0 }}>claim → linked → investigated → 8D sent, within a day</span></div>
        <b className="num" style={{ textAlign: "right", color: "var(--green)" }}>&lt; 1 day</b>
      </div>
      <p className="faint small">Baseline: McKinsey survey of OEM quality leaders (~7 weeks to confirmed root cause, 9–10 weeks to countermeasures); review wait is an assumed monthly cycle. The Field-to-Fix bar ends when the 8D reaches the supplier; the supplier's own fix time comes after.</p>
    </div>
  );
}
