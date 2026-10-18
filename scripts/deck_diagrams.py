"""3D layer diagrams and device mockups for the submission deck, rendered to PNG with headless Chrome.

Oblique 3D projection: x to the right, y (depth) up-right, z up. Front faces stay undistorted, so labels on them read cleanly.
Usage: python scripts/deck_diagrams.py <screens dir> <out dir>
"""
from __future__ import annotations

import base64
import subprocess
import sys
from pathlib import Path

SHOTS, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FONT = "'Google Sans','Roboto','Helvetica Neue',Arial,sans-serif"
DX, DY = 0.42, 0.5  # screen offset per unit of depth
BLUE, RED, YELLOW, GREEN, PURPLE, TEAL, ORANGE, GREY = "#4285F4", "#EA4335", "#FBBC05", "#34A853", "#A142F4", "#12B5CB", "#FA7B17", "#9AA0A6"
INK, MUTED = "#202124", "#5F6368"


def mix(hex_, other, t):
    a = [int(hex_[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(other[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(a, b))


def P(x, y, z):  # world -> screen; (x, z) measured from the screen's bottom-left baseline set by the caller
    return x + y * DX, -y * DY - z


def poly(pts, fill, stroke="none", extra=""):
    return f'<polygon points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in pts)}" fill="{fill}" stroke="{stroke}" stroke-width="1" stroke-linejoin="round" {extra}/>'


def box(x, y, z, w, d, h, color, top=None, right=None, front=None, ox=0, oy=0):
    """Return SVG for a solid box. (ox, oy) is the screen position of world origin."""
    def p(a, b, c):
        sx, sy = P(a, b, c)
        return sx + ox, sy + oy
    top = top or mix(color, "#FFFFFF", 0.35)
    right = right or mix(color, "#000000", 0.22)
    front = front or color
    edge = mix(color, "#000000", 0.12)
    return "".join([
        poly([p(x, y, z), p(x + w, y, z), p(x + w, y, z + h), p(x, y, z + h)], front, edge),
        poly([p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)], top, edge),
        poly([p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x + w, y, z + h)], right, edge),
    ])


def shadow(x, y, w, d, ox, oy, drop=16, alpha=0.16):
    def p(a, b):
        sx, sy = P(a, b, 0)
        return sx + ox, sy + oy + drop
    return poly([p(x - 6, y), p(x + w + 6, y), p(x + w + 6, y + d), p(x - 6, y + d)], f"rgba(32,33,36,{alpha})", extra='filter="url(#blur)"')


def txt(x, y, s, size, color=INK, weight=400, anchor="start", extra=""):
    s = s.replace("&", "&amp;").replace("<", "&lt;")
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}" {extra}>{s}</text>'


def chip(cx, base_y, w, h, d, color, title, sub=None):
    """A standing 3D tile whose front face carries a label. (cx, base_y) = front-bottom-left on screen.
    Tiles take their layer's colour as a soft tint, so colour only ever signals which layer a tile belongs to."""
    out = box(0, 0, 0, w, d, h, color, top=mix(color, "#FFFFFF", 0.55), right=mix(color, "#FFFFFF", 0.4), front=mix(color, "#FFFFFF", 0.9), ox=cx, oy=base_y)
    out = out.replace(f'stroke="{mix(color, "#000000", 0.12)}"', f'stroke="{mix(color, "#FFFFFF", 0.35)}"')
    ink = mix(color, "#000000", 0.45)
    if sub:
        out += txt(cx + w / 2, base_y - h + h * 0.44, title, 25, ink, 700, "middle")
        out += txt(cx + w / 2, base_y - h + h * 0.78, sub, 19, MUTED, 400, "middle")
    else:
        out += txt(cx + w / 2, base_y - h / 2 + 9, title, 25, ink, 700, "middle")
    return out


def tier_stack(tiers, W, H, x0, x1, base0, pitch, D=150, T=22, chip_h=70, chip_d=30, label_w=None, right_svg=""):
    """tiers: bottom->top list of dicts {name, sub, color, chips: [(title, sub, color)]}"""
    parts = []
    for i, t in enumerate(tiers):
        oy = base0 - i * pitch
        w = x1 - x0
        slab = mix(t["color"], "#FFFFFF", 0.78)
        parts.append(shadow(0, 0, w, D, x0, oy))
        parts.append(box(0, 0, 0, w, D, T, slab, top=mix(t["color"], "#FFFFFF", 0.88), right=mix(t["color"], "#FFFFFF", 0.55),
                         front=mix(t["color"], "#FFFFFF", 0.65), ox=x0, oy=oy))
        n = len(t["chips"])
        gap = 16
        cw = (w - 40 - gap * (n - 1)) / n
        cy = oy - T - 14 * DY  # chips stand 14 units back from the slab's front edge
        for j, (ct, cs, _) in enumerate(t["chips"]):
            cx = x0 + 20 + 14 * DX + j * (cw + gap)
            parts.append(chip(cx, cy, cw, chip_h, chip_d, t["color"], ct, cs))
        # tier label on the left, centred on the slab
        ly = oy - T / 2 - chip_h / 2 + 4
        parts.append(f'<rect x="8" y="{ly - 34:.1f}" width="8" height="64" rx="4" fill="{t["color"]}"/>')
        parts.append(txt(30, ly, t["name"], 31, INK, 700))
        parts.append(txt(30, ly + 30, t["sub"], 20, MUTED))
    return svg(W, H, "".join(parts) + right_svg)


def svg(W, H, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{FONT}">'
            '<defs><filter id="blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>'
            '<marker id="ah" markerUnits="userSpaceOnUse" markerWidth="24" markerHeight="24" refX="14" refY="12" orient="auto"><path d="M0,0 L24,12 L0,24 z" fill="context-stroke"/></marker>'
            '</defs>' + body + '</svg>')


def arrow(x1, y1, x2, y2, color, width=4):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}" stroke-linecap="round" marker-end="url(#ah)"/>'


def render(name, html, W, H, scale=1.5):
    page = OUT / f"{name}.html"
    page.write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>html,body{{margin:0;background:transparent}}'
                    f'body{{width:{W}px;height:{H}px;overflow:hidden;font-family:{FONT}}}</style></head><body>{html}</body></html>')
    png = OUT / f"{name}.png"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--window-size={W},{H}",
                    f"--force-device-scale-factor={scale}", "--default-background-color=00000000",
                    f"--screenshot={png}", page.as_uri()], check=True, capture_output=True)
    print(name, png)


