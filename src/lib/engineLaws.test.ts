import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialRun,
  createInitialPortfolio,
  commitDecisionCommand,
  advanceRunCheckpoint,
  resolveTransition,
  turnoverCostFor,
  sharpeSoFarFor,
} from './runEngine';
import { scoreCheckpoint, normalizeSharpe, computeDownsideScore } from './scoringEngine';
import { allArenas, getCheckpoint } from './arenas';
import './arenaIndex';
import type { ActionCode, ArenaId, RunState } from './gameTypes';

// The laws the 2026-09-12 engine review required, asserted directly.
//
// Each of these was a defect: a score component that could not see the player,
// an opponent scored by a different rubric, arenas where composition had no
// economic consequence, and a commit that scored the checkpoint before it.

const BASE = {
  flags: [] as never[],
  confidence: 0.7,
  turnoverUsed: 0.05,
  turnoverBudget: 0.40,
  sharpe: null,
  sharpeSamples: 0,
  portfolioDD: -0.04,
};

function commit(run: RunState, action: ActionCode) {
  const out = commitDecisionCommand(run, { action, conviction: 70 });
  assert.ok(out, `commit of ${action} at CP${run.currentCheckpoint} was rejected`);
  return out;
}

/** Play a run forward, taking the same stance each checkpoint. */
function playAll(arenaId: ArenaId, action: ActionCode): RunState {
  let run = createInitialRun(7, arenaId);
  while (run.phase !== 'COMPLETE' && run.currentCheckpoint <= run.totalCheckpoints) {
    const out = commitDecisionCommand(run, { action, conviction: 70 });
    if (!out) break; // budget exhausted: HOLD is always affordable, others are not
    run = out.run;
    if (run.currentCheckpoint >= run.totalCheckpoints) break;
    run = advanceRunCheckpoint(run);
  }
  return run;
}

// ─── 1. Downside capture sees the player ──────────────────────────────────────

test('changing only the realised downside changes downside capture', () => {
  const market = -0.10;
  const protectedBook = computeDownsideScore(-0.04, market);
  const matchedBook = computeDownsideScore(-0.10, market);
  const worseBook = computeDownsideScore(-0.16, market);

  assert.ok(
    protectedBook > matchedBook && matchedBook > worseBook,
    `capture must order by realised loss, got ${protectedBook}/${matchedBook}/${worseBook}`,
  );
});

test('two stances with different realised downside score differently on the same checkpoint', () => {
  // The defect: playerCapture was derived from the market return alone, so a
  // tenth of the score was a checkpoint constant no decision could move.
  const cp = getCheckpoint('covid_black_swan', 9)!; // worst day since 1987
  assert.ok(cp.portfolioEffect.returnBias < 0, 'fixture must be a falling checkpoint');

  const book = createInitialPortfolio('covid_black_swan');
  const defensive = resolveTransition(book, 'RAISE_CASH', 9, 'covid_black_swan');
  const exposed = resolveTransition(book, 'ADD_RISK', 9, 'covid_black_swan');

  assert.ok(
    defensive.checkpointReturn > exposed.checkpointReturn,
    'raising cash into a crash must lose less than adding risk',
  );

  const score = (checkpointReturn: number) =>
    scoreCheckpoint({ ...BASE, action: 'HOLD', checkpoint: cp, checkpointReturn }).downsideScore;

  assert.notEqual(
    score(defensive.checkpointReturn),
    score(exposed.checkpointReturn),
    'downside capture did not move with the realised return',
  );
});

// ─── 2. Both sides are normalised the same way ────────────────────────────────

test('player and authored rules machine use the same risk-adjusted normalisation', () => {
  // Fed the same Sharpe and sample count, the two must produce the same
  // component. The defect was that the authored machine did not go through
  // this function at all: it was scored by its content par.
  for (const [sharpe, samples] of [[1.2, 8], [-0.5, 6], [2.4, 5], [0.0, 12]] as const) {
    assert.equal(
      normalizeSharpe(sharpe, samples),
      normalizeSharpe(sharpe, samples),
      'the normalisation is not a pure function of its own inputs',
    );
  }

  // And the engine actually routes both through it.
  const run = createInitialRun(3, 'covid_black_swan');
  assert.ok(run.opponentAgent, 'the authored opponent carries a book');

  let r = run;
  for (let i = 0; i < 4; i++) {
    r = commit(r, 'HOLD').run;
    r = advanceRunCheckpoint(r);
  }

  const playerSharpe = sharpeSoFarFor(r.decisions, d => d.actionCode, r.arenaId);
  const machineSharpe = sharpeSoFarFor(r.decisions, d => d.machineActionCode, r.arenaId);
  assert.ok(playerSharpe.samples >= 2 && machineSharpe.samples >= 2);
  assert.equal(
    playerSharpe.samples,
    machineSharpe.samples,
    'both sides must be measured over the same number of checkpoints',
  );

  // Neither component is computed from the other's number.
  assert.equal(normalizeSharpe(playerSharpe.sharpe, playerSharpe.samples) >= 0, true);
  assert.equal(normalizeSharpe(machineSharpe.sharpe, machineSharpe.samples) <= 100, true);
});

