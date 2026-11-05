import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { enforceHolds, sampleTrack, trackDriver, trackFromChars, trackFromWords, wordsFromChars, wordsFromText, type CharAlignment } from "@/lib/lipsync";
import { VOWELS } from "@/components/maya/visemes";

const align = JSON.parse(readFileSync("fixtures/run-001/alignment/ch1-maya-1.placeholder.json", "utf8")) as CharAlignment & { text: string };

describe("lip-sync", () => {
  it("groups ElevenLabs characters back into the line's words", () => {
    expect(wordsFromChars(align).map((w) => w.word).join(" ")).toBe(align.text);
  });
  it("closes on m/b/p at the character's real time", () => {
    const track = trackFromChars(align);
    // "me" in "Let me check": find the m
    const i = align.text.indexOf("me");
    const t = align.character_start_times_seconds[i] * 1000 + 5;
    expect(sampleTrack(track, t)).toBe("MBP");
  });
  it("respects hold times: consonants ≥55ms, vowels ≥90ms, nothing under 33ms", () => {
    const track = trackFromChars(align);
    for (const s of track) {
      const d = s.end - s.start;
      expect(d).toBeGreaterThanOrEqual(VOWELS.has(s.v) ? 90 : 55);
    }
    expect(enforceHolds([{ v: "A_s", start: 0, end: 10 }, { v: "MBP", start: 10, end: 20 }]).map((s) => s.v)).toContain("MBP");
  });
  it("goes silent after the line so the rig returns to rest (and blinks)", () => {
    const track = trackFromWords(wordsFromText("Sent."));
    let now = 0;
    const d = trackDriver(track, () => now);
    now = 50;
    expect(d.sample(now)).not.toBeNull();
    now = d.durationMs + 200;
    expect(d.sample(now)).toBeNull();
  });
  it("text-only timing runs at 14 characters per second", () => {
    const w = wordsFromText("abcdefghijklmn");
    expect(Math.round(w[0].end - w[0].start)).toBe(1000);
  });
});
