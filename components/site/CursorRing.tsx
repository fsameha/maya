"use client";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/reducedMotion";

/** Over live elements (.live-halo, .pill-live), a 28px blue ring follows with a 90ms lag. Hidden on touch and reduced motion. */
export function CursorRing() {
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefersReducedMotion() || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let x = -100, y = -100, tx = -100, ty = -100, on = false, last = performance.now(), raf = 0;
    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      on = !!(e.target as Element | null)?.closest?.(".live-halo, .pill-live");
    };
    const tick = (now: number) => {
      const a = 1 - Math.exp(-(now - last) / 90);
      last = now;
      x += (tx - x) * a;
      y += (ty - y) * a;
      const el = ring.current;
      if (el) {
        el.style.transform = `translate(${x - 14}px, ${y - 14}px) scale(${on ? 1 : 0.4})`;
        el.style.opacity = on ? "1" : "0";
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
    };
  }, []);
  return <div ref={ring} aria-hidden className="cursor-ring" />;
}
