import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionBranch, ThesisCode } from './gameTypes';
import { COVID_CHECKPOINTS } from './covidArena';
import { createInitialRun, commitPendingDecision, advanceRunCheckpoint, attachThesis, awaitingThesis } from './runEngine';
import {
  THESIS_OPTIONS, thesisLabel, thesisOptionsFor, stanceLine, stanceTitle,
  convictionSpan, convictionGovernor, isGovernorActive, clampConviction,
  convictionToConfidence, confidenceToConviction, consultedRisk,
  isDetent, isLandmark,
  CONVICTION_MIN, CONVICTION_MAX, CONVICTION_STEP, CONVICTION_DETENT,
  CONVICTION_DEFAULT, GOVERNOR_BOUNDS, GOVERNOR_LIFTS_AT_CHECKPOINT,
  THESIS_TIMEOUT_CODE, PANEL_MODULE,
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
  // THESIS_UNSTATED is recorded on timeout and is deliberately not selectable.
  assert.equal(codes.includes('THESIS_UNSTATED'), false);
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

test('the control span is permanent at every checkpoint', () => {
  // Addendum C section 4: the mapping never changes. The span the player sees
  // and calibrates against is identical at CP1 and CP14.
  for (let cp = 1; cp <= 14; cp++) {
    assert.deepEqual(convictionSpan(), { min: CONVICTION_MIN, max: CONVICTION_MAX });
  }
  assert.deepEqual(convictionSpan(), { min: 50, max: 95 });
});

test('the governor caps the value without moving the span', () => {
  for (let cp = 1; cp < GOVERNOR_LIFTS_AT_CHECKPOINT; cp++) {
    assert.equal(isGovernorActive(cp), true, `CP${cp} should be governed`);
    assert.deepEqual(convictionGovernor(cp), { min: 60, max: 75 });
    // The span is untouched while the governor is on. This is the whole point:
    // a governed checkpoint is the same road with a limiter, not a new road.
    assert.deepEqual(convictionSpan(), { min: 50, max: 95 });
  }
  for (let cp = GOVERNOR_LIFTS_AT_CHECKPOINT; cp <= 14; cp++) {
    assert.equal(isGovernorActive(cp), false, `CP${cp} should be open`);
    assert.deepEqual(convictionGovernor(cp), { min: 50, max: 95 });
  }
});

test('the governor raises the floor as well as capping the ceiling', () => {
  assert.equal(GOVERNOR_BOUNDS.min, 60);
  assert.equal(GOVERNOR_BOUNDS.max, 75);
  assert.equal(clampConviction(50, 1), 60);
  assert.equal(clampConviction(95, 1), 75);
});

test('lifting the governor does not change what a given value means', () => {
  // The regression this guards: if the clamp were a remap, the same position
  // on the control would mean 75 at CP4 and 95 at CP5. It must not.
  const governedMidpoint = clampConviction(70, 4);
  const openMidpoint = clampConviction(70, 5);
  assert.equal(governedMidpoint, openMidpoint, '70 must mean 70 on both sides of CP5');
  assert.equal(governedMidpoint, 70);
});

test('conviction is integer-resolution and is never snapped to detents', () => {
  assert.equal(CONVICTION_STEP, 1);
  // Every value in the open range survives the clamp untouched.
  for (let v = CONVICTION_MIN; v <= CONVICTION_MAX; v++) {
    assert.equal(clampConviction(v, 9), v, `${v} should be committable`);
  }
  // Specifically the ones between detents, which is what gives calibration
  // its resolution.
  for (const v of [72, 73, 74, 81, 87, 91]) {
    assert.equal(clampConviction(v, 9), v);
    assert.equal(isDetent(v), false);
  }
});

test('detents and landmarks are labels on the scale, not values of it', () => {
  assert.equal(CONVICTION_DETENT, 5);
  assert.equal(isDetent(70), true);
  assert.equal(isDetent(72), false);
  assert.equal(isLandmark(70), true);
  assert.equal(isLandmark(85), true);
  assert.equal(isLandmark(95), true);
  assert.equal(isLandmark(75), false);
});

test('the default conviction sits inside every checkpoint governor', () => {
  for (let cp = 1; cp <= 14; cp++) {
    const { min, max } = convictionGovernor(cp);
    assert.ok(CONVICTION_DEFAULT >= min && CONVICTION_DEFAULT <= max, `CP${cp}`);
    assert.equal(clampConviction(CONVICTION_DEFAULT, cp), CONVICTION_DEFAULT);
  }
});

test('conviction and confidence round-trip', () => {
  for (const v of [50, 60, 70, 72, 75, 85, 95]) {
    assert.equal(confidenceToConviction(convictionToConfidence(v)), v);
  }
  assert.equal(convictionToConfidence(70), 0.7);
});

test('a committed decision records the governed conviction, not the raw one', () => {
  let run = createInitialRun();
  // CP1 caps at 75; try to smuggle a 95 straight into run state.
  run = { ...run, pendingAction: 'HOLD', pendingConfidence: convictionToConfidence(95) };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);
  assert.equal(confidenceToConviction(outcome.run.decisions[0].confidence ?? 0), 75);
});

