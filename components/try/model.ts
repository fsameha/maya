// Try inspector state: a fold over the try-001 events that have been replayed so far.
import type { ItemState, MayaEvent, Sighting } from "@/lib/contract";

export interface LogLine { at: number; kind: string; text: string }
export interface TryState {
  steps: { uploading?: number; sam?: number; memory?: number };
  sightings: Sighting[];
  itemState?: ItemState;
  log: LogLine[];
  usd: number;
  capped: boolean;
  reply?: Extract<MayaEvent, { type: "agent.reply" }>;
  transcript?: string;
  note?: { id: string; text: string; status: "unconfirmed" | "confirmed" };
  push?: Extract<MayaEvent, { type: "caregiver.push" }>;
  events: MayaEvent[];
}

export const initialTry = (): TryState => ({ steps: {}, sightings: [], log: [], usd: 0, capped: false, events: [] });

export function stepTry(prev: TryState, e: MayaEvent): TryState {
  const s: TryState = { ...prev, steps: { ...prev.steps }, log: [...prev.log], events: [...prev.events, e] };
  const clip = prev.events.find((x) => x.type === "capture.clip");
  const stream = prev.events.find((x) => x.type === "perception.stream");
  const done = prev.events.find((x) => x.type === "perception.done");
  switch (e.type) {
    case "perception.stream":
      if (clip) s.steps.uploading = e.at - clip.at;
      s.log.push({ at: e.at, kind: "SAM", text: `stream · “${e.concept}” · ${e.lines.length} lines` });
      break;
    case "perception.done":
      s.steps.sam = e.ms ?? (stream ? e.at - stream.at : 0);
      s.sightings = [...s.sightings, ...e.sightings];
      s.usd += e.usd;
      s.log.push({ at: e.at, kind: "SAM", text: `${e.sightings.length} sighting · ${e.ms} ms · $${e.usd.toFixed(3)}` });
      break;
    case "memory.state":
      if (done) s.steps.memory = e.at - done.at;
      s.itemState = e.state;
      s.log.push({ at: e.at, kind: "memory", text: `${e.itemId} → ${e.state}` });
      break;
    case "asr.final":
      s.transcript = e.text;
      s.log.push({ at: e.at, kind: "voice", text: `“${e.text}”` });
      break;
    case "policy.check":
      s.log.push({ at: e.at, kind: "gate", text: `${e.lexiconHits.length ? `hits: ${e.lexiconHits.join(", ")} · ` : ""}route ${e.route}` });
      break;
    case "agent.tool":
      s.log.push({ at: e.at, kind: "tool", text: `${e.name}(${JSON.stringify(e.args)})` });
      break;
    case "agent.reply":
      s.reply = e;
      s.log.push({ at: e.at, kind: "reply", text: e.text });
      break;
    case "note.created":
      s.note = { id: e.noteId, text: e.text, status: "unconfirmed" };
      break;
    case "note.confirmed":
      if (s.note) s.note = { ...s.note, status: "confirmed" };
      s.log.push({ at: e.at, kind: "approval", text: `confirmed by ${e.by}` });
      break;
    case "caregiver.push":
      s.push = e;
      s.log.push({ at: e.at, kind: "push", text: e.body });
      break;
    case "spend":
      s.usd = Math.max(s.usd, e.usd);
      break;
    case "spend.capped":
      s.capped = true;
      break;
  }
  return s;
}

/** Deterministic six-digit pair code for this tab session. */
export function pairCode(seed = Math.random()): string {
  return String(Math.floor(100000 + seed * 900000));
}

export const pairChannel = (code: string) => `maya-pair-${code}`;
export type PairMessage =
  | { kind: "hello" }
  | { kind: "event"; e: MayaEvent }
  | { kind: "tap"; action: string };
