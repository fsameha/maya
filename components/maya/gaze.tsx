"use client";
// Shared pointer + gaze-target store for every <Maya /> on the page.
// Hovering a CTA, pane or chip moves Maya's gaze to it (PRD §4, §6).
import { useEffect, type ReactNode } from "react";

interface GazeState {
  px: number;
  py: number;
  lastInput: number; // performance.now() of the last pointer/touch input
  hasPointer: boolean;
  target: Element | null;
  smileUntil: number;
  /** performance.now() at which every Maya should play a blink (the loader's eyes-open beat). */
  blinkAt: number;
}

export const gaze: GazeState = { px: 0, py: 0, lastInput: -1e9, hasPointer: false, target: null, smileUntil: 0, blinkAt: 0 };

export function setGazeTarget(el: Element | null) {
  gaze.target = el;
}

/** Every Maya on the page opens her eyes from closed (the blink curve from its closed key). */
export function blinkAll() {
  gaze.blinkAt = performance.now();
}

export function pulseSmile(ms = 300) {
  gaze.smileUntil = performance.now() + ms;
}

/** Spread onto any element Maya should glance at while it is hovered or focused. */
export function gazeProps() {
  return {
    onPointerEnter: (e: React.PointerEvent) => setGazeTarget(e.currentTarget),
    onPointerLeave: (e: React.PointerEvent) => {
      if (gaze.target === e.currentTarget) setGazeTarget(null);
    },
    onFocus: (e: React.FocusEvent) => setGazeTarget(e.currentTarget),
    onBlur: (e: React.FocusEvent) => {
      if (gaze.target === e.currentTarget) setGazeTarget(null);
    },
    onPointerDown: () => pulseSmile(),
  };
}

export function GazeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      gaze.px = e.clientX;
      gaze.py = e.clientY;
      gaze.lastInput = performance.now();
      gaze.hasPointer = true;
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      gaze.px = t.clientX;
      gaze.py = t.clientY;
      gaze.lastInput = performance.now();
      gaze.hasPointer = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);
  return <>{children}</>;
}
