"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCases, useSummary } from "@/lib/data";
import { PERSONAS, persona, useSession, type Role } from "@/lib/session";
import { Avatar, DemoGuide, PageHelp, Welcome, useActAs } from "./Guide";
import { IChart, IClaim, ICases, IClose, ILogout, IMenu, IStart, ISupplier, ISwitch } from "./icons";
import { Logo } from "./Logo";

type Item = { href: string; label: string; icon: React.ReactNode; roles: Role[]; count?: "open" | "review" | "supplier" };
const NAV: Item[] = [
  { href: "/claim", label: "File a claim", icon: <IClaim className="ico" />, roles: ["dealer"] },
  { href: "/cases", label: "Cases", icon: <ICases className="ico" />, roles: ["analyst", "sqe", "exec"], count: "open" },
  { href: "/supplier", label: "8D requests", icon: <ISupplier className="ico" />, roles: ["supplier"], count: "supplier" },
  { href: "/overview", label: "Quality overview", icon: <IChart className="ico" />, roles: ["analyst", "sqe", "exec"] },
];
const TITLES: [string, string][] = [["/watch", "On your watch"], ["/start", "Start here"], ["/claim", "File a claim"], ["/cases", "Cases"], ["/case/", "Case"], ["/supplier", "8D requests"], ["/overview", "Quality overview"]];

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useSession();
  const path = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const cases = useCases();
  const summary = useSummary();

  useEffect(() => { if (!loading && !user && path !== "/login") router.replace("/login"); }, [loading, user, path, router]);
  useEffect(() => setNavOpen(false), [path]);

  if (path === "/login") return <>{children}</>;
  if (path === "/w") return user ? <>{children}</> : <div className="empty">Loading…</div>;
  if (!user) return <div className="empty" style={{ paddingTop: "30vh" }}>Loading…</div>;

  const open = cases?.filter((c) => !["closed", "dismissed"].includes(c.status)).length ?? 0;
  const critical = cases?.filter((c) => c.level === "critical" && !["closed", "dismissed"].includes(c.status)).length ?? 0;
  const supplierOpen = cases?.filter((c) => c.supplier_id === "S-KAV" && c.status === "sent_to_supplier").length ?? 0;
  const title = TITLES.find(([p]) => path.startsWith(p))?.[1] ?? "";

  return (
    <div className="shell">
      <nav className={`sidebar ${navOpen ? "open" : ""}`} aria-label="Main">
        <div className="row"><Link href="/start" className="brand grow"><Logo /></Link>
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(false)} aria-label="Close menu"><IClose /></button></div>
        <Link href="/start" className="nav-item" aria-current={path.startsWith("/start") ? "page" : undefined}><IStart className="ico" />Start here</Link>
        <div className="nav-group">
          <div className="nav-title">{persona(role).title}</div>
          {NAV.filter((n) => n.roles.includes(role)).map((n) => (
            <Link key={n.href} href={n.href} className="nav-item" aria-current={path.startsWith(n.href) || (n.href === "/cases" && path.startsWith("/case/")) ? "page" : undefined}>
              {n.icon}{n.label}
              {n.count === "open" && <span className={`count ${critical ? "hot" : ""}`}>{critical ? `${critical} critical` : open}</span>}
              {n.count === "supplier" && supplierOpen > 0 && <span className="count hot">{supplierOpen} new</span>}
            </Link>
          ))}
        </div>
        <div className="nav-group">
          <div className="nav-title">Everywhere</div>
          <Link href="/watch" className="nav-item" aria-current={path.startsWith("/watch") ? "page" : undefined}><span className="ico" aria-hidden="true">⌚</span>On your watch</Link>
        </div>
        <div className="nav-group">
          <div className="nav-title">Data</div>
          <div className="nav-item" style={{ cursor: "default" }}><span className="ico" aria-hidden="true">▤</span>BigQuery · {summary?.claims ?? "…"} claims</div>
          <div className="nav-item" style={{ cursor: "default" }}><span className="ico" aria-hidden="true">✦</span>Gemini 2.5 · Vertex AI</div>
        </div>
        <div className="side-foot">
          <div className="plan-chip card" style={{ boxShadow: "none", background: "var(--surface-2)" }}>
            <span><b style={{ fontWeight: 500 }}>Demo data</b><br /><span className="faint small">Synthetic · asia-southeast1</span></span>
            <span className="chip green"><span className="dot" />Live</span>
          </div>
        </div>
      </nav>
      {navOpen && <div className="scrim" style={{ zIndex: 19, background: "rgba(0,0,0,.3)" }} onClick={() => setNavOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu"><IMenu /></button>
          <div className="crumb"><span>field-to-fix</span><span className="sep">›</span><span className="muted">{title}</span></div>
          <span className="grow" />
          <PageHelp />
          <AccountMenu />
        </header>
        <div className="content">{children}</div>
      </div>
      <DemoGuide />
      <Welcome />
    </div>
  );
}

function AccountMenu() {
  const { user, role, isDemo, logout } = useSession();
  const act = useActAs();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const p = persona(role);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="row" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Account menu"
        style={{ border: 0, background: "none", cursor: "pointer", gap: 10, padding: "4px 4px 4px 12px", borderRadius: 999 }}>
        <span className="small hide-sm" style={{ textAlign: "right", lineHeight: 1.25 }}><b style={{ fontWeight: 500 }}>{p.name}</b><br /><span className="faint">{p.title}</span></span>
        <Avatar role={role} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="who">
            <span className="avatar" style={{ width: 64, height: 64, fontSize: 22, background: p.color }}>{p.initials}</span>
            <div><b style={{ fontWeight: 500, fontSize: 16 }}>{p.name}</b><div className="muted small">{p.title} · {p.org}</div>
              <div className="faint small">{user?.email}</div></div>
          </div>
          {isDemo && <>
            <div className="label" style={{ padding: "4px 10px" }}><ISwitch size={14} /> Switch role · in story order</div>
            {PERSONAS.map((x) => (
              <button key={x.id} className="persona" aria-current={x.id === role} onClick={() => { setOpen(false); act(x.id); }}>
                <span className="avatar sm" style={{ background: x.color }}>{x.initials}</span>
                <span><b style={{ fontWeight: 500 }}>{x.name}</b><small>{x.title} · {x.org}</small></span>
                <span className="ord">{x.step}</span>
              </button>
            ))}
          </>}
          <div style={{ borderTop: "1px solid var(--line)", margin: "6px 0" }} />
          <button className="persona" onClick={() => logout().then(() => router.replace("/login"))}><ISwitch />Use a different account</button>
          <button className="persona" onClick={() => logout().then(() => router.replace("/login"))}><ILogout />Sign out</button>
        </div>
      )}
    </div>
  );
}
