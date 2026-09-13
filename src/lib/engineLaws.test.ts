import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialRun,
  createInitialPortfolio,
  commitDecisionCommand,
  advanceRunCheckpoint,
  resolveTransition,
  stanceTransition,
  turnoverCostFor,
  sharpeSoFarFor,
  nextCashWeight,
  CASH_WEIGHT_MIN,
  CASH_WEIGHT_MAX,
} from './runEngine';
import { scoreCheckpoint, normalizeSharpe, computeDownsideScore, computeRecoveryScore, RECOVERY_NEUTRAL } from './scoringEngine';
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
  troughDD: -0.04,
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

test('player and authored rules machine expose RAR from the identical normalizer', () => {
  // Asserted on the real score objects both sides produce, not on the
  // normalizer being equal to itself. The defect was that the authored machine
  // never reached this function: it was scored by its content par, so a
  // tautology about normalizeSharpe would have passed throughout the bug.
  let r = createInitialRun(3, 'covid_black_swan');
  assert.ok(r.opponentAgent, 'the authored opponent carries a book');

  let lastScore = null as ReturnType<typeof commit>['score'] | null;
  for (let i = 0; i < 5; i++) {
    const out = commit(r, 'HOLD');
    lastScore = out.score;
    r = out.run;
    if (i < 4) r = advanceRunCheckpoint(r);
  }

  // Each side's run-so-far Sharpe, taken from its own decision history.
  const playerRisk = sharpeSoFarFor(r.decisions, d => d.actionCode, r.arenaId);
  const machineRisk = sharpeSoFarFor(r.decisions, d => d.machineActionCode, r.arenaId);
  assert.ok(playerRisk.samples >= 2 && machineRisk.samples >= 2);
  assert.equal(playerRisk.samples, machineRisk.samples, 'measured over the same checkpoints');

  // The player's reported RAR is exactly what the shared normalizer produces
  // from the player's own path.
  assert.equal(
    lastScore!.raerScore,
    normalizeSharpe(playerRisk.sharpe, playerRisk.samples),
    'the player component did not come from the shared normalizer',
  );

  // And the opponent's score object is produced by the same scoring function
  // over its own book: its total is a real seven-component score, not par.
  const cp = getCheckpoint('covid_black_swan', r.decisions.length)!;
  assert.notEqual(
    lastScore!.machineScore,
    cp.machinePar,
    'the machine score is still the content par rather than a played result',
  );
  assert.ok(lastScore!.machineScore > 0 && lastScore!.machineScore <= 100);
});

test('recovery efficiency moves with the run, and cannot be gamed by falling', () => {
  // §29.1 gives this a tenth of the score; it was the constant 65 for every
  // player, machine, stance and checkpoint.
  const neutral = computeRecoveryScore(-0.005, -0.005);
  assert.equal(neutral, RECOVERY_NEUTRAL, 'a book with no real hole has nothing to recover');

  const atTrough = computeRecoveryScore(-0.20, -0.20);
  const halfBack = computeRecoveryScore(-0.10, -0.20);
  const fullyBack = computeRecoveryScore(0, -0.20);

  assert.ok(atTrough < neutral, 'sitting at the worst point is below neutral');
  assert.ok(halfBack > atTrough, 'climbing out scores better than the bottom');
  assert.ok(fullyBack > halfBack, 'complete recovery beats partial');
  assert.equal(fullyBack, 100, 'back at the high-water mark is full marks');

  // A new low cannot score better than a recovering path: the trough follows
  // the book down, so a deeper fall is always the at-trough score.
  const newLow = computeRecoveryScore(-0.30, -0.20);
  assert.equal(newLow, atTrough, 'a new low scores the bottom, whatever the old trough was');
  assert.ok(newLow < halfBack);
});

test('recovery uses the identical function for player and machine', () => {
  const cp = getCheckpoint('covid_black_swan', 9)!;
  const score = (dd: number, trough: number) =>
    scoreCheckpoint({ ...BASE, action: 'HOLD', checkpoint: cp, checkpointReturn: -0.05, portfolioDD: dd, troughDD: trough }).recoveryScore;
  assert.equal(score(-0.10, -0.20), computeRecoveryScore(-0.10, -0.20));
  assert.equal(score(-0.02, -0.02), computeRecoveryScore(-0.02, -0.02));
});

