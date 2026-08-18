// ─── Stress test ──────────────────────────────────────────────────────────────
//
// Runs a player's compiled machine against an authored arena (§17.13, §64
// Phase 3, and the §16 payoff the whole loop points at: you have seen the gap,
// now build the process and find out whether it survives).
//
// Fairness is structural, not promised. The machine is committed through
// `commitDecisionCommand` — the same entry point the player's gesture, slider
// and keyboard all go through — so it faces the identical turnover budget,
// the identical authored branch economics, the identical scoring and the
// identical critical-drawdown rule. §26.5's Fair Match is not a mode here; it
// is the only way this can run.
//
// §26.4: this is the transparent GAME RULES MACHINE. No forecast, no training,
// no future data. It must never be presented as RF/RL benchmark performance.

import type {
  ActionCode, ArenaId, BehavioralFlag, CheckpointData, MachineConfig, RunState,
} from './gameTypes';
import { getCheckpoint } from './arenas';
import {
  advanceRunCheckpoint, attachThesis, canAffordAction, commitDecisionCommand,
  createInitialRun, runRiskAdjusted,
} from './runEngine';
import { decideCheckpoint, type PolicyReason } from './machinePolicy';

/** Identifies what produced a result, so the UI can never mislabel it (§26.1). */
export const STRESS_TEST_SOURCE = 'GAME_RULES_ENGINE' as const;

export interface StressTestStep {
  sequence: number;
  crisisDay: string;
  signalTitle: string;
  action: ActionCode;
  /** What the policy wanted before availability and budget were applied. */
  preferred: ActionCode;
  reason: PolicyReason;
  /** Why the committed stance differs from the preferred one, if it does. */
  substitution: 'NONE' | 'TURNOVER_EXHAUSTED' | 'STANCE_UNAVAILABLE';
  conviction: number;
  score: number;
  par: number;
  quality: string;
  flags: BehavioralFlag[];
}

export interface StressTestResult {
  sourceType: typeof STRESS_TEST_SOURCE;
  arenaId: ArenaId;
  seed: number;
  steps: StressTestStep[];
  /** The finished run, for anything that wants the portfolio or the record. */
  run: RunState;

  machineScore: number;
  parTotal: number;
  scoreTotal: number;
  /** Points above or below the arena's published par. */
  vsPar: number;

  finalReturn: number;
  sharpe: number | null;
  maxDrawdown: number;
  turnoverUsed: number;
  criticalFailure: boolean;
  criticalFailureCheckpoint: number | null;

  /** Checkpoints where the machine wanted one thing and could do another. */
  blockedCount: number;
  holdCount: number;
}

/**
 * The thesis a policy reason corresponds to.
 *
 * The machine states one for the same reason the player is asked to: a
 * decision record without a stated reason is not auditable. Mapped rather than
 * invented, so the thesis can never disagree with the reason that produced it.
 */
const REASON_THESIS: Record<PolicyReason, Parameters<typeof attachThesis>[1]> = {
  DRAWDOWN_GATE: 'VOLATILITY_CONTROL',
  CASH_FLOOR: 'LIQUIDITY_PRESERVATION',
  CORRELATION_GUARD: 'DIVERSIFICATION',
  REGIME_CHANGE: 'REGIME_CHANGE',
  MOMENTUM_POSITIVE: 'MOMENTUM',
  MOMENTUM_NEGATIVE: 'DETERIORATING_FUNDAMENTALS',
  VOLATILITY_RISING: 'VOLATILITY_CONTROL',
  THESIS_INTACT: 'THESIS_UNCHANGED',
  OFF_CYCLE: 'THESIS_UNCHANGED',
  TURNOVER_EXHAUSTED: 'LIQUIDITY_PRESERVATION',
  STANCE_UNAVAILABLE: 'THESIS_UNCHANGED',
};

/**
 * Run a machine through an arena, checkpoint by checkpoint.
 *
 * Pure: the seed is supplied, nothing reads a clock or an RNG, and the same
 * machine against the same arena produces the same result every time. That is
 * what makes this a test rather than a demonstration.
 */
