"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Switch } from "@astryxdesign/core/Switch";
import type { Player } from "@/lib/player";
import { usePlayerState } from "@/lib/PlayerProvider";
import { gazeProps } from "@/components/maya/gaze";

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Timeline({ player, captions, setCaptions, onHow }: { player: Player; captions: boolean; setCaptions: (v: boolean) => void; onHow: () => void }) {
  usePlayerState(player);
  const [t, setT] = useState(player.time);
  const [hover, setHover] = useState<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  useEffect(() => player.onTick(setT), [player]);

  const pct = (x: number) => `${(x / player.duration) * 100}%`;
  const timeAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * player.duration;
  };
  const chapter = player.chapterAt(t);
  const go = (dir: -1 | 1) => {
    const i = player.chapters.findIndex((c) => c.n === chapter?.n);
    const target = player.chapters[Math.max(0, Math.min(player.chapters.length - 1, i + dir))];
    if (dir === -1 && chapter && t - chapter.at > 2500) player.seek(chapter.at);
    else if (target) player.seek(target.at);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <button type="button" className="ctl" onClick={() => go(-1)} aria-label="Previous chapter" {...gazeProps()}><SkipBack size={18} strokeWidth={1.75} /></button>
        <button type="button" className="ctl ctl-main" onClick={() => player.toggle()} aria-label={player.isPlaying ? "Pause" : "Play"} {...gazeProps()}>
          {player.isPlaying ? <Pause size={20} strokeWidth={2} /> : <Play size={20} strokeWidth={2} />}
        </button>
        <button type="button" className="ctl" onClick={() => go(1)} aria-label="Next chapter" {...gazeProps()}><SkipForward size={18} strokeWidth={1.75} /></button>
        <div
          ref={bar}
          className="scrubber relative h-11 flex-1 cursor-pointer touch-none"
          role="slider" tabIndex={0} aria-label="Story timeline"
          aria-valuemin={0} aria-valuemax={Math.round(player.duration / 1000)} aria-valuenow={Math.round(t / 1000)}
          aria-valuetext={`${chapter?.title ?? ""}, ${fmt(t)} of ${fmt(player.duration)}`}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            player.seek(timeAt(e.clientX));
          }}
          onPointerMove={(e) => {
            setHover(timeAt(e.clientX));
            if (dragging.current) player.seek(timeAt(e.clientX));
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.stopPropagation(); player.seek(t + 5000); }
            if (e.key === "ArrowLeft") { e.stopPropagation(); player.seek(t - 5000); }
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ background: "var(--hairline)" }} />
          <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ width: pct(t), background: "var(--maya-blue)" }} />
          {player.chapters.map((c) => (
            <button
              key={c.n} type="button" tabIndex={-1} aria-hidden
              className={`chapter-dot absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${chapter?.n === c.n ? "is-active" : ""} ${t >= c.at ? "is-past" : ""}`}
              style={{ left: pct(c.at) }}
              onPointerDown={(e) => { e.stopPropagation(); player.seek(c.at); }}
            />
          ))}
          <div className="scrub-head absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: pct(t) }} aria-hidden />
          {hover !== null && (
            <div className="pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium tnum" style={{ left: pct(hover), background: "var(--ink)", color: "var(--on-ink)" }}>
              {player.chapterAt(hover)?.n}. {player.chapterAt(hover)?.title} · {fmt(hover)}
            </div>
          )}
        </div>
        <span className="t-caption tnum hidden w-[84px] text-right sm:inline">{fmt(t)} / {fmt(player.duration)}</span>
        <button
          type="button" className="ctl !w-auto px-3 text-[13px] font-semibold tnum" onClick={() => player.setSpeed(player.speed === 1 ? 1.5 : 1)}
          aria-label={`Speed ${player.speed}×, switch to ${player.speed === 1 ? 1.5 : 1}×`} {...gazeProps()}
        >
          {player.speed}×
        </button>
        <span className="hidden md:inline-flex"><Switch label="Captions" value={captions} onChange={setCaptions} size="sm" /></span>
      </div>
      <ol className="hidden justify-between gap-1 md:flex" aria-label="Chapters">
        {player.chapters.map((c) => (
          <li key={c.n}>
            <button
              type="button" onClick={() => player.seek(c.at)} {...gazeProps()}
              className="rounded-full px-2.5 py-1 text-[13px] font-medium transition-colors"
              style={{ color: chapter?.n === c.n ? "var(--ink)" : "var(--steel)", background: chapter?.n === c.n ? "var(--surface)" : "transparent" }}
              aria-current={chapter?.n === c.n ? "step" : undefined}
            >
              {c.n}. {c.title}{c.n === 5 ? " · Simulated" : ""}
            </button>
          </li>
        ))}
      </ol>
      <div className="flex justify-center pt-1">
        <button type="button" className="pill pill-ghost pill-sm how-bounce" onClick={onHow} {...gazeProps()}>
          See how it works <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}
