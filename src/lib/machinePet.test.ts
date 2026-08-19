import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawMachine, posture, describeMachine } from './machinePet';
import type { MachineModuleId } from './gameTypes';

const ALL: MachineModuleId[] = [
  'UNIVERSE', 'ELIGIBILITY', 'SIGNAL', 'CONSTRUCTION', 'GUARDRAILS', 'EXECUTION', 'MONITORING',
];

// ─── The trap, guarded ────────────────────────────────────────────────────────

test('the machine cannot decay: it never reads a clock or an RNG', () => {
  // This is the whole design constraint, so it is asserted against the source
  // rather than trusted. A pet that withers when the player stops logging in
  // would be §16's fake urgency, and would teach the opposite of the thesis:
  // the argument for a process is that it does not depend on your attention.
  const src = readFileSync(new URL('./machinePet.ts', import.meta.url), 'utf8');
  const body = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const forbidden of ['Date', 'Math.random', 'setTimeout', 'setInterval', 'performance.now']) {
    assert.ok(
      !body.includes(forbidden),
      `machinePet.ts must not reference ${forbidden}: the machine changes with evidence, never with elapsed time`,
    );
  }
});

test('an absent player changes nothing', () => {
  // Same state drawn twice, far apart in wall-clock terms, is the same machine.
  const state = { installed: ALL, compiled: true, riskUsed: 0.2 };
  const first = drawMachine(state);
  const later = drawMachine({ ...state });
  assert.deepEqual(first, later);
});

// ─── Parts follow the configuration ───────────────────────────────────────────

test('nothing is drawn that the configuration does not have', () => {
  const bare = drawMachine({ installed: [], compiled: false }).join('\n');
  assert.match(bare, /NO CHASSIS/);
  assert.ok(!bare.includes('█'), 'no chassis means no load carried');

  const full = drawMachine({ installed: ALL, compiled: true }).join('\n');
  assert.match(full, /█████/, 'a built portfolio is carried');
  assert.match(full, /ᴥ/, 'eligibility gives it a nose');
  assert.match(full, /◕/, 'monitoring opens its eye');
  assert.match(full, /╭╮/, 'signal gives it an ear');
  assert.match(full, /▟▛/, 'a standing dog wags its tail');
});

test('guardrails armour the outline', () => {
  const without = drawMachine({ installed: ['UNIVERSE'], compiled: false }).join('\n');
  const withRails = drawMachine({ installed: ['UNIVERSE', 'GUARDRAILS'], compiled: false }).join('\n');
  assert.ok(without.includes('╭─'), 'an unarmoured dog is drawn in a single rule');
  assert.ok(withRails.includes('╔═') || withRails.includes('═'), 'guardrails draw a double rule');
});

test('without execution it has no legs, however much else is installed', () => {
  // The drawing carries no words now that it is a dog rather than a diagram:
  // stub mounts say it cannot act, and the posture line beside it says so in
  // English for anyone who cannot see the picture.
  const legless = drawMachine({
    installed: ALL.filter(m => m !== 'EXECUTION'), compiled: true,
  }).join('\n');
  assert.match(legless, /╌/, 'stub mounts where the legs would go');
  assert.ok(!legless.includes('╨'), 'and no paws on the ground');
});

test('it only opens its eye with monitoring installed', () => {
  const blind = drawMachine({ installed: ['UNIVERSE', 'SIGNAL'], compiled: false }).join('\n');
  assert.ok(!blind.includes('◕') && !blind.includes('^'), 'no monitoring, no open eye');
  const seeing = drawMachine({ installed: ['UNIVERSE', 'SIGNAL', 'MONITORING'], compiled: false }).join('\n');
  assert.match(seeing, /\^/, 'uncompiled and watching: dozing on the bench');
});

test('the face and tail read the posture before any label does', () => {
  const eyes = (s: Parameters<typeof drawMachine>[0]) => drawMachine(s).join('\n');
  assert.match(eyes({ installed: ALL, compiled: true }), /◕/, 'standing: happy');
  assert.match(eyes({ installed: ALL, compiled: true, riskUsed: 0.8 }), /◉/, 'braced: wide awake');
  assert.match(eyes({ installed: ALL, compiled: true, breached: true }), /-/, 'halted: calm');

  // The tail is the fastest read in the drawing, so it must differ per state.
  const tails = new Set([
    eyes({ installed: ALL, compiled: true }),
    eyes({ installed: ALL, compiled: true, riskUsed: 0.8 }),
    eyes({ installed: ALL, compiled: true, breached: true }),
    eyes({ installed: ALL, compiled: false }),
  ]);
  assert.equal(tails.size, 4, 'each posture is drawn distinctly');

  // A halted machine did its job. It must never be drawn as dead.
  const halted = eyes({ installed: ALL, compiled: true, breached: true });
  assert.ok(!halted.includes('x') && !halted.includes('X'), 'no X-eyes on a working guardrail');
});

test('every glyph is half-width, so the grid cannot tear', () => {
  // A fullwidth character counts as one code point but occupies two columns,
  // which the rectangularity test below cannot see. Catch them by codepoint.
  const art = [
    drawMachine({ installed: ALL, compiled: true }),
    drawMachine({ installed: ALL, compiled: false }),
    drawMachine({ installed: ALL, compiled: true, riskUsed: 0.9 }),
    drawMachine({ installed: ALL, compiled: true, breached: true }),
  ].flat().join('');
  for (const ch of art) {
    const c = ch.codePointAt(0)!;
    const fullwidth =
      (c >= 0x1100 && c <= 0x115F) || (c >= 0x2E80 && c <= 0xA4CF) ||
      (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0xF900 && c <= 0xFAFF) ||
      (c >= 0xFE30 && c <= 0xFE6F) || (c >= 0xFF00 && c <= 0xFF60) ||
      (c >= 0xFFE0 && c <= 0xFFE6);
    assert.ok(!fullwidth, `fullwidth glyph ${JSON.stringify(ch)} would tear the grid`);
  }
});

// ─── Posture reads the portfolio, not the calendar ────────────────────────────

test('posture is a reading of current risk, and bracing is not damage', () => {
  assert.equal(posture({ installed: ALL, compiled: false }), 'BENCH');
  assert.equal(posture({ installed: ALL, compiled: true }), 'STANDING');
  assert.equal(posture({ installed: ALL, compiled: true, riskUsed: 0.7 }), 'BRACED');
  assert.equal(posture({ installed: ALL, compiled: true, breached: true }), 'HALTED');

  // A halted machine is one whose guardrail did its job (§45), so it must read
  // as stopped rather than broken.
  const halted = describeMachine({ installed: ALL, compiled: true, breached: true });
  assert.match(halted, /halted by its own guardrail/);
  assert.ok(!/damag|broken|dying|hurt/i.test(halted));
});

test('every drawing is rectangular, so the terminal grid never tears', () => {
  const states = [
    { installed: [], compiled: false },
    { installed: ['UNIVERSE'] as MachineModuleId[], compiled: false },
    { installed: ALL, compiled: true },
    { installed: ALL, compiled: true, riskUsed: 0.9 },
    { installed: ALL, compiled: true, breached: true },
  ];
  for (const s of states) {
    const lines = drawMachine(s);
    const widths = new Set(lines.map(l => [...l].length));
    assert.equal(widths.size, 1, `ragged drawing for ${JSON.stringify(s.installed)}: ${[...widths]}`);
  }
});
