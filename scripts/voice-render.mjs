// pnpm voice:render — build-time only. Renders every Maya line with ElevenLabs (with timestamps), writes
// mp3 normalised to -16 LUFS plus word alignment for the lip-sync. The key stays in .env and is never shipped.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const VOICE = "XrExE9yKIg1WjnnlVkGX"; // Matilda (Website §18)
const SETTINGS = { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true };
const PHRASES = [
  { id: "let-me-check", text: "Let me check…" },
  { id: "ask-yuki-first", text: "I'll ask Yuki first." },
  { id: "noted", text: "Noted." },
  { id: "sent", text: "Sent." },
  { id: "hi", text: "Hi, I'm Maya." },
  { id: "ask-yuki", text: "I'll ask Yuki." },
];

let key;
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?(.*?)["']?\s*$/);
  if (m) key = m[1];
}
if (!key) throw new Error("ELEVENLABS_API_KEY missing from .env");

// Character times → words, in ms (the shape agent.reply.alignment uses in lib/contract.ts).
function words(al) {
  const out = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    const s = Math.round(al.character_start_times_seconds[i] * 1000), e = Math.round(al.character_end_times_seconds[i] * 1000);
    if (/\s/.test(ch)) { if (cur) out.push(cur); cur = null; return; }
    if (!cur) cur = { word: "", start: s, end: e };
    cur.word += ch; cur.end = e;
  });
  if (cur) out.push(cur);
  return out;
}

async function render({ id, text }, audioDir, alignDir) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: SETTINGS }),
  });
  if (!r.ok) throw new Error(`${id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const raw = `${audioDir}/${id}.raw.mp3`;
  writeFileSync(raw, Buffer.from(j.audio_base64, "base64"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-b:a", "128k", `${audioDir}/${id}.mp3`]);
  rmSync(raw);
  writeFileSync(`${alignDir}/${id}.json`, JSON.stringify({ id, text, voice: "ElevenLabs Matilda", words: words(j.alignment), characters: j.alignment }, null, 1));
  console.log("rendered", id, `${text.length} chars`);
  return text.length;
}

const run = process.argv.includes("--run") ? process.argv[process.argv.indexOf("--run") + 1] : "run-001";
const linesFile = [`fixtures/${run}/lines.json`, `fixtures/${run}/lines.placeholder.json`].find(existsSync);
const lines = JSON.parse(readFileSync(linesFile, "utf8"));
for (const d of [`fixtures/${run}/audio`, `fixtures/${run}/alignment`, "public/audio/phrases", "public/audio/phrases/alignment"]) mkdirSync(d, { recursive: true });
let chars = 0;
for (const l of lines) chars += await render(l, `fixtures/${run}/audio`, `fixtures/${run}/alignment`);
for (const p of PHRASES) chars += await render(p, "public/audio/phrases", "public/audio/phrases/alignment");
console.log(`done: ${lines.length + PHRASES.length} lines, ${chars} characters`);
