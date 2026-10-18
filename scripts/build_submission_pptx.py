"""Fill the official AI Builder Cup template with Field-to-Fix content. Native, editable shapes and text.

Usage: python scripts/build_submission_pptx.py <template.pptx> <images dir> <out.pptx>
"""
from __future__ import annotations

import sys
from copy import deepcopy

from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

TEMPLATE, IMG, OUT = sys.argv[1:4]
FONT = "Arial"
INK, MUTED, FAINT, LINE = "1F1F1F", "444746", "747775", "DADCE0"
BLUE, BLUE_SOFT, ORANGE, RED, GREEN, PURPLE, TEAL, AMBER = "0B57D0", "E8F0FE", "E8710A", "B3261E", "188038", "9334E6", "12B5CB", "F9AB00"
LINK = "https://f2f-web-lc64mw36wq-as.a.run.app"

prs = Presentation(TEMPLATE)
S = list(prs.slides)


def rgb(h): return RGBColor.from_string(h)


def para(tf, text, size=12, bold=False, color=INK, align=PP_ALIGN.LEFT, first=False, space=4):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_after = Pt(space)
    r = p.add_run()
    r.text = text
    f = r.font
    f.name, f.size, f.bold, f.color.rgb = FONT, Pt(size), bold, rgb(color)
    return p


def text(slide, x, y, w, h, lines, size=12, color=INK, bold=False, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for m in (tf.margin_left, tf.margin_right):
        pass
    tf.margin_left = tf.margin_right = Inches(0.04)
    tf.margin_top = tf.margin_bottom = Inches(0.02)
    for i, ln in enumerate(lines if isinstance(lines, list) else [lines]):
        if isinstance(ln, tuple):
            t, kw = ln
            para(tf, t, first=i == 0, **{"size": size, "color": color, "bold": bold, "align": align, **kw})
        else:
            para(tf, ln, size=size, color=color, bold=bold, align=align, first=i == 0)
    return tb


def box(slide, x, y, w, h, fill="FFFFFF", line=LINE, accent=None, radius=True):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    if radius:
        shp.adjustments[0] = 0.08
    shp.fill.solid(); shp.fill.fore_color.rgb = rgb(fill)
    if line:
        shp.line.color.rgb = rgb(line); shp.line.width = Pt(0.75)
    else:
        shp.line.fill.background()
    shp.shadow.inherit = False
    shp.text_frame.text = ""
    if accent:
        bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(0.06))
        bar.fill.solid(); bar.fill.fore_color.rgb = rgb(accent); bar.line.fill.background()
    return shp


def card(slide, x, y, w, h, title, body, accent=BLUE, title_size=12, body_size=10, fill="FFFFFF"):
    box(slide, x, y, w, h, fill=fill, accent=accent)
    text(slide, x + 0.1, y + 0.12, w - 0.2, 0.3, [(title, {"bold": True, "color": INK})], size=title_size)
    text(slide, x + 0.1, y + 0.42, w - 0.2, h - 0.5, body if isinstance(body, list) else [body], size=body_size, color=MUTED)


def arrow(slide, x1, y1, x2, y2, color=BLUE, width=1.75):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = rgb(color); c.line.width = Pt(width)
    ln = c.line._get_or_add_ln()
    tail = etree.SubElement(ln, qn("a:tailEnd")); tail.set("type", "triangle"); tail.set("w", "med"); tail.set("len", "med")
    return c


def elbow(slide, x1, y1, x2, y2, color=BLUE):
    mx = (x1 + x2) / 2
    for a, b, c, d in ((x1, y1, mx, y1), (mx, y1, mx, y2)):
        l = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(a), Inches(b), Inches(c), Inches(d))
        l.line.color.rgb = rgb(color); l.line.width = Pt(1.75)
    arrow(slide, mx, y2, x2, y2, color)


