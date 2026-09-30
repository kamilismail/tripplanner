// Hardcoded-value scan from the /10x-ui skill: literal colours, arbitrary px/rem values and Tailwind palette classes.
// Zero dependencies on purpose. Usage: node scripts/check-ui-literals.mjs [files...]
// Prints `file:line: match` per offending line and exits 1 if any line matches, 2 on a missing or unreadable file.
// Never scans the token source.
// Known gaps (the regex mirrors the skill on purpose): ring-offset-/placeholder-/caret-/accent-/decoration- palette
// classes and arbitrary values in units other than px/rem are not caught; `#abc` in URLs may be a false positive.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TOKEN_SOURCE = "src/styles/global.css";
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const PATTERN = new RegExp(
  [
    String.raw`#[0-9a-fA-F]{3,8}\b`,
    String.raw`rgba?\(`,
    String.raw`hsla?\(`,
    String.raw`oklch\(`,
    String.raw`-\[[0-9.]+(px|rem)\]`,
    String.raw`\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(${PALETTE})\b`,
  ].join("|"),
  "g",
);

function defaultFiles() {
  const tripsDir = "src/components/trips";
  const tripComponents = existsSync(tripsDir)
    ? readdirSync(tripsDir)
        .filter((name) => name.endsWith(".tsx"))
        .map((name) => join(tripsDir, name).replaceAll("\\", "/"))
    : [];
  return ["src/pages/trips.astro", "src/layouts/AppLayout.astro", "src/components/AppHeader.astro", ...tripComponents];
}

const args = process.argv.slice(2).map((file) => file.replaceAll("\\", "/"));
const missing = args.filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`Missing file(s): ${missing.join(", ")}`);
  process.exit(2);
}
// Default files that do not exist yet are skipped; explicit arguments must exist.
const files = (args.length ? args : defaultFiles().filter((file) => existsSync(file))).filter(
  (file) => !file.endsWith(TOKEN_SOURCE),
);

let hits = 0;
for (const file of files) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch (error) {
    console.error(`Cannot read ${file}: ${error.message}`);
    process.exit(2);
  }
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const matches = [...line.matchAll(PATTERN)].map((m) => m[0]);
    if (!matches.length) return;
    hits++;
    console.log(`${file}:${index + 1}: ${matches.join(", ")}`);
  });
}

console.log(hits ? `\n${hits} line(s) with hardcoded UI values` : "\nNo hardcoded UI values found");
process.exit(hits ? 1 : 0);
