"use client";
import { useEffect, useState } from "react";
import { motion, useAnimationControls, type PanInfo } from "motion/react";
import type { Item, Run } from "@/lib/contract";
import { Waveform } from "@/components/theatre/MayaPane";
import type { TryState } from "./model";

interface Props { run: Run; state: TryState; enrolled: Item[]; motion: number[]; mode: "replay" | "live"; calls: number }

/** A compact How-it-works for this session (PRD §12). */
export function InspectorBody({ run, state, enrolled, motion: m, mode, calls }: Props) {
  const max = Math.max(0.4, ...m);
  return (
    <div className="flex flex-col gap-5 text-[14px]">
      <div className="flex items-center justify-between">
        <h2 className="t-h3 !text-[18px]">Inspector</h2>
        <span className="chip tnum !h-7 !text-[12px]">{mode === "live" ? `Your key · ${calls} calls · about $${state.usd.toFixed(2)}` : "Replay · no key needed"}</span>
      </div>

      <section aria-label="Enrolled items">
        <p className="t-caption mb-2">Enrolled</p>
        {enrolled.length === 0 ? <p className="t-caption">Nothing yet. Tap something on your desk.</p> : (
          <ul className="flex flex-wrap gap-2">
            {enrolled.map((i) => <li key={i.id} className="chip chip-blue">{i.name}</li>)}
          </ul>
        )}
      </section>

      <section aria-label="Motion">
        <p className="t-caption mb-2">Motion (your camera, 64×36 frame difference)</p>
        <svg viewBox="0 0 300 48" className="h-12 w-full" role="img" aria-label="Motion sparkline">
          <line x1="0" x2="300" y1={48 - (0.08 / max) * 44} y2={48 - (0.08 / max) * 44} stroke="var(--attention)" strokeDasharray="4 4" />
          <polyline fill="none" stroke="var(--maya-blue)" strokeWidth="2" points={m.slice(-60).map((v, i, a) => `${(i / Math.max(1, a.length - 1)) * 300},${48 - (v / max) * 44}`).join(" ")} />
        </svg>
      </section>

      <section aria-label="Analysis steps">
        <p className="t-caption mb-2">Steps</p>
        <ul className="flex flex-col gap-1.5 tnum">
          {([["uploading", "Uploading"], ["sam", "SAM 3.1"], ["memory", "Memory"]] as const).map(([k, l]) => (
            <li key={k} className="flex justify-between"><span>{l}</span><span style={{ color: state.steps[k] !== undefined ? "var(--ink)" : "var(--steel)" }}>{state.steps[k] !== undefined ? `${state.steps[k]} ms` : "—"}</span></li>
          ))}
        </ul>
      </section>

      <section aria-label="Sightings">
        <p className="t-caption mb-2">Sightings</p>
        {state.sightings.length === 0 ? <p className="t-caption">Nothing seen yet. Show Maya something.</p> : (
          <table className="w-full text-left text-[13px] tnum">
            <thead className="t-caption"><tr><th className="py-1 font-medium">item</th><th className="font-medium">zone</th><th className="font-medium">time</th><th className="font-medium">conf</th></tr></thead>
            <tbody>
              {state.sightings.map((s) => (
                <tr key={s.id} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                  <td className="py-1.5">{run.items.find((i) => i.id === s.itemId)?.name}</td>
                  <td>{run.zones.find((z) => z.id === s.zoneId)?.name}</td>
                  <td>{s.t.slice(11, 19)}</td>
                  <td>{s.conf.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {state.itemState && <p className="mt-2"><span className="t-caption mr-2">State</span><span className="chip chip-blue t-mono !h-7 !text-[12px]">{state.itemState}</span></p>}
      </section>

      <section aria-label="Agent log">
        <p className="t-caption mb-2">Agent log</p>
        <ol className="t-mono flex max-h-56 flex-col gap-1 overflow-y-auto !text-[12px]">
          {state.log.length === 0 && <li className="t-caption">Empty.</li>}
          {state.log.map((l, i) => (
            <li key={i} className="flex gap-2"><span className="tnum shrink-0" style={{ color: "var(--steel)" }}>{(l.at / 1000).toFixed(2)}s</span><span className="shrink-0 font-semibold" style={{ color: "var(--maya-blue)" }}>{l.kind}</span><span className="break-words" style={{ color: "var(--ink-body)" }}>{l.text}</span></li>
          ))}
        </ol>
      </section>
      {state.transcript && <div className="flex items-center gap-2"><Waveform /><span className="t-caption">Recorded transcript, replayed with its real timing</span></div>}
    </div>
  );
}

/** Mobile: the inspector is a bottom sheet with 3 snap points. */
export function InspectorSheet(props: Props) {
  const controls = useAnimationControls();
  const [h, setH] = useState(800);
  useEffect(() => setH(window.innerHeight), []);
  const snaps = [h - 76, h * 0.5, h * 0.15];
  const [snap, setSnap] = useState(0);
  useEffect(() => void controls.start({ y: snaps[snap] }), [snap, h]); // eslint-disable-line react-hooks/exhaustive-deps
  const onEnd = (_: unknown, info: PanInfo) => {
    const y = snaps[snap] + info.offset.y + info.velocity.y * 0.2;
    let best = 0;
    snaps.forEach((s, i) => Math.abs(s - y) < Math.abs(snaps[best] - y) && (best = i));
    setSnap(best);
    void controls.start({ y: snaps[best] });
  };
  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-40 rounded-t-[24px] border-t lg:hidden"
      style={{ height: h, background: "var(--canvas)", borderColor: "var(--hairline)", boxShadow: "0 -8px 30px rgb(10 19 23 / 0.12)" }}
      initial={{ y: h - 76 }} animate={controls} drag="y" dragConstraints={{ top: snaps[2], bottom: snaps[0] }} dragElastic={0.08} onDragEnd={onEnd}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      aria-label="Inspector"
    >
      <button type="button" className="mx-auto flex h-11 w-full items-center justify-center" onClick={() => setSnap((s) => (s + 1) % 3)} aria-label="Resize inspector">
        <span className="h-1.5 w-10 rounded-full" style={{ background: "var(--hairline-strong)" }} />
      </button>
      <div className="h-[calc(100%-44px)] overflow-y-auto px-4 pb-32"><InspectorBody {...props} /></div>
    </motion.div>
  );
}
