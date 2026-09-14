// Engine parity baseline: the fixed point a refactor has to land on.
//
// The Game Core Boundary track moves pure domain code out of src/lib and into
// packages/game-core, one coherent cluster at a time. Every one of those PRs
// makes the same claim: nothing the player experiences changed. A green unit
// suite does not prove that claim. Unit tests assert the properties somebody
// thought to write down, and an extraction can preserve every one of them while
// changing a number nobody asserted.
//
// So the claim is checked the only way it can be: play every arena to the end,
// four ways each, and write down everything the engine decided. The result is a
// golden fixture generated BEFORE the first extraction and never regenerated to
// make a test pass. If the bytes differ afterwards, the extraction changed
// behaviour, and the difference is the finding.
//
// It walks the same commit boundary a player does (arenaPlaythrough.test.ts)
// rather than inventing decision paths, because a baseline through a path the
// product cannot reach would prove something about a path nobody plays.
//
// Determinism: fixed seed, fixed dispositions, no wall clock, no generated ids,
// no randomness. Run ids are derived from arena and disposition.

import './arenaIndex';
import { allArenas } from './arenas';
import type { ActionCode, RunState } from './gameTypes';
import {
  createInitialRun, commitDecisionCommand, advanceRunCheckpoint, attachThesis,
  committableActions, resolveRunResult,
} from './runEngine';

export type Disposition =
  | 'ALWAYS_HOLD' | 'ALWAYS_FIRST' | 'ALWAYS_LAST' | 'ALWAYS_COSTLIEST';

export const DISPOSITIONS: Disposition[] = [
  'ALWAYS_HOLD', 'ALWAYS_FIRST', 'ALWAYS_LAST', 'ALWAYS_COSTLIEST',
];

/** The seed every baseline run opens with. Changing it invalidates the golden. */
export const PARITY_SEED = 11;

function chooseAction(
  run: RunState,
  disposition: Disposition,
  authored: ActionCode[],
): ActionCode {
  const committable = committableActions(run).filter(a => authored.includes(a));
  const pool = committable.length > 0 ? committable : (['HOLD'] as ActionCode[]);
  switch (disposition) {
    case 'ALWAYS_HOLD': return 'HOLD';
    case 'ALWAYS_FIRST': return pool[0];
    case 'ALWAYS_LAST': return pool[pool.length - 1];
    case 'ALWAYS_COSTLIEST': return pool.find(a => a !== 'HOLD') ?? 'HOLD';
  }
}

/**
 * Every engine-authoritative fact at one resolved checkpoint.
 *
 * Deliberately wide. A narrow snapshot is a snapshot of the fields somebody
 * remembered, and the fields nobody remembers are where a refactor hides.
 */
interface CheckpointSnapshot {
  sequence: number;
  phase: string;
  result: string;
  actionCommitted: ActionCode;
  portfolioValue: number;
  cashWeight: number;
  positions: { symbol: string; weight: number; pnl: number; riskContrib: number; sector: string }[];
  sectorExposure: [string, number][];
  drawdown: number;
  troughDrawdown: number;
  volatility: number;
  turnoverUsed: number;
  correlationIndex: number;
  playerScore: number;
  machineScore: number;
  decisionScoreContribution: number;
  decisionQuality: string;
  decisionTurnoverCost: number;
  behavioralFlags: string[];
  machineActionCode: ActionCode;
  criticalFailure: boolean;
  criticalFailureCheckpoint: number | null;
  activeModules: string[];
}

interface RunSnapshot {
  arenaId: string;
  disposition: Disposition;
  seed: number;
  totalCheckpoints: number;
  checkpoints: CheckpointSnapshot[];
  final: {
    phase: string;
    result: string;
    resolvedResult: string;
    playerScore: number;
    machineScore: number;
    portfolioValue: number;
    cashWeight: number;
    drawdown: number;
    troughDrawdown: number;
    turnoverUsed: number;
    criticalFailure: boolean;
    criticalFailureCheckpoint: number | null;
    decisionCount: number;
  };
}

