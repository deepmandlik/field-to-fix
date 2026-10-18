"use client";

import { useEffect, useRef, useState } from "react";
import { Stat } from "@/components/charts";
import { useActAs } from "@/components/Guide";
import { IArrow, ICheck, ILink, IUpload } from "@/components/icons";
import { TimeGap } from "@/components/TimeGap";
import { api, uploadFile } from "@/lib/api";
import { useSummary } from "@/lib/data";
import { useSession } from "@/lib/session";

const DEALER = { id: "D-PUN-01", city: "Pune" };
const BUCKET = "field-to-fix-f2f";
const PHOTOS = [
  { id: "clamp-crack", label: "Cracked clamp" },
  { id: "clamp-loose", label: "Loose clamp, coolant" },
  { id: "coolant-drip", label: "Coolant on floor" },
  { id: "screen-reboot", label: "Screen rebooting" },
  { id: "brake-pad", label: "Glazed brake pad" },
  { id: "door-seal", label: "Loose door seal" },
];
const gs = (id: string) => `gs://${BUCKET}/samples/${id}.jpg`;
const EXAMPLES = [
  { k: "Hindi · coolant leak", photo: "clamp-crack", text: "कूलेंट लीक, क्लैंप बदला। ठंडे स्टार्ट के बाद टपकता है।" },
  { k: "Bahasa · coolant leak", photo: "clamp-loose", text: "Selang radiator bocor di sambungan, klem kendor setelah mesin dingin. Klem diganti, coolant ditambah." },
  { k: "English · infotainment", photo: "screen-reboot", text: "Screen restarts every time the customer's phone connects on Bluetooth. Reflashed head unit software." },
  { k: "English · new problem", photo: "", text: "Sunroof glass rattles over speed bumps, rear seal loose. Re-glued seal and adjusted glass." },
];
type Step = { k: string; t: string; d: string };
const stepsFor = (photo: boolean): Step[] => [
  { k: "read", t: "Gemini reads the note", d: "Language detected, translated, failure extracted" },
  ...(photo ? [{ k: "see", t: "Gemini looks at the photo", d: "Finds the failed part and damage in the image" }] : []),
  { k: "embed", t: "Meaning turned into a vector", d: "gemini-embedding-001 · 768 dimensions" },
  { k: "store", t: "Saved to BigQuery", d: "claims_raw + claims_structured" },
  { k: "match", t: "Compared with every open case", d: "Cosine similarity to each case's centre" },
  { k: "link", t: "Linked, analyst notified", d: "Case updated live in Firestore" },
];

type Result = { claim_id: string; extraction: any; timings: Record<string, number>; linked: any; candidates: any[]; threshold: number };

