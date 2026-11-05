// Pure theatre state: every pane is a fold over the run's events (PRD §10).
// No timers: each visual step is driven by a fixture event, so a seek rebuilds identical state.
import type { Expression, MayaEvent, Ms, Run, Sighting } from "@/lib/contract";

type E<T extends MayaEvent["type"]> = T extends "asr.partial" | "asr.final"
  ? Extract<MayaEvent, { type: "asr.partial" | "asr.final" }>
  : T extends "note.created" | "note.confirmed" | "note.rejected"
    ? Extract<MayaEvent, { type: "note.created" | "note.confirmed" | "note.rejected" }>
    : Extract<MayaEvent, { type: T }>;

export type Pane = "camera" | "maya" | "yuki";

export interface Turn {
  id: string;
  at: Ms;
  transcript?: E<"asr.final">;
  policy?: E<"policy.check">;
  tools: E<"agent.tool">[];
  reply?: E<"agent.reply">;
}

export type ChatItem =
  | { kind: "samiha"; id: string; text: string; final: boolean; flagged: boolean; at: Ms }
  | { kind: "maya"; id: string; reply: E<"agent.reply">; turnId: string; at: Ms }
  | { kind: "appointments"; id: string; items: { time: string; title: string }[]; at: Ms }
  | { kind: "note"; id: string; noteId: string; text: string; status: "unconfirmed" | "confirmed" | "rejected"; outcome?: string; at: Ms }
  | { kind: "voice"; id: string; from: "yuki" | "samiha"; transcript: string; audioUrl: string; at: Ms };

export interface PhoneItem { id: string; kind: "question" | "approval" | "alert" | "message"; title: string; body: string; at: Ms; done?: boolean }

export interface TheatreState {
  chapter: { n: number; title: string; at: Ms };
  lastPane: Pane;
  news: Record<Pane, number>; // event counts per pane, for the mobile tab dots
  camera: {
    clipId?: string;
    videoUrl?: string;
    fps: number;
    clipAt: Ms;
    searching: boolean;
    streamAt?: Ms;
    stream?: E<"perception.stream">;
    sightings: Sighting[];
    locked?: Sighting;
    zoneLit?: string;
    showTime: boolean;
    seekFrame?: number;
    memory: Record<string, { state: string; sightingId: string; at: Ms }>;
    sam?: { ms: number; usd: number; model?: string; sightings: number };
  };
  maya: {
    chat: ChatItem[];
    expression: Expression;
    state: "idle" | "listening" | "thinking" | "speaking" | "happy" | "concerned";
    dots: [boolean, boolean, boolean];
    thinking: boolean;
    speaking?: E<"agent.reply">;
    shield: boolean;
  };
  phone: {
    items: PhoneItem[];
    push?: E<"caregiver.push"> & { id: string };
    tap?: E<"caregiver.tap">;
    rhythmGap: boolean;
    countdown?: { from: Ms; to: Ms };
    callMum: "idle" | "ready" | "pulse";
    simulated: boolean;
    sentReply: boolean;
  };
  turns: Turn[];
}

export function initialState(): TheatreState {
  return {
    chapter: { n: 1, title: "", at: 0 },
    lastPane: "maya",
    news: { camera: 0, maya: 0, yuki: 0 },
    camera: { fps: 5, clipAt: 0, searching: false, sightings: [], showTime: false, memory: {} },
    maya: { chat: [], expression: "neutral", state: "idle", dots: [false, false, false], thinking: false, shield: false },
    phone: { items: [], rhythmGap: false, callMum: "idle", simulated: false, sentReply: false },
    turns: [],
  };
}

const PANE_OF: Partial<Record<MayaEvent["type"], Pane>> = {
  "capture.clip": "camera", "perception.stream": "camera", "perception.done": "camera", "memory.state": "camera",
  "asr.partial": "maya", "asr.final": "maya", "policy.check": "maya", "agent.reply": "maya", "note.created": "maya",
  "note.confirmed": "maya", "note.rejected": "maya",
  "caregiver.push": "yuki", "caregiver.tap": "yuki", "escalation.step": "yuki",
};

