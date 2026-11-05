"use client";
// Turns a SAM mask (PNG alpha, possibly half resolution) into an SVG outline in frame pixels,
// so the outline can be stroked on with DrawSVG (PRD §4 "Mask draw-on").

const cache = new Map<string, Promise<string>>();

export function maskOutline(url: string, frame: { w: number; h: number }): Promise<string> {
  const key = `${url}|${frame.w}x${frame.h}`;
  if (!cache.has(key)) cache.set(key, load(url, frame));
  return cache.get(key)!;
}

async function load(url: string, frame: { w: number; h: number }): Promise<string> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  // work on a small grid: fast, and smooth enough for an outline
  const gw = Math.min(320, img.naturalWidth);
  const gh = Math.round((gw * img.naturalHeight) / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = gw;
  c.height = gh;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, gw, gh);
  const a = ctx.getImageData(0, 0, gw, gh).data;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < gh && a[(y * gw + x) * 4 + 3] > 127;
  const sx = frame.w / gw;
  const sy = frame.h / gh;
  return contours(on, gw, gh, sx, sy);
}

/** Moore-neighbour boundary tracing over a binary grid; one closed sub-path per blob. */
export function contours(on: (x: number, y: number) => boolean, w: number, h: number, sx = 1, sy = 1): string {
  const visited = new Uint8Array(w * h);
  const paths: string[] = [];
  // 8 neighbours clockwise starting west
  const NX = [-1, -1, 0, 1, 1, 1, 0, -1];
  const NY = [0, -1, -1, -1, 0, 1, 1, 1];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y) || on(x - 1, y) || visited[y * w + x]) continue;
      // start pixel: on, with its west neighbour off
      const pts: [number, number][] = [];
      let cx = x, cy = y, back = 0; // backtrack direction: west
      for (let guard = 0; guard < w * h * 4; guard++) {
        visited[cy * w + cx] = 1;
        pts.push([cx + 0.5, cy + 0.5]);
        let found = false;
        for (let k = 1; k <= 8; k++) {
          const d = (back + k) % 8;
          const nx = cx + NX[d], ny = cy + NY[d];
          if (on(nx, ny)) {
            back = (d + 5) % 8; // the cell we came from, relative to the new pixel
            cx = nx;
            cy = ny;
            found = true;
            break;
          }
        }
        if (!found || (cx === x && cy === y)) break;
      }
      // mark the blob interior rows so a blob is traced once (fill visited along the scan)
      markBlob(on, x, y, w, h, visited);
      if (pts.length < 4) continue;
      const step = Math.max(1, Math.floor(pts.length / 160));
      const simplified = pts.filter((_, i) => i % step === 0);
      paths.push("M" + simplified.map(([px, py]) => `${(px * sx).toFixed(1)} ${(py * sy).toFixed(1)}`).join("L") + "Z");
    }
  }
  return paths.join("");
}

function markBlob(on: (x: number, y: number) => boolean, x0: number, y0: number, w: number, h: number, visited: Uint8Array) {
  const stack = [x0 + y0 * w];
  const seen = new Uint8Array(w * h);
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    visited[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0 && on(x - 1, y)) stack.push(i - 1);
    if (x < w - 1 && on(x + 1, y)) stack.push(i + 1);
    if (y > 0 && on(x, y - 1)) stack.push(i - w);
    if (y < h - 1 && on(x, y + 1)) stack.push(i + w);
  }
}
