"use client";
import { useEffect, useRef, useState } from "react";
import { Maya } from "@/components/maya/Maya";
import { Pill } from "@/components/ui/Pill";
import { PlaceholderChip } from "@/components/ui/PlaceholderChip";
import { getGsap } from "@/lib/gsap";
import { maskOutline } from "@/lib/maskContour";
import { getSource } from "@/lib/source";
import { runUsesPlaceholders } from "@/lib/source/fixture";
import { prefersReducedMotion } from "@/lib/reducedMotion";
import type { MayaEvent, Run, Sighting, Zone } from "@/lib/contract";
import { homeClock } from "@/lib/homeTime";

interface Teaser { video: string; at: number; frame: Run["frame"]; s: Sighting; zone: Zone; time: string; answer: string; placeholder: boolean }

/** Scroll-driven teaser (PRD §9): still → glasses mask draws on → zone → 10:42 → Maya answers. Real fixture data. */
export function MagicMoment() {
  const section = useRef<HTMLElement>(null);
  const outline = useRef<SVGPathElement>(null);
  const fill = useRef<SVGPathElement>(null);
  const [t, setT] = useState<Teaser | null>(null);
  const [d, setD] = useState("");
  const [p, setP] = useState(0);

  useEffect(() => {
    getSource("fixture").loadRun("run-001").then((run) => {
      const done = run.events.find((e): e is Extract<MayaEvent, { type: "perception.done" }> => e.type === "perception.done");
      const reply = run.events.find((e): e is Extract<MayaEvent, { type: "agent.reply" }> => e.type === "agent.reply");
      const clip = run.events.find((e): e is Extract<MayaEvent, { type: "capture.clip" }> => e.type === "capture.clip");
      const s = done?.sightings[0];
      if (!s || !reply || !clip) return;
      const zone = run.zones.find((z) => z.id === s.zoneId)!;
      const c = run.events.find((e): e is Extract<MayaEvent, { type: "capture.clip" }> => e.type === "capture.clip" && e.clipId === s.clipId) ?? clip;
      setT({ video: c.videoUrl, at: s.frame / c.fps, frame: run.frame, s, zone, time: reply.facts.time ?? homeClock(s.t), answer: reply.text, placeholder: runUsesPlaceholders(run) });
      maskOutline(s.maskUrl, run.frame).then(setD).catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!t || !d || !section.current) return;
    const { gsap, ScrollTrigger } = getGsap();
    if (prefersReducedMotion()) {
      setP(1);
      return;
    }
    gsap.set(outline.current, { drawSVG: "0%" });
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.4,
      onUpdate: (self) => {
        const v = self.progress;
        setP(v);
        gsap.set(outline.current, { drawSVG: `${Math.min(100, Math.max(0, (v - 0.12) / 0.2) * 100)}%` });
      },
    });
    return () => st.kill();
  }, [t, d]);

  const vis = (a: number) => ({ opacity: p >= a ? 1 : 0, transform: `translateY(${p >= a ? 0 : 8}px)` });
  const pts = t?.zone.polygon.map(([x, y]) => `${x},${y}`).join(" ");
  const speaking = p >= 0.62;
  const answerBubble = t ? (
                <div className="flex items-end gap-3 md:absolute md:bottom-4 md:left-4 md:max-w-[min(520px,80%)]" style={{ ...vis(0.58), transition: "all 420ms var(--ease-out)" }}>
      <span className="rounded-full p-1" style={{ background: "var(--canvas)" }}><Maya size={56} state={speaking ? "happy" : "idle"} interactive={false} /></span>
      <p className="rounded-[20px] px-4 py-3 text-[17px] font-medium md:text-[20px]" style={{ background: "var(--canvas)", boxShadow: "var(--shadow-bubble)", color: "var(--ink)" }} aria-live="polite">
        {speaking ? t.answer : "…"}
      </p>
    </div>
  ) : null;

  return (
    <section ref={section} className="magic relative" aria-labelledby="magic-title">
      <div className="sticky top-16 flex h-[calc(100svh-64px)] items-center">
        <div className="wrap w-full">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 id="magic-title" className="t-h2">Where did I put my glasses?</h2>
            {t?.placeholder && <PlaceholderChip />}
          </div>
          <div className="card card-surface relative overflow-hidden" style={{ aspectRatio: "16 / 9", maxHeight: "62svh" }}>
            {t && (
              <>
                <video
                  src={`${t.video}#t=${t.at.toFixed(2)}`} muted playsInline preload="metadata"
                  aria-label="The living room as the home camera saw it, at the moment the glasses were put down."
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <svg viewBox={`0 0 ${t.frame.w} ${t.frame.h}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
                  <polygon points={pts} fill="none" stroke="var(--hairline-strong)" strokeDasharray="10 8" strokeWidth="3" style={{ opacity: p > 0.36 ? 1 : 0, transition: "opacity 260ms" }} />
                  <path ref={fill} d={d} fill="var(--maya-blue)" style={{ fillOpacity: p > 0.32 ? 0.25 : 0, transition: "fill-opacity 180ms" }} />
                  <path ref={outline} d={d} fill="none" stroke="var(--maya-blue)" strokeWidth="4" strokeLinejoin="round" />
                </svg>
                <span className="chip chip-blue absolute" style={{ left: `${(t.s.box[0] / t.frame.w) * 100}%`, top: `calc(${(t.s.box[1] / t.frame.h) * 100}% - 40px)`, ...vis(0.34), transition: "all 260ms var(--ease-out)" }}>
                  glasses · conf {t.s.conf.toFixed(2)}
                </span>
                <span className="chip absolute" style={{ left: `${(t.zone.polygon[0][0] / t.frame.w) * 100}%`, top: `calc(${(t.zone.polygon[2][1] / t.frame.h) * 100}% + 8px)`, ...vis(0.42), transition: "all 260ms var(--ease-out)" }}>
                  {t.zone.name}
                </span>
                <span className="t-mono tnum absolute left-4 top-4 rounded-full px-3 py-1 text-[15px] font-semibold" style={{ background: "var(--glass)", color: "var(--ink)", ...vis(0.5), transition: "all 260ms var(--ease-out)" }}>
                  {t.time}
                </span>
                <div className="hidden md:block">{answerBubble}</div>
              </>
            )}
          </div>
          <div className="mt-4 md:hidden">{answerBubble}</div>
          <div className="mt-6 flex justify-center" style={vis(0.8)}>
            <Pill href="/demo" arrow>Watch the full story</Pill>
          </div>
        </div>
      </div>
    </section>
  );
}
