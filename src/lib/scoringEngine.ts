import type {
  ActionCode, CheckpointData, DecisionQuality, CheckpointScore, BehavioralFlag, DimensionCode,
} from './gameTypes';
import { CONVICTION_MIN, CONVICTION_MAX, CONVICTION_DEFAULT } from './decisionContract';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * §29.1 weights, as one exported record.
 *
 * The checkpoint screen decomposes the score using these, so they have to be a
 * single source: an inline literal here and a copy over there is how a screen
 * ends up explaining a score the engine no longer computes.
 */
export const SCORE_WEIGHTS = {
  /** §29.1 risk-adjusted return. Not "excess": it is not measured against the
   *  machine, and the machine's own figure is computed the same way. */
  raerScore: 0.25,
  drawdownScore: 0.20,
  downsideScore: 0.10,
  recoveryScore: 0.10,
  regimeAdaptScore: 0.15,
  turnoverScore: 0.10,
  consistencyScore: 0.10,
} as const;

// ─── Component scores ─────────────────────────────────────────────────────────

/**
 * Risk-adjusted return, normalised to 0-100 on a fixed symmetric scale.
 *
 * Owner ruling, 2026-09-12. Linear, 50 at a Sharpe of zero, 20 points per unit
 * of Sharpe, saturating at ±2.5:
 *
 *      -2.5 → 0      0.0 → 50     +1.0 → 70
 *      -1.0 → 30    +0.5 → 60     +2.5 → 100
 *
 * The scale is fixed and the same function scores both sides, so a player's
 * component never depends on the machine's result. The term it replaces did:
 * it divided the return difference by its own absolute value, which is the
 * sign of that difference for any difference above a tenth of a basis point,
 * and the difference itself was a constant bonus for matching the machine's
 * stance. The largest-weighted quarter of the ReFi Score was a coin flip on
 * agreement (2026-09-12 audit).
 *
 * Sample damping exists because two nearly identical early returns produce an
 * enormous Sharpe from almost no evidence, and 25% of the score should not
 * turn on that. Confidence ramps from 25% at two observations to full weight
 * at five — TACO's five rounds are the shortest major arena, so even it
 * reaches full strength by its own conclusion.
 *
 * Explicitly NOT calibrated against the documented ReFi benchmark Sharpes
 * (2.91, 4.38, 4.56). Those are annualised OOS statistics from a different
 * measurement context; this is an unannualised ratio over irregular checkpoint
 * returns, and relating the two would manufacture exactly the benchmark
 * comparison §26 exists to prevent.
 */
