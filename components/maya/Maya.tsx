"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Expression } from "@/lib/contract";
import { prefersReducedMotion } from "@/lib/reducedMotion";
import { EARS, FACE, FRINGE, HAIR, NOSE } from "./head";
import { CHIN, EYE_L, EYE_R, HEAD_PIVOT, LENS_KEYS, MOUTH_CX, lensPath, mixLens, type Lens } from "./shapes";
import { EXPRESSIONS } from "./expressions";
import { MOUTHS, type Viseme } from "./visemes";
import { gaze } from "./gaze";
import {
  BLINK_MS, GAZE_MAX, GAZE_TAU, HEAD_TAU, HEAD_TILT_MAX, IDLE_RETURN_MS, TARGET_TAU,
  blinkScale, breathScale, nextBlink, nextSaccade, normalizeGaze, smoothAlpha, springStep,
} from "./rig";

export type MayaState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "concerned";

/** Anything that can drive the mouth from a clock: audio alignment, text timing, or a test slider. */
export interface MouthDriver {
  /** Returns the viseme and openness (0..1) right now, or null when silent. */
  sample(nowMs: number): { v: Viseme; amount: number } | null;
}

export type GazeTarget = "pointer" | "center" | Element | { x: number; y: number } | null;

export interface MayaProps {
  size?: number;
  expression?: Expression;
  viseme?: Viseme | null;
  visemeAmount?: number;
  gazeTarget?: GazeTarget;
  listeningLevel?: number;
  state?: MayaState;
  speech?: MouthDriver | null;
  interactive?: boolean;
  onHi?: () => void;
  className?: string;
  style?: CSSProperties;
  /** Text description of Maya's state for screen readers (the SVG itself is aria-hidden). */
  label?: string;
}

const STATE_EXPRESSION: Record<MayaState, Expression> = {
  idle: "neutral", listening: "listening", thinking: "thinking", speaking: "neutral", happy: "happy", concerned: "concerned",
};

type Spring = { x: Lens; v: Lens };
const zeroLens = (): Lens => ({ w: 0, y: 0, top: 0, bot: 0, kt: 0, kb: 0, tilt: 0, sw: 0 });
const stepLens = (s: Spring, target: Lens, dt: number, omega = 28) => {
  for (const k of LENS_KEYS) {
    const [nx, nv] = springStep(s.x[k], s.v[k], target[k], dt, omega);
    s.x[k] = nx;
    s.v[k] = nv;
  }
};

