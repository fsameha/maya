// Pure rig math (PRD §6). Everything is time-based, never frame-based.

export const GAZE_RANGE = { x: 600, y: 400 };
export const GAZE_MAX = { x: 5, y: 3 };
export const DEAD_ZONE = 0.06;
export const GAZE_TAU = 90;
export const TARGET_TAU = 250 / 3; // reaches ~95% in 250ms
export const HEAD_TAU = 180;
export const HEAD_TILT_MAX = 2;
export const IDLE_RETURN_MS = 4000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pointer offset from the mascot centre → [-1, 1] with clamping and a dead zone. */
export function normalizeGaze(dx: number, dy: number): [number, number] {
  return [deadZone(clamp(dx / GAZE_RANGE.x, -1, 1)), deadZone(clamp(dy / GAZE_RANGE.y, -1, 1))];
}

export function deadZone(v: number): number {
  const a = Math.abs(v);
  if (a < DEAD_ZONE) return 0;
  return Math.sign(v) * ((a - DEAD_ZONE) / (1 - DEAD_ZONE));
}

/** Exponential smoothing factor for a time constant τ and a frame delta. */
export function smoothAlpha(dtMs: number, tau: number): number {
  return 1 - Math.exp(-dtMs / tau);
}

/** Blink: open 0 → half 40 → closed 65 → half 100 → open 150 (scaleY 1 → .45 → .08 → .45 → 1). */
const BLINK_KEYS: [number, number][] = [[0, 1], [40, 0.45], [65, 0.08], [100, 0.45], [150, 1]];
export const BLINK_MS = 150;
export function blinkScale(t: number): number {
  if (t <= 0 || t >= BLINK_MS) return 1;
  for (let i = 1; i < BLINK_KEYS.length; i++) {
    const [t1, v1] = BLINK_KEYS[i];
    const [t0, v0] = BLINK_KEYS[i - 1];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0);
      const s = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * s;
    }
  }
  return 1;
}

/** Next idle blink in 3–5.5s; 12% chance it is a double blink. */
export function nextBlink(rand: () => number = Math.random): { delay: number; double: boolean } {
  return { delay: 3000 + rand() * 2500, double: rand() < 0.12 };
}

export function nextSaccade(rand: () => number = Math.random): { delay: number; dx: number; dy: number } {
  return { delay: 2500 + rand() * 2500, dx: (rand() * 2 - 1) * 1.5, dy: (rand() * 2 - 1) * 1.5 };
}

/** Critically damped spring step (ω ≈ 28 rad/s), exact for any dt. */
export function springStep(x: number, v: number, target: number, dtMs: number, omega = 28): [number, number] {
  const dt = Math.min(dtMs, 64) / 1000;
  const e = Math.exp(-omega * dt);
  const d = x - target;
  const nx = target + (d + (v + omega * d) * dt) * e;
  const nv = (v - (v + omega * d) * omega * dt) * e;
  return [nx, nv];
}

/** Breathing: 1.000 → 1.010 over 4.2s, sine. */
export function breathScale(tMs: number): number {
  return 1 + 0.005 * (1 - Math.cos((2 * Math.PI * tMs) / 4200));
}
