"""Generate the demo's sample dealer photos with Imagen on Vertex AI, save them for the web app,
and upload them to Cloud Storage so the Intake agent can read them.

These are AI-generated illustrations, labelled as such in the UI. No brand marks.

Usage: python scripts/gen_sample_photos.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "agents"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / "agents" / ".env")

from google import genai  # noqa: E402
from google.cloud import storage  # noqa: E402
from google.genai import types  # noqa: E402

from f2f.config import settings  # noqa: E402

PHOTOS = {
    "clamp-loose": "Realistic close-up photo inside a car engine bay of a radiator hose joint with a loose metal worm-gear hose clamp, "
                   "green coolant residue and droplets around the joint, white crusty dried coolant, shallow depth of field, natural workshop light",
    "clamp-crack": "Realistic macro photo of a metal spring band hose clamp with a clearly visible crack across the band, fitted on a black "
                   "rubber coolant hose, on a mechanic's workbench, sharp focus",
    "coolant-drip": "Realistic photo of green coolant puddle and drips on a concrete garage floor under the front of a car, morning light",
    "screen-reboot": "Realistic photo of a car dashboard touchscreen showing a startup loading spinner on a dark screen, a smartphone on "
                     "the centre console with a bluetooth icon, car interior, no logos or text",
    "brake-pad": "Realistic photo of a worn, glazed front brake pad held in a mechanic's gloved hand next to a brake disc, workshop",
    "door-seal": "Realistic photo of a rear car door rubber weather seal partly detached from the door frame with water droplets, close-up",
}


def main() -> None:
    # Gemini 2.5 Flash Image on the global endpoint (Imagen model ids were not served on this project).
    client = genai.Client(vertexai=True, project=settings.project, location="global")
    out = ROOT / "web" / "public" / "samples"
    out.mkdir(parents=True, exist_ok=True)
    bucket = storage.Client(project=settings.project).bucket(settings.bucket)
    from f2f.gemini import with_retry
    for name, prompt in PHOTOS.items():
        if (out / f"{name}.jpg").exists():
            print(f"{name}: exists, skipped")
            continue
        r = with_retry(client.models.generate_content,
            model="gemini-2.5-flash-image",
            contents=prompt + ". Landscape 4:3 framing, photographic, no text, no logos, no watermark.",
            config=types.GenerateContentConfig(response_modalities=["IMAGE"]))
        part = next(p for p in r.candidates[0].content.parts if p.inline_data)
        img = part.inline_data.data
        from io import BytesIO
        from PIL import Image
        im = Image.open(BytesIO(img)).convert("RGB")
        im.thumbnail((1024, 1024))
        buf = BytesIO(); im.save(buf, "JPEG", quality=82); img = buf.getvalue()
        (out / f"{name}.jpg").write_bytes(img)
        bucket.blob(f"samples/{name}.jpg").upload_from_string(img, content_type="image/jpeg")
        print(f"{name}: {len(img) // 1024} KB {im.size} -> gs://{settings.bucket}/samples/{name}.jpg")


if __name__ == "__main__":
    main()
