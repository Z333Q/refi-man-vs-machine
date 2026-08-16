import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionCode } from './gameTypes';
import { PullSession, type PointerSample } from './pointerSession';
import { gestureReducer, initialGestureContext, type GestureConfig, type GestureContext } from './gestureMachine';
import { geometryFor, distanceForConviction, MIN_ENGAGEMENT_MS } from './gestureGeometry';
import { createInitialRun, commitDecisionCommand } from './runEngine';
import type { RunState } from './gameTypes';

// ─── Addendum C §6: the pointer-path replay ───────────────────────────────────
//
// The gate: a conviction sequence driven through the pointer path must produce
// byte-identical run state to the same sequence driven through the slider.
//
// The equivalence tests in gesture.test.ts drive the state machine directly,
// which skips origin capture, coalesced-sample consumption, the jitter filter
// and touch-up timestamp sampling. Every one of those can break independently,
// and none of them would turn a machine-level test red. This drives synthetic
// PointerEvent-shaped samples through the same PullSession the component uses,
// so a regression in the translation layer fails here.
//
// Fixture F1 is authored in Addendum A §F, which is not vendored into this
// repo. The sequence below is the conviction script already used as the
// equivalence fixture elsewhere, extended to cover the governed range, HOLD,
// a turnover-spending stance and the open range. When Addendum A lands, point
// this at the authored F1 and delete this note.
const F1: { action: ActionCode; conviction: number }[] = [
  { action: 'HOLD', conviction: 70 },
  { action: 'REDUCE', conviction: 65 },
  { action: 'HOLD', conviction: 60 },
  { action: 'ROTATE_DEFENSIVE', conviction: 75 },
  { action: 'RAISE_CASH', conviction: 88 },
  { action: 'HOLD', conviction: 72 },
];

const STD = geometryFor('STANDARD');

/**
 * Drive one pull with synthetic pointer samples and return what committed.
 *
 * The pull is drawn straight down from the grip origin in small increments, at
 * 8 ms per sample, held past the engagement floor, then released. Direction is
 * arbitrary by design (the mapping is radial), and the increments exist so the
 * jitter filter sees a realistic stream rather than one teleporting sample.
 */
function pullTo(conviction: number, actionCode: ActionCode, checkpointSequence: number): number | null {
  const target = distanceForConviction(conviction, STD);
  const session = new PullSession();
  const config: GestureConfig = { geometry: STD, checkpointSequence };
  let ctx: GestureContext = initialGestureContext();
  let committed: number | null = null;

  const origin = { x: 200, y: 300 };
  let t = 0;

  const feed = (event: ReturnType<PullSession['down']> | null) => {
    if (!event) return;
    const result = gestureReducer(ctx, event, config);
    ctx = result.context;
    for (const e of result.effects) if (e.type === 'COMMIT') committed = e.conviction;
  };

  const sample = (x: number, y: number): PointerSample =>
    ({ pointerId: 1, clientX: x, clientY: y, timeStamp: t });

  feed(session.down(sample(origin.x, origin.y), actionCode, true));

  // Draw in 12 steps, then dwell so the filter settles on the target distance.
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    t += 8;
    const d = (target * i) / steps;
    const s = sample(origin.x, origin.y + d);
    feed(session.move([s], s));
  }
  for (let i = 0; i < 14; i++) {
    t += 8;
    const s = sample(origin.x, origin.y + target);
    feed(session.move([s], s));
  }

  // Clear the engagement floor, then release.
  t = Math.max(t, MIN_ENGAGEMENT_MS + 50);
  feed(session.up(sample(origin.x, origin.y + target)));

  return committed;
}

test('F1 replayed through the pointer path commits the intended convictions', () => {
  // The filter is a low-pass, so the committed value is allowed to be near the
  // target rather than exactly it; what must hold is that it is the same value
  // the player was watching, and that it rounds to the intended integer.
  for (const step of F1) {
    const got = pullTo(step.conviction, step.action, 9);
    assert.ok(got !== null, `${step.action} at ${step.conviction} did not commit`);
    assert.equal(
      got, step.conviction,
      `${step.action}: pointer path committed ${got}, intended ${step.conviction}`,
    );
  }
});

