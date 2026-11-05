#!/usr/bin/env node
// Builds public/og.png (1200×630) from the mascot's own vector paths. Needs ImageMagick.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "components/maya/head.ts"), "utf8");
const get = (n) => src.match(new RegExp(`export const ${n} = ([^;]+);`))[1];
const ev = (expr) => Function(`return ${expr}`)();
const [HAIR, FACE, FRINGE, EARS, NOSE] = ["HAIR", "FACE", "FRINGE", "EARS", "NOSE"].map((n) => ev(get(n)));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#ffffff"/>
<g transform="translate(640 50) scale(0.66)">
<path d="${HAIR}" fill="#0a1317"/><path d="${FACE}" fill="#fff"/><path d="${FRINGE}" fill="#fff"/><path d="${EARS}" fill="#0a1317"/><path d="${NOSE}" fill="#0a1317"/>
<ellipse cx="325" cy="393.5" rx="18" ry="24.5" fill="#0a1317"/><ellipse cx="486" cy="395" rx="18" ry="24.5" fill="#0a1317"/>
<path d="M412.5 513C431 513 445.5 511 445.5 511C445.5 530 431 547 412.5 547C394 547 379.5 532 379.5 515Z" fill="#0a1317" stroke="#0a1317" stroke-width="6" stroke-linejoin="round"/>
</g>
<text x="80" y="250" font-family="Montserrat, Inter, sans-serif" font-size="92" font-weight="600" fill="#0a1317">Maya</text>
<text x="80" y="330" font-family="Montserrat, Inter, sans-serif" font-size="44" font-weight="500" fill="#0a1317">remembers, so they</text>
<text x="80" y="386" font-family="Montserrat, Inter, sans-serif" font-size="44" font-weight="500" fill="#0a1317">don't have to.</text>
<text x="80" y="470" font-family="Inter, sans-serif" font-size="26" fill="#5d6c7b">AI care companion · Built with Meta models</text>
<rect x="80" y="510" width="210" height="8" rx="4" fill="#0064e0"/>
</svg>`;
const tmp = join(root, ".og.svg");
writeFileSync(tmp, svg);
execFileSync("magick", [tmp, join(root, "public/og.png")]);
rmSync(tmp);
console.log("public/og.png written");
