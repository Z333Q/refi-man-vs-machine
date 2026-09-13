import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSharpe, SCORE_WEIGHTS } from './scoringEngine';

// The risk-adjusted return term, as signed off on 2026-09-12.
//
// It replaces a term that divided the player's return difference from the
// machine by that difference's own absolute value — the sign of the difference
// for anything above a tenth of a basis point — where the difference itself was
// a fixed bonus for matching the machine's stance. A quarter of the ReFi Score,
// its largest single component, was a two-valued verdict on agreement: about 88
// for matching, about 12 for not. These pin the fixed scale that replaced it.

const FULL_SAMPLES = 5;

test('the scale is linear, symmetric, and 50 at a Sharpe of zero', () => {
  // The signed-off table, verbatim.
  const table: [number, number][] = [
    [-2.5, 0],
    [-2.0, 10],
    [-1.0, 30],
    [-0.5, 40],
    [0.0, 50],
    [0.5, 60],
    [1.0, 70],
    [2.0, 90],
    [2.5, 100],
  ];
  for (const [sharpe, expected] of table) {
    assert.equal(
      normalizeSharpe(sharpe, FULL_SAMPLES),
      expected,
      `Sharpe ${sharpe} should score ${expected}`,
    );
  }
});

test('the scale saturates rather than running off either end', () => {
  assert.equal(normalizeSharpe(4.56, FULL_SAMPLES), 100);
  assert.equal(normalizeSharpe(-9, FULL_SAMPLES), 0);
});

test('an unmeasurable run is neutral, never zero', () => {
  // Zero would read as catastrophic risk-adjusted performance on a run that
  // has simply not produced two returns yet.
  assert.equal(normalizeSharpe(null, 0), 50);
  assert.equal(normalizeSharpe(null, 1), 50);
  assert.equal(normalizeSharpe(Number.NaN, 9), 50);
  assert.equal(normalizeSharpe(Number.POSITIVE_INFINITY, 9), 50);
});

test('confidence ramps with the sample count and reaches full weight at five', () => {
  // Two nearly identical early returns produce an enormous Sharpe from almost
  // no evidence, and a quarter of the score must not turn on that.
  const strong = 2.0; // scores 90 at full weight
  assert.equal(normalizeSharpe(strong, 2), 60, '25% of the way at two samples');
  assert.equal(normalizeSharpe(strong, 3), 70, 'half at three');
  assert.equal(normalizeSharpe(strong, 4), 80, 'three quarters at four');
  assert.equal(normalizeSharpe(strong, 5), 90, 'full weight at five');
  assert.equal(normalizeSharpe(strong, 22), 90, 'and no further');
});

test('damping pulls toward neutral from both directions', () => {
  assert.equal(normalizeSharpe(-2.0, 2), 40, 'a poor run is not condemned on two points either');
  assert.equal(normalizeSharpe(-2.0, FULL_SAMPLES), 10);
});

test('the same scale serves both sides, so neither score defines the other', () => {
  // The player's component is a function of the player's own run. Feeding the
  // machine's Sharpe through the identical function is what makes the two
  // comparable without making one derived from the other.
  const player = normalizeSharpe(1.2, 8);
  const machine = normalizeSharpe(1.2, 8);
  assert.equal(player, machine, 'identical inputs, identical output, no cross terms');
  assert.equal(player, 74);
});

test('it is still the largest single weight in the checkpoint score', () => {
  // §29.1. If this term ever stops being a quarter of the score, the reasoning
  // above about how much rides on it stops holding.
  assert.equal(SCORE_WEIGHTS.raerScore, 0.25);
  const others = Object.entries(SCORE_WEIGHTS).filter(([k]) => k !== 'raerScore');
  for (const [name, w] of others) {
    assert.ok(w <= SCORE_WEIGHTS.raerScore, `${name} outweighs risk-adjusted return`);
  }
  const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
});
