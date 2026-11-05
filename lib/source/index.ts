import type { MayaSource } from "../contract";
import { createFixtureSource } from "./fixture";
import { createLiveSource } from "./live";

export type SourceKind = "fixture" | "live";

/** The one data-source flag (PRD §1, §15). Defaults to fixtures with zero env vars. */
export const SOURCE: SourceKind = process.env.NEXT_PUBLIC_MAYA_SOURCE === "live" ? "live" : "fixture";

let fixture: MayaSource | null = null;
let live: MayaSource | null = null;

export function getSource(kind: SourceKind = SOURCE): MayaSource {
  if (kind === "live") return (live ??= createLiveSource());
  return (fixture ??= createFixtureSource());
}
