"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Maya } from "@/components/maya/Maya";
import { gazeProps } from "@/components/maya/gaze";

export const NAV_LINKS = [
  { href: "/demo", label: "Story" },
  { href: "/demo#how", label: "How it works" },
  { href: "/try", label: "Try" },
  { href: "/proof", label: "Proof" },
  { href: "/trust", label: "Trust" },
];

export const REPO_URL = "https://github.com/fsameha/maya";

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <header className="glass sticky top-0 z-40 border-b" style={{ borderColor: "var(--hairline)", height: 64 }}>
      <nav className="wrap flex h-16 items-center justify-between gap-4" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 rounded-full pr-2" aria-label="Maya, home">
          <span id="nav-logo-slot" data-nav-logo>
            <Maya size={40} interactive={false} />
          </span>
          <span className="display text-[20px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>Maya</span>
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => {
            const active = l.href === path || (l.href === "/demo" && path === "/demo");
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="rounded-full px-3 py-2 text-[15px] font-medium transition-colors"
                  style={{ color: active ? "var(--ink)" : "var(--steel)" }}
                  {...gazeProps()}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2">
          <a
            href={REPO_URL} target="_blank" rel="noreferrer"
            className="hidden h-11 w-11 items-center justify-center rounded-full sm:inline-flex"
            aria-label="GitHub repository" style={{ color: "var(--ink)" }}
          >
            <GithubMark />
          </a>
          <Link href="/demo" className="pill pill-sm hidden sm:inline-flex" {...gazeProps()}>
            Watch the demo <ArrowRight className="pill-arrow" size={16} strokeWidth={1.75} />
          </Link>
          <button
            type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}
            style={{ color: "var(--ink)" }}
          >
            {open ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-x-0 bottom-0 top-16 z-40 lg:hidden"
            style={{ background: "var(--canvas)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <ul className="wrap flex flex-col gap-2 pt-8">
              {[{ href: "/", label: "Home" }, ...NAV_LINKS].map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link href={l.href} className="t-h2 block py-2" onClick={() => setOpen(false)}>{l.label}</Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function GithubMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

