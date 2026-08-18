// ─── Machine policy ───────────────────────────────────────────────────────────
//
// Turns a player's Machine Builder configuration into a decision at a
// checkpoint, so the machine they designed can be run against history (§17.13
// stress test, §64 Phase 3).
//
// Three properties this has to hold, or the stress test is theatre:
//
//   1. The configuration must actually drive the behaviour. If every machine
//      played the same way the screen would be showing the player a result
//      that has nothing to do with what they built.
//   2. It must be pure and deterministic. Same machine, same arena, same
//      decisions, every time, or a stress test is not a test.
//   3. Every decision must carry its reason. §57 is about inspectable process,
//      and a machine that cannot say why it acted teaches nothing.
//
// What this is NOT: a ReFi RF/RL model. §26.4 is explicit that a transparent
// rules machine must never be labelled as RF/RL performance. This is the
// "GAME RULES MACHINE" of §26.4 — no forecast, no training, only the rules the
// player set, applied to authored content.

import type {
  ActionBranch, ActionCode, CheckpointData, MachineConfig, PortfolioState,
} from './gameTypes';

/** Why the machine did what it did. Rendered next to the decision. */
export type PolicyReason =
  | 'DRAWDOWN_GATE'
  | 'CASH_FLOOR'
  | 'CORRELATION_GUARD'
  | 'REGIME_CHANGE'
  | 'MOMENTUM_POSITIVE'
  | 'MOMENTUM_NEGATIVE'
  | 'VOLATILITY_RISING'
  | 'THESIS_INTACT'
  | 'OFF_CYCLE'
  | 'TURNOVER_EXHAUSTED'
  | 'STANCE_UNAVAILABLE';

export const REASON_TEXT: Record<PolicyReason, string> = {
  DRAWDOWN_GATE: 'Drawdown past the gate you set. De-risking takes priority over the signal.',
  CASH_FLOOR: 'Cash below your floor. Rebuilding the reserve comes first.',
  CORRELATION_GUARD: 'Correlation above your threshold. Diversification is not doing its job.',
  REGIME_CHANGE: 'Regime change detected. Your signal layer is built to respond to it.',
  MOMENTUM_POSITIVE: 'Return bias positive. Momentum logic adds exposure.',
  MOMENTUM_NEGATIVE: 'Return bias negative. Momentum logic cuts exposure.',
  VOLATILITY_RISING: 'Volatility rising. Risk-aware layers reduce before they are forced to.',
  THESIS_INTACT: 'Nothing your machine watches has changed. Holding is a decision.',
  OFF_CYCLE: 'Off-cycle for your rebalance schedule. The machine waits rather than acts early.',
  TURNOVER_EXHAUSTED: 'Turnover budget spent. Only holding remains affordable.',
  STANCE_UNAVAILABLE: 'The preferred stance is not on offer at this checkpoint.',
};

export interface PolicyDecision {
  action: ActionCode;
  conviction: number;
  /**
   * Why the machine acted. This is always the rule that drove the decision,
   * never the mechanics of carrying it out.
   *
   * An earlier version overwrote it when the preferred stance was unavailable,
   * which silently erased the interesting half: a correlation guard that fired
   * at a checkpoint offering no ROTATE_DEFENSIVE reported STANCE_UNAVAILABLE,
   * so the guard looked like it had never fired at all, and the monitoring
   * layer the player paid for became invisible.
   */
  reason: PolicyReason;
  /** The stance the policy wanted before availability and budget were applied. */
  preferred: ActionCode;
  /** Why the committed stance differs from the preferred one, if it does. */
  substitution: 'NONE' | 'TURNOVER_EXHAUSTED' | 'STANCE_UNAVAILABLE';
}

// ─── Signal layer ─────────────────────────────────────────────────────────────

/**
 * What the machine wants to do based on its signal layer alone, before any
 * guardrail or budget is considered.
 *
 * The four layers differ in what they can see, which is the lesson §17.4 is
 * teaching: a momentum rule is regime-blind by construction, and no amount of
 * responsiveness fixes that.
 */
