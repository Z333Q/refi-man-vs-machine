import type {
  ActionCode, BehavioralFlag, CheckpointData, CheckpointScore,
  DimensionCode, PortfolioState, RunDecision, RunState,
} from './gameTypes';
import { COVID_CHECKPOINTS, getCheckpoint } from './covidArena';
import { scoreCheckpoint } from './scoringEngine';
import {
  clampConviction, confidenceToConviction, consultedRisk,
  CONVICTION_DEFAULT, convictionToConfidence,
} from './decisionContract';

// ─── Run engine ───────────────────────────────────────────────────────────────
// Pure, deterministic run-state machinery, kept out of the React layer so it is
// directly testable. The G1 gate is byte-identical state for identical decision
// sequences: nothing in this file may consult Math.random, Date, or any other
// ambient source. Everything a run needs comes from authored checkpoint content
// plus the decisions the player committed.

export const STARTING_CAPITAL = 100000;
export const TURNOVER_BUDGET_START = 0.40;
export const CRITICAL_DRAWDOWN = -0.20;

// Fallback turnover price per action code, used only where content has not
// authored a branch for the committed action. Authored branch costs win.
//
// TUNING CONSTANTS, not game-design truth. These are provisional engine
// defaults; the real values get calibrated against the 14-checkpoint
// difficulty curve in the tuning pass.
export const DEFAULT_TURNOVER_COST: Record<ActionCode, number> = {
  HOLD: 0,
  REDUCE: 0.05,
  ROTATE_DEFENSIVE: 0.07,
  ROTATE_RISK: 0.07,
  RAISE_CASH: 0.04,
  ADD_RISK: 0.06,
  STAGED_BUY: 0.03,
  STAGED_SELL: 0.03,
};

// ─── Initial state ────────────────────────────────────────────────────────────

// U.S. equities only. Bonds, gold, and commodities are signals, not positions.
// Embedded risks: TRAVEL (DAL+MAR=16%), TECH CONC (MSFT+AAPL=20%), CYCLICAL (CAT+XOM+HD=23%)
export function createInitialPortfolio(): PortfolioState {
  return {
    value: STARTING_CAPITAL,
    cashWeight: 0.15,
    positions: [
      { symbol: 'MSFT', weight: 0.10, pnl: 0, riskContrib: 0.14, sector: 'TECHNOLOGY' },
      { symbol: 'AAPL', weight: 0.10, pnl: 0, riskContrib: 0.14, sector: 'TECHNOLOGY' },
      { symbol: 'JPM',  weight: 0.10, pnl: 0, riskContrib: 0.18, sector: 'FINANCIALS' },
      { symbol: 'DAL',  weight: 0.08, pnl: 0, riskContrib: 0.20, sector: 'AIRLINES' },
      { symbol: 'MAR',  weight: 0.08, pnl: 0, riskContrib: 0.18, sector: 'HOTELS' },
      { symbol: 'XOM',  weight: 0.08, pnl: 0, riskContrib: 0.16, sector: 'ENERGY' },
      { symbol: 'JNJ',  weight: 0.08, pnl: 0, riskContrib: 0.07, sector: 'HEALTHCARE' },
      { symbol: 'PG',   weight: 0.08, pnl: 0, riskContrib: 0.06, sector: 'CONSUMER STAPLES' },
      { symbol: 'CAT',  weight: 0.08, pnl: 0, riskContrib: 0.15, sector: 'INDUSTRIALS' },
      { symbol: 'HD',   weight: 0.07, pnl: 0, riskContrib: 0.10, sector: 'CONSUMER DISCRETIONARY' },
    ],
    peakValue: STARTING_CAPITAL,
    drawdown: 0,
    volatility: 0.16,
    sectorExposure: {
      TECHNOLOGY: 0.20, FINANCIALS: 0.10, AIRLINES: 0.08,
      HOTELS: 0.08, ENERGY: 0.08, HEALTHCARE: 0.08,
      'CONSUMER STAPLES': 0.08, INDUSTRIALS: 0.08, 'CONSUMER DISCRETIONARY': 0.07,
    },
    turnoverUsed: 0,
    correlationIndex: 0.48,
  };
}

export function createInitialRun(): RunState {
  return {
    id: null,
    arenaId: 'covid_black_swan',
    machineId: 'refi_rules',
    currentCheckpoint: 1,
    totalCheckpoints: COVID_CHECKPOINTS.length,
    phase: 'SIGNAL',
    portfolio: createInitialPortfolio(),
    turnoverBudget: TURNOVER_BUDGET_START,
    playerScore: 50,
    machineScore: 50,
    decisions: [],
    criticalFailure: false,
    criticalFailureCheckpoint: null,
    activeModules: ['PRICE_RETURN', 'PORTFOLIO_SUMMARY', 'SECTOR_EXPOSURE', 'NEWS_FEED'],
    investigatedModules: [],
    pendingAction: null,
    pendingThesis: null,
    pendingConfidence: convictionToConfidence(CONVICTION_DEFAULT),
    result: 'ACTIVE',
  };
}

