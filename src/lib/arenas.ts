// ─── Arena registry ───────────────────────────────────────────────────────────
//
// §20 defines a progression of economic regimes, not a game with one level.
// The engine was written against a single arena: `createInitialRun` hardcoded
// COVID's id and length, and `getCheckpoint` took a sequence with no arena to
// read it from. Every additional regime was blocked on this.
//
// An arena owns its content, its risk budget and the portfolio the player is
// handed. That last part matters more than it looks: §24's lesson is that six
// bank tickers are one economic exposure, and it cannot be taught to someone
// holding the COVID book. The starting portfolio is part of the argument.

import type { ArenaId, CheckpointData, PortfolioState } from './gameTypes';

export interface ArenaDefinition {
  id: ArenaId;
  name: string;
  /** Position in the §20 progression. */
  order: number;
  /** 1-5, shown on the arena map. */
  difficulty: number;
  /** The one-line reason this regime exists in the game. */
  lesson: string;
  /** The historical window, for the briefing. */
  window: string;
  checkpoints: CheckpointData[];
  /**
   * Drawdown that ends the run's ability to pass (§21.2 risk limits).
   * Per arena, because a banking-contagion book and a recovery book do not
   * carry the same amount of survivable loss.
   */
  criticalDrawdown: number;
  /** The book the player is handed. Built fresh per run: never shared state. */
  startingPortfolio: () => PortfolioState;
}

// ─── Registry ─────────────────────────────────────────────────────────────────
//
// Populated by each arena module registering itself, so adding a regime is one
// file plus one import rather than an edit to the engine.

const REGISTRY = new Map<ArenaId, ArenaDefinition>();

export function registerArena(def: ArenaDefinition): ArenaDefinition {
  REGISTRY.set(def.id, def);
  return def;
}

export function getArena(id: ArenaId): ArenaDefinition | undefined {
  return REGISTRY.get(id);
}

/** Every arena, in progression order. */
export function allArenas(): ArenaDefinition[] {
  return [...REGISTRY.values()].sort((a, b) => a.order - b.order);
}

/**
 * A checkpoint, by arena and sequence.
 *
 * Returns undefined rather than throwing for an unknown arena or an
 * out-of-range sequence: the engine treats a missing checkpoint as the end of a
 * run, and a thrown error there would turn a content gap into a crash.
 */
export function getCheckpoint(arenaId: ArenaId, sequence: number): CheckpointData | undefined {
  return REGISTRY.get(arenaId)?.checkpoints.find(cp => cp.sequence === sequence);
}

export function getTotalCheckpoints(arenaId: ArenaId): number {
  return REGISTRY.get(arenaId)?.checkpoints.length ?? 0;
}

/** The arena a new run opens on when none is named. */
export const DEFAULT_ARENA_ID: ArenaId = 'covid_black_swan';

// ─── Shared portfolio helpers ─────────────────────────────────────────────────

/**
 * Assemble a starting book from weights.
 *
 * Sector exposure and cash are derived rather than authored twice, so a book
 * cannot claim a sector total that disagrees with its own positions — which is
 * exactly the kind of quiet inconsistency the concentration lessons depend on
 * not having.
 */
export function buildPortfolio(
  positions: { symbol: string; weight: number; sector: string; riskContrib: number }[],
  opts: { volatility: number; correlationIndex: number; startingCapital: number },
): PortfolioState {
  const invested = positions.reduce((a, p) => a + p.weight, 0);
  const sectorExposure: Record<string, number> = {};
  for (const p of positions) {
    sectorExposure[p.sector] = (sectorExposure[p.sector] ?? 0) + p.weight;
  }
  return {
    value: opts.startingCapital,
    cashWeight: Math.round((1 - invested) * 10000) / 10000,
    positions: positions.map(p => ({ ...p, pnl: 0 })),
    peakValue: opts.startingCapital,
    drawdown: 0,
    volatility: opts.volatility,
    sectorExposure,
    turnoverUsed: 0,
    correlationIndex: opts.correlationIndex,
  };
}
