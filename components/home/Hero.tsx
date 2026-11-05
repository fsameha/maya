"use client";
import { useEffect, useRef, useState } from "react";
import { audioContext } from "@/lib/audio";
import { textDriver, type TimedDriver } from "@/lib/lipsync";
import { Maya } from "@/components/maya/Maya";
import { Pill } from "@/components/ui/Pill";
import { prefersReducedMotion } from "@/lib/reducedMotion";

export function Hero() {
  const glow = useRef<HTMLDivElement>(null);
  const [hi, setHi] = useState<{ key: number; speech: TimedDriver } | null>(null);
  // click Maya: she blinks and says "Hi, I'm Maya." (captioned; the phrase audio plays if it loads)
  const sayHi = () => {
    audioContext();
    const a = new Audio("/audio/phrases/hi-im-maya.placeholder.wav");
    void a.play().catch(() => {});
    const speech = textDriver("Hi, I'm Maya.", performance.now() + 60);
    setHi({ key: Date.now(), speech });
  };
  useEffect(() => {
    if (!hi) return;
    let raf = 0;
    const end = performance.now() + hi.speech.durationMs + 1400;
    const tick = (t: number) => (t < end ? (raf = requestAnimationFrame(tick)) : setHi(null));
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hi]);
  const zone = useRef<HTMLDivElement>(null);

  // soft blue glow follows the pointer with a 600ms lag
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0, tx = 0.5, ty = 0.5, x = 0.5, y = 0.5, last = performance.now();
    const onMove = (e: PointerEvent) => {
      const r = zone.current?.getBoundingClientRect();
      if (!r) return;
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
    };
    const tick = (t: number) => {
      const a = 1 - Math.exp(-(t - last) / 200);
      last = t;
      x += (tx - x) * a;
      y += (ty - y) * a;
      glow.current?.style.setProperty("transform", `translate(${((x - 0.5) * 120).toFixed(1)}px, ${((y - 0.5) * 120).toFixed(1)}px)`);
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <section className="relative overflow-x-clip" aria-labelledby="hero-title">
      <div className="wrap grid min-h-[calc(100svh-64px)] items-center gap-8 py-12 lg:grid-cols-[55fr_45fr] lg:gap-10">
        <div className="order-2 lg:order-1">
          <p className="t-eyebrow rise" style={{ ["--i" as string]: 0 }}>AI care companion · Built with Meta models</p>
          <h1 id="hero-title" className="t-display rise mt-4 max-w-[620px]" style={{ ["--i" as string]: 1 }}>
            Maya remembers, so they don&apos;t have to.
          </h1>
          <p className="t-lead rise mt-6 max-w-[540px]" style={{ ["--i" as string]: 2 }}>
            An AI care companion for older adults living with memory loss, and the families who look after them.
          </p>
          <div className="rise mt-8 flex flex-wrap gap-3" style={{ ["--i" as string]: 3 }}>
            <Pill href="/demo" magnetic arrow>Watch the demo</Pill>
            <Pill href="/try" variant="live" arrow>Try it with your camera</Pill>
          </div>
          <p className="t-caption rise mt-4" style={{ ["--i" as string]: 4 }}>2-minute story recorded from the real system · or try it with your own camera</p>
        </div>
        <div ref={zone} className="rise relative order-1 flex justify-center lg:order-2" style={{ ["--i" as string]: 2 }}>
          <div aria-hidden className="hero-grid absolute inset-[-10%]" />
          <div aria-hidden ref={glow} className="hero-glow absolute inset-0" />
          <div className="relative hidden sm:block"><Maya size={420} label="Maya, the companion, looking at you." onHi={sayHi} speech={hi?.speech ?? null} /></div>
          <div className="relative sm:hidden"><Maya size={240} onHi={sayHi} speech={hi?.speech ?? null} /></div>
          {hi && (
            <p key={hi.key} className="hi-caption absolute bottom-[6%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-[18px] font-medium" style={{ background: "var(--canvas)", boxShadow: "var(--shadow-bubble)", color: "var(--ink)" }} role="status">
              Hi, I&apos;m Maya.
            </p>
          )}
        </div>
      </div>
      <div aria-hidden className="scroll-cue absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 lg:flex">
        <span className="scroll-cue-line" />
        <span className="t-caption">Scroll</span>
      </div>
    </section>
  );
}
