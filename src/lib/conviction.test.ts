import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreCheckpoint, convictionMultiplier } from './scoringEngine';
import { CONVICTION_MIN, CONVICTION_MAX, CONVICTION_DEFAULT } from './decisionContract';
import { COVID_CHECKPOINTS } from './covidArena';
import type { ActionCode } from './gameTypes';

// ─── Conviction has consequence ───────────────────────────────────────────────
// Before the scaling landed, sweeping the whole 50-95 range moved the checkpoint
// total by at most one point, and for most stances by nothing at all. The
// control had a calibrated physical model behind it and no effect at the far
// end. These tests exist so that can never quietly become true again.

const checkpoint = COVID_CHECKPOINTS[1];

/**
 * `sharpe` is the run-so-far risk-adjusted return of the side being scored.
 *
 * It defaults to a run that is genuinely doing well, because conviction scales
 * the distance from par and a fixture sitting exactly on par has no distance
 * to scale: every stance would round to par at every conviction and the test
 * would pass by measuring nothing.
 * It is what decides whether a checkpoint lands above or below par now that
 * the largest score component measures the run rather than agreement with the
 * machine, so a test about the downside has to describe a run that is behind.
 */
const WINNING_SHARPE = 1.5;

function scoreAt(action: ActionCode, conviction: number, sharpe: number | null = WINNING_SHARPE): number {
  return scoreCheckpoint({
    action,
    checkpoint,
    flags: [],
    confidence: conviction / 100,
    turnoverUsed: 0.05,
    turnoverBudget: 0.40,
    checkpointReturn: -0.02,
    sharpe,
    sharpeSamples: sharpe === null ? 0 : 8,
    portfolioDD: -0.04,
  }).totalScore;
}

/** A run whose risk-adjusted return is genuinely poor. */
const LOSING_SHARPE = -1.5;

/** Binary floating point does not land on 0.2 exactly; the engine is fine. */
function near(actual: number, expected: number, label: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} vs ${expected}`);
}

test('the multiplier is anchored at the resting default', () => {
  // A player who never touches the meter is neither rewarded nor punished for
  // it: the value the control rests at must be the unscaled one.
  near(convictionMultiplier(CONVICTION_DEFAULT / 100), 1, 'default');
  near(convictionMultiplier(CONVICTION_MIN / 100), 0.2, 'floor');
  near(convictionMultiplier(CONVICTION_MAX / 100), 2, 'ceiling');
});

test('the multiplier is monotonic across the scale', () => {
  let previous = -Infinity;
  for (let c = CONVICTION_MIN; c <= CONVICTION_MAX; c += 1) {
    const m = convictionMultiplier(c / 100);
    assert.ok(m > previous, `multiplier fell between ${c - 1} and ${c}`);
    previous = m;
  }
});

test('conviction moves the score for every stance, not just one', () => {
  // The measurement that opened this work: HOLD moved by one point, REDUCE and
  // RAISE_CASH by zero. A stance whose score is flat across the scale means the
  // meter is decoration on that stance.
  const stances: ActionCode[] = ['HOLD', 'REDUCE', 'RAISE_CASH', 'ROTATE_DEFENSIVE'];
  for (const action of stances) {
    const low = scoreAt(action, CONVICTION_MIN);
    const high = scoreAt(action, CONVICTION_MAX);
    assert.notEqual(low, high, `${action} scores identically at 50 and 95`);
  }
});

test('conviction scales distance from par symmetrically', () => {
  // The property, stated as the engine states it: conviction multiplies how far
  // the checkpoint lands from par, in whichever direction it was already going.
  // A hedged call keeps most of par; a maximal call doubles the gap either way.
  const stances: ActionCode[] = ['HOLD', 'REDUCE', 'RAISE_CASH', 'ROTATE_DEFENSIVE'];
  const par = checkpoint.machinePar;

  // Conviction scales a distance. Where a stance happens to land exactly on
  // par at the resting conviction there is no distance to scale, and whole-
  // point rounding decides the sign: the property is vacuous rather than
  // violated, so those stances are skipped and the test asserts that some
  // stance was actually off par to measure.
  let measured = 0;

  for (const action of stances) {
    const atDefault = scoreAt(action, CONVICTION_DEFAULT) - par;
    if (Math.abs(atDefault) < 1) continue;
    measured++;

    const atMin = scoreAt(action, CONVICTION_MIN) - par;
    const atMax = scoreAt(action, CONVICTION_MAX) - par;

    // Raising conviction widens the gap and never flips its direction.
    assert.equal(Math.sign(atMax), Math.sign(atDefault), `${action} flipped sign at 95`);
    assert.ok(
      Math.abs(atMax) > Math.abs(atDefault),
      `${action} does not widen the gap at 95`,
    );

    // Lowering it narrows the gap toward par, and may land on par: the hedged
    // multiplier is 0.2, so any gap under three points rounds into par at 50.
    // What must never happen is crossing to the far side of it.
    assert.ok(
      Math.abs(atMin) < Math.abs(atDefault),
      `${action} does not narrow the gap at 50`,
    );
    assert.ok(
      atMin === 0 || Math.sign(atMin) === Math.sign(atDefault),
      `${action} crossed par at 50: ${atMin} against ${atDefault}`,
    );
  }

  assert.ok(measured > 0, 'every stance landed on par: the fixture measures nothing');
});

test('wrong at maximum conviction costs roughly double', () => {
  // The tip authored in the CP2 coaching copy says being wrong at 95 costs
  // double. That was false when it was written. It is a claim the engine now
  // has to honour, so it is asserted rather than trusted.
  const losing = (['REDUCE', 'RAISE_CASH', 'ROTATE_DEFENSIVE'] as ActionCode[])
    .find((a) => scoreAt(a, CONVICTION_DEFAULT, LOSING_SHARPE) < checkpoint.machinePar);
  assert.ok(losing, 'fixture has no under-par stance to test the downside with');

  const par = checkpoint.machinePar;
  const atDefault = par - scoreAt(losing, CONVICTION_DEFAULT, LOSING_SHARPE);
  const atMax = par - scoreAt(losing, CONVICTION_MAX, LOSING_SHARPE);

  // Whole-point rounding, and the 0-100 clamp, keep this from being exact.
  assert.ok(atMax >= atDefault * 1.8, `loss at 95 was ${atMax} against ${atDefault} at 70`);
});

test('the score stays inside the published range at the extremes', () => {
  const stances: ActionCode[] = ['HOLD', 'REDUCE', 'RAISE_CASH', 'ROTATE_DEFENSIVE'];
  for (const action of stances) {
    for (const conviction of [CONVICTION_MIN, CONVICTION_DEFAULT, CONVICTION_MAX]) {
      const score = scoreAt(action, conviction);
      assert.ok(score >= 0 && score <= 100, `${action} at ${conviction} scored ${score}`);
      assert.equal(score, Math.round(score), `${action} at ${conviction} is not a whole point`);
    }
  }
});
