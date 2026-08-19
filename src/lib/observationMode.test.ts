import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RunState } from './gameTypes';
import { COVID_CHECKPOINTS, } from './covidArena';
import { getCheckpoint } from './arenas';
import './arenaIndex';
import { scoreCheckpoint } from './scoringEngine';
import {
  createInitialRun, commitPendingDecision, advanceRunCheckpoint,
  resolveRunResult, observationModeReason, CRITICAL_DRAWDOWN,
} from './runEngine';

// ─── Par lives in content ─────────────────────────────────────────────────────

// The authored difficulty curve. Locked here so a change to it is a deliberate
// content edit that updates this row, not a silent drift.
//
// Recalibrated 2026-08. The previous curve climbed 60 to 84 across the arena
// while the score a player can actually reach FALLS, because drawdownScore
// (20% weight) and turnoverScore (10%) both decay as a crisis runs long. In a
// 22-checkpoint crash that is a third of the score eroding under the player.
// The two curves crossed at CP7: from CP8 to CP22 the best available move
// scored 5 to 18 points BELOW par, so fifteen consecutive checkpoints were
// unwinnable no matter what the player chose. Measured, not estimated — the
// engine is deterministic, so the achievable ceiling can be swept exactly.
//
// That contradicted §1.4, which asks for beating the machine to be hard and
// repeatable-with-difficulty, not arithmetically impossible. The curve now
// tracks the achievable ceiling with headroom tapering from about +18 to about
// +3, which is the same difficulty shape Recovery and Banking Stress already
// have and which they demonstrably play well at.
//
// Par falls through the panic phase rather than climbing. That is the honest
// direction: the machine is taking drawdown in March 2020 too, and a par that
// rises while every participant is being hurt describes no machine that exists.
//
// This remains authored content. §26.4's transparent rules machine is the real
// answer — par generated from an actual constrained-machine run rather than
// hand-authored — and until that exists these numbers are a calibration, not a
// benchmark, and must not be presented as one.
const PAR_CURVE = [
  64, 63, 64, 70, 69, 63, 64, 60, 56, 52, 52, 56, 55, 59,
  // CP15-22, the re-entry arc §21.3 specifies. Par recovers as the drawdown
  // heals and the scoreable question turns back into discipline from survival.
  59, 61, 66, 62, 64, 62, 65, 67,
];

test('every checkpoint authors its own par', () => {
  assert.equal(COVID_CHECKPOINTS.length, PAR_CURVE.length);
  COVID_CHECKPOINTS.forEach((cp, i) => {
    assert.equal(typeof cp.machinePar, 'number', `CP${cp.sequence}`);
    assert.equal(cp.machinePar, PAR_CURVE[i], `CP${cp.sequence} par drifted`);
    assert.ok(cp.machinePar > 0 && cp.machinePar <= 100, `CP${cp.sequence} par out of range`);
  });
});

test('par rises across the run but dips at the deception beat', () => {
  const par = COVID_CHECKPOINTS.map(c => c.machinePar);
  // Overall the machine gets harder to beat.
  assert.ok(par[par.length - 1] > par[0], 'par should rise across the arena');
  // CP6 is the Fed-cut head fake: the machine misreads it too, and showing
  // that is the honest-machine trust beat. It must stay below CP5.
  assert.ok(par[5] < par[4], 'CP6 must dip below CP5');
  // And the curve must not be a straight monotonic ramp, which would make
  // Silver statistically unreachable.
  const monotonic = par.every((v, i) => i === 0 || v >= par[i - 1]);
  assert.equal(monotonic, false, 'par should not be a monotonic ramp');
});

test('par is not a phase constant', () => {
  // The engine used to derive par from the checkpoint phase, which made every
  // checkpoint in a phase equally hard.
  const byPhase = new Map<string, Set<number>>();
  for (const cp of COVID_CHECKPOINTS) {
    if (!byPhase.has(cp.phase)) byPhase.set(cp.phase, new Set());
    byPhase.get(cp.phase)!.add(cp.machinePar);
  }
  const varied = [...byPhase.values()].filter(s => s.size > 1);
  assert.ok(varied.length > 0, 'no phase has a varying par, so par is still phase-derived');
});

test('scoring reads par straight from the checkpoint', () => {
  for (const cp of COVID_CHECKPOINTS) {
    const score = scoreCheckpoint({
      action: 'HOLD',
      checkpoint: cp,
      flags: [],
      confidence: 0.7,
      turnoverUsed: 0,
      portfolioDD: 0,
    });
    assert.equal(score.machineScore, cp.machinePar, `CP${cp.sequence}`);
    assert.equal(score.delta, score.totalScore - cp.machinePar, `CP${cp.sequence} delta`);
  }
});