export function runStressTest(
  config: MachineConfig,
  options: { seed?: number; arenaId?: ArenaId } = {},
): StressTestResult {
  const seed = options.seed ?? 0;
  const arenaId: ArenaId = options.arenaId ?? 'covid_black_swan';

  let run: RunState = { ...createInitialRun(seed, arenaId), id: `stress_${seed}` };
  const steps: StressTestStep[] = [];

  for (let guard = 0; guard < run.totalCheckpoints + 1; guard++) {
    const cp: CheckpointData | undefined = getCheckpoint(arenaId, run.currentCheckpoint);
    if (!cp) break;

    const decision = decideCheckpoint(
      config,
      cp,
      run.portfolio,
      action => canAffordAction(run, action, cp),
    );

    const outcome = commitDecisionCommand(run, {
      action: decision.action,
      conviction: decision.conviction,
    });
    // The engine is the authority on what may be committed. A refusal ends the
    // run rather than being papered over: a stress test that silently skipped
    // checkpoints would report a score for a run that did not happen.
    if (!outcome) break;

    run = attachThesis(outcome.run, REASON_THESIS[decision.reason]);

    steps.push({
      sequence: cp.sequence,
      crisisDay: cp.crisisDay,
      signalTitle: cp.signalTitle,
      action: decision.action,
      preferred: decision.preferred,
      reason: decision.reason,
      substitution: decision.substitution,
      conviction: decision.conviction,
      score: outcome.score.totalScore,
      par: cp.machinePar,
      quality: outcome.score.quality,
      flags: outcome.flags,
    });

    if (run.currentCheckpoint >= run.totalCheckpoints) break;
    run = advanceRunCheckpoint(run);
  }

  const risk = runRiskAdjusted(run.decisions, arenaId);
  const scoreTotal = steps.reduce((a, s) => a + s.score, 0);
  const parTotal = steps.reduce((a, s) => a + s.par, 0);

  return {
    sourceType: STRESS_TEST_SOURCE,
    arenaId,
    seed,
    steps,
    run,

    machineScore: run.playerScore,
    parTotal,
    scoreTotal,
    vsPar: scoreTotal - parTotal,

    finalReturn: risk.playerReturn,
    sharpe: risk.playerSharpe,
    maxDrawdown: run.portfolio.drawdown,
    turnoverUsed: run.portfolio.turnoverUsed,
    criticalFailure: run.criticalFailure,
    criticalFailureCheckpoint: run.criticalFailureCheckpoint,

    blockedCount: steps.filter(s => s.substitution !== 'NONE').length,
    holdCount: steps.filter(s => s.action === 'HOLD').length,
  };
}

/**
 * The one-line reading of a stress test.
 *
 * Says what happened and declines to flatter. A machine that breached the risk
 * budget is reported as having breached it, whatever its score.
 */
export function stressTestVerdict(result: StressTestResult): { headline: string; detail: string } {
  if (result.steps.length === 0) {
    return {
      headline: 'THE MACHINE DID NOT RUN.',
      detail: 'No checkpoint accepted a decision from this configuration.',
    };
  }

  if (result.criticalFailure) {
    return {
      headline: 'RISK BUDGET BREACHED.',
      detail: result.criticalFailureCheckpoint !== null
        ? `Drawdown crossed the arena limit at checkpoint ${result.criticalFailureCheckpoint}. Your guardrails did not hold.`
        : 'Drawdown crossed the arena limit. Your guardrails did not hold.',
    };
  }

  if (result.vsPar > 0) {
    return {
      headline: `BEAT PAR BY ${result.vsPar}.`,
      detail: `Across ${result.steps.length} checkpoints, on the same budget and the same limits. One arena is one regime.`,
    };
  }
  if (result.vsPar === 0) {
    return {
      headline: 'LEVEL WITH PAR.',
      detail: `${result.steps.length} checkpoints, no gap either way.`,
    };
  }
  return {
    headline: `UNDER PAR BY ${-result.vsPar}.`,
    detail: 'The rules held. They were not the right rules for this regime.',
  };
}
