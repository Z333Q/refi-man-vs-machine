#!/usr/bin/env node
// Benchmark provenance gate — USA Build Integration Spec §3.4 gate 2.
//
// CLAUDE.md rule 14: never hard-code benchmark claims into UI copy; all
// benchmark numerals must originate from a versioned BenchmarkSnapshot
// record. This gate forbids literal percent-formatted numbers in the
// benchmark and ladder screen components — a hard-coded `12.4%` fails,
// while `fmtPct(snapshot.stats.cagr)` (which emits `${...}%`, no digit
// before the percent sign in source) passes.
//
// Scope = benchmark/ladder components: any file importing the
// BenchmarkSnapshot type (auto-detect) plus the explicit registry below.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');

// Explicit registry of benchmark/ladder screens whose numerals must come
// from BenchmarkSnapshot records even if they don't import the type
// directly. Extend as the benchmark layer lands (G3/G4).
const BENCHMARK_COMPONENTS = [
  'src/screens/MachineLadderScreen.tsx',
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// Strip the substrings where a literal percent is legitimate (Tailwind /
// CSS values in className / style, and comments) before scanning JSX/text
// for hard-coded performance numerals.
function stripNoise(line) {
  return line
    .replace(/\/\/.*$/, '')
    .replace(/className=\{`[^`]*`\}/g, '')
    .replace(/className="[^"]*"/g, '')
    .replace(/className=\{[^}]*\}/g, '')
    .replace(/style=\{\{[^}]*\}\}/g, '');
}

// Scope = benchmark/ladder render components (src/screens, src/components
// `.tsx`) that surface benchmark stats. Lib modules that define the type
// or hold snapshot data are out of scope for this UI-copy gate.
const scope = new Set(BENCHMARK_COMPONENTS);
for (const abs of walk(SRC)) {
  const rel = relative(ROOT, abs).split('\\').join('/');
  const isComponent = /\.tsx$/.test(rel) &&
    (rel.startsWith('src/screens/') || rel.startsWith('src/components/'));
  if (!isComponent) continue;
  if (/\bBenchmarkSnapshot\b/.test(readFileSync(abs, 'utf8'))) scope.add(rel);
}

// A digit immediately followed by `%` (optionally with decimals) is a
// hard-coded percent literal. `${expr}%` from a formatter has `}` before
// the `%`, so it is not flagged.
const PERCENT_LITERAL = /\d(?:\.\d+)?\s*%/;

const violations = [];
for (const rel of [...scope].sort()) {
  const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n');
  let inBlockComment = false;
  lines.forEach((raw, i) => {
    let line = raw;
    if (inBlockComment) {
      if (line.includes('*/')) { line = line.slice(line.indexOf('*/') + 2); inBlockComment = false; }
      else return;
    }
    if (line.includes('/*')) {
      const after = line.slice(line.indexOf('/*'));
      if (!after.includes('*/')) inBlockComment = true;
      line = line.slice(0, line.indexOf('/*'));
    }
    const cleaned = stripNoise(line);
    if (PERCENT_LITERAL.test(cleaned)) {
      violations.push(`${rel}:${i + 1}: hard-coded percent literal — ${raw.trim()}`);
    }
  });
}

if (violations.length) {
  console.error('provenance-gate FAILED (§3.4 gate 2): benchmark numerals must come from BenchmarkSnapshot, not UI copy.');
  for (const v of violations) console.error('  ✗ ' + v);
  process.exit(1);
}

console.log(`provenance-gate OK — no hard-coded percent literals in ${scope.size} benchmark/ladder component(s):`);
for (const rel of [...scope].sort()) console.log('  ✓ ' + rel);
