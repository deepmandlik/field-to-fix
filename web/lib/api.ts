import { auth } from "./firebase";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function actingRole(): string | null {
  try { return localStorage.getItem("f2f.actingRole"); } catch { return null; }
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const act = actingRole();
  if (act) headers["X-Act-As"] = act;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(init.json);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch {}
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  const type = res.headers.get("content-type") || "";
  return (type.includes("application/json") ? res.json() : (res.blob() as unknown)) as T;
}

export async function uploadFile(file: File): Promise<string> {
  const { upload_url, gs_uri } = await api<{ upload_url: string; gs_uri: string }>("/uploads/sign", {
    method: "POST", json: { filename: file.name, content_type: file.type || "application/octet-stream" },
  });
  const put = await fetch(upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
  if (!put.ok) throw new Error("Upload failed. Check the bucket CORS settings.");
  return gs_uri;
}

export async function downloadPdf(caseId: string) {
  const blob = await api<Blob>(`/cases/${caseId}/8d.pdf`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${caseId}-8D.pdf`; a.click();
  URL.revokeObjectURL(url);
}