test('conviction resets to the default at each new checkpoint', () => {
  let run = createInitialRun();
  run = { ...run, pendingAction: 'HOLD', pendingConfidence: convictionToConfidence(75) };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);
  const next = advanceRunCheckpoint(outcome.run);
  assert.equal(confidenceToConviction(next.pendingConfidence), CONVICTION_DEFAULT);
});

// ─── Thesis after the commit ──────────────────────────────────────────────────

function committedRun() {
  const run = { ...createInitialRun(), pendingAction: 'HOLD' as const, pendingConfidence: convictionToConfidence(70) };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);
  return outcome.run;
}

test('a decision commits without a thesis and then waits for one', () => {
  const run = committedRun();
  assert.equal(run.decisions.length, 1);
  assert.equal(run.decisions[0].thesisCode, undefined);
  assert.equal(awaitingThesis(run), true);
});

test('the thesis attaches to the committed decision', () => {
  const run = attachThesis(committedRun(), 'THESIS_UNCHANGED');
  assert.equal(run.decisions[0].thesisCode, 'THESIS_UNCHANGED');
  assert.equal(awaitingThesis(run), false);
});

test('the thesis cannot revise the stance or the conviction', () => {
  // Addendum C section C.5. This is the behavioral measurement model: the
  // player explains an instinct already exposed, and explaining it cannot
  // change what was exposed.
  const before = committedRun();
  const after = attachThesis(before, 'PANIC_REDUCTION');
  const b = before.decisions[0];
  const a = after.decisions[0];
  assert.equal(a.actionCode, b.actionCode);
  assert.equal(a.confidence, b.confidence);
  assert.equal(a.scoreContribution, b.scoreContribution);
  assert.equal(a.turnoverCost, b.turnoverCost);
  assert.deepEqual(a.behavioralFlags, b.behavioralFlags);
  assert.equal(a.quality, b.quality);
  // And the run around it is otherwise identical.
  assert.deepEqual({ ...after, decisions: [] }, { ...before, decisions: [] });
});

test('the first thesis wins, so a late tap cannot overwrite a timeout', () => {
  const timedOut = attachThesis(committedRun(), THESIS_TIMEOUT_CODE);
  const late = attachThesis(timedOut, 'VALUATION');
  assert.equal(late.decisions[0].thesisCode, THESIS_TIMEOUT_CODE);
  assert.equal(late, timedOut, 'a no-op should not even allocate a new run');
});

test('an unstated thesis is a recorded value, not a gap', () => {
  const run = attachThesis(committedRun(), THESIS_TIMEOUT_CODE);
  assert.equal(run.decisions[0].thesisCode, 'THESIS_UNSTATED');
  assert.equal(awaitingThesis(run), false);
});

test('THESIS_UNSTATED is never offered as a chip', () => {
  assert.equal(THESIS_OPTIONS.some(t => t.code === 'THESIS_UNSTATED'), false);
  for (const cp of COVID_CHECKPOINTS) {
    for (const branch of cp.availableActions) {
      const codes = thesisOptionsFor(branch).map(t => t.code);
      assert.equal(codes.includes('THESIS_UNSTATED'), false, `CP${cp.sequence} ${branch.actionCode}`);
    }
  }
});

test('every stance offers two to three theses, all labelled', () => {
  for (const cp of COVID_CHECKPOINTS) {
    for (const branch of cp.availableActions) {
      const options = thesisOptionsFor(branch);
      assert.ok(options.length >= 2 && options.length <= 3, `CP${cp.sequence} ${branch.actionCode}`);
      assert.equal(new Set(options.map(o => o.code)).size, options.length, 'duplicate chip');
      for (const o of options) {
        assert.ok(o.label.length > 0, `${o.code} has no label`);
        // Codes that are already plain English (MOMENTUM, CONTRARIAN) label
        // as themselves; the rest must not fall through to the raw code.
        assert.ok(!o.label.includes('_'), `${o.code} label leaked a raw code`);
      }
    }
  }
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
  });
  assert.ok(withRisk);
  assert.ok(withRisk.run.decisions[0].behavioralFlags.includes('GOOD_PROCESS'));

  const withoutRisk = commitPendingDecision({
    ...base,
    currentCheckpoint: regimeCp.sequence,
    investigatedModules: [],
    pendingAction: stance,
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

test('a committed decision is exactly stance, conviction, then thesis', () => {
  let run = createInitialRun();
  run = { ...run, pendingAction: 'REDUCE', pendingConfidence: convictionToConfidence(70) };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);

  // Stance and conviction are set by the commit itself.
  let d = outcome.run.decisions[0];
  assert.equal(d.actionCode, 'REDUCE');
  assert.equal(confidenceToConviction(d.confidence ?? 0), 70);
  assert.equal(d.thesisCode, undefined, 'thesis must not be an input to the commit');

  // Thesis arrives afterwards and completes the record.
  d = attachThesis(outcome.run, 'DETERIORATING_FUNDAMENTALS').decisions[0];
  assert.equal(d.thesisCode, 'DETERIORATING_FUNDAMENTALS');
  assert.equal(d.actionCode, 'REDUCE');
  assert.equal(confidenceToConviction(d.confidence ?? 0), 70);

  // No symbol-level orders survive anywhere in the record.
  assert.equal('orders' in d, false);
  assert.equal('symbol' in d, false);
});