# ---------------- architecture: four layers ----------------
W, H = 1866, 760
base0, pitch = 728, 172
ys = [base0 - i * pitch for i in range(4)]  # slab front-bottom per tier
mid = lambda i: ys[i] - 60
right = "".join([
    arrow(1640, mid(3) + 40, 1640, mid(2) - 26, BLUE), txt(1662, (mid(3) + mid(2)) / 2 + 8, "sign in · use", 21, MUTED),
    arrow(1640, mid(2) + 40, 1640, mid(1) - 26, BLUE), txt(1662, (mid(2) + mid(1)) / 2 - 4, "HTTPS +", 21, MUTED), txt(1662, (mid(2) + mid(1)) / 2 + 20, "ID token", 21, MUTED),
    arrow(1640, mid(1) + 40, 1640, mid(0) - 26, BLUE), txt(1662, (mid(1) + mid(0)) / 2 - 4, "Gemini calls,", 21, MUTED), txt(1662, (mid(1) + mid(0)) / 2 + 20, "SQL, writes", 21, MUTED),
    arrow(1846, mid(0), 1846, mid(2) - 30, GREEN, 5),
    f'<text transform="translate(1832,{(mid(0) + mid(2)) / 2:.0f}) rotate(-90)" font-size="20" font-weight="700" fill="{GREEN}" text-anchor="middle">Firestore realtime</text>',
])
arch = tier_stack([
    {"name": "Data & AI", "sub": "Vertex AI · BigQuery", "color": YELLOW, "chips": [
        ("Gemini", "3.8 Flash + 4 Argon", BLUE), ("Embeddings", "gemini-embedding", PURPLE), ("BigQuery", "claims, batches", BLUE),
        ("Firestore", "live cases, log", ORANGE), ("Storage", "photos, voice", GREEN), ("Pub/Sub", "+ Scheduler", RED)]},
    {"name": "Agents", "sub": "Cloud Run · Google ADK", "color": BLUE, "chips": [
        ("Intake", "text, photo, voice", ORANGE), ("Signal", "clusters", BLUE), ("Trace", "batch + lift", TEAL),
        ("Hypothesise", "vs PFMEA", PURPLE), ("Draft 8D", "cited", GREEN), ("Ask", "on Agent Engine", RED)]},
    {"name": "Experience", "sub": "Cloud Run · Firebase", "color": GREEN, "chips": [
        ("Next.js web app", "Cloud Run", BLUE), ("Firebase Auth", "5 roles + judge", ORANGE),
        ("Phone + tablet", "responsive", GREEN), ("Watch view", "watchOS · Wear OS", RED)]},
    {"name": "People", "sub": "web · phone · watch", "color": GREY, "chips": [
        ("Dealer", "files claim", ORANGE), ("Analyst", "investigates", BLUE), ("Supplier quality", "approves 8D", PURPLE),
        ("Tier-1 supplier", "fixes", TEAL), ("Head of quality", "oversees", GREEN)]},
], W, H, 300, 1540, base0, pitch, right_svg=right)
render("arch3d", arch, W, H)

