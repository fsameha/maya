"use client";
// The paired caregiver view for Be Yuki (PRD §12). Synced to the Try tab over BroadcastChannel.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ShieldQuestion } from "lucide-react";
import type { MayaEvent } from "@/lib/contract";
import { pairChannel, type PairMessage } from "./model";

type Push = Extract<MayaEvent, { type: "caregiver.push" }>;

export function YukiView() {
  const [code, setCode] = useState<string | null>(null);
  const [inbox, setInbox] = useState<(Push & { done?: boolean })[]>([]);
  const ch = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("code");
    setCode(c);
    if (!c || typeof BroadcastChannel === "undefined") return;
    const b = new BroadcastChannel(pairChannel(c));
    ch.current = b;
    b.postMessage({ kind: "hello" } satisfies PairMessage);
    b.onmessage = (m: MessageEvent<PairMessage>) => {
      if (m.data.kind === "event" && m.data.e.type === "caregiver.push") {
        const e = m.data.e;
        setInbox((x) => [e, ...x]);
        navigator.vibrate?.([30, 60, 30]);
      }
    };
    const hello = () => b.postMessage({ kind: "hello" } satisfies PairMessage);
    window.addEventListener("focus", hello);
    return () => {
      window.removeEventListener("focus", hello);
      b.close();
    };
  }, []);

  const confirm = (i: number) => {
    ch.current?.postMessage({ kind: "tap", action: "Confirm" } satisfies PairMessage);
    setInbox((x) => x.map((p, j) => (j === i ? { ...p, done: true } : p)));
  };

  return (
    <div className="mx-auto flex min-h-[calc(100svh-64px)] max-w-[420px] flex-col px-4 py-6">
      <p className="t-caption">You are Yuki · pair code <span className="tnum">{code ?? "—"}</span></p>
      <h1 className="t-h2 mt-1">Mum</h1>
      {!code && <p className="mt-4">Open this page from the QR code on the Try page.</p>}
      <section className="mt-6" aria-label="Inbox">
        <p className="t-caption mb-2">Inbox</p>
        {inbox.length === 0 && <p className="t-caption">All quiet. On the Try page, say “This is my medicine”.</p>}
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {inbox.map((p, i) => (
              <motion.li key={p.at + p.body} className="card p-4" style={{ borderRadius: 20 }} initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
                <p className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--steel)" }}>
                  {p.done ? <Check size={14} strokeWidth={2} aria-hidden /> : <ShieldQuestion size={14} strokeWidth={1.75} aria-hidden />} {p.done ? "Confirmed by you" : "Needs your OK"}
                </p>
                <p className="mt-1 text-[17px] font-medium" style={{ color: "var(--ink)" }}>{p.body}</p>
                {!p.done && (
                  <div className="mt-3 flex gap-2">
                    {p.actions.map((a, j) => (
                      <button key={a} type="button" className={`pill pill-sm ${j === 0 ? "pill-live" : "pill-ghost"}`} onClick={() => j === 0 && confirm(i)}>{a}</button>
                    ))}
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>
      <p className="t-caption mt-auto pt-10">Frontend phase: paired over BroadcastChannel between tabs of this browser. The real pairing uses a Cloudflare Durable Object.</p>
    </div>
  );
}