// ─── Turnover budget ──────────────────────────────────────────────────────────

export function turnoverCostFor(action: ActionCode, checkpoint?: CheckpointData): number {
  const branch = checkpoint?.availableActions.find(a => a.actionCode === action);
  return branch?.turnoverCost ?? DEFAULT_TURNOVER_COST[action];
}

export function turnoverRemaining(run: RunState): number {
  return Math.max(0, run.turnoverBudget - run.portfolio.turnoverUsed);
}

export function isTurnoverExhausted(run: RunState): boolean {
  return run.portfolio.turnoverUsed >= run.turnoverBudget;
}

/**
 * Whether a stance still fits inside the remaining budget. HOLD is free and
 * therefore always available.
 *
 * The budget is a hard constraint, not a threshold that blocks the action
 * after the one that overruns it: a stance the player cannot fully pay for is
 * unavailable. Expensive stances fall away before cheap ones as the meter
 * drains, so earlier decisions visibly narrow later ones.
 */
export function canAffordAction(run: RunState, action: ActionCode, checkpoint?: CheckpointData): boolean {
  if (action === 'HOLD') return true;
  const cp = checkpoint ?? getCheckpoint(run.currentCheckpoint);
  // Cents-scale epsilon so accumulated float error cannot bar an action that
  // exactly fits the remaining budget.
  return run.portfolio.turnoverUsed + turnoverCostFor(action, cp) <= run.turnoverBudget + 1e-9;
}

/** The stances this checkpoint offers that the remaining budget still covers. */
export function affordableActions(run: RunState, checkpoint?: CheckpointData): ActionCode[] {
  const cp = checkpoint ?? getCheckpoint(run.currentCheckpoint);
  const offered = cp?.availableActions.map(a => a.actionCode) ?? [];
  return offered.filter(a => canAffordAction(run, a, cp));
}

/** True when nothing but HOLD is left affordable at this checkpoint. */
export function isHoldOnly(run: RunState, checkpoint?: CheckpointData): boolean {
  return affordableActions(run, checkpoint).every(a => a === 'HOLD');
}

// ─── Portfolio advance ────────────────────────────────────────────────────────

export function simulatePortfolioAdvance(
  portfolio: PortfolioState,
  action: ActionCode,
  checkpointSeq: number
): PortfolioState {
  const cp = getCheckpoint(checkpointSeq);
  if (!cp) return portfolio;

  const { returnBias, volatilityDelta, correlationLevel, positionReturns } = cp.portfolioEffect;
  const actionMultiplier =
    action === 'REDUCE' ? 0.6 :
    action === 'RAISE_CASH' ? 0.3 :
    action === 'ADD_RISK' ? 1.4 :
    action === 'ROTATE_DEFENSIVE' ? 0.7 :
    1.0;

  const portfolioReturn = returnBias * actionMultiplier;
  const newValue = portfolio.value * (1 + portfolioReturn);
  const peakValue = Math.max(portfolio.peakValue, newValue);
  const newDrawdown = Math.min(0, (newValue - peakValue) / peakValue);
  const newVolatility = Math.max(0.08, portfolio.volatility + volatilityDelta);
  const cashDelta = action === 'RAISE_CASH' ? 0.10 : action === 'ADD_RISK' ? -0.05 : action === 'REDUCE' ? 0.05 : 0;
  const newCash = Math.max(0.05, Math.min(0.60, portfolio.cashWeight + cashDelta));
  const newTurnover = portfolio.turnoverUsed + turnoverCostFor(action, cp);

  return {
    ...portfolio,
    value: newValue,
    peakValue,
    drawdown: newDrawdown,
    volatility: newVolatility,
    cashWeight: newCash,
    turnoverUsed: newTurnover,
    correlationIndex: correlationLevel,
    positions: portfolio.positions.map(pos => ({
      ...pos,
      pnl: pos.pnl + (positionReturns?.[pos.symbol] ?? returnBias) * actionMultiplier,
    })),
  };
}

// ─── Commit ───────────────────────────────────────────────────────────────────

export interface CommitOutcome {
  run: RunState;
  score: CheckpointScore;
  flags: BehavioralFlag[];
  dimUpdates: Partial<Record<DimensionCode, number>>;
  checkpoint: CheckpointData;
}

/**
 * Apply the run's pending decision (stance, thesis, conviction) and advance the
 * simulated portfolio one checkpoint. Returns the new run plus the pieces the
 * profile layer needs; profile mutation stays outside this engine.
 */
