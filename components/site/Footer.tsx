"use client";
import Link from "next/link";
import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { setColorMode, type ColorMode } from "@/lib/colorMode";
import { REPO_URL } from "./Nav";

const MODES: { mode: ColorMode; label: string; Icon: typeof Sun }[] = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "system", label: "System", Icon: Monitor },
  { mode: "dark", label: "Dark", Icon: Moon },
];

export function Footer() {
  const [mode, setMode] = useState<ColorMode>("system");
  useEffect(() => {
    try {
      const v = localStorage.getItem("maya-theme");
      if (v === "light" || v === "dark") setMode(v);
    } catch {}
  }, []);
  return (
    <footer className="border-t" style={{ borderColor: "var(--hairline)" }}>
      <div className="wrap flex flex-col gap-6 py-10">
        <p className="t-caption max-w-[760px]">
          Built Oct 26 – Nov 4, 2026 · Runtime: Meta models only (SAM 3.1 · Muse Spark · Muse Voice Transcribe) ·
          Demo voice pre-rendered with ElevenLabs · Not a medical device
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
            <li><a className="link" href={REPO_URL} target="_blank" rel="noreferrer">Repo</a></li>
            <li><Link className="link" href="/demo">Watch</Link></li>
            <li><Link className="link" href="/proof">Proof</Link></li>
            <li><Link className="link" href="/trust">Trust</Link></li>
          </ul>
          <div role="radiogroup" aria-label="Colour theme" className="flex gap-1 rounded-full p-1" style={{ background: "var(--surface)" }}>
            {MODES.map(({ mode: m, label, Icon }) => (
              <button
                key={m} type="button" role="radio" aria-checked={mode === m} aria-label={label}
                onClick={() => { setMode(m); setColorMode(m); }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                style={{ background: mode === m ? "var(--canvas)" : "transparent", color: mode === m ? "var(--ink)" : "var(--steel)" }}
              >
                <Icon size={16} strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
