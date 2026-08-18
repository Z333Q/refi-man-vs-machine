import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionCode, RunState, ThesisCode } from './gameTypes';
import { COVID_CHECKPOINTS, getCheckpoint } from './covidArena';
import {
  createInitialRun, createInitialPortfolio, commitPendingDecision, advanceRunCheckpoint,
  turnoverBudgetFor,
  turnoverCostFor, isTurnoverExhausted, canAffordAction, affordableActions, isHoldOnly,
  TURNOVER_BUDGET_START, STARTING_CAPITAL, DEFAULT_TURNOVER_COST,
} from './runEngine';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// A scripted decision sequence covering every checkpoint of the COVID arena,
// mixing stances so the replay exercises each action multiplier and cost.
const SEQUENCE: { action: ActionCode; thesis: ThesisCode; confidence: number }[] = [
  { action: 'HOLD',             thesis: 'THESIS_UNCHANGED',        confidence: 0.60 },
  { action: 'REDUCE',           thesis: 'DETERIORATING_FUNDAMENTALS', confidence: 0.70 },
  { action: 'HOLD',             thesis: 'THESIS_UNCHANGED',        confidence: 0.55 },
  { action: 'ROTATE_DEFENSIVE', thesis: 'REGIME_CHANGE',           confidence: 0.80 },
  { action: 'RAISE_CASH',       thesis: 'VOLATILITY_CONTROL',      confidence: 0.75 },
  { action: 'HOLD',             thesis: 'THESIS_UNCHANGED',        confidence: 0.50 },
  { action: 'REDUCE',           thesis: 'PANIC_REDUCTION',         confidence: 0.90 },
  { action: 'HOLD',             thesis: 'LIQUIDITY_PRESERVATION',  confidence: 0.65 },
  { action: 'HOLD',             thesis: 'THESIS_UNCHANGED',        confidence: 0.60 },
  { action: 'ADD_RISK',         thesis: 'VALUATION',               confidence: 0.85 },
  { action: 'HOLD',             thesis: 'POLICY_RESPONSE',         confidence: 0.70 },
  { action: 'ADD_RISK',         thesis: 'CONTRARIAN',              confidence: 0.60 },
  { action: 'HOLD',             thesis: 'THESIS_UNCHANGED',        confidence: 0.55 },
  { action: 'HOLD',             thesis: 'MOMENTUM',                confidence: 0.75 },
];

function playScriptedRun(
  sequence: typeof SEQUENCE = SEQUENCE,
  opts: { enforceBudget?: boolean } = {},
): RunState {
  let run = createInitialRun();
  for (const step of sequence) {
    if (run.phase === 'COMPLETE') break;
    const action = opts.enforceBudget && !canAffordAction(run, step.action) ? 'HOLD' : step.action;
    run = {
      ...run,
      pendingAction: action,
      pendingConfidence: step.confidence,
    };
    const outcome = commitPendingDecision(run);
    assert.ok(outcome, `commit failed at checkpoint ${run.currentCheckpoint}`);
    run = advanceRunCheckpoint(outcome.run);
  }
  return run;
}

// ─── G1 gate 1: determinism ───────────────────────────────────────────────────

