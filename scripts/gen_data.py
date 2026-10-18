"""Generate the synthetic OEM dataset: vehicles, parts, suppliers, batches, stock, dealers,
~700 multilingual warranty claims with one planted failure cluster, PFMEA and control-plan rows.

The planted cluster: coolant hose clamps from Kaveri Hoses batches KAV-26W31 / KAV-26W32 leak on
Swift-X cars built at Manesar line 2. Dzire-S got clamps from the same batches later, so it has
no claims yet — the "other models at risk" finding.

Usage:  python scripts/gen_data.py            (writes data/seed/*.jsonl)
"""
from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(7)
OUT = Path(__file__).resolve().parent.parent / "data" / "seed"
AS_OF = date(2026, 10, 17)
WINDOW_START = AS_OF - timedelta(days=120)

MODELS = {  # model -> (plant, line, model code)
    "Swift-X": ("P-MNS", "L2", "SX"),
    "Dzire-S": ("P-MNS", "L3", "DS"),
    "City-Z": ("P-GUJ", "L1", "CZ"),
    "Nexa-V": ("P-CKN", "L1", "NV"),
}
PLANTS = {"P-MNS": "Manesar", "P-GUJ": "Hansalpur", "P-CKN": "Chakan"}

SUPPLIERS = [
    ("S-KAV", "Kaveri Hoses Pvt Ltd", 1, None),
    ("S-NIL", "Nilgiri Rubber Works", 1, None),
    ("S-CLP", "ClampTech Components", 2, "S-KAV"),
    ("S-BRK", "Deccan Friction Ltd", 1, None),
    ("S-INF", "Sahyadri Infotainment", 1, None),
    ("S-CLM", "Coolair Compressors", 1, None),
    ("S-WIN", "Vindhya Window Systems", 1, None),
    ("S-BAT", "Eastern Battery Co", 1, None),
    ("S-SEL", "Konkan Seals", 1, None),
    ("S-WIP", "Aravali Motors", 1, None),
    ("S-FPM", "Narmada Fuel Systems", 1, None),
]
# part_no, name, [(supplier, weight)]
PARTS = [
    ("P-1001", "Coolant hose clamp assembly", [("S-KAV", 0.7), ("S-NIL", 0.3)]),
    ("P-1002", "Front brake pad set", [("S-BRK", 1.0)]),
    ("P-1003", "Infotainment head unit", [("S-INF", 1.0)]),
    ("P-1004", "AC compressor", [("S-CLM", 1.0)]),
    ("P-1005", "Front window regulator", [("S-WIN", 1.0)]),
    ("P-1006", "12V battery", [("S-BAT", 1.0)]),
    ("P-1007", "Rear door seal", [("S-SEL", 1.0)]),
    ("P-1008", "Wiper motor", [("S-WIP", 1.0)]),
    ("P-1009", "Fuel pump module", [("S-FPM", 1.0)]),
]
SUP_SHORT = {"S-KAV": "KAV", "S-NIL": "NIL", "S-BRK": "BRK", "S-INF": "INF", "S-CLM": "CLM", "S-WIN": "WIN",
             "S-BAT": "BAT", "S-SEL": "SEL", "S-WIP": "WIP", "S-FPM": "FPM"}

DEALERS = [  # dealer_id, city, country, language mix
    ("D-PUN-01", "Pune", "IN", ["hi", "en"]), ("D-PUN-02", "Pune", "IN", ["en", "hi"]),
    ("D-DEL-01", "Delhi", "IN", ["hi", "hi", "en"]), ("D-DEL-02", "Gurugram", "IN", ["hi", "en"]),
    ("D-LKO-01", "Lucknow", "IN", ["hi"]), ("D-CHN-01", "Chennai", "IN", ["en"]),
    ("D-BLR-01", "Bengaluru", "IN", ["en"]), ("D-JKT-01", "Jakarta", "ID", ["id"]),
    ("D-JKT-02", "Bekasi", "ID", ["id"]), ("D-SBY-01", "Surabaya", "ID", ["id"]),
    ("D-BKK-01", "Bangkok", "TH", ["en", "id"]), ("D-MUM-01", "Mumbai", "IN", ["en", "hi"]),
]

