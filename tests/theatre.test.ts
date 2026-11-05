import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { MayaEvent, Run } from "@/lib/contract";
import { ANIMATED_EVENT_TYPES, initialState, spokenClips, step, type TheatreState } from "@/components/theatre/model";
import { Player, reduceEvents } from "@/lib/player";

const run = JSON.parse(readFileSync("fixtures/run-001/run.placeholder.json", "utf8")) as Run;
// Shown outside Watch: privacy.blur → How it works stage 9, spend → Try inspector.
const SHOWN_ELSEWHERE = new Set<MayaEvent["type"]>(["privacy.blur", "spend", "spend.capped"]);

describe("every animated step maps to a fixture event", () => {
  it("each event in the run changes theatre state (or is shown on another page)", () => {
    let s: TheatreState = initialState();
    for (const e of run.events) {
      const next = step(s, e, run);
      if (!SHOWN_ELSEWHERE.has(e.type)) {
        expect(ANIMATED_EVENT_TYPES).toContain(e.type);
        expect(JSON.stringify(next), `${e.type}@${e.at} should change the UI`).not.toBe(JSON.stringify(s));
      }
      s = next;
    }
  });

  it("theatre, Try and How-it-works components use no timers that pretend work is happening", () => {
    const dirs = ["components/theatre", "components/how", "components/try"];
    const allowed = [
      /setTimeout\(\(\) => setCopied\(false\), 1200\)/, // copy-to-clipboard feedback
      /setInterval\(\(\) => setLeft\(24 \* 3600/, // wall-clock deletion countdown (a display, not pretend work)
    ];
    for (const d of dirs) {
      let files: string[] = [];
      try { files = readdirSync(d).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts")); } catch { continue; }
      for (const f of files) {
        const src = readFileSync(join(d, f), "utf8").replace(/\/\/.*$/gm, "");
        const hits = src.match(/set(Timeout|Interval)\([^;]*/g) ?? [];
        for (const h of hits) expect(allowed.some((r) => r.test(h)), `${d}/${f}: ${h}`).toBe(true);
      }
    }
  });
});

describe("seek rebuilds state", () => {
  it("state at t is the same whether reached forward or by seeking back", () => {
    const fold = (t: number) => reduceEvents(run.events, t, initialState(), (s, e) => step(s, e, run));
    const p = new Player(run, () => 0);
    let live = initialState();
    p.onReset(() => (live = initialState()));
    p.on((e) => (live = step(live, e, run)));
    p.seek(118000);
    p.seek(60000);
    expect(JSON.stringify(live)).toBe(JSON.stringify(fold(60000)));
  });
  it("all six chapters exist and Maya lines have audio", () => {
    expect(run.events.filter((e) => e.type === "chapter")).toHaveLength(6);
    expect(spokenClips(run).filter((c) => c.speaker === "maya").every((c) => c.url && c.words?.length)).toBe(true);
  });
});