function signalStance(
  config: MachineConfig,
  cp: CheckpointData,
): { action: ActionCode; reason: PolicyReason } {
  const bias = cp.portfolioEffect.returnBias;
  const volRising = cp.portfolioEffect.volatilityDelta > 0.01;

  switch (config.signal) {
    case 'PRICE_MOMENTUM':
      // Regime-blind on purpose. It reads the direction of return and nothing
      // else, which is exactly why it walks into regime turns.
      if (bias > 0.002) return { action: 'ADD_RISK', reason: 'MOMENTUM_POSITIVE' };
      if (bias < -0.002) return { action: 'REDUCE', reason: 'MOMENTUM_NEGATIVE' };
      return { action: 'HOLD', reason: 'THESIS_INTACT' };

    case 'QUALITY_FACTOR':
      // Slow by design: it only moves on a sustained deterioration, so it holds
      // through noise and is late to a genuine turn.
      if (bias < -0.02) return { action: 'REDUCE', reason: 'MOMENTUM_NEGATIVE' };
      return { action: 'HOLD', reason: 'THESIS_INTACT' };

    case 'REGIME_CLASSIFIER':
      // Sees the regime turn, which is the thing momentum cannot.
      if (cp.isRegimeChange) return { action: 'ROTATE_DEFENSIVE', reason: 'REGIME_CHANGE' };
      if (bias < -0.01) return { action: 'REDUCE', reason: 'MOMENTUM_NEGATIVE' };
      if (bias > 0.01) return { action: 'ADD_RISK', reason: 'MOMENTUM_POSITIVE' };
      return { action: 'HOLD', reason: 'THESIS_INTACT' };

    case 'RF_RL_PIPELINE':
      // The most responsive layer available in the builder: regime first, then
      // volatility, then direction.
      if (cp.isRegimeChange) return { action: 'ROTATE_DEFENSIVE', reason: 'REGIME_CHANGE' };
      if (volRising) return { action: 'REDUCE', reason: 'VOLATILITY_RISING' };
      if (bias > 0.005) return { action: 'ADD_RISK', reason: 'MOMENTUM_POSITIVE' };
      if (bias < -0.005) return { action: 'REDUCE', reason: 'MOMENTUM_NEGATIVE' };
      return { action: 'HOLD', reason: 'THESIS_INTACT' };
  }
}

// ─── Guardrails ───────────────────────────────────────────────────────────────

/**
 * A guardrail breach the machine must answer before it considers its signal.
 *
 * §17.6 frames guardrails as what the machine is *not allowed* to do, so they
 * outrank the signal rather than competing with it. Returns null when nothing
 * is breached.
 *
 * Correlation is deliberately conditional on the monitoring layer: a machine
 * set to PASSIVE has no correlation alert, so it cannot respond to a threshold
 * it never measures. That is the point of §17.11, and it should cost the
 * player who skipped it.
 */
function guardrailOverride(
  config: MachineConfig,
  cp: CheckpointData,
  portfolio: PortfolioState,
): { action: ActionCode; reason: PolicyReason } | null {
  const g = config.guardrails;

  if (portfolio.drawdown <= g.drawdownGatePct) {
    return { action: 'REDUCE', reason: 'DRAWDOWN_GATE' };
  }
  if (portfolio.cashWeight < g.cashFloorPct) {
    return { action: 'RAISE_CASH', reason: 'CASH_FLOOR' };
  }

  const watchesCorrelation =
    config.monitoring === 'CORRELATION_ALERT' ||
    config.monitoring === 'FULL_RISK_MONITOR';
  if (watchesCorrelation && cp.portfolioEffect.correlationLevel > g.maxCorrelation) {
    return { action: 'ROTATE_DEFENSIVE', reason: 'CORRELATION_GUARD' };
  }

  return null;
}

// ─── Execution timeliness ─────────────────────────────────────────────────────

/**
 * Whether the machine is allowed to act at this checkpoint at all.
 *
 * §17.10: signal quality and implementation timing are different things. A
 * weekly rebalance simply is not looking on most days, so a correct signal it
 * cannot act on is worth nothing — which is the whole lesson.
 *
 * This is a deliberate abstraction of cadence onto checkpoint parity, not a
 * claim that a game checkpoint is a trading day or that game latency resembles
 * production execution.
 */
function actsThisCheckpoint(config: MachineConfig, sequence: number): boolean {
  switch (config.execution) {
    case 'WEEKLY':
      // Acts on every third checkpoint. Cheapest in turnover, slowest to react.
      return sequence % 3 === 1;
    case 'STAGED_3TRANCHE':
      // Deploys across checkpoints rather than in one move, so it skips fewer
      // than WEEKLY but still paces itself.
      return sequence % 2 === 1;
    case 'DAILY_CLOSE':
    case 'INTRADAY_1H':
      return true;
  }
}