# failure key -> part, severity, cost (INR), condition list, notes by language
FAILURES = {
    "clamp_leak": dict(part="P-1001", sev=3, cost=4200, notes={
        "en": ["Coolant leak at radiator hose joint, clamp found loose. Topped up coolant, replaced clamp.",
               "Customer complaint low coolant warning. Hose end wet near clamp, clamp not tight. Replaced clamp assy.",
               "White residue on upper hose near clamp, slow coolant leak after cold start. Clamp replaced.",
               "Coolant dripping under car in morning. Hose clamp loose, could turn by hand. Replaced."],
        "hi": ["होज़ के पास से कूलेंट लीक, क्लैंप ढीला मिला। क्लैंप बदला, कूलेंट टॉप-अप किया।",
               "ग्राहक शिकायत: कूलेंट कम होने की चेतावनी। रेडिएटर होज़ क्लैंप ढीला, जोड़ गीला। क्लैंप असेंबली बदली।",
               "सुबह गाड़ी के नीचे कूलेंट टपक रहा था। होज़ क्लैंप हाथ से घूम रहा था। बदल दिया।",
               "coolant leak hose joint pe, clamp loose tha. clamp replace kiya, customer ko bataya."],
        "id": ["Kebocoran coolant di sambungan selang radiator, klem kendor. Klem diganti, coolant ditambah.",
               "Klem selang kendor, ada residu putih di ujung selang. Bocor pelan setelah mesin dingin. Klem diganti.",
               "Pelanggan komplain indikator coolant rendah. Sambungan selang basah dekat klem. Ganti klem assy."],
    }),
    "brake_squeal": dict(part="P-1002", sev=2, cost=3100, notes={
        "en": ["Front brake squeal at low speed when braking. Pads glazed. Replaced pad set.",
               "Squeaking noise from front wheels while braking in traffic. Cleaned and replaced pads."],
        "hi": ["धीमी गति पर ब्रेक लगाने पर आगे से चीं-चीं की आवाज़। ब्रेक पैड बदले।",
               "brake lagane pe front se awaaz aa rahi hai, pads glazed. pad set replace."],
        "id": ["Rem depan berdecit saat pengereman pelan. Kampas rem diganti."],
    }),
    "infotainment_reboot": dict(part="P-1003", sev=2, cost=6800, notes={
        "en": ["Infotainment screen reboots when phone connects on Bluetooth. Software reflashed.",
               "Head unit restarts randomly during Android Auto. Updated software, issue reduced."],
        "hi": ["ब्लूटूथ कनेक्ट करते ही इंफोटेनमेंट स्क्रीन रीस्टार्ट हो जाती है। सॉफ्टवेयर अपडेट किया।"],
        "id": ["Layar head unit restart sendiri saat sambung Bluetooth. Software di-update."],
    }),
    "ac_weak": dict(part="P-1004", sev=2, cost=18500, notes={
        "en": ["AC not cooling enough in afternoon. Compressor clutch noise. Compressor replaced."],
        "hi": ["दोपहर में AC ठंडा नहीं कर रहा, कंप्रेसर से आवाज़। कंप्रेसर बदला।"],
        "id": ["AC kurang dingin siang hari, kompresor berisik. Kompresor diganti."],
    }),
    "window_noise": dict(part="P-1005", sev=1, cost=2900, notes={
        "en": ["Driver window slow and grinding noise while going up. Regulator replaced."],
        "hi": ["ड्राइवर की खिड़की धीरे चढ़ती है और घिसने की आवाज़। रेगुलेटर बदला।"],
        "id": ["Kaca jendela pengemudi naik lambat dan berbunyi. Regulator diganti."],
    }),
    "battery_drain": dict(part="P-1006", sev=4, cost=5400, notes={
        "en": ["Car not starting after 2 days parked, battery drained. Battery replaced after test failed."],
        "hi": ["2 दिन खड़ी रहने के बाद गाड़ी स्टार्ट नहीं हुई, बैटरी डाउन। टेस्ट फेल, बैटरी बदली।"],
        "id": ["Mobil tidak bisa distarter setelah 2 hari parkir, aki soak. Aki diganti."],
    }),
    "door_seal_leak": dict(part="P-1007", sev=2, cost=1800, notes={
        "en": ["Water entering rear footwell during rain. Rear door seal not seated. Seal replaced."],
        "hi": ["बारिश में पीछे पैरों के पास पानी आता है। डोर सील बदली।"],
        "id": ["Air masuk ke kabin belakang saat hujan. Karet pintu belakang diganti."],
    }),
    "wiper_stall": dict(part="P-1008", sev=3, cost=3600, notes={
        "en": ["Wiper stops mid-sweep on high speed. Wiper motor replaced."],
        "hi": ["तेज़ स्पीड पर वाइपर बीच में रुक जाता है। मोटर बदली।"],
        "id": ["Wiper berhenti di tengah saat kecepatan tinggi. Motor wiper diganti."],
    }),
    "fuel_pump_whine": dict(part="P-1009", sev=3, cost=9200, notes={
        "en": ["Whining noise from rear seat area at idle, occasional hesitation. Fuel pump module replaced."],
        "hi": ["आइडल पर पीछे से सीटी जैसी आवाज़, कभी-कभी झटका। फ्यूल पंप बदला।"],
        "id": ["Bunyi mendengung dari bawah jok belakang saat idle. Pompa bensin diganti."],
    }),
}
BASELINE_COUNTS = {"clamp_leak": 7, "brake_squeal": 120, "infotainment_reboot": 45, "ac_weak": 70,
                   "window_noise": 80, "battery_drain": 60, "door_seal_leak": 75, "wiper_stall": 50,
                   "fuel_pump_whine": 45}
