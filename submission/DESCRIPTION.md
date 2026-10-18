# Field-to-Fix — brief description

**Team:** Field-to-Fix · Deep Mandlik (team leader), Pranali Shinde
**Theme:** Manufacturing · Intelligent Operations & Industrial Efficiency
**Live prototype:** https://f2f-web-lc64mw36wq-as.a.run.app (tick “I’m a judge” on the login page)

## What we built

When a car part fails in the field, the dealer files a warranty claim, the car maker has to find the root cause, and
the supplier has to fix it. Today that takes about 7 weeks to the root cause and 9–10 more to the fix, while faulty
parts keep shipping. Field-to-Fix connects the dealer, the OEM and the Tier-1 supplier on one live case and uses five
Gemini agents to do the investigation in between:

1. **Intake** reads each claim — a short note in any language (Hindi, Bahasa, English…), a photo, or a voice note — and
   extracts the failed component, failure mode and severity. A new claim is linked to the matching open case in seconds.
2. **Signal** groups claims by meaning and flags clusters growing faster than their baseline.
3. **Trace** follows the failing vehicles to plant, part, supplier and production batch, and finds vehicles of other
   models fitted with the same batch before they fail.
4. **Hypothesise** checks the cluster against the factory’s PFMEA and control plan and ranks root causes, each cited.
5. **Draft 8D** writes the 8D corrective-action report, with containment quantities taken from BigQuery.

People stay in charge: the supplier-quality engineer edits and approves the 8D, the supplier answers it in its own
portal, and Gemini checks that answer for gaps before the OEM accepts it. A watch view (Apple Watch / Wear OS) lets
people get alerted, approve with a press-and-hold, and dictate claims when they are away from a screen.

## How we use Google Cloud

- **Gemini (Vertex AI):** Gemini 2.5 Flash reads multilingual notes, photos and voice (Intake), answers grounded
  questions with function calling (Ask), and checks supplier replies. Gemini 2.5 Pro ranks root causes against the PFMEA
  and drafts the 8D with validated citations. `gemini-embedding-001` powers clustering and live claim linking.
  All outputs use structured JSON schemas; numbers come from BigQuery tools, never from the model.
- **Cloud Run:** two services in asia-southeast1 — the Next.js web app and the FastAPI agent API. The agent API runs
  as one service account (no API keys) and calls Vertex AI, BigQuery, Firestore and Cloud Storage.
- **Firestore:** the live system of record for cases, every agent step, approvals, the 8D draft and chat. Every screen
  (web, phone and watch) subscribes to Firestore, so agent progress and hand-offs between people appear in real time.
  Security rules limit suppliers to their own cases.
- **Firebase:** Firebase Authentication with custom claims for five roles (dealer, analyst, supplier quality,
  supplier, head of quality) plus a judge demo account that can switch roles.
- Also: BigQuery (claims, vehicles, batches, stock, PFMEA), Cloud Storage (photos), Pub/Sub and Cloud Scheduler
  (async intake, hourly signal scan), Cloud Text-to-Speech and Gemini image generation for demo assets.

## Measured on our synthetic dataset (6,400 vehicles, 630+ claims)

Claim linked in ~6 s · cited 8D draft in 59 s · 630/630 claims classified correctly and 162/162 Hindi notes understood
(clean synthetic notes, so real-world accuracy will be lower) · 56/56 planted failure claims recalled · correct supplier
batches found · 307 at-risk vehicles flagged before failure · 4 gaps caught in the supplier’s reply.
