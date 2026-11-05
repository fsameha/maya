"use client";
// Try it live (PRD §12). Replay is the free default: the visitor's real camera preview, with the analysis
// replayed from the recorded try-001 run at its real timing. Live is bring-your-own-key and calls the live stub.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, KeyRound, Mic, Volume2 } from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { Dialog } from "@astryxdesign/core/Dialog";
import type { Item, MayaEvent, Run } from "@/lib/contract";
import { Player } from "@/lib/player";
import { getSource } from "@/lib/source";
import { runUsesPlaceholders } from "@/lib/source/fixture";
import { NotWiredYet } from "@/lib/source/live";
import { maskOutline } from "@/lib/maskContour";
import { audioContext } from "@/lib/audio";
import { textDriver, type TimedDriver } from "@/lib/lipsync";
import { Maya } from "@/components/maya/Maya";
import { gazeProps } from "@/components/maya/gaze";
import { PlaceholderChip } from "@/components/ui/PlaceholderChip";
import { WhyDrawer } from "@/components/theatre/WhyDrawer";
import type { Turn } from "@/components/theatre/model";
import { Stepper } from "./Stepper";
import { InspectorBody, InspectorSheet } from "./Inspector";
import { PairQR } from "./PairQR";
import { initialTry, pairChannel, pairCode, stepTry, type PairMessage, type TryState } from "./model";

type Phase = "consent" | "teach" | "hide" | "analysing" | "ask" | "answer" | "be-yuki";
const STEP_OF: Record<Phase, number> = { consent: 0, teach: 0, hide: 1, analysing: 1, ask: 2, answer: 2, "be-yuki": 3 };
const NAME_CHIPS = ["my keys", "glasses", "wallet", "phone"];
const HIDE_MS = 10000;

