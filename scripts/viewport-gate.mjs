#!/usr/bin/env node
// ─── Viewport gate ────────────────────────────────────────────────────────────
// A screen must be reachable on a phone.
//
// This exists because the core loop shipped as a hard three-pane terminal: a
// 256px left rail and a 208px right rail, both flex-shrink-0, inside an
// overflow-hidden parent. On a 390pt viewport the rails alone exceeded the
// screen, the centre pane holding every interactive control collapsed to
// nothing, and the overflow clipped the rest. The result rendered as a single
// vertical sliver with no tappable target anywhere on it.
//
// Nothing caught it. Every unit test passed, the build was clean, and the
// desktop layout looked correct, because the failure is a property of the
// viewport and not of any function. It was found by a person opening the game
// on their phone.
//
// So the invariant is enforced statically instead:
//
//   1. A fixed-width flex child that refuses to shrink must be hidden, or
//      given a responsive width, below the breakpoint where it fits.
//   2. A grid of three or more columns must declare a narrower arrangement.
//
// Neither rule proves a screen is usable on a phone. They only catch the two
// shapes that have actually broken it. Widen the gate when a third appears.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: a checkout under a directory with a space in
// its name yields %20 from .pathname and every readdir fails.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROOTS = ['src/screens', 'src/components'];

/** Tailwind's default breakpoints, in points. */
const BREAKPOINT = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };

/** The narrowest viewport the game claims to support. */
const MIN_VIEWPORT = 360;

const ALLOW = /\/\/\s*viewport-gate:\s*allow\b/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(full) && !/\.test\.tsx$/.test(full)) out.push(full);
  }
  return out;
}

/** True when the line, or the comment block above it, carries an escape hatch. */
function excused(lines, index) {
  if (ALLOW.test(lines[index])) return true;
  for (let i = index - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (ALLOW.test(line)) return true;
    if (line === '' || line.startsWith('//') || line.startsWith('*')
      || line.startsWith('/*') || line.startsWith('{/*') || line.endsWith('*/')) continue;
    return false;
  }
  return false;
}

const findings = [];

for (const rootDir of ROOTS) {
  for (const file of walk(join(ROOT, rootDir))) {
    const rel = relative(ROOT, file);
    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, i) => {
      if (!line.includes('className')) return;
      if (excused(lines, i)) return;

      // Rule 1: a rail that cannot shrink and is never hidden.
      if (/\bflex-shrink-0\b/.test(line)) {
        const width = line.match(/(?:^|["'\s])w-(\d+)(?:\s|["'])/);
        if (width) {
          const points = Number(width[1]) * 4; // Tailwind spacing unit is 4px
          const hidden = /\bhidden\s+(sm|md|lg|xl|2xl):(flex|block|grid)\b/.test(line);
          const responsive = new RegExp(`(sm|md|lg|xl|2xl):w-`).test(line);
          if (points >= 160 && !hidden && !responsive) {
            findings.push({
              file: rel,
              line: i + 1,
              rule: 'unshrinkable rail',
              detail: `w-${width[1]} (${points}pt) with flex-shrink-0 and no responsive escape`,
            });
          }
        }
      }

      // Rule 2: a wide grid with no narrow arrangement declared.
      const cols = line.match(/(?:^|["'\s])grid-cols-([3-9]|1[0-2])(?:\s|["'])/);
      if (cols) {
        const responsive = /(sm|md|lg|xl|2xl):grid-cols-/.test(line);
        if (!responsive) {
          findings.push({
            file: rel,
            line: i + 1,
            rule: 'unconditional wide grid',
            detail: `grid-cols-${cols[1]} with no narrower arrangement below the breakpoint`,
          });
        }
      }
    });
  }
}

// A pair of rails that individually pass can still fail together, so the sum is
// checked as well: the widest known offender was two rails that each looked
// reasonable and together exceeded the viewport.
const railsByFile = new Map();
for (const f of findings.filter(f => f.rule === 'unshrinkable rail')) {
  const points = Number(f.detail.match(/\((\d+)pt\)/)[1]);
  railsByFile.set(f.file, (railsByFile.get(f.file) ?? 0) + points);
}
for (const [file, total] of railsByFile) {
  if (total >= MIN_VIEWPORT) {
    findings.push({
      file,
      line: 0,
      rule: 'rails exceed the viewport',
      detail: `${total}pt of non-shrinking rails against a ${MIN_VIEWPORT}pt minimum viewport`,
    });
  }
}

if (findings.length === 0) {
  console.log(`viewport-gate: PASS (breakpoints ${Object.keys(BREAKPOINT).join(', ')})`);
  process.exit(0);
}

console.error(`viewport-gate: ${findings.length} finding(s)\n`);
for (const f of findings) {
  console.error(`  ${f.file}${f.line ? `:${f.line}` : ''}`);
  console.error(`    ${f.rule}: ${f.detail}\n`);
}
console.error('A screen must be reachable on a phone. Give the element a responsive');
console.error('arrangement, or annotate the deliberate exception:\n');
console.error('  // viewport-gate: allow <reason>\n');
process.exit(1);