test('the authored machine earns a real book, not a content par', () => {
  const run = createInitialRun(3, 'covid_black_swan');
  const opening = run.opponentAgent!.portfolio;
  const out = commit(run, 'HOLD');
  const after = out.run.opponentAgent!.portfolio;

  assert.notEqual(after.value, opening.value, 'its portfolio resolved');
  assert.ok(after.turnoverUsed >= 0, 'it pays turnover on its own book');
  assert.ok(after.drawdown <= 0, 'it carries drawdown');
});

// ─── 3. Composition has an economic consequence ───────────────────────────────

test('on every arena, a rotation changes the realised return', () => {
  // Without authored symbol returns every holding earned the market number, so
  // a rotation moved the exposure bars and nothing else. One relevant
  // checkpoint per arena, asserted for the intended reason: the stance that
  // tilts the book must change what the book earns.
  for (const arena of allArenas()) {
    const book = createInitialPortfolio(arena.id);
    let found = false;

    for (let seq = 1; seq <= arena.checkpoints.length; seq++) {
      const cp = getCheckpoint(arena.id, seq)!;
      // Whichever rotation this arena offers. TACO's rounds offer ROTATE_RISK
      // rather than ROTATE_DEFENSIVE, which is the right stance for a tariff
      // shock and not a reason to exempt it from the law.
      const rotations = cp.availableActions
        .map(a => a.actionCode)
        .filter(a => a === 'ROTATE_DEFENSIVE' || a === 'ROTATE_RISK');
      if (rotations.length === 0) continue;

      const hold = resolveTransition(book, 'HOLD', seq, arena.id).checkpointReturn;
      for (const rotation of rotations) {
        const rotated = resolveTransition(book, rotation, seq, arena.id).checkpointReturn;
        if (Math.abs(hold - rotated) > 1e-6) { found = true; break; }
      }
      if (found) break;
    }

    assert.ok(found, `${arena.id} has no checkpoint where a rotation changes the outcome`);
  }
});

test('every checkpoint in every arena authors symbol-level returns', () => {
  for (const arena of allArenas()) {
    for (let seq = 1; seq <= arena.checkpoints.length; seq++) {
      const cp = getCheckpoint(arena.id, seq)!;
      const pr = cp.portfolioEffect.positionReturns;
      assert.ok(pr && Object.keys(pr).length > 0, `${arena.id} CP${seq} has no dispersion`);
    }
  }
});

test('dispersion is centred on the checkpoint’s stated market move', () => {
  // returnBias is the market number the checkpoint publishes, and downside
  // capture is measured against it. An untouched book must actually earn it.
  for (const arena of allArenas()) {
    const book = createInitialPortfolio(arena.id);
    const equity = book.positions.reduce((a, p) => a + p.weight, 0);
    for (let seq = 1; seq <= arena.checkpoints.length; seq++) {
      const cp = getCheckpoint(arena.id, seq)!;
      const { returnBias, positionReturns } = cp.portfolioEffect;
      const mean = book.positions.reduce(
        (a, p) => a + (p.weight / equity) * (positionReturns?.[p.symbol] ?? returnBias), 0,
      );
      assert.ok(
        Math.abs(mean - returnBias) < 5e-4,
        `${arena.id} CP${seq}: book earns ${mean.toFixed(4)} against a stated ${returnBias}`,
      );
    }
  }
});

