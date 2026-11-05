"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { prefersReducedMotion } from "@/lib/reducedMotion";

/** Counts from 0 over 1.2s with ease-out, tabular numerals, once per view (PRD §4). */
export function StatCounter({ value, decimals = 0, suffix = "", className = "" }: { value: number; decimals?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) return setN(value);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const u = Math.min(1, (t - t0) / 1200);
      setN(value * (1 - Math.pow(1 - u, 3)));
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  const text = n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const final = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className={`tnum ${className}`}>
      <span aria-hidden>{text}{suffix}</span>
      <span className="visually-hidden">{final}{suffix}</span>
    </span>
  );
}
