import { reallocate, sectorExposureOf } from './allocation';
import type {
  ActionCode, AllocationEffect, ArenaId, BehavioralFlag, CheckpointData, CheckpointScore,
  DeployedMachine, DimensionCode, OpponentPolicy, PortfolioState, RunDecision,
  RunState, ShadowAgent, ThesisCode,
} from './gameTypes';
import { DEFAULT_ARENA_ID, getArena, getCheckpoint } from './arenas';
// Importing the arena modules is what registers them. Without this the
// registry is empty at runtime and every run ends at its first checkpoint.
import './arenaIndex';
import { scoreCheckpoint } from './scoringEngine';
import { decideCheckpoint, REASON_TEXT } from './machinePolicy';
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
export const CRITICAL_DRAWDOWN = -0.20;

/**
 * Turnover allowance per checkpoint, from which a run's total budget is
 * derived.
 *
 * The budget used to be a flat 0.40, set when COVID was 14 checkpoints long.
 * At an average branch price near 0.055 that is roughly seven actions: half
 * the checkpoints, which is the scarcity the arena was balanced around.
 *
 * Completing COVID to the 22 checkpoints §21.3 specifies broke that silently.
 * The same 0.40 over 22 checkpoints is under a third of them, and because the
 * budget is a hard constraint the run does not merely get tighter — it goes
 * HOLD-only from around checkpoint 8 and the remaining fourteen offer the
 * player one option each. The stress test made it measurable: the best machine
 * of 256 was blocked at 14 of 22 checkpoints with the budget fully spent.
 *
 * So the allowance is expressed per checkpoint and the total scales with the
 * arena. This is deliberately not a rebalance: 0.40/14 is preserved exactly,
 * so a 14-checkpoint arena still gets 0.40 and the scarcity ratio every
 * existing branch price was authored against is unchanged.
 */
/**
 * The allowance, restated once turnover became a derived quantity.
 *
 * The old figure was 0.40 over 14 checkpoints, calibrated against a table of
 * authored per-stance fees averaging 5.00% for a non-HOLD stance. Turnover is
 * now the traded weight a stance actually implies, measured across every
 * offered stance at every checkpoint of all five arenas: a mean of 6.92%, or
 * 1.382 times the fees the budget was sized against.
 *
 * That mean rose once the stance cards began executing the trades they
 * describe. "ROTATE: sell travel, add JNJ/PG" moves more weight than the
 * generic reading of ROTATE_DEFENSIVE did, because it is a larger trade, and
 * the meter should say so.
 *
 * So the allowance is scaled by exactly that ratio and nothing else. A run
 * affords the same number of stances it always did; what changed is that the
 * price of each one now follows from the trades it makes, and a round trip
 * costs twice a one-legged move rather than 1.4 times it.
 */
const LEGACY_ALLOWANCE_PER_CHECKPOINT = 0.40 / 14;
const DERIVED_COST_RATIO = 1.382;
export const TURNOVER_PER_CHECKPOINT =
  Math.round(LEGACY_ALLOWANCE_PER_CHECKPOINT * DERIVED_COST_RATIO * 100000) / 100000;

/** A run's total turnover budget, for an arena of the given length. */
export function turnoverBudgetFor(totalCheckpoints: number): number {
  // Rounded to whole basis points so the meter reads cleanly and the value is
  // stable across arenas rather than carrying float noise into stored records.
  return Math.round(TURNOVER_PER_CHECKPOINT * totalCheckpoints * 10000) / 10000;
}

/**
 * The 14-checkpoint budget, kept as a named export because tests and content
 * notes refer to it. Prefer `turnoverBudgetFor` for anything arena-sized.
 */
export const TURNOVER_BUDGET_START = turnoverBudgetFor(14);

// The per-stance fee table that used to price turnover is gone. Turnover is
// now derived from the trades a stance actually makes (see turnoverCostFor),
// so a table of fees that nothing charges would be a second, wrong answer to
// the same question sitting next to the right one.
//
// Content still authors `turnoverCost` on each branch. It documents what the
// author expected the stance to cost and the content tests hold it to the
// shape of that intent (HOLD free, everything else positive); it no longer
// prices anything.

// ─── Initial state ────────────────────────────────────────────────────────────

/**
 * The starting book for an arena.
 *
 * Each arena owns its own, because the portfolio is part of the lesson: §24
 * cannot teach that six bank tickers are one exposure to a player holding the
 * COVID book.
 */
export function createInitialPortfolio(arenaId: ArenaId = DEFAULT_ARENA_ID): PortfolioState {
  const arena = getArena(arenaId);
  if (arena) return arena.startingPortfolio();
  return legacyCovidPortfolio();
}

