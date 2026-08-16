import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BehavioralFlag, CheckpointScore } from './gameTypes';
import {
  deriveVerdict, dominantComponent, nudgeFor, verdictSign, verdictStamp, NEUTRAL,
} from './verdict';

function score(partial: Partial<CheckpointScore> = {}): CheckpointScore {
  return {
    raerScore: NEUTRAL,
    drawdownScore: NEUTRAL,
    downsideScore: NEUTRAL,
    recoveryScore: NEUTRAL,
    regimeAdaptScore: NEUTRAL,
    turnoverScore: NEUTRAL,
    consistencyScore: NEUTRAL,
    positionSizingScore: NEUTRAL,
    totalScore: 65,
    machineScore: 65,
    delta: 0,
    quality: 'NEUTRAL',
    ...partial,
  };
}

// ─── The law ──────────────────────────────────────────────────────────────────

test('the sign of the presentation always matches the sign of the score', () => {
  // The bug this pins: beating par and being told the call was a mistake in
  // the same breath. A win may never carry a criticism, and a loss may never
  // carry a second one.
  for (let delta = -20; delta <= 20; delta++) {
    const v = deriveVerdict(score({ delta, turnoverScore: 20, consistencyScore: 20 }), ['ACTION_BIAS']);

    if (delta < 0) {
      assert.equal(v.sign, 'UNDER_PAR');
      assert.equal(v.nudge, null, `a loss (delta ${delta}) must never be given a second criticism`);
      assert.ok(v.headline.startsWith('Under par by '), v.headline);
    } else {
      assert.notEqual(v.sign, 'UNDER_PAR');
      assert.ok(
        v.headline.startsWith('Beat par by ') || v.headline.startsWith('Level with par'),
        v.headline,
      );
    }
  }
});

test('every verdict states the margin plainly and never dramatizes a near miss', () => {
  // Margin is data. A one point loss reads exactly like a fifteen point loss,
  // in structure and in wording, so nothing here can grow into "so close".
  const near = deriveVerdict(score({ delta: -1 }));
  const far = deriveVerdict(score({ delta: -15 }));

  assert.equal(near.headline.startsWith('Under par by 1.'), true, near.headline);
  assert.equal(far.headline.startsWith('Under par by 15.'), true, far.headline);
  // Same shape: verdict clause, then cause clause. No extra emphasis anywhere.
  assert.equal(near.headline.split('. ').length, far.headline.split('. ').length);

  for (const v of [near, far]) {
    for (const banned of ['so close', 'nearly', 'almost', 'just missed', '!']) {
      assert.equal(v.headline.toLowerCase().includes(banned), false, `${banned} in "${v.headline}"`);
    }
  }
});

// ─── Dominant cause ───────────────────────────────────────────────────────────

test('a win names what carried it, a loss names what cost it', () => {
  // Turnover far above neutral, everything else flat: turnover is the driver
  // whichever way the verdict went, but the sentence changes.
  const won = deriveVerdict(score({ delta: 4, turnoverScore: 95 }));
  assert.equal(won.dominant, 'TURNOVER');
  assert.match(won.headline, /spent no turnover you did not need/);

  const lost = deriveVerdict(score({ delta: -4, turnoverScore: 10 }));
  assert.equal(lost.dominant, 'TURNOVER');
  assert.match(lost.headline, /turnover went out without edge/i);
});

test('the driver is weighted, not raw: a big move in a light component loses to a smaller move in a heavy one', () => {
  // RAER carries 0.25, TURNOVER 0.10. A +20 on turnover is worth 2.0; a +15 on
  // RAER is worth 3.75, so RAER must win despite the smaller raw delta.
  const s = score({ delta: 5, turnoverScore: NEUTRAL + 20, raerScore: NEUTRAL + 15 });
  assert.equal(dominantComponent(s, 'BEAT_PAR'), 'RAER');
});

test('components that cannot move the total are never named as the cause', () => {
  // recoveryScore is a flat constant and positionSizingScore is not in the
  // weighted total, so neither may ever be offered as the reason for a result
  // the player is looking at.
  const s = score({ delta: 3, recoveryScore: 100, positionSizingScore: 100 });
  const chosen = dominantComponent(s, 'BEAT_PAR');
  assert.notEqual(chosen, 'RECOVERY' as unknown as typeof chosen);
  assert.notEqual(chosen, 'POSITION_SIZING' as unknown as typeof chosen);
});

test('the same score always produces the same sentence', () => {
  // Determinism reaches the words, not just the numbers (§65). Ties break on a
  // fixed component order, so a replayed seed reproduces the verdict text.
  const s = score({ delta: 2 });
  const a = deriveVerdict(s);
  const b = deriveVerdict(s);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ─── The nudge ────────────────────────────────────────────────────────────────

test('the nudge is a cost, attached only to results that went the player way', () => {
  const flags: BehavioralFlag[] = [];

  // Won, but at a turnover pace the budget cannot hold.
  const paced = deriveVerdict(score({ delta: 3, turnoverScore: 40 }), flags);
  assert.ok(paced.nudge, 'a winning checkpoint with a bad pace should carry a nudge');
  assert.match(paced.nudge!, /budget/i);

  // Same pace, but the checkpoint was lost: no nudge, the headline already
  // carried the correction.
  const lost = deriveVerdict(score({ delta: -3, turnoverScore: 40 }), flags);
  assert.equal(lost.nudge, null);

  // Won cleanly: nothing to add.
  const clean = deriveVerdict(score({ delta: 3 }), flags);
  assert.equal(clean.nudge, null);
});

test('the nudge never contradicts the headline it sits under', () => {
  // It may name a cost, a habit or a calibration gap. It may never call the
  // committed decision wrong, because line 1 just called it right.
  const cases: CheckpointScore[] = [
    score({ delta: 1, turnoverScore: 20 }),
    score({ delta: 6, consistencyScore: 20 }),
    score({ delta: 0, turnoverScore: 10 }),
  ];
  for (const s of cases) {
    const v = deriveVerdict(s, ['ACTION_BIAS']);
    if (!v.nudge) continue;
    for (const banned of ['mistake', 'wrong', 'error', 'should not have', 'overreaction']) {
      assert.equal(
        v.nudge.toLowerCase().includes(banned), false,
        `nudge "${v.nudge}" contradicts a non-negative verdict`,
      );
    }
  }
});

test('nudgeFor is silent on losses regardless of how many habits are firing', () => {
  const worst = score({ delta: -9, turnoverScore: 0, consistencyScore: 0 });
  assert.equal(nudgeFor('UNDER_PAR', worst, ['ACTION_BIAS', 'PANIC_SELL' as BehavioralFlag]), null);
});

// ─── Stamp ────────────────────────────────────────────────────────────────────

test('the stamp states the signed margin, or names the tie', () => {
  assert.equal(verdictStamp('BEAT_PAR', 4), 'BEAT PAR +4');
  assert.equal(verdictStamp('UNDER_PAR', -3), 'UNDER PAR -3');
  assert.equal(verdictStamp('AT_PAR', 0), 'LEVEL WITH PAR');
});

test('verdictSign maps delta to the three outcomes', () => {
  assert.equal(verdictSign(1), 'BEAT_PAR');
  assert.equal(verdictSign(0), 'AT_PAR');
  assert.equal(verdictSign(-1), 'UNDER_PAR');
});
