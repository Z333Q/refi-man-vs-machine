import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_MACHINE_CONFIG, DEFAULT_GUARDRAILS } from './gameTypes';
import type { MachineConfig } from './gameTypes';
import { runStressTest, stressTestVerdict, STRESS_TEST_SOURCE } from './stressTest';
import { decideCheckpoint, REASON_TEXT } from './machinePolicy';
import { getCheckpoint } from './arenas';
import './arenaIndex';
import { createInitialRun } from './runEngine';

function cfg(o: Partial<MachineConfig> = {}): MachineConfig {
  return { ...DEFAULT_MACHINE_CONFIG, guardrails: { ...DEFAULT_GUARDRAILS }, ...o };
}

// ─── Determinism ──────────────────────────────────────────────────────────────

test('the same machine against the same arena gives the same result', () => {
  const a = runStressTest(cfg(), { seed: 99 });
  const b = runStressTest(cfg(), { seed: 99 });
  assert.deepEqual(
    a.steps.map(s => [s.sequence, s.action, s.reason, s.score]),
    b.steps.map(s => [s.sequence, s.action, s.reason, s.score]),
  );
  assert.equal(a.scoreTotal, b.scoreTotal);
});

test('a stress test runs the whole arena', () => {
  const r = runStressTest(cfg(), { seed: 1 });
  assert.equal(r.steps.length, createInitialRun().totalCheckpoints);
  assert.equal(r.steps[0].sequence, 1);
});

test('the result is labelled as the rules engine, never as RF/RL', () => {
  // §26.4: a transparent rules machine must not be presented as RF/RL
  // benchmark performance.
  assert.equal(runStressTest(cfg()).sourceType, STRESS_TEST_SOURCE);
  assert.equal(STRESS_TEST_SOURCE, 'GAME_RULES_ENGINE');
});

// ─── The configuration has to matter ──────────────────────────────────────────

test('different signal layers produce different runs', () => {
  // If every machine played the same way, the screen would be reporting a
  // result that has nothing to do with what the player built.
  const momentum = runStressTest(cfg({ signal: 'PRICE_MOMENTUM' }), { seed: 5 });
  const rfrl = runStressTest(cfg({ signal: 'RF_RL_PIPELINE' }), { seed: 5 });
  assert.notDeepEqual(
    momentum.steps.map(s => s.action),
    rfrl.steps.map(s => s.action),
  );
});

test('a regime-blind signal never cites a regime change', () => {
  const r = runStressTest(cfg({ signal: 'PRICE_MOMENTUM' }), { seed: 5 });
  assert.ok(
    !r.steps.some(s => s.reason === 'REGIME_CHANGE'),
    'momentum is regime-blind by construction; that is the lesson',
  );
});

test('a regime-aware signal does cite one, on an arena that has regime turns', () => {
  const r = runStressTest(cfg({ signal: 'REGIME_CLASSIFIER' }), { seed: 5 });
  assert.ok(r.steps.some(s => s.reason === 'REGIME_CHANGE'));
});

test('a slower cadence acts less often', () => {
  const daily = runStressTest(cfg({ execution: 'DAILY_CLOSE' }), { seed: 5 });
  const weekly = runStressTest(cfg({ execution: 'WEEKLY' }), { seed: 5 });
  assert.ok(
    weekly.holdCount > daily.holdCount,
    'a weekly rebalance is not looking on most checkpoints (§17.10)',
  );
  assert.ok(weekly.steps.some(s => s.reason === 'OFF_CYCLE'));
});

test('turnover discipline follows from cadence, not from luck', () => {
  const daily = runStressTest(cfg({ execution: 'DAILY_CLOSE' }), { seed: 5 });
  const weekly = runStressTest(cfg({ execution: 'WEEKLY' }), { seed: 5 });
  assert.ok(weekly.turnoverUsed <= daily.turnoverUsed);
});

test('construction choice moves conviction', () => {
  const equal = runStressTest(cfg({ construction: 'EQUAL_WEIGHT' }), { seed: 5 });
  const opt = runStressTest(cfg({ construction: 'CONSTRAINED_OPT' }), { seed: 5 });
  assert.ok(
    Math.max(...opt.steps.map(s => s.conviction)) >
    Math.max(...equal.steps.map(s => s.conviction)),
    'equal weight expresses no view on signal strength, so it never leans',
  );
});

