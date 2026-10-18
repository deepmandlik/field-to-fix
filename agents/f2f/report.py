"""8D report as a PDF, laid out like the web report: header, meta grid, colour-coded D0-D8, tables."""
from __future__ import annotations

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.platypus.flowables import Flowable

INK = colors.HexColor("#1f1f1f")
MUTED = colors.HexColor("#5f6368")
FAINT = colors.HexColor("#80868b")
LINE = colors.HexColor("#c4c7c5")
SOFT = colors.HexColor("#f0f4f9")
BLUE, BLUE_SOFT, BLUE_INK = colors.HexColor("#0b57d0"), colors.HexColor("#d3e3fd"), colors.HexColor("#041e49")
AMBER, AMBER_SOFT = colors.HexColor("#8c5000"), colors.HexColor("#ffeac2")
GREEN, GREEN_SOFT = colors.HexColor("#146c2e"), colors.HexColor("#c4eed0")
GREY_SOFT = colors.HexColor("#e9eef6")

STATUS = {"detected": "Detected", "investigating": "Investigating", "sqe_review": "SQE review", "sent_to_supplier": "With supplier",
          "supplier_responded": "Supplier responded", "closed": "Closed", "dismissed": "Dismissed"}
SECTIONS = [
    ("D0", "Prepare & emergency response", "oem"), ("D1", "Team", "oem"), ("D2", "Problem description", "ai"),
    ("D3", "Interim containment", "ai"), ("D4", "Root cause", "ai"), ("D5", "Permanent corrective action", "ai"),
    ("D6", "Implement & validate", "sup"), ("D7", "Prevent recurrence", "sup"), ("D8", "Close & recognise the team", "oem"),
]
WHO = {"ai": ("AI draft · OEM approves", BLUE_SOFT, BLUE_INK), "oem": ("OEM", GREY_SOFT, MUTED), "sup": ("Supplier", AMBER_SOFT, AMBER)}
TEAM = [("Kenji Sato", "Supplier quality engineer", "OEM supplier quality"), ("Ananya Rao", "Warranty analyst", "OEM field quality"),
        ("Suresh Iyer", "Quality manager", "Kaveri Hoses (Tier-1)"), ("Meera Shah", "Head of quality", "OEM"),
        ("Field-to-Fix agents", "Intake, Signal, Trace, Hypothesise, Draft", "Gemini on Vertex AI")]


def _t(s) -> str:
    """Escape for Paragraph markup and map glyphs Helvetica lacks."""
    s = "" if s is None else str(s)
    for a, b in (("&", "&amp;"), ("<", "&lt;"), (">", "&gt;"), ("→", "->"), ("≥", ">="), ("≤", "<="), ("—", "-"), ("’", "'"), ("“", '"'), ("”", '"')):
        s = s.replace(a, b)
    return s.replace("\n", "<br/>")


S = {
    "label": ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=7.5, textColor=FAINT, leading=10),
    "title": ParagraphStyle("title", fontName="Helvetica", fontSize=17, leading=21, textColor=INK),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK),
    "muted": ParagraphStyle("muted", fontName="Helvetica", fontSize=9, leading=13, textColor=MUTED),
    "h": ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=INK),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, leading=11, textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=INK),
    "cite": ParagraphStyle("cite", fontName="Courier", fontSize=8, leading=11, textColor=BLUE),
    "num": ParagraphStyle("num", fontName="Helvetica-Bold", fontSize=11, leading=13, alignment=TA_CENTER),
    "chip": ParagraphStyle("chip", fontName="Helvetica-Bold", fontSize=7.5, leading=9, alignment=TA_CENTER),
}


class Logo(Flowable):
    """The Field-to-Fix mark: warm rounded square with a loop arrow and a check."""
    def __init__(self, size=13 * mm):
        super().__init__()
        self.size = size

    def wrap(self, *_):
        return self.size, self.size

    def draw(self):
        c, s = self.canv, self.size
        for i, col in enumerate(("#ffca28", "#ffa000", "#f4511e")):  # stepped gradient
            c.setFillColor(colors.HexColor(col))
            c.roundRect(0, s * i / 3, s, s - s * i / 3, s * 0.27, stroke=0, fill=1)
        c.setStrokeColor(colors.white)
        c.setLineWidth(s * 0.085)
        c.setLineCap(1)
        c.setLineJoin(1)
        p = c.beginPath()
        p.moveTo(s * .27, s * .35); p.curveTo(s * .27, s * .55, s * .40, s * .69, s * .56, s * .69); p.lineTo(s * .69, s * .69)
        c.drawPath(p, stroke=1, fill=0)
        p = c.beginPath(); p.moveTo(s * .60, s * .79); p.lineTo(s * .71, s * .69); p.lineTo(s * .60, s * .59)
        c.drawPath(p, stroke=1, fill=0)
        p = c.beginPath(); p.moveTo(s * .42, s * .35); p.lineTo(s * .52, s * .25); p.lineTo(s * .71, s * .46)
        c.drawPath(p, stroke=1, fill=0)
        c.setFillColor(colors.white)
        c.circle(s * .27, s * .35, s * .06, stroke=0, fill=1)


