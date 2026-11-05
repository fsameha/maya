#!/usr/bin/env node
// Generates the placeholder fixtures (PRD §14): every file is named *.placeholder.*.
// They get replaced by the backend's recorded run (`pnpm record --run run-001`).
// Needs ImageMagick (`magick`) and ffmpeg for the stills and clips; JSON and audio are pure Node.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const W = 1280, H = 720;

const out = (p, data) => {
  mkdirSync(dirname(join(ROOT, p)), { recursive: true });
  writeFileSync(join(ROOT, p), data);
};
const has = (bin) => {
  try { execFileSync(bin, ["-version"], { stdio: "ignore" }); return true; } catch { return false; }
};

// ---------- media helpers ----------
function silentWav(ms, rate = 16000) {
  const n = Math.round((ms / 1000) * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

/** ElevenLabs-shaped character alignment at a calm speaking rate, with pauses at punctuation. */
function charAlignment(text, cps = 14.5) {
  const characters = [], s = [], e = [];
  let t = 0.08;
  for (const c of text) {
    const d = /\s/.test(c) ? 0.045 : /[.,…:;?]/.test(c) ? 0.05 : 1 / cps;
    characters.push(c); s.push(+t.toFixed(3)); e.push(+(t + d).toFixed(3));
    t += d + (/[.…?]/.test(c) ? 0.28 : /[,:;]/.test(c) ? 0.14 : 0);
  }
  return { characters, character_start_times_seconds: s, character_end_times_seconds: e, durationMs: Math.round(t * 1000 + 250) };
}
function wordsFrom(a, offset = 0) {
  const words = []; let cur = null;
  a.characters.forEach((c, i) => {
    const st = Math.round(a.character_start_times_seconds[i] * 1000) + offset;
    const en = Math.round(a.character_end_times_seconds[i] * 1000) + offset;
    if (/\s/.test(c)) { if (cur) words.push(cur); cur = null; return; }
    if (!cur) cur = { word: c, start: st, end: en }; else { cur.word += c; cur.end = en; }
  });
  if (cur) words.push(cur);
  return words;
}


// ---------- masks: shapes rasterised straight to an RGBA PNG at half resolution (PRD §16) ----------
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** shapes in full-frame px: {e:[cx,cy,rx,ry]} ellipses or {r:[x,y,w,h,radius]} rounded rects */
function maskPng(shapes, scale = 0.5) {
  const w = Math.round(W * scale), h = Math.round(H * scale);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  const inside = (x, y) => shapes.some((s) => {
    if (s.e) { const [cx, cy, rx, ry] = s.e; return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1; }
    const [rx0, ry0, rw, rh, rr] = s.r;
    const qx = Math.max(rx0 + rr - x, 0, x - (rx0 + rw - rr)), qy = Math.max(ry0 + rr - y, 0, y - (ry0 + rh - rr));
    return x >= rx0 && x <= rx0 + rw && y >= ry0 && y <= ry0 + rh && qx * qx + qy * qy <= rr * rr;
  });
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      const on = inside((x + 0.5) / scale, (y + 0.5) / scale);
      raw[o] = raw[o + 1] = raw[o + 2] = 255;
      raw[o + 3] = on ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- the room still (flat illustration in the site style) ----------
const ROOM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#e9edf1"/>
<rect y="470" width="${W}" height="250" fill="#d6dce2"/>
<path d="M0 470H1280" stroke="#c3cad2" stroke-width="3"/>
<rect x="520" y="70" width="300" height="230" rx="10" fill="#f7f9fb" stroke="#c3cad2" stroke-width="6"/>
<path d="M670 70V300M520 185H820" stroke="#c3cad2" stroke-width="5"/>
<g><rect x="70" y="170" width="250" height="18" rx="4" fill="#b9c2cb"/>
<rect x="95" y="120" width="40" height="50" rx="6" fill="#9aa6b2"/><rect x="150" y="135" width="60" height="35" rx="6" fill="#aab4be"/>
<rect x="230" y="110" width="28" height="60" rx="8" fill="#8f9ba7"/>
<rect x="70" y="250" width="250" height="18" rx="4" fill="#b9c2cb"/>
<rect x="100" y="205" width="70" height="45" rx="8" fill="#a3adb7"/><circle cx="250" cy="228" r="20" fill="#93a0ac"/></g>
<rect x="40" y="420" width="220" height="210" rx="18" fill="#c7cfd7"/><rect x="40" y="420" width="220" height="40" rx="14" fill="#b4bec8"/>
<rect x="60" y="360" width="120" height="70" rx="10" fill="#dfe4e9"/>
<g><rect x="760" y="470" width="420" height="22" rx="6" fill="#a9b3bd"/>
<rect x="790" y="492" width="18" height="160" rx="6" fill="#9aa6b2"/><rect x="1132" y="492" width="18" height="160" rx="6" fill="#9aa6b2"/>
<rect x="1040" y="420" width="70" height="50" rx="10" fill="#c3cad2"/></g>
<g><rect x="560" y="420" width="150" height="24" rx="8" fill="#b4bec8"/><rect x="575" y="300" width="22" height="130" rx="8" fill="#b4bec8"/>
<rect x="590" y="444" width="16" height="190" rx="6" fill="#9aa6b2"/><rect x="664" y="444" width="16" height="190" rx="6" fill="#9aa6b2"/></g>
<g fill="none" stroke="#1c1e21" stroke-width="5"><ellipse cx="905" cy="455" rx="20" ry="12"/><ellipse cx="955" cy="455" rx="20" ry="12"/><path d="M925 453q5-5 10 0"/></g>
<text x="${W / 2}" y="${H - 28}" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#5d6c7b">Placeholder still · replaced by the recorded run</text>
</svg>`;

const PILL_SVG = ROOM_SVG.replace(
  "</svg>",
  `<g><rect x="600" y="330" width="90" height="56" rx="10" fill="#f2a918" stroke="#1c1e21" stroke-width="4"/><path d="M630 330v56M660 330v56" stroke="#1c1e21" stroke-width="3"/></g></svg>`,
);



function stillToClip(stillPath, clipPath, seconds = 10) {
  const dest = join(ROOT, clipPath);
  mkdirSync(dirname(dest), { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-loop", "1", "-i", join(ROOT, stillPath), "-t", String(seconds), "-r", "25",
    "-vf", "scale=1280:720,format=yuv420p", "-c:v", "libx264", "-tune", "stillimage", "-crf", "30",
    "-movflags", "+faststart", dest,
  ]);
}

// ---------- run-001: the six-chapter story ----------
function buildRun001() {
  const P = "/fixtures/run-001";
  const events = [];
  const add = (e) => (events.push(e), e);
  const lines = [];
  const maya = (at, id, text, expression = "neutral", facts = {}) => {
    const a = charAlignment(text);
    out(`run-001/alignment/${id}.placeholder.json`, JSON.stringify({ text, ...a }, null, 0));
    out(`run-001/audio/${id}.placeholder.wav`, silentWav(a.durationMs));
    lines.push({ id, text });
    return add({
      at, type: "agent.reply", text, facts, expression,
      audioUrl: `${P}/audio/${id}.placeholder.wav`, alignment: wordsFrom(a, 0),
    });
  };
  const human = (at, speaker, id, text) => {
    const a = charAlignment(text, 13);
    out(`run-001/audio/${id}.placeholder.wav`, silentWav(a.durationMs));
    const words = text.split(" ");
    const step = a.durationMs / words.length;
    for (let i = 1; i < words.length; i++) {
      if (i % 2 === 0) add({ at: Math.round(at + step * i), type: "asr.partial", speaker, text: words.slice(0, i).join(" ") });
    }
    add({ at: at + a.durationMs, type: "asr.final", speaker, text, audioUrl: `${P}/audio/${id}.placeholder.wav` });
    return at + a.durationMs;
  };
  const gate = (at, text, hits, health) =>
    add({ at, type: "policy.check", text, lexiconHits: hits, classifier: { health_related: health }, route: health || hits.length ? "ask_caregiver" : "agent" });
  const motion = (peakAt) => Array.from({ length: 50 }, (_, i) => +Math.max(0.02, Math.exp(-((i - peakAt) ** 2) / 40) * 0.9 + (i % 7) * 0.004).toFixed(3));

  const glassesSighting = {
    id: "s_0412_38", itemId: "glasses", clipId: "clip_0412", frame: 38, t: "2026-11-03T10:42:07+09:00",
    zoneId: "table_right", box: [880, 438, 980, 472], maskUrl: `${P}/masks/glasses_0412_38.placeholder.png`,
    conf: 0.93, overlapsPerson: false,
  };
  const olderSighting = {
    id: "s_0388_12", itemId: "glasses", clipId: "clip_0388", frame: 12, t: "2026-11-03T08:15:40+09:00",
    zoneId: "bedside", box: [80, 380, 150, 410], maskUrl: `${P}/masks/glasses_0412_38.placeholder.png`,
    conf: 0.88, overlapsPerson: true, personRegion: "head",
  };
  const pillSighting = {
    id: "s_0815_20", itemId: "pillbox", clipId: "clip_0815", frame: 20, t: "2026-11-03T12:05:12+09:00",
    zoneId: "kitchen_shelf", box: [596, 326, 694, 390], maskUrl: `${P}/masks/pillbox_0815_20.placeholder.png`,
    conf: 0.91, overlapsPerson: true, personRegion: "hand",
  };
  const samLines = (concept, frames, box) =>
    Array.from({ length: frames }, (_, f) =>
      `<${f}f> {"concept":"${concept}","objects":[{"id":1,"score":${(0.86 + (f % 5) * 0.015).toFixed(3)},"box":[${box.join(",")}],"mask":"<one_bit ${box[2] - box[0]}x${box[3] - box[1]}>"}]}`);

  // Chapter 1 · Glasses
  add({ at: 0, type: "chapter", n: 1, title: "Glasses" });
  add({ at: 400, type: "capture.clip", clipId: "clip_0412", videoUrl: `${P}/clips/clip_0412.placeholder.mp4`, fps: 5, frames: 50, motion: motion(36) });
  add({ at: 900, type: "privacy.blur", clipId: "clip_0412", personMaskUrl: `${P}/masks/person_0412.placeholder.png` });
  let t = human(5200, "samiha", "ch1-samiha-1", "Maya, I can't find my glasses.");
  add({ at: t + 300, type: "perception.stream", clipId: "clip_0412", concept: "black reading glasses", lines: samLines("black reading glasses", 12, glassesSighting.box) });
  add({ at: t + 1500, type: "perception.done", clipId: "clip_0412", sightings: [glassesSighting], ms: 1180, usd: 0.012 });
  add({ at: t + 1800, type: "memory.state", itemId: "glasses", state: "LAST_SEEN", sightingId: glassesSighting.id, superseded: [olderSighting.id] });
  gate(t + 2000, "Maya, I can't find my glasses.", [], false);
  add({ at: t + 2300, type: "agent.tool", name: "find_object", args: { item: "glasses" }, result: { sightingId: glassesSighting.id, zone: "table, right", time: "10:42", relative: "to your right", conf: 0.93 } });
  maya(t + 4600, "ch1-maya-1", "Let me check… They're on the table to your right. You put them there at 10:42.", "happy", { zone: "table, right", time: "10:42", relative: "to your right" });
  t = human(t + 13500, "samiha", "ch1-samiha-2", "Maya, where are my glasses?");
  gate(t + 300, "Maya, where are my glasses?", [], false);
  add({ at: t + 600, type: "agent.tool", name: "find_object", args: { item: "glasses", repeatWithinMin: 1 }, result: { sightingId: glassesSighting.id, zone: "table, right", time: "10:42", repeated: true } });
  maya(t + 1400, "ch1-maya-2", "The table on your right. Did you find them?", "neutral", { zone: "table on your right" });

  // Chapter 2 · Today
  const c2 = 34000;
  add({ at: c2, type: "chapter", n: 2, title: "Today" });
  t = human(c2 + 1200, "samiha", "ch2-samiha-1", "Maya, what's my day today?");
  gate(t + 300, "Maya, what's my day today?", [], false);
  add({ at: t + 800, type: "agent.tool", name: "get_day", args: { date: "2026-11-03" }, result: { appointments: [{ time: "2:00 pm", title: "Doctor's appointment" }, { time: "1:30 pm", title: "Yuki picks you up" }] } });
  maya(t + 1700, "ch2-maya-1", "You have a doctor's appointment at 2 pm. Yuki will pick you up at 1:30.", "neutral", { appointment: "2 pm", pickup: "1:30" });

  // Chapter 3 · Medicine
  const c3 = 50000;
  add({ at: c3, type: "chapter", n: 3, title: "Medicine" });
  add({ at: c3 + 400, type: "capture.clip", clipId: "clip_0815", videoUrl: `${P}/clips/clip_0815.placeholder.mp4`, fps: 5, frames: 50, motion: motion(20) });
  add({ at: c3 + 1400, type: "perception.stream", clipId: "clip_0815", concept: "pill box", lines: samLines("pill box", 10, pillSighting.box) });
  add({ at: c3 + 2600, type: "perception.done", clipId: "clip_0815", sightings: [pillSighting], ms: 1020, usd: 0.011 });
  add({ at: c3 + 2800, type: "memory.state", itemId: "pillbox", state: "ON_PERSON", sightingId: pillSighting.id });
  t = human(c3 + 3600, "samiha", "ch3-samiha-1", "This is my medicine. I take it twice a day after eating.");
  gate(t + 300, "This is my medicine. I take it twice a day after eating.", ["medicine", "take"], true);
  add({ at: t + 900, type: "agent.tool", name: "propose_note", args: { item: "pillbox", text: "Pill box, twice a day after meals" }, result: { noteId: "n_001", status: "UNCONFIRMED" } });
  add({ at: t + 1100, type: "note.created", noteId: "n_001", text: "Pill box, twice a day after meals", by: "maya" });
  maya(t + 1500, "ch3-maya-1", "Noted. I'll check with Yuki first.", "neutral", {});
  t = human(t + 6500, "samiha", "ch3-samiha-2", "Can I take another one?");
  gate(t + 300, "Can I take another one?", ["take"], true);
  add({ at: t + 800, type: "agent.tool", name: "ask_caregiver", args: { question: "Can I take another one?", about: "pillbox" }, result: { questionId: "q_001", delivered: true } });
  maya(t + 1300, "ch3-maya-2", "I'll ask Yuki.", "neutral", {});

  // Chapter 4 · Yuki confirms
  const c4 = 80000;
  add({ at: c4, type: "chapter", n: 4, title: "Yuki confirms" });
  add({ at: c4 + 1200, type: "caregiver.push", title: "Maya", body: "Mum says: pill box, twice a day after meals. Confirm?", actions: ["Confirm", "Edit"] });
  add({ at: c4 + 4600, type: "caregiver.tap", action: "Confirm" });
  add({ at: c4 + 5000, type: "note.confirmed", noteId: "n_001", text: "Reminder set by Yuki", by: "yuki" });
  out("run-001/audio/ch4-yuki-1.placeholder.wav", silentWav(3200));
  add({ at: c4 + 9500, type: "message.voice", from: "yuki", audioUrl: `${P}/audio/ch4-yuki-1.placeholder.wav`, transcript: "Only one after dinner, Mum. Love you." });

  // Chapter 5 · Quiet morning (Simulated)
  const c5 = 98000;
  add({ at: c5, type: "chapter", n: 5, title: "Quiet morning" });
  add({ at: c5 + 1000, type: "escalation.step", step: "usual_missed", simulated: true });
  add({ at: c5 + 2400, type: "escalation.step", step: "check_in", simulated: true });
  add({ at: c5 + 2600, type: "agent.tool", name: "check_in_reply", args: { prompt: "Good morning. Are you up?" }, result: { replied: false, waitedMin: 10 } });
  maya(c5 + 2800, "ch5-maya-1", "Good morning. Are you up?", "concerned", {});
  add({ at: c5 + 9000, type: "escalation.step", step: "alert", simulated: true });
  add({ at: c5 + 9100, type: "caregiver.push", title: "Simulated · Maya", body: "No signs of activity since 9:12. Kettle usually by 8:05.", actions: ["Call Mum"] });
  add({ at: c5 + 13000, type: "escalation.step", step: "second_contact", simulated: true });

  // Chapter 6 · Messages
  const c6 = 116000;
  add({ at: c6, type: "chapter", n: 6, title: "Messages" });
  add({ at: c6 + 800, type: "agent.tool", name: "play_messages", args: {}, result: { count: 1, from: "yuki" } });
  maya(c6 + 1200, "ch6-maya-1", "Yuki left you a message.", "neutral", {});
  add({ at: c6 + 3800, type: "message.voice", from: "yuki", audioUrl: `${P}/audio/ch4-yuki-1.placeholder.wav`, transcript: "Only one after dinner, Mum. Love you." });
  t = human(c6 + 8200, "samiha", "ch6-samiha-1", "Tell her I found my glasses.");
  out("run-001/audio/ch6-samiha-msg.placeholder.wav", silentWav(2200));
  add({ at: t + 600, type: "message.voice", from: "samiha", audioUrl: `${P}/audio/ch6-samiha-msg.placeholder.wav`, transcript: "Tell her I found my glasses." });
  maya(t + 900, "ch6-maya-2", "Sent.", "happy", {});
  add({ at: t + 1200, type: "spend", usd: 0.041, clipsLeft: 0 });

  events.sort((a, b) => a.at - b.at);
  const run = {
    id: "run-001", mode: "replay", frame: { w: W, h: H },
    items: [
      { id: "glasses", name: "glasses", concept: "black reading glasses", enrolCropUrl: `${P}/stills/glasses-crop.placeholder.png` },
      { id: "pillbox", name: "pill box", concept: "pill box", enrolCropUrl: `${P}/stills/pillbox-crop.placeholder.png` },
    ],
    zones: [
      { id: "table_right", name: "table, right", polygon: [[760, 400], [1190, 400], [1190, 500], [760, 500]] },
      { id: "kitchen_shelf", name: "kitchen shelf", polygon: [[540, 290], [730, 290], [730, 450], [540, 450]] },
      { id: "bedside", name: "bedside", polygon: [[30, 340], [270, 340], [270, 470], [30, 470]] },
    ],
    events,
  };
  out("run-001/run.placeholder.json", JSON.stringify(run, null, 1));
  out("run-001/lines.placeholder.json", JSON.stringify(lines, null, 1));
  return run;
}

// ---------- try-001: Teach · Hide · Ask on a desk ----------
function buildTry001() {
  const P = "/fixtures/try-001";
  const events = [];
  const add = (e) => events.push(e);
  const keys = {
    id: "s_try_31", itemId: "keys", clipId: "clip_try_1", frame: 31, t: "2026-11-04T14:02:31+09:00",
    zoneId: "desk_left", box: [300, 430, 420, 500], maskUrl: `${P}/masks/keys.placeholder.png`, conf: 0.9, overlapsPerson: false,
  };
  add({ at: 0, type: "capture.clip", clipId: "clip_try_1", videoUrl: `${P}/clips/clip_try_1.placeholder.mp4`, fps: 5, frames: 50, motion: Array.from({ length: 50 }, (_, i) => +(0.05 + 0.8 * Math.exp(-((i - 28) ** 2) / 30)).toFixed(3)) });
  add({ at: 420, type: "perception.stream", clipId: "clip_try_1", concept: "keys", lines: Array.from({ length: 8 }, (_, f) => `<${f}f> {"concept":"keys","objects":[{"id":1,"score":0.9,"box":[300,430,420,500]}]}`) });
  add({ at: 1640, type: "perception.done", clipId: "clip_try_1", sightings: [keys], ms: 1220, usd: 0.012 });
  add({ at: 1900, type: "memory.state", itemId: "keys", state: "LAST_SEEN", sightingId: keys.id });
  add({ at: 3000, type: "asr.final", speaker: "visitor", text: "Where are my keys?" });
  add({ at: 3200, type: "policy.check", text: "Where are my keys?", lexiconHits: [], classifier: { health_related: false }, route: "agent" });
  add({ at: 3700, type: "agent.tool", name: "find_object", args: { item: "keys" }, result: { sightingId: keys.id, zone: "desk, left", time: "14:02:31" } });
  const text = "Let me check… Your keys were last seen on the desk, on the left, at 14:02.";
  const a = charAlignment(text);
  out(`try-001/audio/try-maya-1.placeholder.wav`, silentWav(a.durationMs));
  add({ at: 4400, type: "agent.reply", text, facts: { zone: "desk, left", time: "14:02" }, expression: "happy", audioUrl: `${P}/audio/try-maya-1.placeholder.wav`, alignment: wordsFrom(a) });
  add({ at: 4600, type: "spend", usd: 0.03, clipsLeft: 0 });
  // Be Yuki: the visitor says "This is my medicine" → the approval reaches the paired phone
  add({ at: 8000, type: "asr.final", speaker: "visitor", text: "This is my medicine." });
  add({ at: 8200, type: "policy.check", text: "This is my medicine.", lexiconHits: ["medicine"], classifier: { health_related: true }, route: "ask_caregiver" });
  add({ at: 8700, type: "agent.tool", name: "propose_note", args: { text: "Medicine, as described" }, result: { noteId: "n_try_1", status: "UNCONFIRMED" } });
  add({ at: 8900, type: "note.created", noteId: "n_try_1", text: "Medicine, as described", by: "maya" });
  const noted = "Noted. I'll check with Yuki first.";
  const a2 = charAlignment(noted);
  add({ at: 9200, type: "agent.reply", text: noted, facts: {}, expression: "neutral", audioUrl: "/audio/phrases/noted-check-yuki.placeholder.wav", alignment: wordsFrom(a2) });
  add({ at: 9400, type: "caregiver.push", title: "Maya", body: "Mum says: this is my medicine. Confirm?", actions: ["Confirm", "Edit"] });
  const run = {
    id: "try-001", mode: "replay", frame: { w: W, h: H },
    items: [{ id: "keys", name: "my keys", concept: "keys", enrolCropUrl: `${P}/stills/keys-crop.placeholder.png` }],
    zones: [
      { id: "desk_left", name: "desk, left", polygon: [[150, 380], [640, 380], [640, 620], [150, 620]] },
      { id: "desk_right", name: "desk, right", polygon: [[640, 380], [1130, 380], [1130, 620], [640, 620]] },
    ],
    events,
  };
  out("try-001/run.placeholder.json", JSON.stringify(run, null, 1));
}

function buildBenchmark() {
  const models = ["yolo11", "rtdetr", "gdino", "sam31"];
  out("benchmark/metrics.placeholder.json", JSON.stringify({
    placeholder: true,
    note: "Layout only. The Kaggle notebook writes metrics.json with real numbers.",
    models: models.map((id) => ({ id, recall50: null, falseAlarmsPerFrame: null, maskIoU: null, idSwitchesPer10s: null, latencyMs: null, usdPerClip: null })),
    evals: { memoryQA: null, healthRecall: null, falseRoutes: null, latencyP50: null, latencyP95: null, usdPerDay: null },
  }, null, 1));
}

// ---------- fixed phrases for Try (PRD §7), same voice as Watch ----------
function buildPhrases() {
  const PH = join(ROOT, "..", "public", "audio", "phrases");
  mkdirSync(PH, { recursive: true });
  const phrases = { "let-me-check": "Let me check…", "ask-yuki-first": "I'll ask Yuki first.", noted: "Noted.", sent: "Sent.", "hi-im-maya": "Hi, I'm Maya.", "noted-check-yuki": "Noted. I'll check with Yuki first." };
  for (const [id, text] of Object.entries(phrases)) {
    const a = charAlignment(text);
    writeFileSync(join(PH, `${id}.placeholder.wav`), silentWav(a.durationMs));
    writeFileSync(join(PH, `${id}.placeholder.json`), JSON.stringify({ text, ...a }));
  }
  writeFileSync(join(PH, "index.placeholder.json"), JSON.stringify(phrases, null, 1));
}

// ---------- run ----------
buildPhrases();
out("run-001/masks/glasses_0412_38.placeholder.png", maskPng([{ e: [905, 455, 25, 17] }, { e: [955, 455, 25, 17] }, { r: [920, 447, 20, 10, 2] }]));
out("run-001/masks/pillbox_0815_20.placeholder.png", maskPng([{ r: [596, 326, 98, 64, 12] }]));
out("run-001/masks/person_0412.placeholder.png", maskPng([{ e: [460, 250, 48, 48] }, { r: [400, 300, 120, 260, 50] }]));
out("try-001/masks/keys.placeholder.png", maskPng([{ r: [300, 430, 120, 70, 30] }]));
buildRun001();
buildTry001();
buildBenchmark();

if (has("magick")) {
  const tmp = join(ROOT, ".tmp-room.svg");
  writeFileSync(tmp, ROOM_SVG);
  mkdirSync(join(ROOT, "run-001/stills"), { recursive: true });
  execFileSync("magick", [tmp, "-quality", "86", join(ROOT, "run-001/stills/room.placeholder.jpg")]);
  writeFileSync(tmp, PILL_SVG);
  execFileSync("magick", [tmp, "-quality", "86", join(ROOT, "run-001/stills/room-pill.placeholder.jpg")]);

  execFileSync("magick", [join(ROOT, "run-001/stills/room.placeholder.jpg"), "-crop", "140x70+860+420", join(ROOT, "run-001/stills/glasses-crop.placeholder.png")]);
  execFileSync("magick", [join(ROOT, "run-001/stills/room-pill.placeholder.jpg"), "-crop", "120x90+585+313", join(ROOT, "run-001/stills/pillbox-crop.placeholder.png")]);
  const desk = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#e3e8ed"/><rect y="380" width="${W}" height="340" fill="#cfd6dd"/><g fill="none" stroke="#1c1e21" stroke-width="6"><circle cx="330" cy="465" r="22"/><path d="M350 470l60 14M395 480v14M380 476v12"/></g><text x="${W / 2}" y="${H - 28}" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#5d6c7b">Placeholder still · replaced by the recorded run</text></svg>`;
  writeFileSync(tmp, desk);
  mkdirSync(join(ROOT, "try-001/stills"), { recursive: true });
  execFileSync("magick", [tmp, "-quality", "86", join(ROOT, "try-001/stills/desk.placeholder.jpg")]);

  execFileSync("magick", [join(ROOT, "try-001/stills/desk.placeholder.jpg"), "-crop", "140x90+290+420", join(ROOT, "try-001/stills/keys-crop.placeholder.png")]);
  execFileSync("rm", ["-f", tmp, join(ROOT, ".tmp.svg")]);
}
if (has("ffmpeg") && existsSync(join(ROOT, "run-001/stills/room.placeholder.jpg"))) {
  stillToClip("run-001/stills/room.placeholder.jpg", "run-001/clips/clip_0412.placeholder.mp4");
  stillToClip("run-001/stills/room-pill.placeholder.jpg", "run-001/clips/clip_0815.placeholder.mp4");
  stillToClip("try-001/stills/desk.placeholder.jpg", "try-001/clips/clip_try_1.placeholder.mp4");
}
console.log("placeholder fixtures written to", ROOT);
