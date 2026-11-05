import type { Lens } from "./shapes";

// 12 mouth targets in 3 groups (PRD §6), measured against the reference sheet.
export type Viseme =
  | "rest" | "MBP"
  | "A_s" | "A_m" | "A_l" | "E" | "I" | "O" | "U"
  | "FV" | "L" | "TH";

export const VISEMES: Viseme[] = ["rest", "MBP", "A_s", "A_m", "A_l", "E", "I", "O", "U", "FV", "L", "TH"];

const open = (w: number, bot: number, kb = 0.6, top = 0, tilt = 0): Lens => ({
  w, y: 513, top, bot, kt: 0.55, kb, tilt, sw: 6,
});
const band = (w: number, sag: number, thick: number, sw = 11): Lens => ({
  w, y: 515, top: -sag, bot: sag + thick, kt: 0.55, kb: 0.55, tilt: 0, sw,
});

export const MOUTHS: Record<Viseme, Lens> = {
  rest: { w: 66, y: 514, top: 1, bot: 33, kt: 0.55, kb: 0.62, tilt: -4, sw: 6 },
  MBP: band(54, 6, 3),
  A_s: open(52, 17),
  A_m: open(64, 31, 0.62),
  A_l: open(71, 53, 0.72),
  E: open(83, 22, 0.55),
  I: open(39, 17, 0.6),
  O: { w: 41, y: 538, top: 23, bot: 23, kt: 0.5523, kb: 0.5523, tilt: 0, sw: 6 },
  U: { w: 24, y: 514, top: 0, bot: 31, kt: 0.55, kb: 0.78, tilt: 0, sw: 6 },
  FV: band(54, 3, 3),
  L: open(61, 31, 0.62),
  TH: open(64, 20, 0.55),
};

/** Openness of each viseme (0..1), used to scale with audio amplitude. */
export const OPENNESS: Record<Viseme, number> = {
  rest: 0, MBP: 0, FV: 0.1, TH: 0.35, L: 0.55, I: 0.35, E: 0.45, U: 0.5, A_s: 0.35, A_m: 0.65, A_l: 1, O: 0.8,
};

export const VOWELS = new Set<Viseme>(["A_s", "A_m", "A_l", "E", "I", "O", "U"]);

/** Letter → viseme (PRD §7). Works on a lower-cased word, returns one viseme per letter or digraph. */
export function wordToVisemes(word: string): { v: Viseme; chars: number }[] {
  const w = word.toLowerCase();
  const out: { v: Viseme; chars: number }[] = [];
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    const next = w[i + 1];
    if (!/[a-z0-9']/.test(c)) continue;
    if (c === "'") continue;
    if (c === "t" && next === "h") { out.push({ v: "TH", chars: 2 }); i++; continue; }
    if (c === "o" && next === "o") { out.push({ v: "U", chars: 2 }); i++; continue; }
    if (c === "e" && next === "e") { out.push({ v: "E", chars: 2 }); i++; continue; }
    if ("mbp".includes(c)) out.push({ v: "MBP", chars: 1 });
    else if ("fv".includes(c)) out.push({ v: "FV", chars: 1 });
    else if (c === "o") out.push({ v: "O", chars: 1 });
    else if (c === "w" || c === "u" || c === "q") out.push({ v: "U", chars: 1 });
    else if (c === "e" || c === "y") out.push({ v: "E", chars: 1 });
    else if (c === "i") out.push({ v: "I", chars: 1 });
    else if (c === "l") out.push({ v: "L", chars: 1 });
    else if (c === "a") out.push({ v: next && "aeiou".includes(next) ? "A_m" : "A_l", chars: 1 });
    else if (/[0-9]/.test(c)) out.push({ v: "A_m", chars: 1 });
    else out.push({ v: "A_s", chars: 1 });
  }
  return out;
}

export function letterToViseme(c: string): Viseme | null {
  const r = wordToVisemes(c);
  return r.length ? r[0].v : null;
}
