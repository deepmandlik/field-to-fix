"""Voiceover per scene with Cloud Text-to-Speech (Chirp 3 HD). Writes WAVs and a timing file for Remotion."""
import base64
import json
import subprocess
import sys
import urllib.request
import wave
from pathlib import Path

HERE = Path(__file__).parent
OUT = Path(sys.argv[1])
VOICE = sys.argv[2] if len(sys.argv) > 2 else "en-US-Chirp3-HD-Charon"
OUT.mkdir(parents=True, exist_ok=True)
token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
timing = []
for scene in json.loads((HERE / "narration.json").read_text()):
    body = json.dumps({
        "input": {"text": scene["text"]},
        "voice": {"languageCode": "en-US", "name": VOICE},
        "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": 24000},
    }).encode()
    req = urllib.request.Request("https://texttospeech.googleapis.com/v1/text:synthesize", data=body, headers={
        "Authorization": f"Bearer {token}", "x-goog-user-project": "field-to-fix", "Content-Type": "application/json"})
    audio = base64.b64decode(json.load(urllib.request.urlopen(req))["audioContent"])
    path = OUT / f"{scene['id']}.wav"
    path.write_bytes(audio)
    with wave.open(str(path)) as w:
        secs = w.getnframes() / w.getframerate()
    timing.append({"id": scene["id"], "seconds": round(secs, 2), "text": scene["text"]})
    print(f"{scene['id']:13s} {secs:5.1f}s")
(OUT / "timing.json").write_text(json.dumps(timing, indent=1))
print("total", round(sum(t["seconds"] for t in timing), 1), "s")
