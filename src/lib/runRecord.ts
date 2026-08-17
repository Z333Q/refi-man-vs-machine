// ─── Run Record ───────────────────────────────────────────────────────────────
// §57: "Every finished run gets a Run Record: run ID; arena ID; player
// decisions; machine decisions; simulation timestamps; benchmark ID; scoring
// version; machine version; result; data cutoff."
//
// Until this existed the run lived only in React state. It died on refresh, the
// autopsy had nothing to read and invented a run instead, and §65's
// "deterministic replay from run seed" had no seed to replay from.
//
// Storage is local, deliberately. The player-owned tables are owner-scoped to
// auth.uid() (§3.1 of the USA Build Integration Spec) and the client has no
// auth session yet, so a Supabase write would be rejected by RLS rather than
// stored — silently, since the writes are fire-and-forget. The record is
// therefore shaped to the `arena_runs` and `checkpoint_decisions` columns it
// will eventually occupy: when auth lands (G2), `flushableRows` hands back
// exactly those rows and the only new code is the insert itself.
//
// Nothing here is authoritative game state. The engine remains the authority;
// this is the audit trail it leaves behind.

import type {
  ActionCode, BehavioralFlag, DecisionQuality, ModuleCode,
  RunState, ThesisCode,
} from './gameTypes';
import {
  advanceRunCheckpoint, attachThesis, commitDecisionCommand, createInitialRun,
} from './runEngine';
import { confidenceToConviction } from './decisionContract';

/** Bumped when the record shape changes in a way a reader must notice. */
export const RUN_RECORD_VERSION = 1;

/** How many finished runs to keep. Old runs fall off the end. */
export const MAX_STORED_RUNS = 20;

const STORE_KEY = 'refi_run_records';

// ─── Shape ────────────────────────────────────────────────────────────────────

/** One committed decision. Mirrors `checkpoint_decisions`. */
export interface RecordedDecision {
  checkpointSequence: number;
  actionCode: ActionCode;
  thesisCode: ThesisCode | null;
  confidence: number | null;
  modulesConsulted: ModuleCode[];
  turnoverCost: number;
  scoreContribution: number;
  quality: DecisionQuality;
  behavioralFlags: BehavioralFlag[];
  machineActionCode: ActionCode;
}

/** One run, finished or in flight. Mirrors `arena_runs`. */
export interface RunRecord {
  recordVersion: number;
  runId: string;
  seed: number;
  arenaId: string;
  machineId: string;

  state: RunState['phase'];
  result: RunState['result'];
  currentCheckpoint: number;
  totalCheckpoints: number;

  playerScore: number;
  machineScore: number;
  criticalFailure: boolean;
  criticalFailureCheckpoint: number | null;

  portfolioValue: number;
  cashWeight: number;
  drawdown: number;
  volatility: number;
  turnoverUsed: number;

