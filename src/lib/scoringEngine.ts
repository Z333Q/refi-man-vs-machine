import type {
  ActionCode, CheckpointData, DecisionQuality, CheckpointScore, BehavioralFlag, DimensionCode,
} from './gameTypes';

// ─── Sigmoid utility ──────────────────────────────────────────────────────────
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ─── Component scores ─────────────────────────────────────────────────────────

function computeRAERScore(playerReturn: number, machineReturn: number): number {
  const er = playerReturn - machineReturn;
  const te = Math.abs(er) + 0.001;
  const ir = er / te;
  return Math.round(100 * sigmoid(ir * 2));
}

// Default risk budget a run is scored against when content authors no machine
// drawdown for the checkpoint. Matches the COVID arena's critical drawdown.
export const DEFAULT_RISK_BUDGET_DRAWDOWN = -0.20;

function computeDrawdownScore(
  playerDD: number,
  machineDD: number | undefined,
  riskBudget: number,
): number {
  // Where content authors the machine's drawdown, score the real comparison.
  // Drawdowns are negative, so the shallower one is the larger number: the
  // player is ahead when playerDD > machineDD. The original subtraction ran
  // the other way, which was invisible only because the caller fabricated
  // machineDD as playerDD - 0.02 and pinned this to a constant 40.
  if (machineDD !== undefined) {
    const advantage = (playerDD - machineDD) * 100;
    return clamp(50 + 5 * advantage, 0, 100);
  }
  // Otherwise score against the arena's risk budget rather than inventing a
  // machine number. Flat is 100; at the critical line is 0.
  const consumed = Math.min(1, Math.abs(playerDD) / Math.abs(riskBudget));
  return clamp(100 * (1 - consumed), 0, 100);
}

function computeDownsideScore(playerCapture: number): number {
  if (playerCapture <= 0.50) return 100;
  if (playerCapture <= 0.75) return 85;
  if (playerCapture <= 1.00) return 70;
  if (playerCapture <= 1.25) return 45;
  if (playerCapture <= 1.50) return 25;
  return 10;
}

function computeRegimeAdaptScore(
  action: ActionCode,
  checkpoint: CheckpointData,
  flags: BehavioralFlag[]
): number {
  if (!checkpoint.isRegimeChange) return 65;

  const adaptFlags: BehavioralFlag[] = ['ADAPTATION_EVENT', 'EARLY_REGIME_SENSITIVITY', 'GOOD_PROCESS'];
  const penaltyFlags: BehavioralFlag[] = ['ANCHORING', 'RECENCY_BIAS', 'REENTRY_DELAY'];

  let score = 65;
  flags.forEach(f => {
    if (adaptFlags.includes(f)) score += 10;
    if (penaltyFlags.includes(f)) score -= 12;
  });

  if (action === 'HOLD' && !checkpoint.isHoldValid) score -= 15;
  if (action !== 'HOLD' && checkpoint.isHoldValid) score -= 5;

  return clamp(score, 0, 100);
}

function computeTurnoverScore(
  action: ActionCode,
  flags: BehavioralFlag[],
  turnoverUsed: number
): number {
  let score = 75;
  if (action === 'HOLD') score = 90;

  const penaltyFlags: BehavioralFlag[] = ['ACTION_BIAS', 'PANIC_REDUCTION_LARGE', 'CHASING'];
  flags.forEach(f => {
    if (penaltyFlags.includes(f)) score -= 10;
  });

  if (turnoverUsed > 0.30) score -= 15;
  if (turnoverUsed > 0.20) score -= 8;

  return clamp(score, 0, 100);
}

function computeConsistencyScore(
  action: ActionCode,
  flags: BehavioralFlag[],
  confidence: number
): number {
  let score = 70;

  const inconsistencyFlags: BehavioralFlag[] = ['THESIS_CONTRADICTION', 'CONFIDENCE_SIZE_MISMATCH', 'OVERCONFIDENCE'];
  const consistencyFlags: BehavioralFlag[] = ['GOOD_PROCESS', 'PATIENCE_POSITIVE'];

  flags.forEach(f => {
    if (inconsistencyFlags.includes(f)) score -= 15;
    if (consistencyFlags.includes(f)) score += 8;
  });

  if (confidence < 0.4 && action !== 'HOLD') score -= 10;
  if (confidence > 0.8 && action === 'HOLD') score -= 8;

  return clamp(score, 0, 100);
}

