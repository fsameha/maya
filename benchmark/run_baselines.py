"""Offline baselines on the same corner-camera clips SAM 3.1 saw (System tab §J).

YOLO11 and RT-DETR (closed-set, COCO) and Grounding DINO (open-vocabulary) run here on CPU, each with
ByteTrack for IDs. Writes per-frame tracks to benchmark/out/<model>/<clip>.json. AGPL code (ultralytics)
stays inside /benchmark. Run: benchmark/.venv/bin/python benchmark/run_baselines.py
"""
import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CLIPS = ["glasses-table", "vitamin-behind-laptop"]
OUT = ROOT / "benchmark/out"
# What each model is asked for. COCO has no "glasses" class; "bottle" is the closest COCO class to a pill bottle.
TARGETS = {"glasses": {"coco": None, "text": "glasses"}, "pill_bottle": {"coco": "bottle", "text": "white bottle"}}


def frames(clip):
    cap = cv2.VideoCapture(str(ROOT / f"fixtures/run-001/clips/{clip}.analysis.mp4"))
    while True:
        ok, f = cap.read()
        if not ok:
            return
        yield f


def save(model, clip, rows, ms):
    d = OUT / model
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{clip}.json").write_text(json.dumps({"model": model, "clip": clip, "msPerFrame": ms, "frames": rows}))
    print(model, clip, f"{ms:.0f} ms/frame", flush=True)


def run_ultralytics(name, weights, cls):
    from ultralytics import RTDETR, YOLO

    model = (RTDETR if name == "rtdetr" else YOLO)(weights)
    for clip in CLIPS:
        rows, t = [], 0.0
        for i, f in enumerate(frames(clip)):
            t0 = time.perf_counter()
            r = model.track(f, persist=True, tracker="bytetrack.yaml", conf=0.15, verbose=False)[0]
            t += time.perf_counter() - t0
            objs = []
            for b in r.boxes:
                label = model.names[int(b.cls)]
                objs.append({"label": label, "box": [round(v) for v in b.xyxy[0].tolist()], "conf": round(float(b.conf), 3),
                             "id": int(b.id) if b.id is not None else None})
            rows.append({"frame": i, "objects": objs})
        save(name, clip, rows, 1000 * t / max(1, len(rows)))


def run_gdino():
    import torch
    from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

    mid = "IDEA-Research/grounding-dino-tiny"
    proc = AutoProcessor.from_pretrained(mid)
    model = AutoModelForZeroShotObjectDetection.from_pretrained(mid).eval()
    torch.set_num_threads(8)
    for clip in CLIPS:
        # Same ByteTrack implementation and settings YOLO11/RT-DETR use (ultralytics bytetrack.yaml defaults).
        from types import SimpleNamespace
        from ultralytics.engine.results import Boxes
        from ultralytics.trackers.byte_tracker import BYTETracker
        cfg = SimpleNamespace(frame_rate=15, track_high_thresh=0.25, track_low_thresh=0.1, new_track_thresh=0.25, track_buffer=30, match_thresh=0.8, fuse_score=True)
        trackers = {k: BYTETracker(cfg) for k in TARGETS}
        rows, t = [], 0.0
        for i, f in enumerate(frames(clip)):
            rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
            objs = []
            t0 = time.perf_counter()
            for key, tgt in TARGETS.items():  # one concept per pass, same as SAM
                inp = proc(images=rgb, text=tgt["text"] + ".", return_tensors="pt")
                with torch.no_grad():
                    out = model(**inp)
                res = proc.post_process_grounded_object_detection(out, inp.input_ids, threshold=0.25, text_threshold=0.25,
                                                                  target_sizes=[rgb.shape[:2]])[0]
                n = len(res["scores"])
                data = torch.cat([res["boxes"].reshape(-1, 4), res["scores"].reshape(-1, 1), torch.zeros(n, 1)], 1)
                tracks = trackers[key].update(Boxes(data, rgb.shape[:2]).cpu().numpy(), f)
                for t_ in tracks:
                    objs.append({"label": key, "box": [round(float(v)) for v in t_[:4]], "conf": round(float(t_[5]), 3), "id": int(t_[4])})
            t += time.perf_counter() - t0
            rows.append({"frame": i, "objects": objs})
        save("gdino", clip, rows, 1000 * t / max(1, len(rows)))


if __name__ == "__main__":
    which = sys.argv[1:] or ["yolo11", "rtdetr", "gdino"]
    if "yolo11" in which:
        run_ultralytics("yolo11", "yolo11s.pt", None)
    if "rtdetr" in which:
        run_ultralytics("rtdetr", "rtdetr-l.pt", None)
    if "gdino" in which:
        run_gdino()
