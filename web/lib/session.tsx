"use client";

import { onAuthStateChanged, signOut, type User as FbUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "./firebase";

export type Role = "dealer" | "analyst" | "sqe" | "supplier" | "exec";

/** The five people in the story, in the order a warranty problem travels between them. */
export const PERSONAS: {
  id: Role; step: number; name: string; title: string; org: string; home: string; color: string; initials: string; does: string;
}[] = [
  { id: "dealer", step: 1, name: "Ravi Kumar", title: "Service technician", org: "Pune dealership", home: "/claim", color: "#e8710a", initials: "RK",
    does: "Files the warranty claim after repairing the car, in any language." },
  { id: "analyst", step: 2, name: "Ananya Rao", title: "Warranty analyst", org: "OEM field quality", home: "/cases", color: "#1a73e8", initials: "AR",
    does: "Sees failure clusters the AI found and starts the agent investigation." },
  { id: "sqe", step: 3, name: "Kenji Sato", title: "Supplier quality engineer", org: "OEM supplier quality", home: "/cases", color: "#9334e6", initials: "KS",
    does: "Reviews the AI-drafted 8D, edits it, and sends it to the supplier." },
  { id: "supplier", step: 4, name: "Suresh Iyer", title: "Quality manager", org: "Kaveri Hoses (Tier-1)", home: "/supplier", color: "#12b5cb", initials: "SI",
    does: "Gets the evidence pack, confirms the root cause and responds with the fix." },
  { id: "exec", step: 5, name: "Meera Shah", title: "Head of quality", org: "OEM", home: "/overview", color: "#188038", initials: "MS",
    does: "Watches warranty cost, open cases and how fast problems get fixed." },
];
export const persona = (r: Role) => PERSONAS.find((p) => p.id === r)!;

type Session = {
  user: FbUser | null;
  loading: boolean;
  /** The role the API sees. The demo account can switch it; real accounts are fixed by their token claim. */
  role: Role;
  isDemo: boolean;
  setActingRole: (r: Role) => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);
const KEY = "f2f.actingRole";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimRole, setClaimRole] = useState<string>("analyst");
  const [acting, setActing] = useState<Role>("dealer");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Role | null;
      if (saved) setActing(saved);
    } catch {}
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const t = await u.getIdTokenResult();
        setClaimRole((t.claims.role as string) || "analyst");
      }
      setLoading(false);
    });
  }, []);

  const isDemo = claimRole === "demo";
  const role: Role = isDemo ? acting : (claimRole as Role);

  const setActingRole = (r: Role) => {
    setActing(r);
    try { localStorage.setItem(KEY, r); } catch {}
  };

  return (
    <Ctx.Provider value={{ user, loading, role, isDemo, setActingRole, logout: () => signOut(auth) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
