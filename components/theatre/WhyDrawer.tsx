"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { JsonViewer } from "@/components/how/JsonViewer";
import type { Turn } from "./model";

/** "Why did Maya say this?" (PRD §10): transcript → gate → tools → results → the sentence, split by origin. */
export function WhyDrawer({ turn, onClose }: { turn: Turn | null; onClose: () => void }) {
  const [raw, setRaw] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 767px)");
    setMobile(mq.matches);
  }, []);
  useEffect(() => {
    if (!turn) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, onClose]);

  return (
    <AnimatePresence>
      {turn && (
        <>
          <motion.div className="fixed inset-0 z-50" style={{ background: "rgb(10 19 23 / 0.32)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog" aria-modal="true" aria-label="Why did Maya say this?"
            className={`fixed z-50 flex flex-col overflow-hidden ${mobile ? "inset-x-0 bottom-0 max-h-[85svh] rounded-t-[24px]" : "bottom-0 right-0 top-0 w-[420px]"}`}
            style={{ background: "var(--canvas)", borderLeft: mobile ? undefined : "1px solid var(--hairline)" }}
            initial={mobile ? { y: "100%" } : { x: "100%" }} animate={mobile ? { y: 0 } : { x: 0 }} exit={mobile ? { y: "100%" } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <header className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
              <h2 className="t-h3 !text-[20px]">Why did Maya say this?</h2>
              <button ref={close} type="button" className="ctl" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={1.75} /></button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ol className="why-steps flex flex-col gap-5">
                {turn.transcript && (
                  <Step n={1} title="What Maya heard">
                    <p className="text-[16px]">“{turn.transcript.text}”</p>
                  </Step>
                )}
                {turn.policy && (
                  <Step n={2} title="Policy gate">
                    <div className="flex flex-wrap gap-1.5">
                      {turn.policy.lexiconHits.length ? turn.policy.lexiconHits.map((h) => <span key={h} className="chip chip-attention !h-6 !text-[12px]">{h}</span>) : <span className="t-caption">No health words.</span>}
                    </div>
                    <JsonViewer value={{ classifier: turn.policy.classifier, route: turn.policy.route }} compact />
                    <p className="t-caption mt-1">Route: <strong style={{ color: "var(--ink)" }}>{turn.policy.route === "ask_caregiver" ? "ask_caregiver (forced)" : "agent"}</strong></p>
                  </Step>
                )}
                {turn.tools.map((tool, i) => (
                  <Step key={i} n={3 + i} title={`Tool call · ${tool.name}`}>
                    <JsonViewer value={{ args: tool.args }} compact />
                    <p className="t-caption mt-2">Result</p>
                    <JsonViewer value={tool.result} compact />
                  </Step>
                ))}
                {turn.reply && (
                  <Step n={3 + turn.tools.length} title="The sentence">
                    <p className="text-[18px] font-medium leading-snug"><SplitSentence text={turn.reply.text} facts={turn.reply.facts} /></p>
                    <p className="t-caption mt-2 flex flex-wrap gap-3">
                      <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "var(--ink)" }} />Numbers from code</span>
                      <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "var(--maya-blue)" }} />Words from the model</span>
                    </p>
                  </Step>
                )}
              </ol>
              <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--hairline)" }}>
                <button type="button" className="pill pill-ghost pill-sm" onClick={() => setRaw((r) => !r)} aria-expanded={raw}>{raw ? "Hide raw" : "Raw"}</button>
                {raw && <div className="mt-3"><JsonViewer value={turn} /></div>}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="t-caption tnum inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--surface)" }}>{n}</span>
      <div className="min-w-0 flex-1">
        <p className="t-caption mb-1.5">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** Colour the sentence: values that came from code (facts) in ink, everything the model phrased in blue. */
export function SplitSentence({ text, facts }: { text: string; facts: Record<string, string> }) {
  const values = Object.values(facts).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!values.length) return <span style={{ color: "var(--maya-blue)" }}>{text}</span>;
  const re = new RegExp(`(${values.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        values.some((v) => v.toLowerCase() === part.toLowerCase())
          ? <span key={i} className="tnum" style={{ color: "var(--ink)", fontWeight: 700 }}>{part}</span>
          : <span key={i} style={{ color: "var(--maya-blue)" }}>{part}</span>,
      )}
    </>
  );
}
