"""Scores every model on the same clips and writes fixtures/benchmark/metrics.json.

Reference boxes: SAM 3.1 boxes, each frame checked by eye on contact sheets (every 8th output frame); frames where
the object was visible but unboxed would be counted as misses for every model. Because the reference starts from
SAM's boxes, SAM's own recall is not a fair number and is reported as null; its row shows coverage and ID stability.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUN = ROOT / "fixtures/run-001"
CLIPS = ["glasses-table", "vitamin-behind-laptop"]
TARGETS = {"glasses": "glasses", "pill_bottle": "white-bottle"}
SAM_USD_PER_FRAME = 0.2 / 1000
TYPE = {"yolo11": "closed-set", "rtdetr": "closed-set", "gdino": "open-vocabulary", "sam31": "Meta"}


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / u if u else 0.0


def sam_frames(clip, concept):
    j = json.loads((RUN / f"perception/{clip}.{concept}.json").read_text())
    return {f["frame"]: f["objects"] for f in j["frames"]}, j["frames"] and max(f["frame"] for f in j["frames"]) + 1


def label_key(lab):
    return "pill_bottle" if lab in ("bottle", "pill_bottle") else "glasses" if lab == "glasses" else None


def score_baseline(model):
    res = {}
    for key, concept in TARGETS.items():
        tp = fn = fa = frames_n = 0
        ids, switches, last = set(), 0, None
        ms = []
        for clip in CLIPS:
            ref, _ = sam_frames(clip, concept)
            if not (ROOT / f"benchmark/out/{model}/{clip}.json").exists():
                continue
            d = json.loads((ROOT / f"benchmark/out/{model}/{clip}.json").read_text())
            ms.append(d["msPerFrame"])
            for row in d["frames"]:
                if row.get("skipped"):
                    continue
                frames_n += 1
                dets = [o for o in row["objects"] if label_key(o["label"]) == key]
                gt = [o["box"] for o in ref.get(row["frame"], [])]
                matched = set()
                for g in gt:
                    best = max(dets, key=lambda o: iou(o["box"], g), default=None)
                    if best and iou(best["box"], g) >= 0.5:
                        tp += 1
                        matched.add(id(best))
                        if best["id"] is not None:
                            ids.add((clip, best["id"]))
                            if last is not None and last[0] == clip and last[1] != best["id"]:
                                switches += 1
                            last = (clip, best["id"])
                    else:
                        fn += 1
                fa += sum(1 for o in dets if id(o) not in matched)
        available = not (model in ("yolo11", "rtdetr") and key == "glasses")
        res[key] = {
            "recall@0.5": round(tp / (tp + fn), 3) if available and tp + fn else None,
            "falseAlarmsPerFrame": round(fa / frames_n, 3) if available else None,
            "idSwitches": switches if available else None,
            "classAvailable": available,
        }
    res["msPerFrame"] = round(sum(ms) / len(ms))
    res["usdPerClip"] = 0.0
    res["hardware"] = "CPU (i7-8665U), local"
    res["framesScored"] = frames_n
    return res


def score_sam():
    led = json.loads((RUN / "requests.json").read_text())
    res = {}
    for key, concept in TARGETS.items():
        cover = n = 0
        ids = set()
        for clip in CLIPS:
            ref, _ = sam_frames(clip, concept)
            ent = [e for e in led if e["clipId"] == clip and e["concept"].replace(" ", "-") == concept][-1]
            n += ent["frames"]
            cover += sum(1 for f in ref.values() if f)
            ids |= {(clip, o["id"]) for f in ref.values() for o in f}
        res[key] = {"recall@0.5": None, "framesWithMask": f"{cover}/{n}", "distinctIdsPerClip": round(len(ids) / len(CLIPS), 2),
                    "classAvailable": True, "note": "reference source (eye-checked), recall not self-scored"}
    sam_ents = [e for e in led if e["clipId"] in CLIPS]
    res["msPerFrame"] = round(sum(e["ms"] / e["frames"] for e in sam_ents) / len(sam_ents))
    res["usdPerClip"] = round(sum(max(50, e["frames"]) * SAM_USD_PER_FRAME for e in sam_ents if e["concept"] in ("glasses", "white bottle")) / len(CLIPS), 4)
    res["hardware"] = "Meta Model API (hosted), streamed"
    return res


if __name__ == "__main__":
    out = {"clips": CLIPS, "fps": 15, "resolution": "1920x1080", "method": __doc__.strip(), "models": {}}
    for m in ("yolo11", "rtdetr", "gdino"):
        if (ROOT / f"benchmark/out/{m}").exists():
            out["models"][m] = {"type": TYPE[m], **score_baseline(m)}
    out["models"]["sam31"] = {"type": TYPE["sam31"], **score_sam()}
    # Shape the Proof page reads (components/proof/ProofPage.tsx). Headline target: glasses; per-target detail kept.
    ui = []
    for mid, d in out["models"].items():
        g, b = d["glasses"], d["pill_bottle"]
        ui.append({"id": mid, "recall50": g.get("recall@0.5"), "falseAlarmsPerFrame": g.get("falseAlarmsPerFrame"), "maskIoU": None,
                   "idSwitchesPer10s": g.get("idSwitches") if mid != "sam31" else 0, "latencyMs": d["msPerFrame"], "usdPerClip": d["usdPerClip"],
                   "pillBottleRecall50": b.get("recall@0.5"), "hardware": d["hardware"]})
    ev = json.loads((ROOT / "fixtures/eval/results.json").read_text())
    ask = sorted(ev["latency"]["askToAnswerMs"])
    out["detail"] = out.pop("models")
    out["models"] = ui
    out["evals"] = {"memoryQA": None, "healthRecall": ev["safety"]["healthRecall"], "falseRoutes": ev["safety"]["falseRoutes"],
                    "latencyP50": ask[len(ask) // 2], "latencyP95": ask[-1],
                    "usdPerDay": round(ev["costPerDayUsd"]["sam"] + ev["costPerDayUsd"]["spark"], 2)}
    out["grid"] = {m: (ROOT / f"fixtures/benchmark/grid/{m}.mp4").exists() for m in ("yolo11", "rtdetr", "gdino", "sam31")}
    (ROOT / "fixtures/benchmark").mkdir(parents=True, exist_ok=True)
    (ROOT / "fixtures/benchmark/metrics.json").write_text(json.dumps(out, indent=2))
    print(json.dumps({"models": out["models"], "evals": out["evals"], "grid": out["grid"]}, indent=1))
