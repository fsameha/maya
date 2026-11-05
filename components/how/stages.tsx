"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { ItemState, MayaEvent, Run, Sighting } from "@/lib/contract";
import { maskOutline } from "@/lib/maskContour";
import { Maya, type MouthDriver } from "@/components/maya/Maya";
import { trackFromChars, trackFromWords, sampleTrack, type CharAlignment, type VisemeSeg } from "@/lib/lipsync";
import { OPENNESS, VOWELS } from "@/components/maya/visemes";
import { SplitSentence } from "@/components/theatre/WhyDrawer";
import { Waveform } from "@/components/theatre/MayaPane";
import { homeClock } from "@/lib/homeTime";
import { JsonViewer } from "./JsonViewer";
import { Frame } from "./HowItWorks";

type E<T extends MayaEvent["type"]> = T extends "note.created" | "note.confirmed" | "note.rejected"
  ? Extract<MayaEvent, { type: "note.created" | "note.confirmed" | "note.rejected" }>
  : T extends "asr.partial" | "asr.final"
    ? Extract<MayaEvent, { type: "asr.partial" | "asr.final" }>
    : Extract<MayaEvent, { type: T }>;
const first = <T extends MayaEvent["type"]>(run: Run, type: T, pred: (e: E<T>) => boolean = () => true) =>
  run.events.find((e): e is E<T> => e.type === type && pred(e as E<T>));
const all = <T extends MayaEvent["type"]>(run: Run, type: T) => run.events.filter((e): e is E<T> => e.type === type);
const seg = (p: number, a: number, b: number) => Math.max(0, Math.min(1, (p - a) / (b - a)));

interface Props { run: Run; p: number }

function useOutline(s: Sighting | undefined, run: Run) {
  const [d, setD] = useState("");
  useEffect(() => {
    if (s) maskOutline(s.maskUrl, run.frame).then(setD).catch(() => {});
  }, [s, run.frame]);
  return d;
}

function ClipFrame({ run, clipId, frame }: { run: Run; clipId: string; frame: number }) {
  const clip = first(run, "capture.clip", (e) => e.clipId === clipId);
  if (!clip) return null;
  return <video src={`${clip.videoUrl}#t=${(frame / clip.fps).toFixed(2)}`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" aria-hidden />;
}

/** A path drawn to fraction `f` of its length (scroll-driven DrawSVG equivalent). */
function DrawnPath({ d, f, ...rest }: { d: string; f: number } & React.SVGProps<SVGPathElement>) {
  const ref = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  useEffect(() => {
    if (ref.current && d) setLen(ref.current.getTotalLength());
  }, [d]);
  return <path ref={ref} d={d} strokeDasharray={len || undefined} strokeDashoffset={len ? len * (1 - f) : undefined} {...rest} />;
}

// ---------------- 1 · Capture ----------------
function CaptureVisual({ run, p }: Props) {
  const clip = first(run, "capture.clip")!;
  const threshold = 0.35;
  const n = clip.motion.length;
  const shown = Math.round(seg(p, 0.05, 0.7) * n);
  const w = 600, h = 140;
  const pts = clip.motion.slice(0, Math.max(1, shown)).map((v, i) => `${(i / (n - 1)) * w},${h - v * h}`).join(" ");
  const crossed = clip.motion.slice(0, shown).some((v) => v > threshold);
  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <div className="mx-auto w-[160px] rounded-[28px] border-[6px] p-2" style={{ borderColor: "#0a1317", aspectRatio: "9/16" }}>
        <div className="grid h-full grid-rows-4 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="relative overflow-hidden rounded-md" style={{ opacity: seg(p, i * 0.12, i * 0.12 + 0.1) }}>
              <ClipFrame run={run} clipId={clip.clipId} frame={Math.min(clip.frames - 1, i * 12)} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="t-caption">Motion (frame difference, 64×36)</p>
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full" role="img" aria-label="Motion sparkline crossing the threshold">
          <line x1="0" x2={w} y1={h - threshold * h} y2={h - threshold * h} stroke="var(--attention)" strokeDasharray="6 6" strokeWidth="2" />
          <polyline points={pts} fill="none" stroke="var(--maya-blue)" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={`chip ${crossed ? "chip-blue" : ""} t-mono transition-all duration-300`} style={{ opacity: crossed ? 1 : 0.3, transform: crossed ? "none" : "translateY(6px)" }}>
            {clip.clipId} · {clip.frames} frames · {clip.fps} fps
          </span>
          <span className="t-caption">No model runs until something moves.</span>
        </div>
      </div>
    </div>
  );
}

