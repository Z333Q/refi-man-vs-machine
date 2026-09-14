#!/usr/bin/env node
// ─── Game core boundary gate ──────────────────────────────────────────────────
//
// packages/game-core holds the rules and nothing else. It exists so a
// server-side verifier can recompute a ranked attempt without trusting the
// browser that played it (REFI_ALPHA_GROWTH_ARCHITECTURE.md §6), and that only
// works while the package stays runnable outside a browser and deterministic
// inside one.
//
// Both properties fail quietly. An import of a storage helper that is only
// reached on one code path still runs fine in the app and crashes in Node the
// first time a season is verified. A Date.now() in a scoring tiebreak still
// passes every unit test and makes two replays of the same run disagree. So
// the boundary is a build failure rather than a review convention.
//
// Three rules:
//   1. nothing in the package imports anything outside it;
//   2. nothing in it touches a framework, the environment, or I/O;
//   3. nothing in it reads a clock or a random source;
// plus: the compatibility shims in src/lib re-export and never reimplement, so
// there is exactly one copy of every rule.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, CODE, COMMENT } from './lib/scan-code.mjs';

// fileURLToPath, not .pathname: this checkout lives under a path with spaces.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACKAGE = join(ROOT, 'packages', 'game-core');
const PACKAGE_SRC = join(PACKAGE, 'src');

/**
 * Source with comments blanked and line numbers intact.
 *
 * Two variants, because the two checks want different things. Identifier
 * checks must ignore string contents, or a comment-free mention of window in
 * an error message trips the gate. Import checks must keep them, because the
 * module specifier IS a string.
 */
function withoutComments(source, { keepStrings }) {
  const kind = classify(source);
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const keep = kind[i] === CODE || (keepStrings && kind[i] !== COMMENT);
    out += keep || source[i] === '\n' ? source[i] : ' ';
  }
  return out;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(full)) out.push(full);
  }
  return out;
}

// Things a rule may never reach for. Each is a real failure mode, not a style
// preference: the first group does not exist in Node, the second is I/O the
// verifier must control, and the third makes a replay disagree with itself.
const FORBIDDEN = [
  [/\bwindow\b/, 'window'],
  [/\bdocument\b/, 'document'],
  [/\bnavigator\b/, 'navigator'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bsessionStorage\b/, 'sessionStorage'],
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bimport\.meta\.env\b/, 'import.meta.env'],
  [/\bMath\.random\b/, 'Math.random'],
  [/\bDate\.now\b/, 'Date.now'],
  [/\bnew\s+Date\b/, 'new Date()'],
  [/\bcrypto\.randomUUID\b/, 'crypto.randomUUID'],
  [/\bperformance\.now\b/, 'performance.now'],
];

// Bare module specifiers the package may never depend on. It currently depends
// on nothing at all, which is the intended steady state.
const FORBIDDEN_MODULES = [
  'react', 'react-dom', 'react/jsx-runtime', 'lucide-react',
  '@supabase/supabase-js', 'pg', 'vite',
];

const findings = [];
const files = walk(PACKAGE_SRC);

if (files.length === 0) {
  console.error('game-core-gate FAILED: packages/game-core/src has no source files');
  process.exit(1);
}

for (const file of files) {
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  const codeLines = withoutComments(source, { keepStrings: false }).split('\n');
  const importLines = withoutComments(source, { keepStrings: true }).split('\n');

  codeLines.forEach((line, i) => {
    for (const [pattern, name] of FORBIDDEN) {
      if (pattern.test(line)) {
        findings.push({ rel, line: i + 1, text: line.trim(), why: `uses ${name}` });
      }
    }
  });

  // Imports: relative, and inside the package. Nothing else, which includes
  // node: builtins and every third-party module. The package currently
  // depends on nothing at all, and that is the intended steady state.
  importLines.forEach((line, i) => {
    for (const m of line.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      const at = { rel, line: i + 1, text: line.trim() };
      if (!spec.startsWith('.')) {
        const known = FORBIDDEN_MODULES.includes(spec) ? ' (forbidden dependency)' : '';
        findings.push({ ...at, why: `depends on a module outside the core: ${spec}${known}` });
      } else if (spec.includes('..')) {
        findings.push({ ...at, why: `imports outside the package: ${spec}` });
      }
    }
  });
}

// The shims. Each must re-export its module and contain no logic of its own,
// so a rule cannot exist in two places and drift.
const SHIMS = {
  'src/lib/gameTypes.ts': 'packages/game-core/src/types',
  'src/lib/decisionContract.ts': 'packages/game-core/src/decisionContract',
  'src/lib/allocation.ts': 'packages/game-core/src/allocation',
  'src/lib/scoringEngine.ts': 'packages/game-core/src/scoringEngine',
};

for (const [shim, target] of Object.entries(SHIMS)) {
  const full = join(ROOT, shim);
  if (!existsSync(full)) {
    findings.push({ rel: shim, line: 0, text: '', why: 'compatibility shim is missing' });
    continue;
  }
  const code = withoutComments(readFileSync(full, 'utf8'), { keepStrings: true })
    .split('\n').map(l => l.trim()).filter(Boolean);

  const stray = code.filter(l => !/^export\s+(\*|type\s+\*|\{[^}]*\})\s+from\s+['"]/.test(l));
  if (stray.length > 0) {
    findings.push({
      rel: shim, line: 0, text: stray[0],
      why: 'shim contains logic; it must only re-export (one implementation per rule)',
    });
  }
  if (!code.some(l => l.includes(target))) {
    findings.push({ rel: shim, line: 0, text: '', why: `shim does not re-export ${target}` });
  }
}

if (findings.length > 0) {
  console.error('game-core-gate FAILED: the deterministic core boundary was crossed.\n');
  for (const f of findings) {
    console.error(`  ${f.rel}${f.line ? `:${f.line}` : ''}  ${f.why}`);
    if (f.text) console.error(`    ${f.text}\n`);
  }
  console.error(`${findings.length} violation(s).`);
  process.exit(1);
}

console.log(
  `game-core-gate OK — ${files.length} core file(s) depend on nothing outside the package, ` +
  `read no clock or random source, and ${Object.keys(SHIMS).length} shim(s) re-export without reimplementing`,
);
