"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { auth } from "@/lib/firebase";
import { persona, useSession } from "@/lib/session";

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

export default function Login() {
  const { user, role, isDemo, setActingRole } = useSession();
  const router = useRouter();
  const [judge, setJudge] = useState(true);
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (isDemo) { setActingRole("dealer"); router.replace("/start"); }
    else router.replace(persona(role)?.home ?? "/start");
  }, [user, role, isDemo, router, setActingRole]);

  function toggleJudge(on: boolean) {
    setJudge(on);
    setEmail(on ? DEMO_EMAIL : "");
    setPassword(on ? DEMO_PASSWORD : "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch { setErr("That email and password didn't match an account."); setBusy(false); }
  }

  return (
    <main className="login-wrap">
      <section className="login-art">
        <Logo />
        <h1>From a dealer's note to a supplier fix, in days instead of months.</h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 560, lineHeight: 1.6 }}>
          Field-to-Fix reads every warranty claim in any language, finds failure clusters early, traces them to the exact
          supplier batch and drafts the 8D report — with Gemini agents on Google Cloud.
        </p>
        <div className="flow">
          <div><i>📝</i><span><b style={{ fontWeight: 500 }}>Dealer files it</b> <span className="muted">— Hindi, Bahasa or English, with a photo</span></span></div>
          <div><i>🔎</i><span><b style={{ fontWeight: 500 }}>Agents investigate</b> <span className="muted">— cluster, trace batch, check PFMEA</span></span></div>
          <div><i>📄</i><span><b style={{ fontWeight: 500 }}>OEM approves the 8D</b> <span className="muted">— every line cited</span></span></div>
          <div><i>🏭</i><span><b style={{ fontWeight: 500 }}>Supplier fixes it</b> <span className="muted">— AI checks the response</span></span></div>
        </div>
        <p className="faint small">Google Cloud AI Builder Cup 2026 · Manufacturing · Synthetic data</p>
      </section>

      <section className="card login-card">
        <div>
          <h2 style={{ fontSize: 26 }}>Sign in</h2>
          <p className="muted" style={{ marginTop: 6 }}>Use the judge demo account to see every role, or your own account.</p>
        </div>
        <label className="check notice" style={{ alignItems: "flex-start" }}>
          <input id="judge" type="checkbox" checked={judge} onChange={(e) => toggleJudge(e.target.checked)} disabled={!DEMO_EMAIL} />
          <span><b style={{ fontWeight: 500 }}>I'm a judge — use the demo account</b><br />
            <span className="small">Fills in the login. One account, five roles, with a guided walkthrough.</span></span>
        </label>
        <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
          <div className="field"><label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="field"><label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {err && <div className="error" role="alert">{err}</div>}
          <button className="btn" style={{ height: 46 }} disabled={busy}>{busy ? "Signing in…" : judge ? "Start the demo" : "Sign in"}</button>
        </form>
        <p className="faint small">Role accounts (dealer, analyst, SQE, supplier, executive) each see only their own work.</p>
      </section>
    </main>
  );
}
