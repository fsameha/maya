// pnpm record --run run-001
// Real perception for the fixtures: each clip in fixtures/<run>/clips is sent to SAM 3.1 (one request per concept),
// the streamed lines are saved raw, masks are decoded, and each request is logged with hash, model, time and cost.
// Needs @meta-sam/parser (SAM License). Set SAM_PARSER to its dist/index.js if it is not installed in node_modules.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const run = args[args.indexOf("--run") + 1] || "run-001";
const only = args.includes("--clip") ? args[args.indexOf("--clip") + 1] : null;
// Without the parser, raw lines and boxes are still recorded; masks decode on a later `pnpm record --decode-only`.
const decodeMaskToRaster = await import("@meta-sam/parser").then((m) => m.decodeMaskToRaster, () => null);
if (!decodeMaskToRaster) console.warn("@meta-sam/parser not installed: recording boxes and raw masks only");

const BASE = "https://api.meta.ai/v1";
const SAM_USD_PER_FRAME = 0.2 / 1000;
const dir = `fixtures/${run}`;
mkdirSync(`${dir}/perception`, { recursive: true });

function key() {
  let k;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*MODEL_API_KEY\s*=\s*["']?(.*?)["']?\s*$/);
    if (m) k = m[1];
  }
  if (!k) throw new Error("MODEL_API_KEY missing from .env");
  return k;
}
const auth = { Authorization: `Bearer ${key()}` };

// Which concepts to look for in each clip. Short noun phrases work; long phrases returned nothing in the kill test.
const CONCEPTS = JSON.parse(readFileSync(`${dir}/concepts.json`, "utf8"));

function probe(path) {
  const out = execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0",
    "-show_entries", "stream=nb_read_frames,width,height,r_frame_rate", "-of", "json", path]);
  const s = JSON.parse(out).streams[0];
  const [n, d] = s.r_frame_rate.split("/").map(Number);
  return { frames: +s.nb_read_frames, w: s.width, h: s.height, fps: n / d };
}

async function upload(path) {
  const fd = new FormData();
  fd.append("purpose", "user_data");
  fd.append("file", new Blob([readFileSync(path)], { type: "video/mp4" }), path.split("/").pop());
  const r = await fetch(`${BASE}/files`, { method: "POST", headers: auth, body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(`upload ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.id;
}

async function segment(fileId, concept) {
  const body = {
    model: "sam-3.1",
    input: [{ type: "message", role: "user", content: [
      { type: "input_text", text: concept }, { type: "input_video", file_id: fileId }] }],
    stream: true,
    metadata: { mask_encoding: "one_bit", include_confidence: "true" },
  };
  const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
  const t0 = performance.now();
  const r = await fetch(`${BASE}/responses`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`sam ${r.status} ${(await r.text()).slice(0, 300)}`);
  const dec = new TextDecoder();
  let buf = "", text = "", firstMs = null;
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.type === "response.output_text.delta") { firstMs ??= performance.now() - t0; text += ev.delta; }
      } catch { /* keepalive */ }
    }
  }
  return { text, requestHash, ms: Math.round(performance.now() - t0), firstLineMs: firstMs && Math.round(firstMs) };
}

const field = (tok) => Object.fromEntries(tok.split(";").slice(1).map((p) => { const i = p.indexOf("="); return [p.slice(0, i), p.slice(i + 1)]; }));

// One frame line → objects with box, confidence and decoded mask (bit-packed, base64, relative to the box origin).
function parseLine(line) {
  const fm = line.match(/^<(\d+)f>/);
  if (!fm) return null;
  const objects = [];
  const re = /(\d+)\s*<\|(box;[^|]*)\|>\s*<\|(mask;[^|]*)\|>/g;
  for (const m of line.matchAll(re)) {
    const b = field(m[2]), k = field(m[3]);
    const [h, w, rest] = [...k.data.split(",").slice(0, 2).map(Number), k.data.split(",").slice(2).join(",")];
    const encoding = rest.startsWith("~") ? "lossless" : "one_bit";
    const box = [+b.x1, +b.y1, +b.x2, +b.y2];
    let mask = { x: box[0] + +k.x, y: box[1] + +k.y, w, h, encoding, payload: rest };
    if (decodeMaskToRaster) {
      const raster = decodeMaskToRaster({ encoding, payload: rest, width: w, height: h });
      const packed = Buffer.alloc(Math.ceil(raster.length / 8));
      for (let i = 0; i < raster.length; i++) if (raster[i]) packed[i >> 3] |= 128 >> (i & 7);
      mask = { x: mask.x, y: mask.y, w, h, bits: packed.toString("base64"), area: raster.reduce((s, v) => s + v, 0) };
    }
    objects.push({ id: m[1], box, conf: +(b.c ?? k.c ?? 0), mask });
  }
  return { frame: +fm[1], objects };
}

if (args.includes("--decode-only")) {
  // Re-parse saved raw SAM lines (no API calls), e.g. after installing @meta-sam/parser.
  for (const f of readdirSync(`${dir}/perception`).filter((f) => f.endsWith(".json"))) {
    const p = `${dir}/perception/${f}`, j = JSON.parse(readFileSync(p, "utf8"));
    const raw = readFileSync(p.replace(/\.json$/, ".raw.txt"), "utf8");
    j.frames = raw.split("\n").map(parseLine).filter(Boolean);
    writeFileSync(p, JSON.stringify(j));
    console.log("decoded", f, j.frames.filter((x) => x.objects.length).length, "frames");
  }
  process.exit(0);
}

const ledger = existsSync(`${dir}/requests.json`) ? JSON.parse(readFileSync(`${dir}/requests.json`, "utf8")) : [];
for (const clip of readdirSync(`${dir}/clips`).filter((f) => f.endsWith(".analysis.mp4"))) {
  const id = clip.replace(".analysis.mp4", "");
  if (only && id !== only) continue;
  const meta = probe(`${dir}/clips/${clip}`);
  const fileId = await upload(`${dir}/clips/${clip}`);
  for (const concept of CONCEPTS[id] || []) {
    const res = await segment(fileId, concept);
    const slug = concept.replace(/\W+/g, "-");
    writeFileSync(`${dir}/perception/${id}.${slug}.raw.txt`, res.text);
    const frames = res.text.split("\n").map(parseLine).filter(Boolean);
    writeFileSync(`${dir}/perception/${id}.${slug}.json`, JSON.stringify({ clipId: id, concept, ...meta, frames }));
    const entry = {
      at: new Date().toISOString(), model: "sam-3.1", clipId: id, concept, requestHash: res.requestHash,
      ms: res.ms, firstLineMs: res.firstLineMs, frames: meta.frames,
      framesWithHit: frames.filter((f) => f.objects.length).length,
      ids: [...new Set(frames.flatMap((f) => f.objects.map((o) => o.id)))],
      usd: +(Math.max(50, meta.frames) * SAM_USD_PER_FRAME).toFixed(4),
    };
    ledger.push(entry);
    console.log(entry);
  }
}
writeFileSync(`${dir}/requests.json`, JSON.stringify(ledger, null, 2));
console.log("ledger usd", ledger.reduce((s, e) => s + e.usd, 0).toFixed(3));