  decisions: RecordedDecision[];

  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// ─── Projection ───────────────────────────────────────────────────────────────

/**
 * Project live run state into a record.
 *
 * `startedAt` is carried from any existing record for the same run so it keeps
 * meaning the moment the run opened rather than the moment it was last written.
 */
export function projectRun(
  run: RunState,
  now: string,
  previous?: RunRecord,
): RunRecord | null {
  if (!run.id) return null;

  const finished = run.phase === 'COMPLETE';

  return {
    recordVersion: RUN_RECORD_VERSION,
    runId: run.id,
    seed: run.seed,
    arenaId: run.arenaId,
    machineId: run.machineId,

    state: run.phase,
    result: run.result,
    currentCheckpoint: run.currentCheckpoint,
    totalCheckpoints: run.totalCheckpoints,

    playerScore: run.playerScore,
    machineScore: run.machineScore,
    criticalFailure: run.criticalFailure,
    criticalFailureCheckpoint: run.criticalFailureCheckpoint,

    portfolioValue: run.portfolio.value,
    cashWeight: run.portfolio.cashWeight,
    drawdown: run.portfolio.drawdown,
    volatility: run.portfolio.volatility,
    turnoverUsed: run.portfolio.turnoverUsed,

    decisions: run.decisions.map(d => ({
      checkpointSequence: d.checkpointSequence,
      actionCode: d.actionCode,
      thesisCode: d.thesisCode ?? null,
      confidence: d.confidence ?? null,
      modulesConsulted: d.modulesConsulted,
      turnoverCost: d.turnoverCost,
      scoreContribution: d.scoreContribution,
      quality: d.quality,
      behavioralFlags: d.behavioralFlags,
      machineActionCode: d.machineActionCode,
    })),

    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
    // Once a run is finished its completion time is fixed. A later write (a
    // replay, a re-read) must not move it.
    completedAt: previous?.completedAt ?? (finished ? now : null),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

function readAll(): RunRecord[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Records written by an older shape are dropped rather than migrated: a run
    // is disposable history, and a half-understood record would show the player
    // a run that did not happen, which is the bug this module exists to end.
    return (parsed as RunRecord[]).filter(
      r => r && typeof r === 'object' && r.recordVersion === RUN_RECORD_VERSION,
    );
  } catch {
    return [];
  }
}

function writeAll(records: RunRecord[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(records.slice(0, MAX_STORED_RUNS)));
  } catch {
    // Storage unavailable (private mode, quota). The record is an audit trail,
    // not game state, so a failed write must never interrupt a run.
  }
}

/** Newest first. */
export function listRunRecords(): RunRecord[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getRunRecord(runId: string): RunRecord | null {
  return readAll().find(r => r.runId === runId) ?? null;
}

/** The most recent finished run, which is what the autopsy reads. */
export function latestFinishedRun(): RunRecord | null {
  return listRunRecords().find(r => r.completedAt !== null) ?? null;
}

/** The run to resume: the newest one still in flight. */
export function latestUnfinishedRun(): RunRecord | null {
  return listRunRecords().find(r => r.completedAt === null) ?? null;
}

/**
 * Write the run's current state, replacing any earlier write for the same run.
 * Called after every commit, so a run that is abandoned mid-way still leaves
 * the decisions the player did make.
 */
export function saveRun(run: RunState, now: string = new Date().toISOString()): RunRecord | null {
  const existing = run.id ? getRunRecord(run.id) : null;
  const record = projectRun(run, now, existing ?? undefined);
  if (!record) return null;

  const rest = readAll().filter(r => r.runId !== record.runId);
  writeAll([record, ...rest]);
  return record;
}

export function clearRunRecords(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // See writeAll.
  }
}

// ─── Replay ───────────────────────────────────────────────────────────────────

/**
 * Rebuild a live run from its record by replaying the decisions through the
 * engine.
 *
 * The record deliberately stores no portfolio snapshot to restore from. It does
 * not need one: the engine is pure and the run is anchored by a seed, so the
 * decision sequence *is* the state. Storing a snapshot as well would create a
 * second source of truth that could disagree with the engine after any scoring
 * change, and the disagreement would surface as a player's saved run quietly
 * scoring differently than it did.
 *
 * This is §65's "deterministic replay from run seed" exercised on the live
 * path rather than asserted in a test only: resuming a run is a replay.
 *
 * Returns null when the record cannot be replayed — an unknown stance, a
 * checkpoint the content no longer authors, an arena that has since changed
 * shape. A refused resume is correct; a partially reconstructed run is not.
 */
export function replayRun(
  record: RunRecord,
  seedModules: ModuleCode[] = [],
): RunState | null {
  let run: RunState = {
    ...createInitialRun(record.seed),
    id: record.runId,
  };

  // Carry the modules the player had. They gate what the terminal shows, not
  // what the engine computes, so they are restored rather than replayed.
  const seen = new Set(run.activeModules);
  run = {
    ...run,
    activeModules: [...run.activeModules, ...seedModules.filter(m => !seen.has(m))],
  };

  for (const d of record.decisions) {
    const outcome = commitDecisionCommand(run, {
      action: d.actionCode,
      conviction: confidenceToConviction(d.confidence ?? 0.6),
    });
    if (!outcome) return null;

    run = outcome.run;
    if (d.thesisCode) run = attachThesis(run, d.thesisCode);

    // Advance only as far as the record says the run had got. A run recorded
    // mid-resolution has its last decision committed but not yet advanced.
    if (run.currentCheckpoint < record.currentCheckpoint) {
      run = advanceRunCheckpoint(run);
    }
  }

  if (run.decisions.length !== record.decisions.length) return null;

  return {
    ...run,
    // The record is authoritative for the run's own bookkeeping: these are
    // outcomes of the replay, and any drift between them is a signal worth
    // preserving rather than hiding.
    result: record.result,
    criticalFailure: record.criticalFailure || run.criticalFailure,
    criticalFailureCheckpoint: record.criticalFailureCheckpoint ?? run.criticalFailureCheckpoint,
  };
}

/**
 * Whether a replay reproduces the record it came from.
 *
 * Scores are the check because they are what the player is shown and what the
 * profile is built from. A mismatch means the engine has changed since the run
 * was stored, and the honest response is to decline the resume rather than to
 * present a run whose numbers have quietly moved.
 */
export function replayMatchesRecord(record: RunRecord, replayed: RunState): boolean {
  return (
    replayed.playerScore === record.playerScore &&
    replayed.machineScore === record.machineScore &&
    replayed.currentCheckpoint === record.currentCheckpoint
  );
}

// ─── Forward path to Supabase ─────────────────────────────────────────────────

/**
 * The record as the rows it will occupy once the client has an auth session.
 *
 * `owner_id` is deliberately absent: the column defaults to `auth.uid()`, so
 * the row is owner-stamped by the session's real principal rather than by
 * anything the client claims. Supplying it here would let a client name an
 * owner, which is exactly what the owner-scoped rewrite exists to prevent.
 */
export function flushableRows(record: RunRecord, sessionId: string): {
  run: Record<string, unknown>;
  decisions: Record<string, unknown>[];
} {
  return {
    run: {
      id: record.runId,
      session_id: sessionId,
      arena_id: record.arenaId,
      machine_id: record.machineId,
      state: record.state,
      current_checkpoint: record.currentCheckpoint,
      total_checkpoints: record.totalCheckpoints,
      portfolio_value: record.portfolioValue,
      cash_weight: record.cashWeight,
      drawdown: record.drawdown,
      turnover_used: record.turnoverUsed,
      player_score: record.playerScore,
      machine_score: record.machineScore,
      result: record.result,
      critical_failure: record.criticalFailure,
      seed: record.seed,
      started_at: record.startedAt,
      completed_at: record.completedAt,
    },
    decisions: record.decisions.map(d => ({
      run_id: record.runId,
      session_id: sessionId,
      checkpoint_sequence: d.checkpointSequence,
      action_code: d.actionCode,
      thesis_code: d.thesisCode,
      confidence: d.confidence,
      modules_consulted: d.modulesConsulted,
      decision_quality: d.quality,
      score_contribution: d.scoreContribution,
      machine_action_code: d.machineActionCode,
      behavioral_flags: d.behavioralFlags,
    })),
  };
}
