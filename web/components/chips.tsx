"use client";

import { STATUS_LABEL } from "@/lib/data";

export function StatusChip({ status }: { status: string }) {
  const tone = status === "closed" ? "green" : status === "dismissed" ? "" : ["sqe_review", "supplier_responded"].includes(status) ? "amber" : status === "investigating" ? "blue" : "";
  return <span className={`chip ${tone}`}>{STATUS_LABEL[status] ?? status}</span>;
}
export function LevelChip({ level, growth }: { level: string; growth?: number }) {
  const tone = level === "critical" ? "red" : level === "warning" ? "amber" : "";
  return <span className={`chip ${tone}`}>{growth != null ? `${growth >= 10 ? Math.round(growth) : growth.toFixed(1)}× baseline` : level}</span>;
}
