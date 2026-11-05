import { Check } from "lucide-react";

const STEPS = ["Teach", "Hide", "Ask", "Be Yuki"];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto" aria-label="Steps">
      {STEPS.map((s, i) => {
        const done = i < current, on = i === current;
        return (
          <li key={s} className="flex items-center gap-2" aria-current={on ? "step" : undefined}>
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tnum transition-colors duration-200"
              style={{ background: done ? "var(--ink)" : on ? "var(--maya-blue)" : "var(--surface)", color: done || on ? "#fff" : "var(--steel)" }}>
              {done ? <Check size={14} strokeWidth={2.5} aria-hidden /> : i + 1}
            </span>
            <span className="whitespace-nowrap text-[14px] font-semibold" style={{ color: on || done ? "var(--ink)" : "var(--steel)" }}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6" style={{ background: "var(--hairline-strong)" }} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