test('replay: identical decision sequences produce identical run state', () => {
  const a = playScriptedRun();
  const b = playScriptedRun();
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('replay: no ambient randomness in position pnl or turnover', () => {
  // Ten independent replays must all collapse to one serialization. A single
  // surviving Math.random call would break this with overwhelming probability.
  const serialized = new Set(
    Array.from({ length: 10 }, () => JSON.stringify(playScriptedRun())),
  );
  assert.equal(serialized.size, 1);
});

test('replay: diverging one decision changes the outcome', () => {
  // Guards against the test passing because state stopped depending on input.
  const varied = SEQUENCE.map((s, i) => (i === 1 ? { ...s, action: 'HOLD' as ActionCode } : s));
  assert.notEqual(JSON.stringify(playScriptedRun()), JSON.stringify(playScriptedRun(varied)));
});

test('positions move by the authored checkpoint return, with no per-position noise', () => {
  let run = createInitialRun();
  run = { ...run, pendingAction: 'HOLD', pendingConfidence: 0.6 };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);
  const cp = getCheckpoint(1);
  assert.ok(cp);
  const expected = cp.portfolioEffect.returnBias; // HOLD multiplier is 1.0
  for (const pos of outcome.run.portfolio.positions) {
    assert.equal(pos.pnl, cp.portfolioEffect.positionReturns?.[pos.symbol] ?? expected);
  }
});

// ─── G1 gate 3: finite turnover budget ────────────────────────────────────────

test('every authored action branch carries a fixed turnover cost', () => {
  for (const cp of COVID_CHECKPOINTS) {
    for (const branch of cp.availableActions) {
      assert.equal(typeof branch.turnoverCost, 'number', `CP${cp.sequence} ${branch.actionCode}`);
      assert.ok(branch.turnoverCost >= 0, `CP${cp.sequence} ${branch.actionCode} is negative`);
      if (branch.actionCode === 'HOLD') {
        assert.equal(branch.turnoverCost, 0, `CP${cp.sequence} HOLD must be free`);
      } else {
        assert.ok(branch.turnoverCost > 0, `CP${cp.sequence} ${branch.actionCode} must cost turnover`);
      }
    }
  }
});

test('turnover accounting is the exact sum of the authored costs paid', () => {
  let run = createInitialRun();
  assert.equal(run.portfolio.turnoverUsed, 0);
  // The budget is derived from the arena's length, not a flat constant, so the
  // assertion asks for the derivation rather than a number that moves whenever
  // content is authored.
  assert.equal(run.turnoverBudget, turnoverBudgetFor(run.totalCheckpoints));
  assert.equal(turnoverBudgetFor(14), TURNOVER_BUDGET_START);

  let expected = 0;
  for (const step of SEQUENCE) {
    if (run.phase === 'COMPLETE') break;
    const cp = getCheckpoint(run.currentCheckpoint);
    expected += turnoverCostFor(step.action, cp);
    run = { ...run, pendingAction: step.action, pendingConfidence: step.confidence };
    const outcome = commitPendingDecision(run);
    assert.ok(outcome);
    run = advanceRunCheckpoint(outcome.run);
    // Compared on cents-scale precision: the accumulator and the engine sum the
    // same fixed costs, so only float association may differ.
    assert.ok(
      Math.abs(run.portfolio.turnoverUsed - expected) < 1e-9,
      `turnover drift: ${run.portfolio.turnoverUsed} vs ${expected}`,
    );
  }
});

test('HOLD is free and never advances the turnover meter', () => {
  const allHold = SEQUENCE.map(s => ({ ...s, action: 'HOLD' as ActionCode }));
  const run = playScriptedRun(allHold);
  assert.equal(run.portfolio.turnoverUsed, 0);
  assert.equal(isTurnoverExhausted(run), false);
});

test('an unaffordable stance is unavailable, not merely the one after it', () => {
  // The budget is a hard constraint. A stance that does not fully fit in what
  // is left cannot be taken at all.
  let run = createInitialRun();
  // Spend down to exactly 0.03 remaining, derived from the run's own budget so
  // the case holds whatever the arena's length makes that budget.
  run = { ...run, portfolio: { ...run.portfolio, turnoverUsed: run.turnoverBudget - 0.03 } };
  assert.equal(canAffordAction(run, 'HOLD'), true);            // free
  assert.equal(canAffordAction(run, 'RAISE_CASH'), false);     // 0.04 > 0.03
  assert.equal(canAffordAction(run, 'REDUCE'), false);         // 0.05 > 0.03
  assert.equal(canAffordAction(run, 'ROTATE_DEFENSIVE'), false); // 0.07 > 0.03
  assert.equal(canAffordAction(run, 'STAGED_BUY'), true);      // 0.03 fits exactly
});

test('expensive stances fall away before cheap ones as the budget drains', () => {
  const affordableAt = (used: number) => {
    const run = { ...createInitialRun(), portfolio: { ...createInitialPortfolio(), turnoverUsed: used } };
    const codes: ActionCode[] = ['RAISE_CASH', 'REDUCE', 'ADD_RISK', 'ROTATE_DEFENSIVE'];
    return codes.filter(c => canAffordAction(run, c)).length;
  };
  // Monotonic: spending more never re-opens a stance. Expressed as fractions
  // of the run's own budget rather than as absolute spend, so the property
  // survives an arena of any length (the budget scales with checkpoint count).
  const budget = createInitialRun().turnoverBudget;
  const counts = [0, 0.825, 0.875, 0.9, 0.925, 1].map(f => affordableAt(budget * f));
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i] <= counts[i - 1], `budget spend re-opened a stance: ${counts}`);
  }
  assert.equal(counts[0], 4);
  assert.equal(counts[counts.length - 1], 0);
});

