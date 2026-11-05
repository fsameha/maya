// Playback engine (PRD §14): one clock over a Run's events.
// Emits each event at its `at` time; seeking backward rebuilds state from t=0.
import type { MayaEvent, Ms, Run } from "./contract";

export type PlayerListener = (e: MayaEvent, info: { replay: boolean }) => void;

export interface Chapter { n: 1 | 2 | 3 | 4 | 5 | 6; title: string; at: Ms; end: Ms }

export class Player {
  readonly run: Run;
  readonly events: MayaEvent[];
  readonly duration: Ms;
  readonly chapters: Chapter[];
  private t: Ms = 0;
  private cursor = 0; // index of the next event to emit
  private playing = false;
  private rate = 1;
  private lastWall = 0;
  private raf = 0;
  private listeners = new Set<PlayerListener>();
  private resetListeners = new Set<() => void>();
  private tickListeners = new Set<(t: Ms) => void>();
  private stateListeners = new Set<() => void>();

  constructor(run: Run, private now: () => number = () => performance.now()) {
    this.run = run;
    this.events = [...run.events].sort((a, b) => a.at - b.at);
    const last = this.events[this.events.length - 1];
    this.duration = (last?.at ?? 0) + 3000;
    const marks = this.events.filter((e): e is Extract<MayaEvent, { type: "chapter" }> => e.type === "chapter");
    this.chapters = marks.map((c, i) => ({ n: c.n, title: c.title, at: c.at, end: marks[i + 1]?.at ?? this.duration }));
  }

  get time() { return this.t; }
  get isPlaying() { return this.playing; }
  get speed() { return this.rate; }

  chapterAt(t: Ms = this.t): Chapter | undefined {
    for (let i = this.chapters.length - 1; i >= 0; i--) if (this.chapters[i].at <= t) return this.chapters[i];
    return this.chapters[0];
  }

  /** Subscribe to events. Each pane renders its own slice from these. */
  on(fn: PlayerListener) { this.listeners.add(fn); return () => void this.listeners.delete(fn); }
  onReset(fn: () => void) { this.resetListeners.add(fn); return () => void this.resetListeners.delete(fn); }
  onTick(fn: (t: Ms) => void) { this.tickListeners.add(fn); return () => void this.tickListeners.delete(fn); }
  onState(fn: () => void) { this.stateListeners.add(fn); return () => void this.stateListeners.delete(fn); }

  play() {
    if (this.playing) return;
    if (this.t >= this.duration) this.seek(0);
    this.playing = true;
    this.lastWall = this.now();
    this.loop();
    this.emitState();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.emitState();
  }

  toggle() { if (this.playing) this.pause(); else this.play(); }

  setSpeed(r: number) {
    this.rate = r;
    this.emitState();
  }

  /** Seek to t. Backward seeks reset and replay every event up to t deterministically. */
  seek(t: Ms) {
    t = Math.max(0, Math.min(this.duration, t));
    if (t < this.t) {
      this.cursor = 0;
      this.resetListeners.forEach((f) => f());
    }
    this.t = t;
    this.flush(true);
    this.tickListeners.forEach((f) => f(this.t));
    this.emitState();
  }

  /** Advance by dt (used by the rAF loop and by tests). */
  advance(dt: Ms) {
    this.t = Math.min(this.duration, this.t + dt * this.rate);
    this.flush(false);
    this.tickListeners.forEach((f) => f(this.t));
    if (this.t >= this.duration) this.pause();
  }

  destroy() {
    this.pause();
    this.listeners.clear();
    this.resetListeners.clear();
    this.tickListeners.clear();
    this.stateListeners.clear();
  }

  private flush(replay: boolean) {
    while (this.cursor < this.events.length && this.events[this.cursor].at <= this.t) {
      const e = this.events[this.cursor++];
      this.listeners.forEach((f) => f(e, { replay }));
    }
  }

  private loop = () => {
    if (!this.playing) return;
    const w = this.now();
    const dt = Math.min(100, w - this.lastWall);
    this.lastWall = w;
    this.advance(dt);
    if (this.playing) this.raf = requestAnimationFrame(this.loop);
  };

  private emitState() { this.stateListeners.forEach((f) => f()); }
}

/** Fold events into a state value; used by panes so a seek rebuilds identical state. */
export function reduceEvents<S>(events: MayaEvent[], upTo: Ms, init: S, step: (s: S, e: MayaEvent) => S): S {
  let s = init;
  for (const e of events) {
    if (e.at > upTo) break;
    s = step(s, e);
  }
  return s;
}