# ---------------- features: four layers of three ----------------
W, H = 1866, 770
feat = tier_stack([
    {"name": "4 · Act", "sub": "people stay in charge", "color": GREEN, "chips": [
        ("Supplier portal + AI check", "Gemini flags gaps in replies", GREEN), ("Hold-to-approve on watch", "Apple Watch and Wear OS", RED),
        ("Cost of waiting", "₹ per day a case stays open", BLUE)]},
    {"name": "3 · Decide", "sub": "cited, never guessed", "color": PURPLE, "chips": [
        ("Cited root causes", "ranked against the PFMEA", PURPLE), ("AI-drafted 8D + PDF", "containment from BigQuery", GREEN),
        ("Ask Gemini", "grounded answers with sources", BLUE)]},
    {"name": "2 · Detect", "sub": "weeks become minutes", "color": BLUE, "chips": [
        ("Signal clustering", "groups claims by meaning", BLUE), ("Trace to supplier batch", "VIN → part → supplier → batch", TEAL),
        ("Early warning", "307 cars at risk, 0 claims yet", RED)]},
    {"name": "1 · Capture", "sub": "any language, any device", "color": ORANGE, "chips": [
        ("Text + photo + voice intake", "Gemini reads any language", ORANGE), ("Live claim linking", "joins the right case in ~6 s", YELLOW),
        ("Wrist dictation", "gloved technicians just speak", RED)]},
][::-1], W, H, 300, 1770, 752, 186, chip_h=86, chip_d=30)
render("features3d", feat, W, H)

# ---------------- opportunities: three rising 3D blocks ----------------
W, H = 1866, 250
parts = []
specs = [("1", "How is it different?", BLUE, 110), ("2", "How does it solve it?", BLUE, 110), ("3", "What is the USP?", BLUE, 110)]
for i, (n, label, col, h) in enumerate(specs):
    x0 = 60 + i * 620
    parts.append(shadow(0, 0, 470, 120, x0, 225))
    parts.append(box(0, 0, 0, 470, 120, h, col, ox=x0, oy=225))
    parts.append(txt(x0 + 30, 225 - h / 2 + 22, n, 64, "#FFFFFF" if col != YELLOW else INK, 800))
    parts.append(txt(x0 + 90, 225 - h / 2 + 12, label, 34, "#FFFFFF", 700))
render("opps3d", svg(W, H, "".join(parts)), W, H)


# ---------------- device mockups ----------------
def b64(p):
    return "data:image/png;base64," + base64.b64encode(Path(p).read_bytes()).decode()


