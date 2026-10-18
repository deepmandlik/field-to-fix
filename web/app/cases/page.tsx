"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BarList, Spark, StackedArea, Stat } from "@/components/charts";
import { api } from "@/lib/api";
import { LevelChip, StatusChip } from "@/components/chips";
import { fmtTime, inr, useCases, useSummary } from "@/lib/data";
import { persona, useSession } from "@/lib/session";

const FILTERS = [
  { id: "priority", label: "Needs attention", test: (c: any) => !["closed", "dismissed"].includes(c.status) && c.level !== "watch" },
  { id: "review", label: "Awaiting SQE", test: (c: any) => ["sqe_review", "supplier_responded"].includes(c.status) },
  { id: "open", label: "All open", test: (c: any) => !["closed", "dismissed"].includes(c.status) },
  { id: "all", label: "All", test: () => true },
];
const PAGE = 6;

export default function Cases() {
  const { role } = useSession();
  const router = useRouter();
  const cases = useCases();
  const s = useSummary();
  const [filter, setFilter] = useState(role === "sqe" ? "review" : "priority");
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [scan, setScan] = useState<{ busy: boolean; msg?: string; err?: string }>({ busy: false });

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const rank = (c: any) => (c.growth_x ?? 1) * (c.severity ?? 1);
    return (cases ?? []).filter(f.test).filter((c) => !q || `${c.title} ${c.id} ${c.supplier_name ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => rank(b) - rank(a));
  }, [cases, filter, q]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const rows = shown.slice(page * PAGE, page * PAGE + PAGE);
  const open = (cases ?? []).filter((c) => !["closed", "dismissed"].includes(c.status));
  const hotCat = s?.weekly?.[0]?.name;

  async function runScan() {
    setScan({ busy: true });
    try {
      const r = await api<any>("/signal/run", { method: "POST" });
      setScan({ busy: false, msg: `Scanned ${r.claims} claims · ${r.clusters} clusters · ${r.cases.length} active cases` });
    } catch (e: any) { setScan({ busy: false, err: e.message }); }
  }

  return (
    <>
      <div className="page-head">
        <div className="grow"><span className="label">{persona(role).name} · {persona(role).title}</span>
          <h1>{role === "sqe" ? "Cases for supplier quality" : "Failure cases"}</h1>
          <p>Every row is a cluster of warranty claims the Signal agent grouped by meaning, ranked by how fast it is growing and how severe it is.</p></div>
        {role === "analyst" && <button className="btn" onClick={runScan} disabled={scan.busy}>{scan.busy ? <><span className="spin" /> Scanning…</> : "Run signal scan"}</button>}
      </div>
      {scan.msg && <div className="notice">{scan.msg}</div>}
      {scan.err && <div className="error">{scan.err}</div>}

      <div className="grid g4 eq">
        <Stat label="Open cases" value={open.length} sub={`${open.filter((c) => c.level === "critical").length} critical · ${open.filter((c) => c.level === "warning").length} warning`} />
        <Stat label="Claims in open cases" value={open.reduce((n, c) => n + (c.count ?? 0), 0)} sub={`of ${s?.claims ?? "—"} claims in 120 days`} />
        <Stat label="Awaiting SQE" value={(cases ?? []).filter((c) => ["sqe_review", "supplier_responded"].includes(c.status)).length} sub="8D drafts and supplier replies" />
        <Stat label="Warranty cost, 120 days" value={s ? inr(s.cost_inr) : "—"} sub="all categories" />
      </div>

      <div className="grid g-2-1">
        <div className="card card-pad stack">
          <div className="row"><h3 className="grow">Claims per week by category</h3><span className="faint small">last 16 weeks</span></div>
          {s ? <StackedArea series={s.weekly} labels={s.week_labels} height={240} /> : <div className="empty fill">Loading…</div>}
        </div>
        <div className="card card-pad stack">
          <h3>Claims by category</h3>
          <BarList fill data={(s?.by_category ?? []).map((c: any) => ({ name: c.name, value: c.claims }))} hot={(n) => n === "Coolant hose"} />
          <span className="faint small">Most common is not most urgent: coolant hose is mid-table by volume but growing {Math.round((cases ?? []).find((c) => c.id === "F2F-0141")?.growth_x ?? 0)}× faster than baseline.{hotCat ? "" : ""}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ flexWrap: "wrap" }}>
          <div className="tabs grow" role="tablist" style={{ borderBottom: 0 }}>
            {FILTERS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setPage(0); }}>
                {f.label} <span className="faint">{(cases ?? []).filter(f.test).length}</span></button>))}
          </div>
          <input id="case-search" className="input" style={{ width: 220, height: 36 }} placeholder="Search cases" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <div className="table-wrap"><table className="t">
          <thead><tr><th style={{ width: 8 }} /><th>Case</th><th>Trend (12 wk)</th><th>Claims</th><th>Growth</th><th>Supplier</th><th>Status</th><th>Next</th><th>Updated</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => router.push(`/case/${c.id}`)}>
                <td><span className={`sev ${c.level}`} /></td>
                <td><b style={{ fontWeight: 500 }}>{c.title}</b><div className="faint small mono">{c.id}</div></td>
                <td><Spark data={c.weekly} level={c.level} w={100} h={28} /></td>
                <td className="num">{c.count}{c.new_claims?.length ? <span className="chip amber" style={{ marginLeft: 6 }}>+{c.new_claims.length} new</span> : null}</td>
                <td><LevelChip level={c.level} growth={c.growth_x} /></td>
                <td className="small">{c.supplier_name ?? <span className="faint">not traced</span>}</td>
                <td><StatusChip status={c.status} /></td>
                <td className="small muted">{c.status === "detected" ? "Investigate" : c.status === "sqe_review" ? "Approve 8D" : c.status === "sent_to_supplier" ? "Supplier" : c.status === "supplier_responded" ? "Review reply" : "—"}</td>
                <td className="small faint">{fmtTime(c.updated_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9}><div className="empty">No cases in this view.</div></td></tr>}
          </tbody>
        </table></div>
        <div className="pager">
          <span>{shown.length ? `${page * PAGE + 1}–${Math.min(shown.length, page * PAGE + PAGE)} of ${shown.length}` : "0"}</span>
          <button className="icon-btn" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page">‹</button>
          <button className="icon-btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page">›</button>
        </div>
      </div>
    </>
  );
}