test('a run that only takes affordable stances never exceeds its budget', () => {
  const spendEverything = SEQUENCE.map(s => ({
    ...s,
    action: (s.action === 'HOLD' ? 'REDUCE' : s.action) as ActionCode,
  }));
  const run = playScriptedRun(spendEverything, { enforceBudget: true });
  assert.ok(
    run.portfolio.turnoverUsed <= run.turnoverBudget + 1e-9,
    `overspent: ${run.portfolio.turnoverUsed} of ${run.turnoverBudget}`,
  );
  // The paid costs are exactly the recorded per-decision costs.
  const paid = run.decisions.reduce((sum, d) => sum + d.turnoverCost, 0);
  assert.ok(Math.abs(paid - run.portfolio.turnoverUsed) < 1e-9);
  // And the run really did press against the ceiling rather than idling.
  assert.ok(run.portfolio.turnoverUsed > 0.30, 'scripted run did not spend enough to test the ceiling');
});

test('an exhausted budget leaves the checkpoint HOLD-only', () => {
  let run = createInitialRun();
  run = { ...run, portfolio: { ...run.portfolio, turnoverUsed: run.turnoverBudget } };
  assert.equal(isTurnoverExhausted(run), true);
  assert.equal(isHoldOnly(run), true);
  assert.deepEqual(affordableActions(run), ['HOLD']);
  // CP1 offers HOLD, REDUCE, RAISE_CASH and ROTATE_DEFENSIVE with a full budget.
  assert.equal(isHoldOnly(createInitialRun()), false);
});

test('default cost table covers every action code', () => {
  const codes: ActionCode[] = [
    'HOLD', 'REDUCE', 'ROTATE_DEFENSIVE', 'ROTATE_RISK',
    'RAISE_CASH', 'ADD_RISK', 'STAGED_BUY', 'STAGED_SELL',
  ];
  for (const c of codes) assert.equal(typeof DEFAULT_TURNOVER_COST[c], 'number');
  assert.equal(DEFAULT_TURNOVER_COST.HOLD, 0);
});

// ─── Drawdown against a ratcheting high-water mark ────────────────────────────

test('drawdown is measured from the peak, not from starting capital', () => {
  let run = createInitialRun();
  assert.equal(run.portfolio.peakValue, STARTING_CAPITAL);

  const run2 = playScriptedRun();
  assert.ok(run2.portfolio.peakValue >= STARTING_CAPITAL);
  assert.ok(run2.portfolio.drawdown <= 0);

  // A portfolio sitting at its own high-water mark is not in drawdown.
  run = { ...run, portfolio: { ...run.portfolio, value: 120000, peakValue: 120000 } };
  run = { ...run, pendingAction: 'HOLD', pendingConfidence: 0.6 };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);
  const cpReturn = getCheckpoint(1)!.portfolioEffect.returnBias;
  if (cpReturn >= 0) {
    assert.equal(outcome.run.portfolio.drawdown, 0);
    assert.ok(outcome.run.portfolio.peakValue > 120000);
  } else {
    assert.ok(outcome.run.portfolio.drawdown < 0);
    assert.equal(outcome.run.portfolio.peakValue, 120000);
  }
});

test('a crossed critical drawdown stays crossed', () => {
  let run = createInitialRun();
  // Park the run just above the critical line, then take the worst checkpoint.
  run = {
    ...run,
    currentCheckpoint: 7,
    portfolio: { ...run.portfolio, value: 82000, peakValue: 100000, drawdown: -0.18 },
    pendingAction: 'ADD_RISK',
    pendingConfidence: 0.9,
  };
  const failed = commitPendingDecision(run);
  assert.ok(failed);
  assert.equal(failed.run.criticalFailure, true);

  // Recovering later must not clear the fact that the line was crossed.
  let recovered = advanceRunCheckpoint(failed.run);
  recovered = {
    ...recovered,
    portfolio: { ...recovered.portfolio, value: 100000, peakValue: 100000, drawdown: 0 },
    pendingAction: 'HOLD',
    pendingConfidence: 0.6,
  };
  const after = commitPendingDecision(recovered);
  assert.ok(after);
  assert.equal(after.run.criticalFailure, true);
});