def browser(src, url, w):
    return (f'<div style="width:{w}px;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 30px 60px rgba(32,33,36,.22),0 0 0 2px #DADCE0">'
            '<div style="height:44px;background:#F1F3F4;display:flex;align-items:center;gap:10px;padding:0 18px">'
            + "".join(f'<span style="width:14px;height:14px;border-radius:7px;background:{c}"></span>' for c in ("#EA4335", "#FBBC05", "#34A853"))
            + f'<span style="margin-left:14px;flex:1;height:28px;border-radius:14px;background:#fff;color:#5F6368;font-size:17px;line-height:28px;padding-left:16px">{url}</span></div>'
            f'<img src="{b64(src)}" style="display:block;width:100%"></div>')


def phone(src, h):
    w = h * 1170 / 2532
    return (f'<div style="height:{h}px;width:{w}px;padding:14px;border-radius:{h * 0.075}px;background:#1F1F1F;'
            'box-shadow:0 30px 60px rgba(32,33,36,.28),inset 0 0 0 3px #3C4043;position:relative">'
            f'<img src="{b64(src)}" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:{h * 0.06}px;display:block">'
            '</div>')


def cap(t, s):
    return f'<div style="margin-top:22px;text-align:center"><div style="font-size:26px;font-weight:700;color:{INK}">{t}</div><div style="font-size:20px;color:{MUTED};margin-top:4px">{s}</div></div>'


W, H = 1866, 770
desk = (f'<div style="display:flex;gap:56px;justify-content:center;align-items:flex-start;padding:16px 20px 0">'
        f'<div>{browser(SHOTS / "05-claim-result.png", "f2f-web…run.app/claim", 880)}{cap("Dealer · file a claim", "Gemini reads the Hindi note and the photo, then links the case")}</div>'
        f'<div>{browser(SHOTS / "08-case-overview.png", "f2f-web…run.app/case/coolant-leak", 880)}{cap("Analyst · case overview", "Trace, charts and early warning in one view")}</div></div>')
render("wire-desktop", desk, W, H)

def watch(f, w, round_=False):  # clip the screenshot to the watch body so its page background never shows
    clip = "border-radius:50%" if round_ else "border-radius:30% / 25%"
    inset = 0.035 if round_ else 0.05
    return (f'<div style="width:{w}px;{clip};overflow:hidden;box-shadow:0 24px 40px rgba(32,33,36,.28)">'
            f'<img src="{b64(SHOTS / f)}" style="width:{w * (1 + 2 * inset)}px;margin:-{w * inset}px;display:block"></div>')
mob = ('<div style="display:flex;gap:44px;justify-content:center;align-items:flex-end;padding:14px 10px 0">'
       f'<div style="display:flex;flex-direction:column;align-items:center">{phone(SHOTS / "p1-phone-claim.png", 560)}{cap("Phone · claim", "Dealer files on the go")}</div>'
       f'<div style="display:flex;flex-direction:column;align-items:center">{phone(SHOTS / "p2-phone-case.png", 560)}{cap("Phone · case", "Analyst follows the agents")}</div>'
       '<div style="width:2px;height:520px;background:#DADCE0;align-self:center;margin:0 6px"></div>'
       f'<div style="display:flex;flex-direction:column;align-items:center">{watch("w1-apple-analyst.png", 300)}{cap("Apple Watch · queue", "What needs you, now")}</div>'
       f'<div style="display:flex;flex-direction:column;align-items:center">{watch("w2-apple-sqe-case.png", 300)}{cap("Hold to approve", "One firm press, no slips")}</div>'
       f'<div style="display:flex;flex-direction:column;align-items:center">{watch("w3-wear-sqe-case.png", 320, True)}{cap("Wear OS · round", "Same flow, any watch")}</div>'
       '</div>')
render("wire-mobile", mob, W, H)