def image(slide, name, x, y, w=None, h=None, border=True):
    path = f"{IMG}/{name}"
    iw, ih = Image.open(path).size
    if w and h:  # fit inside the box, keep aspect, centred
        s = min(w / iw, h / ih)
        dw, dh = iw * s, ih * s
        x, y, w, h = x + (w - dw) / 2, y + (h - dh) / 2, dw, dh
    elif w:
        h = w * ih / iw
    else:
        w = h * iw / ih
    pic = slide.shapes.add_picture(path, Inches(x), Inches(y), Inches(w), Inches(h))
    if border:
        pic.line.color.rgb = rgb(LINE); pic.line.width = Pt(0.75)
    return pic


def set_title(slide, title, sub=None):
    """Rewrite the template's title box in place, keeping its position."""
    tb = next(s for s in slide.shapes if s.has_text_frame and s.text_frame.text.strip())
    tf = tb.text_frame
    for p in list(tf.paragraphs)[1:]:
        p._p.getparent().remove(p._p)
    tf.paragraphs[0].text = ""
    r = tf.paragraphs[0].add_run(); r.text = title
    r.font.name, r.font.size, r.font.bold, r.font.color.rgb = FONT, Pt(20), True, rgb(INK)
    tb.height = Inches(0.45)
    if sub:
        text(slide, 0.33, 1.13, 9.3, 0.3, [sub], size=11, color=FAINT)
    return tb


def footer(slide, n):
    text(slide, 0.33, 5.22, 6, 0.25, ["Field-to-Fix · Deep Mandlik, Pranali Shinde · AI Builder Cup 2026"], size=8, color=FAINT)
    text(slide, 9.0, 5.22, 0.7, 0.25, [str(n)], size=8, color=FAINT, align=PP_ALIGN.RIGHT)


def delete_slide(prs, slide):
    sld = prs.slides._sldIdLst
    for sid in list(sld):
        if prs.slides.get(int(sid.get("id"))) is None:
            continue
    rid = next(s.get(qn("r:id")) for s in sld if prs.part.related_part(s.get(qn("r:id"))) is slide.part)
    for s in list(sld):
        if s.get(qn("r:id")) == rid:
            sld.remove(s)
    prs.part.drop_rel(rid)


# ---------- 1. Team details ----------
s = S[0]
tb = next(sh for sh in s.shapes if sh.has_text_frame)
tf = tb.text_frame
for p in list(tf.paragraphs)[1:]:
    p._p.getparent().remove(p._p)
tf.paragraphs[0].text = ""
para(tf, "Team Details", 16, True, INK, first=True, space=6)
for label, val in (("Team name: ", "Field-to-Fix"), ("Team leader name: ", "Deep Mandlik"), ("Team member: ", "Pranali Shinde"),
                   ("Problem Statement: ", "Manufacturing · Intelligent Operations & Industrial Efficiency. Car makers take about 7 weeks to find the root cause "
                                          "of a field failure. Field-to-Fix uses Gemini agents to turn multilingual warranty claims into a cited 8D report "
                                          "for the supplier the same day.")):
    p = tf.add_paragraph(); p.space_after = Pt(3)
    r1 = p.add_run(); r1.text = label; r1.font.name, r1.font.size, r1.font.bold, r1.font.color.rgb = FONT, Pt(11), True, rgb(INK)
    r2 = p.add_run(); r2.text = val; r2.font.name, r2.font.size, r2.font.color.rgb = FONT, Pt(11), rgb(MUTED)
    pPr = p._p.get_or_add_pPr()
    for b in pPr.findall(qn("a:buAutoNum")) + pPr.findall(qn("a:buChar")):
        pPr.remove(b)
    etree.SubElement(pPr, qn("a:buNone"))
    pPr.set("marL", "0"); pPr.set("indent", "0")