// ─── Guardrails ───────────────────────────────────────────────────────────────

test('a machine that cannot see correlation cannot respond to it', () => {
  // §17.11: the monitoring layer decides what the machine is able to notice.
  // Skipping it should cost the player who skipped it.
  const cp = getCheckpoint('covid_black_swan', 1)!;
  const highCorrelation = {
    ...cp,
    portfolioEffect: { ...cp.portfolioEffect, correlationLevel: 0.99 },
  };
  const portfolio = createInitialRun().portfolio;

  const blind = decideCheckpoint(
    cfg({ monitoring: 'PASSIVE', guardrails: { ...DEFAULT_GUARDRAILS, maxCorrelation: 0.5 } }),
    highCorrelation, portfolio, () => true,
  );
  const watching = decideCheckpoint(
    cfg({ monitoring: 'FULL_RISK_MONITOR', guardrails: { ...DEFAULT_GUARDRAILS, maxCorrelation: 0.5 } }),
    highCorrelation, portfolio, () => true,
  );

  assert.notEqual(blind.reason, 'CORRELATION_GUARD');
  assert.equal(watching.reason, 'CORRELATION_GUARD');
});

test('a breached drawdown gate outranks the signal', () => {
  const cp = getCheckpoint('covid_black_swan', 1)!;
  const deepLoss = { ...createInitialRun().portfolio, drawdown: -0.9 };
  const d = decideCheckpoint(
    cfg({ signal: 'PRICE_MOMENTUM' }), cp, deepLoss, () => true,
  );
  assert.equal(d.reason, 'DRAWDOWN_GATE', 'guardrails are what the machine may not do (§17.6)');
});

test('a guardrail ignores the rebalance cycle', () => {
  // A machine that waited for its weekly slot while past its own drawdown gate
  // would not be following the rule the player wrote.
  const offCycleSeq = [2, 3].find(n => getCheckpoint('covid_black_swan', n));
  const cp = getCheckpoint('covid_black_swan', offCycleSeq!)!;
  const deepLoss = { ...createInitialRun().portfolio, drawdown: -0.9 };
  const d = decideCheckpoint(cfg({ execution: 'WEEKLY' }), cp, deepLoss, () => true);
  assert.equal(d.reason, 'DRAWDOWN_GATE');
});

test('a cash floor breach is answered before the signal', () => {
  const cp = getCheckpoint('covid_black_swan', 1)!;
  const noCash = { ...createInitialRun().portfolio, cashWeight: 0 };
  const d = decideCheckpoint(
    cfg({ guardrails: { ...DEFAULT_GUARDRAILS, cashFloorPct: 0.2 } }),
    cp, noCash, () => true,
  );
  assert.equal(d.reason, 'CASH_FLOOR');
});

// ─── Degrading safely ─────────────────────────────────────────────────────────

test('an unaffordable stance degrades rather than being committed', () => {
  const cp = getCheckpoint('covid_black_swan', 1)!;
  const portfolio = createInitialRun().portfolio;
  // Only HOLD is affordable.
  const d = decideCheckpoint(cfg(), cp, portfolio, action => action === 'HOLD');
  assert.equal(d.action, 'HOLD');
  assert.ok(['TURNOVER_EXHAUSTED', 'STANCE_UNAVAILABLE', 'THESIS_INTACT'].includes(d.reason));
});

test('a blocked de-risk never degrades into adding risk', () => {
  const cp = getCheckpoint('covid_black_swan', 1)!;
  const deepLoss = { ...createInitialRun().portfolio, drawdown: -0.9 };
  const d = decideCheckpoint(cfg(), cp, deepLoss, a => a !== 'REDUCE');
  assert.notEqual(d.action, 'ADD_RISK', 'degrading must not reverse the machine’s intent');
});

