"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play } from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { usePlayerCtx, usePlayerState, useEventState } from "@/lib/PlayerProvider";
import { AudioScheduler, audioContext } from "@/lib/audio";
import { useLenis, scrollToId } from "@/lib/lenis";
import { gazeProps, setGazeTarget } from "@/components/maya/gaze";
import { PlaceholderChip } from "@/components/ui/PlaceholderChip";
import type { Run } from "@/lib/contract";
import type { Player } from "@/lib/player";
import { CameraPane } from "./CameraPane";
import { MayaPane } from "./MayaPane";
import { PhonePane } from "./PhonePane";
import { Timeline } from "./Timeline";
import { WhyDrawer } from "./WhyDrawer";
import { initialState, spokenClips, step, type Pane } from "./model";

/** Watch chapter → How-it-works stage (PRD §11). */
export const CHAPTER_STAGE: Record<number, number> = { 1: 2, 2: 6, 3: 6, 4: 7, 5: 8, 6: 10 };

export function Theatre() {
  const { player, run, error, placeholder } = usePlayerCtx();
  if (error) return <div className="wrap section"><p className="t-lead">Maya couldn&apos;t reach her memory. Showing the recorded run instead.</p></div>;
  if (!player || !run) return <TheatreSkeleton />;
  return <TheatreInner player={player} run={run} placeholder={placeholder} />;
}

function TheatreSkeleton() {
  return (
    <div className="wrap py-6" aria-busy="true">
      <div className="h-14 rounded-full" style={{ background: "var(--surface)" }} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[4fr_3fr_3fr]" style={{ minHeight: 560 }}>
        {[0, 1, 2].map((i) => <div key={i} className="rounded-[32px]" style={{ background: "var(--surface)" }} />)}
      </div>
    </div>
  );
}

