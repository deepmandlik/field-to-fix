"""Score the Intake agent on 100 messy notes: does the extracted failure land in the right category?

Usage (from agents/): python -m eval.run_hard_eval [--out eval/hard_results.json]
"""
import json
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from dotenv import load_dotenv

load_dotenv(".env")
from f2f import gemini  # noqa: E402
from f2f.config import settings  # noqa: E402
from f2f.pipeline import intake  # noqa: E402

from .hard_notes import NOTES  # noqa: E402

CATEGORIES = {
    "clamp_leak": "coolant hose clamp | coolant leak at hose joint, clamp loose",
    "brake_squeal": "front brake pads | brake squeal or noise when braking, pads glazed",
    "infotainment_reboot": "infotainment head unit | screen reboots or restarts with Bluetooth or phone",
    "ac_weak": "air conditioning compressor | weak cooling, compressor noise",
    "window_noise": "power window regulator | window slow, grinding noise",
    "battery_drain": "12V battery | battery drained, car won't start after parking",
    "door_seal_leak": "rear door seal | water leak into cabin in rain",
    "wiper_stall": "windshield wiper motor | wiper stops mid-sweep",
    "fuel_pump_whine": "fuel pump module | whining noise from fuel tank, hesitation",
}


def main() -> None:
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "eval/hard_results.json"
    with ThreadPoolExecutor(max_workers=6) as pool:
        ext = list(pool.map(lambda n: intake.extract(n[1]), NOTES))
    cat_keys = list(CATEGORIES)
    cat_vecs = np.array(gemini.embed([CATEGORIES[k] for k in cat_keys], task_type="SEMANTIC_SIMILARITY"))
    claim_vecs = np.array(gemini.embed([intake.embedding_text(x) for x in ext], task_type="SEMANTIC_SIMILARITY"))
    cat_vecs /= np.linalg.norm(cat_vecs, axis=1, keepdims=True)
    claim_vecs /= np.linalg.norm(claim_vecs, axis=1, keepdims=True)
    pred = [cat_keys[i] for i in (claim_vecs @ cat_vecs.T).argmax(1)]

    rows, by_tag = [], defaultdict(Counter)
    for (truth, note, tag), x, p in zip(NOTES, ext, pred):
        ok = p == truth
        rows.append({"note": note, "tag": tag, "truth": truth, "pred": p, "ok": ok,
                     "component": x.component, "failure_mode": x.failure_mode, "lang": x.lang, "translated": x.translated_text})
        for t in tag.split("-"):
            by_tag[t]["n"] += 1
            by_tag[t]["ok"] += ok
    acc = sum(r["ok"] for r in rows) / len(rows)
    summary = {"model": settings.model_fast, "notes": len(rows), "correct": sum(r["ok"] for r in rows), "accuracy": round(acc, 3),
               "by_tag": {t: f"{c['ok']}/{c['n']}" for t, c in sorted(by_tag.items())}}
    json.dump({"summary": summary, "rows": rows}, open(out, "w"), ensure_ascii=False, indent=1)
    print(json.dumps(summary, indent=1))
    for r in rows:
        if not r["ok"]:
            print("MISS", r["truth"], "->", r["pred"], "|", r["note"], "|", r["component"], "/", r["failure_mode"])


if __name__ == "__main__":
    main()
