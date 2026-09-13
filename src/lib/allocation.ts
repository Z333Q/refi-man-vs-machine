// ─── Allocation ───────────────────────────────────────────────────────────────
// What a stance actually does to the book.
//
// Before this, a stance moved exactly one number: the cash weight. Per-position
// weights never changed for the whole run, which meant the risk panel's sector
// bars were frozen from the moment the arena built the book, and
// ROTATE_DEFENSIVE — the one stance whose entire meaning is a sector rotation —
// was indistinguishable from HOLD in every portfolio field except the turnover
// meter (2026-09-12 playtest).
//
// Everything here is pure and total: same inputs, same weights, no clock, no
// randomness. The engine's determinism guarantee depends on it, and so does the
// Block Field's stance preview, which renders from these same functions so the
// preview and the commit cannot disagree.

import type { ActionCode, AllocationEffect, PortfolioPosition } from './gameTypes';

// ─── Sector character ─────────────────────────────────────────────────────────

/**
 * Which side of a rotation a sector sits on.
 *
 * The arenas author sector names as free strings and have accumulated two
 * spellings for several of them (HEALTH and HEALTHCARE, TECH and TECHNOLOGY,
 * CONS STAP and CONSUMER STAPLES). Classifying by an explicit set rather than a
 * prefix keeps a new arena's typo from silently landing in the wrong bucket:
 * anything unrecognised is NEUTRAL, which trades in neither direction.
 */
export type SectorCharacter = 'DEFENSIVE' | 'CYCLICAL' | 'NEUTRAL';

const DEFENSIVE_SECTORS: ReadonlySet<string> = new Set([
  'CONS STAP', 'CONSUMER STAPLES', 'HEALTH', 'HEALTHCARE', 'UTILITIES', 'TELECOM',
]);

const CYCLICAL_SECTORS: ReadonlySet<string> = new Set([
  'AIRLINES', 'AUTOS', 'CONS DISC', 'CONSUMER DISCRETIONARY', 'ENERGY',
  'FINANCIALS', 'HOTELS', 'INDUSTRIALS', 'RETAIL', 'SEMICONDUCTORS',
  'TECH', 'TECHNOLOGY',
]);

export function sectorCharacter(sector: string): SectorCharacter {
  const key = sector.trim().toUpperCase();
  if (DEFENSIVE_SECTORS.has(key)) return 'DEFENSIVE';
  if (CYCLICAL_SECTORS.has(key)) return 'CYCLICAL';
  return 'NEUTRAL';
}

// ─── Derived aggregates ───────────────────────────────────────────────────────

/**
 * Sector exposure, derived from the positions that produce it.
 *
 * A stored aggregate that nothing recomputes is how the risk panel came to
 * display the opening book for an entire run. There is one derivation and both
 * the arena's opening book and every advance call it.
 */
export function sectorExposureOf(positions: readonly PortfolioPosition[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of positions) {
    out[p.sector] = round4((out[p.sector] ?? 0) + p.weight);
  }
  return out;
}

/**
 * Turnover: the traded weight a transition implies, counted per leg.
 *
 * Each leg is priced once, so selling 5% of a position into cash costs 5% and
 * rotating that same 5% into another name costs 10% — a round trip is two
 * legs, which is the arithmetic the flat per-stance fee table never had
 * (RAISE_CASH 0.04 against ROTATE 0.07, unrelated to what either stance did).
 *
 * Cash is not itself a leg. It is the residual of the equity trades, and
 * counting it would price every sale twice.
 */
export function turnoverOf(
  before: readonly PortfolioPosition[],
  after: readonly PortfolioPosition[],
): number {
  const prior = new Map(before.map(p => [p.symbol, p.weight]));
  let traded = 0;
  for (const p of after) {
    traded += Math.abs(p.weight - (prior.get(p.symbol) ?? 0));
    prior.delete(p.symbol);
  }
  // Anything held before and absent after was sold in full.
  for (const w of prior.values()) traded += Math.abs(w);
  return round4(traded);
}

// ─── Reallocation ─────────────────────────────────────────────────────────────

/**
 * How much of the whole book a rotation moves, as a weight.
 *
 * Measured against total equity rather than against the source bucket. A
 * fraction of the source made the cost depend on how lopsided the book already
 * was: the COVID book is 77% cyclical against 16% defensive, so rotating a
 * third of the cyclical side moved 26% of the book out and doubled the
 * defensive names to receive it — 46% turnover for one stance, a wholesale
 * restructuring wearing the word "tilt".
 *
 * Five points of the book, capped by what the source side actually holds. A
 * rotation is then the same size whoever holds what, it reads clearly on the
 * sector bars (the COVID defensive bucket goes 16% to 21%, a third again as
 * large), and repeating it tilts further rather than emptying the book.
 */
export const ROTATION_WEIGHT = 0.05;

export interface Reallocation {
  positions: PortfolioPosition[];
  cashWeight: number;
  /** Traded weight this transition implies, per leg. */
  turnover: number;
}

/**
 * Apply a stance to a book.
 *
 * `nextCash` is decided by the engine's cash authority (runEngine owns the
 * deltas and the 5..60 clamp) and passed in, so there is exactly one place that
 * knows what a stance does to cash. This function's job is the equity side:
 * distribute the equity budget `1 - nextCash` across the positions in the shape
 * the stance asks for.
 */