# ---------- 3. Brief about the idea ----------
s = S[2]; set_title(s, "Brief about the idea", "Field-to-Fix: dealers file it, OEMs approve it, suppliers solve it")
text(s, 0.33, 1.5, 4.6, 3.6, [
    ("The problem", {"bold": True, "color": RED, "size": 12}),
    "A part fails in the field. The dealer fixes it and writes a short note, often in Hindi or Bahasa. Car makers take about 7 weeks "
    "to find the root cause and 9–10 more to fix it at the supplier, while bad parts keep shipping (≈ $58B a year in warranty).",
    ("Our idea", {"bold": True, "color": BLUE, "size": 12}),
    "Five Gemini agents on Google Cloud read every claim (text, photo, voice, any language), find failure clusters early, trace them "
    "to the exact supplier batch, rank root causes against the factory PFMEA, and draft the 8D report. People approve every step.",
    ("The result", {"bold": True, "color": GREEN, "size": 12}),
    "From first claims to an 8D at the supplier in under a day instead of ~19 weeks, on web, phone and smartwatch.",
], size=10, color=MUTED)
image(s, "02-start.jpg", 5.15, 1.5, w=4.5, h=3.5)
footer(s, 2)

# ---------- 4. Opportunities ----------
s = S[3]; set_title(s, "Opportunities")
qs = [
    ("How is it different from existing ideas?", BLUE,
     "Warranty-analytics tools score structured codes and dashboards. Field-to-Fix reads the unstructured part (multilingual notes, photos, "
     "PFMEA PDFs), links the dealer, OEM and Tier-1 supplier on one live case, and writes the 8D, with every statement cited."),
    ("How will it solve the problem?", ORANGE,
     "A new claim is linked to its case in ~6 s instead of the monthly review. One click traces the cluster to supplier batches "
     "and drafts a cited 8D in ~1 minute. Gemini also checks the supplier’s reply for gaps before the OEM accepts it."),
    ("USP of the proposed solution", GREEN,
     "Early warning before failures (vehicles at risk with no claims yet) · numbers from BigQuery, never the model · human approval "
     "on every outbound step · works for gloved technicians on a smartwatch · built for JAPAC dealer networks, works for any OEM."),
]
for i, (q, col, a) in enumerate(qs):
    card(s, 0.33, 1.42 + i * 1.25, 9.33, 1.13, q, a, accent=col, body_size=10)
footer(s, 3)

