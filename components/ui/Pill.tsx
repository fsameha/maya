"use client";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { ArrowRight } from "lucide-react";
import { gazeProps } from "@/components/maya/gaze";
import { useReducedMotion } from "@/lib/reducedMotion";

type Variant = "primary" | "live" | "secondary" | "ghost";

interface PillProps {
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  size?: "md" | "sm";
  magnetic?: boolean;
  arrow?: boolean;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  external?: boolean;
}

const SPRING = { stiffness: 260, damping: 30 };

/** Pill button (PRD §3/§4): press scale 0.97, hover darken + arrow nudge, optional magnetic drift. */
export function Pill({ href, onClick, variant = "primary", size = "md", magnetic, arrow, children, className = "", ariaLabel, external }: PillProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const x = useSpring(useMotionValue(0), SPRING);
  const y = useSpring(useMotionValue(0), SPRING);
  const onMove = (e: React.PointerEvent) => {
    if (!magnetic || reduced || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    const k = Math.max(0, 1 - d / (Math.max(r.width, r.height) / 2 + 80));
    x.set((dx / (d || 1)) * 6 * k);
    y.set((dy / (d || 1)) * 6 * k);
  };
  const reset = () => (x.set(0), y.set(0));
  const cls = `pill ${variant === "primary" ? "" : `pill-${variant}`} ${size === "sm" ? "pill-sm" : ""} ${className}`;
  const inner = (
    <>
      {children}
      {arrow && <ArrowRight className="pill-arrow" size={size === "sm" ? 16 : 18} strokeWidth={1.75} aria-hidden />}
    </>
  );
  const g = gazeProps();
  const common = { className: cls, "aria-label": ariaLabel, ...g };
  return (
    <motion.span
      ref={ref}
      style={{ x, y, display: "inline-flex" }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", ...SPRING }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={magnetic ? "magnetic-zone" : undefined}
    >
      {href ? (
        external ? (
          <a href={href} target="_blank" rel="noreferrer" {...common}>{inner}</a>
        ) : (
          <Link href={href} {...common}>{inner}</Link>
        )
      ) : (
        <button type="button" onClick={onClick} {...common}>{inner}</button>
      )}
    </motion.span>
  );
}
