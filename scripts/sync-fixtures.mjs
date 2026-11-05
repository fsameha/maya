#!/usr/bin/env node
// /fixtures is the source of truth (the backend records into it); Next serves it from /public/fixtures.
import { cpSync, existsSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
rmSync(join(root, "public/fixtures"), { recursive: true, force: true });
// Analysis-only material (full-res SAM inputs, per-frame person JSON, kill test, per-clip benchmark renders) stays out of the deploy.
const SKIP = [/\.analysis\.mp4$/, /perception\/[^/]+\.json$/, /^killtest(\/|$)/, /benchmark\/grid\/[^/]+\.[^/]+\.mp4$/, /clips\/(glasses-opened|vitamin)\.mp4$/];
cpSync(join(root, "fixtures"), join(root, "public/fixtures"), {
  recursive: true,
  filter: (src) => !SKIP.some((r) => r.test(src.slice(join(root, "fixtures").length + 1))),
});

// index.json tells the fixture source which runs have a recorded run.json, so it never requests a missing file.
const index = {};
for (const id of readdirSync(join(root, "fixtures"))) {
  const dir = join(root, "fixtures", id);
  if (!statSync(dir).isDirectory()) continue;
  if (id === "benchmark") { index[id] = existsSync(join(dir, "metrics.json")) ? "metrics.json" : null; continue; }
  index[id] = existsSync(join(dir, "run.json")) ? "run.json" : existsSync(join(dir, "run.placeholder.json")) ? "run.placeholder.json" : null;
}
writeFileSync(join(root, "public/fixtures/index.json"), JSON.stringify(index, null, 1));
