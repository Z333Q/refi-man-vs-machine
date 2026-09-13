import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionCode, RunState, ThesisCode } from './gameTypes';
import { COVID_CHECKPOINTS, } from './covidArena';
import { getCheckpoint } from './arenas';
import './arenaIndex';
import {
  createInitialRun, createInitialPortfolio, commitPendingDecision, advanceRunCheckpoint,
  turnoverBudgetFor,
  turnoverCostFor, isTurnoverExhausted, canCommitAction, committableActions, exceedsAllowance,
  stanceUnavailableReason, stanceTransition,
  TURNOVER_BUDGET_START, STARTING_CAPITAL,
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
    const action = opts.enforceBudget && exceedsAllowance(run, step.action) ? 'HOLD' : step.action;
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
  const cp = getCheckpoint('covid_black_swan', 1);
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
    // Turnover is derived from the transition the stance implies on the book
    // the run is actually holding — and which transition that is depends on the
    // checkpoint, because a card that names a holding executes that trade
    // rather than the generic reading of its code.
    const priced = getCheckpoint('covid_black_swan', run.currentCheckpoint);
    expected += turnoverCostFor(run.portfolio, step.action, priced);
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

test('the allowance never locks a stance: past it, every offered stance stays committable', () => {
  // Until 2026-09-13 the budget was a hard constraint and a defensive player
  // reached CP14 of COVID with only HOLD on the card, unexplained. The
  // allowance is now scored (computeTurnoverScore) and enforced nowhere.
  let run = createInitialRun();
  run = { ...run, portfolio: { ...run.portfolio, turnoverUsed: run.turnoverBudget } };
  assert.equal(isTurnoverExhausted(run), true);
  const cp = getCheckpoint('covid_black_swan', run.currentCheckpoint);
  assert.ok(cp);
  const offered = cp.availableActions.map(a => a.actionCode);
  assert.deepEqual(committableActions(run), offered);
  for (const a of offered) {
    assert.equal(canCommitAction(run, a), true, `${a} was locked by a spent allowance`);
    assert.equal(exceedsAllowance(run, a), a !== 'HOLD', `${a} allowance flag`);
  }
  // And a commit past the allowance really lands, and is really paid for.
  const priced = offered.find(a => a !== 'HOLD')!;
  const out = commitPendingDecision({ ...run, pendingAction: priced, pendingConfidence: 0.6 });
  assert.ok(out, 'a stance past the allowance must still commit');
  assert.ok(out.run.portfolio.turnoverUsed > run.turnoverBudget, 'the overspend is recorded on the meter');
});

test('overspending the allowance is paid for in the turnover score, in tiers', () => {
  // Scored, not enforced: the component that carries the cost must actually
  // step down as the meter passes 50%, 75% and 100% of the allowance.
  const at = (spentFraction: number) => {
    let run = createInitialRun();
    run = { ...run, portfolio: { ...run.portfolio, turnoverUsed: run.turnoverBudget * spentFraction } };
    const out = commitPendingDecision({ ...run, pendingAction: 'HOLD', pendingConfidence: 0.6 });
    assert.ok(out);
    return out.score.turnoverScore;
  };
  const [none, half, most, over] = [0, 0.6, 0.8, 1.2].map(at);
  assert.ok(none > half && half > most && most > over, `tiers did not step down: ${[none, half, most, over]}`);
});

test('a stance that would move nothing is refused, with the reason stated', () => {
  // The one legitimate refusal. RAISE_CASH with cash already at the ceiling is
  // a priced card that changes nothing, and a card that changes nothing lies.
  // A book at the cash ceiling, built the engine's own way rather than by
  // poking cashWeight (which leaves positions summing to the old equity share
  // and makes the next reallocation trade the difference).
  let book = createInitialPortfolio('covid_black_swan');
  for (let i = 0; i < 6; i++) {
    const t = stanceTransition(book, 'RAISE_CASH');
    book = { ...book, positions: t.positions, cashWeight: t.cashWeight };
  }
  assert.equal(book.cashWeight, 0.60);
  let run = createInitialRun();
  run = { ...run, portfolio: book };
  const cp = getCheckpoint('covid_black_swan', run.currentCheckpoint);
  assert.ok(cp && cp.availableActions.some(a => a.actionCode === 'RAISE_CASH'));
  assert.equal(turnoverCostFor(run.portfolio, 'RAISE_CASH', cp), 0);
  assert.match(stanceUnavailableReason(run.portfolio, 'RAISE_CASH', cp) ?? '', /CEILING/);
  assert.equal(canCommitAction(run, 'RAISE_CASH', cp), false);
  assert.equal(commitPendingDecision({ ...run, pendingAction: 'RAISE_CASH', pendingConfidence: 0.6 }), null);
  // HOLD is always committable, and so is a stance that moves the book.
  assert.equal(stanceUnavailableReason(run.portfolio, 'HOLD', cp), null);
  assert.equal(canCommitAction(run, 'HOLD', cp), true);
});

test('a scripted run that respects the allowance never exceeds it', () => {
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
  assert.ok(run.portfolio.turnoverUsed > 0.30, 'scripted run did not spend enough to test the ceiling');
});

test('regression: no player style is ever left with HOLD as the only stance', () => {
  // The 2026-09-13 report: RECOVERY ROTATION (CP14) and the checkpoint before
  // it offered nothing but HOLD to a defensive-active player. Three styles,
  // every checkpoint, every arena: at least one stance besides HOLD must be
  // committable whenever the content offers one.
  const styles: Array<[string, (offered: ActionCode[], seq: number) => ActionCode]> = [
    ['alternating', (o, seq) => (seq % 2 === 0 ? o.find(a => a !== 'HOLD') ?? 'HOLD' : 'HOLD')],
    ['always acting', o => o.find(a => a !== 'HOLD') ?? 'HOLD'],
    ['always defensive', o => o.find(a => a === 'RAISE_CASH' || a === 'ROTATE_DEFENSIVE') ?? o.find(a => a !== 'HOLD') ?? 'HOLD'],
  ];
  for (const arenaId of ['covid_black_swan', 'recovery_trap', 'inflation_shift', 'banking_stress'] as const) {
    for (const [name, pick] of styles) {
      let run = createInitialRun(7, arenaId);
      for (let guard = 0; guard < 40 && run.phase !== 'COMPLETE'; guard++) {
        const cp = getCheckpoint(arenaId, run.currentCheckpoint);
        if (!cp) break;
        const offered = cp.availableActions.map(a => a.actionCode);
        const open = committableActions(run, cp);
        if (offered.some(a => a !== 'HOLD')) {
          assert.ok(
            open.some(a => a !== 'HOLD'),
            `${arenaId} ${name}: CP${run.currentCheckpoint} was HOLD-only (used ${run.portfolio.turnoverUsed})`,
          );
        }
        const action = pick(open, run.currentCheckpoint);
        const out = commitPendingDecision({ ...run, pendingAction: action, pendingConfidence: 0.6 });
        assert.ok(out, `${arenaId} ${name}: commit refused at CP${run.currentCheckpoint}`);
        run = advanceRunCheckpoint(out.run);
      }
    }
  }
});

test('every stance is priced from the book, and HOLD is free', () => {
  // Replaces a test on the old fallback fee table, which no longer exists:
  // turnover is the traded weight a stance implies, so the price is a question
  // about a portfolio and cannot be answered by a lookup.
  const codes: ActionCode[] = [
    'HOLD', 'REDUCE', 'ROTATE_DEFENSIVE', 'ROTATE_RISK',
    'RAISE_CASH', 'ADD_RISK', 'STAGED_BUY', 'STAGED_SELL',
  ];
  const book = createInitialPortfolio('covid_black_swan');
  for (const c of codes) {
    const cost = turnoverCostFor(book, c);
    assert.equal(typeof cost, 'number', c);
    assert.ok(Number.isFinite(cost) && cost >= 0, `${c} priced at ${cost}`);
  }
  assert.equal(turnoverCostFor(book, 'HOLD'), 0, 'doing nothing trades nothing');

  // A round trip is two legs; a move into cash is one.
  assert.ok(
    turnoverCostFor(book, 'ROTATE_DEFENSIVE') > turnoverCostFor(book, 'REDUCE'),
    'a rotation must cost more than a trim',
  );
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
  const cpReturn = getCheckpoint('covid_black_swan', 1)!.portfolioEffect.returnBias;
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
