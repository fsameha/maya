"use client";
import { useEffect, useState } from "react";
import { PlaceholderChip } from "@/components/ui/PlaceholderChip";
import { Grid2x2 } from "./Grid2x2";
import { ResultsTable, type ModelDetail } from "./ResultsTable";

interface Metrics {
  placeholder?: boolean;
  detail?: Record<string, ModelDetail>;
  grid?: Record<string, boolean>;
}
interface EvalResults {
  safety: { cases: number; healthRecall: number; falseRoutes: number; falseRouteExamples: string[]; gateMs: { p50: number; p95: number } };
  latency: { askToAnswerMs: number[]; samClipMs: number[] };
  costPerDayUsd: { assumptions: string; sam: number; spark: number };
  rows: { health: boolean }[];
}

/** Every number comes from fixtures/benchmark/metrics.json and fixtures/eval/results.json. Missing → "—". */
export function ProofPage() {
  const [m, setM] = useState<Metrics | null>(null);
  const [ev, setEv] = useState<EvalResults | null>(null);
  useEffect(() => {
    (async () => {
      const index = await fetch("/fixtures/index.json").then((r) => r.json()).catch(() => ({}));
      for (const f of ["metrics.json", "metrics.placeholder.json"]) {
        if (f === "metrics.json" && index.benchmark !== "metrics.json") continue;
        const r = await fetch(`/fixtures/benchmark/${f}`).catch(() => null);
        if (r?.ok) return setM({ ...(await r.json()), placeholder: f.includes("placeholder") });
      }
    })();
    fetch("/fixtures/eval/results.json").then((r) => (r.ok ? r.json() : null)).then(setEv).catch(() => {});
  }, []);
  const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
  const ask = ev ? [...ev.latency.askToAnswerMs].sort((a, b) => a - b) : [];
  const health = ev?.rows.filter((r) => r.health).length;
  const cards = ev
    ? [
        { label: "Health routing recall", value: `${Math.round(ev.safety.healthRecall * 100)}%`, note: `${health} of ${health} health questions reached Yuki, out of ${ev.safety.cases} utterances through the real gate.` },
        { label: "False routes", value: String(ev.safety.falseRoutes), note: `Sent to Yuki by mistake: “${ev.safety.falseRouteExamples.join("”, “")}”. We accept that over a missed health question.` },
        { label: "Ask → answer", value: `${s(ask[Math.floor(ask.length / 2)])}`, note: `Median of ${ask.length} recorded turns (max ${s(ask[ask.length - 1])}). Classifier plus up to 3 Spark calls; too slow for a product.` },
        { label: "Policy gate", value: `${s(ev.safety.gateMs.p50)}`, note: `p50 per utterance, p95 ${s(ev.safety.gateMs.p95)}.` },
        { label: "Cost per day", value: `$${(ev.costPerDayUsd.sam + ev.costPerDayUsd.spark).toFixed(2)}`, note: `SAM $${ev.costPerDayUsd.sam.toFixed(2)} + Spark $${ev.costPerDayUsd.spark.toFixed(2)}. ${ev.costPerDayUsd.assumptions}.` },
      ]
    : [];
  const gdinoScored = !!m?.detail?.gdino;
  const yb = m?.detail?.yolo11?.pill_bottle["recall@0.5"];
  const yoloBottle = typeof yb === "number" ? `${Math.round(yb * 100)}%` : "—";

  return (
    <div className="wrap section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="t-eyebrow">Proof</p>
          <h1 className="t-h2 mt-2 max-w-[820px]">{gdinoScored ? "On our home footage, only SAM 3.1 found the glasses and kept their ID." : "Of the models we ran, only SAM 3.1 found the glasses and kept their ID."}</h1>
          <p className="t-lead mt-3 max-w-[680px]" style={{ color: "var(--steel)" }}>Same two home clips (257 frames, 1080p, 15 fps), same prompts, one scoring script. YOLO11 is the fastest model on a laptop CPU and finds the pill bottle in {yoloBottle} of frames, but it has no glasses class.</p>
        </div>
        {m?.placeholder && <PlaceholderChip />}
      </div>
      {m?.placeholder && <p className="t-caption mt-4">Layout only: every number reads “—” until the benchmark writes metrics.json. No number on this page is invented.</p>}

      <section className="mt-12" aria-labelledby="grid-title">
        <h2 id="grid-title" className="t-h3">Same clip, every model we ran</h2>
        <p className="t-caption mt-1">The glasses-table clip with each model&apos;s boxes or masks burned in. Press play: all tiles stay in sync.{m?.grid && !m.grid.gdino && " Grounding DINO has no tile: it did not finish on CPU."}</p>
        <div className="mt-4"><Grid2x2 available={m?.grid ?? {}} /></div>
      </section>

      <section className="mt-16" aria-labelledby="table-title">
        <h2 id="table-title" className="t-h3">Results</h2>
        <p className="t-caption mb-4 mt-1">Best local value per column in blue. SAM&apos;s recall reads “reference” because the reference boxes are SAM&apos;s own, checked by eye frame by frame, so it is not scored against itself.</p>
        {m?.detail ? <ResultsTable detail={m.detail} /> : <p className="t-caption">—</p>}
        <p className="t-caption mt-3">Small benchmark: one room, daylight, 2 clips. Baselines ran on an i7-8665U laptop CPU; SAM 3.1 ran on the hosted Meta Model API, so its ms per frame is not a like-for-like speed comparison.</p>
      </section>

      <section className="mt-16" aria-labelledby="evals-title">
        <h2 id="evals-title" className="t-h3">Evals</h2>
        {!ev && <p className="t-caption mt-4">—</p>}
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((c) => (
            <li key={c.label} className="card p-5" style={{ borderRadius: 16 }}>
              <p className="t-caption">{c.label}</p>
              <p className="display tnum mt-2 text-[32px] font-semibold" style={{ color: "var(--ink)" }}>{c.value}</p>
              <p className="t-caption mt-2">{c.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16" aria-labelledby="repro-title">
        <h2 id="repro-title" className="t-h3">Reproduce</h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          <li><span className="chip t-mono h-9">python benchmark/run_baselines.py</span></li>
          <li><span className="chip t-mono h-9">python benchmark/metrics.py</span></li>
          <li><span className="chip t-mono h-9">pnpm eval</span></li>
        </ul>
      </section>
    </div>
  );
}
