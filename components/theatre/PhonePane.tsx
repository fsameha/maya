"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { AlertTriangle, Check, FastForward, MessageCircle, Phone, ShieldQuestion } from "lucide-react";
import type { Player } from "@/lib/player";
import { useReducedMotion } from "@/lib/reducedMotion";
import type { TheatreState } from "./model";

// Hour-by-hour activity (0..1) for the calm daily rhythm strip, 6:00–22:00.
const RHYTHM = [0.1, 0.5, 0.8, 0.6, 0.4, 0.7, 0.5, 0.3, 0.6, 0.8, 0.5, 0.4, 0.6, 0.7, 0.4, 0.2, 0.1];

export function PhonePane({ state, player }: { state: TheatreState["phone"]; player: Player }) {
  const buzz = useAnimationControls();
  const reduced = useReducedMotion();
  const pushId = state.push?.id;
  useEffect(() => {
    if (!pushId || reduced) return;
    void buzz.start({ rotate: [0, 1, -1, 1, -1, 0], transition: { duration: 0.42, ease: "easeInOut" } });
  }, [pushId, buzz, reduced]);

  return (
    <div className="flex h-full items-start justify-center">
      <motion.div animate={buzz} className="device relative w-full max-w-[300px]" style={{ aspectRatio: "9 / 19.5" }}>
        <div className="absolute inset-0 overflow-hidden rounded-[44px] border-[10px]" style={{ borderColor: "#0a1317", background: "var(--canvas)", boxShadow: "var(--shadow-device)" }}>
          <div className="absolute left-1/2 top-2 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden />
          <div className="relative z-10 flex items-center justify-between px-6 pt-3 text-[12px] font-semibold tnum" style={{ color: "var(--ink)" }}>
            <span>9:41</span>
            <span aria-hidden className="flex gap-1"><span className="h-2.5 w-4 rounded-sm border" style={{ borderColor: "var(--ink)" }} /></span>
          </div>

          <AnimatePresence>
            {state.push && (
              <motion.div
                key={state.push.id}
                className="absolute inset-x-2 top-9 z-30 rounded-[18px] p-3"
                style={{ background: "var(--glass)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "var(--shadow-bubble)", border: "1px solid var(--hairline)" }}
                initial={{ y: -90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -90, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                role="status"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--steel)" }}>{state.push.title}</p>
                <p className="mt-0.5 text-[13px] font-medium leading-snug" style={{ color: "var(--ink)" }}>{state.push.body}</p>
                <div className="mt-2 flex gap-2">
                  {state.push.actions.map((a, i) => (
                    <span key={a} className={`relative inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold ${i === 0 ? "" : "border"}`} style={i === 0 ? { background: "var(--maya-blue)", color: "#fff" } : { borderColor: "var(--hairline-strong)", color: "var(--ink)" }}>
                      {a}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {state.tap && <TapRipple key={state.tap.at} />}

          <div className="phone-scroll absolute inset-x-0 bottom-0 top-9 overflow-y-auto px-4 pb-4 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-[18px] font-semibold" style={{ color: "var(--ink)" }}>Mum</p>
              {state.simulated && <span className="chip chip-attention !h-6 !text-[11px]">Simulated</span>}
            </div>

            <section className="mt-3" aria-label="Today">
              <p className="t-caption !text-[11px]">Today</p>
              <div className="mt-1 flex h-10 items-end gap-[3px]">
                {RHYTHM.map((v, i) => {
                  const gap = state.rhythmGap && i >= 2 && i <= 4;
                  return <span key={i} className="flex-1 rounded-full transition-all duration-500" style={{ height: gap ? 3 : `${10 + v * 90}%`, background: gap ? "var(--attention)" : "var(--hairline-strong)" }} />;
                })}
              </div>
              <div className="flex justify-between t-caption !text-[10px] tnum"><span>6:00</span><span>14:00</span><span>22:00</span></div>
            </section>

            {state.countdown && <Countdown from={state.countdown.from} to={state.countdown.to} player={player} />}

            <section className="mt-4" aria-label="Inbox">
              <p className="t-caption !text-[11px]">Inbox</p>
              <ul className="mt-1 flex flex-col gap-2">
                {state.items.length === 0 && <li className="t-caption !text-[12px]">All quiet.</li>}
                <AnimatePresence initial={false}>
                  {state.items.map((it) => (
                    <motion.li
                      key={it.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      className="rounded-[14px] border p-2.5" style={{ borderColor: it.kind === "alert" ? "color-mix(in srgb, var(--critical) 45%, transparent)" : "var(--hairline)" }}
                    >
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: it.kind === "alert" ? "var(--critical)" : "var(--steel)" }}>
                        {it.kind === "question" && <ShieldQuestion size={12} strokeWidth={1.75} aria-hidden />}
                        {it.kind === "alert" && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden />}
                        {it.kind === "message" && <MessageCircle size={12} strokeWidth={1.75} aria-hidden />}
                        {it.kind === "approval" && (it.done ? <Check size={12} strokeWidth={2} aria-hidden /> : <ShieldQuestion size={12} strokeWidth={1.75} aria-hidden />)}
                        {it.kind === "approval" ? (it.done ? "Confirmed by you" : "Needs your OK") : it.title}
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--ink-body)" }}>{it.body}</p>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>

            {state.sentReply && <p className="t-caption mt-3 !text-[11px]">Voice reply sent to Mum.</p>}

            <button
              type="button" tabIndex={-1} aria-hidden
              className={`mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors duration-300 ${state.callMum === "pulse" ? "live-halo" : ""}`}
              style={state.callMum === "idle" ? { background: "var(--surface)", color: "var(--steel)" } : { background: "var(--maya-blue)", color: "#fff" }}
            >
              <Phone size={16} strokeWidth={1.75} /> Call Mum
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** The 10-minute wait, fast-forwarded visibly between the check-in and the alert events. */
function Countdown({ from, to, player }: { from: number; to: number; player: Player }) {
  const [left, setLeft] = useState(600);
  const raf = useRef(0);
  useEffect(() => {
    const upd = (t: number) => setLeft(Math.max(0, Math.round(600 * (1 - (t - from) / (to - from)))));
    upd(player.time);
    return player.onTick(upd);
  }, [from, to, player]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="mt-3 flex items-center justify-between rounded-[14px] p-2.5" style={{ background: "var(--surface)" }}>
      <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--ink)" }}><FastForward size={14} strokeWidth={1.75} aria-hidden /> Waiting for a reply · 10 min</span>
      <span className="t-mono tnum text-[13px] font-semibold">{mm}:{ss}</span>
    </div>
  );
}

function TapRipple() {
  return (
    <motion.span
      aria-hidden className="pointer-events-none absolute z-40 h-10 w-10 rounded-full"
      style={{ left: "18%", top: "118px", background: "var(--maya-blue)" }}
      initial={{ scale: 0.4, opacity: 0.45 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}
