// Parametric "lens" shape used for every mouth and eye pose.
// Every pose is the same 4-cubic closed path that starts at the top-centre anchor,
// so any two poses interpolate point-for-point with no twisting (PRD §6).

export interface Lens {
  w: number;    // corner-to-corner width (skeleton, before stroke)
  y: number;    // corner height
  top: number;  // top-centre height above the corners (negative = sags below)
  bot: number;  // bottom-centre depth below the corners (negative = rises above)
  kt: number;   // top edge roundness (0.55 = elliptical, 0.9 = squarish)
  kb: number;   // bottom edge roundness
  tilt: number; // right corner minus left corner, in px
  sw: number;   // stroke width in the fill colour: rounds corners, gives bands their weight
}

export const LENS_KEYS = ["w", "y", "top", "bot", "kt", "kb", "tilt", "sw"] as const;

const f = (n: number) => Math.round(n * 10) / 10;

export function lensPath(cx: number, p: Lens): string {
  const a = p.w / 2;
  const yr = p.y + p.tilt / 2;
  const yl = p.y - p.tilt / 2;
  const yt = p.y - p.top;
  const yb = p.y + p.bot;
  const xr = cx + a;
  const xl = cx - a;
  return (
    `M${f(cx)} ${f(yt)}` +
    `C${f(cx + p.kt * a)} ${f(yt)} ${f(xr)} ${f(yr - p.kt * (yr - yt))} ${f(xr)} ${f(yr)}` +
    `C${f(xr)} ${f(yr + p.kb * (yb - yr))} ${f(cx + p.kb * a)} ${f(yb)} ${f(cx)} ${f(yb)}` +
    `C${f(cx - p.kb * a)} ${f(yb)} ${f(xl)} ${f(yl + p.kb * (yb - yl))} ${f(xl)} ${f(yl)}` +
    `C${f(xl)} ${f(yl - p.kt * (yl - yt))} ${f(cx - p.kt * a)} ${f(yt)} ${f(cx)} ${f(yt)}Z`
  );
}

export function mixLens(a: Lens, b: Lens, t: number): Lens {
  const out = { ...a };
  for (const k of LENS_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

// Anchors from the reference pack (800×800 space).
export const MOUTH_CX = 412.5;
export const MOUTH_Y = 510;
export const EYE_L = { x: 325, y: 393.5 };
export const EYE_R = { x: 486, y: 395 };
export const HEAD_PIVOT = { x: 400, y: 560 };
export const CHIN = { x: 410, y: 625 };
