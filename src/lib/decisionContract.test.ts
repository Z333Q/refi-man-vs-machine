import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionBranch, ThesisCode } from './gameTypes';
import { COVID_CHECKPOINTS } from './covidArena';
import { createInitialRun, commitPendingDecision, advanceRunCheckpoint } from './runEngine';
import {
  THESIS_OPTIONS, thesisLabel, stanceLine, stanceTitle,
  convictionRange, isConvictionClamped, clampConviction,
  convictionToConfidence, confidenceToConviction, consultedRisk,
  CONVICTION_DEFAULT, CONVICTION_UNLOCK_CHECKPOINT, PANEL_MODULE,
} from './decisionContract';

// ─── Thesis ───────────────────────────────────────────────────────────────────

test('every thesis code is offered exactly once', () => {
  const codes = THESIS_OPTIONS.map(t => t.code);
  assert.equal(new Set(codes).size, codes.length, 'duplicate thesis codes');

  // Every ThesisCode in the union must be selectable, or a decision record can
  // hold a code the player was never able to choose.
  const declared: ThesisCode[] = [
    'DETERIORATING_FUNDAMENTALS', 'PANIC_REDUCTION', 'VOLATILITY_CONTROL',
    'LIQUIDITY_PRESERVATION', 'VALUATION', 'REGIME_CHANGE', 'POLICY_RESPONSE',
    'THESIS_UNCHANGED', 'DIVERSIFICATION', 'MOMENTUM', 'CONTRARIAN',
  ];
  for (const c of declared) {
    assert.ok(codes.includes(c), `thesis ${c} is not offered`);
  }
  assert.equal(codes.length, declared.length);
});

test('thesis labels match their code semantics', () => {
  // The prototype shipped these three miswired; they are the regression guard.
  assert.equal(thesisLabel('LIQUIDITY_PRESERVATION'), 'LIQUIDITY PRESERVATION');
  assert.equal(thesisLabel('CONTRARIAN'), 'CONTRARIAN');
  assert.equal(thesisLabel('VALUATION'), 'VALUATION SUPPORT');

  // No label may be the wrong code's meaning: a label must not read as a
  // different offered code's label.
  const labels = THESIS_OPTIONS.map(t => t.label);
  assert.equal(new Set(labels).size, labels.length, 'duplicate thesis labels');
});

test('thesis labels carry no em dashes', () => {
  for (const t of THESIS_OPTIONS) {
    assert.ok(!t.label.includes('—'), `${t.code} label contains an em dash`);
  }
});

// ─── Conviction ───────────────────────────────────────────────────────────────

test('conviction is clamped before CP5 and open from CP5', () => {
  for (let cp = 1; cp < CONVICTION_UNLOCK_CHECKPOINT; cp++) {
    assert.equal(isConvictionClamped(cp), true, `CP${cp} should be clamped`);
    assert.deepEqual(convictionRange(cp), { min: 60, max: 75 });
  }
  for (let cp = CONVICTION_UNLOCK_CHECKPOINT; cp <= 14; cp++) {
    assert.equal(isConvictionClamped(cp), false, `CP${cp} should be open`);
    assert.deepEqual(convictionRange(cp), { min: 50, max: 95 });
  }
});

test('the default conviction sits inside every checkpoint range', () => {
  for (let cp = 1; cp <= 14; cp++) {
    const { min, max } = convictionRange(cp);
    assert.ok(CONVICTION_DEFAULT >= min && CONVICTION_DEFAULT <= max, `CP${cp}`);
    assert.equal(clampConviction(CONVICTION_DEFAULT, cp), CONVICTION_DEFAULT);
  }
});

test('clamping pins out-of-range conviction to the exposed bounds', () => {
  assert.equal(clampConviction(95, 1), 75);  // clamped early
  assert.equal(clampConviction(50, 1), 60);
  assert.equal(clampConviction(95, 9), 95);  // open later
  assert.equal(clampConviction(20, 9), 50);
});

test('conviction and confidence round-trip', () => {
  for (const v of [50, 60, 70, 75, 85, 95]) {
    assert.equal(confidenceToConviction(convictionToConfidence(v)), v);
  }
  assert.equal(convictionToConfidence(70), 0.7);
});