function computePositionSizingScore(
  action: ActionCode,
  flags: BehavioralFlag[],
  confidence: number
): number {
  let score = 70;

  const oversizeFlags: BehavioralFlag[] = ['HIGH_CONVICTION_ACTION', 'PANIC_REDUCTION_LARGE', 'OVERCONFIDENCE'];
  const goodSizeFlags: BehavioralFlag[] = ['GOOD_PROCESS', 'PATIENCE_POSITIVE'];

  flags.forEach(f => {
    if (oversizeFlags.includes(f)) score -= 12;
    if (goodSizeFlags.includes(f)) score += 8;
  });

  if (action === 'RAISE_CASH' && confidence < 0.6) score -= 10;

  return clamp(score, 0, 100);
}

// ─── Machine par ──────────────────────────────────────────────────────────────

// Par is authored per checkpoint, not derived from the phase. A phase-constant
// table made every checkpoint in a phase equally hard and left the engine
// owning a difficulty curve that belongs to content.
function getMachinePar(checkpoint: CheckpointData): number {
  return checkpoint.machinePar;
}

// ─── Main scoring function ────────────────────────────────────────────────────

export function scoreCheckpoint(params: {
  action: ActionCode;
  checkpoint: CheckpointData;
  flags: BehavioralFlag[];
  confidence: number;
  turnoverUsed: number;
  portfolioDD: number;
  // Authored machine drawdown for this checkpoint, where content supplies one.
  // Absent it, drawdown is scored against the arena risk budget instead of a
  // fabricated machine number.
  machineDD?: number;
  riskBudgetDD?: number;
}): CheckpointScore {
  const {
    action, checkpoint, flags, confidence, turnoverUsed, portfolioDD, machineDD,
    riskBudgetDD = DEFAULT_RISK_BUDGET_DRAWDOWN,
  } = params;

  const { portfolioEffect } = checkpoint;
  const actionBias = action === checkpoint.machineDecision.actionCode ? 0.95 : -0.15;
  const returnBias = portfolioEffect.returnBias + actionBias * 0.02;
  const machineReturn = portfolioEffect.returnBias;
  const playerCapture = returnBias < 0 ? Math.abs(returnBias / (machineReturn - 0.001)) : 1.0;

  const raerScore = computeRAERScore(returnBias, machineReturn);
  const drawdownScore = computeDrawdownScore(portfolioDD, machineDD, riskBudgetDD);
  const downsideScore = computeDownsideScore(playerCapture);
  const recoveryScore = 65;
  const regimeAdaptScore = computeRegimeAdaptScore(action, checkpoint, flags);
  const turnoverScore = computeTurnoverScore(action, flags, turnoverUsed);
  const consistencyScore = computeConsistencyScore(action, flags, confidence);
  const positionSizingScore = computePositionSizingScore(action, flags, confidence);

  const totalScore = Math.round(
    0.25 * raerScore +
    0.20 * drawdownScore +
    0.10 * downsideScore +
    0.10 * recoveryScore +
    0.15 * regimeAdaptScore +
    0.10 * turnoverScore +
    0.10 * consistencyScore
  );

  const machineScore = getMachinePar(checkpoint);
  const delta = totalScore - machineScore;

  const quality: DecisionQuality =
    totalScore >= 85 ? 'EXCELLENT' :
    totalScore >= 72 ? 'GOOD' :
    totalScore >= 58 ? 'NEUTRAL' :
    totalScore >= 42 ? 'POOR' :
    'CRITICAL_ERROR';

  return {
    raerScore,
    drawdownScore,
    downsideScore,
    recoveryScore,
    regimeAdaptScore,
    turnoverScore,
    consistencyScore,
    positionSizingScore,
    totalScore,
    machineScore,
    delta,
    quality,
  };
}

