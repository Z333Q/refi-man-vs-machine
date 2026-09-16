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
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, CODE, COMMENT } from './lib/scan-code.mjs';
import { moduleSpecifiers } from './lib/module-specifiers.mjs';

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

/**
 * A global read, as opposed to a word that merely spells like one.
 *
 * `window` is both the DOM global and the right domain word for the historical
 * period an arena covers, and `ArenaDefinition.window` is a string field on a
 * pure data contract. A plain word match calls that a browser dependency,
 * which is wrong twice: it fails a file that touches nothing, and the obvious
 * way to get green is to rename a good domain term after a lint bug.
 *
 * Two forms are not a global read, and nothing else is exempt:
 *
 *   - a member, `arena.window` — the object on the left decides what it is,
 *     and it is not the global;
 *   - a property name, `window: string` or `window?: string` — a declaration
 *     or a key, never a use.
 *
 * Every real reach for the global still matches, `typeof window`,
 * `window.location`, `const w = window` included, because none of them can be
 * written without the identifier standing alone.
 */
function globalRead(name) {
  return new RegExp(`(?<![.\\w$])${name}\\b(?!\\s*\\??\\s*:)`);
}

const FORBIDDEN = [
  [globalRead('window'), 'window'],
  [globalRead('document'), 'document'],
  [globalRead('navigator'), 'navigator'],
  [globalRead('localStorage'), 'localStorage'],
  [globalRead('sessionStorage'), 'sessionStorage'],
  [/\bfetch\s*\(/, 'fetch()'],
  [globalRead('XMLHttpRequest'), 'XMLHttpRequest'],
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
  // Strings kept: a module specifier is a string, so the import scan needs it.
  const importLines = withoutComments(source, { keepStrings: true }).split('\n');

  codeLines.forEach((line, i) => {
    for (const [pattern, name] of FORBIDDEN) {
      if (pattern.test(line)) {
        findings.push({ rel, line: i + 1, text: line.trim(), why: `uses ${name}` });
      }
    }
  });

  // Imports: relative, and resolving inside the package. Nothing else, which
  // includes node: builtins and every third-party module. The package
  // currently depends on nothing at all, and that is the intended steady
  // state.
  //
  // Every literal loading form counts, not only `from '...'`: a side-effect
  // import couples two modules exactly as completely as a named one, and it is
  // the form this codebase actually uses for arena registration.
  //
  // The in-package test resolves the path rather than looking for '..' in the
  // string. './a/../b' stays inside and is fine; '../../src/lib/x' does not
  // and is not; and a directory legitimately named with dots cannot be
  // mistaken for an escape.
  for (const { spec, line } of moduleSpecifiers(importLines.join('\n'))) {
    const at = { rel, line, text: (importLines[line - 1] ?? '').trim() };
    if (!spec.startsWith('.')) {
      const known = FORBIDDEN_MODULES.includes(spec) ? ' (forbidden dependency)' : '';
      findings.push({ ...at, why: `depends on a module outside the core: ${spec}${known}` });
      continue;
    }
    const target = resolve(dirname(file), spec);
    if (target !== PACKAGE_SRC && !target.startsWith(PACKAGE_SRC + '/')) {
      findings.push({ ...at, why: `imports outside the package: ${spec}` });
    }
  }
}

// The shims. Each must re-export its module and contain no logic of its own,
// so a rule cannot exist in two places and drift.
const SHIMS = {
  'src/lib/gameTypes.ts': 'packages/game-core/src/types',
  'src/lib/decisionContract.ts': 'packages/game-core/src/decisionContract',
  'src/lib/allocation.ts': 'packages/game-core/src/allocation',
  'src/lib/scoringEngine.ts': 'packages/game-core/src/scoringEngine',
  'src/lib/arenas.ts': 'packages/game-core/src/arenas',
  'src/lib/machinePolicy.ts': 'packages/game-core/src/machinePolicy',
};

// The composition adapters. Same no-logic rule as a shim, with one named
// exception each: a side-effect import whose entire purpose is to compose
// application content into a core registry before the core module is exposed.
//
// This is not the package rule being weakened. The package rule is that
// nothing in packages/game-core imports anything outside it, and it is
// enforced above with no exception at all — precisely because the composition
// lives out here instead. The allowance is narrow and named: any other
// statement in the file, or a side-effect import of anything but the listed
// module, is a violation exactly as it would be in a shim.
const ADAPTERS = {
  'src/lib/runEngine.ts': {
    target: 'packages/game-core/src/runEngine',
    composes: './arenaIndex',
    why: 'registers the authored arenas before the engine is exposed',
  },
};

const REEXPORT = /^export\s+(\*|type\s+\*|\{[^}]*\})\s+from\s+['"]/;

/** A shim or adapter's statements, comments stripped and blanks dropped. */
function statementsOf(rel) {
  const full = join(ROOT, rel);
  if (!existsSync(full)) return null;
  return withoutComments(readFileSync(full, 'utf8'), { keepStrings: true })
    .split('\n').map(l => l.trim()).filter(Boolean);
}

for (const [shim, target] of Object.entries(SHIMS)) {
  const code = statementsOf(shim);
  if (code === null) {
    findings.push({ rel: shim, line: 0, text: '', why: 'compatibility shim is missing' });
    continue;
  }

  const stray = code.filter(l => !REEXPORT.test(l));
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

for (const [adapter, { target, composes }] of Object.entries(ADAPTERS)) {
  const code = statementsOf(adapter);
  if (code === null) {
    findings.push({ rel: adapter, line: 0, text: '', why: 'composition adapter is missing' });
    continue;
  }

  const composition = new RegExp(`^import\\s+['"]${composes.replace('.', '\\.')}['"];?$`);
  const stray = code.filter(l => !REEXPORT.test(l) && !composition.test(l));
  if (stray.length > 0) {
    findings.push({
      rel: adapter, line: 0, text: stray[0],
      why: `adapter contains logic; it may only re-export and compose ${composes}`,
    });
  }
  if (!code.some(l => l.includes(target))) {
    findings.push({ rel: adapter, line: 0, text: '', why: `adapter does not re-export ${target}` });
  }
  if (!code.some(l => composition.test(l))) {
    findings.push({
      rel: adapter, line: 0, text: '',
      why: `adapter does not compose ${composes}; the core registry would be empty at runtime`,
    });
  }
}

// ─── The doorway ──────────────────────────────────────────────────────────────
//
// The application reaches the core through the shims and adapters above, and
// nowhere else.
//
// This is what makes arena registration a guarantee rather than a habit. The
// core engine reads a registry it does not populate; src/lib/runEngine.ts
// populates it and then re-exports the engine. Every application caller that
// opens a run goes through that file, so the registry is never empty when it
// matters. A module that imported packages/game-core directly would skip the
// composition and get an engine with no arenas in it — which fails as a thrown
// UnregisteredArenaError now, but fails at runtime, in whichever screen
// happened to import it first, rather than here.
//
// It also keeps the shims honest. A second path into the core is how you end
// up with two import spellings for one rule and a shim nobody notices has
// gone stale.
const DOORWAYS = new Set([...Object.keys(SHIMS), ...Object.keys(ADAPTERS)]);
const APP_ROOT = join(ROOT, 'src');

for (const file of walk(APP_ROOT)) {
  const rel = relative(ROOT, file);
  if (DOORWAYS.has(rel)) continue;
  const source = withoutComments(readFileSync(file, 'utf8'), { keepStrings: true });
  for (const { spec, line } of moduleSpecifiers(source)) {
    if (!/(^|\/)packages\/game-core\//.test(spec)) continue;
    findings.push({
      rel, line, text: source.split('\n')[line - 1]?.trim() ?? '',
      why: 'imports the core directly; go through the src/lib shim or adapter, '
        + 'which is what composes the arena registry',
    });
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
  `game-core-gate OK — ${files.length} core file(s) import nothing outside the package `
  + `(named, type, namespace, side-effect, re-export, literal dynamic), `
  + `read no clock or random source; ${Object.keys(SHIMS).length} shim(s) re-export without `
  + `reimplementing, ${Object.keys(ADAPTERS).length} adapter(s) compose content outside the core, `
  + `and the application enters the core only through them`,
);