test('the trough ratchets down only, so replay reproduces the recovery path', () => {
  let r = createInitialRun(5, 'covid_black_swan');
  const troughs: number[] = [];
  for (let i = 0; i < 12; i++) {
    r = commit(r, 'HOLD').run;
    troughs.push(r.portfolio.troughDrawdown);
    r = advanceRunCheckpoint(r);
  }
  for (let i = 1; i < troughs.length; i++) {
    assert.ok(troughs[i] <= troughs[i - 1], `trough rose at step ${i}: ${troughs[i - 1]} -> ${troughs[i]}`);
  }
  assert.ok(troughs[troughs.length - 1] < 0, 'COVID puts the book in a hole');
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

// ─── 5. The card is the promise ───────────────────────────────────────────────

test('COVID CP2 REDUCE trades DAL and MAR, not the whole book', () => {
  // The card reads "REDUCE DAL/MAR: WHO emergency is the real trigger" and the
  // engine, reading only the code REDUCE, trimmed all ten holdings pro rata.
  const cp = getCheckpoint('covid_black_swan', 2)!;
  assert.match(
    cp.availableActions.find(a => a.actionCode === 'REDUCE')!.label,
    /DAL\/MAR/,
    'fixture must be the card that names the two holdings',
  );

  const book = createInitialPortfolio('covid_black_swan');
  const before = new Map(book.positions.map(p => [p.symbol, p.weight]));
  const after = stanceTransition(book, 'REDUCE', cp);

  const delta = (s: string) => after.positions.find(p => p.symbol === s)!.weight - before.get(s)!;

  assert.ok(delta('DAL') < -0.001, 'DAL was reduced');
  assert.ok(delta('MAR') < -0.001, 'MAR was reduced');

  // Not a pro-rata trim: everything the card did not name is untouched.
  for (const p of after.positions) {
    if (p.symbol === 'DAL' || p.symbol === 'MAR') continue;
    assert.equal(delta(p.symbol), 0, `${p.symbol} was traded by a card that did not name it`);
  }
  assert.ok(delta('DAL') < delta('MSFT'), 'the named holding moved more than an unnamed one');
});

test('the authored machine executes the same targeted trade the card describes', () => {
  const cp = getCheckpoint('covid_black_swan', 2)!;
  assert.equal(cp.machineDecision.actionCode, 'REDUCE', 'the machine takes this stance here');

  // The machine's own authored targets and the branch's allocation effect are
  // two statements about one trade; they must not contradict each other.
  const effect = cp.availableActions.find(a => a.actionCode === 'REDUCE')!.allocationEffect!;
  const branchSymbols = new Set(effect.moves.filter(m => m.delta < 0).map(m => m.symbol));
  for (const t of cp.machineDecision.targetChanges) {
    if (t.direction !== 'decrease') continue;
    assert.ok(branchSymbols.has(t.asset), `machine sells ${t.asset}; the branch does not`);
  }

  // And the shadow runs the same transition on its own book.
  const run = createInitialRun(2, 'covid_black_swan');
  let r = commit(run, 'HOLD').run;
  r = advanceRunCheckpoint(r);
  const machineBook = r.opponentAgent!.portfolio;
  const machineBefore = new Map(machineBook.positions.map(p => [p.symbol, p.weight]));
  const out = commit(r, 'HOLD');
  const machineAfter = out.run.opponentAgent!.portfolio;

  const dal = machineAfter.positions.find(p => p.symbol === 'DAL')!.weight - machineBefore.get('DAL')!;
  assert.ok(dal < 0, 'the machine sold DAL when it took the card that says so');
});

test('turnover equals the weights the authored trade actually moved', () => {
  const cp = getCheckpoint('covid_black_swan', 2)!;
  const book = createInitialPortfolio('covid_black_swan');
  const t = stanceTransition(book, 'REDUCE', cp);
  const before = new Map(book.positions.map(p => [p.symbol, p.weight]));
  const traded = t.positions.reduce((a, p) => a + Math.abs(p.weight - before.get(p.symbol)!), 0);

  assert.ok(Math.abs(t.turnover - traded) < 1e-9, `${t.turnover} priced against ${traded} traded`);
  assert.ok(Math.abs(turnoverCostFor(book, 'REDUCE', cp) - traded) < 1e-9, 'the quoted price is the executed price');
});

test('every card that names a holding or sector executes that trade', () => {
  // The audit, as a standing assertion: a card whose copy names something
  // specific must carry an allocation effect that touches it.
  const NAMED = /\b(DAL|MAR|AAPL|MSFT|JPM|XOM|JNJ|PG|CAT|HD|KO|VZ|WMT|NVDA|CRM|TSLA|AMZN|BAC|WFC|GS|MS|AMAT|NEE)\b/;
  const missing: string[] = [];
  for (const arena of allArenas()) {
    for (let seq = 1; seq <= arena.checkpoints.length; seq++) {
      for (const b of getCheckpoint(arena.id, seq)!.availableActions) {
        if (b.actionCode === 'HOLD') continue;       // holding trades nothing
        if (!NAMED.test(b.label)) continue;          // a generic card is honest as generic
        if (!b.allocationEffect) missing.push(`${arena.id} CP${seq} ${b.actionCode}: ${b.label}`);
      }
    }
  }
  assert.deepEqual(missing, [], 'cards naming a holding with no authored trade');
});

// ─── 6. Fair Match: the machine pays on the same meter ────────────────────────

test('the authored machine stays within one stance of the arena allowance, every arena', () => {
  // The allowance is scored on both sides and enforced on neither. Until
  // 2026-09-13 the shadow was forced to HOLD once its book could not pay, and
  // this law passed because the fallback hid the overspend: banking_stress
  // CP4 authors 0.1698 of turnover against a 0.158 allowance. The machine now
  // takes its authored call and pays for it in score, exactly like the human.
  // The law that remains: authored content may not run away from the
  // allowance by more than one full-size stance.
  const ONE_STANCE = 0.10;
  for (const arena of allArenas()) {
    let r = createInitialRun(9, arena.id);
    const budget = r.turnoverBudget;
    while (r.currentCheckpoint <= r.totalCheckpoints) {
      const out = commitDecisionCommand(r, { action: 'HOLD', conviction: 70 });
      assert.ok(out, `${arena.id} CP${r.currentCheckpoint}: HOLD was rejected`);
      r = out.run;
      const spent = r.opponentAgent!.portfolio.turnoverUsed;
      assert.ok(
        spent <= budget + ONE_STANCE + 1e-9,
        `${arena.id} CP${r.decisions.length}: machine spent ${spent} of a ${budget} allowance`,
      );
      if (r.currentCheckpoint >= r.totalCheckpoints) break;
      r = advanceRunCheckpoint(r);
    }
  }
});

// ─── 7. Cash bounds limit the action, not the drift ───────────────────────────

test('a book drifted above the cash ceiling cannot be pushed further by RAISE_CASH', () => {
  // The bug this replaces: from 70% cash, RAISE_CASH returned 60% — a command
  // named "raise cash" that bought equities.
  assert.equal(nextCashWeight(0.70, 'RAISE_CASH'), 0.70, 'refuses rather than selling backwards');
  assert.equal(nextCashWeight(0.70, 'ADD_RISK'), 0.65, 'deploying moves by its full delta');
  assert.ok(nextCashWeight(0.70, 'ADD_RISK') < 0.70, 'and it moves toward the band');
});

test('a book at the cash floor cannot be pushed further by ADD_RISK', () => {
  assert.equal(nextCashWeight(CASH_WEIGHT_MIN, 'ADD_RISK'), CASH_WEIGHT_MIN, 'refuses rather than buying cash');
  assert.equal(nextCashWeight(CASH_WEIGHT_MIN, 'RAISE_CASH'), CASH_WEIGHT_MIN + 0.10, 'raising moves normally');
});

test('HOLD never trades, at any cash weight inside or outside the band', () => {
  for (const cash of [0.02, CASH_WEIGHT_MIN, 0.3, CASH_WEIGHT_MAX, 0.7, 0.95]) {
    assert.equal(nextCashWeight(cash, 'HOLD'), cash, `HOLD moved cash from ${cash}`);
  }
});

// ─── 8. Provenance ────────────────────────────────────────────────────────────

test('every authored return set declares that it is game simulation', () => {
  // §0 rule 3 and §58: authored gameplay dispersion must never read as a
  // historical observation just because it is carried to four decimals.
  for (const arena of allArenas()) {
    for (let seq = 1; seq <= arena.checkpoints.length; seq++) {
      const e = getCheckpoint(arena.id, seq)!.portfolioEffect;
      if (!e.positionReturns) continue;
      assert.equal(
        e.returnsSource,
        'AUTHORED_GAME_SIMULATION',
        `${arena.id} CP${seq} ships per-symbol returns with no provenance`,
      );
    }
  }
});

test('a historical return set would have to name its source', () => {
  // Nothing ships under this yet; the law is asserted so the first set that
  // does cannot arrive unsourced.
  for (const arena of allArenas()) {
    for (let seq = 1; seq <= arena.checkpoints.length; seq++) {
      const e = getCheckpoint(arena.id, seq)!.portfolioEffect;
      if (e.returnsSource !== 'HISTORICAL_PRICE_SERIES') continue;
      assert.ok(e.returnsSourceRef, `${arena.id} CP${seq} claims historical prices with no reference`);
    }
  }
});
