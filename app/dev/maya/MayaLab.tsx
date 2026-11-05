"use client";
import { useMemo, useRef, useState } from "react";
import { Maya, type MayaState, type MouthDriver } from "@/components/maya/Maya";
import { VISEMES, type Viseme } from "@/components/maya/visemes";
import { EXPRESSIONS } from "@/components/maya/expressions";
import { textDriver } from "@/lib/lipsync";
import type { Expression } from "@/lib/contract";

const STATES: MayaState[] = ["idle", "listening", "thinking", "speaking", "happy", "concerned"];

export function MayaLab() {
  const [expression, setExpression] = useState<Expression | "">("");
  const [state, setState] = useState<MayaState>("idle");
  const [viseme, setViseme] = useState<Viseme | "">("");
  const [amount, setAmount] = useState(1);
  const [level, setLevel] = useState(0.5);
  const [size, setSize] = useState(420);
  const [speech, setSpeech] = useState<MouthDriver | null>(null);
  const [text, setText] = useState("Let me check. They're on the table to your right. You put them there at 10:42.");
  const [hi, setHi] = useState("");
  const timer = useRef<number>(0);

  const sizes = useMemo(() => [32, 40, 240, 280, 420], []);

  const speak = () => {
    const d = textDriver(text, performance.now() + 100);
    setSpeech(d);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSpeech(null), d.durationMs + 400);
  };

  return (
    <section className="wrap section grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col items-center gap-8">
        <div className="card card-surface flex w-full items-center justify-center p-8" style={{ minHeight: 480 }}>
          <Maya
            size={size} expression={expression || undefined} state={state}
            viseme={viseme || null} visemeAmount={amount} listeningLevel={level} speech={speech}
            onHi={() => { setHi("Hi, I'm Maya."); window.setTimeout(() => setHi(""), 1800); }}
          />
        </div>
        <p className="t-lead min-h-8" aria-live="polite">{hi}</p>
        <div className="flex flex-wrap items-end justify-center gap-6">
          {sizes.map((s) => <div key={s} className="flex flex-col items-center gap-2"><Maya size={s} expression={expression || undefined} state={state} /><span className="t-caption">{s}px</span></div>)}
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <h1 className="t-h3">Maya rig</h1>
        <Field label="State">
          <Select value={state} options={STATES} onChange={(v) => setState(v as MayaState)} />
        </Field>
        <Field label="Expression (overrides state)">
          <Select value={expression} options={["", ...Object.keys(EXPRESSIONS)]} onChange={(v) => setExpression(v as Expression)} />
        </Field>
        <Field label="Viseme">
          <div className="flex flex-wrap gap-2">
            {["", ...VISEMES].map((v) => (
              <button key={v || "none"} type="button" className={`chip ${viseme === v ? "chip-blue" : ""}`} onClick={() => setViseme(v as Viseme)}>{v || "none"}</button>
            ))}
          </div>
        </Field>
        <Field label={`Viseme amount ${amount.toFixed(2)}`}><input type="range" min={0} max={1} step={0.01} value={amount} onChange={(e) => setAmount(+e.target.value)} /></Field>
        <Field label={`Listening level ${level.toFixed(2)}`}><input type="range" min={0} max={1} step={0.01} value={level} onChange={(e) => setLevel(+e.target.value)} /></Field>
        <Field label={`Size ${size}px`}><input type="range" min={32} max={600} step={1} value={size} onChange={(e) => setSize(+e.target.value)} /></Field>
        <Field label="Speak from text timing (14 chars/s)">
          <textarea className="w-full rounded-[12px] border p-3" style={{ borderColor: "var(--hairline-strong)", background: "var(--canvas)" }} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" className="pill pill-live mt-3" onClick={speak}>Speak</button>
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-2"><span className="t-caption">{label}</span>{children}</label>;
}
function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select className="h-11 rounded-[12px] border px-3" style={{ borderColor: "var(--hairline-strong)", background: "var(--canvas)", color: "var(--ink-body)" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o} value={o}>{o || "(from state)"}</option>)}
    </select>
  );
}
