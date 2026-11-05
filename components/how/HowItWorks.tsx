"use client";
// How it works (PRD §11): a sticky rail and 10 scroll-scrubbed "glass box" stages, all on the same run as Watch.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePlayerCtx } from "@/lib/PlayerProvider";
import { getGsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/reducedMotion";
import { useLenis, scrollToId } from "@/lib/lenis";
import { PlaceholderChip } from "@/components/ui/PlaceholderChip";
import { REPO_URL } from "@/components/site/Nav";
import type { Run } from "@/lib/contract";
import { JsonViewer } from "./JsonViewer";
import { STAGE_DEFS } from "./stages";

export const STAGES = STAGE_DEFS.map((s) => s.title);

export function HowItWorks() {
  const { run, placeholder } = usePlayerCtx();
  const [active, setActive] = useState(1);
  const root = useRef<HTMLElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  // land on #how-stage-N when arriving from Watch or a deep link
  useEffect(() => {
    if (!run) return;
    const m = location.hash.match(/^#how(?:-stage-(\d+)|-(\w+))?$/);
    if (!m) return;
    const n = m[1] ? +m[1] : m[2] ? STAGE_DEFS.findIndex((s) => s.slug === m[2]) + 1 : 0;
    const id = n > 0 ? `how-stage-${n}` : "how";
    requestAnimationFrame(() => scrollToId(lenis, id));
  }, [run, lenis]);

  // rail: progress line fills with scroll; the stage in view becomes active
  useEffect(() => {
    if (!run || !root.current) return;
    const { ScrollTrigger, gsap } = getGsap();
    const st = ScrollTrigger.create({
      trigger: root.current, start: "top 64px", end: "bottom bottom",
      onUpdate: (s) => fill.current && gsap.set(fill.current, { scaleY: s.progress }),
    });
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(+(e.target as HTMLElement).dataset.stage!)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    root.current.querySelectorAll("[data-stage]").forEach((el) => io.observe(el));
    return () => {
      st.kill();
      io.disconnect();
    };
  }, [run]);

  return (
    <section id="how" ref={root} className="border-t pb-24 pt-16 md:pt-24" style={{ borderColor: "var(--hairline)" }} aria-labelledby="how-title">
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="t-eyebrow">How it works</p>
            <h2 id="how-title" className="t-h2 mt-2 max-w-[760px]">The models perceive and phrase. Our code decides.</h2>
            <p className="t-lead mt-3 max-w-[640px]" style={{ color: "var(--steel)" }}>The same recorded run as the story above: the glasses you just watched are these masks, rows and log lines.</p>
          </div>
          {placeholder && <PlaceholderChip />}
        </div>
      </div>

      {/* mobile: chip bar */}
      <nav className="glass sticky top-16 z-20 mt-8 border-y lg:hidden" style={{ borderColor: "var(--hairline)" }} aria-label="Stages">
        <ol className="wrap flex gap-2 overflow-x-auto py-2">
          {STAGE_DEFS.map((s, i) => (
            <li key={s.slug}>
              <a href={`#how-stage-${i + 1}`} onClick={(e) => { e.preventDefault(); scrollToId(lenis, `how-stage-${i + 1}`); }} className={`chip h-9 ${active === i + 1 ? "chip-blue" : ""}`}>{i + 1}. {s.short}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="wrap mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
        <nav className="hidden lg:block" aria-label="Stages">
          <div className="glass sticky top-24 rounded-[24px] border p-4" style={{ borderColor: "var(--hairline)" }}>
            <div className="relative pl-5">
              <div className="absolute bottom-1 left-[5px] top-1 w-[2px] rounded-full" style={{ background: "var(--hairline)" }} />
              <div ref={fill} className="absolute bottom-1 left-[5px] top-1 w-[2px] origin-top rounded-full" style={{ background: "var(--maya-blue)", transform: "scaleY(0)" }} />
              <ol className="flex flex-col gap-1">
                {STAGE_DEFS.map((s, i) => (
                  <li key={s.slug}>
                    <a
                      href={`#how-stage-${i + 1}`} onClick={(e) => { e.preventDefault(); scrollToId(lenis, `how-stage-${i + 1}`); }}
                      className="block rounded-[10px] py-1.5 text-[14px] font-medium transition-colors duration-200"
                      style={{ color: active === i + 1 ? "var(--ink)" : "var(--steel)" }}
                      aria-current={active === i + 1 ? "step" : undefined}
                    >
                      <span className="tnum mr-2">{i + 1}</span>{s.short}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </nav>

        <ol className="flex min-w-0 flex-col gap-8 lg:gap-0">
          {STAGE_DEFS.map((s, i) => (
            <li key={s.slug} id={`how-stage-${i + 1}`} data-stage={i + 1} className="min-w-0 scroll-mt-28">
              <span id={`how-${s.slug}`} className="block" aria-hidden />
              {run ? <Stage n={i + 1} def={s} run={run} /> : <div className="card card-surface h-[60vh]" />}
            </li>
          ))}
        </ol>
      </div>

      <div className="wrap mt-16">
        <BenchmarkTeaser />
      </div>
    </section>
  );
}

function Stage({ n, def, run }: { n: number; def: (typeof STAGE_DEFS)[number]; run: Run }) {
  const outer = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [raw, setRaw] = useState(false);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const { gsap, ScrollTrigger } = getGsap();
    if (prefersReducedMotion()) {
      setP(1);
      return;
    }
    const desktop = matchMedia("(min-width: 1024px)").matches;
    if (desktop) {
      // pinned glass box: the stage scrubs while its card is held on screen
      const st = ScrollTrigger.create({ trigger: el, start: "top 96px", end: "bottom bottom", scrub: 0.3, onUpdate: (s) => setP(s.progress) });
      return () => st.kill();
    }
    // mobile: unpinned, plays as it enters view
    const o = { v: 0 };
    const st = ScrollTrigger.create({
      trigger: el, start: "top 75%", once: true,
      onEnter: () => gsap.to(o, { v: 1, duration: 1.6, ease: "power2.out", onUpdate: () => setP(o.v) }),
    });
    return () => st.kill();
  }, []);

  const Visual = def.Visual;
  return (
    <div ref={outer} className="stage-outer">
      <article className="stage-card card glass flex min-w-0 flex-col p-5 md:p-8" aria-labelledby={`stage-${n}-title`}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[640px]">
            <p className="t-caption tnum">Stage {n}</p>
            <h3 id={`stage-${n}-title`} className="t-h3 mt-1">{def.title}</h3>
            <p className="mt-2" style={{ color: "var(--steel)" }}>{def.summary}</p>
          </div>
          {def.simulated && <span className="chip chip-attention">Simulated</span>}
        </header>
        <div className="stage-visual mt-6 min-w-0 flex-1">
          <Visual run={run} p={p} />
        </div>
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--hairline)" }}>
          <p className="t-caption max-w-[560px]"><strong style={{ color: "var(--ink)" }}>Model vs our code:</strong> {def.split}</p>
          <div className="flex items-center gap-2">
            <a className="pill pill-ghost pill-sm" href={`${REPO_URL}${def.code}`} target="_blank" rel="noreferrer">See the code <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden /></a>
            <button type="button" className="pill pill-ghost pill-sm" aria-expanded={raw} onClick={() => setRaw((r) => !r)}>Raw data</button>
          </div>
        </footer>
        {raw && <div className="mt-4"><JsonViewer value={def.raw(run)} /></div>}
      </article>
    </div>
  );
}

function BenchmarkTeaser() {
  const models = ["YOLO11", "RT-DETR", "Grounding DINO", "SAM 3.1"];
  return (
    <div className="card p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="t-eyebrow">Benchmark</p>
          <h3 className="t-h3 mt-1">Same kitchen clip, four detectors.</h3>
        </div>
        <PlaceholderChip />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {models.map((m) => (
          <div key={m} className="relative flex items-center justify-center rounded-[16px]" style={{ background: "var(--surface)", aspectRatio: "16 / 9" }}>
            <span className="chip absolute left-2 top-2 !h-6 !text-[12px]">{m}</span>
            <span className="t-caption">Overlay video from the offline benchmark</span>
          </div>
        ))}
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {["Recall @ IoU 0.5, glasses", "ID switches per 10s clip", "Latency per clip"].map((l) => (
          <div key={l}><dt className="t-caption">{l}</dt><dd className="display tnum mt-1 text-[32px] font-semibold" style={{ color: "var(--ink)" }}>—</dd></div>
        ))}
      </dl>
      <Link href="/proof" className="pill mt-6">See the full proof <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden /></Link>
    </div>
  );
}

export function Frame({ run, children, className = "" }: { run: Run; children?: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[16px] ${className}`} style={{ aspectRatio: `${run.frame.w} / ${run.frame.h}`, background: "var(--surface)" }}>
      {children}
    </div>
  );
}