# ---------------- architecture on Google Cloud (flat, GCP-console style) ----------------
def gcp_arch():
    W, H = 1866, 780
    KIND = {"compute": BLUE, "data": GREEN, "ai": PURPLE, "msg": ORANGE, "auth": YELLOW, "user": GREY}

    def node(x, y, w, h, kind, title, sub="", extra=""):
        c = KIND[kind]
        return (f'<div class="n" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-color:{mix(c, "#FFFFFF", 0.45)}">'
                f'<div class="ic" style="background:{c}"></div><div class="t">{title}</div><div class="s">{sub}</div>{extra}</div>')

    def tile(name, sub):
        return f'<div class="tile"><b>{name}</b><span>{sub}</span></div>'

    agents = "".join(tile(n, s) for n, s in (("1 · Intake", "3.8 Flash · any language"), ("2 · Signal", "embeddings · clusters"),
                                              ("3 · Trace", "BigQuery · batch + lift"), ("4 · Hypothesise", "4 Argon · vs PFMEA"),
                                              ("5 · Draft 8D", "3.8 Flash · cited"), ("Ask", "on Agent Engine")))
    users = ('<div class="users"><div class="ut">People</div>'
             + "".join(f'<div class="u">{u}</div>' for u in ("Dealer", "Warranty analyst", "Supplier quality", "Tier-1 supplier", "Head of quality"))
             + '<div class="us">web · phone · watch</div></div>')
    legend = ('<div class="legend">' + "".join(f'<span><i style="background:{KIND[k]}"></i>{t}</span>' for k, t in
              (("compute", "Compute"), ("auth", "Identity"), ("data", "Data"), ("ai", "AI"), ("msg", "Events"))) + "</div>")
    body = (
        f'<div class="frame"></div><div class="gct"><span class="gl">Google Cloud</span> · asia-southeast1</div>'
        + users + legend
        + node(300, 92, 300, 108, "auth", "Firebase Auth", "5 roles via custom claims + judge")
        + node(300, 300, 300, 170, "compute", "Next.js web app", "Cloud Run · f2f-web<br>dashboards · phone · watch views")
        + node(700, 92, 620, 398, "compute", "FastAPI agent API", "Cloud Run · f2f-agents · orchestrated by Google ADK",
               f'<div class="grid3">{agents}</div><div class="seq">ADK SequentialAgent: Trace → Hypothesise → Draft 8D</div>')
        + node(1420, 92, 400, 118, "data", "Cloud Firestore", "cases · agent log · approvals · 8D · chat")
        + node(1420, 252, 400, 108, "data", "Cloud Storage", "claim photos · voice notes")
        + node(1420, 402, 400, 108, "data", "BigQuery", "claims · vehicles · batches · stock · PFMEA")
        + node(300, 572, 300, 150, "msg", "Pub/Sub + Scheduler", "async claim intake · hourly signal scan")
        + node(700, 572, 300, 150, "ai", "Vertex AI · Gemini", "3.8 Flash · 4 Argon<br>gemini-embedding-001")
        + node(1020, 572, 300, 150, "ai", "Vertex AI Agent Engine", "Ask agent (Google ADK)<br>1 warm instance")
        + node(1420, 572, 400, 150, "user", "No API keys", "one service account (f2f-run) calls Vertex AI, BigQuery, Firestore and Storage")
    )

    def ln(d, color=INK, dash=False, both=False, label="", lx=0, ly=0, anchor="middle"):
        m = 'marker-end="url(#a)"' + (' marker-start="url(#as)"' if both else "")
        out = f'<path d="{d}" fill="none" stroke="{color}" stroke-width="3" {"stroke-dasharray=&quot;9 7&quot;" if dash else ""} {m}/>'
        if label:
            out += f'<text x="{lx}" y="{ly}" text-anchor="{anchor}" font-size="18" fill="{MUTED}">{label}</text>'
        return out

    G = mix(GREEN, "#000000", 0.1)
    arrows = (
        '<defs><marker id="a" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" refX="12" refY="8" orient="auto">'
        f'<path d="M0,0 L16,8 L0,16 z" fill="context-stroke"/></marker>'
        '<marker id="as" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" refX="4" refY="8" orient="auto-start-reverse">'
        '<path d="M0,0 L16,8 L0,16 z" fill="context-stroke"/></marker></defs>'
        + ln("M232,386 L296,386", label="HTTPS", lx=264, ly=374)
        + ln("M450,298 L450,204", both=True, label="sign in · ID token", lx=462, ly=258, anchor="start")
        + ln("M602,400 L696,400", label="REST +", lx=649, ly=430) + f'<text x="649" y="452" text-anchor="middle" font-size="18" fill="{MUTED}">ID token</text>'
        + ln("M1322,150 L1416,150", both=True, label="writes", lx=1369, ly=138)
        + ln("M1322,306 L1416,306", both=True, label="files", lx=1369, ly=294)
        + ln("M1322,456 L1416,456", both=True, label="SQL tools", lx=1369, ly=444)
        + ln("M850,492 L850,568", label="structured calls", lx=862, ly=536, anchor="start")
        + ln("M1170,492 L1170,568", label="Ask", lx=1182, ly=536, anchor="start")
        + ln("M602,640 L660,640 L660,470 L696,470", color=ORANGE, label="push · cron", lx=668, ly=560, anchor="start")
        + ln("M1620,90 L1620,58 L650,58 L650,330 L606,330", color=G, dash=True)
        + f'<text x="1135" y="48" text-anchor="middle" font-size="18" font-weight="700" fill="{G}">Firestore realtime listeners: every screen updates live</text>'
    )
    css = f"""
    .frame{{position:absolute;left:262px;top:14px;width:1590px;height:752px;border:2px solid #DADCE0;border-radius:18px;background:#F8FAFD}}
    .fh{{position:absolute;left:0;top:0;right:0;height:0;padding:0}}
    .fh{{display:none}}
    .n{{position:absolute;background:#fff;border:2px solid;border-radius:14px;padding:16px 18px;box-sizing:border-box;box-shadow:0 2px 6px rgba(32,33,36,.08)}}
    .ic{{position:absolute;right:16px;top:16px;width:26px;height:26px;border-radius:7px}}
    .t{{font-size:25px;font-weight:700;color:{INK};padding-right:34px}}
    .s{{font-size:18px;color:{MUTED};margin-top:6px;line-height:1.3}}
    .grid3{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}}
    .tile{{background:{mix(BLUE, "#FFFFFF", 0.9)};border:1.5px solid {mix(BLUE, "#FFFFFF", 0.6)};border-radius:10px;padding:12px 12px;display:flex;flex-direction:column;gap:4px}}
    .tile b{{font-size:20px;color:{mix(BLUE, "#000000", 0.45)}}} .tile span{{font-size:16px;color:{MUTED}}}
    .seq{{margin-top:14px;font-size:17px;color:{mix(BLUE, "#000000", 0.35)};font-weight:600}}
    .users{{position:absolute;left:10px;top:240px;width:222px;background:#fff;border:2px solid #DADCE0;border-radius:14px;padding:14px;box-sizing:border-box}}
    .ut{{font-size:24px;font-weight:700;color:{INK};margin-bottom:8px}} .u{{font-size:17px;color:{INK};padding:5px 0;border-bottom:1px solid #F1F3F4}}
    .us{{font-size:16px;color:{MUTED};margin-top:8px}}
    .legend{{position:absolute;left:10px;top:600px;width:222px;display:flex;flex-direction:column;gap:8px;font-size:17px;color:{MUTED}}}
    .legend i{{display:inline-block;width:16px;height:16px;border-radius:4px;margin-right:8px;vertical-align:-2px}}
    .gct{{position:absolute;left:300px;top:34px;font-size:22px;color:{MUTED}}} .gl{{font-weight:700;color:{INK}}}
    svg.ov{{position:absolute;left:0;top:0}}
    """
    html = (f'<style>{css}</style><div style="position:relative;width:{W}px;height:{H}px">{body}'
            f'<svg class="ov" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{FONT}">{arrows}</svg></div>')
    render("arch-gcp", html, W, H)


gcp_arch()
