import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Player } from "@/lib/player";
import type { MayaEvent, Run } from "@/lib/contract";

const run = JSON.parse(readFileSync("fixtures/run-001/run.placeholder.json", "utf8")) as Run;

describe("Player", () => {
  it("emits events in order at their time", () => {
    const p = new Player(run, () => 0);
    const seen: MayaEvent[] = [];
    p.on((e) => seen.push(e));
    p.advance(20000);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((e) => e.at <= 20000)).toBe(true);
    for (let i = 1; i < seen.length; i++) expect(seen[i].at).toBeGreaterThanOrEqual(seen[i - 1].at);
  });

  it("rebuilds the same state when seeking backward", () => {
    const p = new Player(run, () => 0);
    let log: string[] = [];
    p.onReset(() => (log = []));
    p.on((e) => log.push(e.type + e.at));
    p.seek(60000);
    const forward = [...log];
    p.seek(110000);
    p.seek(60000);
    expect(log).toEqual(forward);
  });

  it("has six chapters", () => {
    const p = new Player(run, () => 0);
    expect(p.chapters.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p.chapterAt(52000)?.n).toBe(3);
  });

  it("speed scales the clock", () => {
    const p = new Player(run, () => 0);
    p.setSpeed(1.5);
    p.advance(1000);
    expect(p.time).toBe(1500);
  });
});
