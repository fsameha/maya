// Lip-sync (PRD §7): timed text → viseme track → MouthDriver for <Maya />.
// The same track feeds audio alignment, text-only timing, and the How-it-works viseme strip.
import type { MouthDriver } from "@/components/maya/Maya";
import { VOWELS, wordToVisemes, type Viseme } from "@/components/maya/visemes";

export interface WordTime { word: string; start: number; end: number }
export interface CharAlignment { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }
export interface VisemeSeg { v: Viseme; start: number; end: number }

export const TEXT_CPS = 14;
export const TEXT_AMPLITUDE = 0.6;
const MIN_CONSONANT = 55;
const MIN_VOWEL = 90;
const MIN_ANY = 33;
const LOOKAHEAD = 60;
const SILENCE_MS = 120;

/** Split a word's time span across its visemes, vowels weighted heavier, then enforce holds. */
export function trackFromWords(words: WordTime[]): VisemeSeg[] {
  const segs: VisemeSeg[] = [];
  for (const w of words) {
    const vs = wordToVisemes(w.word);
    if (!vs.length) continue;
    const weights = vs.map((x) => (VOWELS.has(x.v) ? 1.6 : 1) * x.chars);
    const total = weights.reduce((a, b) => a + b, 0);
    let t = w.start;
    const span = Math.max(0, w.end - w.start);
    vs.forEach((x, i) => {
      const d = (span * weights[i]) / total;
      segs.push({ v: x.v, start: t, end: t + d });
      t += d;
    });
  }
  return enforceHolds(segs);
}

/** ElevenLabs character alignment → words → visemes at their real character times. */
export function wordsFromChars(a: CharAlignment): WordTime[] {
  const words: WordTime[] = [];
  let cur: WordTime | null = null;
  a.characters.forEach((c, i) => {
    const s = a.character_start_times_seconds[i] * 1000;
    const e = a.character_end_times_seconds[i] * 1000;
    if (/\s/.test(c)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { word: c, start: s, end: e };
    else {
      cur.word += c;
      cur.end = e;
    }
  });
  if (cur) words.push(cur);
  return words;
}

export function trackFromChars(a: CharAlignment): VisemeSeg[] {
  const segs: VisemeSeg[] = [];
  let i = 0;
  const chars = a.characters.map((c) => c.toLowerCase());
  while (i < chars.length) {
    const c = chars[i];
    const two = c + (chars[i + 1] ?? "");
    const s = a.character_start_times_seconds[i] * 1000;
    if (two === "th" || two === "oo" || two === "ee") {
      const v = wordToVisemes(two)[0].v;
      segs.push({ v, start: s, end: a.character_end_times_seconds[i + 1] * 1000 });
      i += 2;
      continue;
    }
    const v = /[a-z0-9]/.test(c) ? wordToVisemes(c)[0]?.v : null;
    if (v) segs.push({ v, start: s, end: a.character_end_times_seconds[i] * 1000 });
    i++;
  }
  return enforceHolds(segs);
}

/** Text with no audio: a virtual timeline at 14 characters per second. */
export function wordsFromText(text: string, startMs = 0, cps = TEXT_CPS): WordTime[] {
  const out: WordTime[] = [];
  const per = 1000 / cps;
  let t = startMs;
  for (const raw of text.split(/(\s+)/)) {
    if (!raw) continue;
    if (/^\s+$/.test(raw)) {
      t += per * raw.length;
      continue;
    }
    const punct = /[.,!?;:…]$/.test(raw) ? per * 4 : 0;
    const d = per * raw.length;
    out.push({ word: raw.replace(/[^\w'’]/g, "") || raw, start: t, end: t + d });
    t += d + punct;
  }
  return out;
}

/** Consonants hold ≥55ms, vowels ≈90ms, never under 33ms; a closed MBP always survives. */
export function enforceHolds(segs: VisemeSeg[]): VisemeSeg[] {
  const out: VisemeSeg[] = [];
  for (const s of segs) {
    const min = VOWELS.has(s.v) ? MIN_VOWEL : MIN_CONSONANT;
    const seg = { ...s };
    const prev = out[out.length - 1];
    if (prev && seg.start < prev.end) seg.start = prev.end;
    if (seg.end - seg.start < min) seg.end = seg.start + min;
    if (seg.end - seg.start < MIN_ANY) continue;
    out.push(seg);
  }
  return out;
}

export function sampleTrack(track: VisemeSeg[], t: number): Viseme | null {
  const at = (x: number) => {
    // binary search
    let lo = 0, hi = track.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const s = track[mid];
      if (x < s.start) hi = mid - 1;
      else if (x >= s.end) lo = mid + 1;
      else return s;
    }
    return null;
  };
  const cur = at(t);
  if (cur?.v === "MBP") return "MBP"; // closure wins
  const ahead = at(t + LOOKAHEAD);
  // coarticulation: a coming vowel shapes the mouth 60ms early, except over a protected closure
  if (cur) return ahead && ahead !== cur && VOWELS.has(ahead.v) && !VOWELS.has(cur.v) && ahead.start - t <= LOOKAHEAD ? ahead.v : cur.v;
  // inside a short gap between segments: keep the shape unless the gap is a real silence
  const prev = track.findLast?.((s) => s.end <= t);
  const next = ahead ?? track.find((s) => s.start > t);
  if (prev && next && next.start - prev.end < SILENCE_MS) return VOWELS.has(next.v) ? next.v : "MBP";
  return null;
}

export interface TimedDriver extends MouthDriver {
  durationMs: number;
  track: VisemeSeg[];
}

/** Drive the mouth from a clock (performance.now based) and a viseme track. */
export function trackDriver(track: VisemeSeg[], clock: () => number, amplitude: () => number = () => 1): TimedDriver {
  const end = track.length ? track[track.length - 1].end : 0;
  return {
    track,
    durationMs: end,
    sample() {
      const t = clock();
      if (t < 0 || t > end + SILENCE_MS) return null;
      const v = sampleTrack(track, t);
      if (!v) return null;
      return { v, amount: Math.max(0, Math.min(1, amplitude())) };
    },
  };
}

/** Text-only speech: starts at `startAt` (performance.now time). */
export function textDriver(text: string, startAt: number): TimedDriver {
  const track = trackFromWords(wordsFromText(text));
  return trackDriver(track, () => performance.now() - startAt, () => TEXT_AMPLITUDE);
}

/** RMS of a 10ms window from an AnalyserNode, mapped to 0..1 openness. */
export function rmsAmplitude(analyser: AnalyserNode | null): () => number {
  if (!analyser) return () => 1;
  const buf = new Float32Array(analyser.fftSize);
  return () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    // silent placeholder audio reads 0: fall back to a steady text-like amplitude
    if (rms < 1e-4) return TEXT_AMPLITUDE;
    return Math.min(1, 0.25 + rms * 6);
  };
}
