"use client";

import { STATUS_LABEL, STATUS_ORDER, fmtTime, toDate } from "@/lib/data";

/** State diagram of the case workflow with the visited path and the current state highlighted. */
export function Lifecycle({ status, approvals }: { status: string; approvals: any[] }) {
  const idx = STATUS_ORDER.indexOf(status);
  const visited = (s: string) => status === "closed" || STATUS_ORDER.indexOf(s) < idx;
  const loops = { evidence: approvals.some((a) => a.action === "request_evidence"), reject: approvals.some((a) => a.action === "reject_supplier") };
  const W = 470, x = 235, gap = 74, top = 40, bw = 168, bh = 38;
  const y = (i: number) => top + i * gap;
  const node = (s: string, i: number) => {
    const now = s === status, done = visited(s);
    return (
      <g key={s}>
        <rect x={x - bw / 2} y={y(i)} width={bw} height={bh} rx={12}
          fill={now ? "var(--primary-soft)" : done ? "var(--surface-2)" : "var(--surface)"}
          stroke={now || done ? "var(--primary)" : "var(--line-2)"} strokeWidth={now ? 2.5 : 1.5} />
        <text x={x} y={y(i) + 24} textAnchor="middle" style={{ fontSize: 13, fill: now ? "var(--primary-ink)" : "var(--ink)", fontWeight: now ? 500 : 400 }}>{STATUS_LABEL[s]}</text>
      </g>
    );
  };
  const edge = (i: number, label: string) => {
    const done = visited(STATUS_ORDER[i + 1]) || STATUS_ORDER[i + 1] === status;
    return (
      <g key={`e${i}`}>
        <line x1={x} x2={x} y1={y(i) + bh} y2={y(i + 1) - 4} stroke={done ? "var(--primary)" : "var(--line-2)"} strokeWidth={2} markerEnd={`url(#${done ? "arrA" : "arr"})`} />
        <text x={x + 8} y={y(i) + bh + 22} style={{ fontSize: 11 }}>{label}</text>
      </g>
    );
  };
  const labels = ["analyst: Investigate", "agents: 8D drafted", "SQE approves", "Tier-1 submits 8D", "SQE accepts"];
  const H = y(STATUS_ORDER.length - 1) + bh + 40;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Case lifecycle, currently ${STATUS_LABEL[status]}`} style={{ maxWidth: 470, margin: "0 auto" }}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--line-2)" /></marker>
        <marker id="arrA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--primary)" /></marker>
      </defs>
      <circle cx={x} cy={14} r={8} fill="var(--muted)" />
      <line x1={x} x2={x} y1={22} y2={top - 4} stroke="var(--line-2)" strokeWidth={2} markerEnd="url(#arr)" />
      {STATUS_ORDER.slice(0, -1).map((_, i) => edge(i, labels[i]))}
      {STATUS_ORDER.map(node)}
      {/* side branches */}
      <path d={`M${x + bw / 2} ${y(0) + bh / 2} H ${W - 8}`} stroke={status === "dismissed" ? "var(--primary)" : "var(--line-2)"} strokeWidth={1.5} strokeDasharray="4 4" />
      <text x={W - 4} y={y(0) + bh / 2 - 8} textAnchor="end" style={{ fontSize: 11 }}>dismissed (noise)</text>
      <path d={`M${x - bw / 2} ${y(2) + bh / 2} C ${x - bw / 2 - 56} ${y(2) + bh / 2}, ${x - bw / 2 - 56} ${y(0) + bh / 2}, ${x - bw / 2} ${y(0) + bh / 2}`}
        fill="none" stroke={loops.evidence ? "var(--fb-orange)" : "var(--line-2)"} strokeWidth={1.5} strokeDasharray="4 4" markerEnd="url(#arr)" />
      <text x={x - bw / 2 - 64} y={y(1) + 18} textAnchor="end" style={{ fontSize: 11 }}>SQE asks for</text><text x={x - bw / 2 - 64} y={y(1) + 32} textAnchor="end" style={{ fontSize: 11 }}>more evidence</text>
      <path d={`M${x + bw / 2} ${y(4) + bh / 2} C ${x + bw / 2 + 56} ${y(4) + bh / 2}, ${x + bw / 2 + 56} ${y(3) + bh / 2}, ${x + bw / 2} ${y(3) + bh / 2}`}
        fill="none" stroke={loops.reject ? "var(--fb-orange)" : "var(--line-2)"} strokeWidth={1.5} strokeDasharray="4 4" markerEnd="url(#arr)" />
      <text x={x + bw / 2 + 64} y={y(3) + bh + 20} style={{ fontSize: 11 }}>SQE sends</text><text x={x + bw / 2 + 64} y={y(3) + bh + 34} style={{ fontSize: 11 }}>back</text>
      <circle cx={x} cy={H - 16} r={9} fill="none" stroke={status === "closed" ? "var(--green)" : "var(--line-2)"} strokeWidth={2} />
      <circle cx={x} cy={H - 16} r={4.5} fill={status === "closed" ? "var(--green)" : "var(--line-2)"} />
      <line x1={x} x2={x} y1={y(5) + bh} y2={H - 28} stroke={status === "closed" ? "var(--green)" : "var(--line-2)"} strokeWidth={2} />
    </svg>
  );
}

const STAGE_OF_AGENT: Record<string, string> = { signal: "detected", intake: "detected", trace: "investigating", hypothesise: "investigating", draft_8d: "investigating", error: "investigating" };
const STAGE_OF_ACTION: Record<string, string> = { investigate: "investigating", approve: "sent_to_supplier", request_evidence: "sqe_review", dismiss: "dismissed", accept_supplier: "closed", reject_supplier: "supplier_responded" };

/** Events grouped under the lifecycle stage they belong to, as a tree. */
export function ActivityTree({ c, events }: { c: any; events: any[] }) {
  const groups: Record<string, { at: Date | null; text: string; who: string }[]> = {};
  const add = (stage: string, at: any, text: string, who: string) => (groups[stage] ??= []).push({ at: toDate(at), text, who });
  events.forEach((e) => {
    let stage = STAGE_OF_AGENT[e.agent];
    if (e.agent === "workflow") {
      const m = /→ (.+)$/.exec(e.message);
      stage = m ? m[1].trim().replace(/ /g, "_") : e.message.startsWith("Supplier responded") ? "supplier_responded" : "sqe_review";
      if (stage === "detected" && e.message.includes("evidence")) stage = "sqe_review";
    }
    if (e.message.startsWith("8D draft ready")) stage = "sqe_review";
    add(stage ?? "detected", e.at, e.message, e.agent);
  });
  (c.approvals ?? []).forEach((a: any) => add(STAGE_OF_ACTION[a.action] ?? "detected", a.at, `${a.role.toUpperCase()} · ${a.action.replace(/_/g, " ")}${a.note ? ` — ${a.note}` : ""}`, "person"));
  Object.values(groups).forEach((g) => g.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0)));
  const idx = STATUS_ORDER.indexOf(c.status);
  const stages = c.status === "dismissed" ? ["detected", "dismissed"] : STATUS_ORDER;

  return (
    <div className="tree">
      {stages.map((s, i) => {
        const state = c.status === "closed" || i < idx ? "done" : s === c.status ? "now" : "";
        const items = groups[s] ?? [];
        return (
          <div key={s} className={`tree-node ${state}`}>
            <span className="knob" aria-hidden="true" />
            <div className="row"><b style={{ fontWeight: 500 }}>{STATUS_LABEL[s]}</b>
              {state === "now" && <span className="chip blue">current</span>}<span className="faint small">{items.length ? `${items.length} event${items.length > 1 ? "s" : ""}` : ""}</span></div>
            {items.length > 0 && (
              <div className="tree-children">
                {items.map((it, j) => (
                  <div key={j} className="tree-leaf"><span className="t">{it.at ? fmtTime(it.at) : ""}</span>
                    <span className={`chip ${it.who === "person" ? "amber" : "blue"}`} style={{ height: 20 }}>{it.who === "person" ? "person" : it.who}</span><span>{it.text}</span></div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