test('a committed decision records the clamped conviction, not the raw one', () => {
  let run = createInitialRun();
  // CP1 caps at 75; try to smuggle a 95 straight into run state.
  run = {
    ...run,
    pendingAction: 'HOLD',
    pendingThesis: 'THESIS_UNCHANGED',
    pendingConfidence: convictionToConfidence(95),
  };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);
  assert.equal(confidenceToConviction(outcome.run.decisions[0].confidence ?? 0), 75);
});

test('conviction resets to the default at each new checkpoint', () => {
  let run = createInitialRun();
  run = {
    ...run,
    pendingAction: 'HOLD',
    pendingThesis: 'THESIS_UNCHANGED',
    pendingConfidence: convictionToConfidence(75),
  };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);
  const next = advanceRunCheckpoint(outcome.run);
  assert.equal(confidenceToConviction(next.pendingConfidence), CONVICTION_DEFAULT);
});

// ─── Stance cards ─────────────────────────────────────────────────────────────

test('every authored branch produces a title and a description line', () => {
  for (const cp of COVID_CHECKPOINTS) {
    for (const branch of cp.availableActions) {
      const title = stanceTitle(branch);
      const line = stanceLine(branch);
      assert.ok(title.length > 0, `CP${cp.sequence} ${branch.actionCode} has no title`);
      assert.ok(line.length > 0, `CP${cp.sequence} ${branch.actionCode} has no line`);
    }
  }
});

test('stance card copy carries no em dashes', () => {
  // Addendum A Section G: em dashes are barred from player-facing copy, and
  // scripts/em-dash-gate.mjs enforces it across the content files. This is the
  // unit-level guard on what the card itself renders.
  for (const cp of COVID_CHECKPOINTS) {
    for (const branch of cp.availableActions) {
      assert.ok(!stanceTitle(branch).includes('—'), `CP${cp.sequence} title`);
      assert.ok(!stanceLine(branch).includes('—'), `CP${cp.sequence} ${branch.actionCode} line`);
    }
  }
});

test('the card title is the authored shortLabel, verbatim', () => {
  for (const cp of COVID_CHECKPOINTS) {
    for (const branch of cp.availableActions) {
      assert.equal(stanceTitle(branch), branch.shortLabel, `CP${cp.sequence}`);
    }
  }
});

test('the card sublabel is the label text after the first colon separator', () => {
  for (const cp of COVID_CHECKPOINTS) {
    for (const branch of cp.availableActions) {
      const at = branch.label.indexOf(': ');
      if (at === -1) continue; // falls back by action code, covered below
      assert.equal(stanceLine(branch), branch.label.slice(at + 2).trim(), `CP${cp.sequence}`);
      // The title half never leaks into the sublabel.
      assert.ok(!stanceLine(branch).startsWith(branch.label.slice(0, at)), `CP${cp.sequence}`);
    }
  }
});

test('every authored branch label uses the colon separator', () => {
  // The card derivation depends on the convention, so the convention is tested
  // rather than assumed.
  for (const cp of COVID_CHECKPOINTS) {
    for (const branch of cp.availableActions) {
      assert.ok(
        branch.label.includes(': '),
        `CP${cp.sequence} ${branch.actionCode} label has no ": " separator: ${branch.label}`,
      );
    }
  }
});

test('only the first colon separates the title from the description', () => {
  const branch: ActionBranch = {
    actionCode: 'HOLD',
    label: 'HOLD: wait: the thesis is intact',
    shortLabel: 'HOLD',
    turnoverCost: 0,
    branchEffect: { flagsAdd: [], alphaImpact: {} },
  };
  assert.equal(stanceLine(branch), 'wait: the thesis is intact');
});

test('a branch label with no separator falls back by action code', () => {
  const branch: ActionBranch = {
    actionCode: 'RAISE_CASH',
    label: 'RAISE CASH',
    shortLabel: 'RAISE CASH',
    turnoverCost: 0.04,
    branchEffect: { flagsAdd: [], alphaImpact: {} },
  };
  assert.equal(stanceLine(branch), 'move capital out of equities into cash');
});

