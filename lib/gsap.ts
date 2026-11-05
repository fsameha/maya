"use client";
// GSAP plugins are registered once, here (PRD §15).
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;
export function getGsap() {
  if (!registered && typeof window !== "undefined") {
    gsap.registerPlugin(DrawSVGPlugin, MorphSVGPlugin, ScrollTrigger);
    registered = true;
  }
  return { gsap, DrawSVGPlugin, MorphSVGPlugin, ScrollTrigger };
}
