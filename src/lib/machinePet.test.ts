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
  assert.ok(!bare.includes('PAYLOAD'), 'no chassis means no payload bay');

  const full = drawMachine({ installed: ALL, compiled: true }).join('\n');
  assert.match(full, /███ PAYLOAD ███/);
  assert.match(full, /▤▤▤ FILTERS ▤▤▤/);
  assert.match(full, /◉ ◉/);
});

test('guardrails armour the frame', () => {
  const without = drawMachine({ installed: ['UNIVERSE'], compiled: false }).join('\n');
  const withRails = drawMachine({ installed: ['UNIVERSE', 'GUARDRAILS'], compiled: false }).join('\n');
  assert.ok(without.includes('┌'), 'unarmoured frame draws a single rule');
  assert.ok(withRails.includes('╔'), 'guardrails draw a double rule');
});

test('without execution it has no legs, however much else is installed', () => {
  const legless = drawMachine({
    installed: ALL.filter(m => m !== 'EXECUTION'), compiled: true,
  }).join('\n');
  assert.match(legless, /NO ACTUATORS/);
});

test('the sensor head only opens its eyes with monitoring installed', () => {
  const blind = drawMachine({ installed: ['SIGNAL'], compiled: false }).join('\n');
  assert.match(blind, /· ·/);
  const seeing = drawMachine({ installed: ['SIGNAL', 'MONITORING'], compiled: false }).join('\n');
  assert.match(seeing, /◉ ◉/);
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