/**
 * How hard the machine commits, from its construction layer.
 *
 * Equal weight expresses no view on signal strength and so never leans;
 * signal-weighted and optimised construction do. Clamped by the caller to the
 * checkpoint's conviction governor.
 */
function convictionFor(config: MachineConfig, reason: PolicyReason): number {
  const base =
    config.construction === 'EQUAL_WEIGHT' ? 55 :
    config.construction === 'RISK_PARITY' ? 62 :
    config.construction === 'SIGNAL_WEIGHTED' ? 72 :
    78; // CONSTRAINED_OPT

  // A guardrail response is not a view on the market; it is a rule firing. It
  // commits at the level the rule demands, not at the level of a conviction.
  const isGuardrail =
    reason === 'DRAWDOWN_GATE' || reason === 'CASH_FLOOR' || reason === 'CORRELATION_GUARD';
  return isGuardrail ? Math.max(base, 70) : base;
}

// Conviction is deliberately a property of the machine's construction style and
// nothing else.
//
// An earlier revision scaled it with the evidence: high when the move was large
// or the regime turned, high on a quiet tape for HOLD. It is an appealing idea
// and it is measurably wrong here. Conviction scales the score in both
// directions, and across the arena these machines are wrong more often than
// right, so leaning in amplified the losses and every configuration got worse
// (best of 256 went from -159 to -351 against par).
//
// The oracle that beats par does use 95 early and 50 late, but it can only pick
// those because it can see the outcome. A machine that could tell in advance
// which of its calls were the right ones would not need a conviction dial. The
// honest model is a steady hand whose size reflects how the player chose to
// build, not a claim to knowledge the machine does not have.

// ─── The decision ─────────────────────────────────────────────────────────────

/**
 * Decide one checkpoint.
 *
 * Order is guardrails, then cadence, then signal, then what the content and the
 * budget actually allow. A stance the checkpoint does not author cannot be
 * committed (the engine rejects it), and one the turnover budget cannot pay for
 * is unavailable, so both degrade to the nearest thing the machine can do —
 * ultimately HOLD, which is always affordable and always authored.
 */
export function decideCheckpoint(
  config: MachineConfig,
  cp: CheckpointData,
  portfolio: PortfolioState,
  canAfford: (action: ActionCode) => boolean,
): PolicyDecision {
  const override = guardrailOverride(config, cp, portfolio);
  const cadenceOpen = actsThisCheckpoint(config, cp.sequence);

  let wanted: { action: ActionCode; reason: PolicyReason };
  if (override) {
    // Guardrails ignore the rebalance schedule. A machine that waited for its
    // cycle while past its own drawdown gate would not be following the rule
    // the player wrote.
    wanted = override;
  } else if (!cadenceOpen) {
    wanted = { action: 'HOLD', reason: 'OFF_CYCLE' };
  } else {
    wanted = signalStance(config, cp);
  }

  const preferred = wanted.action;
  const authored = new Set(cp.availableActions.map((a: ActionBranch) => a.actionCode));

  if (authored.has(wanted.action) && canAfford(wanted.action)) {
    return {
      action: wanted.action,
      conviction: convictionFor(config, wanted.reason),
      reason: wanted.reason,
      preferred,
      substitution: 'NONE',
    };
  }

  const substitution = authored.has(wanted.action)
    ? 'TURNOVER_EXHAUSTED' as const
    : 'STANCE_UNAVAILABLE' as const;

  // Degrade in the direction the machine was already heading, so a blocked
  // de-risk does not become an add.
  const fallbacks: ActionCode[] =
    wanted.action === 'ADD_RISK' ? ['STAGED_BUY', 'HOLD']
      : wanted.action === 'ROTATE_DEFENSIVE' ? ['REDUCE', 'RAISE_CASH', 'STAGED_SELL', 'HOLD']
        : wanted.action === 'REDUCE' ? ['RAISE_CASH', 'STAGED_SELL', 'ROTATE_DEFENSIVE', 'HOLD']
          : wanted.action === 'RAISE_CASH' ? ['REDUCE', 'STAGED_SELL', 'HOLD']
            : ['HOLD'];

  for (const candidate of fallbacks) {
    if (authored.has(candidate) && canAfford(candidate)) {
      return {
        action: candidate,
        conviction: convictionFor(config, wanted.reason),
        reason: wanted.reason,
        preferred,
        substitution,
      };
    }
  }

  return {
    action: 'HOLD',
    conviction: convictionFor(config, wanted.reason),
    reason: wanted.reason,
    preferred,
    substitution,
  };
}
