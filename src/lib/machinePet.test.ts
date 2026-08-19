import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawMachine, posture, describeMachine, type MachinePetState } from './machinePet';
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
  assert.match(bare, /no chassis/);
  assert.ok(!bare.includes('#'), 'no chassis means no load carried');

  const full = drawMachine({ installed: ALL, compiled: true }).join('\n');
  assert.match(full, /######/, 'a built portfolio is carried');
  assert.match(full, /\(@\)/, 'eligibility gives it a nose');
  assert.match(full, /o {3}o/, 'monitoring opens both eyes');
  assert.match(full, /,-\._____,-\./, 'signal gives it floppy ears');
  assert.match(full, /~~/, 'a standing dog wags its tail');
});

test('guardrails thicken the shell', () => {
  const without = drawMachine({ installed: ['UNIVERSE'], compiled: false }).join('\n');
  const withRails = drawMachine({ installed: ['UNIVERSE', 'GUARDRAILS'], compiled: false }).join('\n');
  assert.ok(without.includes('----'), 'an unarmoured dog has a thin shell');
  assert.ok(withRails.includes('===='), 'guardrails thicken it');
});

test('without execution it has no legs, however much else is installed', () => {
  // The drawing carries no words now that it is a dog rather than a diagram:
  // stub mounts say it cannot act, and the posture line beside it says so in
  // English for anyone who cannot see the picture.
  // The paw row is the last one; the body's own outline uses an apostrophe, so
  // asserting against the whole drawing would match that instead.
  const paws = drawMachine({
    installed: ALL.filter(m => m !== 'EXECUTION'), compiled: true,
  }).slice(-1)[0];
  assert.match(paws, /\./, 'stubs where the legs would go');
  assert.ok(!paws.includes("'"), 'and no paws on the ground');
});

test('it only opens its eyes with monitoring installed', () => {
  const blind = drawMachine({ installed: ['UNIVERSE', 'SIGNAL'], compiled: false }).join('\n');
  assert.match(blind, /\. {3}\./, 'no monitoring, no open eyes');
  const seeing = drawMachine({ installed: ['UNIVERSE', 'SIGNAL', 'MONITORING'], compiled: false }).join('\n');
  assert.match(seeing, /u {3}u/, 'uncompiled and watching: dozing on the bench');
});

test('the face and tail read the posture before any label does', () => {
  const eyes = (s: Parameters<typeof drawMachine>[0]) => drawMachine(s).join('\n');
  assert.match(eyes({ installed: ALL, compiled: true }), /o {3}o/, 'standing: happy');
  assert.match(eyes({ installed: ALL, compiled: true, riskUsed: 0.8 }), /O {3}O/, 'braced: wide awake');
  assert.match(eyes({ installed: ALL, compiled: true, breached: true }), /- {3}-/, 'halted: calm');

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

test('it is a dog, not a cat', () => {
  // The previous face was ` /\_/\ ` over `( o.o )` over ` > w < `, which is
  // the canonical ASCII cat: pointed ears on top of the skull, triangle nose,
  // whisker mouth. What separates a dog is ears hanging down the SIDES and a
  // blunt muzzle with a round nose, so both are pinned here.
  const dog = drawMachine({ installed: ALL, compiled: true }).join('\n');
  assert.ok(!dog.includes('/\\_/\\'), 'no pointed cat ears on top of the head');
  assert.ok(!dog.includes('> w <'), 'no whisker mouth');
  assert.match(dog, /\(@\)/, 'a blunt muzzle with a round nose');
  assert.match(dog, /\( {2}o {3}o {2}\)/, 'ears wrapping down the sides of the face');
});

test('the drawing is actual ASCII', () => {
  // It was not, for several revisions: it was drawn in box-drawing and block
  // characters (U+2500, U+2580) while being called ASCII throughout. That is
  // worth pinning down, and not only for accuracy — line-drawing gives clean
  // geometry, which is exactly why it kept reading as a diagram rather than an
  // animal. Restricting to printable ASCII also removes a class of bug:
  // fullwidth glyphs that tear the grid, and missing-glyph boxes in whatever
  // monospace font the player happens to have.
  const states: MachinePetState[] = [
    { installed: [], compiled: false },
    { installed: ['UNIVERSE'], compiled: false },
    { installed: ALL, compiled: true },
    { installed: ALL, compiled: false },
    { installed: ALL, compiled: true, riskUsed: 0.9 },
    { installed: ALL, compiled: true, breached: true },
  ];
  for (const state of states) {
    for (const ch of drawMachine(state).join('')) {
      const c = ch.codePointAt(0)!;
      assert.ok(
        c >= 0x20 && c <= 0x7e,
        `${JSON.stringify(ch)} (U+${c.toString(16).toUpperCase()}) is not printable ASCII`,
      );
    }
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
