"""Fill the official AI Builder Cup template with Field-to-Fix content. Native, editable shapes and text.

Usage: python scripts/build_submission_pptx.py <template.pptx> <images dir> <out.pptx>
"""
from __future__ import annotations

import os
import sys
from copy import deepcopy

from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

TEMPLATE, IMG, OUT = sys.argv[1:4]
GITHUB = "https://github.com/deepmandlik/field-to-fix"
VIDEO = os.environ.get("F2F_VIDEO_URL", "")
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


def clone(src, after):
    """Duplicate a template slide (its pictures included) and place it right after `after`."""
    new = prs.slides.add_slide(src.slide_layout)
    for shp in list(new.shapes):
        shp._element.getparent().remove(shp._element)
    rid_map = {}
    for rid, rel in src.part.rels.items():
        if "image" in rel.reltype:
            rid_map[rid] = new.part.relate_to(rel._target, rel.reltype)
    for el in src.shapes._spTree.iterchildren():
        if el.tag.endswith("}nvGrpSpPr") or el.tag.endswith("}grpSpPr"):
            continue
        el = deepcopy(el)
        for node in el.iter():
            for attr in (qn("r:embed"), qn("r:link")):
                if node.get(attr) in rid_map:
                    node.set(attr, rid_map[node.get(attr)])
        new.shapes._spTree.append(el)
    lst = prs.slides._sldIdLst
    ids = list(lst)
    me = ids[-1]
    idx = next(i for i, sid in enumerate(ids) if prs.part.related_part(sid.get(qn("r:id"))) is after.part)
    lst.remove(me); lst.insert(idx + 1, me)
    return new


def rounded_pic(slide, name, x, y, w=None, h=None, radius=0.06):
    pic = image(slide, name, x, y, w, h, border=False)
    pic.auto_shape_type = MSO_SHAPE.ROUNDED_RECTANGLE
    geom = pic._element.spPr.find(qn("a:prstGeom"))
    av = geom.find(qn("a:avLst"))
    if av is None:
        av = etree.SubElement(geom, qn("a:avLst"))
    gd = etree.SubElement(av, qn("a:gd")); gd.set("name", "adj"); gd.set("fmla", f"val {int(radius * 100000)}")
    return pic


def link(tf, label, url, size=12, first=False):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.space_after = Pt(2)
    r = p.add_run(); r.text = label
    r.font.name, r.font.size, r.font.color.rgb, r.font.underline = FONT, Pt(size), rgb(BLUE), True
    r.hyperlink.address = url
    return p


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


# extra pages cloned from the untouched template slides
WIRE2 = clone(S[6], S[6])
SNAP2 = clone(S[10], S[10])

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

# ---------- 2. Brief about the idea ----------
s = S[2]; set_title(s, "Brief about the idea", "Field-to-Fix: dealers file it, OEMs approve it, suppliers solve it")
blocks = [("The problem", RED, "A part fails in the field. The dealer fixes it and writes a short note, often in Hindi or Bahasa. Car makers take about "
           "7 weeks to find the root cause and 9–10 more to fix it at the supplier, while bad parts keep shipping (≈ $58B a year in warranty)."),
          ("Our idea", BLUE, "Five Gemini agents on Google Cloud read every claim (text, photo, voice, any language), spot failure clusters early, trace "
           "them to the exact supplier batch, rank root causes against the factory PFMEA and draft the 8D. People approve every step."),
          ("The result", GREEN, "From first claims to an 8D at the supplier in under a day instead of ~19 weeks, on web, phone and smartwatch.")]
y = 1.5
for t, col, b in blocks:
    dot = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(0.33), Inches(y + 0.04), Inches(0.16), Inches(0.16))
    dot.fill.solid(); dot.fill.fore_color.rgb = rgb(col); dot.line.fill.background()
    text(s, 0.58, y - 0.03, 4.1, 0.3, [(t, {"bold": True, "color": col})], size=12)
    tb = text(s, 0.58, y + 0.25, 4.1, 1.0, [b], size=9.5, color=MUTED)
    y += 1.22 if len(b) > 150 else 0.8