test('every checkpoint offers between two and four stances', () => {
  for (const cp of COVID_CHECKPOINTS) {
    assert.ok(
      cp.availableActions.length >= 2 && cp.availableActions.length <= 4,
      `CP${cp.sequence} offers ${cp.availableActions.length}`,
    );
  }
});

test('every checkpoint offers HOLD, so the free stance is always reachable', () => {
  for (const cp of COVID_CHECKPOINTS) {
    assert.ok(
      cp.availableActions.some(a => a.actionCode === 'HOLD'),
      `CP${cp.sequence} has no HOLD branch`,
    );
  }
});

// ─── Investigation pays ───────────────────────────────────────────────────────

test('consulting risk before a regime call earns GOOD_PROCESS', () => {
  const regimeCp = COVID_CHECKPOINTS.find(c => c.isRegimeChange);
  assert.ok(regimeCp, 'arena has no regime-change checkpoint');

  const base = createInitialRun();
  const stance = regimeCp.availableActions[0].actionCode;

  const withRisk = commitPendingDecision({
    ...base,
    currentCheckpoint: regimeCp.sequence,
    investigatedModules: [PANEL_MODULE.RISK],
    pendingAction: stance,
    pendingThesis: 'REGIME_CHANGE',
  });
  assert.ok(withRisk);
  assert.ok(withRisk.run.decisions[0].behavioralFlags.includes('GOOD_PROCESS'));

  const withoutRisk = commitPendingDecision({
    ...base,
    currentCheckpoint: regimeCp.sequence,
    investigatedModules: [],
    pendingAction: stance,
    pendingThesis: 'REGIME_CHANGE',
  });
  assert.ok(withoutRisk);
  const authored = regimeCp.availableActions[0].branchEffect.flagsAdd.includes('GOOD_PROCESS');
  assert.equal(withoutRisk.run.decisions[0].behavioralFlags.includes('GOOD_PROCESS'), authored);

  // Consulting risk pays at least as well as not consulting it.
  assert.ok(withRisk.score.totalScore >= withoutRisk.score.totalScore);
});

test('consulting risk on a non-regime checkpoint adds no unearned flag', () => {
  const quietCp = COVID_CHECKPOINTS.find(c => !c.isRegimeChange);
  assert.ok(quietCp);
  const base = createInitialRun();
  const branch = quietCp.availableActions[0];

  const outcome = commitPendingDecision({
    ...base,
    currentCheckpoint: quietCp.sequence,
    investigatedModules: [PANEL_MODULE.RISK],
    pendingAction: branch.actionCode,
    pendingThesis: 'THESIS_UNCHANGED',
  });
  assert.ok(outcome);
  assert.deepEqual(
    outcome.run.decisions[0].behavioralFlags,
    branch.branchEffect.flagsAdd,
    'flags should be exactly what the branch authored',
  );
});

test('the risk panel is what consultedRisk looks for', () => {
  assert.equal(consultedRisk([PANEL_MODULE.RISK]), true);
  assert.equal(consultedRisk([PANEL_MODULE.PORTFOLIO]), false);
  assert.equal(consultedRisk([]), false);
});

// ─── The contract itself ──────────────────────────────────────────────────────

test('a decision cannot commit without a stance', () => {
  const run = createInitialRun();
  assert.equal(commitPendingDecision({ ...run, pendingAction: null }), null);
});

test('a committed decision is exactly stance, thesis and conviction', () => {
  let run = createInitialRun();
  run = {
    ...run,
    pendingAction: 'REDUCE',
    pendingThesis: 'DETERIORATING_FUNDAMENTALS',
    pendingConfidence: convictionToConfidence(70),
  };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);
  const d = outcome.run.decisions[0];
  assert.equal(d.actionCode, 'REDUCE');
  assert.equal(d.thesisCode, 'DETERIORATING_FUNDAMENTALS');
  assert.equal(confidenceToConviction(d.confidence ?? 0), 70);
  // No symbol-level orders survive anywhere in the record.
  assert.equal('orders' in d, false);
  assert.equal('symbol' in d, false);
});
