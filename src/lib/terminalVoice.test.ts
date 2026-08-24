import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  claimFloor, releaseFloor, floorHolder, lastSpeechId,
  subscribeFloor, resetFloorForTests, type FloorOwner,
} from './floor';
import {
  speechGateOpen, MOMENT_MOOD, MOOD_CLASS, describeSpeech,
} from './terminalVoice';

// ─── The §16 guard ────────────────────────────────────────────────────────────
// The floor and the voice policy change with evidence, never with elapsed
// time. Same enforcement pattern as machinePet.test.ts: read the source, fail
// on any clock or RNG. The teletype rhythm is presentation and lives in the
// component, which this guard deliberately does not cover.

test('floor.ts and terminalVoice.ts never read a clock or an RNG', () => {
  for (const file of ['./floor.ts', './terminalVoice.ts']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const forbidden of ['Date', 'Math.random', 'setTimeout', 'setInterval', 'performance.now']) {
      assert.ok(
        !src.includes(forbidden),
        `${file} must not reference ${forbidden}: the floor changes only when an owner claims or releases it`,
      );
    }
  }
});

// ─── Floor exclusivity (§11: never two overlays) ─────────────────────────────

const TIP: FloorOwner = { kind: 'TIP', id: 'FIRST_RUN_08' };
const SPEECH: FloorOwner = { kind: 'SPEECH', id: 'MACHINE_REVEAL' };
const SPEECH_2: FloorOwner = { kind: 'SPEECH', id: 'CHECKPOINT_VERDICT' };

test('the floor is exclusive: a speech cannot open over a tip, or vice versa', () => {
  resetFloorForTests();
  assert.equal(claimFloor(TIP), true);
  assert.equal(claimFloor(SPEECH), false, 'speech must wait while a tip is up');
  assert.deepEqual(floorHolder(), TIP);

  releaseFloor(TIP);
  assert.equal(floorHolder(), null);
  assert.equal(claimFloor(SPEECH), true);
  assert.equal(claimFloor(TIP), false, 'tip must wait while a speech is up');
});

test('two speeches never overlap; the queue is release-then-claim', () => {
  resetFloorForTests();
  assert.equal(claimFloor(SPEECH), true);
  assert.equal(claimFloor(SPEECH_2), false);
  releaseFloor(SPEECH);
  assert.equal(claimFloor(SPEECH_2), true);
});

test('re-claiming by the current holder is idempotent', () => {
  resetFloorForTests();
  assert.equal(claimFloor(SPEECH), true);
  assert.equal(claimFloor(SPEECH), true);
  assert.deepEqual(floorHolder(), SPEECH);
});

test('only the holder can release the floor', () => {
  resetFloorForTests();
  claimFloor(SPEECH);
  releaseFloor(TIP);
  releaseFloor(SPEECH_2);
  assert.deepEqual(floorHolder(), SPEECH, 'a non-holder release must be a no-op');
  releaseFloor(SPEECH);
  assert.equal(floorHolder(), null);
});

test('subscribers hear claims from open and releases, and can unsubscribe', () => {
  resetFloorForTests();
  let calls = 0;
  const off = subscribeFloor(() => { calls += 1; });
  claimFloor(SPEECH);      // open -> held: notify
  claimFloor(SPEECH);      // idempotent re-claim: no notify
  claimFloor(SPEECH_2);    // denied: no notify
  releaseFloor(SPEECH);    // held -> open: notify
  assert.equal(calls, 2);
  off();
  claimFloor(SPEECH);
  assert.equal(calls, 2, 'unsubscribed listeners must not be called');
});

// ─── One-cursor rule ──────────────────────────────────────────────────────────
// The blinking cursor belongs to the most recent speech, and only to it, even
// after that speech has finished and released the floor.

test('lastSpeechId tracks the most recent speech, not tips, and survives release', () => {
  resetFloorForTests();
  assert.equal(lastSpeechId(), null);

  claimFloor(TIP);
  releaseFloor(TIP);
  assert.equal(lastSpeechId(), null, 'tips never own the reading cursor');

  claimFloor(SPEECH);
  releaseFloor(SPEECH);
  assert.equal(lastSpeechId(), 'MACHINE_REVEAL');

  claimFloor(SPEECH_2);
  assert.equal(lastSpeechId(), 'CHECKPOINT_VERDICT');
});

// ─── Speech gate (§11: beats, not work) ───────────────────────────────────────

test('speeches never open during work or over a timed question', () => {
  assert.equal(speechGateOpen('MARKET_ADVANCING'), false);
  assert.equal(speechGateOpen('THESIS_PROMPT'), false);
  assert.equal(speechGateOpen('COMMIT_CONFIRM'), false);
});

test('speeches may open at consequence beats and while deciding', () => {
  // DECISION_REQUIRED stays open for the guardrail block, which is feedback
  // to the player's own attempted action, not an interruption.
  for (const state of ['IDLE', 'DECISION_REQUIRED', 'MACHINE_REVEAL', 'RESULT_COMPUTING', 'COMPLETE'] as const) {
    assert.equal(speechGateOpen(state), true, `${state} should allow speech`);
  }
});

// ─── Registers ────────────────────────────────────────────────────────────────

test('every moment has a mood and every mood has a css hook', () => {
  for (const mood of Object.values(MOMENT_MOOD)) {
    assert.ok(MOOD_CLASS[mood], `mood ${mood} needs a css class`);
  }
  assert.equal(MOMENT_MOOD.MACHINE_REVEAL, 'MEASURED', 'the machine speaks measured, as I');
  assert.equal(MOMENT_MOOD.GUARDRAIL_BLOCK, 'ALERT');
  assert.equal(MOMENT_MOOD.AUTOPSY_VERDICT, 'SOMBER');
});

test('describeSpeech flattens to a single accessible line', () => {
  assert.equal(
    describeSpeech('MACHINE', ['I REDUCED CORRELATION.', 'WE READ THE SAME TAPE.']),
    'MACHINE: I REDUCED CORRELATION. WE READ THE SAME TAPE.',
  );
});