rounded_pic(s, "hero3d.png", 4.95, 1.45, w=4.7, h=2.69)
for i, (big, small, col) in enumerate((("< 1 day", "was ~19 weeks", GREEN), ("5 agents", "Gemini on Vertex AI", BLUE), ("3 screens", "web · phone · watch", ORANGE))):
    x = 4.95 + i * 1.6
    box(s, x, 4.27, 1.5, 0.82, fill="FFFFFF", accent=col)
    text(s, x, 4.38, 1.5, 0.35, [(big, {"bold": True, "color": col})], size=15, align=PP_ALIGN.CENTER)
    text(s, x, 4.72, 1.5, 0.3, [small], size=8.5, color=MUTED, align=PP_ALIGN.CENTER)
footer(s, 2)

# ---------- 3. Opportunities ----------
s = S[3]; set_title(s, "Opportunities")
image(s, "opps3d.png", 0.33, 1.2, w=9.33, border=False)
answers = [
    "Warranty-analytics tools score structured codes on dashboards. Field-to-Fix reads the unstructured part (multilingual notes, photos, "
    "PFMEA documents), puts the dealer, OEM and Tier-1 supplier on one live case, and writes the 8D with every statement cited.",
    "A new claim joins its case in ~6 s instead of waiting for the monthly review. One click traces the cluster to supplier batches and "
    "drafts a cited 8D in about a minute. Gemini then checks the supplier’s reply for gaps before the OEM accepts it.",
    "Early warning: cars at risk before they fail. Numbers come from BigQuery, never the model. A person approves every outbound step. "
    "Works for gloved technicians on a smartwatch. Built for JAPAC dealer networks, works for any OEM.",
]
for i, a in enumerate(answers):
    text(s, 0.55 + i * 3.1, 3.0, 2.85, 2.1, [a], size=10, color=MUTED)
footer(s, 3)

# ---------- 4. Features ----------
s = S[4]; set_title(s, "List of features offered by the solution")
image(s, "features3d.png", 0.33, 1.22, w=9.33, border=False)
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

# ---------- 6–7. Wireframes / mocks (two pages) ----------
s = S[6]; set_title(s, "Wireframes / mock screens of the solution (1/2)", "Desktop and laptop: real screens from the working prototype")
image(s, "wire-desktop.png", 0.5, 1.42, w=9.0, border=False)
footer(s, 6)
s2 = WIRE2; set_title(s2, "Wireframes / mock screens of the solution (2/2)", "Phone and smartwatch: the same live case on the move, at lunch or on the shop floor")
image(s2, "wire-mobile.png", 0.5, 1.42, w=9.0, border=False)
footer(s2, 7)

# ---------- 8. Architecture ----------
s = S[7]; set_title(s, "Architecture diagram of the proposed solution", "Four layers on Google Cloud · two Cloud Run services · region asia-southeast1 · no API keys, one service account")
image(s, "arch3d.png", 0.45, 1.42, w=9.1, border=False)
footer(s, 8)

# ---------- 9. Technologies ----------
s = S[8]; set_title(s, "Technologies used in the solution")
groups = [
    ("Gemini on Vertex AI", BLUE, [("Gemini 2.5 Flash", "Intake (text, photo, voice), Ask, gap check"), ("Gemini 2.5 Pro", "Root causes vs PFMEA, 8D drafting"),
                                    ("gemini-embedding-001", "Clustering (HDBSCAN), live linking"), ("Gemini 2.5 Flash Image", "Demo photos and deck art")]),
    ("Cloud Run + Firebase", ORANGE, [("Cloud Run", "Next.js web app + FastAPI agent API"), ("Firebase Authentication", "Five roles via custom claims + judge"),
                                      ("Firestore", "Live cases, agent log, 8D, chat"), ("Security rules", "Suppliers see only their cases")]),
    ("Data + events", GREEN, [("BigQuery", "Claims, vehicles, batches, stock, PFMEA"), ("Cloud Storage", "Claim photos and voice notes"),
                              ("Pub/Sub", "Asynchronous claim intake"), ("Cloud Scheduler", "Hourly signal scan")]),
    ("App + media", PURPLE, [("Next.js 14 · React · TS", "Responsive web, phone, watch views"), ("Python 3.11 · FastAPI", "Agents, tools, 8D PDF (reportlab)"),
                             ("Cloud Text-to-Speech", "Chirp 3 HD video narration"), ("Remotion", "Motion-design demo video")]),
]
gw = 2.24
for i, (g, col, items) in enumerate(groups):
    x = 0.33 + i * (gw + 0.123)
    box(s, x, 1.4, gw, 3.72, fill="FFFFFF")
    head_ = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(1.4), Inches(gw), Inches(0.5))
    head_.adjustments[0] = 0.2; head_.fill.solid(); head_.fill.fore_color.rgb = rgb(col); head_.line.fill.background()
    text(s, x, 1.47, gw, 0.35, [(g, {"bold": True, "color": "FFFFFF"})], size=11.5, align=PP_ALIGN.CENTER)
    for j, (n, u) in enumerate(items):
        y = 2.05 + j * 0.76
        tile = box(s, x + 0.1, y, gw - 0.2, 0.66, fill="F8FAFD", line="E8EAED")
        bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x + 0.1), Inches(y + 0.1), Inches(0.05), Inches(0.46))
        bar.fill.solid(); bar.fill.fore_color.rgb = rgb(col); bar.line.fill.background()
        text(s, x + 0.22, y + 0.06, gw - 0.38, 0.25, [(n, {"bold": True})], size=9.5)
        text(s, x + 0.22, y + 0.3, gw - 0.38, 0.35, [u], size=8.5, color=MUTED)
