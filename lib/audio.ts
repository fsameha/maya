"use client";
// One shared AudioContext, started on the first user gesture (PRD §15), plus a scheduler that keeps
// pre-rendered clips in step with the player clock across play, pause, seek and speed changes.
import type { Ms } from "./contract";

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;

export function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512; // ~10ms windows at 48kHz
    analyser.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** The analyser Maya's voice runs through; its RMS scales the mouth opening. */
export function mayaAnalyser(): AnalyserNode | null {
  return analyser;
}

export interface ScheduledClip { id: string; start: Ms; url: string; analysed: boolean }

export class AudioScheduler {
  private els = new Map<string, HTMLAudioElement>();
  private durations = new Map<string, number>();
  private wired = new Set<string>();
  muted = false;

  constructor(private clips: ScheduledClip[]) {}

  private el(c: ScheduledClip) {
    let a = this.els.get(c.id);
    if (!a) {
      a = new Audio();
      a.preload = "auto";
      a.src = c.url;
      a.crossOrigin = "anonymous";
      a.addEventListener("loadedmetadata", () => this.durations.set(c.id, a!.duration * 1000));
      this.els.set(c.id, a);
    }
    if (c.analysed && !this.wired.has(c.id)) {
      const ac = audioContext();
      if (ac && analyser) {
        try {
          ac.createMediaElementSource(a).connect(analyser);
          this.wired.add(c.id);
        } catch {}
      }
    }
    return a;
  }

  /** Called on every player tick. */
  sync(t: Ms, playing: boolean, rate: number) {
    for (const c of this.clips) {
      const dur = this.durations.get(c.id) ?? 6000;
      const inside = t >= c.start && t < c.start + dur;
      const a = inside || this.els.has(c.id) ? this.el(c) : null;
      if (!a) continue;
      if (inside && playing && !this.muted) {
        const want = (t - c.start) / 1000;
        a.playbackRate = rate;
        if (Math.abs(a.currentTime - want) > 0.25) a.currentTime = want;
        if (a.paused) void a.play().catch(() => {});
      } else if (!a.paused) {
        a.pause();
      }
    }
  }

  stopAll() {
    this.els.forEach((a) => a.pause());
  }

  destroy() {
    this.stopAll();
    this.els.forEach((a) => (a.src = ""));
    this.els.clear();
  }
}
