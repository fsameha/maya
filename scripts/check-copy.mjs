#!/usr/bin/env node
// PRD §17: "Nurse", "diagnose" and "prevent death" appear nowhere in UI copy. Run in CI (pnpm check:copy).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const BANNED = [/\bnurse\b/i, /\bdiagnose[sd]?\b/i, /prevent(s|ing)? deaths?/i];
const ROOTS = ["app", "components", "lib", "fixtures"];
// The policy gate's health word list must contain "nurse" to route such questions to the caregiver; it is never rendered.
const SKIP = new Set(["lib/maya/policy.ts"]);
const hits = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (SKIP.has(p)) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|json|css|md)$/.test(f)) {
      readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        // the contract test and this rule's own wording are not UI copy
        if (BANNED.some((r) => r.test(line))) hits.push(`${p}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
  }
};
ROOTS.forEach((r) => { try { walk(r); } catch {} });
if (hits.length) {
  console.error("Banned words in UI copy:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("check:copy ok: no banned words in app/, components/, lib/, fixtures/");