/** One event → next state. Immutable at the top level so React sees each change. */
export function step(prev: TheatreState, e: MayaEvent, run: Pick<Run, "events">): TheatreState {
  const s: TheatreState = {
    ...prev,
    camera: { ...prev.camera },
    maya: { ...prev.maya, chat: [...prev.maya.chat] },
    phone: { ...prev.phone, items: [...prev.phone.items] },
    news: { ...prev.news },
    turns: [...prev.turns],
  };
  let pane = PANE_OF[e.type];
  const turn = () => s.turns[s.turns.length - 1];
  const id = `${e.type}@${e.at}`;

  switch (e.type) {
    case "chapter":
      s.chapter = { n: e.n, title: e.title, at: e.at };
      s.phone.simulated = e.n === 5;
      s.phone.push = undefined;
      s.phone.tap = undefined;
      if (e.n !== 5) s.phone.callMum = "idle";
      s.maya.expression = "neutral";
      s.maya.state = "idle";
      s.maya.speaking = undefined;
      // each chapter starts a fresh conversation; an open note carries over so Yuki can confirm it
      s.maya.chat = s.maya.chat.filter((c) => c.kind === "note" && c.status === "unconfirmed");
      s.maya.thinking = false;
      s.maya.dots = [false, false, false];
      break;

    case "capture.clip":
      Object.assign(s.camera, { clipId: e.clipId, videoUrl: e.videoUrl, fps: e.fps, clipAt: e.at, searching: false, locked: undefined, zoneLit: undefined, showTime: false, seekFrame: undefined, stream: undefined });
      break;
    case "perception.stream":
      s.camera.searching = true;
      s.camera.stream = e;
      s.camera.streamAt = e.at;
      break;
    case "perception.done":
      s.camera.searching = false;
      s.camera.sam = { ms: e.ms, usd: e.usd, model: (e as { model?: string }).model, sightings: e.sightings.length };
      s.camera.sightings = [...s.camera.sightings.filter((x) => !e.sightings.some((n) => n.id === x.id)), ...e.sightings];
      // lock onto the item SAM was just asked about (the clip may also hold other enrolled items)
      s.camera.locked = lockFor(e, s.camera.stream, run) ?? e.sightings[0];
      if (s.maya.thinking) s.maya.dots = [true, s.maya.dots[1], s.maya.dots[2]];
      break;
    case "memory.state":
      s.camera.memory = { ...s.camera.memory, [e.itemId]: { state: e.state, sightingId: e.sightingId, at: e.at } };
      if (s.maya.thinking) s.maya.dots = [s.maya.dots[0], true, s.maya.dots[2]];
      break;

    case "asr.partial": {
      if (e.speaker !== "samiha") break;
      const last = s.maya.chat[s.maya.chat.length - 1];
      if (last?.kind === "samiha" && !last.final) s.maya.chat[s.maya.chat.length - 1] = { ...last, text: e.text };
      else s.maya.chat.push({ kind: "samiha", id, text: e.text, final: false, flagged: false, at: e.at });
      s.maya.state = "listening";
      s.maya.expression = "listening";
      break;
    }
    case "asr.final": {
      if (e.speaker === "samiha") {
        const last = s.maya.chat[s.maya.chat.length - 1];
        if (last?.kind === "samiha" && !last.final) s.maya.chat[s.maya.chat.length - 1] = { ...last, text: e.text, final: true };
        else s.maya.chat.push({ kind: "samiha", id, text: e.text, final: true, flagged: false, at: e.at });
        s.maya.state = "thinking";
        s.maya.expression = "thinking";
        s.maya.thinking = true;
        s.maya.dots = [false, false, false];
        s.maya.shield = false;
        s.turns.push({ id, at: e.at, transcript: e, tools: [] });
      }
      break;
    }
    case "policy.check": {
      const t = turn();
      if (t) s.turns[s.turns.length - 1] = { ...t, policy: e };
      if (e.route === "ask_caregiver") {
        s.maya.shield = true;
        for (let i = s.maya.chat.length - 1; i >= 0; i--) {
          const c = s.maya.chat[i];
          if (c.kind === "samiha") {
            s.maya.chat[i] = { ...c, flagged: true };
            break;
          }
        }
      }
      break;
    }
    case "agent.tool": {
      const t = turn();
      if (t) s.turns[s.turns.length - 1] = { ...t, tools: [...t.tools, e] };
      if (s.maya.thinking) s.maya.dots = [s.maya.dots[0], true, s.maya.dots[2]];
      const r = e.result as Record<string, unknown> | null;
      if (e.name === "find_object" && r && typeof r.sightingId === "string") {
        const sg = s.camera.sightings.find((x) => x.id === r.sightingId) ?? findSighting(run, r.sightingId);
        if (sg) {
          s.camera.locked = sg;
          s.camera.zoneLit = sg.zoneId;
          s.camera.showTime = true;
          s.camera.seekFrame = sg.frame;
        }
        pane = "camera";
      }
      if (e.name === "get_day" && r && Array.isArray(r.appointments)) {
        s.maya.chat.push({ kind: "appointments", id, items: r.appointments as { time: string; title: string }[], at: e.at });
      }
      if (e.name === "ask_caregiver") {
        const a = e.args as { question?: string };
        s.phone.items.unshift({ id, kind: "question", title: "Mum asks", body: a.question ?? "", at: e.at });
        pane = "yuki";
      }
      break;
    }
    case "agent.reply": {
      const t = turn();
      if (t && !t.reply) s.turns[s.turns.length - 1] = { ...t, reply: e };
      else s.turns.push({ id, at: e.at, tools: [], reply: e });
      s.maya.chat.push({ kind: "maya", id, reply: e, turnId: s.turns[s.turns.length - 1].id, at: e.at });
      s.maya.dots = [true, true, true];
      s.maya.thinking = false;
      s.maya.speaking = e;
      s.maya.expression = e.expression;
      s.maya.state = "speaking";
      break;
    }
    case "note.created":
      s.maya.chat.push({ kind: "note", id: e.noteId, noteId: e.noteId, text: e.text, status: "unconfirmed", at: e.at });
      break;
    case "note.confirmed":
    case "note.rejected": {
      const i = s.maya.chat.findIndex((c) => c.kind === "note" && c.noteId === e.noteId);
      if (i >= 0) {
        const c = s.maya.chat[i] as Extract<ChatItem, { kind: "note" }>;
        s.maya.chat[i] = { ...c, status: e.type === "note.confirmed" ? "confirmed" : "rejected", outcome: e.text };
      }
      if (e.type === "note.confirmed") {
        s.maya.expression = "relieved";
        s.maya.state = "idle";
        s.phone.items = s.phone.items.map((it) => (it.kind === "approval" ? { ...it, done: true } : it));
      }
      break;
    }

    case "caregiver.push":
      s.phone.push = { ...e, id };
      s.phone.items.unshift({ id, kind: e.actions.includes("Confirm") ? "approval" : "alert", title: e.title, body: e.body, at: e.at });
      if (e.actions.includes("Call Mum")) s.phone.callMum = "ready";
      break;
    case "caregiver.tap":
      s.phone.tap = e;
      s.phone.push = undefined;
      break;
    case "message.voice":
      if (e.from === "yuki") {
        s.maya.chat.push({ kind: "voice", id, from: "yuki", transcript: e.transcript, audioUrl: e.audioUrl, at: e.at });
        s.phone.sentReply = true;
        s.maya.speaking = undefined;
        pane = "maya";
      } else {
        s.phone.items.unshift({ id, kind: "message", title: "Message from Mum", body: e.transcript, at: e.at });
        pane = "yuki";
      }
      break;
    case "escalation.step":
      if (e.step === "usual_missed") s.phone.rhythmGap = true;
      if (e.step === "check_in") {
        const next = run.events.find((x) => x.type === "escalation.step" && x.step === "alert" && x.at > e.at);
        if (next) s.phone.countdown = { from: e.at, to: next.at };
      }
      if (e.step === "alert") s.phone.countdown = undefined;
      if (e.step === "second_contact") s.phone.callMum = "pulse";
      break;
  }

  if (pane) {
    s.lastPane = pane;
    s.news[pane] = prev.news[pane] + 1;
  }
  return s;
}

