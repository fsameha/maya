import { describe, expect, it } from "vitest";
import { contours } from "@/lib/maskContour";

describe("mask contour", () => {
  it("traces one closed outline around a disc", () => {
    const on = (x: number, y: number) => (x - 20) ** 2 + (y - 20) ** 2 < 100;
    const d = contours(on, 40, 40);
    expect(d.match(/M/g)?.length).toBe(1);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBeGreaterThan(8);
    expect(Math.max(...xs)).toBeLessThan(32);
  });
  it("traces two blobs as two sub-paths", () => {
    const on = (x: number, y: number) => ((x - 10) ** 2 + (y - 10) ** 2 < 25) || ((x - 30) ** 2 + (y - 10) ** 2 < 25);
    expect(contours(on, 40, 20).match(/M/g)?.length).toBe(2);
  });
});
