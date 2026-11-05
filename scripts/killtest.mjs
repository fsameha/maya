// Kill test (System tab §L step 1): one SAM 3.1 video call per prompt, one Voice Transcribe call,
// one Muse Spark 1.3 tool call. Prints hits, latency and estimated cost. Never prints keys.
// Usage: node scripts/killtest.mjs [sam|asr|spark|all]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const BASE = "https://api.meta.ai/v1";
const OUT = "fixtures/killtest/out";
mkdirSync(OUT, { recursive: true });

function loadEnv() {
  const env = {};
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const KEY = env.MODEL_API_KEY;
if (!KEY) throw new Error("MODEL_API_KEY missing from .env");
const auth = { Authorization: `Bearer ${KEY}` };

const PRICE = { samFrame: 0.2 / 1000, sparkIn: 1.25e-6, sparkOut: 4.25e-6, asrSec: 0.18 / 3600 };
const report = [];

async function uploadVideo(path) {
  const fd = new FormData();
  fd.append("purpose", "user_data");
  fd.append("file", new Blob([readFileSync(path)], { type: "video/mp4" }), path.split("/").pop());
  const r = await fetch(`${BASE}/files`, { method: "POST", headers: auth, body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(`upload ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.id;
}

// Streams a SAM response and returns the raw output lines.
async function sam(fileId, text, label, frames) {
  const t0 = performance.now();
  const body = {
    model: "sam-3.1",
    input: [{ type: "message", role: "user", content: [
      { type: "input_text", text },
      { type: "input_video", file_id: fileId },
    ] }],
    stream: true,
    metadata: { mask_encoding: "one_bit", include_confidence: "true" },
  };
  const r = await fetch(`${BASE}/responses`, {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`sam ${label} ${r.status}: ${(await r.text()).slice(0, 400)}`);
  let buf = "", out = "", firstMs = null;
  const dec = new TextDecoder();
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") { firstMs ??= performance.now() - t0; out += ev.delta; }
      } catch { /* non-JSON keepalive */ }
    }
  }
  const ms = Math.round(performance.now() - t0);
  const lines = out.split("\n").filter(Boolean);
  const hitFrames = lines.filter((l) => /<\|box/.test(l));
  const confs = [...out.matchAll(/c=([0-9.]+)/g)].map((m) => +m[1]);
  const ids = new Set();
  for (const l of hitFrames) for (const m of l.matchAll(/(?:^|,|f>)\s*(\d+)\s*<\|box/g)) ids.add(m[1]);
  writeFileSync(`${OUT}/sam-${label}.txt`, out);
  const res = {
    step: `sam:${label}`, prompt: text, ms, firstLineMs: firstMs && Math.round(firstMs),
    framesWithHit: `${hitFrames.length}/${frames}`, objectIds: [...ids], maxConf: confs.length ? Math.max(...confs) : null,
    usd: +(Math.max(50, frames) * PRICE.samFrame).toFixed(4),
  };
  report.push(res); console.log(res);
  return lines;
}

async function runSam() {
  const clips = [
    { path: "fixtures/killtest/glasses-table.mp4", frames: 46, prompts: [["glasses", "glasses"], ["reading glasses on the table", "glasses-phrase"], ["person", "person"]] },
    { path: "fixtures/killtest/vitamin-behind-laptop.mp4", frames: 41, prompts: [["small white pill bottle", "pillbox"]] },
  ];
  for (const c of clips) {
    const id = await uploadVideo(c.path);
    for (const [text, label] of c.prompts) {
      try { await sam(id, text, `${c.path.split("/").pop().replace(".mp4", "")}-${label}`, c.frames); }
      catch (e) { report.push({ step: `sam:${label}`, error: String(e.message) }); console.log(e.message); }
    }
    if (c.point) await sam(id, c.point, "point", c.frames);
  }
}

async function runPoint() {
  // Point prompt on the frame where the glasses rest on the side table (frame 40 of 46 at 5 fps).
  const [x, y] = (process.argv[3] || "").split(",").map(Number);
  if (!x) throw new Error("usage: node scripts/killtest.mjs point X,Y   (pixels in the 1280x720 clip)");
  const id = await uploadVideo("fixtures/killtest/glasses-table.mp4");
  await sam(id, `<40f>1<|point;x=${x};y=${y};w=1280;h=720|>`, "glasses-table-point", 46);
}

async function runAsr() {
  const t0 = performance.now();
  const fd = new FormData();
  fd.append("request", new Blob([JSON.stringify({ model: "muse-voice-transcribe-1.0", audioEncoding: "WAV", mode: "PUSH_TO_TALK" })], { type: "application/json" }));
  fd.append("audio", new Blob([readFileSync("fixtures/killtest/line.wav")], { type: "audio/wav" }), "line.wav");
  const r = await fetch(`${BASE}/asr/transcribe`, { method: "POST", headers: { ...auth, Accept: "application/json" }, body: fd });
  const txt = await r.text();
  writeFileSync(`${OUT}/asr.json`, txt);
  const res = { step: "asr", status: r.status, ms: Math.round(performance.now() - t0), body: txt.slice(0, 400), usd: +(4 * PRICE.asrSec).toFixed(5) };
  report.push(res); console.log(res);
}

async function runSpark() {
  const t0 = performance.now();
  const body = {
    model: "muse-spark-1.3",
    input: [
      { role: "system", content: "You are Maya, a calm memory companion. Use tools for facts. Never give medical advice." },
      { role: "user", content: "Maya, I can't find my glasses." },
    ],
    tools: [{
      type: "function", name: "find_object", description: "Look up where an enrolled object was last seen.",
      parameters: { type: "object", properties: { item: { type: "string", enum: ["glasses", "pill box"] } }, required: ["item"], additionalProperties: false },
    }],
    tool_choice: "auto",
  };
  const r = await fetch(`${BASE}/responses`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  writeFileSync(`${OUT}/spark.json`, JSON.stringify(j, null, 2));
  const call = (j.output || []).find((o) => o.type === "function_call");
  const u = j.usage || {};
  const res = {
    step: "spark", status: r.status, ms: Math.round(performance.now() - t0), model: j.model,
    toolCall: call ? `${call.name}(${call.arguments})` : null, error: r.ok ? undefined : JSON.stringify(j).slice(0, 300),
    usd: +(((u.input_tokens || 0) * PRICE.sparkIn) + ((u.output_tokens || 0) * PRICE.sparkOut)).toFixed(5),
  };
  report.push(res); console.log(res);
}

const which = process.argv[2] || "all";
if (which === "sam" || which === "all") await runSam();
if (which === "point") await runPoint();
if (which === "asr" || which === "all") await runAsr();
if (which === "spark" || which === "all") await runSpark();
const stamp = new Date().toISOString();
const hash = createHash("sha256").update(JSON.stringify(report)).digest("hex").slice(0, 12);
writeFileSync(`${OUT}/report-${which}.json`, JSON.stringify({ at: stamp, hash, report }, null, 2));
console.log("total usd ≈", report.reduce((s, r) => s + (r.usd || 0), 0).toFixed(4));