/**
 * Execute an authored transition: the trade the stance card actually promised.
 *
 * Each move is a weight of the whole book. A symbol move lands on that holding;
 * a sector move is spread across the sector in proportion to existing weights,
 * so cutting a cluster keeps the shape of the cluster. Nothing is sold that is
 * not held, and no weight goes below zero.
 *
 * Cash takes the residual, and is free to end up outside the 5..60 band: a
 * transition the content authored is a decision, not a drift, and clamping it
 * here would execute a different trade than the one on the card. The band
 * constrains what the generic stances may *move*, which is where it belongs.
 */
function applyAuthoredEffect(
  positions: readonly PortfolioPosition[],
  cashWeight: number,
  effect: AllocationEffect,
): Reallocation {
  const next = positions.map(p => ({ ...p }));
  const bySymbol = new Map(next.map(p => [p.symbol, p]));
  let cashDelta = 0;

  for (const move of effect.moves) {
    if (move.symbol) {
      const pos = bySymbol.get(move.symbol);
      if (!pos) continue; // a holding this book does not carry
      const applied = Math.max(move.delta, -pos.weight);
      pos.weight = round4(pos.weight + applied);
      cashDelta -= applied;
      continue;
    }
    if (!move.sector) continue;
    const inSector = next.filter(p => p.sector.trim().toUpperCase() === move.sector!.trim().toUpperCase());
    const held = inSector.reduce((a, p) => a + p.weight, 0);
    if (held <= 0) continue;
    // Sells are capped at what the sector holds; buys are spread the same way.
    const applied = Math.max(move.delta, -held);
    for (const pos of inSector) {
      const share = pos.weight / held;
      pos.weight = round4(Math.max(0, pos.weight + applied * share));
    }
    cashDelta -= applied;
  }

  return {
    positions: next,
    cashWeight: round4(Math.max(0, cashWeight + cashDelta)),
    turnover: turnoverOf(positions, next),
  };
}

export function reallocate(
  positions: readonly PortfolioPosition[],
  nextCash: number,
  action: ActionCode,
  effect?: AllocationEffect,
): Reallocation {
  // An authored transition wins over the generic reading of the code. The
  // card is the promise; the code is only the behavioural category it falls
  // under for scoring and for the Alpha Profile.
  if (effect && effect.moves.length > 0) {
    return applyAuthoredEffect(positions, 1 - positions.reduce((a, p) => a + p.weight, 0), effect);
  }
  const equityBudget = Math.max(0, 1 - nextCash);
  const invested = positions.reduce((a, p) => a + p.weight, 0);

  // A book with no equity has nothing to distribute and no trades to price.
  if (positions.length === 0 || invested <= 0) {
    return { positions: positions.map(p => ({ ...p })), cashWeight: nextCash, turnover: 0 };
  }

  // 1. Start from the book's own proportions, so a position's size keeps
  //    meaning something, and scale it to whatever equity budget the stance
  //    left. Trims and deployments both fall out of this: raising cash shrinks
  //    the budget, so every weight comes down pro rata.
  const shares = positions.map(p => p.weight / invested);
  let weights = shares.map(sh => equityBudget * sh);

  // 2. Then the stance's view on which names to favour, applied on top.
  const favoured: SectorCharacter | null =
    action === 'ROTATE_DEFENSIVE' ? 'DEFENSIVE' :
    action === 'ROTATE_RISK' ? 'CYCLICAL' :
    null;

  if (favoured) {
    const other: SectorCharacter = favoured === 'DEFENSIVE' ? 'CYCLICAL' : 'DEFENSIVE';
    const isSource = (p: PortfolioPosition) => sectorCharacter(p.sector) === other;
    const isTarget = (p: PortfolioPosition) => sectorCharacter(p.sector) === favoured;

    const sourceWeight = positions.reduce((a, p, i) => a + (isSource(p) ? weights[i] : 0), 0);
    const targetWeight = positions.reduce((a, p, i) => a + (isTarget(p) ? weights[i] : 0), 0);
    // Never sell more than the source side holds.
    const moved = Math.min(ROTATION_WEIGHT, sourceWeight);

    // A rotation with nothing to sell, or nothing to buy, is not a rotation.
    // Leaving the book alone is honest; inventing a position to receive the
    // weight is not.
    if (moved > 0 && targetWeight > 0) {
      weights = positions.map((p, i) => {
        if (isSource(p)) return weights[i] - moved * (weights[i] / sourceWeight);
        if (isTarget(p)) return weights[i] + moved * (weights[i] / targetWeight);
        return weights[i];
      });
    }
  }

  // 3. ADD_RISK deploys the cash it freed into the risk side rather than back
  //    across the book. Only the newly deployed weight is directed, so the
  //    stance costs what it deployed and not a rotation on top of it.
  if (action === 'ADD_RISK') {
    const deployed = equityBudget - invested;
    const riskWeight = positions.reduce(
      (a, p, i) => a + (sectorCharacter(p.sector) === 'CYCLICAL' ? weights[i] : 0), 0,
    );
    if (deployed > 0 && riskWeight > 0) {
      // Undo the pro-rata share of the deployment, then place all of it on the
      // cyclical side.
      weights = positions.map((p, i) => {
        const proRata = deployed * shares[i];
        const directed = sectorCharacter(p.sector) === 'CYCLICAL'
          ? deployed * (weights[i] / riskWeight)
          : 0;
        return weights[i] - proRata + directed;
      });
    }
  }

  const next = positions.map((p, i) => ({ ...p, weight: round4(Math.max(0, weights[i])) }));

  return {
    positions: next,
    cashWeight: round4(nextCash),
    turnover: turnoverOf(positions, next),
  };
}

/** Weights are carried to four places; the book must not accrue float dust. */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