export function normalizeSharpe(sharpe: number | null, samples: number): number {
  if (sharpe === null || !Number.isFinite(sharpe)) return 50;
  const raw = clamp(50 + 20 * sharpe, 0, 100);
  const reliability = clamp((samples - 1) / 4, 0, 1);
  return Math.round(50 + (raw - 50) * reliability);
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

/**
 * Downside capture: how much of a falling market the book actually took.
 *
 * Measured from the side's own realised checkpoint return against the
 * checkpoint's market move. It used to be computed from the market return
 * alone — `machineReturn / (machineReturn - 0.001)`, which is approximately 1
 * for any market return and had no term for what the player did. A tenth of
 * the score was a checkpoint constant (2026-09-12 review).
 *
 * The reference is the market, not the opponent, so both sides are measured
 * against the same external thing and neither score is defined by the other's.
 *
 * On a rising checkpoint there is no downside to capture and the component is
 * neutral. That is the metric's meaning, not a gap: the arena scores
 * participation in a rally through return and risk, which is where it belongs.
 */
export const NO_DOWNSIDE_SCORE = 70;

export function computeDownsideScore(playerReturn: number, marketReturn: number): number {
  if (marketReturn >= 0) return NO_DOWNSIDE_SCORE;

  // Both are negative in the ordinary case, so the ratio is positive and below
  // one when the book fell less than the market. A book that rose while the
  // market fell gives a negative ratio, which is the best possible capture.
  const capture = playerReturn / marketReturn;

  // Interpolated between the authored anchors rather than stepped through
  // them. As a six-step ladder the whole realistic range of stances on a
  // crash checkpoint — captures of 0.75 through 0.91 — landed in one bucket
  // and scored identically, which is the same defect this component was
  // reported for: a tenth of the score that barely moves with the decision.
  // The anchors are unchanged, so the calibration is the same where it was
  // ever stated; what changed is that the values between them now count.
  return clamp(interpolate(capture, CAPTURE_ANCHORS), 0, 100);
}

/** Capture ratio to score. Lower capture is better: less of the fall was taken. */
const CAPTURE_ANCHORS: readonly [number, number][] = [
  [0.50, 100],
  [0.75, 85],
  [1.00, 70],
  [1.25, 45],
  [1.50, 25],
  [2.00, 10],
];

/** Piecewise-linear through the anchors, flat beyond either end. */
function interpolate(x: number, anchors: readonly [number, number][]): number {
  const [firstX, firstY] = anchors[0];
  if (x <= firstX) return firstY;
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return anchors[anchors.length - 1][1];
}

/**
 * Recovery efficiency: how much of the hole the book has climbed back out of.
 *
 * §29.1 gives this a tenth of the ReFi Score and the engine returned a constant
 * 65 for every player, every machine, every stance and every checkpoint: a
 * second dead component beside the downside capture one (2026-09-12 review).
 *
 * Measured from run state, never from hindsight. The trough is the worst
 * drawdown the book has reached so far, which is a fact about the past; the
 * current drawdown is where it stands now. Progress is how far it has come
 * back between them.
 *
 *   no meaningful hole yet           neutral 65
 *   at a new low                     20, and it cannot score better by falling
 *   halfway back to the peak         roughly 60
 *   fully recovered to the peak      100
 *
 * A book that has never fallen more than a whisker has nothing to recover and
 * is neither credited nor penalised: scoring it 100 would pay every player for
 * the first checkpoint of every run.
 */
export const RECOVERY_NEUTRAL = 65;
export const RECOVERY_MEANINGFUL_DRAWDOWN = 0.02;

export function computeRecoveryScore(currentDD: number, troughDD: number): number {
  const trough = Math.min(0, troughDD, currentDD);
  if (Math.abs(trough) < RECOVERY_MEANINGFUL_DRAWDOWN) return RECOVERY_NEUTRAL;

  // 0 at the trough, 1 back at the high-water mark.
  const progress = clamp((trough - currentDD) / trough, 0, 1);

  // At the trough (progress 0) the book is at its worst: 20, well below
  // neutral, and a new low cannot score above it because the trough moves with
  // the book. Full recovery is 100. Neutral sits where it always did, so a
  // half-recovered book reads as slightly better than "nothing to say".
  return Math.round(20 + progress * 80);
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

/**
 * Turnover discipline, measured against the budget the arena actually granted.
 *
 * The thresholds used to be absolute: 0.20 and 0.30 of the book, regardless of
 * arena. A 22-checkpoint arena grants 0.6286, so every player crossed both
 * lines somewhere mid-run whatever they did, and a five-round arena grants
 * 0.1429 and could never cross either. The penalty measured arena length, not
 * discipline. Now it measures the fraction of the player's own budget spent.
 */
function computeTurnoverScore(
  action: ActionCode,
  flags: BehavioralFlag[],
  turnoverUsed: number,
  turnoverBudget: number,
): number {
  let score = 75;
  if (action === 'HOLD') score = 90;

  const penaltyFlags: BehavioralFlag[] = ['ACTION_BIAS', 'PANIC_REDUCTION_LARGE', 'CHASING'];
  flags.forEach(f => {
    if (penaltyFlags.includes(f)) score -= 10;
  });

  // The allowance is scored, not enforced (runEngine, stance availability).
  // Past it, every further stance is still open to the player and this is
  // where it is paid for.
  const spent = turnoverBudget > 0 ? turnoverUsed / turnoverBudget : 0;
  if (spent > 1.00) score -= 30;
  else if (spent > 0.75) score -= 15;
  else if (spent > 0.50) score -= 8;

  return clamp(score, 0, 100);
}

/**
 * How far conviction multiplies the checkpoint's distance from par.
 *
 *   50  ->  x0.2   hedged. a small win, and a small loss
 *   70  ->  x1.0   the resting default, unscaled
 *   95  ->  x2.0   wrong at 95 costs double, right at 95 pays double
 *
 * Anchored at CONVICTION_DEFAULT so the value the control rests at is the
 * neutral one: a player who never touches the meter is neither rewarded nor
 * punished for it. Linear, because the effort of reaching a value is already
 * non-linear in the geometry and compounding the two would make the top of the
 * scale punitive rather than expensive.
 */
export function convictionMultiplier(confidence: number): number {
  const conviction = clamp(confidence * 100, CONVICTION_MIN, CONVICTION_MAX);
  return 1 + (conviction - CONVICTION_DEFAULT) / 25;
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

  // NOTE: a `confidence < 0.4` branch used to live here and could never fire.
  // The scale floor is CONVICTION_MIN 50, so confidence is never below 0.50.
  // Removed rather than left as decoration.
  //
  // High conviction on a HOLD is still a consistency question: claiming near
  // certainty about doing nothing is a different statement from claiming it
  // about a move.
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
  /** The run's total turnover allowance, so discipline is measured against it. */
  turnoverBudget: number;
  /**
   * This checkpoint's realised portfolio return for the side being scored,
   * from the resolved transition. Downside capture is measured from it.
   */
  checkpointReturn: number;
  portfolioDD: number;
  /**
   * Run-so-far Sharpe for the side being scored, including this checkpoint,
   * and how many checkpoint returns it was computed from. Null before the
   * series can support one, which normalises to the neutral 50.
   */
  sharpe: number | null;
  sharpeSamples: number;
  /**
   * The worst drawdown this side's book has reached so far, including this
   * checkpoint. Recovery is measured from it toward the high-water mark.
   */
  troughDD: number;
  // Authored machine drawdown for this checkpoint, where content supplies one.
  // Absent it, drawdown is scored against the arena risk budget instead of a
  // fabricated machine number.
  machineDD?: number;
  riskBudgetDD?: number;
}): CheckpointScore {
  const {
    action, checkpoint, flags, confidence, turnoverUsed, turnoverBudget,
    checkpointReturn, portfolioDD, troughDD, machineDD, sharpe, sharpeSamples,
    riskBudgetDD = DEFAULT_RISK_BUDGET_DRAWDOWN,
  } = params;

  // The checkpoint's market move: the broad return the arena authored for this
  // moment in history, before any stance. Both sides are measured against it.
  const marketReturn = checkpoint.portfolioEffect.returnBias;

  const raerScore = normalizeSharpe(sharpe, sharpeSamples);
  const drawdownScore = computeDrawdownScore(portfolioDD, machineDD, riskBudgetDD);
  const downsideScore = computeDownsideScore(checkpointReturn, marketReturn);
  const recoveryScore = computeRecoveryScore(portfolioDD, troughDD);
  const regimeAdaptScore = computeRegimeAdaptScore(action, checkpoint, flags);
  const turnoverScore = computeTurnoverScore(action, flags, turnoverUsed, turnoverBudget);
  const consistencyScore = computeConsistencyScore(action, flags, confidence);
  const positionSizingScore = computePositionSizingScore(action, flags, confidence);

  // §29.1, seven weighted components. Position sizing is deliberately absent
  // from the checkpoint score; it is a profile dimension, not a score term.
  const processScore =
    SCORE_WEIGHTS.raerScore * raerScore +
    SCORE_WEIGHTS.drawdownScore * drawdownScore +
    SCORE_WEIGHTS.downsideScore * downsideScore +
    SCORE_WEIGHTS.recoveryScore * recoveryScore +
    SCORE_WEIGHTS.regimeAdaptScore * regimeAdaptScore +
    SCORE_WEIGHTS.turnoverScore * turnoverScore +
    SCORE_WEIGHTS.consistencyScore * consistencyScore;

  const machineScore = getMachinePar(checkpoint);

  // Conviction scales the distance from par, symmetrically.
  //
  // Before this, conviction did almost nothing: measured across the whole 50 to
  // 95 range it moved the total by one point, in one case, and by nothing at
  // all for REDUCE or RAISE_CASH. The control had an elaborate physical model
  // behind it, an effort ramp that deliberately makes the top of the scale
  // expensive to reach, and no consequence at the other end of that effort. We
  // had priced a thing that was not for sale.
  //
  // It also made the game's own copy false. Addendum C Amendment 1 removed the
  // conviction governor on the argument that the calibration lesson is
  // consequence rather than constraint, and the CP2 tip told the player that
  // being wrong at 95 costs double. Neither was true of the engine.
  //
  // Now it is. Conviction is a bet on your own judgment: it multiplies how far
  // the checkpoint lands from par, in whichever direction it was already going.
  const scaled = machineScore + (processScore - machineScore) * convictionMultiplier(confidence);
  const totalScore = Math.round(clamp(scaled, 0, 100));
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