export function commitPendingDecision(run: RunState): CommitOutcome | null {
  const action = run.pendingAction;
  if (!action) return null;
  const cp = getCheckpoint(run.currentCheckpoint);
  if (!cp) return null;

  const branch = cp.availableActions.find(a => a.actionCode === action);
  const flags: BehavioralFlag[] = [...(branch?.branchEffect.flagsAdd ?? [])];
  const dimUpdates = branch?.branchEffect.alphaImpact ?? {};
  const turnoverCost = turnoverCostFor(action, cp);
  // The UI clamps conviction to the range this checkpoint exposes; the engine
  // guarantees it, so a stale or out-of-range value can never reach scoring.
  const conviction = clampConviction(confidenceToConviction(run.pendingConfidence), run.currentCheckpoint);
  const confidence = convictionToConfidence(conviction);

  // Investigation pays. Consulting risk before calling a regime turn is the
  // process the game exists to teach, so the record credits it.
  if (cp.isRegimeChange && consultedRisk(run.investigatedModules) && !flags.includes('GOOD_PROCESS')) {
    flags.push('GOOD_PROCESS');
  }

  const score = scoreCheckpoint({
    action,
    checkpoint: cp,
    flags,
    confidence,
    turnoverUsed: run.portfolio.turnoverUsed,
    portfolioDD: run.portfolio.drawdown,
    // No fabricated machine drawdown. Where content authors one it is used;
    // otherwise drawdown scores against the arena risk budget.
    machineDD: cp.portfolioEffect.machineDrawdown,
    riskBudgetDD: CRITICAL_DRAWDOWN,
  });

  const decision: RunDecision = {
    checkpointSequence: run.currentCheckpoint,
    actionCode: action,
    thesisCode: run.pendingThesis ?? undefined,
    confidence,
    modulesConsulted: run.investigatedModules,
    turnoverCost,
    scoreContribution: score.totalScore,
    quality: score.quality,
    behavioralFlags: flags,
    machineActionCode: cp.machineDecision.actionCode,
    committed: true,
  };

  const portfolio = simulatePortfolioAdvance(run.portfolio, action, run.currentCheckpoint);
  const crossedNow = portfolio.drawdown <= CRITICAL_DRAWDOWN;
  const n = run.currentCheckpoint;
  const playerScore = Math.round((run.playerScore * (n - 1) + score.totalScore) / n);
  const machineScore = Math.round((run.machineScore * (n - 1) + score.machineScore) / n);

  return {
    run: {
      ...run,
      phase: 'RESOLVING',
      decisions: [...run.decisions, decision],
      portfolio,
      playerScore,
      machineScore,
      pendingAction: null,
      pendingThesis: null,
      investigatedModules: [],
      // Crossing the critical drawdown is a fact about the run, not a current
      // reading: once crossed it stays crossed, and a later recovery does not
      // erase it.
      criticalFailure: crossedNow || run.criticalFailure,
      criticalFailureCheckpoint: run.criticalFailureCheckpoint
        ?? (crossedNow ? run.currentCheckpoint : null),
    },
    score,
    flags,
    dimUpdates,
    checkpoint: cp,
  };
}

// ─── Observation mode ─────────────────────────────────────────────────────────

/**
 * A run that crossed the critical drawdown cannot beat the machine.
 *
 * Observation mode has to cost something or it is only a banner. Crossing
 * -20% ends the contest: the run continues so the player can keep reading
 * machine decisions, but MACHINE_BEATEN is off the table for the rest of it,
 * whatever the average score says afterwards.
 */
export function resolveRunResult(run: RunState, requested: RunState['result']): RunState['result'] {
  if (!run.criticalFailure) return requested;
  return requested === 'MACHINE_BEATEN' ? 'PASSED' : requested;
}

/** One line stating where the run lost its claim on the machine. */
export function observationModeReason(run: RunState): string | null {
  if (!run.criticalFailure) return null;
  const at = run.criticalFailureCheckpoint;
  return at
    ? `DRAWDOWN EXCEEDED -20% AT CP${String(at).padStart(2, '0')}. THIS RUN CANNOT BEAT THE MACHINE.`
    : 'DRAWDOWN EXCEEDED -20%. THIS RUN CANNOT BEAT THE MACHINE.';
}

/** Move to the next checkpoint, or mark the run complete. */
export function advanceRunCheckpoint(run: RunState): RunState {
  const next = run.currentCheckpoint + 1;
  if (next > run.totalCheckpoints) {
    return { ...run, phase: 'COMPLETE' };
  }
  return {
    ...run,
    currentCheckpoint: next,
    phase: 'SIGNAL',
    investigatedModules: [],
    pendingAction: null,
    pendingThesis: null,
    // Each checkpoint starts from the same neutral conviction, so a high call
    // has to be re-argued rather than inherited.
    pendingConfidence: convictionToConfidence(CONVICTION_DEFAULT),
  };
}