test('every decision the policy makes is one the checkpoint authors', () => {
  for (let seq = 1; seq <= 14; seq++) {
    const cp = getCheckpoint('covid_black_swan', seq);
    if (!cp) continue;
    const authored = new Set(cp.availableActions.map((a: { actionCode: string }) => a.actionCode));
    for (const signal of ['PRICE_MOMENTUM', 'QUALITY_FACTOR', 'REGIME_CLASSIFIER', 'RF_RL_PIPELINE'] as const) {
      const d = decideCheckpoint(cfg({ signal }), cp, createInitialRun().portfolio, () => true);
      assert.ok(authored.has(d.action), `cp${seq}/${signal} chose an unauthored stance: ${d.action}`);
    }
  }
});

test('every reason has player-facing text', () => {
  const r = runStressTest(cfg({ signal: 'RF_RL_PIPELINE' }), { seed: 3 });
  for (const s of r.steps) {
    assert.ok(REASON_TEXT[s.reason], `no text for ${s.reason}`);
  }
});

// ─── Reporting ────────────────────────────────────────────────────────────────

test('the score is the sum of the checkpoints, and par is the arena’s own', () => {
  const r = runStressTest(cfg(), { seed: 2 });
  assert.equal(r.scoreTotal, r.steps.reduce((a, s) => a + s.score, 0));
  assert.equal(r.parTotal, r.steps.reduce((a, s) => a + s.par, 0));
  assert.equal(r.vsPar, r.scoreTotal - r.parTotal);
});

test('a breached risk budget is reported as such whatever the score', () => {
  const r = runStressTest(cfg(), { seed: 2 });
  const breached = { ...r, criticalFailure: true, criticalFailureCheckpoint: 6, vsPar: 500 };
  assert.match(stressTestVerdict(breached).headline, /RISK BUDGET BREACHED/);
});

test('a run that committed nothing says so rather than reporting a score', () => {
  const r = runStressTest(cfg(), { seed: 2 });
  assert.match(stressTestVerdict({ ...r, steps: [] }).headline, /DID NOT RUN/);
});

test('the verdict never claims a win the score does not show', () => {
  const r = runStressTest(cfg(), { seed: 2 });
  assert.match(stressTestVerdict({ ...r, vsPar: 12 }).headline, /BEAT PAR BY 12/);
  assert.match(stressTestVerdict({ ...r, vsPar: 0 }).headline, /LEVEL/);
  assert.match(stressTestVerdict({ ...r, vsPar: -9 }).headline, /UNDER PAR BY 9/);
});

// ─── The reason survives the substitution ─────────────────────────────────────

test('a guard that fires is reported even when its stance is unavailable', () => {
  // CP7 and CP9 offer no ROTATE_DEFENSIVE, so a correlation guard there has to
  // degrade to REDUCE. An earlier version overwrote the reason with
  // STANCE_UNAVAILABLE, which made the guard look like it never fired and left
  // the monitoring layer the player paid for invisible.
  const r = runStressTest(
    cfg({ signal: 'RF_RL_PIPELINE', execution: 'INTRADAY_1H', monitoring: 'FULL_RISK_MONITOR' }),
    { seed: 7 },
  );
  const guarded = r.steps.filter(s => s.reason === 'CORRELATION_GUARD');
  assert.ok(guarded.length > 0, 'the arena reaches 0.95 correlation; the guard must fire');
  assert.ok(
    guarded.some(s => s.substitution !== 'NONE'),
    'and at least one of those had to substitute its stance',
  );
});

test('a passive machine never reports a correlation guard on the same arena', () => {
  const r = runStressTest(
    cfg({ signal: 'RF_RL_PIPELINE', execution: 'INTRADAY_1H', monitoring: 'PASSIVE' }),
    { seed: 7 },
  );
  assert.ok(!r.steps.some(s => s.reason === 'CORRELATION_GUARD'));
});

test('substitution is recorded exactly when the stance changed', () => {
  const r = runStressTest(cfg({ signal: 'RF_RL_PIPELINE' }), { seed: 7 });
  for (const s of r.steps) {
    assert.equal(
      s.substitution !== 'NONE',
      s.action !== s.preferred,
      `cp${s.sequence}: substitution flag must match whether the stance moved`,
    );
  }
  assert.equal(r.blockedCount, r.steps.filter(s => s.substitution !== 'NONE').length);
});
