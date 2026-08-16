#!/usr/bin/env node
// Addendum A Section G: no em dash (U+2014) in player-facing copy.
//
// Player-facing means string literals and JSX text. Comments are exempt, and
// the box-drawing rules used as section dividers are U+2500, a different
// character, so they are untouched by this gate.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findInCopy } from './lib/scan-code.mjs';

const EM_DASH = '—';

const TARGETS = [
  'src/lib/covidArena.ts',
  'src/lib/tipDefinitions.ts',
  'src/lib/dailyTape.ts',
  'src/lib/verdict.ts',
  'src/screens/',
];

function expand(target) {
  if (!target.endsWith('/')) return [target];
  const out = [];
  const walk = dir => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(p)) out.push(p);
    }
  };
  walk(target);
  return out.sort();
}

const files = TARGETS.flatMap(expand);
let violations = 0;

for (const file of files) {
  const hits = findInCopy(readFileSync(file, 'utf8'), EM_DASH);
  for (const hit of hits) {
    if (violations === 0) {
      console.error('em-dash-gate FAILED: em dash in player-facing copy.');
      console.error('Use a colon, comma, or period instead.\n');
    }
    violations++;
    console.error(`  ${file}:${hit.line}`);
    console.error(`    ${hit.text}`);
  }
}

if (violations > 0) {
  console.error(`\n${violations} violation(s) across ${files.length} scanned file(s).`);
  process.exit(1);
}

console.log(`em-dash-gate OK — ${files.length} file(s) scanned, no em dash in player-facing copy:`);
for (const t of TARGETS) console.log(`  ✓ ${t}`);