# ---------- 5. Features ----------
s = S[4]; set_title(s, "List of features offered by the solution")
feats = [
    ("Multilingual + photo intake", "Gemini reads notes in any language and sees damage in photos", ORANGE),
    ("Live claim linking", "New claims join the right case in ~6 s by meaning", ORANGE),
    ("Signal clustering", "Embeddings group claims; growth vs baseline ranks cases", BLUE),
    ("Trace to supplier batch", "Failing VINs → part → supplier → batch, with lift", TEAL),
    ("Cited root causes", "Hypotheses checked against PFMEA and control plan", PURPLE),
    ("AI-drafted 8D + PDF", "D2–D5 drafted with sources; containment from stock data", GREEN),
    ("Supplier portal + AI check", "Tier-1 sees only its cases; Gemini flags gaps in replies", AMBER),
    ("Ask Gemini", "Grounded chat over one case, with clickable citations", PURPLE),
    ("Five roles, one workflow", "Dealer → analyst → SQE → supplier → head of quality", BLUE),
    ("Lifecycle + audit tree", "Every agent step and approval, time-stamped", BLUE),
    ("Smartwatch app", "Alerts, hold-to-approve, dictated claims (Apple/Wear OS)", RED),
    ("Dashboards + guided demo", "Analytics on every page; six-step judge walkthrough", GREEN),
]
cw, ch = 2.26, 0.98
for i, (t, b, col) in enumerate(feats):
    x = 0.33 + (i % 4) * (cw + 0.1); y = 1.42 + (i // 4) * (ch + 0.12)
    card(s, x, y, cw, ch, t, b, accent=col, title_size=10.5, body_size=9)
footer(s, 4)

# ---------- 6. Process flow ----------
s = S[5]; set_title(s, "Process flow diagram", "One live case moves through five people; Gemini agents do the investigation in between")
people = [("Dealer", "Files claim (any language + photo)", ORANGE), ("Warranty analyst", "Clicks Investigate", BLUE),
          ("Supplier quality", "Edits & approves 8D", PURPLE), ("Tier-1 supplier", "Confirms root cause, fixes", TEAL),
          ("Head of quality", "Sees cost, risk, speed", GREEN)]
pw = 1.7
for i, (n, d, col) in enumerate(people):
    x = 0.33 + i * (pw + 0.2)
    box(s, x, 1.55, pw, 0.95, accent=col)
    text(s, x + 0.08, 1.66, pw - 0.16, 0.3, [(n, {"bold": True})], size=11, align=PP_ALIGN.CENTER)
    text(s, x + 0.08, 1.98, pw - 0.16, 0.45, [d], size=9, color=MUTED, align=PP_ALIGN.CENTER)
    if i < 4:
        arrow(s, x + pw + 0.02, 2.02, x + pw + 0.18, 2.02)
agents = [("1 Intake", "Gemini 2.5 Flash"), ("2 Signal", "Embeddings + clustering"), ("3 Trace", "BigQuery tools"),
          ("4 Hypothesise", "Gemini 2.5 Pro + PFMEA"), ("5 Draft 8D", "Gemini 2.5 Pro")]
box(s, 0.33, 2.75, 9.33, 1.25, fill="FEF7E0", line="F6D58A", radius=True)
text(s, 0.45, 2.8, 4, 0.3, [("Gemini agents on Google Cloud", {"bold": True, "color": "8C5000"})], size=10)
for i, (n, d) in enumerate(agents):
    x = 0.5 + i * 1.84
    box(s, x, 3.12, 1.62, 0.75, accent=AMBER)
    text(s, x + 0.05, 3.2, 1.52, 0.28, [(n, {"bold": True})], size=10, align=PP_ALIGN.CENTER)
    text(s, x + 0.05, 3.48, 1.52, 0.35, [d], size=8.5, color=MUTED, align=PP_ALIGN.CENTER)
    if i < 4:
        arrow(s, x + 1.63, 3.5, x + 1.83, 3.5, color="8C5000")
states = ["Detected", "Investigating", "SQE review", "With supplier", "Supplier responded", "Closed"]
for i, st in enumerate(states):
    x = 0.33 + i * 1.57
    b = box(s, x, 4.3, 1.42, 0.42, fill=BLUE_SOFT, line="C2D7FB")
    text(s, x, 4.36, 1.42, 0.3, [st], size=9, color="041E49", align=PP_ALIGN.CENTER, bold=True)
    if i < 5:
        arrow(s, x + 1.43, 4.51, x + 1.56, 4.51, width=1.25)
text(s, 0.33, 4.78, 9.33, 0.3, ["Case lifecycle with loops: SQE can request more evidence; SQE sends a reply back when the AI finds gaps."], size=9, color=FAINT)
footer(s, 5)

# ---------- 7. Wireframes / mocks ----------
s = S[6]; set_title(s, "Wireframes / mock screens of the solution", "Real screens from the working prototype")
image(s, "05-claim-result.jpg", 0.33, 1.45, w=3.55, h=2.25)
image(s, "08-case-overview.jpg", 4.0, 1.45, w=3.55, h=2.25)
image(s, "w1-apple-analyst.jpg", 7.75, 1.4, w=1.9, h=2.3, border=False)
for x, cap in ((0.33, "Claim: Gemini reads note + photo, links the case"), (4.0, "Case overview: trace, charts, early warning"), (7.6, "Watch: your queue on the wrist")):
    text(s, x, 3.75, 3.5 if x < 7 else 2.1, 0.3, [cap], size=9, color=MUTED)
image(s, "p1-phone-claim.jpg", 0.33, 4.05, h=1.1)
image(s, "p2-phone-case.jpg", 0.95, 4.05, h=1.1)
text(s, 1.65, 4.25, 7.8, 0.7, ["Responsive: monitor, laptop, iPad and phone from one codebase; a separate wrist view (/w) for Apple Watch and Wear OS."], size=9.5, color=MUTED)
footer(s, 6)

# ---------- 8. Architecture ----------
s = S[7]; set_title(s, "Architecture diagram of the proposed solution", "Two Cloud Run services, five agents, one live database · region asia-southeast1")
card(s, 0.33, 1.55, 1.6, 1.75, "People", ["Dealer", "Analyst", "Supplier quality", "Tier-1 supplier", "Head of quality", "Web · phone · watch"], accent=INK, body_size=9)
card(s, 2.2, 1.55, 1.95, 0.95, "Cloud Run · web", "Next.js + Firebase Auth (5 roles)", accent=BLUE, body_size=9)
card(s, 4.45, 1.55, 2.1, 0.95, "Cloud Run · agents", "FastAPI: 5 agents + Ask", accent=BLUE, body_size=9)
card(s, 7.2, 1.42, 2.45, 0.78, "Vertex AI · Gemini", "2.5 Flash, 2.5 Pro, embeddings", accent=AMBER, body_size=9)
card(s, 7.2, 2.33, 2.45, 0.78, "BigQuery", "Claims, vehicles, batches, PFMEA", accent=AMBER, body_size=9)
card(s, 7.2, 3.24, 2.45, 0.78, "Cloud Storage", "Claim photos, voice notes", accent=AMBER, body_size=9)
card(s, 2.2, 3.05, 1.95, 0.95, "Firestore", "Live cases + agent log (realtime)", accent=GREEN, body_size=9)
card(s, 4.45, 3.05, 2.1, 0.95, "Pub/Sub · Scheduler", "Async intake, hourly scan", accent=GREEN, body_size=9)
arrow(s, 1.95, 2.02, 2.18, 2.02)
arrow(s, 4.17, 2.02, 4.43, 2.02)
elbow(s, 6.57, 1.8, 7.18, 1.81, color="B06000")
arrow(s, 6.57, 2.02, 7.18, 2.72, color="B06000")
elbow(s, 6.57, 2.25, 7.18, 3.63, color="B06000")
arrow(s, 3.17, 2.52, 3.17, 3.03, color=GREEN)
arrow(s, 5.5, 2.52, 5.5, 3.03, color=GREEN)
arrow(s, 4.43, 2.4, 4.17, 3.3, color=GREEN)
text(s, 0.33, 4.25, 9.33, 0.9, [
    ("Flow: ", {"bold": True, "color": INK}),
    "Firebase Auth signs people in · the web app calls the agent API · agents call Gemini on Vertex AI, read/write BigQuery and Storage, "
    "write every step to Firestore · every screen listens to Firestore, so updates are live · no API keys: one service account.",
], size=9, color=MUTED)
footer(s, 7)

# ---------- 9. Technologies ----------
s = S[8]; set_title(s, "Technologies used in the solution")
rows = [("Layer", "Technology", "Used for"),
        ("Generative AI", "Gemini 2.5 Flash · Gemini 2.5 Pro (Vertex AI)", "Intake (text, photo, voice), root cause, 8D drafting, Ask, gap check"),
        ("Embeddings", "gemini-embedding-001 · HDBSCAN", "Grouping claims by meaning, live claim linking"),
        ("Images", "Gemini 2.5 Flash Image", "Demo sample photos"),
        ("Voice", "Cloud Text-to-Speech (Chirp 3 HD)", "Demo video narration"),
        ("Compute", "Cloud Run (2 services)", "Next.js web app · FastAPI agent API"),
        ("Auth", "Firebase Authentication", "Five roles via custom claims, demo account"),
        ("Realtime data", "Firestore", "Cases, agent events, 8D, chat; live UI"),
        ("Analytics data", "BigQuery", "Claims, vehicles, batches, stock, PFMEA"),
        ("Files / events", "Cloud Storage · Pub/Sub · Cloud Scheduler", "Photos, async intake, hourly signal scan"),
        ("Frontend", "Next.js 14, React, TypeScript", "Responsive web, phone and watch views")]
tbl = s.shapes.add_table(len(rows), 3, Inches(0.33), Inches(1.4), Inches(9.33), Inches(3.7)).table
for c, w in enumerate((1.6, 3.4, 4.33)):
    tbl.columns[c].width = Inches(w)
for r, row in enumerate(rows):
    for c, val in enumerate(row):
        cell = tbl.cell(r, c); cell.text = ""
        para(cell.text_frame, val, size=9.5 if r else 10, bold=(r == 0 or c == 0), color="FFFFFF" if r == 0 else (INK if c < 2 else MUTED), first=True, space=0)
        cell.fill.solid(); cell.fill.fore_color.rgb = rgb(BLUE if r == 0 else ("F8FAFD" if r % 2 else "FFFFFF"))
        cell.margin_top = cell.margin_bottom = Inches(0.03)
footer(s, 8)

# ---------- 10. Estimated cost ----------
s = S[9]; set_title(s, "Estimated implementation cost", "Pilot scale: one OEM, 10,000 claims and ~50 investigations a month · approx. Google Cloud list prices (USD)")
rows = [("Item", "Assumption", "Per month"),
        ("Gemini 2.5 Flash (Intake, Ask, checks)", "10k claims × ~1.5k input / 300 output tokens", "≈ $12"),
        ("Gemini 2.5 Pro (root cause + 8D)", "50 investigations × ~30k input / 3k output tokens", "≈ $4"),
        ("Embeddings", "10k claims + searches", "< $1"),
        ("Cloud Run · agents", "1 always-warm instance, 2 vCPU / 2 GiB", "≈ $100"),
        ("Cloud Run · web", "Scales to zero", "≈ $5"),
        ("BigQuery, Firestore, Storage, Pub/Sub", "Small data volumes", "≈ $10"),
        ("Total", "", "≈ $130 / month")]
tbl = s.shapes.add_table(len(rows), 3, Inches(0.33), Inches(1.5), Inches(9.33), Inches(2.6)).table
for c, w in enumerate((3.2, 4.53, 1.6)):
    tbl.columns[c].width = Inches(w)
for r, row in enumerate(rows):
    for c, val in enumerate(row):
        cell = tbl.cell(r, c); cell.text = ""
        last = r == len(rows) - 1
        para(cell.text_frame, val, size=10, bold=(r == 0 or last), color="FFFFFF" if r == 0 else INK, first=True, space=0,
             align=PP_ALIGN.RIGHT if c == 2 else PP_ALIGN.LEFT)
        cell.fill.solid(); cell.fill.fore_color.rgb = rgb(BLUE if r == 0 else ("E6F4EA" if last else "FFFFFF"))
text(s, 0.33, 4.3, 9.33, 0.8, ["For comparison: one avoided week of shipping a defective part can cost far more than a year of running Field-to-Fix. "
                               "Estimates use public list prices and will vary with real claim volumes; development used Google Cloud free-trial credits."],
     size=9.5, color=MUTED)
footer(s, 9)

# ---------- 11. Snapshots ----------
s = S[10]; set_title(s, "Snapshots of the prototype")
snaps = [("snap-claim.jpg", "1 · Dealer: Gemini reads the note and the photo"), ("snap-agents.jpg", "2 · Analyst: five agents stream their work live"),
         ("snap-8d.jpg", "3 · Supplier quality: a cited 8D report"), ("snap-supplier.jpg", "4 · Supplier: Gemini flags 4 gaps in the reply")]
for i, (img, cap) in enumerate(snaps):
    x = 0.33 + (i % 2) * 4.72; y = 1.3 + (i // 2) * 1.98
    image(s, img, x, y, w=4.6, h=1.68)
    text(s, x, y + 1.7, 4.6, 0.25, [cap], size=9, color=MUTED, align=PP_ALIGN.CENTER)
footer(s, 10)

# ---------- 12. Performance ----------
s = S[11]; set_title(s, "Prototype performance report / benchmarking", "Measured on the deployed prototype with our synthetic dataset (6,400 vehicles, 630+ claims, 3 languages)")
rows = [("Measure", "Result", "Baseline / note"),
        ("Claim → linked to the right case", "~6 s (warm), 0.97–0.99 similarity", "Monthly warranty review"),
        ("Click → cited 8D draft (5 agents)", "59 s live run", "~7 weeks to confirmed root cause"),
        ("First claims → 8D at supplier", "< 1 day", "~19 weeks incl. countermeasure"),
        ("Intake: failure category correct", "630 / 630 (100%)", "Synthetic notes are clean; real data will be lower"),
        ("Hindi notes understood", "162 / 162", "Plus Bahasa and English"),
        ("Planted failure cluster recalled", "56 / 56 claims", "Merged near-duplicate clusters (0.92 cosine)"),
        ("Trace found the bad batches", "KAV-26W31 and W32 (lift 2.3× / 1.9×)", "Matches ground truth"),
        ("Vehicles flagged before failure", "307", "Same batch, other model, 0 claims yet"),
        ("Supplier reply gaps caught", "4", "Root-cause contradiction detected")]
tbl = s.shapes.add_table(len(rows), 3, Inches(0.33), Inches(1.4), Inches(9.33), Inches(3.7)).table
for c, w in enumerate((3.3, 2.8, 3.23)):
    tbl.columns[c].width = Inches(w)
for r, row in enumerate(rows):
    for c, val in enumerate(row):
        cell = tbl.cell(r, c); cell.text = ""
        para(cell.text_frame, val, size=9.5, bold=(r == 0 or c == 1), color="FFFFFF" if r == 0 else (GREEN if c == 1 else (INK if c == 0 else MUTED)), first=True, space=0)
        cell.fill.solid(); cell.fill.fore_color.rgb = rgb(BLUE if r == 0 else ("F8FAFD" if r % 2 else "FFFFFF"))
footer(s, 11)

# ---------- 13. Future ----------
s = S[12]; set_title(s, "Additional details / future development")
fut = [("Next 90 days · pilot", "Run on one OEM’s real dealer claims and build data; measure root-cause time against their current process.", BLUE),
       ("Native wrist apps", "Wear OS (Compose + Tile) and watchOS (SwiftUI + complication) with push alerts via FCM/APNs; offline dictation queue.", RED),
       ("Across the supply chain", "Supplier sign-in for many OEMs, Tier-2 traceability, recall-risk alerts for at-risk vehicles.", GREEN),
       ("Deeper agents", "Agent Development Kit orchestration, Gemini Live voice for technicians, image-based defect grading.", PURPLE),
       ("Integrations", "Dealer management systems, MES / quality systems, SAP QM notifications, Google Workspace for 8D sign-off.", AMBER),
       ("Safety & scale", "Per-tenant data isolation, evaluation sets from real claims, human-review sampling, cost controls.", TEAL)]
for i, (t, b, col) in enumerate(fut):
    x = 0.33 + (i % 3) * 3.13; y = 1.42 + (i // 3) * 1.85
    card(s, x, y, 3.0, 1.7, t, b, accent=col, title_size=11, body_size=9.5)
footer(s, 12)

# ---------- 14. Links ----------
s = S[13]; set_title(s, "Links")
text(s, 0.33, 1.4, 9.33, 3.6, [
    ("GitHub public repository", {"bold": True, "color": INK, "size": 13}),
    ("[add the repository link]", {"color": BLUE}),
    ("Demo video (3–4 minutes)", {"bold": True, "color": INK, "size": 13}),
    ("[add the YouTube / Drive link]", {"color": BLUE}),
    ("Final product (deployed on Cloud Run)", {"bold": True, "color": INK, "size": 13}),
    (LINK, {"color": BLUE}),
    ("Tick “I’m a judge” on the login page: one demo account, five roles, a guided six-step tour. Watch view: /watch (or /w full screen).", {"color": MUTED, "size": 10}),
], size=11)
footer(s, 13)

# ---------- remove the template's instruction slide and the empty extra slide ----------
for sl in (S[1], S[14]):
    delete_slide(prs, sl)

prs.save(OUT)
print("saved", OUT)