test('F1 through the pointer path produces byte-identical run state to the slider path', () => {
  // The §6 gate. Same script, two doors, one room.
  let viaSlider: RunState = createInitialRun();
  for (const step of F1) {
    const outcome = commitDecisionCommand(viaSlider, { action: step.action, conviction: step.conviction });
    assert.ok(outcome, `slider path rejected ${step.action}`);
    viaSlider = outcome.run;
  }

  let viaPointer: RunState = createInitialRun();
  for (const step of F1) {
    const conviction = pullTo(step.conviction, step.action, viaPointer.currentCheckpoint);
    assert.ok(conviction !== null, `pointer path did not commit ${step.action}`);
    const outcome = commitDecisionCommand(viaPointer, { action: step.action, conviction });
    assert.ok(outcome, `pointer path rejected ${step.action}`);
    viaPointer = outcome.run;
  }

  assert.deepEqual(viaPointer, viaSlider);
  assert.equal(JSON.stringify(viaPointer), JSON.stringify(viaSlider));
});

// ─── The translation layer's own failure modes ────────────────────────────────

test('coalesced samples are all consumed, not just the dispatched one', () => {
  // Dropping the batch makes the filtered value lag the finger, which on a
  // fast pull commits a lower conviction than the player was shown.
  const session = new PullSession();
  const origin = { x: 100, y: 100 };
  session.down({ pointerId: 1, clientX: origin.x, clientY: origin.y, timeStamp: 0 }, 'REDUCE', true);

  const batch: PointerSample[] = [40, 80, 120].map((d, i) => ({
    pointerId: 1, clientX: origin.x, clientY: origin.y + d, timeStamp: 8 * (i + 1),
  }));
  const withBatch = session.move(batch, batch[batch.length - 1]);

  const solo = new PullSession();
  solo.down({ pointerId: 1, clientX: origin.x, clientY: origin.y, timeStamp: 0 }, 'REDUCE', true);
  const withoutBatch = solo.move([], batch[batch.length - 1]);

  assert.ok(withBatch && withBatch.type === 'MOVE');
  assert.ok(withoutBatch && withoutBatch.type === 'MOVE');
  assert.notEqual(
    withBatch.distance, withoutBatch.distance,
    'consuming the coalesced batch must change the filtered distance',
  );
});

test('the filter resets between pulls, so one gesture cannot bend the next', () => {
  const session = new PullSession();
  const origin = { x: 100, y: 100 };

  // A long pull, released.
  session.down({ pointerId: 1, clientX: origin.x, clientY: origin.y, timeStamp: 0 }, 'REDUCE', true);
  for (let i = 1; i <= 10; i++) {
    const s = { pointerId: 1, clientX: origin.x, clientY: origin.y + 19 * i, timeStamp: 8 * i };
    session.move([s], s);
  }
  session.up({ pointerId: 1, clientX: origin.x, clientY: origin.y + 190, timeStamp: 400 });

  // A fresh short pull must start from its own first sample, not from 190.
  session.down({ pointerId: 1, clientX: origin.x, clientY: origin.y, timeStamp: 500 }, 'HOLD', true);
  const s = { pointerId: 1, clientX: origin.x, clientY: origin.y + 30, timeStamp: 508 };
  const ev = session.move([s], s);
  assert.ok(ev && ev.type === 'MOVE');
  assert.ok(ev.distance < 60, `filter carried state across pulls: ${ev.distance}`);
});

test('a move without a preceding down produces nothing', () => {
  const session = new PullSession();
  const s: PointerSample = { pointerId: 1, clientX: 10, clientY: 10, timeStamp: 5 };
  assert.equal(session.move([s], s), null);
  assert.equal(session.engaged, false);
});

test('release timestamps come from the input event, not a render clock', () => {
  // A slow frame must never turn a deliberate pull into a flick, so the value
  // the floor measures is whatever the pointer event carried.
  const session = new PullSession();
  session.down({ pointerId: 1, clientX: 0, clientY: 0, timeStamp: 1000 }, 'HOLD', true);
  const up = session.up({ pointerId: 1, clientX: 0, clientY: 200, timeStamp: 1900 });
  assert.equal(up.type, 'RELEASE');
  assert.equal(up.timestamp, 1900);
});
