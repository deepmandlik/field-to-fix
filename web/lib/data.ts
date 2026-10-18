"use client";

import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { api } from "./api";
import { db } from "./firebase";
import { useSession, type Role } from "./session";

export type Case = Record<string, any> & { id: string; title: string; status: string; level: string };

export const DEMO_CASE = "F2F-0141";

export const STATUS_ORDER = ["detected", "investigating", "sqe_review", "sent_to_supplier", "supplier_responded", "closed"];
export const STATUS_LABEL: Record<string, string> = {
  detected: "Detected", investigating: "Investigating", sqe_review: "SQE review", sent_to_supplier: "With supplier",
  supplier_responded: "Supplier responded", closed: "Closed", dismissed: "Dismissed",
};
/** Who must act next, by case status. */
export const OWNER: Record<string, Role | null> = {
  detected: "analyst", investigating: "analyst", sqe_review: "sqe", sent_to_supplier: "supplier",
  supplier_responded: "sqe", closed: "exec", dismissed: null,
};
export const NEXT_TEXT: Record<string, string> = {
  detected: "Start the agent investigation to trace this cluster to a supplier batch and draft the 8D.",
  investigating: "The agents are tracing, searching the PFMEA and drafting the 8D. Watch the log update live.",
  sqe_review: "Review the AI-drafted 8D, edit anything, then approve and send it to the supplier.",
  sent_to_supplier: "The supplier reviews the evidence pack and submits its 8D response.",
  supplier_responded: "Read the AI completeness check: if it found gaps, send the 8D back; otherwise accept and close.",
  closed: "Case closed. See the impact on the quality overview.",
  dismissed: "Dismissed as noise.",
};

export function useCases() {
  const { user } = useSession();
  const [cases, setCases] = useState<Case[] | null>(null);
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "cases"), orderBy("updated_at", "desc"));
    return onSnapshot(q, (s) => setCases(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))), () => setCases([]));
  }, [user]);
  return cases;
}

export function useCase(id: string) {
  const { user } = useSession();
  const [c, setC] = useState<Case | null | undefined>(undefined);
  const [events, setEvents] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  useEffect(() => {
    if (!user || !id) return;
    const un = [
      onSnapshot(doc(db, "cases", id), (s) => setC(s.exists() ? ({ id: s.id, ...(s.data() as any) }) : null)),
      onSnapshot(query(collection(db, "cases", id, "events"), orderBy("at")), (s) => setEvents(s.docs.map((d) => d.data()))),
      onSnapshot(query(collection(db, "cases", id, "messages"), orderBy("at")), (s) => setMessages(s.docs.map((d) => d.data()))),
    ];
    return () => un.forEach((u) => u());
  }, [id, user]);
  return { c, events, messages };
}

let summaryCache: any = null;
export function useSummary() {
  const { user } = useSession();
  const [s, setS] = useState<any>(summaryCache);
  useEffect(() => {
    if (!user) return;
    api("/analytics/summary").then((d) => { summaryCache = d; setS(d); }).catch(() => {});
  }, [user]);
  return s;
}

/** Judge story: which step is done, judged from the flagship case. */
export function storyProgress(c: Case | undefined | null) {
  const st = c?.status ?? "detected";
  const idx = STATUS_ORDER.indexOf(st);
  const done = [
    (c?.new_claims?.length ?? 0) > 0,
    idx >= 2,
    idx >= 3,
    idx >= 4,
    st === "closed" || (c?.approvals ?? []).some((a: any) => a.action === "reject_supplier"),
    false,
  ];
  const current = done.findIndex((d) => !d);
  return { done, current: current === -1 ? 5 : current };
}

export const toDate = (t: any): Date | null => (t?.toDate ? t.toDate() : t ? new Date(t) : null);
export const fmtTime = (t: any) => toDate(t)?.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) ?? "";
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const inr = (x: number) => (x >= 1e7 ? `₹${(x / 1e7).toFixed(2)} Cr` : `₹${(x / 1e5).toFixed(1)} L`);
