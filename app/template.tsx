"use client";
import { useEffect } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/reducedMotion";

// The first page paints server-rendered and fully visible (for LCP); only client navigations animate.
let navigated = false;

/** Page transitions: cross-fade plus a 12px rise, 260ms (PRD §4). */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const animate = navigated && !reduced;
  useEffect(() => {
    navigated = true;
  }, []);
  return (
    <motion.div initial={animate ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
