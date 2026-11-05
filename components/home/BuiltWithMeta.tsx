"use client";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { gazeProps } from "@/components/maya/gaze";

const CHIPS = [
  { name: "SAM 3.1", job: "SAM 3.1: finds and outlines the object in every frame" },
  { name: "Muse Spark", job: "Muse Spark: understands the question and words the answer" },
  { name: "Muse Voice Transcribe", job: "Muse Voice Transcribe: turns speech into text" },
  { name: "Astryx design system", job: "Astryx: Meta's open-source design system, used for every screen" },
];

export function BuiltWithMeta() {
  return (
    <section className="border-t py-16" style={{ borderColor: "var(--hairline)" }} aria-labelledby="meta-title">
      <div className="wrap flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
        <h2 id="meta-title" className="t-caption !text-[15px]">Built with Meta</h2>
        <ul className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <li key={c.name}>
              <Tooltip content={c.job} touchTrigger="tap">
                <button type="button" className="chip h-11 px-4 text-[14px]" {...gazeProps()}>{c.name}</button>
              </Tooltip>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