footer(s, 9)

# ---------- 10. Estimated cost ----------
s = S[9]; set_title(s, "Estimated implementation cost", "Pilot scale: one OEM, 10,000 claims and ~50 investigations a month · approx. Google Cloud list prices (USD)")
items = [("Cloud Run · agents (always warm)", 100), ("Gemini 2.5 Flash · 10k claims", 12), ("BigQuery, Firestore, Storage, Pub/Sub", 10),
         ("Cloud Run · web (scales to zero)", 5), ("Gemini 2.5 Pro · 50 investigations", 4), ("Embeddings", 1)]
cd = CategoryChartData()
cd.categories = [n for n, _ in items][::-1]
cd.add_series("USD / month", [v for _, v in items][::-1])
gf = s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, Inches(0.33), Inches(1.45), Inches(6.2), Inches(3.6), cd)
ch = gf.chart
ch.has_legend = False; ch.has_title = False
ch.font.size, ch.font.name = Pt(9), FONT
plot = ch.plots[0]; plot.gap_width = 45; plot.has_data_labels = True
dl = plot.data_labels; dl.number_format = '"$"0'; dl.number_format_is_linked = False; dl.position = XL_LABEL_POSITION.OUTSIDE_END
dl.font.size, dl.font.bold = Pt(10), True
cols = [BLUE, ORANGE, GREEN, BLUE, PURPLE, TEAL][::-1]
for i, pt in enumerate(plot.series[0].points):
    pt.format.fill.solid(); pt.format.fill.fore_color.rgb = rgb(cols[i])
va = ch.value_axis; va.visible = False; va.has_major_gridlines = False; va.maximum_scale = 118
ca = ch.category_axis; ca.format.line.fill.background(); ca.tick_labels.font.size = Pt(9.5)
for i, (big, small, col) in enumerate((("≈ $130", "per month, whole pilot", GREEN), ("≈ 1.3¢", "per warranty claim handled", BLUE), ("≈ $0.08", "Gemini cost per investigation", PURPLE))):
    y = 1.45 + i * 1.22
    box(s, 6.75, y, 2.9, 1.1, fill="FFFFFF", accent=col)
    text(s, 6.85, y + 0.14, 2.7, 0.5, [(big, {"bold": True, "color": col})], size=24)
    text(s, 6.85, y + 0.66, 2.7, 0.35, [small], size=9.5, color=MUTED)
footer(s, 10)

# ---------- 11–12. Snapshots (two pages) ----------
def snaps_page(slide, items, n, title):
    set_title(slide, title)
    (big, bcap), *rest = items
    box(slide, 0.33, 1.3, 5.55, 3.82, fill="F8FAFD", line="E8EAED")
    image(slide, big, 0.43, 1.4, w=5.35, h=3.25)
    text(slide, 0.43, 4.72, 5.35, 0.3, [bcap], size=10, color=INK, bold=True, align=PP_ALIGN.CENTER)
    for j, (img_, c) in enumerate(rest):
        y = 1.3 + j * 1.95
        box(slide, 6.03, y, 3.63, 1.87, fill="F8FAFD", line="E8EAED")
        image(slide, img_, 6.1, y + 0.07, w=3.49, h=1.45)
        text(slide, 6.1, y + 1.55, 3.49, 0.28, [c], size=9, color=INK, bold=True, align=PP_ALIGN.CENTER)
    footer(slide, n)