// ---------------- 2 · Perception ----------------
function PerceptionVisual({ run, p }: Props) {
  const stream = first(run, "perception.stream")!;
  const done = first(run, "perception.done", (e) => e.clipId === stream.clipId)!;
  const s = done.sightings[0];
  const d = useOutline(s, run);
  const [mode, setMode] = useState<"concept" | "tap">("concept");
  const lines = stream.lines.slice(0, Math.max(1, Math.round(seg(p, 0.05, 0.6) * stream.lines.length)));
  // real SAM line head: "<136f>0<|box;…" → frame 136, object id 0
  const line = /^<(\d+)f>(\d+)</.exec(lines[lines.length - 1] ?? "");
  return (
    <div>
      <div className="mb-4 inline-flex rounded-full p-1" role="tablist" style={{ background: "var(--surface)" }}>
        {(["concept", "tap"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => setMode(m)} className="h-9 rounded-full px-4 text-[13px] font-semibold" style={{ background: mode === m ? "var(--canvas)" : "transparent", color: mode === m ? "var(--ink)" : "var(--steel)" }}>
            {m === "concept" ? `Concept: “${stream.concept}”` : "Tap prompt (point)"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <pre className="t-mono h-[260px] overflow-hidden rounded-[16px] p-3 !text-[11.5px]" style={{ background: "#0a1317", color: "#9fe3b4" }} aria-label="Raw streamed SAM response lines">
          {mode === "tap" ? `> <|point;${Math.round((s.box[0] + s.box[2]) / 2)};${Math.round((s.box[1] + s.box[3]) / 2)};1;1|>\n` : `> concept: "${stream.concept}"\n`}
          {lines.map((l) => l.slice(0, 120)).join("\n")}
        </pre>
        <Frame run={run}>
          <ClipFrame run={run} clipId={s.clipId} frame={s.frame} />
          <svg viewBox={`0 0 ${run.frame.w} ${run.frame.h}`} className="absolute inset-0 h-full w-full" aria-hidden>
            {d && <path d={d} fill="var(--maya-blue)" fillOpacity={0.25 * seg(p, 0.55, 0.7)} />}
            {d && <DrawnPath d={d} f={seg(p, 0.3, 0.6)} fill="none" stroke="var(--maya-blue)" strokeWidth="4" />}
            {mode === "tap" && <circle cx={(s.box[0] + s.box[2]) / 2} cy={(s.box[1] + s.box[3]) / 2} r="12" fill="var(--maya-blue)" stroke="#fff" strokeWidth="4" />}
          </svg>
          {line && <span className="chip chip-blue absolute right-2 top-2 tnum">id {line[2]} · frame {line[1]}</span>}
        </Frame>
      </div>
      <p className="t-caption mt-3 tnum">Last {stream.lines.length} of the real streamed lines · {done.sightings.length} sightings · {(done.ms / 1000).toFixed(1)} s · ${done.usd.toFixed(3)} for the clip · the ID stays the same across frames</p>
    </div>
  );
}

// ---------------- 3 · Zones ----------------
function ZonesVisual({ run, p }: Props) {
  const s = first(run, "perception.done")!.sightings[0];
  const d = useOutline(s, run);
  const bx = (s.box[0] + s.box[2]) / 2, by = s.box[3];
  const drop = seg(p, 0.5, 0.75);
  const inZone = s.zoneId;
  return (
    <Frame run={run}>
      <ClipFrame run={run} clipId={s.clipId} frame={s.frame} />
      <svg viewBox={`0 0 ${run.frame.w} ${run.frame.h}`} className="absolute inset-0 h-full w-full" aria-hidden>
        {run.zones.map((z, i) => {
          const o = seg(p, 0.05 + i * 0.12, 0.2 + i * 0.12);
          const lit = z.id === inZone && drop >= 1;
          return (
            <g key={z.id} opacity={o}>
              <polygon points={z.polygon.map((q) => q.join(",")).join(" ")} fill={lit ? "color-mix(in srgb, var(--maya-blue) 18%, transparent)" : "rgb(255 255 255 / 0.25)"} stroke={lit ? "var(--maya-blue)" : "#5d6c7b"} strokeDasharray="12 9" strokeWidth="3" />
            </g>
          );
        })}
        {d && <path d={d} fill="var(--maya-blue)" fillOpacity="0.25" stroke="var(--maya-blue)" strokeWidth="3" />}
        <circle cx={bx} cy={by - 60 * (1 - drop)} r="9" fill="var(--maya-blue)" stroke="#fff" strokeWidth="3" opacity={seg(p, 0.45, 0.5)} />
      </svg>
      {run.zones.map((z, i) => (
        <span key={z.id} className={`chip absolute !h-7 !text-[12px] ${z.id === inZone && drop >= 1 ? "chip-blue" : ""}`} style={{ left: `${(z.polygon[0][0] / run.frame.w) * 100}%`, top: `${(z.polygon[0][1] / run.frame.h) * 100}%`, transform: "translateY(-120%)", opacity: seg(p, 0.05 + i * 0.12, 0.2 + i * 0.12) }}>
          {z.name}
        </span>
      ))}
    </Frame>
  );
}

// ---------------- 4 · Memory ----------------
const STATES: ItemState[] = ["SEEN", "ON_PERSON", "PICKED_UP", "LAST_SEEN", "MOVED"];
function MemoryVisual({ run, p }: Props) {
  const sightings = all(run, "perception.done").flatMap((e) => e.sightings);
  const mem = first(run, "memory.state", (e) => e.itemId === "glasses");
  const superseded = new Set(mem?.superseded ?? []);
  const kept = new Set(all(run, "memory.state").map((e) => e.sightingId)); // the sighting each item's state points at
  const rows = sightings.map((s) => ({ id: s.id, itemId: s.itemId, zone: run.zones.find((z) => z.id === s.zoneId)?.name ?? "outside a zone", t: homeClock(s.t, true), frame: s.frame, conf: s.conf, on: s.overlapsPerson, old: superseded.has(s.id), kept: kept.has(s.id) }));
  const visible = Math.round(seg(p, 0.05, 0.5) * rows.length);
  const cur = mem?.state ?? "SEEN";
  const lit = seg(p, 0.5, 0.9) * STATES.indexOf(cur);
  return (
    <div className="grid gap-6">
      <div className="overflow-x-auto rounded-[16px] border" style={{ borderColor: "var(--hairline)" }}>
        <table className="w-full min-w-[520px] text-left text-[14px] tnum">
          <thead><tr className="t-caption">{["item", "zone", "time", "frame", "confidence", "near person", "memory"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t transition-all duration-300" style={{ borderColor: "var(--hairline)", opacity: i < visible ? (r.old ? 0.4 : 1) : 0, transform: i < visible ? "none" : "translateY(6px)", textDecoration: r.old ? "line-through" : undefined }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>{run.items.find((x) => x.id === r.itemId)?.name ?? r.itemId}</td>
                <td className="px-4 py-2.5">{r.zone}</td>
                <td className="t-mono px-4 py-2.5">{r.t}</td>
                <td className="t-mono px-4 py-2.5">f{r.frame}</td>
                <td className="t-mono px-4 py-2.5">{r.conf.toFixed(2)}</td>
                <td className="px-4 py-2.5">{r.on ? "yes" : "no"}</td>
                <td className="px-4 py-2.5">{r.kept ? <span className="chip chip-blue t-mono !h-6 !text-[11px]">LAST_SEEN</span> : <span className="t-caption">kept in history</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="flex flex-wrap items-center gap-2" aria-label="Item state machine">
        {STATES.map((st, i) => {
          const on = Math.round(lit) === i && p > 0.5;
          return (
            <li key={st} className="flex items-center gap-2">
              <span className={`chip t-mono !h-8 transition-all duration-300 ${on ? "chip-blue live-halo" : ""}`} style={{ opacity: i <= lit + 0.01 || on ? 1 : 0.45 }}>{st}</span>
              {i < STATES.length - 1 && <span aria-hidden style={{ color: "var(--steel)" }}>→</span>}
            </li>
          );
        })}
      </ol>
      <p className="t-caption">{superseded.size > 0 ? "Older sightings are superseded, not deleted: history is kept." : "Every real sighting from both clips. The memory column marks the sighting each item's memory.state points at; the rest stay in history."}</p>
    </div>
  );
}

// ---------------- 5 · Identity ----------------
function IdentityVisual({ run, p }: Props) {
  const verdict = `{"same": false, "reason": "blue lid"}`;
  const typed = verdict.slice(0, Math.round(seg(p, 0.4, 0.8) * verdict.length));
  const enrolled = run.items[1] ?? run.items[0];
  return (
    <div>
      <p className="t-caption mb-3">Illustration: the identity check runs when there is more than one candidate. This run had none, so the crops below are placeholders.</p>
      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <figure className="card p-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolled.enrolCropUrl} alt="Enrolled crop" className="mx-auto h-28 rounded-md object-cover" />
          <figcaption className="t-caption mt-2">Enrolled: {enrolled.name}</figcaption>
        </figure>
        <span className="t-h3 text-center" aria-hidden>vs</span>
        <figure className="card p-3 text-center" style={{ opacity: seg(p, 0.1, 0.3) }}>
          <svg viewBox="0 0 120 112" className="mx-auto h-28" aria-hidden><rect x="38" y="30" width="44" height="74" rx="10" fill="#fff" stroke="#5d6c7b" strokeWidth="3" /><rect x="44" y="12" width="32" height="20" rx="4" fill="var(--maya-blue)" /></svg>
          <figcaption className="t-caption mt-2">Candidate: a lookalike white bottle</figcaption>
        </figure>
      </div>
      <pre className="t-mono mt-4 rounded-[12px] p-3" style={{ background: "var(--surface)", color: "var(--ink)" }} aria-label={`Spark verdict: ${verdict}`}>{typed}<span className="caret" aria-hidden /></pre>
    </div>
  );
}

// ---------------- 6 · Agent and policy gate ----------------
function AgentVisual({ run, p }: Props) {
  const [which, setWhich] = useState<"health" | "find">("health");
  const gate = first(run, "policy.check", (e) => (which === "health" ? e.route === "ask_caregiver" : e.route === "agent"))!;
  const after = run.events.filter((e) => e.at > gate.at);
  const tool = after.find((e): e is E<"agent.tool"> => e.type === "agent.tool")!;
  const reply = after.find((e): e is E<"agent.reply"> => e.type === "agent.reply")!;
  const words = gate.text.split(/(\s+)/);
  return (
    <div>
      <div className="mb-4 inline-flex rounded-full p-1" role="tablist" style={{ background: "var(--surface)" }}>
        {([["health", "Health question"], ["find", "Find my glasses"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={which === k} type="button" onClick={() => setWhich(k)} className="h-9 rounded-full px-4 text-[13px] font-semibold" style={{ background: which === k ? "var(--canvas)" : "transparent", color: which === k ? "var(--ink)" : "var(--steel)" }}>{l}</button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-3">
          <p className="text-[18px] font-medium" style={{ color: "var(--ink)" }}>
            “{words.map((w, i) => {
              const hit = gate.lexiconHits.includes(w.toLowerCase().replace(/[^a-z]/g, "")) && p > 0.15;
              return <span key={i} className="rounded px-0.5 transition-colors duration-300" style={{ background: hit ? "color-mix(in srgb, var(--attention) 35%, transparent)" : "transparent" }}>{w}</span>;
            })}”
          </p>
          <div style={{ opacity: seg(p, 0.2, 0.35) }}><p className="t-caption mb-1">Classifier (Spark, JSON schema)</p><JsonViewer value={gate.classifier} compact /></div>
          <div className="flex items-center gap-2" style={{ opacity: seg(p, 0.35, 0.5) }}>
            <span className="t-caption">Route</span>
            <span className={`chip ${gate.route === "ask_caregiver" ? "chip-attention" : "chip-blue"} t-mono`}>{gate.route === "ask_caregiver" ? "ask_caregiver (forced)" : `agent → ${tool?.name ?? "reply"}`}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div style={{ opacity: seg(p, 0.5, 0.62) }}><p className="t-caption mb-1">Tool call · <span className="t-mono">{tool.name}</span></p><JsonViewer value={tool.args} compact /></div>
          <div style={{ opacity: seg(p, 0.62, 0.74) }}><p className="t-caption mb-1">Result (from our code)</p><JsonViewer value={tool.result} compact /></div>
          <p className="text-[18px] font-medium leading-snug" style={{ opacity: seg(p, 0.76, 0.9) }}><SplitSentence text={reply.text} facts={reply.facts} /></p>
        </div>
      </div>
      <p className="t-caption mt-4">Maya has no tool that can create a reminder.</p>
    </div>
  );
}

// ---------------- 7 · Approvals ----------------
function ApprovalsVisual({ run, p }: Props) {
  const created = first(run, "note.created")!;
  const tap = first(run, "caregiver.tap");
  const confirmed = first(run, "note.confirmed")!;
  const at = (ms: number) => `+${(ms / 1000).toFixed(1)}s`;
  const audit = [
    { who: "Maya", what: `note.created · UNCONFIRMED · “${created.text}”`, when: at(created.at), device: "home hub" },
    ...(tap ? [{ who: "Yuki", what: `caregiver.tap · ${tap.action}`, when: at(tap.at), device: "Yuki's phone" }] : []),
    { who: "Yuki", what: `note.confirmed · ${confirmed.text}`, when: at(confirmed.at), device: "Yuki's phone" },
  ];
  const done = p > 0.5;
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <div className="flex items-center gap-3">
        <span className="chip chip-attention t-mono !h-9" style={{ opacity: done ? 0.45 : 1 }}>UNCONFIRMED</span>
        <span aria-hidden style={{ color: "var(--steel)" }}>→ Yuki taps →</span>
        <span className={`chip t-mono !h-9 transition-all duration-300 ${done ? "chip-success" : ""}`} style={{ opacity: done ? 1 : 0.45 }}>CONFIRMED</span>
      </div>
      <ol className="flex flex-col gap-2" aria-label="Audit trail">
        {audit.map((a, i) => (
          <li key={i} className="card flex items-start justify-between gap-3 p-3 transition-all duration-300" style={{ borderRadius: 14, opacity: seg(p, i * 0.25, i * 0.25 + 0.15) }}>
            <span className="text-[14px]"><strong style={{ color: "var(--ink)" }}>{a.who}</strong> · {a.what}</span>
            <span className="t-caption tnum shrink-0">{a.when} · {a.device}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------- 8 · Escalation ----------------
const LADDER: { step: E<"escalation.step">["step"]; label: string; usual: string }[] = [
  { step: "usual_missed", label: "Usual by", usual: "8:05" },
  { step: "check_in", label: "Maya checks in", usual: "9:30" },
  { step: "alert", label: "Alert Yuki", usual: "9:40" },
  { step: "second_contact", label: "Second contact", usual: "9:55" },
];
function EscalationVisual({ run, p }: Props) {
  const steps = all(run, "escalation.step");
  return (
    <ol className="relative flex flex-col gap-4 pl-8">
      <span className="absolute bottom-3 left-[11px] top-3 w-[2px]" style={{ background: "var(--hairline)" }} aria-hidden />
      <span className="absolute left-[11px] top-3 w-[2px] origin-top" style={{ background: "var(--maya-blue)", height: `calc((100% - 24px) * ${seg(p, 0.05, 0.85)})` }} aria-hidden />
      {LADDER.map((l, i) => {
        const ev = steps.find((s) => s.step === l.step);
        const on = seg(p, 0.05, 0.85) >= i / (LADDER.length - 1) - 0.001;
        return (
          <li key={l.step} className="relative flex flex-wrap items-center justify-between gap-2">
            <span className="absolute -left-8 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-2 transition-colors duration-300" style={{ borderColor: on ? "var(--maya-blue)" : "var(--hairline-strong)", background: on ? "var(--maya-blue)" : "var(--canvas)" }} aria-hidden />
            <span className="text-[16px] font-medium" style={{ color: "var(--ink)" }}>{l.label} <span className="tnum" style={{ color: "var(--steel)" }}>{l.usual}</span></span>
            <span className="chip t-mono tnum !h-7 !text-[12px] transition-opacity duration-300" style={{ opacity: on ? 1 : 0 }}>
              logged {ev ? `+${(ev.at / 1000).toFixed(1)}s` : "—"}{ev?.simulated ? " · simulated" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------- 9 · Privacy ----------------
function PrivacyVisual({ run, p }: Props) {
  const blur = first(run, "privacy.blur")!;
  const maskFrame = Number(/\.f(\d+)\.png$/.exec(blur.personMaskUrl)?.[1] ?? 0);
  const [d, setD] = useState("");
  useEffect(() => {
    maskOutline(blur.personMaskUrl, run.frame).then(setD).catch(() => {});
  }, [blur, run.frame]);
  const [left, setLeft] = useState(24 * 3600 - 48);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setLeft(24 * 3600 - 48 - Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const hh = String(Math.floor(left / 3600)).padStart(2, "0"), mm = String(Math.floor(left / 60) % 60).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const b = seg(p, 0.35, 0.7);
  const rows: [string, boolean, string][] = [["Object answers", true, ""], ["Daily rhythm", true, ""], ["Blurred thumbnails", true, "if allowed"], ["Raw video", false, "never"], ["Live feed", false, "never"]];
  return (
    <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
      <div>
        <Frame run={run}>
          <ClipFrame run={run} clipId={blur.clipId} frame={maskFrame} />
          <svg viewBox={`0 0 ${run.frame.w} ${run.frame.h}`} className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <filter id="privacy-blur"><feGaussianBlur stdDeviation={b * 30} /></filter>
              <clipPath id="person-clip"><path d={d} /></clipPath>
            </defs>
            {d && (
              <>
                <g clipPath="url(#person-clip)" filter="url(#privacy-blur)">
                  <rect width={run.frame.w} height={run.frame.h} fill="#9aa6b2" />
                </g>
                <path d={d} fill="none" stroke="var(--maya-blue)" strokeWidth="3" opacity={seg(p, 0.1, 0.3) * (1 - b)} />
              </>
            )}
          </svg>
          <span className="chip t-mono tnum absolute bottom-2 left-2 !h-7 !text-[12px]" style={{ background: "var(--glass)" }}>planned retention · simulated {hh}:{mm}:{ss}</span>
        </Frame>
        <p className="t-caption mt-2 tnum">Real SAM 3.1 “person” mask, frame {maskFrame} of {blur.clipId}. This illustrates masking; not every demo asset is anonymized.</p>
      </div>
      <table className="w-full self-start text-[15px]" aria-label="What Yuki can see">
        <caption className="t-caption mb-2 text-left">What Yuki can see</caption>
        <tbody>
          {rows.map(([label, ok, note], i) => (
            <tr key={label} className="border-t transition-opacity duration-300" style={{ borderColor: "var(--hairline)", opacity: seg(p, 0.2 + i * 0.1, 0.3 + i * 0.1) }}>
              <td className="py-2.5">{label}</td>
              <td className="py-2.5 text-right">
                {ok ? <Check size={18} strokeWidth={2} style={{ color: "var(--success)", display: "inline" }} aria-label="yes" /> : <X size={18} strokeWidth={2} style={{ color: "var(--critical)", display: "inline" }} aria-label="no" />}
                {note && <span className="t-caption ml-2">{note}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- 10 · Voice ----------------
const VCOL: Record<string, string> = { MBP: "#0a1317", FV: "#5d6c7b", TH: "#9aa6b2", L: "#9aa6b2", rest: "transparent" };
function VoiceVisual({ run, p }: Props) {
  const reply = first(run, "agent.reply")!;
  const [chars, setChars] = useState<CharAlignment | null>(null);
  useEffect(() => {
    fetch(reply.audioUrl.replace("/audio/", "/alignment/").replace(/\.(wav|mp3)$/, ".json")).then((r) => (r.ok ? r.json() : null)).then((j) => Array.isArray(j?.characters) && setChars(j)).catch(() => {});
  }, [reply]);
  const track: VisemeSeg[] = useMemo(() => (chars ? trackFromChars(chars) : trackFromWords(reply.alignment)), [chars, reply]);
  const dur = track.length ? track[track.length - 1].end : 1;
  const [scrub, setScrub] = useState<number | null>(null);
  const t = scrub ?? seg(p, 0.15, 0.95) * dur;
  const driver: MouthDriver = useMemo(() => ({ sample: () => { const v = sampleTrack(track, t); return v ? { v, amount: 0.8 } : null; } }), [track, t]);
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_200px]">
      <div className="flex flex-col gap-3">
        <p className="text-[17px] font-medium" style={{ color: "var(--ink)" }}>“{reply.text}”</p>
        <div className="flex items-center gap-2"><Waveform live={p > 0.1 && p < 0.95} /><span className="t-caption">Demo voice: pre-rendered ElevenLabs, with character timestamps</span></div>
        <div className="relative h-10 overflow-hidden rounded-[10px]" style={{ background: "var(--surface)" }} aria-label="Viseme track">
          {track.map((s, i) => (
            <span key={i} className="absolute top-1 bottom-1 rounded-[3px]" title={s.v} style={{ left: `${(s.start / dur) * 100}%`, width: `${((s.end - s.start) / dur) * 100}%`, background: VCOL[s.v] ?? (VOWELS.has(s.v) ? `color-mix(in srgb, var(--maya-blue) ${30 + OPENNESS[s.v] * 70}%, transparent)` : "#9aa6b2") }} />
          ))}
          <span className="absolute bottom-0 top-0 w-[2px]" style={{ left: `${(t / dur) * 100}%`, background: "var(--critical)" }} />
        </div>
        <label className="t-caption flex items-center gap-3">Scrub
          <input type="range" min={0} max={dur} step={5} value={t} onChange={(e) => setScrub(+e.target.value)} className="flex-1" aria-label="Scrub the viseme track" />
          <span className="tnum w-14 text-right">{(t / 1000).toFixed(2)}s</span>
        </label>
        <p className="t-caption">Blue = vowels (darker opens wider) · black = closed m/b/p · grey = consonants</p>
      </div>
      <div className="flex justify-center"><Maya size={180} speech={driver} interactive={false} /></div>
    </div>
  );
}

interface StageDef {
  slug: string; short: string; title: string; summary: string; split: string; code: string;
  Visual: (p: Props) => React.JSX.Element; raw: (r: Run) => unknown; simulated?: boolean;
}

export const STAGE_DEFS: StageDef[] = [
  { slug: "capture", short: "Capture", title: "Capture", summary: "The home camera cuts a 10-second clip only when something moves.", split: "All our code.", code: "/blob/main/components/try/TryApp.tsx", Visual: CaptureVisual, raw: (r: Run) => first(r, "capture.clip") },
  { slug: "perception", short: "Perception", title: "Perception (SAM 3.1)", summary: "SAM 3.1 finds and outlines the object in every frame of the clip, and keeps its ID.", split: "SAM 3.1 finds and outlines it. We parse and decode.", code: "/blob/main/scripts/record.mjs", Visual: PerceptionVisual, raw: (r: Run) => first(r, "perception.done") },
  { slug: "zones", short: "Zones", title: "Zones", summary: "Each sighting lands in a named place in the room, by where the object touches down.", split: "Spark proposed the zone names once at setup, a person confirmed them, and code assigns zones.", code: "/blob/main/lib/maya/memory.ts", Visual: ZonesVisual, raw: (r: Run) => r.zones },
  { slug: "memory", short: "Memory", title: "Memory", summary: "Sightings become rows, and each item moves through a small state machine.", split: "All our code.", code: "/blob/main/lib/maya/memory.ts", Visual: MemoryVisual, raw: (r: Run) => all(r, "memory.state") },
  { slug: "identity", short: "Identity", title: "Identity", summary: "Illustration of a planned lookalike check; identity verification is not demonstrated in this run.", split: "Spark compares. Code decides which one is the match.", code: "/blob/main/docs/LIMITS.md", Visual: IdentityVisual, raw: () => ({ placeholder: true, same: false, reason: "blue lid" }) },
  { slug: "agent", short: "Agent + gate", title: "Agent and policy gate", summary: "Every request passes a gate first. Anything about health goes to the caregiver.", split: "Spark interprets and phrases. Code gates what it's allowed to do.", code: "/blob/main/lib/maya/agent.ts", Visual: AgentVisual, raw: (r: Run) => all(r, "policy.check") },
  { slug: "approvals", short: "Approvals", title: "Approvals", summary: "Mum's spoken note stays unconfirmed until Yuki confirms it on her phone.", split: "All our code.", code: "/blob/main/components/theatre/model.ts", Visual: ApprovalsVisual, raw: (r: Run) => r.events.filter((e) => e.type.startsWith("note.") || e.type === "caregiver.tap") },
  { slug: "escalation", short: "Escalation", title: "Escalation", summary: "When the usual signs of the morning are missing, Maya checks in, then tells Yuki.", split: "All our code.", code: "/blob/main/scripts/make-placeholders.mjs", Visual: EscalationVisual, raw: (r: Run) => all(r, "escalation.step"), simulated: true },
  { slug: "privacy", short: "Privacy", title: "Privacy", summary: "SAM person masks demonstrate blurring. Automatic deletion and retention enforcement are not implemented.", split: "SAM gives the person masks. This prototype illustrates blurring and intended permissions.", code: "/blob/main/benchmark/render.py", Visual: PrivacyVisual, raw: (r: Run) => all(r, "privacy.blur") },
  { slug: "voice", short: "Voice", title: "Voice", summary: "Speech in is transcribed. Maya's answer drives her mouth from the audio's own timing.", split: "Voice Transcribe hears. The demo voice is pre-rendered (ElevenLabs, with timestamps). Code does the lip-sync.", code: "/blob/main/lib/lipsync.ts", Visual: VoiceVisual, raw: (r: Run) => first(r, "agent.reply") },
];
