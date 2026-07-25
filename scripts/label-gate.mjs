#!/usr/bin/env node
// Result-category label gate — USA Build Integration Spec §3.4 gate 1.
//
// "A performance visual without a category label fails CI." Every
// performance / chart component must render exactly one of the §62
// result categories (see src/lib/resultCategories.ts) so a historical
// simulation can never be mistaken for live client performance.
//
// A file is treated as a performance component if EITHER:
//   1. it imports `BenchmarkSnapshot` from the game types (auto-detect —
//      any component that renders benchmark stats), or
//   2. it is named in PERFORMANCE_COMPONENTS below (explicit registry
//      for result screens that show performance without the benchmark
//      type, e.g. the human-vs-machine score table).
//
// The registry is explicit on purpose: the gate must fail loudly when a
// new performance screen lands unregistered, rather than silently pass.
// When a new performance/chart screen is added, register it here (or let
// the BenchmarkSnapshot import auto-detect it) and give it a label.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');

// Explicit registry: performance components that don't import the
// benchmark type but still show performance numbers.
const PERFORMANCE_COMPONENTS = [
  'src/screens/CheckpointScoreScreen.tsx',
];

// Files that DEFINE the label machinery — never treated as consumers.
const EXCLUDE = new Set([
  'src/lib/resultCategories.ts',
  'src/components/ResultCategoryLabel.tsx',
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// Valid category keys come straight from resultCategories.ts so the gate
// and the source of truth can never drift.
function validCategoryKeys() {
  const src = readFileSync(join(SRC, 'lib/resultCategories.ts'), 'utf8');
  const body = src.slice(src.indexOf('RESULT_CATEGORY'));
  const keys = new Set();
  for (const m of body.matchAll(/^\s*([A-Z0-9_]+):/gm)) keys.add(m[1]);
  return keys;
}

const validKeys = validCategoryKeys();
if (validKeys.size !== 4) {
  console.error(`label-gate: expected 4 result categories, found ${validKeys.size}. Check src/lib/resultCategories.ts.`);
  process.exit(1);
}

// Auto-detect is scoped to render components (src/screens, src/components
// `.tsx`). A lib module that merely defines or holds the BenchmarkSnapshot
// type is not a chart — only components that render one need a label.
const files = walk(SRC);
const perfComponents = new Set(PERFORMANCE_COMPONENTS);
for (const abs of files) {
  const rel = relative(ROOT, abs).split('\\').join('/');
  if (EXCLUDE.has(rel)) continue;
  const isComponent = /\.tsx$/.test(rel) &&
    (rel.startsWith('src/screens/') || rel.startsWith('src/components/'));
  if (!isComponent) continue;
  if (/\bBenchmarkSnapshot\b/.test(readFileSync(abs, 'utf8'))) perfComponents.add(rel);
}

const errors = [];
const covered = [];
for (const rel of [...perfComponents].sort()) {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  // A category label is a `category="KEY"` JSX prop (on ResultCategoryLabel
  // or a wrapper that forwards it, e.g. BenchmarkCard) or a direct
  // RESULT_CATEGORY.KEY reference. The `category="..."` prop form is only
  // used for result categories in this codebase — data uses `category:`.
  const used = new Set();
  for (const m of text.matchAll(/category="([A-Z0-9_]+)"/g)) used.add(m[1]);
  for (const m of text.matchAll(/RESULT_CATEGORY\.([A-Z0-9_]+)/g)) used.add(m[1]);

  const unknown = [...used].filter(k => !validKeys.has(k));
  if (unknown.length) {
    errors.push(`${rel}: unknown result category ${unknown.join(', ')} (not in resultCategories.ts)`);
    continue;
  }
  // §3.4: each chart/visual carries exactly one category. A screen that
  // aggregates several charts (e.g. model + paper + market) therefore
  // carries several labels — all we require here is that a performance
  // component is never unlabeled and never uses an invalid category.
  if (used.size === 0) {
    errors.push(`${rel}: performance component renders no §62 category label`);
  } else {
    covered.push(`${rel} → ${[...used].sort().join(', ')}`);
  }
}

if (errors.length) {
  console.error('label-gate FAILED (§3.4 gate 1):');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

console.log(`label-gate OK — ${covered.length} performance component(s) carry a valid §62 category label:`);
for (const c of covered) console.log('  ✓ ' + c);
