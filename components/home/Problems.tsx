"use client";
import { gazeProps } from "@/components/maya/gaze";

const CARDS = [
  { title: "Lost things, every day.", body: "Glasses, keys, the pill bottle. Each search costs a call to the family.", answer: "Maya remembers where things were last seen.", art: "mask" },
  { title: "Families can't always be there.", body: "Calls, worry, long trips.", answer: "Yuki sees a calm daily rhythm, not a camera feed.", art: "rhythm" },
  { title: "Cameras feel like surveillance.", body: "", answer: "Maya keeps objects, not people. No live feed, ever.", art: "blur" },
] as const;

export function Problems() {
  return (
    <section className="section" aria-labelledby="problems-title">
      <div className="wrap">
        <h2 id="problems-title" className="t-h2 max-w-[720px]">Small worries, every day. Maya takes the weight.</h2>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {CARDS.map((c) => (
            <li key={c.title} className="card card-hover problem-card group flex flex-col overflow-hidden p-6" tabIndex={0} {...gazeProps()}>
              <div className="card-surface flex h-40 items-center justify-center rounded-[16px]" style={{ background: "var(--surface)" }} aria-hidden>
                {c.art === "mask" && <MaskArt />}
                {c.art === "rhythm" && <RhythmArt />}
                {c.art === "blur" && <BlurArt />}
              </div>
              <h3 className="t-h3 mt-6 !text-[22px]">{c.title}</h3>
              {c.body && <p className="mt-2" style={{ color: "var(--steel)" }}>{c.body}</p>}
              <p className="problem-answer mt-3 font-medium" style={{ color: "var(--ink)" }}>{c.answer}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MaskArt() {
  return (
    <svg width="180" height="90" viewBox="0 0 180 90">
      <g fill="none" stroke="var(--ink)" strokeWidth="4"><ellipse cx="62" cy="45" rx="22" ry="14" /><ellipse cx="118" cy="45" rx="22" ry="14" /><path d="M84 43q6-6 12 0" /></g>
      <path className="art-mask" d="M36 45c0-13 12-21 26-21s22 6 26 13h4c4-7 12-13 26-13s26 8 26 21-12 21-26 21-24-9-26-18h-4c-2 9-12 18-26 18S36 58 36 45Z" fill="var(--maya-blue)" fillOpacity="0.25" stroke="var(--maya-blue)" strokeWidth="2.5" />
    </svg>
  );
}
function RhythmArt() {
  const bars = [0.2, 0.5, 0.9, 0.6, 0.3, 0.7, 0.4, 0.8, 0.5, 0.3, 0.6, 0.2];
  return (
    <svg width="200" height="80" viewBox="0 0 200 80">
      {bars.map((h, i) => (
        <rect key={i} className="art-bar" style={{ animationDelay: `${i * 80}ms` }} x={8 + i * 16} y={70 - h * 60} width="9" height={h * 60} rx="4.5" fill={i === 2 || i === 7 ? "var(--maya-blue)" : "var(--hairline-strong)"} />
      ))}
    </svg>
  );
}
function BlurArt() {
  return (
    <svg width="120" height="110" viewBox="0 0 120 110">
      <defs><filter id="art-blur"><feGaussianBlur stdDeviation="0"><animate attributeName="stdDeviation" values="0;7;7;0" dur="4s" repeatCount="indefinite" /></feGaussianBlur></filter></defs>
      <g filter="url(#art-blur)" fill="var(--steel)"><circle cx="60" cy="30" r="16" /><rect x="38" y="50" width="44" height="54" rx="20" /></g>
    </svg>
  );
}
