// Memory engine (System tab §D): zones, sightings and the item state machine. Pure code, no model calls.
import type { Box, ItemState, Sighting, Zone } from "../contract.ts";
import { homeClock } from "../homeTime";

export function pointInPolygon([x, y]: [number, number], poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A sighting belongs to the zone that contains the bottom-centre of its box (where the object rests).
export function zoneOf(box: Box, zones: Zone[]): Zone | undefined {
  const p: [number, number] = [(box[0] + box[2]) / 2, box[3]];
  return zones.find((z) => pointInPolygon(p, z.polygon));
}

export function overlaps(a: Box, b: Box): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

// ON_PERSON when the object overlaps the person's box (top 25% = head, else hand/body).
export function personRegion(obj: Box, person?: Box): Sighting["personRegion"] | undefined {
  if (!person || !overlaps(obj, person)) return undefined;
  const top = person[1] + (person[3] - person[1]) * 0.25;
  return obj[3] <= top ? "head" : "hand";
}

export interface Track { itemId: string; state: ItemState; sightingId: string; history: string[] }

// SEEN → ON_PERSON → PICKED_UP → LAST_SEEN → MOVED. A newer sighting supersedes the older one; history is kept.
export function nextState(prev: Track | undefined, s: Sighting, stillVisibleAtClipEnd: boolean): Track {
  let state: ItemState;
  if (s.overlapsPerson) state = "ON_PERSON";
  else if (prev?.state === "ON_PERSON") state = stillVisibleAtClipEnd ? "MOVED" : "PICKED_UP";
  else state = stillVisibleAtClipEnd ? "LAST_SEEN" : "SEEN";
  return { itemId: s.itemId, state, sightingId: s.id, history: prev ? [...prev.history, prev.sightingId] : [] };
}

// Relative phrasing comes from code: "to your right" when the zone centre is right of where Mum last stood.
export function relative(zone: Zone, personX: number): string {
  const cx = zone.polygon.reduce((s, p) => s + p[0], 0) / zone.polygon.length;
  return cx > personX ? "to your right" : "to your left";
}

export function clock(iso: string): string {
  return homeClock(iso);
}
