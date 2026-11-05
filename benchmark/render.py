"""Overlay videos for Proof and the demo video: one MP4 per model per clip, plus a 2x2 grid.

SAM 3.1 draws its decoded masks (fill + outline), label chips, a zoom loupe on the glasses and blurs the person.
Baselines draw their boxes and ByteTrack IDs for the same targets. Run after run_baselines.py.
"""
import base64
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RUN = ROOT / "fixtures/run-001"
OUT = ROOT / "fixtures/benchmark/grid"
OUT.mkdir(parents=True, exist_ok=True)
# BGR. Blue for glasses, amber for the pill bottle (Website §3 accent and attention colours).
COLOR = {"glasses": (224, 100, 0), "pill_bottle": (24, 169, 242)}
NAMES = {"yolo11": "YOLO11 (COCO)", "rtdetr": "RT-DETR (COCO)", "gdino": "Grounding DINO", "sam31": "SAM 3.1"}
FONT = cv2.FONT_HERSHEY_DUPLEX


def frames(clip):
    cap = cv2.VideoCapture(str(RUN / f"clips/{clip}.analysis.mp4"))
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            return out
        out.append(f)


def chip(img, text, x, y, color, scale=0.8):
    (tw, th), _ = cv2.getTextSize(text, FONT, scale, 1)
    x, y = int(max(0, x)), int(max(th + 12, y))
    cv2.rectangle(img, (x, y - th - 12), (x + tw + 16, y + 4), color, -1, cv2.LINE_AA)
    cv2.putText(img, text, (x + 8, y - 4), FONT, scale, (255, 255, 255), 1, cv2.LINE_AA)


def header(img, title, sub):
    bar = img.copy()
    cv2.rectangle(bar, (0, 0), (img.shape[1], 70), (20, 19, 10), -1)
    cv2.addWeighted(bar, 0.75, img, 0.25, 0, img)
    cv2.putText(img, title, (24, 46), FONT, 1.3, (255, 255, 255), 2, cv2.LINE_AA)
    if sub:
        cv2.putText(img, sub, (img.shape[1] - 24 - cv2.getTextSize(sub, FONT, 0.8, 1)[0][0], 44), FONT, 0.8, (210, 214, 220), 1, cv2.LINE_AA)


def mask_full(obj, shape):
    m = obj["mask"]
    bits = np.unpackbits(np.frombuffer(base64.b64decode(m["bits"]), dtype=np.uint8))[: m["w"] * m["h"]]
    full = np.zeros(shape[:2], dtype=np.uint8)
    crop = bits.reshape(m["h"], m["w"])
    y0, x0 = m["y"], m["x"]
    y1, x1 = min(shape[0], y0 + m["h"]), min(shape[1], x0 + m["w"])
    full[y0:y1, x0:x1] = crop[: y1 - y0, : x1 - x0]
    return full


def load_sam(clip):
    per = {}
    for key, concept in (("glasses", "glasses"), ("pill_bottle", "white-bottle"), ("person", "person")):
        p = RUN / f"perception/{clip}.{concept}.json"
        if p.exists():
            per[key] = {f["frame"]: f["objects"] for f in json.loads(p.read_text())["frames"]}
    return per