function TheatreInner({ player, run, placeholder }: { player: Player; run: Run; placeholder: boolean }) {
  usePlayerState(player);
  const state = useEventState(player, initialState, (s, e) => step(s, e, run));
  const [captions, setCaptions] = useState(true);
  const [started, setStarted] = useState(false);
  const [whyId, setWhyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Pane>("maya");
  const [seen, setSeen] = useState<Record<Pane, number>>({ camera: 0, maya: 0, yuki: 0 });
  const lenis = useLenis();
  const panes = useRef<Record<Pane, HTMLDivElement | null>>({ camera: null, maya: null, yuki: null });

  // audio follows the player clock
  const clips = useMemo(() => spokenClips(run), [run]);
  const scheduler = useMemo(() => new AudioScheduler(clips.map((c) => ({ id: c.id, start: c.start, url: c.url, analysed: c.speaker === "maya" }))), [clips]);
  useEffect(() => {
    const sync = () => scheduler.sync(player.time, player.isPlaying, player.speed);
    const a = player.onTick(sync);
    const b = player.onState(sync);
    return () => {
      a();
      b();
      scheduler.destroy();
    };
  }, [player, scheduler]);

  // deep link: /demo?ch=3
  useEffect(() => {
    const ch = Number(new URLSearchParams(location.search).get("ch"));
    const c = player.chapters.find((x) => x.n === ch);
    if (c) player.seek(c.at);
  }, [player]);

  // mobile: switch to wherever the action is; mark news on the other tabs
  useEffect(() => {
    setTab(state.lastPane);
  }, [state.lastPane, state.news]);
  useEffect(() => {
    setSeen((s) => ({ ...s, [tab]: state.news[tab] }));
  }, [tab, state.news]);

  // Maya looks at the pane that is "speaking"
  useEffect(() => {
    if (!player.isPlaying) return;
    const el = panes.current[state.lastPane];
    if (state.lastPane !== "maya" && el) setGazeTarget(el);
    else setGazeTarget(null);
  }, [state.lastPane, state.news, player.isPlaying]);
  useEffect(() => () => setGazeTarget(null), []);

  const start = useCallback(() => {
    audioContext();
    setStarted(true);
    player.play();
  }, [player]);

  // keyboard: space, ← →, c
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (e.key === " " || e.code === "Space") {
        if (el.closest("button, a")) return;
        e.preventDefault();
        if (!started) start();
        else player.toggle();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const ch = player.chapterAt();
        const i = player.chapters.findIndex((c) => c.n === ch?.n);
        const next = player.chapters[i + (e.key === "ArrowRight" ? 1 : -1)];
        if (next) player.seek(next.at);
      } else if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
        setCaptions((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, started, start]);

  const goHow = () => {
    const stage = CHAPTER_STAGE[state.chapter.n] ?? 1;
    history.replaceState(null, "", `#how-stage-${stage}`);
    scrollToId(lenis, `how-stage-${stage}`);
  };

  const turn = whyId ? state.turns.find((t) => t.id === whyId) ?? null : null;
  const caption = useCaption(player, clips);
  const lastReply = [...state.maya.chat].reverse().find((c) => c.kind === "maya");

  const paneProps = (p: Pane, label: string) => ({
    ref: (el: HTMLDivElement | null) => void (panes.current[p] = el),
    "aria-label": label,
    className: `theatre-pane card card-surface min-h-0 p-4 ${tab === p ? "is-tab" : ""} ${state.lastPane === p && player.isPlaying ? "is-speaking" : ""}`,
    ...gazeProps(),
  });

  return (
    <div className="theatre">
      <div className="glass sticky top-16 z-30 border-b" style={{ borderColor: "var(--hairline)" }}>
        <div className="wrap flex h-14 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="t-caption tnum hidden sm:inline">Chapter {state.chapter.n}</span>
            <h1 className="truncate text-[17px] font-semibold" style={{ color: "var(--ink)" }}>{state.chapter.title || "The story"}</h1>
            {state.chapter.n === 5 && <span className="chip chip-attention !h-6 !text-[12px]">Simulated</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="chip hidden !h-7 !text-[12px] md:inline-flex">Dramatised scenario · real system · real model outputs</span>
            {placeholder && <PlaceholderChip />}
            <Badge variant="blue" label="Replay" />
          </div>
        </div>
        <p className="wrap t-caption pb-2 md:hidden">Dramatised scenario · real system · real model outputs</p>
      </div>

      <div className="wrap pb-6 pt-4">
        <div className="theatre-tabs mb-3 flex gap-1 rounded-full p-1 lg:hidden" role="tablist" aria-label="Panes" style={{ background: "var(--surface)" }}>
          {(["camera", "maya", "yuki"] as Pane[]).map((p) => (
            <button
              key={p} type="button" role="tab" aria-selected={tab === p} onClick={() => setTab(p)}
              className="relative flex h-10 flex-1 items-center justify-center rounded-full text-[14px] font-semibold transition-colors"
              style={{ background: tab === p ? "var(--canvas)" : "transparent", color: tab === p ? "var(--ink)" : "var(--steel)" }}
            >
              {p === "camera" ? "Camera" : p === "maya" ? "Maya" : "Yuki"}
              {tab !== p && state.news[p] > seen[p] && <span className="news-dot absolute right-4 top-2.5 h-2 w-2 rounded-full" style={{ background: "var(--maya-blue)" }} aria-label="new" />}
            </button>
          ))}
        </div>

        <div className="theatre-grid relative grid gap-6 lg:grid-cols-[4fr_3fr_3fr]">
          <section {...paneProps("camera", "Home camera")}><CameraPane run={run} state={state.camera} player={player} /></section>
          <section {...paneProps("maya", "Maya")} style={{ minHeight: 560 }}>
            <MayaPane state={state.maya} player={player} onWhy={setWhyId} captions={captions} />
          </section>
          <section {...paneProps("yuki", "Yuki's phone")}><PhonePane state={state.phone} player={player} /></section>

          <AnimatePresence>
            {!started && (
              <motion.div className="absolute inset-0 z-20 flex items-center justify-center rounded-[32px]" style={{ background: "color-mix(in srgb, var(--canvas) 55%, transparent)", backdropFilter: "blur(2px)" }} exit={{ opacity: 0 }} transition={{ duration: 0.26 }}>
                <button type="button" onClick={start} className="pill pill-live !px-8 !py-4 text-[17px]" {...gazeProps()}>
                  <Play size={18} strokeWidth={2} aria-hidden /> Play the story
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="caption-bar mt-4 flex min-h-12 items-center justify-center text-center" aria-hidden>
          {captions && caption && (
            <p className="rounded-full px-4 py-2 text-[16px] font-medium" style={{ background: "var(--surface)", color: "var(--ink)" }}>
              <span className="t-caption mr-2 uppercase">{caption.speaker}</span>{caption.text}
            </p>
          )}
        </div>

        <div className="timeline-dock mt-2">
          <Timeline player={player} captions={captions} setCaptions={setCaptions} onHow={goHow} />
        </div>
      </div>

      <div className="visually-hidden" aria-live="polite">
        {`Chapter ${state.chapter.n}: ${state.chapter.title}.`} {lastReply?.kind === "maya" ? `Maya says: ${lastReply.reply.text}` : ""}
      </div>
      <WhyDrawer turn={turn} onClose={() => setWhyId(null)} />
    </div>
  );
}

function useCaption(player: Player, clips: ReturnType<typeof spokenClips>) {
  const [c, setC] = useState<{ speaker: string; text: string } | null>(null);
  useEffect(() => {
    const upd = (t: number) => {
      let cur: (typeof clips)[number] | undefined;
      for (const x of clips) if (x.start <= t && t < x.start + Math.max(2500, x.text.length * 75)) cur = x;
      setC((prev) => (cur ? (prev?.text === cur.text ? prev : { speaker: cur.speaker === "maya" ? "Maya" : cur.speaker === "yuki" ? "Yuki" : "Samiha", text: cur.text }) : prev === null ? prev : null));
    };
    upd(player.time);
    return player.onTick(upd);
  }, [player, clips]);
  return c;
}