def _chip(text, bg, fg, width=None):
    t = Table([[Paragraph(_t(text), ParagraphStyle("c", parent=S["chip"], textColor=fg))]], colWidths=[width] if width else None)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("ROUNDEDCORNERS", [4, 4, 4, 4]),
                           ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                           ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6)]))
    return t


def _grid(rows, widths, header=True):
    data = [[Paragraph(_t(c), S["cellb"] if (header and i == 0) else S["cell"]) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    st = [("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if header:
        st.append(("BACKGROUND", (0, 0), (-1, 0), SOFT))
    t.setStyle(TableStyle(st))
    return t


def _kv(rows, widths):
    data = [[Paragraph(_t(k), S["cellb"]), Paragraph(_t(v), S["cell"])] for k, v in rows]
    t = Table(data, colWidths=widths)
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, LINE), ("BACKGROUND", (0, 0), (0, -1), SOFT),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    return t


def _pct(x):
    return f"{round((x or 0) * 100)}%"


def build_pdf(c: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm, bottomMargin=16 * mm,
                            title=f"{c['id']} 8D report", author="Field-to-Fix")
    W = doc.width
    e8 = c.get("eight_d", {}) or {}
    t = c.get("trace", {}) or {}
    status = c.get("status", "")
    closed = status == "closed"
    st_bg, st_fg = (GREEN_SOFT, GREEN) if closed else (AMBER_SOFT, AMBER) if status == "sqe_review" else (BLUE_SOFT, BLUE_INK)
    story = []

    # header
    head = Table([[Logo(), [Paragraph("8D PROBLEM-SOLVING REPORT", S["label"]), Paragraph(_t(c.get("title")), S["title"])],
                   [Paragraph(f"<font name='Courier'>{_t(c['id'])}-8D</font>", ParagraphStyle("r", parent=S["body"], alignment=2)),
                    Spacer(1, 3), _chip(STATUS.get(status, status), st_bg, st_fg, 30 * mm)]]],
                 colWidths=[17 * mm, W - 17 * mm - 36 * mm, 36 * mm])
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, 0), 1.6, INK),
                              ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("LEFTPADDING", (0, 0), (0, 0), 0), ("ALIGN", (2, 0), (2, 0), "RIGHT")]))
    story += [head, Spacer(1, 10)]

    at_risk = sum(m.get("vins_at_risk", 0) for m in t.get("other_models_at_risk", []) or [])
    meta = [("Part", t.get("part_name", "-")), ("Part no.", t.get("part_no", "-")), ("Supplier", c.get("supplier_name", "-")),
            ("Customer", f"OEM · Plant {(t.get('plants') or [{}])[0].get('id', '-')}"), ("Field claims", c.get("count")),
            ("First claim", c.get("first_seen")), ("Suspect batches", ", ".join(t.get("suspect_batches", []) or []) or "-"),
            ("VINs at risk", f"{at_risk} (no claims yet)")]
    cells = [[[Paragraph(k.upper(), S["label"]), Paragraph(_t(v), S["cell"])] for k, v in meta[i:i + 4]] for i in (0, 4)]
    mt = Table(cells, colWidths=[W / 4] * 4)
    mt.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story += [mt, Spacer(1, 6)]

    body_w = W - 16 * mm
    for k, title, who in SECTIONS:
        sec = e8.get(k, {}) or {}
        sup = (e8.get(f"{k}_supplier") or {}).get("text")
        text = sec.get("text") or ""
        if k == "D0" and not text:
            text = (f"Field cluster detected by the Signal agent: {c.get('count')} claims, "
                    f"{(c.get('growth_x') or 0):.1f}x baseline. Analyst escalated for agent investigation.")
        if who == "sup":
            text = sup or ""
        if k == "D8":
            text = f"Closed {c['closed_at'].strftime('%d %b %Y %H:%M') if hasattr(c.get('closed_at'), 'strftime') else ''}. Supplier response accepted by supplier quality." if closed else ""
        done = bool(text) if who != "ai" else False
        num_bg, num_fg = (GREEN_SOFT, GREEN) if done else {"ai": (BLUE_SOFT, BLUE_INK), "sup": (AMBER_SOFT, AMBER), "oem": (GREY_SOFT, MUTED)}[who]
        label, cbg, cfg = WHO[who]

        def badge(txt, bg, fg):
            return f" &nbsp;<font name='Helvetica-Bold' size='7.5' color='{fg.hexval().replace('0x', '#')}' backColor='{bg.hexval().replace('0x', '#')}'>&nbsp;{_t(txt)}&nbsp;</font>"
        heading = _t(title) + badge(label, cbg, cfg) + (badge("edited by SQE", GREY_SOFT, MUTED) if sec.get("edited_by") else "")
        content = [Paragraph(heading, S["h"]), Spacer(1, 4)]
        if k == "D1":
            content.append(_grid([("Name", "Role", "Organisation")] + TEAM, [body_w * .28, body_w * .40, body_w * .32]))
        else:
            empty = {"sup": "Waiting for the supplier's response.", "oem": "Completed when supplier quality accepts the response."}.get(who, "-")
            content.append(Paragraph(_t(text) if text else f"<font color='#80868b'>{empty}</font>", S["body"]))
        if k == "D2" and t.get("models"):
            content += [Spacer(1, 5), _kv([
                ("Models", ", ".join(f"{m['id']} ({_pct(m['share'])})" for m in t["models"])),
                ("Plants · build weeks", f"{', '.join(p['id'] for p in t.get('plants', []))} · {', '.join(w['id'] for w in t.get('build_weeks', []))}"),
                ("Batch concentration", " · ".join(f"{b['batch_id']} {_pct(b['share'])} (lift {b.get('lift')}x)" for b in t.get("batches", [])[:3])),
            ], [body_w * .28, body_w * .72])]
        if k == "D3" and t.get("stock"):
            rows = [("Batch", "Location", "Type", "Qty to quarantine")]
            rows += [(s["batch_id"], s["location"], s["location_type"], f"{s['qty_on_hand']:,}") for s in t["stock"] if s.get("qty_on_hand")]
            rows += [("-", f"Fitted vehicles, {m['model']} (no claims yet): inspect at next service", "vehicles", f"{m['vins_at_risk']} VINs")
                     for m in t.get("other_models_at_risk", []) or []]
            g = _grid(rows, [body_w * .2, body_w * .46, body_w * .14, body_w * .2])
            g.setStyle(TableStyle([("ALIGN", (3, 0), (3, -1), "RIGHT")]))
            content += [Spacer(1, 5), g]
        for kk, lab in (("D4", "Supplier confirmation"), ("D5", "Supplier action")):
            if k == kk and sup:
                content += [Spacer(1, 4), Paragraph(f"<b>{lab}:</b> {_t(sup)}", S["body"])]
        if sec.get("cites"):
            content += [Spacer(1, 4), Paragraph("Sources: " + "  ".join(_t(x) for x in sec["cites"]), S["cite"])]

        row = Table([[Paragraph(k, ParagraphStyle("n", parent=S["num"], textColor=num_fg)), content]], colWidths=[12 * mm, W - 12 * mm])
        row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 0), (0, 0), num_bg),
                                 ("ROUNDEDCORNERS", [5, 5, 5, 5]), ("LEFTPADDING", (1, 0), (1, 0), 10),
                                 ("TOPPADDING", (0, 0), (0, 0), 7), ("BOTTOMPADDING", (0, 0), (0, 0), 7)]))
        wrap_t = Table([[row]], colWidths=[W])
        wrap_t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE), ("TOPPADDING", (0, 0), (-1, -1), 8),
                                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
        story.append(KeepTogether([wrap_t]) if k not in ("D3",) else wrap_t)

    chk = c.get("supplier_check")
    if chk:
        items = "<br/>".join(f"• {_t(g)}" for g in chk.get("gaps", [])) or "No gaps found."
        box = Table([[Paragraph("<b>AI completeness check of the supplier response</b> — "
                                + ("complete" if chk.get("complete") else f"{len(chk.get('gaps', []))} gaps"), S["body"])],
                     [Paragraph(items, S["body"])]], colWidths=[W])
        box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GREEN_SOFT if chk.get("complete") else AMBER_SOFT),
                                 ("ROUNDEDCORNERS", [6, 6, 6, 6]), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 6)]))
        story += [Spacer(1, 10), box]

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(FAINT)
        canvas.drawString(16 * mm, 9 * mm, f"Field-to-Fix · {c['id']}-8D · generated {datetime.now().strftime('%d %b %Y %H:%M')} · "
                                           "AI-drafted sections cite sources; quantities come from BigQuery")
        canvas.drawRightString(A4[0] - 16 * mm, 9 * mm, f"Page {d.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
