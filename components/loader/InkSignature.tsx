"use client";
// The ink signature loader (PRD §5): "Maya" is written in one glossy stroke, unravels into a thread,
// and lands in the nav as the outline of Maya's bob, which fills and blinks open. ≤3.2s, once per session.
import { useEffect, useRef, useState } from "react";
import { getGsap } from "@/lib/gsap";
import { blinkAll } from "@/components/maya/gaze";
import { HAIR } from "@/components/maya/head";
import { SIGNATURE_D, SIGNATURE_SEGMENTS, SIGNATURE_VIEWBOX } from "./maya-signature";
import { mapPath, straightLine } from "./paths";

const PRESSURE = [6, 7, 8, 7]; // px at 1440 wide: heavier downstrokes in the middle of the word

function finish() {
  try {
    sessionStorage.setItem("mayaIntroSeen", "1");
  } catch {}
  document.documentElement.setAttribute("data-intro", "done");
  window.dispatchEvent(new Event("maya:intro-done"));
}

export function InkSignature() {
  const [active, setActive] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (document.documentElement.getAttribute("data-intro") !== "play") return;
    setActive(true);
  }, []);

  useEffect(() => {
    if (!active || !svg.current) return;
    const { gsap } = getGsap();
    const el = svg.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw < 768;
    el.setAttribute("viewBox", `0 0 ${vw} ${vh}`);

    // --- geometry in screen px ---
    const wordW = (mobile ? 0.78 : 0.42) * vw;
    const s = wordW / SIGNATURE_VIEWBOX.w;
    const ox = (vw - wordW) / 2 - vw * 0.01;
    const oy = vh * 0.46 - (SIGNATURE_VIEWBOX.h * s) / 2;
    const toScreen = (x: number, y: number): [number, number] => [ox + x * s, oy + y * s];
    const word = mapPath(SIGNATURE_D, toScreen);
    const baseY = oy + 150 * s;
    const line = straightLine(ox + 18 * s, ox + 418 * s, baseY, SIGNATURE_SEGMENTS);
    const logoW = mobile ? 40 : 64;
    const shortLine = straightLine(vw / 2 - logoW / 2, vw / 2 + logoW / 2, vh * 0.42, SIGNATURE_SEGMENTS);
    const slot = document.querySelector("[data-nav-logo]")?.getBoundingClientRect();
    const lx = slot ? slot.left : 16, ly = slot ? slot.top : 12, lw = slot ? slot.width : 40;
    const hair = mapPath(HAIR, (x, y) => [lx + (x / 800) * lw, ly + (y / 800) * lw]);
    const width = Math.max(4, Math.min(9, (7 * vw) / 1440));

    const q = <T extends Element>(sel: string) => el.querySelector(sel) as T;
    const qa = (sel: string) => Array.from(el.querySelectorAll(sel)) as SVGPathElement[];
    const segs = qa(".ink-seg");
    const full = q<SVGPathElement>(".ink-full");
    const spec = q<SVGPathElement>(".ink-spec");
    const gloss = q<SVGPathElement>(".ink-gloss");
    const glossGrad = q<SVGLinearGradientElement>("#ink-gloss-grad");
    const nib = q<SVGCircleElement>(".ink-nib");
    const fill = q<SVGPathElement>(".ink-fill");
    const fillMask = q<SVGCircleElement>(".ink-fill-mask");
    const baseGrad = q<SVGLinearGradientElement>("#ink-base-grad");

    for (const p of [...segs, full, spec, gloss]) p.setAttribute("d", word);
    segs.forEach((p, i) => p.setAttribute("stroke-width", String((PRESSURE[i] * width) / 7)));
    full.setAttribute("stroke-width", String(width));
    gloss.setAttribute("stroke-width", String(width + 0.5));
    baseGrad.setAttribute("x1", String(ox));
    baseGrad.setAttribute("x2", String(ox + wordW));
    glossGrad.setAttribute("x1", String(ox - wordW * 0.12));
    glossGrad.setAttribute("x2", String(ox));
    fill.setAttribute("d", hair);
    fillMask.setAttribute("cx", String(lx + lw * 0.49));
    fillMask.setAttribute("cy", String(ly + lw * 0.12));
    const len = full.getTotalLength();
    const [nx, ny] = toScreen(18, 168);
    nib.setAttribute("cx", String(nx));
    nib.setAttribute("cy", String(ny));
    nib.setAttribute("r", "4");

    gsap.set([...segs, spec], { drawSVG: "0% 0%", opacity: 0 });
    gsap.set([full, gloss], { opacity: 0 });

    let fontsReady = false;
    document.fonts?.ready.then(() => (fontsReady = true));
    // preload the first fixture while the ink writes
    fetch("/fixtures/run-001/run.placeholder.json").catch(() => {});

    const draw = { p: 0 };
    const tl = gsap.timeline({ onComplete: () => setActive(false) });
    tlRef.current = tl;
    tl.to(nib, { opacity: 1, duration: 0.15 }, 0)
      .to(draw, {
        p: 100, duration: 1.55, ease: "power2.inOut",
        onUpdate: () => {
          const p = draw.p;
          segs.forEach((seg, i) => {
            const a = i * 25 - (i ? 0.6 : 0);
            const b = Math.max(a, Math.min((i + 1) * 25 + 0.6, p));
            // a zero-length stroke still paints its round caps: keep unstarted segments hidden
            gsap.set(seg, { drawSVG: `${a}% ${b}%`, opacity: b - a > 0.05 ? 1 : 0 });
          });
          gsap.set(spec, { drawSVG: `0% ${p}%`, opacity: p > 0.5 ? 1 : 0 });
          const pt = full.getPointAtLength((len * p) / 100);
          nib.setAttribute("cx", pt.x.toFixed(1));
          nib.setAttribute("cy", pt.y.toFixed(1));
        },
      }, 0.15)
      .to(nib, { opacity: 0, duration: 0.15 }, 1.6)
      // gloss sweep: a bright diagonal band left → right; held (repeated) while fonts are still loading
      .set(gloss, { opacity: 1 }, 1.7)
      .fromTo(glossGrad, { attr: { gradientTransform: "translate(0 0)" } }, {
        attr: { gradientTransform: `translate(${wordW * 1.15} 0)` }, duration: 0.35, ease: "power1.inOut",
      }, 1.7)
      .add(() => {
        if (fontsReady) return;
        tl.pause();
        const hold = gsap.fromTo(glossGrad, { attr: { gradientTransform: "translate(0 0)" } }, {
          attr: { gradientTransform: `translate(${wordW * 1.15} 0)` }, duration: 0.35, repeat: -1, repeatDelay: 0.85,
        });
        const wait = () => (fontsReady ? (hold.kill(), tl.resume()) : setTimeout(wait, 100));
        wait();
      }, 2.05)
      // unravel: the stroke pulls taut into one horizontal thread
      .set([...segs, spec, gloss], { opacity: 0 }, 2.05)
      .set(full, { opacity: 1 }, 2.05)
      .to(full, { morphSVG: { shape: line, type: "linear" }, duration: 0.45, ease: "power3.in" }, 2.05)
      // shrink, rise to the logo slot, redraw as the bob outline
      .to(full, { morphSVG: { shape: shortLine, type: "linear" }, duration: 0.15, ease: "power2.out" }, 2.5)
      .to(full, { morphSVG: { shape: hair, type: "rotational" }, strokeWidth: 1.6, duration: 0.2, ease: "power2.inOut" }, 2.65)
      // fill from the crown, face appears, eyes blink open
      .to(fillMask, { attr: { r: lw * 1.2 }, duration: 0.15, ease: "power2.out" }, 2.85)
      .add(() => {
        document.documentElement.setAttribute("data-intro", "reveal");
        blinkAll();
      }, 2.85)
      .to(root.current, { backgroundColor: "rgba(0,0,0,0)", duration: 0.4, ease: "power1.out" }, 2.8)
      .add(finish, 3.0)
      .to(el, { opacity: 0, duration: 0.2 }, 3.0);
    if (mobile) tl.timeScale(3.2 / 2.6);

    const skipT = setTimeout(() => setShowSkip(true), 600);
    return () => {
      clearTimeout(skipT);
      tl.kill();
    };
  }, [active]);

  const skip = () => {
    tlRef.current?.kill();
    blinkAll();
    finish();
    setActive(false);
  };

  if (!active) return null;
  return (
    <div ref={root} className="ink-loader" aria-hidden="false">
      <svg ref={svg} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="ink-base-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">
            <stop offset="0" stopColor="#0a1317" />
            <stop offset="0.5" stopColor="#0457cb" />
            <stop offset="1" stopColor="#0a1317" />
          </linearGradient>
          <linearGradient id="ink-gloss-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="40">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id="ink-depth" x="-5%" y="-20%" width="110%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="0.6" result="d" />
            <feDropShadow in="d" dx="0" dy="1.5" stdDeviation="2" floodColor="#0a1317" floodOpacity="0.18" />
          </filter>
          <mask id="ink-crown">
            <circle className="ink-fill-mask" r="0" fill="#fff" />
          </mask>
        </defs>
        <g filter="url(#ink-depth)" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {PRESSURE.map((_, i) => <path key={i} className="ink-seg" stroke="url(#ink-base-grad)" />)}
          <path className="ink-full" stroke="url(#ink-base-grad)" />
          <path className="ink-spec" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" transform="translate(-0.8 -1)" />
          <path className="ink-gloss" stroke="url(#ink-gloss-grad)" />
        </g>
        <path className="ink-fill" fill="#0a1317" mask="url(#ink-crown)" />
        <circle className="ink-nib" r="4" fill="#0a1317" opacity="0" />
      </svg>
      {showSkip && (
        <button type="button" className="pill pill-ghost pill-sm ink-skip" onClick={skip}>
          Skip intro
        </button>
      )}
    </div>
  );
}
