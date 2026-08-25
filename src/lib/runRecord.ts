// ─── Run Record ───────────────────────────────────────────────────────────────
// The audit trail a run leaves behind, toward §57's Run Record. What the
// record holds today: run ID, arena ID, seed, player decisions with commit
// times, machine actions, scores, result. What §57 also names and this record
// does NOT yet carry, because nothing in the product has established them:
// benchmark ID, scoring version, simulation timestamps, data cutoff. Those
// arrive with the benchmark layer; claiming them earlier would be provenance
// the record cannot back.
//
// Until this existed the run lived only in React state. It died on refresh, the
// autopsy had nothing to read and invented a run instead, and §65's
// "deterministic replay from run seed" had no seed to replay from.
//
// Storage is local and synchronous, and local is authoritative on this device:
// the Bronze gate, the arena map and the autopsy all read it in render. A
// configured remote (the ReFi API behind the persistence port) is a mirror —
// writes are announced to it fire-and-forget through the hook below, and reads
// from it may only fill gaps local does not hold, never overwrite what it
// does. There is no timestamp-based conflict resolution anywhere in this file.
//
// Nothing here is authoritative game state. The engine remains the authority;
// this is the audit trail it leaves behind.

import type {
  ActionCode, ArenaId, BehavioralFlag, DecisionQuality, ModuleCode,
  RunState, ThesisCode,
} from './gameTypes';
import {
  advanceRunCheckpoint, attachThesis, commitDecisionCommand, createInitialRun,
} from './runEngine';
import { confidenceToConviction } from './decisionContract';

/** Bumped when the record shape changes in a way a reader must notice. */
export const RUN_RECORD_VERSION = 2;

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
  /**
   * Wall-clock time the player committed, stamped by the projection's caller.
   * Null on decisions recorded before v2 captured commit times: a migration
   * must never invent a timestamp the player did not make.
   */
  committedAt: string | null;
}

/** One run, finished or in flight. Mirrors `arena_runs`. */
export interface RunRecord {
  recordVersion: number;
  runId: string;
  seed: number;
  arenaId: ArenaId;
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

/** The committed time this decision already has, or `now` only when it has never been recorded. */
function priorCommitTime(
  previous: RunRecord | undefined,
  checkpointSequence: number,
  now: string,
): string | null {
  const prior = previous?.decisions.find(p => p.checkpointSequence === checkpointSequence);
  return prior ? prior.committedAt : now;
}

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
      // A commit time, once recorded, is fixed: re-projections keep the time
      // each decision was actually committed, and only decisions this write
      // introduces are stamped with the caller's clock. A prior decision whose
      // time is null (migrated from v1) stays null; re-stamping it would
      // fabricate a commit time the player never made.
      committedAt: priorCommitTime(previous, d.checkpointSequence, now),
    })),

    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
    // Once a run is finished its completion time is fixed. A later write (a
    // replay, a re-read) must not move it.
    completedAt: previous?.completedAt ?? (finished ? now : null),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * v1 → v2: v2 added `committedAt` to each decision. A v1 record is otherwise
 * identical, so it migrates by stating honestly that its commit times were
 * never captured: every decision gets `committedAt: null`. The one thing a
 * migration must never do is invent the timestamp it is missing.
 */
function migrateV1(record: RunRecord): RunRecord {
  return {
    ...record,
    recordVersion: RUN_RECORD_VERSION,
    decisions: record.decisions.map(d => ({ ...d, committedAt: d.committedAt ?? null })),
  };
}

function readAll(): RunRecord[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // v1 records migrate in place; anything older or unrecognized is dropped
    // rather than half-read — a half-understood record would show the player
    // a run that did not happen, which is the bug this module exists to end.
    return (parsed as RunRecord[])
      .filter(r => r && typeof r === 'object' && Array.isArray(r.decisions))
      .filter(r => r.recordVersion === RUN_RECORD_VERSION || r.recordVersion === 1)
      .map(r => (r.recordVersion === 1 ? migrateV1(r) : r));
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
  announceToMirror(record);
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
    ...createInitialRun(record.seed, record.arenaId),
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

// ─── Remote mirror ────────────────────────────────────────────────────────────
//
// The store above is authoritative on this device. A configured remote hears
// about writes through this hook and hands back what it holds through
// applyRemoteRun — and only into gaps. The hook indirection keeps this module
// free of the persistence port (and of any import cycle with it): the wiring
// lives in the persistence layer, which knows whether a remote exists at all.

let mirror: ((record: RunRecord) => void) | null = null;

/** Install the fire-and-forget announcer. Pass null to detach (tests). */
export function setRunRecordMirror(fn: ((record: RunRecord) => void) | null): void {
  mirror = fn;
}

function announceToMirror(record: RunRecord): void {
  try {
    mirror?.(record);
  } catch {
    // The mirror is best-effort by contract; a failing mirror must never
    // reach the caller that just saved a run.
  }
}

/** What became of one remote record offered to the local store. */
export type RemoteRunOutcome =
  /** The run was a local gap; it is now stored. */
  | { kind: 'ADOPTED' }
  /** Local already holds this run; local is authoritative and unchanged. */
  | { kind: 'LOCAL_KEPT' }
  /** Local holds a differing record for the same run id. Local is kept; the
   *  remote version is preserved in the outcome so nothing is lost silently. */
  | { kind: 'CONFLICT'; local: RunRecord; remote: RunRecord }
  /** The remote payload was not a usable run record. */
  | { kind: 'REFUSED'; reason: string };

/** Field-by-field equality, ignoring `updatedAt`: it is ordering and audit
 *  metadata only, and never participates in conflict decisions. */
function sameRecord(a: RunRecord, b: RunRecord): boolean {
  const strip = ({ updatedAt: _updatedAt, ...rest }: RunRecord) => rest;
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

/**
 * Offer one remote record to the local store: local-authoritative gap
 * hydration. A run local has never heard of is adopted; a run local already
 * holds is never overwritten, whatever any timestamp says. A difference is
 * reported as a conflict, not resolved.
 */
export function applyRemoteRun(remote: RunRecord): RemoteRunOutcome {
  if (!remote || typeof remote !== 'object' || typeof remote.runId !== 'string'
      || !remote.runId || !Array.isArray(remote.decisions)) {
    return { kind: 'REFUSED', reason: 'not a run record' };
  }
  if (remote.recordVersion !== RUN_RECORD_VERSION && remote.recordVersion !== 1) {
    return { kind: 'REFUSED', reason: `unknown record version ${String(remote.recordVersion)}` };
  }
  const usable = remote.recordVersion === 1 ? migrateV1(remote) : remote;

  const local = getRunRecord(usable.runId);
  if (!local) {
    writeAll([usable, ...readAll()]);
    return { kind: 'ADOPTED' };
  }
  if (sameRecord(local, usable)) return { kind: 'LOCAL_KEPT' };
  return { kind: 'CONFLICT', local, remote: usable };
}
