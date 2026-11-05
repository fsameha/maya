"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";

/** Raw data viewer with copy-to-clipboard (icon morphs into a check for 1.2s, PRD §4). */
export function JsonViewer({ value, compact = false, maxHeight = 320 }: { value: unknown; compact?: boolean; maxHeight?: number }) {
  const text = JSON.stringify(value, null, 2) ?? "null";
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div className="relative rounded-[12px]" style={{ background: "var(--surface)" }}>
      <button type="button" onClick={copy} aria-label={copied ? "Copied" : "Copy JSON"} className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ color: "var(--steel)" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={copied ? "c" : "n"} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.18 }}>
            {copied ? <Check size={15} strokeWidth={2} style={{ color: "var(--success)" }} /> : <Copy size={15} strokeWidth={1.75} />}
          </motion.span>
        </AnimatePresence>
      </button>
      <pre className="t-mono overflow-auto p-3 pr-10 !text-[12px]" style={{ maxHeight, color: "var(--ink-body)" }} tabIndex={0}>
        {compact ? JSON.stringify(value) : text}
      </pre>
    </div>
  );
}