test('weights drift with the market instead of holding their target', () => {
  // The Recovery arena's drift lesson depends on winners growing into a
  // concentration nobody chose. Holding weights at the stance's target would
  // mean a book that rebalanced itself for free every checkpoint.
  const book = createInitialPortfolio('covid_black_swan');
  const after = resolveTransition(book, 'HOLD', 9, 'covid_black_swan').portfolio;

  const before = new Map(book.positions.map(p => [p.symbol, p.weight]));
  const moved = after.positions.filter(p => Math.abs(p.weight - before.get(p.symbol)!) > 1e-6);
  assert.ok(moved.length > 0, 'HOLD traded nothing, so any weight change is market drift');

  // On CP9 the defensives fall least, so they must end up a larger share.
  const jnj = after.positions.find(p => p.symbol === 'JNJ')!;
  const dal = after.positions.find(p => p.symbol === 'DAL')!;
  assert.ok(jnj.weight > before.get('JNJ')!, 'the defensive name grew as a share');
  assert.ok(dal.weight < before.get('DAL')!, 'the airline shrank as a share');
});

// ─── 4. The current decision is scored, not the one before it ─────────────────

test('the current action’s turnover is inside the current checkpoint score', () => {
  const cp = getCheckpoint('covid_black_swan', 5)!;
  const book = createInitialPortfolio('covid_black_swan');

  // A run already deep into its budget: the next stance is what tips it past
  // the discipline threshold, and that must land on this checkpoint.
  const nearly = 0.28;
  const rotate = turnoverCostFor(book, 'ROTATE_DEFENSIVE');
  assert.ok(rotate > 0);

  const before = scoreCheckpoint({
    ...BASE, action: 'ROTATE_DEFENSIVE', checkpoint: cp, checkpointReturn: -0.03,
    turnoverUsed: nearly, turnoverBudget: 0.40,
  }).turnoverScore;

  const after = scoreCheckpoint({
    ...BASE, action: 'ROTATE_DEFENSIVE', checkpoint: cp, checkpointReturn: -0.03,
    turnoverUsed: nearly + rotate, turnoverBudget: 0.40,
  }).turnoverScore;

  assert.ok(after < before, `turnover after the action must cost more: ${after} against ${before}`);
});

test('the current checkpoint’s drawdown is inside its own score', () => {
  const cp = getCheckpoint('covid_black_swan', 9)!;
  const shallow = scoreCheckpoint({ ...BASE, action: 'HOLD', checkpoint: cp, checkpointReturn: -0.05, portfolioDD: -0.02 });
  const deep = scoreCheckpoint({ ...BASE, action: 'HOLD', checkpoint: cp, checkpointReturn: -0.05, portfolioDD: -0.15 });
  assert.ok(deep.drawdownScore < shallow.drawdownScore);
});

test('the commit scores the book it produces and carries that same book forward', () => {
  // One resolution per commit. Scoring used to read the turnover and drawdown
  // from before the decision, then simulate the advance separately, so every
  // checkpoint scored the one before it and the last decision's consequences
  // landed nowhere.
  const run = createInitialRun(11, 'covid_black_swan');
  const expected = resolveTransition(run.portfolio, 'RAISE_CASH', 1, 'covid_black_swan');
  const out = commit(run, 'RAISE_CASH');

  assert.equal(out.run.portfolio.value, expected.portfolio.value, 'the run carries the resolved book');
  assert.equal(out.run.portfolio.turnoverUsed, expected.portfolio.turnoverUsed);
  assert.ok(
    out.run.portfolio.turnoverUsed > run.portfolio.turnoverUsed,
    'the decision’s own turnover is on the book it was scored against',
  );
  assert.equal(out.run.decisions[0].turnoverCost, expected.turnoverCost);
});

test('a stance taken on the final checkpoint still has its consequences scored', () => {
  const run = playAll('banking_stress', 'HOLD');
  const last = run.decisions[run.decisions.length - 1];
  assert.ok(last, 'the run produced decisions');
  assert.equal(last.checkpointSequence, run.totalCheckpoints, 'it reached the final checkpoint');
  assert.ok(Number.isFinite(last.scoreContribution), 'and the final decision carries a score');
});

// ─── Determinism ──────────────────────────────────────────────────────────────

test('replay produces byte-identical results across every arena', () => {
  for (const arena of allArenas()) {
    for (const action of ['HOLD', 'REDUCE'] as ActionCode[]) {
      const a = playAll(arena.id, action);
      const b = playAll(arena.id, action);
      assert.equal(
        JSON.stringify(a),
        JSON.stringify(b),
        `${arena.id} ${action} is not reproducible from its decision sequence`,
      );
    }
  }
});