def draw_sam(img, i, sam):
    for o in sam.get("person", {}).get(i, []):  # privacy: blur people before anything else is drawn
        m = mask_full(o, img.shape).astype(bool)
        m = cv2.dilate(m.astype(np.uint8), np.ones((25, 25), np.uint8)).astype(bool)
        img[m] = cv2.GaussianBlur(img, (0, 0), 28)[m]
    loupe, chips = None, []
    for key in ("glasses", "pill_bottle"):
        for o in sam.get(key, {}).get(i, []):
            m = mask_full(o, img.shape)
            col = np.array(COLOR[key], dtype=np.float32)
            sel = m.astype(bool)
            img[sel] = (img[sel] * 0.6 + col * 0.4).astype(np.uint8)
            cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            cv2.drawContours(img, cnts, -1, COLOR[key], 3, cv2.LINE_AA)
            chips.append((f"{key.replace('_', ' ')}  #{o['id']}  {o['conf']:.2f}", o["box"][0], o["box"][1] - 10, COLOR[key]))
            if key == "glasses":
                loupe = o["box"]
    crop = None
    if loupe:  # zoom loupe on the far-view glasses, cut before chips are drawn
        x1, y1, x2, y2 = loupe
        cx, cy, r = (x1 + x2) // 2, (y1 + y2) // 2, max(40, (x2 - x1) // 2 + 20)
        crop = img[max(0, cy - r): cy + r, max(0, cx - r): cx + r].copy()
    for c in chips:
        chip(img, *c)
    if crop is not None:
        if crop.size:
            z = cv2.resize(crop, (360, int(360 * crop.shape[0] / crop.shape[1])), interpolation=cv2.INTER_CUBIC)
            h, w = z.shape[:2]
            Y, X = img.shape[0] - h - 30, img.shape[1] - w - 30
            img[Y: Y + h, X: X + w] = z
            cv2.rectangle(img, (X, Y), (X + w, Y + h), (255, 255, 255), 3, cv2.LINE_AA)
            chip(img, "4x loupe", X, Y - 6, (60, 60, 60), 0.7)


def draw_baseline(img, row, model):
    found = set()
    for o in row["objects"]:
        lab = o["label"]
        key = "pill_bottle" if lab in ("bottle", "pill_bottle") else "glasses" if lab == "glasses" else None
        if key is None:
            continue
        found.add(key)
        x1, y1, x2, y2 = o["box"]
        cv2.rectangle(img, (x1, y1), (x2, y2), COLOR[key], 3, cv2.LINE_AA)
        chip(img, f"{lab}  #{o['id']}  {o['conf']:.2f}", x1, y1 - 10, COLOR[key])
    if model in ("yolo11", "rtdetr"):
        chip(img, "glasses: class not available", 24, 120, (93, 108, 123), 0.8)


def write(path, imgs, fps=15):
    h, w = imgs[0].shape[:2]
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", str(path)],
                         stdin=subprocess.PIPE)
    for im in imgs:
        p.stdin.write(im.tobytes())
    p.stdin.close()
    p.wait()


def main(clips, models):
    for clip in clips:
        src = frames(clip)
        sam = load_sam(clip)
        tiles = {}
        for model in models:
            if model == "sam31":
                rows = None
            else:
                p = ROOT / f"benchmark/out/{model}/{clip}.json"
                if not p.exists():
                    print("skip", model, clip)
                    continue
                rows = json.loads(p.read_text())["frames"]
            out = []
            held = None
            for i, f in enumerate(src):
                img = f.copy()
                if rows is None:
                    draw_sam(img, i, sam)
                else:
                    row = rows[i] if i < len(rows) else {"objects": [], "skipped": True}
                    if not row.get("skipped"):
                        held = row
                    draw_baseline(img, held or row, model)  # CPU-subsampled models hold their last scored frame
                    if row.get("skipped") or held is not row:
                        chip(img, "scored every 5th frame (CPU)", 24, 170, (93, 108, 123), 0.7)
                header(img, NAMES[model], "same clip · same prompts · offline")
                out.append(img)
            write(OUT / f"{model}.{clip}.mp4", out)
            tiles[model] = out
            print("wrote", model, clip, flush=True)
        if len(tiles) == 4:
            grid = [np.vstack([np.hstack([cv2.resize(tiles[a][i], (960, 540)) for a in r]) for r in (("yolo11", "rtdetr"), ("gdino", "sam31"))])
                    for i in range(len(src))]
            write(OUT / f"grid.{clip}.mp4", grid)
            print("wrote grid", clip, flush=True)


if __name__ == "__main__":
    models = sys.argv[1:] or ["yolo11", "rtdetr", "gdino", "sam31"]
    main(["glasses-table", "vitamin-behind-laptop"], models)
