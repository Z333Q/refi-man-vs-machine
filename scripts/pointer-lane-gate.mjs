#!/usr/bin/env node
// ─── Real-pointer lane gate ───────────────────────────────────────────────────
//
// The real-pointer spec must stay in the required E2E lane.
//
// The deterministic replay suite proves the geometry and the gesture machine
// agree on a sample stream. It cannot prove that a hand on a real page produces
// that stream: hit testing, pointer capture, coalesced events, the jitter
// filter and the layout all sit between the finger and the reducer, and that is
// exactly where the pull broke for players while every unit test stayed green
// (see gestureGeometry.ts on the 22pt pullable slit that shipped for months).
//
// The browser proof is therefore load-bearing, and load-bearing tests are the
// ones that quietly disappear: a spec renamed, a project dropped from the
// config, a testMatch narrowed. Any of those removes the coverage without
// failing anything, which is the failure mode this gate exists to make loud.
//
// It checks wiring, not behaviour. Whether the gesture is correct is the
// spec's job; whether the spec still runs is this one's.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: a checkout under a directory with a space in
// its name yields %20 and every read fails.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SPEC = join(ROOT, 'e2e', 'pointer-commit.spec.ts');
const CONFIG = join(ROOT, 'playwright.config.ts');

const failures = [];

if (!existsSync(SPEC)) {
  failures.push('e2e/pointer-commit.spec.ts is missing');
} else {
  const spec = readFileSync(SPEC, 'utf8');
  // The point of the spec is browser input. If it ever starts calling the
  // gesture machine directly it is a unit test wearing a browser costume.
  for (const forbidden of ['gestureReducer', 'runGesture', 'convictionForDistance', 'pointerSession']) {
    if (spec.includes(forbidden)) {
      failures.push(`the spec imports application gesture internals (${forbidden}); it must drive browser input only`);
    }
  }
  // Real input, both pointer families.
  if (!/page\.mouse|dispatchMouseEvent/.test(spec)) failures.push('no mouse-driven pointer input in the spec');
  if (!/dispatchTouchEvent|touchscreen/.test(spec)) failures.push('no touch-driven pointer input in the spec');
}

if (!existsSync(CONFIG)) {
  failures.push('playwright.config.ts is missing');
} else {
  const config = readFileSync(CONFIG, 'utf8');
  for (const project of ['pointer-desktop', 'pointer-phone']) {
    if (!config.includes(`name: '${project}'`)) {
      failures.push(`playwright.config.ts no longer defines the ${project} project`);
    }
  }
  if (!config.includes("testMatch: 'pointer-commit.spec.ts'")) {
    failures.push('no project matches pointer-commit.spec.ts');
  }
  // The phone project has to stay a phone, or the portrait law is untested.
  if (!/name: 'pointer-phone',[\s\S]{0,400}devices\['Pixel 5'\]/.test(config)) {
    failures.push('pointer-phone must run the Pixel 5 (portrait, touch) profile');
  }
}

if (failures.length > 0) {
  console.error('pointer-lane-gate FAILED: the real-pointer browser proof is not wired into the E2E lane.');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('pointer-lane-gate OK — real-pointer spec present, internals-free, and wired to pointer-desktop + pointer-phone (Pixel 5).');
