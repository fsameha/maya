// Builds fixtures/run-001/run.json from the real recording: SAM sightings (record.mjs + extract_media.py),
// the memory engine, the policy gate and real Muse Spark 1.3 turns. Chapters 4–6 keep the caregiver-side events,
// and the quiet morning stays labelled Simulated. Then run `pnpm voice:render` so Maya's audio matches her words.
import { readFileSync, writeFileSync } from "node:fs";
import { turn } from "../lib/maya/agent.ts";
import { zoneOf, personRegion, nextState, relative, clock } from "../lib/maya/memory.ts";

const dir = "fixtures/run-001";
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
let key;
for (const l of readFileSync(".env", "utf8").split("\n")) { const m = l.match(/^\s*MODEL_API_KEY\s*=\s*["']?(.*?)["']?\s*$/); if (m) key = m[1]; }

const base = J(`${dir}/run.placeholder.json`);
const media = J(`${dir}/media.json`);
const ledger = J(`${dir}/requests.json`);
const FPS = 15;
// Phone clock at the start of each clip (MP4 creation_time).
const START = { "glasses-table": "2026-11-04T22:41:02Z", "vitamin-behind-laptop": "2026-11-04T22:42:28Z" };
const at = (clip, frame) => new Date(Date.parse(START[clip]) + (frame / FPS) * 1000).toISOString();

// Zones were proposed once on the still and confirmed by hand (1920×1080 source pixels).
const zones = [
  { id: "table_right", name: "side table, right", polygon: [[985, 360], [1320, 360], [1320, 790], [985, 790]] },
  { id: "desk", name: "desk", polygon: [[0, 300], [880, 300], [880, 720], [0, 720]] },
];
const items = [
  { id: "glasses", name: "glasses", concept: "glasses", enrolCropUrl: `/${dir}/stills/glasses-crop.png` },
  { id: "pillbox", name: "pill bottle", concept: "white bottle", enrolCropUrl: `/${dir}/stills/pillbox-crop.png` },
];

function perception(clip, concept) { return J(`${dir}/perception/${clip}.${concept}.json`); }
function personBox(clip, frame) {
  const f = perception(clip, "person").frames.find((x) => x.frame === frame);
  return f?.objects[0]?.box;
}

// Memory: one sighting per item per clip (its last frame), then the state machine.
const tracks = {};
const sightingsByClip = {};
for (const clip of Object.keys(START)) {
  sightingsByClip[clip] = [];
  for (const [itemId, concept] of [["glasses", "glasses"], ["pillbox", "white-bottle"]]) {
    const s = media[clip].sightings[concept];
    if (!s) continue;
    const region = personRegion(s.box, personBox(clip, s.frame));
    const z = zoneOf(s.box, zones);
    const sighting = {
      id: `s_${clip}_${itemId}_${s.frame}`, itemId, clipId: clip, frame: s.frame, t: at(clip, s.frame),
      zoneId: z?.id ?? "none", box: s.box, maskUrl: s.maskUrl, conf: s.conf, overlapsPerson: !!region,
      ...(region ? { personRegion: region } : {}),
    };
    const visibleAtEnd = s.frame >= media[clip].frames - 2;
    tracks[itemId] = nextState(tracks[itemId], sighting, visibleAtEnd);
    sightingsByClip[clip].push({ sighting, state: tracks[itemId] });
  }
}

const glassesS = sightingsByClip["glasses-table"].find((x) => x.sighting.itemId === "glasses").sighting;
const gZone = zones.find((z) => z.id === glassesS.zoneId);
// Mum sits at the desk at the end of the clip; relative direction is computed from her last position.
const mumBox = personBox("glasses-table", media["glasses-table"].frames - 1) || [300, 300, 700, 1080];
const facts = { zone: gZone.name, time: clock(glassesS.t), relative: relative(gZone, (mumBox[0] + mumBox[2]) / 2), conf: glassesS.conf };
const firstPlaced = media["glasses-table"].sightings.glasses;

let lastFind = null;
let noteN = 0, qN = 0;
const runTool = (name, args) => {
  if (name === "find_object") {
    const item = /glass/i.test(args.item) ? "glasses" : /pill|bottle|medicine|vitamin/i.test(args.item) ? "pillbox" : null;
    if (item !== "glasses") return { found: false };
    const repeated = lastFind !== null;
    lastFind = Date.now();
    return { sightingId: glassesS.id, ...facts, lastSeenAt: facts.time, repeated };
  }
  if (name === "get_day") return { appointments: [{ time: "2:00 pm", title: "Doctor's appointment" }, { time: "1:30 pm", title: "Yuki picks you up" }], enteredBy: "Yuki" };
  if (name === "propose_note") return { noteId: `n_00${++noteN}`, status: "UNCONFIRMED", needs: "Yuki's confirmation" };
  if (name === "ask_caregiver") return { questionId: `q_00${++qN}`, delivered: true, to: "Yuki" };
  if (name === "play_messages") return { count: 1, from: "yuki" };
  return {};
};

const utter = {
  "ch1-1": "Maya, I can't find my glasses.",
  "ch1-2": "Maya, where are my glasses?",
  "ch2-1": "Maya, what's my day today?",
  "ch3-1": "This is my medicine. I take it twice a day after eating.",
  "ch3-2": "Can I take another one?",
};
const turns = {};
for (const [k, u] of Object.entries(utter)) {
  turns[k] = await turn(key, u, runTool);
  console.log(k, turns[k].policy.route, turns[k].tools.map((t) => t.name).join(","), "→", JSON.stringify(turns[k].reply), `${turns[k].ms}ms $${turns[k].usd}`);
}

// Rewrite the placeholder timeline with the real outputs, keeping its timing.
const clipFor = { clip_0412: "glasses-table", clip_0815: "vitamin-behind-laptop" };
const conceptFor = { "glasses-table": "glasses", "vitamin-behind-laptop": "white-bottle" };
const lineIds = { "ch1-1": "ch1-maya-1", "ch1-2": "ch1-maya-2", "ch2-1": "ch2-maya-1", "ch3-1": "ch3-maya-1", "ch3-2": "ch3-maya-2" };
const order = Object.keys(utter);
const events = [];
let finalIdx = -1;
let pendingTurn = null;
const align = (id) => { try { return J(`${dir}/alignment/${id}.json`).words; } catch { return []; } };

for (const e of base.events) {
  if (e.clipId && clipFor[e.clipId]) {
    const clip = clipFor[e.clipId];
    if (e.type === "capture.clip") { events.push({ ...e, clipId: clip, videoUrl: `/${dir}/clips/${clip}.mp4`, fps: FPS, frames: media[clip].frames, motion: media[clip].motion }); continue; }
    if (e.type === "privacy.blur") { events.push({ ...e, clipId: clip, personMaskUrl: media[clip].personMaskUrl }); continue; }
    if (e.type === "perception.stream") {
      const c = conceptFor[clip];
      const raw = readFileSync(`${dir}/perception/${clip}.${c}.raw.txt`, "utf8").split("\n").filter(Boolean);
      events.push({ ...e, clipId: clip, concept: c.replace("-", " "), lines: raw.slice(-12) });
      continue;
    }
    if (e.type === "perception.done") {
      const req = ledger.filter((r) => r.clipId === clip).slice(-3);
      events.push({ ...e, clipId: clip, sightings: sightingsByClip[clip].map((x) => x.sighting),
        ms: req.reduce((s, r) => s + r.ms, 0), usd: +req.reduce((s, r) => s + r.usd, 0).toFixed(4), requestHashes: req.map((r) => r.requestHash), model: "sam-3.1" });
      continue;
    }
  }
  if (e.type === "memory.state") {
    const s = Object.values(sightingsByClip).flat().find((x) => x.sighting.itemId === e.itemId);
    events.push({ ...e, state: s.state.state, sightingId: s.sighting.id, superseded: s.state.history });
    continue;
  }
  if (e.type === "asr.final" && e.speaker === "samiha") { finalIdx++; pendingTurn = order[finalIdx] ? turns[order[finalIdx]] : null; }
  if (pendingTurn && e.type === "policy.check") { events.push({ ...e, ...pendingTurn.policy, model: pendingTurn.model }); continue; }
  if (pendingTurn && e.type === "agent.tool") {
    const t = pendingTurn.tools.shift();
    if (t) events.push({ ...e, name: t.name, args: t.args, result: t.result });
    for (const extra of pendingTurn.tools.splice(0)) events.push({ ...e, at: e.at + 100, name: extra.name, args: extra.args, result: extra.result });
    continue;
  }
  if (pendingTurn && e.type === "agent.reply") {
    const id = lineIds[order[finalIdx]];
    const f = order[finalIdx].startsWith("ch1") ? { zone: facts.zone, time: facts.time, relative: facts.relative } : e.facts;
    events.push({ ...e, text: pendingTurn.reply, facts: f, audioUrl: `/${dir}/audio/${id}.mp3`, alignment: align(id),
      model: pendingTurn.model, ms: pendingTurn.ms, usd: pendingTurn.usd, requestHashes: pendingTurn.requests.map((r) => r.requestHash) });
    pendingTurn = null;
    continue;
  }
  if (e.type === "agent.reply" && e.audioUrl) {
    const id = e.audioUrl.split("/").pop().replace(".placeholder.wav", "");
    events.push({ ...e, audioUrl: `/${dir}/audio/${id}.mp3`, alignment: align(id) });
    continue;
  }
  if (e.type === "spend") {
    const usd = ledger.reduce((s, r) => s + r.usd, 0) + Object.values(turns).reduce((s, t) => s + t.usd, 0);
    events.push({ ...e, usd: +usd.toFixed(3) });
    continue;
  }
  // scripted caregiver beats come from the placeholder timeline; the real item is a pill bottle
  if (e.type === "note.created" || e.type === "note.confirmed") { events.push({ ...e, text: e.text.replace(/pill box/i, (m) => (m[0] === "P" ? "Pill bottle" : "pill bottle")) }); continue; }
  if (e.type === "caregiver.push") { events.push({ ...e, body: e.body.replace(/pill box/i, "pill bottle") }); continue; }
  events.push(e);
}

const run = { id: "run-001", mode: "replay", frame: { w: 1920, h: 1080 }, items, zones, events,
  recordedAt: new Date().toISOString(), firstPlacedFrame: firstPlaced.first };
writeFileSync(`${dir}/run.json`, JSON.stringify(run, null, 1));
const lines = J(`${dir}/lines.json`);
for (const [k, id] of Object.entries(lineIds)) { const l = lines.find((x) => x.id === id); if (l) l.text = turns[k].reply; }
writeFileSync(`${dir}/lines.json`, JSON.stringify(lines, null, 1));
console.log("wrote run.json with", events.length, "events; facts", facts);
