# Field-to-Fix — brief description

**Team:** Field-to-Fix · Deep Mandlik (team leader), Pranali Shinde
**Theme:** Manufacturing · Intelligent Operations & Industrial Efficiency
**Live prototype:** https://f2f-web-lc64mw36wq-as.a.run.app (tick “I’m a judge” on the login page)
**Demo video:** https://drive.google.com/file/d/13FqNQnWm67ml6OBLyBttgP9fU-pn3wZ5/view?usp=sharing
**Code:** https://github.com/deepmandlik/field-to-fix

## The problem

When a car part fails in the field, a dealer technician fixes it and types a short note, often in Hindi, Bahasa or
Hinglish. That note joins thousands of warranty claims. Car makers take about 7 weeks to confirm the root cause of one
failure and another 9–10 weeks to fix it at the supplier, so faulty parts keep shipping for roughly 19 weeks. Warranty
costs the auto industry about $58B a year, and the people who must act — dealer, OEM quality team and Tier-1
supplier — work in separate systems.

## Our solution

Field-to-Fix puts the dealer, the OEM and the supplier on one live case, and five Gemini agents do the investigation
in between:

1. **Intake** reads each claim — a note in any language, a photo or a voice note — and extracts the failed part,
   failure mode and severity. A new claim is linked to the matching open case in seconds.
2. **Signal** groups claims by meaning and flags clusters growing faster than their baseline.
3. **Trace** follows the failing cars to plant, part, supplier and production batch, and finds cars of other models
   fitted with the same batch **before** they fail.
4. **Hypothesise** checks the cluster against the factory’s PFMEA and control plan and ranks root causes, each cited.
5. **Draft 8D** writes the 8D corrective-action report, with containment quantities taken from BigQuery.

People stay in charge: the supplier-quality engineer edits and approves the 8D, the supplier answers it in its own
portal, and Gemini checks that answer for gaps before the OEM accepts it. A **Cost of waiting** panel shows, for every
case, what each day of delay costs and what acting today avoids. A smartwatch view lets engineers approve with a
press-and-hold and lets gloved technicians dictate claims.

## How we use Google services

- **Gemini on Vertex AI:** Gemini 3.8 Flash reads multilingual notes, photos and voice (Intake), answers questions
  with tools (Ask), drafts the 8D and checks supplier replies. Gemini 4 Argon ranks root causes against the PFMEA.
  Low thinking settings keep a full investigation under a minute.
  `gemini-embedding-001` powers clustering and live claim linking. Outputs use structured JSON schemas, every citation
  is checked against the input, and numbers come from BigQuery, never from the model.
- **Google Agent Development Kit (ADK):** the investigation is an ADK `SequentialAgent` (Trace → Hypothesise →
  Draft 8D). Each step is a deterministic, tool-backed ADK agent, so we keep full control of what the model may cite.
- **Vertex AI Agent Engine:** the Ask agent (ADK `LlmAgent`) is deployed on Agent Engine; the agent API sends it the
  case facts and gets a cited answer in about 5 seconds, with the same agent in-process as a fallback.
- **Cloud Run:** two services in asia-southeast1 — the Next.js web app and the FastAPI agent API, which runs as one
  service account (no API keys).
- **Firestore:** the live system of record for cases, every agent step, approvals, the 8D and chat. Web, phone and
  watch screens all subscribe to it, so agent progress and hand-offs appear in real time. Security rules limit each
  supplier to its own cases.
- **Firebase Authentication:** five roles via custom claims (dealer, analyst, supplier quality, supplier, head of
  quality), plus a judge account that can switch roles.
- **Also:** BigQuery (claims, vehicles, batches, stock, PFMEA), Cloud Storage (photos and voice), Pub/Sub and Cloud
  Scheduler (asynchronous intake, hourly signal scan), Cloud Text-to-Speech and Gemini image generation for demo assets.

## Results on our test dataset (6,400 vehicles, 630+ claims, 3 languages)

- Cited 8D draft in under 50 seconds (live ADK run, down from 2.5 minutes); Ask answers in ~5 seconds; a new claim
  links to its case in seconds.
- 99/100 on a hand-written hard set of messy notes (typos, Hinglish, slang, two-word notes); the one miss was
  “leak hai neeche” (“there is a leak underneath”). 630/630 on the clean generated notes.
- 56/56 planted failure claims recalled; both bad supplier batches found; 307 at-risk cars flagged with no claims yet.
- 4 gaps caught in the supplier’s reply in the recorded run.
- Estimated cost at pilot scale (10,000 claims a month): about $340 a month, ≈ 3.4¢ per claim, at list prices.
