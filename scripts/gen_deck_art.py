"""3D isometric illustrations for the submission deck (Gemini 2.5 Flash Image).

Usage: python scripts/gen_deck_art.py <out dir>
"""
import sys
from io import BytesIO
from pathlib import Path
from google import genai
from google.genai import types
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "agents"))
from f2f.gemini import with_retry

OUT = Path(sys.argv[1])
STYLE = (" Clean 3D isometric illustration, soft clay render, smooth matte materials, gentle studio lighting with soft shadows, "
         "pure white background, colour palette of Google blue #4285F4, red #EA4335, yellow #FBBC05 and green #34A853 with light greys. "
         "No text, no letters, no numbers, no logos, no watermark.")
IMGS = {
    "hero3d": ("16:9", "Three small isometric floating islands connected left to right by glowing blue data paths: on the left a car service workshop "
               "with a car on a lift; in the middle a car factory with a robotic arm and a holographic magnifying glass over a car part; on the right a parts "
               "supplier plant with stacked boxes of hose clamps. A small floating smartwatch and smartphone hover above the paths."),
    "agents3d": ("1:1", "Five rounded glossy cube-shaped robot assistants of different colours (blue, red, yellow, green, purple) standing in a row on a "
                 "white platform, each holding a different tool: a magnifying glass, a chart, a wrench, a lightbulb, a clipboard document."),
    "devices3d": ("16:9", "A laptop, a tablet, a smartphone and two smartwatches (one square, one round) arranged on a white surface in isometric view, "
                  "their screens showing simple abstract dashboard cards and charts in blue, green and yellow."),
}
client = genai.Client(vertexai=True, project="field-to-fix", location="global")
for name, (ar, prompt) in IMGS.items():
    dest = OUT / f"{name}.png"
    if dest.exists(): continue
    cfg = types.GenerateContentConfig(response_modalities=["IMAGE"], image_config=types.ImageConfig(aspect_ratio=ar))
    r = with_retry(client.models.generate_content, model="gemini-2.5-flash-image", contents=prompt + STYLE, config=cfg)
    data = next(p for p in r.candidates[0].content.parts if p.inline_data).inline_data.data
    Image.open(BytesIO(data)).convert("RGB").save(dest)
    print(name, Image.open(dest).size)