function snapshotCheckpoint(run: RunState, action: ActionCode): CheckpointSnapshot {
  const decision = run.decisions[run.decisions.length - 1];
  const p = run.portfolio;
  return {
    sequence: decision.checkpointSequence,
    phase: run.phase,
    result: run.result,
    actionCommitted: action,
    portfolioValue: p.value,
    cashWeight: p.cashWeight,
    // Sorted by symbol: position order is an engine implementation detail, and
    // a baseline that pins it would fail on a reordering that changes nothing.
    positions: [...p.positions]
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .map(x => ({
        symbol: x.symbol, weight: x.weight, pnl: x.pnl,
        riskContrib: x.riskContrib, sector: x.sector,
      })),
    sectorExposure: Object.entries(p.sectorExposure)
      .sort((a, b) => a[0].localeCompare(b[0])),
    drawdown: p.drawdown,
    troughDrawdown: p.troughDrawdown,
    volatility: p.volatility,
    turnoverUsed: p.turnoverUsed,
    correlationIndex: p.correlationIndex,
    playerScore: run.playerScore,
    machineScore: run.machineScore,
    decisionScoreContribution: decision.scoreContribution,
    decisionQuality: decision.quality,
    decisionTurnoverCost: decision.turnoverCost,
    // Engine order, not sorted: the order flags are raised in is itself a
    // deterministic engine output.
    behavioralFlags: [...decision.behavioralFlags],
    machineActionCode: decision.machineActionCode,
    criticalFailure: run.criticalFailure,
    criticalFailureCheckpoint: run.criticalFailureCheckpoint,
    activeModules: [...run.activeModules],
  };
}

function playThrough(arenaId: RunState['arenaId'], disposition: Disposition): RunSnapshot {
  const arena = allArenas().find(a => a.id === arenaId)!;
  let run: RunState = {
    ...createInitialRun(PARITY_SEED, arenaId),
    id: `parity_${arenaId}_${disposition}`,
  };

  const checkpoints: CheckpointSnapshot[] = [];

  for (let i = 0; i < arena.checkpoints.length; i++) {
    const cp = arena.checkpoints[i];
    const authored = cp.availableActions.map(b => b.actionCode);
    const action = chooseAction(run, disposition, authored);
    const outcome = commitDecisionCommand(run, { action, conviction: 60 });
    if (!outcome) throw new Error(`${arenaId} CP${cp.sequence} rejected ${action} (${disposition})`);

    run = attachThesis(outcome.run, 'THESIS_UNCHANGED');
    checkpoints.push(snapshotCheckpoint(run, action));

    if (run.currentCheckpoint < arena.checkpoints.length) {
      run = advanceRunCheckpoint(run);
    }
  }

  const resolved = resolveRunResult(run, run.playerScore >= run.machineScore ? 'PASSED' : 'FAILED');
  return {
    arenaId,
    disposition,
    seed: PARITY_SEED,
    totalCheckpoints: run.totalCheckpoints,
    checkpoints,
    final: {
      phase: run.phase,
      result: run.result,
      resolvedResult: resolved,
      playerScore: run.playerScore,
      machineScore: run.machineScore,
      portfolioValue: run.portfolio.value,
      cashWeight: run.portfolio.cashWeight,
      drawdown: run.portfolio.drawdown,
      troughDrawdown: run.portfolio.troughDrawdown,
      turnoverUsed: run.portfolio.turnoverUsed,
      criticalFailure: run.criticalFailure,
      criticalFailureCheckpoint: run.criticalFailureCheckpoint,
      decisionCount: run.decisions.length,
    },
  };
}

/**
 * Canonical JSON: keys in insertion order are not enough when the comparison is
 * byte-for-byte, so every object is rewritten with sorted keys and -0 is
 * normalised to 0. A non-finite number is a defect rather than a value, and
 * throws here instead of serialising as null.
 */
function canonical(value: unknown): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number in parity baseline: ${value}`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Every arena, every disposition, serialised canonically. */
export function generateParityBaseline(): string {
  const runs: RunSnapshot[] = [];
  for (const arena of allArenas()) {
    for (const disposition of DISPOSITIONS) {
      runs.push(playThrough(arena.id, disposition));
    }
  }
  return JSON.stringify(canonical({ version: 1, seed: PARITY_SEED, runs }), null, 2) + '\n';
}
