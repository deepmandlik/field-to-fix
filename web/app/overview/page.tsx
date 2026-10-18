"use client";

import { useRouter } from "next/navigation";
import { LevelChip, StatusChip } from "@/components/chips";
import { BarList, Donut, StackedArea, Stat } from "@/components/charts";
import { TimeGap } from "@/components/TimeGap";
import { STATUS_LABEL, STATUS_ORDER, inr, useCases, useSummary } from "@/lib/data";

const LANG: Record<string, string> = { en: "English", hi: "Hindi", id: "Bahasa" };

export default function Overview() {
  const router = useRouter();
  const cases = useCases() ?? [];
  const s = useSummary();
  const active = cases.filter((c) => !["closed", "dismissed"].includes(c.status));
  const atRisk = cases.filter((c) => c.status !== "dismissed").reduce((n, c) => n + (c.trace?.other_models_at_risk ?? []).reduce((m: number, x: any) => m + x.vins_at_risk, 0), 0);
  const inv = cases.filter((c) => c.investigation_seconds).map((c) => c.investigation_seconds);
  const avgInv = inv.length ? Math.round(inv.reduce((a, b) => a + b, 0) / inv.length) : null;
  const funnel = STATUS_ORDER.map((st) => ({ name: STATUS_LABEL[st], value: cases.filter((c) => c.status === st).length }));
  const top = [...active].sort((a, b) => (b.growth_x ?? 0) * (b.severity ?? 1) - (a.growth_x ?? 0) * (a.severity ?? 1)).slice(0, 5);

  return (
    <>
      <div className="page-head"><div className="grow">
        <span className="label">Step 5 · Meera Shah · Head of quality</span>
        <h1>Warranty quality overview</h1>
        <p>The whole network on one page: what is failing, what it costs, and how fast problems reach the supplier.</p>
      </div></div>

      <div className="grid g4 eq">
        <Stat label="Warranty claims, 30 days" value={s?.claims_30d ?? "—"} sub={`${s?.claims ?? "—"} in 120 days, all read by AI`} />
        <Stat label="Warranty cost, 120 days" value={s ? inr(s.cost_inr) : "—"} sub="dealer claims paid" />
        <Stat label="Open failure cases" value={active.length} sub={`${active.filter((c) => c.level === "critical").length} critical · ${cases.filter((c) => c.status === "closed").length} closed`} hot={active.some((c) => c.level === "critical")} />
        <Stat label="Agent investigation time" value={avgInv ? `${avgInv}s` : "—"} sub="from click to cited 8D draft" />
      </div>

      <div className="grid g-2-1">
        <div className="card card-pad stack"><div className="row"><h3 className="grow">Claims per week by category</h3><span className="faint small">last 16 weeks</span></div>
          {s ? <StackedArea series={s.weekly} labels={s.week_labels} height={240} /> : <div className="empty">Loading…</div>}</div>
        <div className="card card-pad stack"><h3>Cost by category</h3>
          <BarList fill data={(s?.by_category ?? []).map((c: any) => ({ name: c.name, value: c.cost_inr }))} format={(v) => inr(v)} hot={(n) => n === "Coolant hose"} /></div>
      </div>

      <div className="grid g3">
        <div className="card card-pad stack"><h3>Case funnel</h3><BarList fill data={funnel} /><span className="faint small">Where open cases sit in the 8D workflow.</span></div>
        <div className="card card-pad stack"><h3>Claim languages</h3><div className="fill center"><Donut data={(s?.languages ?? []).map((l: any) => ({ name: LANG[l.name] ?? l.name, value: l.value }))} /></div></div>
        <div className="card card-pad stack"><h3>Exposure</h3>
          <div className="stat" style={{ padding: 0 }}><span className="v" style={{ color: "var(--red)" }}>{atRisk.toLocaleString()}</span>
            <span className="d">vehicles carry a suspect batch but have not failed yet. Flag them for inspection at next service.</span></div>
          <BarList fill data={cases.flatMap((c) => (c.trace?.other_models_at_risk ?? []).map((m: any) => ({ name: m.model, value: m.vins_at_risk, sub: c.trace?.part_name })))
            .concat(cases.filter((c) => c.trace).map((c) => ({ name: c.trace.models?.[0]?.id ?? "—", value: c.trace.vins, sub: "already failed" })))} hot={() => true} />
        </div>
      </div>

      <div className="card card-pad stack"><h3>Time from first claims to an 8D at the supplier</h3><TimeGap investigationSeconds={avgInv ?? undefined} /></div>

      <div className="card">
        <div className="card-head"><h3>Top cases</h3><button className="btn text sm" onClick={() => router.push("/cases")}>All cases</button></div>
        <div className="table-wrap"><table className="t">
          <thead><tr><th style={{ width: 8 }} /><th>Case</th><th>Claims</th><th>Growth</th><th>Supplier</th><th>Status</th></tr></thead>
          <tbody>{top.map((c) => (
            <tr key={c.id} onClick={() => router.push(`/case/${c.id}`)}>
              <td><span className={`sev ${c.level}`} /></td><td><b style={{ fontWeight: 500 }}>{c.title}</b><div className="faint small mono">{c.id}</div></td>
              <td className="num">{c.count}</td><td><LevelChip level={c.level} growth={c.growth_x} /></td>
              <td className="small">{c.supplier_name ?? <span className="faint">not traced</span>}</td><td><StatusChip status={c.status} /></td></tr>))}</tbody>
        </table></div>
      </div>
    </>
  );
}
