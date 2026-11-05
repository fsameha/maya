// Path helpers for the loader morphs: everything is mapped into screen pixels.

/** Map every absolute x,y pair in a path (M/C/L only) through f. */
export function mapPath(d: string, f: (x: number, y: number) => [number, number]): string {
  return d.replace(/([MCL])([^MCLZ]*)/g, (_, cmd: string, args: string) => {
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const out: string[] = [];
    for (let i = 0; i + 1 < n.length; i += 2) {
      const [x, y] = f(n[i], n[i + 1]);
      out.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return cmd + out.join(" ");
  });
}

/** A straight horizontal line drawn as `segments` cubics, so it matches the signature's point count. */
export function straightLine(x1: number, x2: number, y: number, segments: number): string {
  let d = `M${x1.toFixed(1)} ${y.toFixed(1)}`;
  const step = (x2 - x1) / segments;
  for (let i = 0; i < segments; i++) {
    const a = x1 + step * i;
    d += `C${(a + step / 3).toFixed(1)} ${y.toFixed(1)} ${(a + (2 * step) / 3).toFixed(1)} ${y.toFixed(1)} ${(a + step).toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
