import type { MayaEvent, MayaSource, Run } from "../contract";

export const PLACEHOLDER_RE = /\.placeholder\./;

/** Tracks whether any loaded file is a *.placeholder.* fixture, so the UI can show its chip. */
export const placeholderState = {
  loaded: new Set<string>(),
  listeners: new Set<() => void>(),
  mark(url: string) {
    if (!PLACEHOLDER_RE.test(url) || this.loaded.has(url)) return;
    this.loaded.add(url);
    this.listeners.forEach((l) => l());
  },
};

export function runUsesPlaceholders(run: Run): boolean {
  return PLACEHOLDER_RE.test(JSON.stringify(run));
}

/**
 * Reads /fixtures/<id>/run.json. Until the backend records a real run,
 * it falls back to /fixtures/<id>/run.placeholder.json.
 */
export function createFixtureSource(base = "/fixtures"): MayaSource {
  let listeners: ((e: MayaEvent) => void)[] = [];
  return {
    async loadRun(id) {
      const index = await fetch(`${base}/index.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null) as Record<string, string | null> | null;
      const names = index?.[id] ? [index[id]!] : ["run.json", "run.placeholder.json"];
      for (const name of names) {
        const url = `${base}/${id}/${name}`;
        const res = await fetch(url, { cache: "no-cache" }).catch(() => null);
        if (res?.ok && res.headers.get("content-type")?.includes("json")) {
          const run = (await res.json()) as Run;
          if (PLACEHOLDER_RE.test(url) || runUsesPlaceholders(run)) placeholderState.mark(url);
          return run;
        }
      }
      throw new Error(`Fixture ${id} not found`);
    },
    subscribe(onEvent) {
      listeners.push(onEvent);
      return () => {
        listeners = listeners.filter((l) => l !== onEvent);
      };
    },
  };
}
