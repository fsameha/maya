"use client";
import Lenis from "lenis";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getGsap } from "./gsap";
import { prefersReducedMotion } from "./reducedMotion";

const LenisContext = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisContext);

/** Smooth scroll kept in sync with ScrollTrigger (PRD §4). Off under reduced motion. */
export function LenisProvider({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const { gsap, ScrollTrigger } = getGsap();
    const l = new Lenis({ duration: 1.05, easing: (t) => 1 - Math.pow(1 - t, 3), anchors: true });
    l.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => l.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    setLenis(l);
    return () => {
      gsap.ticker.remove(tick);
      l.destroy();
    };
  }, []);
  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}

export function scrollToId(lenis: Lenis | null, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) {
    // layout below can still settle while we scroll (media metadata, fonts): re-aim once on arrival
    lenis.scrollTo(el, {
      offset: -64,
      onComplete: () => {
        if (Math.abs(el.getBoundingClientRect().top - 64) > 8) lenis.scrollTo(el, { offset: -64, duration: 0.5 });
      },
    });
  }
  else el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}
