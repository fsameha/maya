"use client";
import Link from "next/link";
import { ArrowRight, Camera, Clapperboard, Microscope } from "lucide-react";
import { gazeProps } from "@/components/maya/gaze";

const DOORS = [
  { href: "/demo", title: "Watch the story", meta: "2 min", body: "A recorded run of the real system, told across three screens.", Icon: Clapperboard, live: false },
  { href: "/try", title: "Try the guided replay", meta: "2 min", body: "Optional camera preview with example analysis. No live inference.", Icon: Camera, live: false },
  { href: "/demo#how", title: "Inspect how it works", meta: "for the curious", body: "Masks, memory rows, the policy gate and the proof.", Icon: Microscope, live: false },
];

export function Doors() {
  return (
    <section className="section" aria-labelledby="doors-title">
      <div className="wrap">
        <h2 id="doors-title" className="t-h2">Three ways in.</h2>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {DOORS.map(({ href, title, meta, body, Icon, live }) => (
            <li key={href}>
              <Link href={href} className="card card-hover door group flex h-full flex-col p-6" {...gazeProps()}>
                <span className={`inline-flex h-14 w-14 items-center justify-center rounded-full ${live ? "live-halo" : ""}`} style={{ background: live ? "var(--maya-blue-soft)" : "var(--surface)", color: live ? "var(--maya-blue)" : "var(--ink)" }}>
                  <Icon size={24} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="t-caption mt-8">{meta}</span>
                <span className="t-h3 mt-1 !text-[24px]">{title}</span>
                <span className="mt-2 flex-1" style={{ color: "var(--steel)" }}>{body}</span>
                <ArrowRight className="door-arrow mt-6" size={22} strokeWidth={1.75} aria-hidden style={{ color: "var(--ink)" }} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
