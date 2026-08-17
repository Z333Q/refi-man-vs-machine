import { test } from 'node:test';
import assert from 'node:assert/strict';

import { launchEase } from './ResolutionRace';
import { CONVICTION_MIN, CONVICTION_MAX, CONVICTION_DEFAULT } from '../../lib/decisionContract';

// ─── The throw ────────────────────────────────────────────────────────────────
// The pull is a draw and the race is the flight. These tests hold the line
// between "the draw shapes how the line leaves" (true, and the point) and "the
// draw changes where the line lands" (false, and a fabricated performance
// claim under §58).

test('the curve always arrives, whatever the draw', () => {
  // The endpoint is authored market data. Conviction must never move it.
  for (let c = CONVICTION_MIN; c <= CONVICTION_MAX; c += 5) {
    assert.equal(launchEase(1, c), 1, `conviction ${c} does not finish`);
    assert.equal(launchEase(0, c), 0, `conviction ${c} does not start at zero`);
  }
});

test('the resting default is the linear draw it always was', () => {
  // A player who never touches the meter sees exactly the animation that
  // shipped before the throw existed.
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    assert.ok(
      Math.abs(launchEase(t, CONVICTION_DEFAULT) - t) < 0.02,
      `default draw is not near-linear at t=${t}`,
    );
  }
});

test('a harder draw leaves harder', () => {
  // Early in the flight, more draw means more distance covered. This is the
  // whole felt difference, and it must be monotonic or it reads as noise.
  for (const t of [0.05, 0.15, 0.3]) {
    let previous = -Infinity;
    for (let c = CONVICTION_MIN; c <= CONVICTION_MAX; c += 5) {
      const covered = launchEase(t, c);
      assert.ok(covered > previous, `draw ${c} covers no more than ${c - 5} at t=${t}`);
      previous = covered;
    }
  }
});

test('the draw never runs the curve backwards', () => {
  for (const c of [CONVICTION_MIN, CONVICTION_DEFAULT, CONVICTION_MAX]) {
    let previous = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const v = launchEase(t, c);
      assert.ok(v >= previous, `curve reversed at t=${t.toFixed(2)}, conviction ${c}`);
      assert.ok(v >= 0 && v <= 1, `curve left the unit range at t=${t.toFixed(2)}`);
      previous = v;
    }
  }
});

test('out-of-range inputs are clamped rather than extrapolated', () => {
  // A conviction outside the published scale would otherwise produce an
  // exponent the geometry never intended.
  assert.equal(launchEase(0.4, 10), launchEase(0.4, CONVICTION_MIN));
  assert.equal(launchEase(0.4, 200), launchEase(0.4, CONVICTION_MAX));
  assert.equal(launchEase(-1, CONVICTION_DEFAULT), 0);
  assert.equal(launchEase(5, CONVICTION_DEFAULT), 1);
});