function lockFor(e: E<"perception.done">, stream: E<"perception.stream"> | undefined, run: Pick<Run, "events"> & Partial<Pick<Run, "items">>): Sighting | undefined {
  const item = stream?.clipId === e.clipId ? run.items?.find((i) => i.concept === stream.concept) : undefined;
  return item ? e.sightings.find((x) => x.itemId === item.id) : undefined;
}

/** SAM's object id for a sighting, read from the raw stream lines ("<136f>0<|box…" → 0). */
export function samObjectId(run: Pick<Run, "events" | "items">, s: Sighting): number | undefined {
  const concept = run.items.find((i) => i.id === s.itemId)?.concept;
  for (const e of run.events)
    if (e.type === "perception.stream" && e.clipId === s.clipId && e.concept === concept)
      for (const l of e.lines) {
        const m = /^<\d+f>(\d+)</.exec(l);
        if (m) return Number(m[1]);
      }
  return undefined;
}

function findSighting(run: Pick<Run, "events">, id: string): Sighting | undefined {
  for (const e of run.events) if (e.type === "perception.done") for (const s of e.sightings) if (s.id === id) return s;
  return undefined;
}

/** Spoken clips on the timeline (Maya replies, Samiha's turns, voice messages), for the audio scheduler and captions. */
export interface Clip { id: string; start: Ms; url: string; speaker: "maya" | "samiha" | "yuki"; text: string; words?: { word: string; start: Ms; end: Ms }[] }

export function spokenClips(run: Run): Clip[] {
  const clips: Clip[] = [];
  let turnStart: Ms | null = null;
  for (const e of run.events) {
    if (e.type === "asr.partial" && e.speaker === "samiha" && turnStart === null) turnStart = e.at;
    if (e.type === "asr.final" && e.speaker === "samiha") {
      const start = turnStart ?? e.at;
      if (e.audioUrl) clips.push({ id: `asr@${e.at}`, start, url: e.audioUrl, speaker: "samiha", text: e.text });
      turnStart = null;
    }
    if (e.type === "agent.reply") clips.push({ id: `reply@${e.at}`, start: e.at, url: e.audioUrl, speaker: "maya", text: e.text, words: e.alignment });
    if (e.type === "message.voice" && e.from === "yuki") clips.push({ id: `voice@${e.at}`, start: e.at, url: e.audioUrl, speaker: "yuki", text: e.transcript });
  }
  return clips;
}

/** Every event type the theatre animates. A unit test asserts each fixture event maps to a visual step. */
export const ANIMATED_EVENT_TYPES: MayaEvent["type"][] = [
  "chapter", "capture.clip", "perception.stream", "perception.done", "memory.state", "asr.partial", "asr.final",
  "policy.check", "agent.tool", "agent.reply", "note.created", "note.confirmed", "note.rejected", "caregiver.push",
  "caregiver.tap", "message.voice", "escalation.step",
];
