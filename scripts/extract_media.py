"""Media for run-001 from the recorded SAM output: motion-gate values, sighting mask PNGs, enrol crops, person mask.

Run with any Python that has opencv + numpy (benchmark/.venv works): python scripts/extract_media.py
Writes fixtures/run-001/{masks,stills}/ and fixtures/run-001/media.json for scripts/build-run.mjs.
"""
import base64
import json
from pathlib import Path

import cv2
import numpy as np

RUN = Path(__file__).resolve().parent.parent / "fixtures/run-001"
(RUN / "masks").mkdir(exist_ok=True)
(RUN / "stills").mkdir(exist_ok=True)


def read(clip):
    cap = cv2.VideoCapture(str(RUN / f"clips/{clip}.analysis.mp4"))
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            return out
        out.append(f)


def motion(frames):
    # Same gate as the capture page: 64x36 greyscale, mean absolute difference between frames, 0..1.
    small = [cv2.resize(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (64, 36), interpolation=cv2.INTER_AREA).astype(np.float32) for f in frames]
    return [0.0] + [round(float(np.mean(np.abs(b - a)) / 255), 4) for a, b in zip(small, small[1:])]


def perception(clip, concept):
    j = json.loads((RUN / f"perception/{clip}.{concept}.json").read_text())
    return {f["frame"]: f["objects"] for f in j["frames"]}


def mask_png(obj, shape, path):
    m = obj["mask"]
    bits = np.unpackbits(np.frombuffer(base64.b64decode(m["bits"]), dtype=np.uint8))[: m["w"] * m["h"]].reshape(m["h"], m["w"])
    rgba = np.zeros((shape[0], shape[1], 4), dtype=np.uint8)
    y1, x1 = min(shape[0], m["y"] + m["h"]), min(shape[1], m["x"] + m["w"])
    rgba[m["y"]:y1, m["x"]:x1, 3] = bits[: y1 - m["y"], : x1 - m["x"]] * 255
    rgba[..., :3] = (224, 100, 0)
    cv2.imwrite(str(path), rgba)


def crop(frame, box, path, pad=24):
    x1, y1, x2, y2 = box
    cv2.imwrite(str(path), frame[max(0, y1 - pad): y2 + pad, max(0, x1 - pad): x2 + pad])


media = {}
for clip, items in (("glasses-table", ("glasses", "white-bottle")), ("vitamin-behind-laptop", ("glasses", "white-bottle"))):
    fr = read(clip)
    media[clip] = {"frames": len(fr), "motion": motion(fr), "sightings": {}}
    cv2.imwrite(str(RUN / f"stills/{clip}.jpg"), fr[-1], [cv2.IMWRITE_JPEG_QUALITY, 88])
    for concept in items:
        per = perception(clip, concept)
        hits = [k for k in sorted(per) if per[k]]
        if not hits:
            continue
        last = hits[-1]  # last frame the object was seen in this clip
        o = per[last][0]
        mask_png(o, fr[0].shape, RUN / f"masks/{clip}.{concept}.f{last}.png")
        media[clip]["sightings"][concept] = {"frame": last, "first": hits[0], "box": o["box"], "conf": round(o["conf"], 3), "id": o["id"],
                                             "frames": len(hits), "maskUrl": f"/fixtures/run-001/masks/{clip}.{concept}.f{last}.png"}
    per = perception(clip, "person")
    k = sorted(k for k in per if per[k])[len(per) // 2]
    mask_png(per[k][0], fr[0].shape, RUN / f"masks/{clip}.person.f{k}.png")
    media[clip]["personMaskUrl"] = f"/fixtures/run-001/masks/{clip}.person.f{k}.png"

for clip, concept, name in (("glasses-opened", "glasses", "glasses"), ("vitamin", "white-bottle", "pillbox")):
    p = RUN / f"perception/{clip}.{concept}.json"
    if not p.exists():
        p = RUN / f"perception/{clip}.small-white-pill-bottle.json"
    per = {f["frame"]: f["objects"] for f in json.loads(p.read_text())["frames"]}
    best = max((o for v in per.values() for o in v), key=lambda o: o["conf"])
    fr = read(clip)
    k = next(k for k, v in per.items() if best in v)
    crop(fr[k], best["box"], RUN / f"stills/{name}-crop.png")

(RUN / "media.json").write_text(json.dumps(media, indent=1))
print(json.dumps({c: {k: v for k, v in m.items() if k != "motion"} for c, m in media.items()}, indent=1))
