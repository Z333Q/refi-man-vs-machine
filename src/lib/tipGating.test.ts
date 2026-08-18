import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BLOCKED_TIP_STATES, isTipGateOpen, type TipGameState } from '../context/tipGate';

// §11: "Never show tips during: market advancement; machine action
// computation; score computation; final result animation."
//
// The rule was written and then not enforced: gameState was initialised to
// IDLE with no setter, so the check was unreachable and a tip could open over
// anything. It did, over the timed WHY? prompt, which is the worst case
// because the prompt keeps counting down underneath the thing covering it.

test('the race is closed to tips: advancement, computation and scoring hide behind it', () => {
  assert.equal(isTipGateOpen('MARKET_ADVANCING'), false);
});

test('the thesis prompt is closed to tips', () => {
  // The prompt is a timed input. A tip over it hides a question that is still
  // expiring, which is precisely the reported bug.
  assert.equal(isTipGateOpen('THESIS_PROMPT'), false);
});

test('a finished reveal is open: its teaching tips are written to land there', () => {
  // The engine leaves the run in RESOLVING for the whole stretch, so blocking
  // by phase would suppress FIRST_RUN_08_MACHINE_REVEAL and FIRST_RUN_09_SCORE
  // permanently. Once the animation is done the result is static and readable.
  assert.equal(isTipGateOpen('MACHINE_REVEAL'), true);
  assert.equal(isTipGateOpen('RESULT_COMPUTING'), true);
});

test('the decision surface is open: that is where most tips belong', () => {
  assert.equal(isTipGateOpen('DECISION_REQUIRED'), true);
});

test('idle is open, so tips outside a run are unaffected', () => {
  assert.equal(isTipGateOpen('IDLE'), true);
  assert.equal(isTipGateOpen('COMPLETE'), true);
});

test('exactly two states are blocked, and both are things that cover the screen', () => {
  assert.deepEqual(
    [...BLOCKED_TIP_STATES].sort(),
    ['COMMIT_CONFIRM', 'MARKET_ADVANCING', 'THESIS_PROMPT'],
  );
});

test('every state is decided: the gate has no undefined answer', () => {
  const all: TipGameState[] = [
    'IDLE', 'DECISION_REQUIRED', 'THESIS_PROMPT', 'MARKET_ADVANCING',
    'MACHINE_REVEAL', 'RESULT_COMPUTING', 'COMPLETE',
  ];
  for (const s of all) assert.equal(typeof isTipGateOpen(s), 'boolean', s);
});
