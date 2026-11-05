// Shared contract with the backend agent. Copied verbatim from PRD §14.
// Do not change silently: comment on §14 in the PRD and tell the owner first.

export type Ms = number;            // ms since run start
export type Box = [x1: number, y1: number, x2: number, y2: number]; // px in source frame
export interface Frame { w: number; h: number }

export interface Item { id: string; name: string; concept: string; enrolCropUrl: string }
export interface Zone { id: string; name: string; polygon: [number, number][] }
export interface Sighting {
  id: string; itemId: string; clipId: string; frame: number; t: string; // ISO time
  zoneId: string; box: Box; maskUrl: string /* PNG alpha or RLE json */; conf: number;
  overlapsPerson: boolean; personRegion?: "head" | "hand" | "body";
}
export type ItemState = "SEEN" | "ON_PERSON" | "PICKED_UP" | "LAST_SEEN" | "MOVED";

export type MayaEvent =
  | { at: Ms; type: "capture.clip"; clipId: string; videoUrl: string; fps: number; frames: number; motion: number[] }
  | { at: Ms; type: "perception.stream"; clipId: string; concept: string; lines: string[] }   // raw SAM lines
  | { at: Ms; type: "perception.done"; clipId: string; sightings: Sighting[]; ms: number; usd: number }
  | { at: Ms; type: "memory.state"; itemId: string; state: ItemState; sightingId: string; superseded?: string[] }
  | { at: Ms; type: "asr.partial" | "asr.final"; speaker: "samiha" | "yuki" | "visitor"; text: string; audioUrl?: string }
  | { at: Ms; type: "policy.check"; text: string; lexiconHits: string[]; classifier: { health_related: boolean }; route: "agent" | "ask_caregiver" }
  | { at: Ms; type: "agent.tool"; name: "find_object" | "get_day" | "propose_note" | "ask_caregiver" | "play_messages" | "check_in_reply"; args: unknown; result: unknown }
  | { at: Ms; type: "agent.reply"; text: string; facts: Record<string, string>; audioUrl: string; alignment: { word: string; start: Ms; end: Ms }[]; expression: Expression }
  | { at: Ms; type: "note.created" | "note.confirmed" | "note.rejected"; noteId: string; text: string; by: "maya" | "yuki" }
  | { at: Ms; type: "caregiver.push"; title: string; body: string; actions: string[] }
  | { at: Ms; type: "caregiver.tap"; action: string }
  | { at: Ms; type: "message.voice"; from: "yuki" | "samiha"; audioUrl: string; transcript: string }
  | { at: Ms; type: "escalation.step"; step: "usual_missed" | "check_in" | "alert" | "second_contact"; simulated: boolean }
  | { at: Ms; type: "privacy.blur"; clipId: string; personMaskUrl: string }
  | { at: Ms; type: "chapter"; n: 1|2|3|4|5|6; title: string }
  | { at: Ms; type: "spend"; usd: number; clipsLeft: number } | { at: Ms; type: "spend.capped" };

export type Expression = "neutral"|"listening"|"thinking"|"happy"|"relieved"|"concerned"|"surprised";

export interface Run { id: string; mode: "replay" | "live"; frame: Frame; items: Item[]; zones: Zone[]; events: MayaEvent[] }

export interface MayaSource {           // the only thing the UI imports
  loadRun(id: string): Promise<Run>;     // fixture: reads /fixtures/<id>/run.json
  subscribe(onEvent: (e: MayaEvent) => void): () => void; // live: SSE/WebSocket later
  teach?(frame: Blob, point: [number, number], name: string): Promise<Item>;
  ask?(audioOrText: Blob | string): Promise<void>;
}
