"use client";
import { useSyncExternalStore } from "react";

export type ColorMode = "system" | "light" | "dark";
const KEY = "maya-theme";
const listeners = new Set<() => void>();

function read(): ColorMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "system";
}

export function setColorMode(mode: ColorMode) {
  try {
    if (mode === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {}
  apply(mode);
  listeners.forEach((l) => l());
}

export function apply(mode: ColorMode) {
  const el = document.documentElement;
  if (mode === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", mode);
}

/** Resolved light/dark, following the system unless the footer toggle overrides it. */
export function useResolvedMode(): "light" | "dark" {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const mq = matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", cb);
      return () => {
        listeners.delete(cb);
        mq.removeEventListener("change", cb);
      };
    },
    () => {
      const m = read();
      if (m !== "system") return m;
      return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    },
    () => "light",
  );
}
