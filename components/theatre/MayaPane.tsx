"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Mic, Play, ShieldCheck } from "lucide-react";
import type { MayaEvent } from "@/lib/contract";
import type { Player } from "@/lib/player";
import { Maya } from "@/components/maya/Maya";
import { gazeProps } from "@/components/maya/gaze";
import { mayaAnalyser } from "@/lib/audio";
import { rmsAmplitude, trackDriver, trackFromChars, trackFromWords, type CharAlignment, type TimedDriver } from "@/lib/lipsync";
import { useReducedMotion } from "@/lib/reducedMotion";
import type { ChatItem, TheatreState } from "./model";

type Reply = Extract<MayaEvent, { type: "agent.reply" }>;

const ease = [0.22, 1, 0.36, 1] as const;

/** alignment/<id>.json next to audio/<id>.* (ElevenLabs character times), else the event's word times. */
function useSpeech(reply: Reply | undefined, player: Player): TimedDriver | null {
  const [chars, setChars] = useState<CharAlignment | null>(null);
  useEffect(() => {
    setChars(null);
    if (!reply) return;
    const url = reply.audioUrl.replace("/audio/", "/alignment/").replace(/\.(wav|mp3)$/, ".json");
    let alive = true;
    fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => alive && Array.isArray(j?.characters) && setChars(j)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [reply]);
  return useMemo(() => {
    if (!reply) return null;
    const track = chars ? trackFromChars(chars) : trackFromWords(reply.alignment);
    return trackDriver(track, () => player.time - reply.at, rmsAmplitude(mayaAnalyser()));
  }, [reply, chars, player]);
}

export function MayaPane({ state, player, onWhy, captions }: { state: TheatreState["maya"]; player: Player; onWhy: (turnId: string) => void; captions: boolean }) {
  const speech = useSpeech(state.speaking, player);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [state.chat.length]);

  const describe =
    state.state === "listening" ? "Maya is listening." : state.state === "thinking" ? "Maya is thinking." : state.state === "speaking" ? "Maya is speaking." : `Maya looks ${state.expression}.`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex shrink-0 flex-col items-center pt-2">
        <Maya size={200} expression={state.expression} state={state.state} speech={speech} listeningLevel={state.state === "listening" ? 0.55 : 0} label={describe} />
        <div className="h-8" aria-hidden>
          {state.thinking && (
            <div className="thinking-bubble mt-1 flex gap-1.5 rounded-full px-3 py-2" style={{ background: "var(--surface)" }}>
              {state.dots.map((on, i) => (
                <span key={i} className="h-2 w-2 rounded-full transition-colors duration-200" style={{ background: on ? "var(--maya-blue)" : "var(--hairline-strong)" }} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div ref={list} className="chat-scroll mt-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2" role="log" aria-label="Conversation">
        <AnimatePresence initial={false}>
          {state.chat.map((c) => (
            <motion.div
              key={c.id} layout="position"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.26, ease }}
            >
              <ChatRow c={c} player={player} onWhy={onWhy} captions={captions} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ChatRow({ c, player, onWhy, captions }: { c: ChatItem; player: Player; onWhy: (id: string) => void; captions: boolean }) {
  switch (c.kind) {
    case "samiha":
      return (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-[20px] rounded-br-[6px] px-4 py-3" style={{ background: "var(--surface)" }}>
            <p className="text-[17px]" style={{ color: "var(--ink-body)" }}>{c.text}{!c.final && <span className="caret" aria-hidden />}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="chip !h-6 !px-2 !text-[11px]"><Mic size={12} strokeWidth={1.75} aria-hidden /> Samiha · recorded</span>
              {c.flagged && (
                <span className="chip chip-attention !h-6 !px-2 !text-[11px]" title="Health-related: sent to Yuki"><ShieldCheck size={12} strokeWidth={1.75} aria-hidden /> health · ask Yuki</span>
              )}
            </div>
          </div>
        </div>
      );
    case "maya":
      return <MayaBubble reply={c.reply} player={player} onWhy={() => onWhy(c.turnId)} captions={captions} />;
    case "appointments":
      return (
        <div className="card flex gap-3 p-4" style={{ borderRadius: 16 }}>
          <span className="cal-pop inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--maya-blue-soft)", color: "var(--maya-blue)" }}>
            <CalendarDays size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <ul className="flex flex-col gap-1">
            {[...c.items].sort((a, b) => toMin(a.time) - toMin(b.time)).map((a) => (
              <li key={a.title} className="text-[15px]"><span className="tnum font-semibold" style={{ color: "var(--ink)" }}>{a.time}</span> · {a.title}</li>
            ))}
          </ul>
        </div>
      );
    case "note":
      return <NoteCard status={c.status} text={c.text} outcome={c.outcome} />;
    case "voice":
      return (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-[20px] rounded-bl-[6px] border px-4 py-3" style={{ borderColor: "var(--hairline)" }}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "var(--ink)", color: "var(--on-ink)" }}><Play size={14} strokeWidth={2} aria-hidden /></span>
              <Waveform />
              <span className="t-caption">Yuki · voice</span>
            </div>
            {captions && <p className="mt-2 text-[16px]">“{c.transcript}”</p>}
          </div>
        </div>
      );
  }
}

const toMin = (t: string) => {
  const m = t.match(/(\d+):?(\d+)?\s*(am|pm)/i);
  if (!m) return 0;
  return ((+m[1] % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0)) * 60 + (+(m[2] ?? 0));
};

/** Maya's bubble types in sync with the alignment (player clock), underlining the current word. */
function MayaBubble({ reply, player, onWhy, captions }: { reply: Reply; player: Player; onWhy: () => void; captions: boolean }) {
  const words = reply.alignment.length ? reply.alignment : reply.text.split(" ").map((w, i) => ({ word: w, start: i * 300, end: i * 300 + 280 }));
  const reduced = useReducedMotion();
  const [n, setN] = useState(() => countAt(words, player.time - reply.at));
  useEffect(() => player.onTick((t) => setN(countAt(words, t - reply.at))), [player, words, reply.at]);
  const display = splitDisplay(reply.text, words.length);
  const done = n >= words.length;
  return (
    <div className="flex justify-start">
      <div className="maya-bubble max-w-[92%] rounded-[22px] rounded-bl-[6px] border px-4 py-3" style={{ borderColor: "var(--hairline)", background: "var(--canvas)" }}>
        <p className="text-[19px] font-medium leading-[1.4] md:text-[22px]" style={{ color: "var(--ink)" }} aria-label={reply.text}>
          {display.map((w, i) => (
            <span key={i} aria-hidden className={i === n - 1 && !done && captions ? "word-now" : ""} style={{ opacity: i < n || reduced ? 1 : 0, transition: "opacity 120ms linear" }}>
              {w}{" "}
            </span>
          ))}
        </p>
        <button type="button" className="link mt-1 min-h-9 text-[13px] font-medium" onClick={onWhy} {...gazeProps()}>Why did Maya say this?</button>
      </div>
    </div>
  );
}

function countAt(words: { start: number }[], t: number) {
  let n = 0;
  for (const w of words) if (w.start <= t) n++;
  return n;
}
function splitDisplay(text: string, n: number) {
  const parts = text.split(/\s+/);
  if (parts.length === n) return parts;
  return parts;
}

function NoteCard({ status, text, outcome }: { status: "unconfirmed" | "confirmed" | "rejected"; text: string; outcome?: string }) {
  const reduced = useReducedMotion();
  const confirmed = status === "confirmed";
  const face = (side: "front" | "back") => (
    <div
      className={`note-face absolute inset-0 flex flex-col justify-center rounded-[16px] border px-4 ${side === "back" ? "note-back" : ""}`}
      style={{
        borderColor: side === "front" ? "color-mix(in srgb, var(--attention) 55%, transparent)" : "color-mix(in srgb, var(--success) 55%, transparent)",
        background: side === "front" ? "color-mix(in srgb, var(--attention) 10%, var(--canvas))" : "color-mix(in srgb, var(--success) 10%, var(--canvas))",
      }}
    >
      <span className={`chip ${side === "front" ? "chip-attention" : "chip-success"} w-fit !h-6 !text-[12px]`}>
        {side === "front" ? "Unconfirmed · waiting for Yuki" : (outcome ?? "Confirmed by Yuki")}
      </span>
      <span className="mt-1.5 text-[15px] font-medium" style={{ color: "var(--ink)" }}>{text}</span>
    </div>
  );
  if (reduced) {
    return (
      <div className="relative h-[84px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={status} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {face(confirmed ? "back" : "front")}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }
  return (
    <div className="relative h-[84px]" style={{ perspective: 1200 }} aria-live="polite">
      <div className="note-flip absolute inset-0" style={{ transform: confirmed ? "rotateY(180deg)" : "none" }}>
        {face("front")}
        {face("back")}
      </div>
      <span className="visually-hidden">{confirmed ? "Reminder set by Yuki." : "Unconfirmed, waiting for Yuki."}</span>
    </div>
  );
}

export function Waveform({ live = false }: { live?: boolean }) {
  const bars = [4, 9, 14, 7, 12, 16, 8, 5, 11, 15, 9, 6, 12, 7, 4];
  return (
    <svg width="76" height="18" viewBox="0 0 76 18" aria-hidden className={live ? "wave-live" : ""}>
      {bars.map((h, i) => <rect key={i} x={i * 5} y={(18 - h) / 2} width="2.5" height={h} rx="1.25" fill="var(--steel)" style={{ animationDelay: `${i * 60}ms` }} />)}
    </svg>
  );
}