export function Maya({
  size = 280, expression, viseme = null, visemeAmount = 1, gazeTarget = "pointer",
  listeningLevel = 0, state = "idle", speech = null, interactive = true, onHi, className, style, label,
}: MayaProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const eyeLRef = useRef<SVGPathElement>(null);
  const eyeRRef = useRef<SVGPathElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const [surprisedUntil, setSurprisedUntil] = useState(0);
  const small = size < 64;

  // Latest props, read by the single rAF loop without re-subscribing.
  const props = useRef({ expression, viseme, visemeAmount, gazeTarget, listeningLevel, state, speech, surprisedUntil });
  props.current = { expression, viseme, visemeAmount, gazeTarget, listeningLevel, state, speech, surprisedUntil };

  const hover = useRef({ until: 0 });
  const blinkReq = useRef(0);
  const clicks = useRef<number[]>([]);

  const initialExpr = EXPRESSIONS[expression ?? STATE_EXPRESSION[state]];
  const initialMouth = lensPath(MOUTH_CX, initialExpr.mouth);
  const initialEye = lensPath(0, { ...initialExpr.eye });

  useEffect(() => {
    const svg = svgRef.current!;
    const reduced = prefersReducedMotion();
    let raf = 0;
    let running = false;
    let visible = true;
    let last = performance.now();
    const t0 = last;

    const ex0 = EXPRESSIONS[props.current.expression ?? STATE_EXPRESSION[props.current.state]];
    const mouth: Spring = { x: { ...ex0.mouth }, v: zeroLens() };
    const eye: Spring = { x: { ...ex0.eye }, v: zeroLens() };
    let eyeScale = ex0.eyeScale, eyeScaleV = 0, eyeTilt = ex0.eyeTilt, eyeTiltV = 0;
    let gx = 0, gy = 0, tilt = 0, bob = 0, ring = 0;
    let sacX = 0, sacY = 0, sacUntil = 0;
    let saccade = nextSaccade();
    let nextSaccadeAt = t0 + saccade.delay;
    let blink = nextBlink();
    let nextBlinkAt = t0 + blink.delay;
    let blinkStart = -1;
    let doubleQueued = false;
    let wasSpeaking = false;
    let silentSince = 0;
    let lastMouthD = "";
    let lastEyeD = "";
    let seenBlinkAt = gaze.blinkAt;

    const frame = (now: number) => {
      if (!rootRef.current || !eyeLRef.current || !eyeRRef.current || !mouthRef.current || !eyesRef.current) return;
      const dt = Math.min(64, now - last);
      last = now;
      const p = props.current;
      const surprised = now < p.surprisedUntil;
      const exprName: Expression = surprised ? "surprised" : p.expression ?? STATE_EXPRESSION[p.state];
      const ex = EXPRESSIONS[exprName];

      // ---- gaze ----
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.49;
      let tx = 0, ty = 0;
      let tau = GAZE_TAU;
      const override = gaze.target && gaze.target.isConnected ? gaze.target : null;
      const gt = override ?? p.gazeTarget;
      if (gt && gt !== "pointer" && gt !== "center") {
        let x: number, y: number;
        if (gt instanceof Element) {
          const r = gt.getBoundingClientRect();
          x = r.left + r.width / 2;
          y = r.top + r.height / 2;
        } else {
          x = gt.x;
          y = gt.y;
        }
        [tx, ty] = normalizeGaze(x - cx, y - cy);
        tau = TARGET_TAU;
      } else if (gt === "pointer" && gaze.hasPointer && now - gaze.lastInput < IDLE_RETURN_MS) {
        [tx, ty] = normalizeGaze(gaze.px - cx, gaze.py - cy);
      } else {
        tau = 200; // drift back to centre over ~600ms
      }
      if (!ex.tracks) {
        tx = 0;
        ty = 0;
      }
      tx = Math.max(-1, Math.min(1, tx + ex.gazeBias[0]));
      ty = Math.max(-1, Math.min(1, ty + ex.gazeBias[1]));
      const cap = reduced ? 0.5 : 1;
      const a = smoothAlpha(dt, tau);
      gx += (tx * GAZE_MAX.x * cap - gx) * a;
      gy += (ty * GAZE_MAX.y * cap - gy) * a;

      // idle saccades
      if (now >= nextSaccadeAt) {
        sacX = saccade.dx;
        sacY = saccade.dy;
        sacUntil = now + 40 + 260;
        saccade = nextSaccade();
        nextSaccadeAt = now + saccade.delay;
      }
      if (now > sacUntil) {
        sacX = 0;
        sacY = 0;
      }

      // head tilt toward the pointer (±2°, 180ms)
      const ta = reduced ? 0 : tx * HEAD_TILT_MAX * 0.5;
      tilt += (ta - tilt) * smoothAlpha(dt, HEAD_TAU);

      // listening bob + ring
      const lvl = p.state === "listening" ? Math.max(0, Math.min(1, p.listeningLevel)) : 0;
      const bobTarget = reduced ? 0 : -(2 + 2 * lvl) * lvl * Math.abs(Math.sin(now / 160));
      bob += (bobTarget - bob) * smoothAlpha(dt, 60);
      ring += ((p.state === "listening" ? 0.25 + 0.75 * lvl : 0) - ring) * smoothAlpha(dt, 120);

      // ---- mouth ----
      const drive = p.speech?.sample(now) ?? (p.viseme ? { v: p.viseme, amount: p.visemeAmount } : null);
      let mouthTarget: Lens = ex.mouth;
      const speaking = !!drive;
      if (drive) {
        silentSince = 0;
        const v = MOUTHS[drive.v];
        mouthTarget = drive.v === "MBP" || drive.v === "rest" ? v : mixLens(MOUTHS.MBP, v, 0.35 + 0.65 * drive.amount);
      } else if (wasSpeaking && !silentSince) {
        silentSince = now;
      }
      if (!drive && now < Math.max(hover.current.until, gaze.smileUntil)) {
        mouthTarget = mixLens(ex.mouth, MOUTHS.E, 0.3);
      }
      stepLens(mouth, mouthTarget, dt);
      // end of a line: rest, then a blink
      if (wasSpeaking && !speaking) blinkReq.current = now + 140;
      wasSpeaking = speaking;

      // ---- eyes ----
      stepLens(eye, ex.eye, dt, 22);
      [eyeScale, eyeScaleV] = springStep(eyeScale, eyeScaleV, ex.eyeScale, dt, 22);
      [eyeTilt, eyeTiltV] = springStep(eyeTilt, eyeTiltV, ex.eyeTilt, dt, 22);

      // blink scheduling: never mid-word, always after a line
      if (gaze.blinkAt !== seenBlinkAt) {
        seenBlinkAt = gaze.blinkAt;
        blinkStart = now - 65; // start from the closed key: eyes blink open
      }
      if (blinkReq.current && now >= blinkReq.current && blinkStart < 0) {
        blinkStart = now;
        blinkReq.current = 0;
      }
      if (now >= nextBlinkAt && blinkStart < 0 && !speaking && ex.tracks) {
        blinkStart = now;
        doubleQueued = blink.double;
        blink = nextBlink();
        nextBlinkAt = now + blink.delay;
      }
      let bs = 1;
      if (blinkStart >= 0) {
        const bt = now - blinkStart;
        bs = blinkScale(bt);
        if (bt >= BLINK_MS) {
          blinkStart = -1;
          if (doubleQueued) blinkReq.current = now + 90;
          doubleQueued = false;
        }
      }

      // ---- write ----
      const breathe = reduced ? 1 : breathScale(now - t0);
      rootRef.current!.setAttribute(
        "transform",
        `translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(3)} ${HEAD_PIVOT.x} ${HEAD_PIVOT.y}) ` +
          `translate(${CHIN.x} ${CHIN.y}) scale(${breathe.toFixed(4)}) translate(${-CHIN.x} ${-CHIN.y})`,
      );
      eyesRef.current!.setAttribute("transform", `translate(${(gx + sacX).toFixed(2)} ${(gy + sacY).toFixed(2)})`);
      const eyeD = lensPath(0, eye.x);
      if (eyeD !== lastEyeD) {
        eyeLRef.current!.setAttribute("d", eyeD);
        eyeRRef.current!.setAttribute("d", eyeD);
        eyeLRef.current!.setAttribute("stroke-width", eye.x.sw.toFixed(2));
        eyeRRef.current!.setAttribute("stroke-width", eye.x.sw.toFixed(2));
        lastEyeD = eyeD;
      }
      const sy = (eyeScale * bs).toFixed(3);
      const sx = eyeScale.toFixed(3);
      eyeLRef.current!.setAttribute("transform", `translate(${EYE_L.x} ${EYE_L.y}) rotate(${eyeTilt.toFixed(2)}) scale(${sx} ${sy})`);
      eyeRRef.current!.setAttribute("transform", `translate(${EYE_R.x} ${EYE_R.y}) rotate(${(-eyeTilt).toFixed(2)}) scale(${sx} ${sy})`);
      const md = lensPath(MOUTH_CX, mouth.x);
      if (md !== lastMouthD) {
        mouthRef.current!.setAttribute("d", md);
        mouthRef.current!.setAttribute("stroke-width", mouth.x.sw.toFixed(2));
        lastMouthD = md;
      }
      if (ringRef.current) ringRef.current.setAttribute("opacity", ring.toFixed(3));

      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(svg);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const handlers = interactive
    ? {
        onPointerEnter: () => (hover.current.until = performance.now() + 300),
        onClick: () => {
          const now = performance.now();
          blinkReq.current = now;
          clicks.current = [...clicks.current.filter((t) => now - t < 600), now];
          if (clicks.current.length >= 3) {
            setSurprisedUntil(now + 600);
            clicks.current = [];
          }
          onHi?.();
        },
      }
    : {};

  return (
    <span
      className={className}
      style={{ display: "inline-block", width: size, height: size, lineHeight: 0, ...style }}
      {...handlers}
    >
      {label ? <span className="visually-hidden">{label}</span> : null}
      <svg
        ref={svgRef}
        viewBox="0 0 800 800"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        style={{ overflow: "visible", cursor: interactive ? "pointer" : undefined }}
      >
        <circle
          ref={ringRef}
          cx="400" cy="390" r="345"
          fill="none" stroke="var(--maya-blue)" strokeWidth="14" opacity="0"
        />
        <g ref={rootRef}>
          <path
            d={HAIR} fill="var(--maya-hair)"
            stroke="var(--maya-outline)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
          />
          <path d={FACE} fill="var(--maya-face)" />
          {!small && <path d={FRINGE} fill="var(--maya-face)" />}
          <path d={EARS} fill="var(--maya-hair)" />
          {!small && <path d={NOSE} fill="var(--maya-hair)" />}
          <g ref={eyesRef}>
            <path
              ref={eyeLRef} d={initialEye} fill="var(--maya-hair)" stroke="var(--maya-hair)"
              strokeLinejoin="round" strokeWidth={initialExpr.eye.sw}
              transform={`translate(${EYE_L.x} ${EYE_L.y})`}
            />
            <path
              ref={eyeRRef} d={initialEye} fill="var(--maya-hair)" stroke="var(--maya-hair)"
              strokeLinejoin="round" strokeWidth={initialExpr.eye.sw}
              transform={`translate(${EYE_R.x} ${EYE_R.y})`}
            />
          </g>
          <path
            ref={mouthRef} d={initialMouth} fill="var(--maya-hair)" stroke="var(--maya-hair)"
            strokeLinejoin="round" strokeWidth={initialExpr.mouth.sw}
          />
        </g>
      </svg>
    </span>
  );
}