// U.S. equities only. Bonds, gold, and commodities are signals, not positions.
// Embedded risks: TRAVEL (DAL+MAR=16%), TECH CONC (MSFT+AAPL=20%), CYCLICAL (CAT+XOM+HD=23%)
function legacyCovidPortfolio(): PortfolioState {
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
    troughDrawdown: 0,
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

/**
 * The seed a run gets when the caller does not choose one.
 *
 * Fixed, not random: the engine may not read an RNG or a clock, and every test
 * that opens a run without caring about the seed must still get byte-identical
 * state. Real runs are opened by the React layer, which injects a live seed.
 */
export const DEFAULT_RUN_SEED = 0;

export interface RunOptions {
  /** How the opponent decides. Defaults to the authored content. */
  opponentPolicy?: OpponentPolicy;
  /** The player's compiled machine, riding along. */
  deployed?: DeployedMachine | null;
}

/** A shadow agent's opening book: the arena's portfolio, par score. */
function freshShadow(arenaId: ArenaId): ShadowAgent {
  return { portfolio: createInitialPortfolio(arenaId), score: 50 };
}

export function createInitialRun(
  seed: number = DEFAULT_RUN_SEED,
  arenaId: ArenaId = DEFAULT_ARENA_ID,
  machineId: string = 'refi_rules',
  options: RunOptions = {},
): RunState {
  const arena = getArena(arenaId);
  const total = arena?.checkpoints.length ?? 0;
  const opponentPolicy: OpponentPolicy = options.opponentPolicy ?? { kind: 'AUTHORED' };
  const deployed = options.deployed ?? null;
  return {
    opponentPolicy,
    // Every opponent carries a book, the authored one included. It used to be
    // scored by its authored par while the player was scored by the component
    // model, which made the headline Man vs Machine contest a comparison
    // between two different rubrics.
    opponentAgent: freshShadow(arenaId),
    deployed,
    deployedAgent: deployed ? freshShadow(arenaId) : null,
    id: null,
    seed,
    arenaId,
    machineId,
    currentCheckpoint: 1,
    totalCheckpoints: total,
    phase: 'SIGNAL',
    portfolio: createInitialPortfolio(arenaId),
    turnoverBudget: turnoverBudgetFor(total),
    playerScore: 50,
    machineScore: 50,
    decisions: [],
    criticalFailure: false,
    criticalFailureCheckpoint: null,
    activeModules: ['PRICE_RETURN', 'PORTFOLIO_SUMMARY', 'SECTOR_EXPOSURE', 'NEWS_FEED'],
    investigatedModules: [],
    pendingAction: null,
    pendingConfidence: convictionToConfidence(CONVICTION_DEFAULT),
    result: 'ACTIVE',
  };
}

// ─── Turnover budget ──────────────────────────────────────────────────────────

/**
 * What a stance would cost this book, in traded weight.
 *
 * Derived from the transition the stance actually implies rather than read off
 * an authored per-stance fee. The fee table priced ROTATE at 0.07 and
 * RAISE_CASH at 0.04 while ROTATE moved no weight at all, so the meter was
 * charging for trades that never happened and pricing a round trip at less
 * than twice a sale (2026-09-12 playtest). Now a sale into cash costs its one
 * leg and a rotation costs both of its own.
 *
 * Book-dependent, so it takes the portfolio: the same stance costs a
 * concentrated book more than a balanced one, which is the lesson.
 */
/**
 * The transition a stance means at a checkpoint: the authored one where the
 * card promises a specific trade, the generic reading of the code otherwise.
 *
 * Every consumer goes through here — the commit, the shadow, the turnover
 * meter, the Block Field preview and the replay — so the price quoted, the
 * picture previewed and the trade executed cannot disagree.
 */
export function allocationEffectFor(
  action: ActionCode,
  checkpoint?: CheckpointData,
): AllocationEffect | undefined {
  return checkpoint?.availableActions.find(a => a.actionCode === action)?.allocationEffect;
}

export function stanceTransition(
  portfolio: PortfolioState,
  action: ActionCode,
  checkpoint?: CheckpointData,
) {
  const effect = allocationEffectFor(action, checkpoint);
  const nextCash = nextCashWeight(portfolio.cashWeight, action);
  return reallocate(portfolio.positions, nextCash, action, effect);
}

export function turnoverCostFor(
  portfolio: PortfolioState,
  action: ActionCode,
  checkpoint?: CheckpointData,
): number {
  if (action === 'HOLD') return 0;
  return stanceTransition(portfolio, action, checkpoint).turnover;
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
  const cp = checkpoint ?? getCheckpoint(run.arenaId, run.currentCheckpoint);
  // Cents-scale epsilon so accumulated float error cannot bar an action that
  // exactly fits the remaining budget.
  return run.portfolio.turnoverUsed + turnoverCostFor(run.portfolio, action, cp) <= run.turnoverBudget + 1e-9;
}

/** The stances this checkpoint offers that the remaining budget still covers. */
export function affordableActions(run: RunState, checkpoint?: CheckpointData): ActionCode[] {
  const cp = checkpoint ?? getCheckpoint(run.arenaId, run.currentCheckpoint);
  const offered = cp?.availableActions.map(a => a.actionCode) ?? [];
  return offered.filter(a => canAffordAction(run, a, cp));
}

/** True when nothing but HOLD is left affordable at this checkpoint. */
export function isHoldOnly(run: RunState, checkpoint?: CheckpointData): boolean {
  return affordableActions(run, checkpoint).every(a => a === 'HOLD');
}

// ─── Portfolio advance ────────────────────────────────────────────────────────

// ─── Cash authority ───────────────────────────────────────────────────────────
//
// One place owns what a stance does to cash and where cash may sit. The Block
// Field preview renders from these same functions, so the preview and the
// commit cannot disagree: a duplicated delta or clamp elsewhere is exactly how
// the historical #30 preview drifted from the engine (its clamp said 2..90
// while the engine said 5..60).

/** Hard bounds on cash weight. The single source; never restate these. */
export const CASH_WEIGHT_MIN = 0.05;
export const CASH_WEIGHT_MAX = 0.60;

/**
 * What a stance does to cash, before clamping.
 *
 * The staged pair move half of their full-sized equivalents, which is what
 * staging means: the same direction, taken in two bites. They used to move
 * nothing at all, so STAGED_BUY and STAGED_SELL were priced stances that did
 * nothing to the book (2026-09-12 playtest).
 */
export function stanceCashDelta(action: ActionCode): number {
  switch (action) {
    case 'RAISE_CASH': return 0.10;
    case 'REDUCE': return 0.05;
    case 'ADD_RISK': return -0.05;
    case 'STAGED_SELL': return 0.025;
    case 'STAGED_BUY': return -0.025;
    default: return 0;
  }
}

/**
 * The cash weight a stance produces.
 *
 * The bounds limit the *movement*, never the book. Weights drift with returns,
 * so a deep enough selloff carries cash past 60% on its own, and a portfolio
 * that drifted outside the band is a fact rather than an error.
 *
 * Clamping the absolute result inverted the stances at the boundary: from 70%
 * cash, RAISE_CASH returned 60% — a command named "raise cash" that bought
 * equities (2026-09-12 review). So the rule is directional. Outside the band,
 * a stance that would push further out does nothing, and a stance that moves
 * back toward the band moves by its full delta even if it does not get inside.
 */
export function nextCashWeight(currentCash: number, action: ActionCode): number {
  const delta = stanceCashDelta(action);
  if (delta === 0) return currentCash;

  if (delta > 0) {
    // Raising cash. Already at or above the ceiling: refuse rather than sell.
    if (currentCash >= CASH_WEIGHT_MAX) return currentCash;
    return Math.min(CASH_WEIGHT_MAX, currentCash + delta);
  }

  // Deploying cash. Already at or below the floor: refuse rather than buy.
  if (currentCash <= CASH_WEIGHT_MIN) return currentCash;
  // From above the ceiling, deploy the full delta: moving toward the band is
  // always allowed, even when one step does not reach it.
  if (currentCash + delta > CASH_WEIGHT_MAX) return round4(currentCash + delta);
  return Math.max(CASH_WEIGHT_MIN, currentCash + delta);
}

/** A checkpoint resolved once: the book it produced and the return it earned. */
export interface ResolvedTransition {
  portfolio: PortfolioState;
  /** This checkpoint's portfolio return, as a fraction. */
  checkpointReturn: number;
  /** Traded weight this stance cost, before it was added to the run total. */
  turnoverCost: number;
}

/**
 * Execute a stance and let the market answer it, once.
 *
 * Callers need the resolved book *and* the return that produced it, and used
 * to get them by running the advance twice or by dividing values afterwards.
 * One call, one answer: the score and the run's next portfolio are the same
 * transition, and cannot disagree.
 */
export function resolveTransition(
  portfolio: PortfolioState,
  action: ActionCode,
  checkpointSeq: number,
  arenaId: ArenaId = DEFAULT_ARENA_ID,
): ResolvedTransition {
  const cp = getCheckpoint(arenaId, checkpointSeq);
  if (!cp) return { portfolio, checkpointReturn: 0, turnoverCost: 0 };

  const { returnBias, volatilityDelta, correlationLevel, positionReturns } = cp.portfolioEffect;

  // 1. The stance executes: the trade the card promised where it promised one,
  //    the generic reading of the code otherwise. The trades are priced from
  //    the transition itself.
  const moved = stanceTransition(portfolio, action, cp);

  // 2. Then the market moves the book the stance left behind.
  //
  //    This is the whole point of the rework. The return used to be the
  //    checkpoint's authored bias times a per-stance multiplier, so a
  //    defensive rotation helped by fiat rather than by what it held. Now it
  //    helps exactly as much as the weights it moved into names the checkpoint
  //    treated kindly, and cash earns nothing.
  const symbolReturn = (symbol: string) => positionReturns?.[symbol] ?? returnBias;
  const grown = moved.positions.map(pos => ({
    pos,
    value: pos.weight * (1 + symbolReturn(pos.symbol)),
  }));

  // 3. And the book drifts.
  //
  //    Weights are a consequence of what each holding is now worth, not the
  //    target the stance set. Holding them at target would mean a portfolio
  //    that silently rebalanced itself for free every checkpoint, which is
  //    both a fiction and the death of the Recovery arena's drift lesson: the
  //    winners are supposed to grow into a concentration the player has to
  //    notice.
  const equityValue = grown.reduce((a, g) => a + g.value, 0);
  const total = equityValue + moved.cashWeight;
  const portfolioReturn = total - 1;

  const newValue = portfolio.value * (1 + portfolioReturn);
  const peakValue = Math.max(portfolio.peakValue, newValue);
  const newDrawdown = Math.min(0, (newValue - peakValue) / peakValue);
  // Ratchets down only: the hole the book has been in is a fact about the run,
  // and recovery is measured from it.
  const troughDrawdown = Math.min(portfolio.troughDrawdown ?? 0, newDrawdown);
  const newVolatility = Math.max(0.08, portfolio.volatility + volatilityDelta);

  const drifted = grown.map(({ pos, value }) => ({
    ...pos,
    weight: round4(total > 0 ? value / total : 0),
    pnl: pos.pnl + symbolReturn(pos.symbol),
  }));

  return {
    checkpointReturn: portfolioReturn,
    turnoverCost: moved.turnover,
    portfolio: {
      ...portfolio,
      value: newValue,
      peakValue,
      drawdown: newDrawdown,
      troughDrawdown,
      volatility: newVolatility,
      cashWeight: round4(total > 0 ? moved.cashWeight / total : moved.cashWeight),
      turnoverUsed: round4(portfolio.turnoverUsed + moved.turnover),
      correlationIndex: correlationLevel,
      positions: drifted,
      // Derived, every advance. A stored aggregate nothing recomputed is how
      // the risk panel came to display the opening book for a whole run.
      sectorExposure: sectorExposureOf(drifted),
    },
  };
}

/**
 * The book a stance produces, before the market answers it.
 *
 * This is what the Block Field previews: "your portfolio after this stance".
 * The resolved book is that plus a checkpoint of market drift, so the two are
 * no longer the same object and the preview must be checked against this one.
 */
export function stanceAllocation(
  portfolio: PortfolioState,
  action: ActionCode,
  checkpoint?: CheckpointData,
): PortfolioState {
  const moved = stanceTransition(portfolio, action, checkpoint);
  return {
    ...portfolio,
    cashWeight: moved.cashWeight,
    positions: moved.positions,
    sectorExposure: sectorExposureOf(moved.positions),
  };
}

/** The resolved book alone, for callers that do not need the return. */
export function simulatePortfolioAdvance(
  portfolio: PortfolioState,
  action: ActionCode,
  checkpointSeq: number,
  arenaId: ArenaId = DEFAULT_ARENA_ID,
): PortfolioState {
  return resolveTransition(portfolio, action, checkpointSeq, arenaId).portfolio;
}

/** Turnover is carried to four places, like the weights it is made of. */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── The decision command ─────────────────────────────────────────────────────

/**
 * A complete decision, as one value.
 *
 * Every input door produces exactly this and nothing else: the slider and the
 * keyboard build it from the editable pending state, and the pull gesture emits
 * it on a clean release. Committing is therefore a single atomic step rather
 * than a sequence of UI dispatches whose ordering the engine would have to
 * trust. Thesis is deliberately absent: it is attached after the commit
 * (Addendum C C.5) and cannot revise the decision it explains.
 */
export interface DecisionCommand {
  action: ActionCode;
  conviction: number;
}

/**
 * Fold a command into the run's pending fields, clamped by this checkpoint's
 * governor. Split out from the commit so the conversion is inspectable on its
 * own and both doors demonstrably share it.
 */
export function prepareDecisionCommand(run: RunState, command: DecisionCommand): RunState {
  const conviction = clampConviction(command.conviction, run.currentCheckpoint);
  return {
    ...run,
    pendingAction: command.action,
    pendingConfidence: convictionToConfidence(conviction),
  };
}

/**
 * The single commit boundary. Gesture, slider and keyboard all arrive here, so
 * an equivalence test at this seam covers every door rather than one of them.
 *
 * No scoring or portfolio logic lives here: commitPendingDecision remains the
 * engine authority and this only decides what is handed to it.
 */
export function commitDecisionCommand(run: RunState, command: DecisionCommand): CommitOutcome | null {
  return commitPendingDecision(prepareDecisionCommand(run, command));
}

/**
 * The run-so-far Sharpe for one side, including the stance about to be scored.
 *
 * Both the player and the shadow go through here with their own decision
 * history, so the two components are computed by identical independent
 * normalisation and neither is defined in terms of the other (owner ruling,
 * 2026-09-12). The replay is O(checkpoints) per call and a run is at most 22,
 * so recomputing beats storing a series that could drift from the engine.
 */
export function sharpeSoFarFor(
  history: readonly RunDecision[],
  pick: (d: RunDecision) => ActionCode,
  arenaId: ArenaId,
): { sharpe: number | null; samples: number } {
  const risk = runRiskAdjusted(
    history.map(d => ({
      checkpointSequence: d.checkpointSequence,
      actionCode: pick(d),
      machineActionCode: pick(d),
    })),
    arenaId,
  );
  return { sharpe: risk.playerSharpe, samples: risk.samples };
}

function sharpeSoFar(
  history: readonly RunDecision[],
  pick: (d: RunDecision) => ActionCode,
  current: { sequence: number; action: ActionCode },
  arenaId: ArenaId,
): { sharpe: number | null; samples: number } {
  const series: ReturnSeriesInput[] = [
    ...history.map(d => ({
      checkpointSequence: d.checkpointSequence,
      actionCode: pick(d),
      machineActionCode: pick(d),
    })),
    {
      checkpointSequence: current.sequence,
      actionCode: current.action,
      machineActionCode: current.action,
    },
  ];
  const risk = runRiskAdjusted(series, arenaId);
  return { sharpe: risk.playerSharpe, samples: risk.samples };
}

/**
 * The player's book as it stood entering a checkpoint, by replay.
 *
 * The run only carries its current portfolio, and the resolution race has to
 * draw the move a single checkpoint made. Replaying the decisions before it is
 * exact and deterministic, where the alternative — inverting the current book —
 * is not.
 */
export function portfolioBeforeCheckpoint(run: RunState, sequence: number): PortfolioState {
  let book = createInitialPortfolio(run.arenaId);
  for (const d of run.decisions) {
    if (d.checkpointSequence >= sequence) break;
    book = simulatePortfolioAdvance(book, d.actionCode, d.checkpointSequence, run.arenaId);
  }
  return book;
}

// ─── Commit ───────────────────────────────────────────────────────────────────

export interface CommitOutcome {
  run: RunState;
  score: CheckpointScore;
  flags: BehavioralFlag[];
  dimUpdates: Partial<Record<DimensionCode, number>>;
  checkpoint: CheckpointData;
}

// ─── Shadow agents ────────────────────────────────────────────────────────────
//
// An agent that is not the player, stepped by the engine on the same
// checkpoint with the same information cutoff, the same action set, the same
// costs and the same rubric (Fair Match, spec 26.5). Two live here: a
// policy-driven opponent (S&P 500 passive) and the player's deployed machine.
// Both are pure functions of their policy, the checkpoint and their own book.

/** The passive index's stated reason. It is the same every checkpoint, on purpose. */
/** Why an opponent held when its own budget could not pay for its call. */
export const TURNOVER_EXHAUSTED_REASON =
  'Turnover budget exhausted. The policy call is unaffordable on this book, so the machine holds.';

export const PASSIVE_HOLD_REASON =
  'Buy and hold. The index takes no decisions; it holds full exposure through every regime.';

export interface ShadowDecision {
  action: ActionCode;
  conviction: number;
  reason: string;
}

export function shadowCanAfford(run: RunState, agent: ShadowAgent, action: ActionCode, cp: CheckpointData): boolean {
  if (action === 'HOLD') return true;
  // The shadow pays for its own book, not the player's.
  return agent.portfolio.turnoverUsed + turnoverCostFor(agent.portfolio, action, cp) <= run.turnoverBudget + 1e-9;
}

/** What a policy does at this checkpoint, given the agent's own book. */
export function decideShadow(
  policy: OpponentPolicy,
  cp: CheckpointData,
  agent: ShadowAgent,
  run: RunState,
): ShadowDecision | null {
  switch (policy.kind) {
    case 'AUTHORED': {
      // The content's own point-in-time call, stepped through a real book so
      // it earns a real score. Still authored, still no hindsight: the arena
      // decided this stance when it was written, not from the outcome.
      //
      // And it pays for it. Fair Match (§26.5) means the same constraints, and
      // an opponent allowed to spend turnover the human is barred from
      // spending is not playing the same game: the authored path used to skip
      // the affordability check entirely (2026-09-12 review). Valid shipped
      // content never reaches the fallback — the content test asserts every
      // authored path stays inside its arena's budget — but malformed content
      // degrades to HOLD rather than violating the constraint.
      const authored = cp.machineDecision.actionCode;
      if (shadowCanAfford(run, agent, authored, cp)) {
        return {
          action: authored,
          conviction: CONVICTION_DEFAULT,
          reason: cp.machineDecision.policyReason,
        };
      }
      return {
        action: 'HOLD',
        conviction: CONVICTION_DEFAULT,
        reason: TURNOVER_EXHAUSTED_REASON,
      };
    }
    case 'HOLD':
      return { action: 'HOLD', conviction: CONVICTION_DEFAULT, reason: PASSIVE_HOLD_REASON };
    case 'CONFIG': {
      const d = decideCheckpoint(policy.config, cp, agent.portfolio, a => shadowCanAfford(run, agent, a, cp));
      return { action: d.action, conviction: d.conviction, reason: REASON_TEXT[d.reason] };
    }
  }
}

/** Score the agent's action on the shared rubric and advance its own book. */
export function stepShadow(
  run: RunState,
  agent: ShadowAgent,
  decision: ShadowDecision,
  cp: CheckpointData,
): { agent: ShadowAgent; score: CheckpointScore } {
  const branch = cp.availableActions.find(a => a.actionCode === decision.action);
  const flags: BehavioralFlag[] = branch ? [...branch.branchEffect.flagsAdd] : [];
  // The shadow's own history, scored by the same function on the same scale.
  const shadowRisk = sharpeSoFar(
    run.decisions,
    d => d.machineActionCode,
    { sequence: cp.sequence, action: decision.action },
    run.arenaId,
  );
  // Resolve first, score the consequences. Identical ordering to the player.
  const resolved = resolveTransition(agent.portfolio, decision.action, run.currentCheckpoint, run.arenaId);
  const score = scoreCheckpoint({
    action: decision.action,
    checkpoint: cp,
    flags,
    confidence: convictionToConfidence(decision.conviction),
    turnoverUsed: resolved.portfolio.turnoverUsed,
    turnoverBudget: run.turnoverBudget,
    sharpe: shadowRisk.sharpe,
    sharpeSamples: shadowRisk.samples,
    checkpointReturn: resolved.checkpointReturn,
    portfolioDD: resolved.portfolio.drawdown,
    troughDD: resolved.portfolio.troughDrawdown,
    machineDD: cp.portfolioEffect.machineDrawdown,
    riskBudgetDD: getArena(run.arenaId)?.criticalDrawdown ?? CRITICAL_DRAWDOWN,
  });
  const portfolio = resolved.portfolio;
  const n = run.currentCheckpoint;
  const running = Math.round((agent.score * (n - 1) + score.totalScore) / n);
  return { agent: { portfolio, score: running }, score };
}

/**
 * Apply the run's pending decision (stance, thesis, conviction) and advance the
 * simulated portfolio one checkpoint. Returns the new run plus the pieces the
 * profile layer needs; profile mutation stays outside this engine.
 */
export function commitPendingDecision(run: RunState): CommitOutcome | null {
  const action = run.pendingAction;
  if (!action) return null;
  const cp = getCheckpoint(run.arenaId, run.currentCheckpoint);
  if (!cp) return null;

  // The engine is the authority on what may be committed, not the screen that
  // happened to send it. Now that a DecisionCommand can name any stance, both
  // laws are enforced here so every route obeys them: a direct engine call, the
  // command helper, an old test, a replay.
  //
  // A stance this checkpoint does not author has no branch, and therefore no
  // authored flags, alpha impact or turnover price. Inventing fallback
  // economics for it would let a decision score against numbers no content
  // author ever wrote.
  const branch = cp.availableActions.find(a => a.actionCode === action);
  if (!branch) return null;

  // The turnover budget is a hard constraint. A stance the run cannot pay for
  // is not committable, whichever door proposed it.
  if (!canAffordAction(run, action, cp)) return null;

  const flags: BehavioralFlag[] = [...branch.branchEffect.flagsAdd];
  const dimUpdates = branch.branchEffect.alphaImpact;
  // One resolution for the whole commit: the score reads this transition and
  // the run carries the same object forward. Scoring used to see the turnover
  // and drawdown from *before* the decision, so every checkpoint scored the
  // one before it and the final decision's consequences never landed anywhere.
  const resolved = resolveTransition(run.portfolio, action, run.currentCheckpoint, run.arenaId);
  const turnoverCost = resolved.turnoverCost;
  // The UI clamps conviction to the range this checkpoint exposes; the engine
  // guarantees it, so a stale or out-of-range value can never reach scoring.
  const conviction = clampConviction(confidenceToConviction(run.pendingConfidence), run.currentCheckpoint);
  const confidence = convictionToConfidence(conviction);

  // Investigation pays. Consulting risk before calling a regime turn is the
  // process the game exists to teach, so the record credits it.
  if (cp.isRegimeChange && consultedRisk(run.investigatedModules) && !flags.includes('GOOD_PROCESS')) {
    flags.push('GOOD_PROCESS');
  }

  const playerRisk = sharpeSoFar(
    run.decisions,
    d => d.actionCode,
    { sequence: cp.sequence, action },
    run.arenaId,
  );

  const score = scoreCheckpoint({
    action,
    checkpoint: cp,
    flags,
    confidence,
    turnoverUsed: resolved.portfolio.turnoverUsed,
    turnoverBudget: run.turnoverBudget,
    sharpe: playerRisk.sharpe,
    sharpeSamples: playerRisk.samples,
    checkpointReturn: resolved.checkpointReturn,
    portfolioDD: resolved.portfolio.drawdown,
    troughDD: resolved.portfolio.troughDrawdown,
    // No fabricated machine drawdown. Where content authors one it is used;
    // otherwise drawdown scores against the arena risk budget.
    machineDD: cp.portfolioEffect.machineDrawdown,
    riskBudgetDD: getArena(run.arenaId)?.criticalDrawdown ?? CRITICAL_DRAWDOWN,
  });

  // The opponent, whoever it is, decides on its own book and is scored by the
  // same component model as the player. Authored opponents contribute the
  // content's point-in-time stance; policy-driven ones decide from their own
  // portfolio. `machinePar` survives as content difficulty metadata — it is
  // the anchor conviction scales around — and is no longer the machine's
  // competing score.
  let machineActionCode: ActionCode = cp.machineDecision.actionCode;
  let machineReason: string | undefined;
  let opponentAgent = run.opponentAgent;
  let checkpointScore = score;
  const opponentDecision = opponentAgent ? decideShadow(run.opponentPolicy, cp, opponentAgent, run) : null;
  if (opponentAgent && opponentDecision) {
    const stepped = stepShadow(run, opponentAgent, opponentDecision, cp);
    opponentAgent = stepped.agent;
    machineActionCode = opponentDecision.action;
    machineReason = opponentDecision.reason;
    checkpointScore = {
      ...score,
      machineScore: stepped.score.totalScore,
      delta: score.totalScore - stepped.score.totalScore,
    };
  }

  // The player's deployed machine, riding along on its own book.
  let deployedAgent = run.deployedAgent;
  let deployedFields: Pick<RunDecision, 'deployedActionCode' | 'deployedReason' | 'deployedConviction'> = {};
  if (run.deployed && deployedAgent) {
    const d = decideShadow({ kind: 'CONFIG', config: run.deployed.config }, cp, deployedAgent, run);
    if (d) {
      const stepped = stepShadow(run, deployedAgent, d, cp);
      deployedAgent = stepped.agent;
      deployedFields = { deployedActionCode: d.action, deployedReason: d.reason, deployedConviction: d.conviction };
    }
  }

  const decision: RunDecision = {
    checkpointSequence: run.currentCheckpoint,
    actionCode: action,
    // Thesis is attached after the commit, never before it. See attachThesis.
    thesisCode: undefined,
    confidence,
    modulesConsulted: run.investigatedModules,
    turnoverCost,
    scoreContribution: score.totalScore,
    quality: score.quality,
    behavioralFlags: flags,
    machineActionCode,
    machineReason,
    ...deployedFields,
    committed: true,
  };

  const portfolio = resolved.portfolio;
  const criticalDD = getArena(run.arenaId)?.criticalDrawdown ?? CRITICAL_DRAWDOWN;
  const crossedNow = portfolio.drawdown <= criticalDD;
  const n = run.currentCheckpoint;
  const playerScore = Math.round((run.playerScore * (n - 1) + score.totalScore) / n);
  const machineScore = opponentAgent
    ? opponentAgent.score
    : Math.round((run.machineScore * (n - 1) + score.machineScore) / n);

  return {
    run: {
      ...run,
      phase: 'RESOLVING',
      decisions: [...run.decisions, decision],
      portfolio,
      playerScore,
      machineScore,
      pendingAction: null,
      investigatedModules: [],
      // Crossing the critical drawdown is a fact about the run, not a current
      // reading: once crossed it stays crossed, and a later recovery does not
      // erase it.
      criticalFailure: crossedNow || run.criticalFailure,
      criticalFailureCheckpoint: run.criticalFailureCheckpoint
        ?? (crossedNow ? run.currentCheckpoint : null),
      opponentAgent,
      deployedAgent,
    },
    score: checkpointScore,
    flags,
    dimUpdates,
    checkpoint: cp,
  };
}

// ─── Thesis attachment ────────────────────────────────────────────────────────

/**
 * Attach the thesis to the decision just committed.
 *
 * Addendum C section C.5: stance and conviction become immutable at commit.
 * Thesis explains a decision already made and cannot revise it. That ordering
 * is the whole point of asking after release: the player is accounting for an
 * instinct already exposed rather than searching for a defensible reason
 * before choosing, which is what keeps the Alpha Profile signal clean.
 *
 * First thesis wins. A second call is a no-op, so a late tap arriving after
 * the timeout cannot overwrite what was recorded.
 */
export function attachThesis(run: RunState, thesis: ThesisCode): RunState {
  const last = run.decisions.length - 1;
  if (last < 0) return run;
  const decision = run.decisions[last];
  if (decision.thesisCode !== undefined) return run;

  const decisions = [...run.decisions];
  // Only thesisCode is written. Everything else on the record is carried
  // through untouched by construction.
  decisions[last] = { ...decision, thesisCode: thesis };
  return { ...run, decisions };
}

/** Whether the decision just committed is still waiting for its thesis. */
export function awaitingThesis(run: RunState): boolean {
  const decision = run.decisions[run.decisions.length - 1];
  return Boolean(decision) && decision.thesisCode === undefined;
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

/**
 * One line stating where the run lost its claim on the machine.
 *
 * The limit is read from the arena rather than written into the string. It was
 * hardcoded to -20% when every run was COVID, so once arenas carried their own
 * risk budgets this told a Recovery player they had exceeded -20% at the point
 * they crossed -15%. A message that misstates the rule it is enforcing is worse
 * than no message.
 */
export function observationModeReason(run: RunState): string | null {
  if (!run.criticalFailure) return null;
  const limit = getArena(run.arenaId)?.criticalDrawdown ?? CRITICAL_DRAWDOWN;
  const pct = `${Math.round(limit * 100)}%`;
  const at = run.criticalFailureCheckpoint;
  return at
    ? `DRAWDOWN EXCEEDED ${pct} AT CP${String(at).padStart(2, '0')}. THIS RUN CANNOT BEAT THE MACHINE.`
    : `DRAWDOWN EXCEEDED ${pct}. THIS RUN CANNOT BEAT THE MACHINE.`;
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
    // Each checkpoint starts from the same neutral conviction, so a high call
    // has to be re-argued rather than inherited.
    pendingConfidence: convictionToConfidence(CONVICTION_DEFAULT),
  };
}

// ─── Risk-adjusted run statistics ─────────────────────────────────────────────

/**
 * The player's and the machine's run so far, in risk-adjusted terms.
 *
 * The whole thesis of the game is that return alone is the wrong scoreboard —
 * the machine wins by taking less risk for a similar result. That argument was
 * only ever made after the fact, in the autopsy. Sharpe belongs on the surface
 * during the run, where the player can still act on it.
 *
 * Derived, never stored: every checkpoint's return for both sides is a pure
 * function of the decision sequence, and both stances are already on the
 * decision record. So this replays the series rather than duplicating state
 * that could drift from the engine, and stays inside the determinism gate.
 *
 * Deliberately NOT annualised. Checkpoints are irregular slices of a historical
 * window, and scaling them by an invented periods-per-year would manufacture a
 * headline number that looks like the benchmark figures in §26 without any of
 * their provenance. This is a per-checkpoint ratio at a zero risk-free rate,
 * and the UI is required to label it as one.
 */
export interface RunRiskAdjusted {
  /** Checkpoints resolved so far. Sharpe needs at least two. */
  samples: number;
  playerReturn: number;
  machineReturn: number;
  /**
   * Run-so-far Sharpe: the mean over the standard deviation of every
   * checkpoint return resolved to this point, rf = 0. Not a per-checkpoint
   * figure — there is no such thing, a single return has no dispersion — and
   * null until the series can support one.
   */
  playerSharpe: number | null;
  machineSharpe: number | null;
}

function sharpeOf(returns: number[]): number | null {
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  // Sample standard deviation: the series is a sample of the run's behaviour,
  // not the whole population of checkpoints the arena could have produced.
  const variance =
    returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return null;
  return mean / sd;
}

/**
 * The decision fields this needs, and no more.
 *
 * Structural rather than `RunState`, so the same function serves the live run
 * and a stored Run Record without either having to impersonate the other.
 */
export interface ReturnSeriesInput {
  checkpointSequence: number;
  actionCode: ActionCode;
  machineActionCode: ActionCode;
}

export function runRiskAdjusted(
  decisions: readonly ReturnSeriesInput[],
  arenaId: ArenaId = DEFAULT_ARENA_ID,
): RunRiskAdjusted {
  // Replay both books rather than multiply an authored bias by a per-stance
  // constant.
  //
  // The old reconstruction asked "what did the stance do to the checkpoint's
  // return", which had one answer per stance regardless of what the book
  // held. A return series now means what it says: the book each side was
  // actually carrying, moved by the returns the checkpoint actually authored.
  // A defensive rotation shows up here only if it rotated into names that
  // held up, which is the lesson the arena is written to teach.
  //
  // Replay is deterministic and cheap — the same decisions always produce the
  // same path — so this stays inside the determinism gate and no portfolio
  // snapshot has to be stored or trusted.
  const playerReturns: number[] = [];
  const machineReturns: number[] = [];

  let playerBook = createInitialPortfolio(arenaId);
  let machineBook = createInitialPortfolio(arenaId);

  for (const d of decisions) {
    const cp = getCheckpoint(arenaId, d.checkpointSequence);
    if (!cp) continue;

    const nextPlayer = simulatePortfolioAdvance(playerBook, d.actionCode, d.checkpointSequence, arenaId);
    const nextMachine = simulatePortfolioAdvance(machineBook, d.machineActionCode, d.checkpointSequence, arenaId);

    playerReturns.push(nextPlayer.value / playerBook.value - 1);
    machineReturns.push(nextMachine.value / machineBook.value - 1);

    playerBook = nextPlayer;
    machineBook = nextMachine;
  }

  const compound = (rs: number[]) => rs.reduce((acc, r) => acc * (1 + r), 1) - 1;

  return {
    samples: playerReturns.length,
    playerReturn: compound(playerReturns),
    machineReturn: compound(machineReturns),
    playerSharpe: sharpeOf(playerReturns),
    machineSharpe: sharpeOf(machineReturns),
  };
}
