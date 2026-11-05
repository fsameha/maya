import { describe, expect, it } from "vitest";
import { blinkScale, deadZone, nextBlink, normalizeGaze, smoothAlpha, springStep } from "@/components/maya/rig";
import { lensPath } from "@/components/maya/shapes";
import { MOUTHS, VISEMES, wordToVisemes } from "@/components/maya/visemes";
import { EXPRESSIONS } from "@/components/maya/expressions";

const count = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).length;

describe("gaze math", () => {
  it("clamps and normalises to [-1, 1]", () => {
    expect(normalizeGaze(1200, -900)).toEqual([1, -1]);
    expect(normalizeGaze(0, 0)).toEqual([0, 0]);
  });
  it("ignores movements inside the 0.06 dead zone", () => {
    expect(deadZone(0.05)).toBe(0);
    expect(deadZone(-0.059)).toBe(0);
    expect(deadZone(1)).toBe(1);
  });
  it("smoothing is time-based: two 8ms steps equal one 16ms step", () => {
    const one = smoothAlpha(16, 90);
    const a = smoothAlpha(8, 90);
    const two = 1 - (1 - a) * (1 - a);
    expect(two).toBeCloseTo(one, 10);
  });
  it("spring is frame-rate independent at 60 and 120 fps", () => {
    let [x60, v60] = [0, 0];
    let [x120, v120] = [0, 0];
    for (let i = 0; i < 30; i++) [x60, v60] = springStep(x60, v60, 1, 1000 / 60);
    for (let i = 0; i < 60; i++) [x120, v120] = springStep(x120, v120, 1, 1000 / 120);
    expect(x60).toBeCloseTo(x120, 6);
    expect(x60).toBeLessThanOrEqual(1); // critically damped: no overshoot
  });
});

describe("blink", () => {
  it("follows the keyframes", () => {
    expect(blinkScale(0)).toBe(1);
    expect(blinkScale(40)).toBeCloseTo(0.45);
    expect(blinkScale(65)).toBeCloseTo(0.08);
    expect(blinkScale(100)).toBeCloseTo(0.45);
    expect(blinkScale(150)).toBe(1);
  });
  it("idle interval is 3–5.5s", () => {
    for (let i = 0; i < 200; i++) {
      const { delay } = nextBlink();
      expect(delay).toBeGreaterThanOrEqual(3000);
      expect(delay).toBeLessThanOrEqual(5500);
    }
  });
});

describe("mouth shapes", () => {
  it("every viseme and expression mouth has the same point count", () => {
    const n = count(lensPath(412.5, MOUTHS.rest));
    for (const v of VISEMES) expect(count(lensPath(412.5, MOUTHS[v]))).toBe(n);
    for (const e of Object.values(EXPRESSIONS)) expect(count(lensPath(412.5, e.mouth))).toBe(n);
  });
  it("A_l stays inside the jaw", () => {
    expect(MOUTHS.A_l.y + MOUTHS.A_l.bot + MOUTHS.A_l.sw / 2).toBeLessThan(590);
  });
  it("maps letters to visemes", () => {
    expect(wordToVisemes("map").map((x) => x.v)).toEqual(["MBP", "A_l", "MBP"]);
    expect(wordToVisemes("the")[0].v).toBe("TH");
    expect(wordToVisemes("food").map((x) => x.v)).toEqual(["FV", "U", "A_s"]);
  });
});
