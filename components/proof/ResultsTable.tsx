import { MODELS } from "./Grid2x2";

interface Target { "recall@0.5"?: number | null; falseAlarmsPerFrame?: number | null; idSwitches?: number | null; classAvailable?: boolean; framesWithMask?: string; distinctIdsPerClip?: number }
export interface ModelDetail { type: string; glasses: Target; pill_bottle: Target; msPerFrame: number; usdPerClip: number; hardware: string; framesScored?: number }

type Cell = { text: string; tone?: "best" | "muted" | "ref"; title?: string };

const num = (v: number | null | undefined, f: (n: number) => string): Cell => (typeof v === "number" ? { text: f(v) } : { text: "—", tone: "muted" });

/** Recall cell: closed-set models have no glasses class; SAM is the eye-checked reference, so it is not self-scored. */
function recall(id: string, t: Target | undefined): Cell {
  if (!t) return { text: "—", tone: "muted" };
  if (t.classAvailable === false) return { text: "class not available", tone: "muted" };
  if (id === "sam31") return { text: "reference", tone: "ref", title: `Reference boxes are SAM's own, checked by eye. Mask in ${t.framesWithMask ?? "?"} frames.` };
  return num(t["recall@0.5"], (v) => v.toFixed(2));
}

/** Every number comes from fixtures/benchmark/metrics.json → detail. Best local value per column in blue. */
export function ResultsTable({ detail }: { detail: Record<string, ModelDetail> }) {
  const local = Object.entries(detail).filter(([id]) => id !== "sam31");
  const bestBottle = Math.max(...local.map(([, d]) => d.pill_bottle["recall@0.5"] ?? -1));
  const fastest = Math.min(...local.map(([, d]) => d.msPerFrame));
  const maxMs = Math.max(...Object.values(detail).map((d) => d.msPerFrame), 1);

  return (
    <div className="card overflow-x-auto p-0" tabIndex={0} aria-label="Results table, scrolls sideways on small screens">
      <table className="w-full min-w-[860px] text-left text-[15px] tnum">
        <caption className="visually-hidden">Benchmark results on two home clips (257 frames): glasses and the pill bottle</caption>
        <thead>
          <tr className="t-caption">
            <th className="px-5 pt-3 font-medium" rowSpan={2}>Model</th>
            <th className="px-3 pt-3 font-medium" colSpan={1}>Glasses</th>
            <th className="border-l px-3 pt-3 font-medium" colSpan={3} style={{ borderColor: "var(--hairline)" }}>Pill bottle</th>
            <th className="border-l px-3 pt-3 font-medium" colSpan={2} style={{ borderColor: "var(--hairline)" }}>Speed and cost</th>
          </tr>
          <tr className="t-caption !text-[12px]">
            <th className="px-3 pb-3 font-normal">Recall @ IoU 0.5</th>
            <th className="border-l px-3 pb-3 font-normal" style={{ borderColor: "var(--hairline)" }}>Recall @ IoU 0.5</th>
            <th className="px-3 pb-3 font-normal">False alarms / frame</th>
            <th className="px-3 pb-3 font-normal">ID switches</th>
            <th className="border-l px-3 pb-3 font-normal" style={{ borderColor: "var(--hairline)" }}>ms / frame</th>
            <th className="px-3 pb-3 font-normal">Cost / clip</th>
          </tr>
        </thead>
        <tbody>
          {MODELS.map((m) => {
            const d = detail[m.id];
            if (!d) {
              return (
                <tr key={m.id} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                  <th scope="row" className="px-5 py-3 font-semibold" style={{ color: "var(--ink)" }}>{m.name}<span className="t-caption block !text-[12px] font-normal">{m.type}</span></th>
                  <td colSpan={6} className="px-3 py-3 text-[14px]" style={{ color: "var(--steel)" }}>Not run (CPU time): Grounding DINO tiny did not finish on the laptop CPU before the deadline.</td>
                </tr>
              );
            }
            const b = d.pill_bottle;
            const isSam = m.id === "sam31";
            const cells: Cell[] = [
              recall(m.id, d.glasses),
              (() => { const c = recall(m.id, b); return b["recall@0.5"] === bestBottle && !isSam ? { ...c, tone: "best" as const } : c; })(),
              isSam ? { text: "—", tone: "muted", title: "Not self-scored" } : num(b.falseAlarmsPerFrame, (v) => v.toFixed(3)),
              isSam ? { text: `${b.distinctIdsPerClip ?? "—"} ID / clip`, title: "Distinct SAM object ids per clip" } : num(b.idSwitches, (v) => String(v)),
            ];
            const fast = !isSam && d.msPerFrame === fastest;
            return (
              <tr key={m.id} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                <th scope="row" className="px-5 py-3 font-semibold" style={{ color: "var(--ink)" }}>
                  {m.name}<span className="t-caption block !text-[12px] font-normal">{m.type}</span>
                </th>
                {cells.map((c, i) => (
                  <td key={i} title={c.title} className={`px-3 py-3 ${i === 1 ? "border-l" : ""} ${c.tone === "muted" ? "text-[13px]" : ""}`}
                    style={{ borderColor: "var(--hairline)", color: c.tone === "muted" ? "var(--steel)" : c.tone === "best" ? "var(--maya-blue)" : c.tone === "ref" ? "var(--ink)" : undefined, fontWeight: c.tone === "best" ? 700 : undefined }}>
                    {c.tone === "ref" ? <span className="chip !h-6 !text-[12px]">{c.text}</span> : c.text}
                    {c.tone === "best" && <span className="visually-hidden"> (best)</span>}
                  </td>
                ))}
                <td className="border-l px-3 py-3" style={{ borderColor: "var(--hairline)" }}>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 rounded-full" aria-hidden style={{ width: `${Math.max(4, (d.msPerFrame / maxMs) * 96)}px`, background: fast ? "var(--maya-blue)" : "var(--steel)", opacity: fast ? 1 : 0.45 }} />
                    <span style={fast ? { color: "var(--maya-blue)", fontWeight: 700 } : undefined}>{d.msPerFrame}</span>
                  </div>
                  <span className="t-caption block !text-[11px]">{isSam ? "hosted API, streamed" : fast ? "fastest on laptop CPU" : "laptop CPU"}</span>
                </td>
                <td className="px-3 py-3">{d.usdPerClip === 0 ? "$0 (local)" : `$${d.usdPerClip.toFixed(3)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