export default function FileClaim() {
  const { role } = useSession();
  const act = useActAs();
  const s = useSummary();
  const [vins, setVins] = useState<any[]>([]);
  const [vin, setVin] = useState("");
  const [km, setKm] = useState("18200");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string>("clamp-crack");
  const [upload, setUpload] = useState<{ uri: string; url: string } | null>(null);
  const [phase, setPhase] = useState(-1);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState<any[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api("/demo/vins").then((v: any[]) => { setVins(v); if (v[0]) setVin(v[0].vin); }).catch(() => {});
    api(`/claims/mine?dealer_id=${DEALER.id}`).then(setMine).catch(() => {});
  }, []);

  const hasPhoto = !!(upload || photo);
  const photoUri = upload?.uri ?? (photo ? gs(photo) : null);
  const photoUrl = upload?.url ?? (photo ? `/samples/${photo}.jpg` : null);
  const steps = stepsFor(hasPhoto);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setRes(null); setPhase(0);
    timer.current = setInterval(() => setPhase((p) => Math.min(p + 1, steps.length - 2)), 1500);
    try {
      const r = await api<Result>("/claims", { method: "POST", json: { vin, dealer_id: DEALER.id, note_text: note, mileage_km: Number(km) || null, photo_uris: photoUri ? [photoUri] : [] } });
      setRes(r); setPhase(99);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      api(`/claims/mine?dealer_id=${DEALER.id}`).then(setMine).catch(() => {});
    } catch (e: any) { setErr(e.message); setPhase(-1); }
    finally { if (timer.current) clearInterval(timer.current); }
  }

  async function addPhoto(f?: File) {
    if (!f) return;
    try { const uri = await uploadFile(f); setUpload({ uri, url: URL.createObjectURL(f) }); setPhoto(""); }
    catch (e: any) { setErr(e.message); }
  }

  const dealer = s?.dealers?.find((d: any) => d.dealer_id === DEALER.id);
  const totalSec = res ? Object.values(res.timings).reduce((a, b) => a + b, 0) / 1000 : 0;
  const x = res?.extraction;
  const busy = phase >= 0 && phase < 99;
  const ms = (k: string) => res ? ({ read: res.timings.read_ms, embed: res.timings.embed_ms, match: res.timings.match_ms } as any)[k] : null;

  return (
    <>
      <div className="page-head">
        <div className="grow"><span className="label">Step 1 · Ravi Kumar · Pune dealership</span>
          <h1>File a warranty claim</h1>
          <p>Write the repair note in any language and add a photo. Gemini reads both and links the claim to any matching failure case
            across the network straight away, instead of waiting for the monthly warranty review.</p></div>
      </div>

      <div className="grid g4 eq">
        <Stat label="Claims from this dealership" value={dealer?.claims ?? "—"} sub={`Top issue: ${dealer?.top_issue ?? "—"}`} />
        <Stat label="Network claims, last 30 days" value={s?.claims_30d ?? "—"} sub={`${s?.claims ?? "—"} in 120 days`} />
        <Stat label="Average odometer at claim" value={s ? `${(s.avg_mileage / 1000).toFixed(1)}k km` : "—"} sub="across all dealers" />
        <Stat label="Languages understood" value="Any" sub="Hindi, Bahasa, English in this data" />
      </div>

      <div className="grid g-3-2">
        <form className="card card-pad stack" onSubmit={submit} style={{ gap: 18 }}>
          <div className="row"><h3 className="grow">New claim</h3><span className="chip">{DEALER.city} · {DEALER.id}</span></div>
          <div className="grid g2" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="vin">Vehicle (VIN)</label>
              <input id="vin" className="input mono" value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} maxLength={17} required />
            </div>
            <div className="field"><label htmlFor="km">Odometer (km)</label>
              <input id="km" className="input mono" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} /></div>
          </div>
          <div className="row wrap" style={{ marginTop: -8 }}>{vins.map((v) => (
            <button type="button" key={v.vin} className={`chip ${vin === v.vin ? "blue" : ""}`} style={{ border: 0, cursor: "pointer" }} onClick={() => setVin(v.vin)}
              title={`${v.model} · built ${v.build_date} · clamp batch ${v.batch_id}`}>{v.model} · {v.vin.slice(-6)}{v.hint === "suspect clamp batch" ? " ★" : ""}</button>))}
            <span className="faint small">★ fitted with the suspect clamp batch</span></div>

          <div className="field">
            <label htmlFor="note">Repair note</label>
            <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any language: what the customer reported and what you fixed" required />
            <div className="row wrap"><span className="faint small">Try:</span>{EXAMPLES.map((ex) => (
              <button type="button" key={ex.k} className="chip" style={{ border: 0, cursor: "pointer" }}
                onClick={() => { setNote(ex.text); setPhoto(ex.photo); setUpload(null); }}>{ex.k}</button>))}</div>
          </div>

          <div className="field">
            <div className="row"><label className="grow" style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Photo</label>
              <span className="faint small">Sample photos are AI-generated for this demo</span></div>
            <div className="photo-grid" role="radiogroup" aria-label="Choose a sample photo">
              {PHOTOS.map((p) => (
                <button type="button" key={p.id} role="radio" aria-checked={photo === p.id && !upload} className="photo-opt"
                  onClick={() => { setPhoto(photo === p.id ? "" : p.id); setUpload(null); }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/samples/${p.id}.jpg`} alt={p.label} loading="lazy" />
                  <span>{p.label}</span>
                  {photo === p.id && !upload && <i aria-hidden="true"><ICheck size={14} /></i>}
                </button>
              ))}
              <label className={`photo-opt upload ${upload ? "on" : ""}`}>
                {upload
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={upload.url} alt="Your upload" />
                  : <span className="up"><IUpload size={22} /><b>Your photo</b></span>}
                <input id="photo" type="file" accept="image/*" capture="environment" hidden onChange={(e) => addPhoto(e.target.files?.[0])} />
                {upload && <><span>Your photo</span><i aria-hidden="true"><ICheck size={14} /></i></>}
              </label>
            </div>
          </div>
          {err && <div className="error" role="alert">{err}</div>}
          <button className="btn" style={{ height: 48 }} disabled={busy || !note || vin.length < 11}>
            {busy ? <><span className="spin" /> Agents working…</> : `Submit claim${hasPhoto ? " with photo" : ""}`}</button>
          {role !== "dealer" && <p className="faint small">You are filing as {role}; normally a dealer files claims.</p>}
        </form>

        <div className="card card-pad stack" aria-live="polite">
          <div className="row"><h3 className="grow">Live agent pipeline</h3>{res ? <span className="chip green">{totalSec.toFixed(1)} s total</span> : busy ? <span className="chip blue"><span className="spin" />running</span> : <span className="chip">waiting</span>}</div>
          {photoUrl && (
            <div className={`scan ${busy ? "on" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="Photo the agent will read" />
              {busy && <span className="scan-line" aria-hidden="true" />}
              <span className="scan-tag">{busy ? "Gemini is reading this photo…" : res ? "Photo read" : "Attached photo"}</span>
            </div>
          )}
          <div className="pipeline fill">
            {steps.map((st, i) => {
              const state = phase >= 99 || phase > i ? "done" : phase === i ? "run" : "";
              const t = ms(st.k);
              return (
                <div key={st.k} className={`pstep ${state}`}>
                  <span className="pk">{state === "done" ? <ICheck size={16} /> : state === "run" ? <span className="spin" /> : i + 1}</span>
                  <div><b style={{ fontWeight: 500 }}>{st.t}</b><div className="faint small">{st.d}</div></div>
                  <span className="mono small faint">{t != null ? `${(t / 1000).toFixed(1)}s` : ""}</span>
                </div>
              );
            })}
          </div>
          {!res && !busy && <p className="faint small">Pick an example and press Submit to watch each agent step complete.</p>}
        </div>
      </div>

      {res && x && (
        <div ref={resultRef} className="grid g3" style={{ scrollMarginTop: 80 }}>
          <div className="card stack" style={{ overflow: "hidden", gap: 0 }}>
            {photoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photoUrl} alt="Claim photo" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }} />
              : <div className="fill center empty">No photo attached</div>}
            <div className="card-pad stack fill" style={{ gap: 8 }}>
              <div className="row"><h3 className="grow">What Gemini saw</h3><span className="chip blue">vision</span></div>
              <p>{x.photo_findings === "no photo" ? "No photo with this claim." : x.photo_findings}</p>
            </div>
          </div>
          <div className="card card-pad stack">
            <div className="row"><h3 className="grow">What Gemini read</h3><span className="chip">{x.lang}</span><span className="chip blue">{x.confidence.toFixed(2)}</span></div>
            <p>“{x.translated_text}”</p>
            <div className="kv fill">
              <span>Component</span><b>{x.component}</b>
              <span>Failure mode</span><b>{x.failure_mode}</b>
              <span>Condition</span><b>{x.condition}</b>
              <span>Symptom</span><b>{x.symptom}</b>
              <span>Severity</span><b>{x.severity} / 5</b>
            </div>
          </div>
          {res.linked ? (
            <div className="card card-pad stack" style={{ boxShadow: "0 0 0 2px var(--green), var(--shadow)" }}>
              <div className="row"><ILink /><h3 className="grow">Linked to {res.linked.case_id}</h3><span className="chip green">{res.linked.similarity.toFixed(2)}</span></div>
              <p><b style={{ fontWeight: 500 }}>{res.linked.title}</b>. The analyst sees this claim now.</p>
              <div className="stack fill" style={{ gap: 8 }}>
                {res.linked.similar.slice(0, 2).map((c: any) => (
                  <div key={c.claim_id} className="claim"><span className="small"><b>{c.claim_id}</b> · {c.city ?? "new"} · <span className="mono">{c.similarity.toFixed(2)}</span></span><span className="small">{c.text}</span></div>
                ))}
              </div>
              <button className="btn" onClick={() => act("analyst", `/case/${res.linked.case_id}`)}>Continue as Ananya <IArrow size={16} /></button>
            </div>
          ) : (
            <div className="card card-pad stack">
              <h3>No open case matches yet</h3>
              <p className="muted fill">Closest: {res.candidates[0] ? `${res.candidates[0].title} (${res.candidates[0].similarity.toFixed(2)})` : "none"}. A match needs {res.threshold}.
                The claim is stored; if similar claims build up, the hourly Signal scan opens a new case.</p>
            </div>
          )}
        </div>
      )}

      <div className="card card-pad stack">
        <h3>Why this matters: the time gap</h3>
        <TimeGap linkSeconds={totalSec || undefined} />
      </div>

      <div className="card">
        <div className="card-head"><h3>Recent claims from this dealership</h3><span className="faint small">{mine.length} shown</span></div>
        <div className="table-wrap"><table className="t">
          <thead><tr><th>Claim</th><th>Date</th><th>VIN</th><th>Language</th><th>What AI understood</th><th>Severity</th></tr></thead>
          <tbody>{mine.map((c) => (
            <tr key={c.claim_id} style={{ cursor: "default" }}><td className="mono">{c.claim_id}</td><td>{String(c.claim_date)}</td><td className="mono small">{c.vin}</td>
              <td><span className="chip">{c.lang}</span></td><td>{c.component} · <span className="muted">{c.failure_mode}</span></td><td>{c.severity}</td></tr>))}</tbody>
        </table></div>
      </div>
    </>
  );
}