CLUSTER_CLAIMS = 56          # planted clamp cluster
INFOTAINMENT_SURGE = 22      # a milder rising cluster (software), no single batch
BAD_BATCHES = {"KAV-26W31", "KAV-26W32"}


def iso_week(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{str(y)[2:]}W{w:02d}"


def make_vin(code: str, i: int) -> str:
    return f"MA3{code}{random.choice('ABCDEF')}{random.randint(1, 9)}S{i:08d}"[:17].ljust(17, "0")


def weighted(choices):
    r, acc = random.random(), 0.0
    for v, w in choices:
        acc += w
        if r <= acc:
            return v
    return choices[-1][0]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    vehicles, vin_parts, batches = [], [], {}

    def batch_for(part_no, supplier, build):
        bid = f"{SUP_SHORT[supplier]}-{iso_week(build - timedelta(days=random.randint(3, 10)))}"
        if part_no != "P-1001":
            bid = f"{SUP_SHORT[supplier]}{part_no[-2:]}-{bid.split('-')[1]}"
        if bid not in batches:
            wk = bid.split("-")[-1]
            batches[bid] = {"batch_id": bid, "supplier_id": supplier, "part_no": part_no,
                            "prod_week": f"20{wk[:2]}-W{wk[3:]}", "qty": random.randint(2500, 4000)}
        return bid

    n = 0
    build_start = date(2026, 3, 1)
    for model, (plant, line, code) in MODELS.items():
        count = {"Swift-X": 2600, "Dzire-S": 1200, "City-Z": 1500, "Nexa-V": 1100}[model]
        for _ in range(count):
            n += 1
            if model == "Dzire-S":  # Dzire-S ramps up later, so its W31/W32 clamps haven't failed yet
                build = date(2026, 8, 3) + timedelta(days=random.randint(0, 50))
            else:
                build = build_start + timedelta(days=random.randint(0, 190))
            vin = make_vin(code, n)
            vehicles.append({"vin": vin, "model": model, "plant_id": plant, "line": line, "build_date": build.isoformat()})
            for part_no, _, sups in PARTS:
                sup = weighted(sups)
                if part_no == "P-1001" and model in ("Swift-X", "Dzire-S"):
                    sup = "S-KAV"
                vin_parts.append({"vin": vin, "part_no": part_no, "supplier_id": sup,
                                  "batch_id": batch_for(part_no, sup, build)})

    parts_by_vin = {}
    for vp in vin_parts:
        parts_by_vin.setdefault(vp["vin"], {})[vp["part_no"]] = vp["batch_id"]
    veh_by_vin = {v["vin"]: v for v in vehicles}

    claims, truth = [], []
    cid = 88000

    def add_claim(vin, key, cdate, lang_pool):
        nonlocal cid
        cid += 1
        f = FAILURES[key]
        dealer = random.choice(lang_pool)
        lang = random.choice(dealer[3])
        notes = f["notes"].get(lang) or f["notes"]["en"]
        build = date.fromisoformat(veh_by_vin[vin]["build_date"])
        km = max(800, int((cdate - build).days * random.uniform(28, 55)))
        claims.append({"claim_id": f"C-{cid}", "dealer_id": dealer[0], "vin": vin, "claim_date": cdate.isoformat(),
                       "mileage_km": km, "note_text": random.choice(notes), "photo_uri": None, "audio_uri": None,
                       "labor_code": key.upper()[:8], "cost_inr": int(f["cost"] * random.uniform(0.85, 1.2))})
        truth.append({"claim_id": f"C-{cid}", "failure": key})

    def eligible(pred, after: date):
        return [v["vin"] for v in vehicles if pred(v) and date.fromisoformat(v["build_date"]) < after - timedelta(days=20)]

    # baseline noise: uniform over the window, any model
    for key, cnt in BASELINE_COUNTS.items():
        for _ in range(cnt):
            d = WINDOW_START + timedelta(days=random.randint(0, 119))
            pool = eligible(lambda v: True, d)
            if key == "clamp_leak":  # rare background clamp leaks on good batches only
                pool = [x for x in pool if parts_by_vin[x]["P-1001"] not in BAD_BATCHES and veh_by_vin[x]["model"] != "Dzire-S"]
            add_claim(random.choice(pool), key, d, DEALERS)

    # planted cluster: Swift-X with bad clamp batches, accelerating over the last ~5 weeks
    bad_swift = [v["vin"] for v in vehicles if v["model"] == "Swift-X" and parts_by_vin[v["vin"]]["P-1001"] in BAD_BATCHES]
    random.shuffle(bad_swift)
    for i in range(CLUSTER_CLAIMS):
        back = int(abs(random.gauss(0, 1)) * 12)  # most claims in the last two weeks
        d = AS_OF - timedelta(days=min(back, 34) + 1)
        add_claim(bad_swift[i % len(bad_swift)], "clamp_leak", d, DEALERS)

    # milder infotainment surge across all batches (software)
    for _ in range(INFOTAINMENT_SURGE):
        d = AS_OF - timedelta(days=random.randint(1, 20))
        add_claim(random.choice(eligible(lambda v: v["model"] in ("City-Z", "Nexa-V"), d)), "infotainment_reboot", d, DEALERS)

    # stock of clamp batches around the bad weeks
    stock = []
    for bid, b in batches.items():
        if b["part_no"] == "P-1001" and b["supplier_id"] == "S-KAV" and bid.split("-")[1] >= "26W29":
            stock += [
                {"batch_id": bid, "location": "Manesar plant warehouse", "location_type": "warehouse", "qty_on_hand": random.randint(300, 1900)},
                {"batch_id": bid, "location": "In transit · Gurugram hub", "location_type": "transit", "qty_on_hand": random.randint(0, 600)},
                {"batch_id": bid, "location": f"Dealer service stock ({random.randint(20, 45)} dealers)", "location_type": "dealer", "qty_on_hand": random.randint(60, 260)},
            ]

    pfmea = [
        ("R-11", "Station 4 – Hose cut to length", "Hose length short", "Hose under tension at joint, leak", "Cutter stop worn", "Cutter stop PM monthly", "First-off length check per shift", 6, 2, 4),
        ("R-12", "Station 5 – Hose insertion on spigot", "Insufficient insertion depth", "Hose pull-off / coolant leak", "Operator does not reach depth mark", "Depth mark on spigot", "Visual check of mark 100%", 8, 3, 5),
        ("R-14", "Station 6 – Clamp tightening", "Clamp torque below specification (4.5 Nm)", "Clamp loosens in thermal cycling, coolant leak at joint", "Torque tool drift; calibration overdue", "Tool calibration every 3 months", "Torque audit 1 in 50 parts", 8, 3, 6),
        ("R-15", "Station 6 – Clamp tightening", "Clamp over-torqued", "Hose cut by clamp band, leak", "Wrong tool program selected", "Program lock by part number", "Torque audit 1 in 50 parts", 8, 2, 6),
        ("R-17", "Incoming – Clamp band (Tier-2 ClampTech)", "Clamp band hardness out of spec", "Clamp relaxes, loss of clamping force", "Heat treatment variation at Tier-2", "Supplier certificate per lot", "Hardness test 5 pcs per lot", 7, 2, 5),
        ("R-22", "Material – Hose compound", "Hose compression set too high at low temperature", "Joint loosens after cold start", "Compound batch variation", "Material spec + supplier PPAP", "Compression-set test per compound batch", 7, 2, 5),
        ("R-31", "Brake pad bonding", "Pad glazing", "Brake squeal", "Bake cycle short", "Oven profile monitoring", "Friction test per lot", 5, 3, 4),
        ("R-41", "Head unit software flashing", "Wrong software version flashed", "Unit reboot / feature loss", "Version table not updated", "Version check at EOL", "EOL functional test", 5, 3, 3),
        ("R-52", "Window regulator greasing", "Insufficient grease", "Slow window, grinding", "Dispenser nozzle blocked", "Nozzle PM weekly", "Visual 1 per hour", 3, 3, 5),
        ("R-63", "Door seal installation", "Seal not fully seated", "Water ingress", "Operator rush at takt", "Roller tool", "Water test 1 per shift", 5, 3, 5),
    ]
    pfmea_rows = [{"row_id": r[0], "doc": "PFMEA-CoolingCircuit-Rev7", "process_step": r[1], "failure_mode": r[2],
                   "effect": r[3], "cause": r[4], "prevention": r[5], "detection": r[6],
                   "severity": r[7], "occurrence": r[8], "detection_rating": r[9], "rpn": r[7] * r[8] * r[9]} for r in pfmea]
    control_plan = [
        {"row_id": "CP-04", "process_step": "Station 4 – Hose cut to length", "characteristic": "Hose length 412 ±2 mm", "method": "Gauge", "frequency": "First-off per shift", "reaction_plan": "Stop, adjust stop, 100% check last hour"},
        {"row_id": "CP-05", "process_step": "Station 5 – Hose insertion on spigot", "characteristic": "Insertion to depth mark", "method": "Visual", "frequency": "100%", "reaction_plan": "Re-insert"},
        {"row_id": "CP-06", "process_step": "Station 6 – Clamp tightening", "characteristic": "Clamp torque 4.5 ±0.3 Nm", "method": "Torque wrench audit", "frequency": "1 in 50 parts", "reaction_plan": "Quarantine since last good audit, re-torque"},
        {"row_id": "CP-06B", "process_step": "Station 6 – Clamp tightening", "characteristic": "Torque tool calibration", "method": "Calibration lab", "frequency": "Every 3 months", "reaction_plan": "Recalibrate, review parts since last calibration"},
        {"row_id": "CP-17", "process_step": "Incoming – Clamp band (Tier-2 ClampTech)", "characteristic": "Band hardness 42–48 HRC", "method": "Hardness tester", "frequency": "5 pcs per lot", "reaction_plan": "Reject lot to Tier-2"},
        {"row_id": "CP-22", "process_step": "Material – Hose compound", "characteristic": "Compression set ≤ 25% at -20°C", "method": "Lab test", "frequency": "Per compound batch", "reaction_plan": "Hold compound batch"},
    ]

    tables = {
        "vehicles": vehicles, "vin_parts": vin_parts, "batches": list(batches.values()), "stock": stock,
        "parts": [{"part_no": p, "part_name": nme} for p, nme, _ in PARTS],
        "suppliers": [{"supplier_id": s, "name": nme, "tier": t, "parent_id": par} for s, nme, t, par in SUPPLIERS],
        "dealers": [{"dealer_id": d, "city": c, "country": k} for d, c, k, _ in DEALERS],
        "plants": [{"plant_id": p, "name": nme} for p, nme in PLANTS.items()],
        "claims_raw": claims, "pfmea_rows": pfmea_rows, "control_plan_rows": control_plan, "claims_truth": truth,
    }
    for name, rows in tables.items():
        with open(OUT / f"{name}.jsonl", "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"{name:20s} {len(rows):>7,d}")


if __name__ == "__main__":
    main()
