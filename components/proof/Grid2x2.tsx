"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Pause, Play } from "lucide-react";

export const MODELS = [
  { id: "yolo11", name: "YOLO11", type: "closed-set" },
  { id: "rtdetr", name: "RT-DETR", type: "closed-set" },
  { id: "gdino", name: "Grounding DINO", type: "open-vocabulary" },
  { id: "sam31", name: "SAM 3.1", type: "Meta" },
] as const;

const CLIP_S = 9.1; // glasses-table, 137 frames at 15 fps

/** Synced 2×2 player: shared play/pause/scrub, per-model toggle, click a tile to expand (PRD §13). */
export function Grid2x2({ available }: { available: Record<string, boolean> }) {
  const [on, setOn] = useState<Record<string, boolean>>({ yolo11: true, rtdetr: true, gdino: true, sam31: true });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const vids = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      setT((x) => (x + (now - last) / 1000) % CLIP_S);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  useEffect(() => {
    Object.values(vids.current).forEach((v) => {
      if (!v) return;
      if (Math.abs(v.currentTime - t) > 0.15) v.currentTime = t;
      if (playing && v.paused) void v.play().catch(() => {});
      if (!playing && !v.paused) v.pause();
    });
  }, [t, playing]);

  const present = MODELS.filter((m) => available[m.id]); // a model without an overlay video gets no tile
  const shown = present.filter((m) => on[m.id] && (!expanded || expanded === m.id));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Models shown">
          {present.map((m) => (
            <button key={m.id} type="button" aria-pressed={on[m.id]} onClick={() => setOn((o) => ({ ...o, [m.id]: !o[m.id] }))} className={`chip h-9 ${on[m.id] ? "chip-blue" : ""}`}>{m.name}</button>
          ))}
        </div>
        <span className="chip !h-7 !text-[12px]">Offline benchmark · real outputs</span>
      </div>
      <div className={`mt-4 grid gap-3 ${expanded ? "" : "md:grid-cols-2"}`}>
        {shown.map((m) => (
          <button
            key={m.id} type="button" onClick={() => setExpanded((e) => (e === m.id ? null : m.id))}
            className="group relative overflow-hidden rounded-[16px] text-left" style={{ aspectRatio: "16 / 9", background: "var(--surface)" }}
            aria-label={`${m.name}: ${expanded === m.id ? "shrink" : "expand to full width"}`}
          >
            <video ref={(v) => void (vids.current[m.id] = v)} src={`/fixtures/benchmark/grid/${m.id}.mp4`} poster={`/posters/grid-${m.id}.jpg`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
            <span className="visually-hidden">{m.name} · {m.type}</span>
            <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "var(--glass)", color: "var(--ink)" }} aria-hidden>
              {expanded === m.id ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="ctl ctl-main" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause all" : "Play all"}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <input type="range" min={0} max={CLIP_S} step={0.04} value={t} onChange={(e) => setT(+e.target.value)} className="flex-1" aria-label="Scrub all videos" />
        <span className="t-caption tnum w-12 text-right">{t.toFixed(1)}s</span>
      </div>
    </div>
  );
}
