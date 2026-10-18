"""Cinematic 16:9 stills for the video's b-roll with Gemini 2.5 Flash Image (Veo was not enabled on the project)."""
import sys
from io import BytesIO
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
STYLE = " Cinematic film still, realistic photograph, shallow depth of field, soft natural light, wide 16:9 framing. No text, no captions, no logos, no brand names, no watermark."
STILLS = {
    "broll-coolant": "Inside a modern car service workshop: green coolant drips from a cracked metal hose clamp on a black radiator hose under an open car hood; a mechanic in grey work gloves reaches toward it.",
    "broll-note": "A mechanic in a car workshop holds a tablet and types a short repair note with one finger, gloves tucked under his arm, a car on a lift behind him.",
    "broll-lunch": "A young automotive quality engineer in safety glasses eats lunch in a bright factory canteen and glances at the lit smartwatch on his wrist.",
    "broll-factory": "A clean automotive parts production line: a worker in a blue uniform checks hose clamp assemblies with a digital torque tool at a workstation.",
}
client = genai.Client(vertexai=True, project="field-to-fix", location="global")
for name, prompt in STILLS.items():
    dest = OUT / f"{name}.jpg"
    if dest.exists():
        print(name, "exists"); continue
    try:
        cfg = types.GenerateContentConfig(response_modalities=["IMAGE"], image_config=types.ImageConfig(aspect_ratio="16:9"))
    except Exception:
        cfg = types.GenerateContentConfig(response_modalities=["IMAGE"])
    sys.path.insert(0, "/Users/deepmandlik/Trading-Agent/field-to-fix/agents")
    from f2f.gemini import with_retry
    r = with_retry(client.models.generate_content, model="gemini-2.5-flash-image", contents=prompt + STYLE, config=cfg)
    data = next(p for p in r.candidates[0].content.parts if p.inline_data).inline_data.data
    im = Image.open(BytesIO(data)).convert("RGB")
    w, h = im.size
    if abs(w / h - 16 / 9) > 0.05:  # centre-crop to 16:9 if the model returned another shape
        nh = int(w * 9 / 16)
        if nh <= h:
            im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
        else:
            nw = int(h * 16 / 9); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    im.save(dest, "JPEG", quality=90)
    print(name, im.size)