// ─── Alpha XP awards ──────────────────────────────────────────────────────────

export function computeXpAward(score: CheckpointScore, isRegimeChange: boolean): number {
  let xp = 10;
  if (score.quality === 'EXCELLENT') xp += 20;
  if (score.quality === 'GOOD') xp += 10;
  if (score.quality === 'NEUTRAL') xp += 5;
  if (score.delta > 0) xp += 15;
  if (isRegimeChange && score.regimeAdaptScore > 70) xp += 10;
  return xp;
}

// ─── Alpha profile dimension updates from flags ───────────────────────────────

export function getDimensionUpdates(
  // Flag-weighted dimension updates are Phase-1-plus per CLAUDE.md scoring;
  // for now this passes branchImpact through untouched so the pipeline is
  // wired end-to-end and can be enriched without changing callers.
  _flags: BehavioralFlag[],
  branchImpact: Partial<Record<DimensionCode, number>>
): Partial<Record<DimensionCode, number>> {
  const updates: Partial<Record<DimensionCode, number>> = { ...branchImpact };
  return updates;
}

// ─── Archetype derivation ─────────────────────────────────────────────────────

import type { Archetype, PlayerProfile } from './gameTypes';

export function deriveArchetype(profile: PlayerProfile): Archetype {
  const d = profile.dimensions;
  const regimeScore = d.REGIME_ADAPTATION?.score ?? 50;
  const lossScore = d.LOSS_CONTROL?.score ?? 50;
  const turnoverScore = d.TURNOVER_DISCIPLINE?.score ?? 50;
  const ruleScore = d.RULE_ADHERENCE?.score ?? 50;
  const positionScore = d.POSITION_SIZING?.score ?? 50;
  const reentryScore = d.REENTRY_DISCIPLINE?.score ?? 50;
  const stockScore = d.STOCK_SELECTION?.score ?? 50;
  const consistencyScore = d.DECISION_CONSISTENCY?.score ?? 50;

  if (regimeScore >= 80) return 'REGIME_HUNTER';
  if (lossScore >= 80 && positionScore >= 70) return 'DEFENSIVE_ALLOCATOR';
  if (turnoverScore <= 40) return 'PATIENT_COMPOUNDER';
  if (ruleScore >= 80 && consistencyScore >= 75) return 'RISK_ARCHITECT';
  if (reentryScore >= 75 && stockScore >= 75) return 'TACTICAL_ROTATOR';
  if (stockScore >= 80) return 'MOMENTUM_RIDER';
  if (positionScore <= 40 && regimeScore >= 65) return 'CONTRARIAN';
  if (ruleScore >= 70) return 'POLICY_BUILDER';
  return 'UNCLASSIFIED';
}

export function getArchetypeLabel(archetype: Archetype): string {
  const labels: Record<Archetype, string> = {
    REGIME_HUNTER: 'REGIME HUNTER',
    DEFENSIVE_ALLOCATOR: 'DEFENSIVE ALLOCATOR',
    MOMENTUM_RIDER: 'MOMENTUM RIDER',
    CONTRARIAN: 'CONTRARIAN',
    RISK_ARCHITECT: 'RISK ARCHITECT',
    PATIENT_COMPOUNDER: 'PATIENT COMPOUNDER',
    TACTICAL_ROTATOR: 'TACTICAL ROTATOR',
    POLICY_BUILDER: 'POLICY BUILDER',
    UNCLASSIFIED: 'UNCLASSIFIED',
  };
  return labels[archetype];
}

export function getQualityColor(quality: DecisionQuality): string {
  const colors: Record<DecisionQuality, string> = {
    EXCELLENT: '#79FFD7',
    GOOD: '#0CD4A0',
    NEUTRAL: '#0A8F68',
    POOR: '#D6A647',
    CRITICAL_ERROR: '#D94C4C',
  };
  return colors[quality];
}