export function TryApp() {
  const [run, setRun] = useState<Run | null>(null);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(() => {
    setLoadError(false);
    getSource("fixture").loadRun("try-001").then(setRun).catch(() => setLoadError(true));
  }, []);
  useEffect(load, [load]);
  if (loadError) {
    return (
      <div className="wrap section">
        <div className="card p-8" role="alert">
          <p className="t-lead">Maya couldn&apos;t reach her memory. Showing the recorded run instead.</p>
          <button type="button" className="pill mt-6" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }
  if (!run) return <div className="wrap section"><div className="h-[60vh] rounded-[32px]" style={{ background: "var(--surface)" }} aria-busy="true" /></div>;
  return <TryInner run={run} />;
}

function TryInner({ run }: { run: Run }) {
  const player = useMemo(() => new Player(run), [run]);
  const [phase, setPhase] = useState<Phase>("consent");
  const [state, setState] = useState<TryState>(initialTry);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [denied, setDenied] = useState(false);
  const [forcedReplay, setForcedReplay] = useState(false);
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);
  const [name, setName] = useState("my keys");
  const [enrolled, setEnrolled] = useState<Item[]>([]);
  const [motionTrace, setMotion] = useState<number[]>([]);
  const [hideP, setHideP] = useState(0);
  const [question, setQuestion] = useState("");
  const [holding, setHolding] = useState(false);
  const [speech, setSpeech] = useState<TimedDriver | null>(null);
  const [typed, setTyped] = useState(0);
  const [why, setWhy] = useState<Turn | null>(null);
  const [keySheet, setKeySheet] = useState(false);
  const [voiceSheet, setVoiceSheet] = useState(false);
  const [paired, setPaired] = useState(false);
  const [code] = useState(() => pairCode());
  const video = useRef<HTMLVideoElement>(null);
  const segEnd = useRef(0);
  const chan = useRef<BroadcastChannel | null>(null);
  const placeholder = runUsesPlaceholders(run);

  // replayed events fold into the inspector; Be Yuki events also go to the paired tab
  useEffect(() => {
    const off = player.on((e) => {
      setState((s) => stepTry(s, e));
      if (e.type === "caregiver.push" || e.type === "note.created") chan.current?.postMessage({ kind: "event", e } satisfies PairMessage);
    });
    const offT = player.onTick((t) => t >= segEnd.current && player.pause());
    return () => {
      off();
      offT();
      player.destroy();
    };
  }, [player]);

  const playSegment = (from: number, to: number) => {
    segEnd.current = to;
    player.seek(from);
    player.play();
  };
  const ev = (type: MayaEvent["type"], after = -1): MayaEvent | undefined => run.events.find((e) => e.type === type && e.at > after);
  const firstAsk = ev("asr.final")!;
  const memEvent = ev("memory.state")!;
  const spend = ev("spend")!;
  const yukiStart = ev("asr.final", firstAsk.at)!;

  // ?mode=replay forces the recorded run
  useEffect(() => {
    if (new URLSearchParams(location.search).get("mode") === "replay") {
      setForcedReplay(true);
      setPhase("teach");
    }
  }, []);

  // camera
  const allowCamera = async () => {
    audioContext();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      setStream(s);
      setPhase("teach");
    } catch {
      setDenied(true);
      setPhase("teach");
    }
  };
  useEffect(() => {
    if (video.current && stream) video.current.srcObject = stream;
  }, [stream, phase]);
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  const live = !!stream && !forcedReplay;

  // hide: a real 10s capture with real motion measured from the camera (64×36 frame difference, 5 fps)
  useEffect(() => {
    if (phase !== "hide") return;
    const t0 = performance.now();
    let raf = 0;
    let rec: MediaRecorder | null = null;
    if (live && stream && typeof MediaRecorder !== "undefined") {
      try {
        rec = new MediaRecorder(stream);
        rec.start();
      } catch {}
    }
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 36;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    let prev: Uint8ClampedArray | null = null;
    let lastSample = 0;
    const tick = (now: number) => {
      const el = now - t0;
      setHideP(Math.min(1, el / HIDE_MS));
      if (now - lastSample > 200 && video.current && video.current.readyState >= 2) {
        lastSample = now;
        ctx.drawImage(video.current, 0, 0, 64, 36);
        const d = ctx.getImageData(0, 0, 64, 36).data;
        if (prev) {
          let sum = 0;
          for (let i = 0; i < d.length; i += 4) sum += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]);
          setMotion((m) => [...m.slice(-80), sum / (64 * 36 * 3 * 255)]);
        }
        prev = d;
      }
      if (el >= HIDE_MS) {
        if (rec?.state === "recording") rec.stop(); // discarded: nothing is kept after this session
        setPhase("analysing");
        playSegment(0, memEvent.at);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (rec?.state === "recording") rec.stop();
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // analysing → ask once the memory step lands
  useEffect(() => {
    if (phase === "analysing" && state.itemState) setPhase("ask");
  }, [phase, state.itemState]);

  // answer: Maya speaks the reply as text (bubble + chime), mouth from text timing
  useEffect(() => {
    if (!state.reply || (phase !== "ask" && phase !== "answer" && phase !== "be-yuki")) return;
    if (phase === "ask") setPhase("answer");
    chime();
    const d = textDriver(state.reply.text, performance.now() + 80);
    setSpeech(d);
    const words = state.reply.text.split(" ");
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0;
      const n = d.track.length ? words.filter((_, i) => (i / words.length) * d.durationMs <= t).length : words.length;
      setTyped(n);
      if (t < d.durationMs + 400) raf = requestAnimationFrame(tick);
      else setSpeech(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.reply]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = (text?: string) => {
    if (text !== undefined) setQuestion(text);
    playSegment(firstAsk.at - 1, spend.at + 1);
  };

  // Be Yuki: pair a second tab over BroadcastChannel (a Durable Object WebSocket later)
  useEffect(() => {
    if (phase !== "be-yuki" || typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(pairChannel(code));
    chan.current = ch;
    ch.onmessage = (m: MessageEvent<PairMessage>) => {
      if (m.data.kind === "hello") setPaired(true);
      if (m.data.kind === "tap") {
        const at = player.time;
        setState((s) => stepTry(stepTry(s, { at, type: "caregiver.tap", action: m.data.kind === "tap" ? m.data.action : "" }), { at: at + 1, type: "note.confirmed", noteId: s.note?.id ?? "", text: "Reminder set by Yuki", by: "yuki" }));
      }
    };
    return () => {
      ch.close();
      chan.current = null;
    };
  }, [phase, code, player]);

  const turn: Turn | null = useMemo(() => {
    if (!state.reply) return null;
    const before = state.events.filter((e) => e.at <= state.reply!.at);
    const lastAsr = [...before].reverse().find((e) => e.type === "asr.final") as Turn["transcript"];
    const from = lastAsr?.at ?? 0;
    return {
      id: "try", at: from, transcript: lastAsr,
      policy: before.filter((e) => e.at >= from).find((e) => e.type === "policy.check") as Turn["policy"],
      tools: before.filter((e) => e.at >= from && e.type === "agent.tool") as Turn["tools"],
      reply: state.reply,
    };
  }, [state]);

  const sighting = state.sightings[0];
  const answerCard = sighting && (phase === "answer" || phase === "be-yuki");
  const inspectorProps = { run, state, enrolled, motion: motionTrace, mode: "replay" as const, calls: 0 };

  return (
    <div className="wrap pb-40 pt-6 lg:pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="t-h2">Try the guided replay</h1>
          <p className="mt-1" style={{ color: "var(--steel)" }}>Explore the steps with optional camera preview. Analysis and answers are examples, not predictions about your room.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {placeholder && <PlaceholderChip />}
          <Badge variant="blue" label="Replay" />
          <button type="button" className="pill pill-ghost pill-sm" onClick={() => setKeySheet(true)} {...gazeProps()}><KeyRound size={16} strokeWidth={1.75} aria-hidden /> Use your Meta API key</button>
          <button type="button" className="chip h-9" onClick={() => setVoiceSheet(true)} {...gazeProps()}><Volume2 size={14} strokeWidth={1.75} aria-hidden /> Add voice</button>
        </div>
      </div>

      {denied && <p className="mt-4 rounded-[16px] px-4 py-3 text-[15px]" role="status" style={{ background: "var(--maya-blue-soft)", color: "var(--ink)" }}>Camera permission was denied, so Maya is showing the recorded run instead.</p>}
      {state.capped && <p className="mt-4 rounded-[16px] px-4 py-3 text-[15px]" role="status" style={{ background: "var(--surface)" }}>Today&apos;s live budget is used. Here&apos;s a recorded run.</p>}

      <div className="mt-6"><Stepper current={STEP_OF[phase]} /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="relative overflow-hidden rounded-[32px] bg-black" style={{ aspectRatio: "16 / 9" }}>
            {phase === "consent" ? (
              <div className="absolute inset-0 flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
                <div className="card max-w-[440px] p-6 text-center">
                  <Camera className="mx-auto" size={28} strokeWidth={1.75} aria-hidden style={{ color: "var(--ink)" }} />
                  <p className="mt-3 text-[17px] font-medium" style={{ color: "var(--ink)" }}>Your camera becomes Maya&apos;s home camera. Nothing is kept after this session.</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button type="button" className="pill pill-live" onClick={allowCamera} {...gazeProps()}>Allow camera</button>
                    <button type="button" className="pill pill-ghost" onClick={() => { audioContext(); setForcedReplay(true); setPhase("teach"); }} {...gazeProps()}>Use the recorded run</button>
                  </div>
                </div>
              </div>
            ) : (
              <CameraStage
                run={run} live={live} video={video} phase={phase} tap={tap} sighting={answerCard ? sighting : undefined}
                onTap={(p) => phase === "teach" && setTap(p)} hideP={hideP}
              />
            )}
          </div>

          <div className={`card p-5 ${phase === "consent" ? "hidden" : ""}`} aria-live="polite">
            {phase === "teach" && (
              !tap ? <p className="t-lead">Tap something on your desk.</p> : (
                <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); const it = { ...run.items[0], name: name || run.items[0].name }; setEnrolled([it]); setPhase("hide"); }}>
                  <label className="t-caption" htmlFor="item-name">What is it?</label>
                  <input id="item-name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-[12px] border px-4 text-[16px]" style={{ borderColor: "var(--hairline-strong)", background: "var(--canvas)", color: "var(--ink)" }} />
                  <div className="flex flex-wrap gap-2">{NAME_CHIPS.map((c) => <button key={c} type="button" className={`chip h-9 ${name === c ? "chip-blue" : ""}`} onClick={() => setName(c)}>{c}</button>)}</div>
                  <button type="submit" className="pill self-start">Teach Maya</button>
                  <p className="t-caption">Replay: the outline is the recorded mask from the try run, placed where you tapped.</p>
                </form>
              )
            )}
            {phase === "hide" && (
              <div className="flex items-center gap-4">
                <Ring p={hideP} />
                <div>
                  <p className="t-lead">Now move it, or hide it under something. Maya is watching.</p>
                  <span className="chip chip-blue live-halo mt-2">Watching · recording a 10s clip</span>
                </div>
              </div>
            )}
            {phase === "analysing" && (
              <ol className="flex flex-wrap gap-3 tnum" aria-label="Analysis steps">
                {([["uploading", "Uploading"], ["sam", "SAM 3.1"], ["memory", "Memory"]] as const).map(([k, l]) => (
                  <li key={k} className="chip h-9" style={state.steps[k] !== undefined ? { background: "var(--maya-blue-soft)", color: "var(--maya-blue)" } : undefined}>
                    <span className="h-2 w-2 rounded-full" style={{ background: state.steps[k] !== undefined ? "var(--maya-blue)" : "var(--hairline-strong)" }} />
                    {l}{state.steps[k] !== undefined ? ` · ${state.steps[k]} ms` : ""}
                  </li>
                ))}
              </ol>
            )}
            {phase === "ask" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <HoldToTalk holding={holding} setHolding={setHolding} onRelease={() => ask("")} />
                  <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
                    <label htmlFor="ask" className="visually-hidden">Ask Maya</label>
                    <input id="ask" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask Maya…" className="h-12 min-w-0 flex-1 rounded-[12px] border px-4 text-[16px]" style={{ borderColor: "var(--hairline-strong)", background: "var(--canvas)", color: "var(--ink)" }} />
                    <button type="submit" className="pill">Ask</button>
                  </form>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="t-caption">Try:</span>
                  <button type="button" className="chip h-9" onClick={() => ask(`Where are my ${name.replace(/^my /, "")}?`)}>Where are my {name.replace(/^my /, "")}?</button>
                </div>
                {state.transcript && <p className="text-[17px]" style={{ color: "var(--ink)" }}>“{state.transcript}”</p>}
                <p className="t-caption">Replay answers the recorded question with its recorded timing.</p>
              </div>
            )}
            {(phase === "answer" || phase === "be-yuki") && state.reply && (
              <div className="flex flex-col gap-4">
                <div className="flex items-end gap-3">
                  <Maya size={72} speech={speech} expression={state.reply.expression} interactive={false} label="Maya is answering." />
                  <div className="rounded-[22px] rounded-bl-[6px] border px-4 py-3" style={{ borderColor: "var(--hairline)" }}>
                    <p className="text-[20px] font-medium leading-snug md:text-[22px]" style={{ color: "var(--ink)" }} aria-label={state.reply.text}>
                      {state.reply.text.split(" ").map((w, i) => <span key={i} aria-hidden style={{ opacity: i < typed ? 1 : 0, transition: "opacity 120ms" }}>{w} </span>)}
                    </p>
                    <button type="button" className="link mt-1 min-h-9 text-[13px] font-medium" onClick={() => setWhy(turn)}>Why did Maya say this?</button>
                  </div>
                </div>
                {sighting && phase === "answer" && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="chip chip-success tnum h-10 !text-[14px]">Last seen · {run.zones.find((z) => z.id === sighting.zoneId)?.name} · {sighting.t.slice(11, 19)}</span>
                    <button type="button" className="pill" onClick={() => setPhase("be-yuki")} {...gazeProps()}>Next: be Yuki</button>
                  </div>
                )}
              </div>
            )}
            {phase === "be-yuki" && (
              <div className="mt-5 flex flex-col gap-4 border-t pt-5" style={{ borderColor: "var(--hairline)" }}>
                <p className="t-lead">Scan with your phone to become Yuki.</p>
                <PairQR url={`${location.origin}/try/yuki?code=${code}`} code={code} />
                <p className="t-caption">Or open <a className="link" href={`/try/yuki?code=${code}`} target="_blank" rel="noreferrer">the Yuki view in a new tab</a>. {paired ? <strong style={{ color: "var(--success)" }}>Paired.</strong> : "Waiting to pair…"}</p>
                <button type="button" className="pill pill-live self-start" disabled={!!state.note} onClick={() => playSegment(yukiStart.at - 1, run.events[run.events.length - 1].at + 1)}>
                  <Mic size={16} strokeWidth={1.75} aria-hidden /> Say “This is my medicine”
                </button>
                {state.note && (
                  <span className={`chip ${state.note.status === "confirmed" ? "chip-success" : "chip-attention"} h-10 self-start !text-[14px]`}>
                    {state.note.status === "confirmed" ? "Reminder set by Yuki" : "Unconfirmed · waiting for Yuki"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="card hidden self-start p-5 lg:block"><InspectorBody {...inspectorProps} /></aside>
      </div>
      <InspectorSheet {...inspectorProps} />

      <WhyDrawer turn={why} onClose={() => setWhy(null)} />
      <KeySheet isOpen={keySheet} onOpenChange={setKeySheet} />
      <VoiceSheet isOpen={voiceSheet} onOpenChange={setVoiceSheet} />
    </div>
  );
}

function CameraStage({ run, live, video, phase, tap, sighting, onTap, hideP }: {
  run: Run; live: boolean; video: React.RefObject<HTMLVideoElement | null>; phase: Phase; tap: { x: number; y: number } | null;
  sighting?: TryState["sightings"][number]; onTap: (p: { x: number; y: number }) => void; hideP: number;
}) {
  const [d, setD] = useState("");
  const clip = run.events.find((e) => e.type === "capture.clip") as Extract<MayaEvent, { type: "capture.clip" }>;
  const item = run.events.find((e) => e.type === "perception.done") as Extract<MayaEvent, { type: "perception.done" }>;
  const s0 = sighting ?? item.sightings[0];
  useEffect(() => {
    maskOutline(s0.maskUrl, run.frame).then(setD).catch(() => {});
  }, [s0, run.frame]);
  const showRecorded = !live || !!sighting;
  const cx = (s0.box[0] + s0.box[2]) / 2, cy = (s0.box[1] + s0.box[3]) / 2;
  const offset = tap && !sighting ? { x: tap.x * run.frame.w - cx, y: tap.y * run.frame.h - cy } : { x: 0, y: 0 };
  return (
    <div
      className="absolute inset-0"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onTap({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      }}
      role={phase === "teach" ? "button" : undefined}
      aria-label={phase === "teach" ? "Tap the object to teach Maya" : undefined}
      style={{ cursor: phase === "teach" ? "crosshair" : undefined }}
    >
      {showRecorded ? (
        <video key={sighting ? "s" : "c"} src={`${clip.videoUrl}#t=${((sighting?.frame ?? 0) / clip.fps).toFixed(2)}`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" aria-label="Recorded try run" />
      ) : (
        <video ref={video} autoPlay muted playsInline className="absolute inset-0 h-full w-full -scale-x-100 object-cover" aria-label="Your camera" />
      )}
      {live && showRecorded && <video ref={video} autoPlay muted playsInline className="hidden" />}
      <svg viewBox={`0 0 ${run.frame.w} ${run.frame.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {sighting && (() => {
          const z = run.zones.find((x) => x.id === sighting.zoneId);
          return z ? <polygon points={z.polygon.map((p) => p.join(",")).join(" ")} fill="none" stroke="#fff" strokeDasharray="12 9" strokeWidth="3" /> : null;
        })()}
        {(tap || sighting) && d && phase !== "hide" && phase !== "analysing" && (
          <g transform={`translate(${offset.x} ${offset.y})`}>
            <path d={d} fill="var(--maya-blue)" className="mask-fill" />
            <path d={d} fill="none" stroke="var(--maya-blue)" strokeWidth="4" className="mask-draw" pathLength={1} />
          </g>
        )}
        {tap && !sighting && <circle cx={tap.x * run.frame.w} cy={tap.y * run.frame.h} r="40" fill="var(--maya-blue)" className="tap-ripple" />}
      </svg>
      {showRecorded && <span className="chip absolute left-3 top-3 !h-7 !text-[12px]" style={{ background: "var(--glass)" }}>{sighting ? "Recorded run · the moment it was last seen" : "Recorded run"}</span>}
      {sighting && <span className="t-mono tnum absolute right-3 top-3 rounded-full px-3 py-1 text-[14px] font-semibold" style={{ background: "var(--canvas)", color: "var(--ink)" }}>{sighting.t.slice(11, 19)}</span>}
      {phase === "hide" && <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: "rgb(255 255 255 / 0.2)" }}><div className="h-full" style={{ width: `${hideP * 100}%`, background: "var(--maya-blue)" }} /></div>}
    </div>
  );
}

function Ring({ p }: { p: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`Recording, ${Math.round(p * 10)} of 10 seconds`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--hairline)" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--maya-blue)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)" className="tnum">{Math.ceil(10 * (1 - p))}</text>
    </svg>
  );
}

/** Hold to talk (desktop: hold the spacebar). In replay it replays the recorded transcript with its real timing. */
function HoldToTalk({ holding, setHolding, onRelease }: { holding: boolean; setHolding: (v: boolean) => void; onRelease: () => void }) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || (e.target as HTMLElement).closest("input, textarea, button")) return;
      e.preventDefault();
      setHolding(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || (e.target as HTMLElement).closest("input, textarea, button")) return;
      setHolding(false);
      onRelease();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [setHolding, onRelease]);
  return (
    <button
      type="button" className={`pill ${holding ? "pill-live live-halo" : ""}`}
      onPointerDown={() => setHolding(true)} onPointerUp={() => { setHolding(false); onRelease(); }} onPointerLeave={() => holding && setHolding(false)}
      aria-pressed={holding}
    >
      <Mic size={16} strokeWidth={1.75} aria-hidden /> {holding ? "Listening…" : "Hold to talk"}
    </button>
  );
}

function chime() {
  const ac = audioContext();
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(880, ac.currentTime);
  o.frequency.exponentialRampToValueAtTime(1320, ac.currentTime + 0.12);
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.08, ac.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5);
  o.connect(g).connect(ac.destination);
  o.start();
  o.stop(ac.currentTime + 0.55);
}

function KeySheet({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (v: boolean) => void }) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "bad" | "notwired">("idle");
  useEffect(() => {
    try { setKey(sessionStorage.getItem("maya.metaKey") ?? ""); } catch {}
  }, []);
  const check = async () => {
    try { sessionStorage.setItem("maya.metaKey", key); } catch {}
    setStatus("checking");
    try {
      await getSource("live").loadRun("live");
      setStatus("ok");
    } catch (e) {
      setStatus(e instanceof NotWiredYet ? "notwired" : "bad");
    }
  };
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={460} purpose="form">
      <form className="flex flex-col gap-4 p-6" onSubmit={(e) => { e.preventDefault(); void check(); }}>
        <h2 className="t-h3 !text-[22px]">Use your Meta API key</h2>
        <label className="t-caption" htmlFor="meta-key">MODEL_API_KEY from <a className="link" href="https://dev.meta.ai" target="_blank" rel="noreferrer">dev.meta.ai</a></label>
        <input id="meta-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} className="h-12 rounded-[12px] border px-4" style={{ borderColor: "var(--hairline-strong)", background: "var(--canvas)", color: "var(--ink)" }} />
        <p className="t-caption">Stored only in this tab. Sent only to Meta, through our proxy, never logged.</p>
        <div aria-live="polite" className="min-h-6 text-[14px]">
          {status === "checking" && "Checking your key…"}
          {status === "ok" && <span style={{ color: "var(--success)" }}>Key works. Live mode is on.</span>}
          {status === "bad" && <span style={{ color: "var(--critical)" }}>That key didn&apos;t work.</span>}
          {status === "notwired" && <span>Live mode isn&apos;t connected yet, so your key was not sent anywhere. Maya stays on the recorded run.</span>}
        </div>
        <div className="flex gap-2">
          <button type="submit" className="pill pill-live" disabled={!key || status === "checking"}>Check key</button>
          <button type="button" className="pill pill-ghost" onClick={() => onOpenChange(false)}>Close</button>
        </div>
      </form>
    </Dialog>
  );
}

function VoiceSheet({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (v: boolean) => void }) {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={460} purpose="form">
      <form className="flex flex-col gap-4 p-6" onSubmit={(e) => { e.preventDefault(); try { sessionStorage.setItem("maya.elevenKey", key); } catch {} setSaved(true); }}>
        <h2 className="t-h3 !text-[22px]">Want Maya to speak?</h2>
        <p>Add your own ElevenLabs key (stored only in this tab).</p>
        <label className="t-caption" htmlFor="el-key">ElevenLabs API key</label>
        <input id="el-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} className="h-12 rounded-[12px] border px-4" style={{ borderColor: "var(--hairline-strong)", background: "var(--canvas)", color: "var(--ink)" }} />
        <span className="chip self-start !h-7 !text-[12px]">Voice by ElevenLabs (not a Meta model)</span>
        <div aria-live="polite" className="min-h-6 text-[14px]">{saved && "Saved for this tab. Live voice turns on when the live backend is connected; replay stays text-first."}</div>
        <div className="flex gap-2">
          <button type="submit" className="pill" disabled={!key}>Save</button>
          <button type="button" className="pill pill-ghost" onClick={() => onOpenChange(false)}>Close</button>
        </div>
      </form>
    </Dialog>
  );
}