snaps_page(S[10], [("snap-agents.jpg", "Analyst: one click, five agents stream their work live"), ("05-claim-result.jpg", "Dealer: Gemini reads the note and the photo"),
                   ("09-root-cause-ask.jpg", "Ask: grounded answers with citations")], 11, "Snapshots of the prototype (1/2)")
s2 = SNAP2
snaps_page(s2, [("snap-8d.jpg", "Supplier quality: a cited 8D, containment from BigQuery"), ("12-supplier-nosidebar.jpg", "Supplier: Gemini flags 4 gaps in the reply"),
                ("13-activity-tree.jpg", "Audit: every agent step and decision")], 12, "Snapshots of the prototype (2/2)")

# ---------- 13. Performance ----------
s = S[11]; set_title(s, "Prototype performance report / benchmarking", "Measured on the deployed prototype with our synthetic dataset (6,400 vehicles, 630+ claims, 3 languages)")
kpis = [("~6 s", "Claim → linked to its case", "vs the monthly warranty review", BLUE),
        ("59 s", "Click → cited 8D draft", "vs ~7 weeks to the root cause", PURPLE),
        ("< 1 day", "First claims → 8D at supplier", "vs ~19 weeks incl. countermeasure", GREEN),
        ("630 / 630", "Failure category correct", "clean synthetic notes; real data lower", ORANGE),
        ("162 / 162", "Hindi notes understood", "plus Bahasa and English", ORANGE),
        ("56 / 56", "Planted failure claims recalled", "near-duplicate clusters merged at 0.92", BLUE),
        ("2 / 2", "Bad supplier batches found", "KAV-26W31, W32 · lift 2.3× / 1.9×", TEAL),
        ("307", "Cars flagged before failure", "same batch, other model, 0 claims yet", RED),
        ("4", "Gaps caught in supplier reply", "root-cause contradiction detected", AMBER)]
for i, (v, l, b, col) in enumerate(kpis):
    x = 0.33 + (i % 3) * 3.13; y = 1.45 + (i // 3) * 1.24
    box(s, x, y, 3.0, 1.12, fill="FFFFFF")
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y + 0.14), Inches(0.06), Inches(0.84))
    bar.fill.solid(); bar.fill.fore_color.rgb = rgb(col); bar.line.fill.background()
    text(s, x + 0.17, y + 0.08, 2.75, 0.45, [(v, {"bold": True, "color": col})], size=20)
    text(s, x + 0.17, y + 0.53, 2.75, 0.28, [(l, {"bold": True})], size=10)
    text(s, x + 0.17, y + 0.79, 2.75, 0.28, [b], size=8.5, color=MUTED)
footer(s, 13)

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
footer(s, 14)

# ---------- 15. Links ----------
s = S[13]; set_title(s, "Links")
rows = [("GitHub public repository", GITHUB, "Source for the agents, web app, data scripts and video", INK),
        ("Demo video (3–4 minutes)", VIDEO or "[video link]", "Narrated walkthrough of the live prototype", RED),
        ("Final product (deployed on Cloud Run)", LINK, "Tick “I’m a judge” on the login page: one demo account, five roles, a guided six-step tour", BLUE),
        ("Watch view", LINK + "/watch", "Apple Watch and Wear OS screens (open /w for full screen)", GREEN)]
for i, (t, url, note, col) in enumerate(rows):
    y = 1.42 + i * 0.93
    box(s, 0.33, y, 9.33, 0.8, fill="FFFFFF", accent=None)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.33), Inches(y + 0.12), Inches(0.07), Inches(0.56))
    bar.fill.solid(); bar.fill.fore_color.rgb = rgb(col); bar.line.fill.background()
    text(s, 0.55, y + 0.08, 4.2, 0.3, [(t, {"bold": True})], size=12)
    text(s, 0.55, y + 0.42, 4.3, 0.35, [note], size=8.5, color=MUTED)
    tb = s.shapes.add_textbox(Inches(4.9), Inches(y + 0.2), Inches(4.7), Inches(0.4)); tb.text_frame.word_wrap = True
    link(tb.text_frame, url, url if url.startswith("http") else LINK, size=11, first=True)
footer(s, 15)

# ---------- remove the template's instruction slide and the empty extra slide ----------
for sl in (S[1], S[14]):
    delete_slide(prs, sl)

prs.save(OUT)
print("saved", OUT)
