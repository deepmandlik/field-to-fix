"""Generate the video's b-roll with Veo on Vertex AI (field-to-fix project credits), then download the MP4s."""
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from google import genai
from google.cloud import storage
from google.genai import types

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
MODELS = ["veo-3.1-fast-generate-preview", "veo-3.1-generate-preview", "veo-3.0-generate-001", "veo-2.0-generate-001"]
BUCKET = "field-to-fix-f2f"
STYLE = " Cinematic, realistic, shallow depth of field, soft natural light, slow camera move. No text, no captions, no logos, no brand names."
CLIPS = {
    "coolant": "Close-up inside a modern car service workshop: green coolant slowly drips from a cracked metal hose clamp on a black radiator hose under an open car hood, a mechanic in grey work gloves reaches in and wipes it.",
    "lunch": "A young automotive quality engineer in safety glasses sits in a bright factory canteen eating lunch from a tray; the smartwatch on his wrist lights up, he glances at it, presses and holds the screen with one finger, and smiles.",
    "factory": "Wide shot of a clean automotive parts production line: a worker in a blue uniform uses a digital torque tool on hose clamp assemblies passing on a conveyor, then gives a satisfied nod.",
}

client = genai.Client(vertexai=True, project="field-to-fix", location="us-central1")


def make(name: str, prompt: str) -> str:
    dest = OUT / f"{name}.mp4"
    if dest.exists():
        return f"{name}: exists"
    op, last = None, None
    for m in list(MODELS):  # some model ids list fine but refuse generation on this project: fall through
        try:
            cfg = dict(number_of_videos=1, duration_seconds=8, aspect_ratio="16:9", output_gcs_uri=f"gs://{BUCKET}/veo/{name}/")
            if not m.startswith("veo-2"):
                cfg.update(resolution="1080p", generate_audio=False)
            op = client.models.generate_videos(model=m, prompt=prompt + STYLE, config=types.GenerateVideosConfig(**cfg))
            print(f"{name}: started on {m}", flush=True)
            break
        except Exception as e:
            last = e
            if m in MODELS and "404" in str(e):
                MODELS.remove(m)
    if op is None:
        return f"{name}: no Veo model accepted the job: {str(last)[:200]}"
    while not op.done:
        time.sleep(15)
        op = client.operations.get(op)
    if op.error:
        return f"{name}: ERROR {op.error}"
    uri = op.response.generated_videos[0].video.uri
    b, path = uri[5:].split("/", 1)
    storage.Client(project="field-to-fix").bucket(b).blob(path).download_to_filename(dest)
    return f"{name}: {dest.stat().st_size // 1024} KB from {uri}"


print(make(*list(CLIPS.items())[0]), flush=True)  # first clip alone finds the working model
with ThreadPoolExecutor(2) as pool:
    for r in pool.map(lambda kv: make(*kv), list(CLIPS.items())[1:]):
        print(r, flush=True)
