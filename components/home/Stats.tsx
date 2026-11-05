import { StatCounter } from "@/components/ui/StatCounter";
import { ArrowUpRight } from "lucide-react";

const STATS = [
  { value: 5.84, decimals: 2, suffix: " M", label: "people with dementia in Japan by 2040", source: "MHLW research team, 2024", href: "https://japantimes.co.jp/news/2024/05/08/japan/science-health/2040-japan-dementia-estimate" },
  { value: 570000, decimals: 0, suffix: "", label: "care workers short by 2040", source: "MHLW, 2024", href: "https://www.mhlw.go.jp/content/001279920.pdf" },
  { value: 76020, decimals: 0, suffix: "", label: "people died alone at home in 2024", source: "National Police Agency, 2025", href: "https://morungexpress.com/over-76000-people-died-alone-in-japan-in-2024" },
];

export function Stats() {
  return (
    <section className="section border-t" style={{ borderColor: "var(--hairline)" }} aria-labelledby="stats-title">
      <div className="wrap">
        <h2 id="stats-title" className="t-h3 max-w-[640px]">Japan is where every country is heading.</h2>
        <dl className="mt-12 grid gap-10 md:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <StatCounter value={s.value} decimals={s.decimals} suffix={s.suffix} className="display block text-[44px] font-semibold leading-none md:text-[56px]" />
                <p className="mt-3 text-[17px]" style={{ color: "var(--steel)" }}>{s.label}</p>
                <a href={s.href} target="_blank" rel="noreferrer" className="t-caption mt-2 inline-flex min-h-11 items-center gap-1 hover:underline">
                  {s.source} <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