test('changing a checkpoint par changes only that checkpoint', () => {
  const cp = getCheckpoint('covid_black_swan', 3);
  assert.ok(cp);
  const raised = scoreCheckpoint({
    action: 'HOLD',
    checkpoint: { ...cp, machinePar: 95 },
    flags: [],
    confidence: 0.7,
    turnoverUsed: 0,
    portfolioDD: 0,
  });
  assert.equal(raised.machineScore, 95);
  assert.equal(getCheckpoint('covid_black_swan', 3)?.machinePar, PAR_CURVE[2], 'content was mutated');
});

// ─── No fabricated machine drawdown ───────────────────────────────────────────

test('with no authored machine drawdown, drawdown scores against the risk budget', () => {
  const cp = getCheckpoint('covid_black_swan', 1);
  assert.ok(cp);
  const at = (dd: number) => scoreCheckpoint({
    action: 'HOLD', checkpoint: cp, flags: [], confidence: 0.7,
    turnoverUsed: 0, portfolioDD: dd, riskBudgetDD: CRITICAL_DRAWDOWN,
  }).drawdownScore;

  assert.equal(at(0), 100);            // flat consumes none of the budget
  assert.equal(at(-0.10), 50);         // half the budget spent
  assert.equal(at(CRITICAL_DRAWDOWN), 0);
  assert.equal(at(-0.35), 0);          // past the line, still floored
});

test('an authored machine drawdown is used when content supplies one', () => {
  const cp = getCheckpoint('covid_black_swan', 1);
  assert.ok(cp);
  const versus = (playerDD: number, machineDD: number) => scoreCheckpoint({
    action: 'HOLD', checkpoint: cp, flags: [], confidence: 0.7,
    turnoverUsed: 0, portfolioDD: playerDD, machineDD,
  }).drawdownScore;

  // Drawdowns are negative, so the shallower one is the larger number.
  // Protecting capital better than the machine has to score better.
  assert.ok(versus(-0.10, -0.12) > 50, 'shallower than the machine should beat neutral');
  assert.ok(versus(-0.12, -0.10) < 50, 'deeper than the machine should trail neutral');
  assert.equal(versus(-0.10, -0.10), 50, 'matching the machine is neutral');
  assert.ok(
    versus(-0.05, -0.15) > versus(-0.09, -0.11),
    'a wider protection gap should score higher',
  );
});

// ─── Observation mode is a real failure ───────────────────────────────────────

function failedRun(): RunState {
  let run = createInitialRun();
  run = {
    ...run,
    currentCheckpoint: 7,
    portfolio: { ...run.portfolio, value: 82000, peakValue: 100000, drawdown: -0.18 },
    pendingAction: 'ADD_RISK',
    pendingConfidence: 0.9,
  };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);
  assert.equal(outcome.run.criticalFailure, true, 'fixture did not cross the line');
  return outcome.run;
}

test('a run that crossed -20% cannot end MACHINE_BEATEN', () => {
  const run = failedRun();
  assert.equal(resolveRunResult(run, 'MACHINE_BEATEN'), 'PASSED');
});

test('a clean run keeps whatever result it earned', () => {
  const run = createInitialRun();
  assert.equal(run.criticalFailure, false);
  assert.equal(resolveRunResult(run, 'MACHINE_BEATEN'), 'MACHINE_BEATEN');
  assert.equal(resolveRunResult(run, 'PASSED'), 'PASSED');
  assert.equal(resolveRunResult(run, 'FAILED'), 'FAILED');
});

test('observation mode caps only the machine beat, not the other outcomes', () => {
  const run = failedRun();
  assert.equal(resolveRunResult(run, 'FAILED'), 'FAILED');
  assert.equal(resolveRunResult(run, 'PASSED'), 'PASSED');
  assert.equal(resolveRunResult(run, 'ABANDONED'), 'ABANDONED');
});

test('the run records the checkpoint where it crossed', () => {
  const run = failedRun();
  assert.equal(run.criticalFailureCheckpoint, 7);
  assert.equal(
    observationModeReason(run),
    'DRAWDOWN EXCEEDED -20% AT CP07. THIS RUN CANNOT BEAT THE MACHINE.',
  );
});

test('a later crossing does not overwrite where it first happened', () => {
  let run = advanceRunCheckpoint(failedRun());
  run = {
    ...run,
    portfolio: { ...run.portfolio, value: 70000, peakValue: 100000, drawdown: -0.30 },
    pendingAction: 'HOLD',
  };
  const outcome = commitPendingDecision(run);
  assert.ok(outcome);
  assert.equal(outcome.run.criticalFailureCheckpoint, 7);
});

test('a clean run has no observation reason to state', () => {
  assert.equal(observationModeReason(createInitialRun()), null);
});

test('the observation line names the checkpoint, so it is never generic', () => {
  const run = failedRun();
  const line = observationModeReason(run);
  assert.ok(line);
  assert.ok(line.includes('CP07'), 'line should name where it happened');
  assert.ok(line.includes('CANNOT BEAT THE MACHINE'));
  assert.ok(!line.includes('—'), 'no em dashes in player-facing copy');
});
