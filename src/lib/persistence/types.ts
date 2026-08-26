import type { PlayerProfile } from '../gameTypes';
import type { EventEnvelope } from '../eventBuffer';
import type { RunRecord } from '../runRecord';
import type { MachineVersionRecord } from '../machineVersions';

// ─── Persistence port ─────────────────────────────────────────────────────────
//
// What the game needs stored, stated without reference to whoever stores it.
//
// The browser used to call a database vendor's client directly from three
// screens and two contexts. That is the coupling worth removing early: tables
// move between PostgreSQL hosts with ordinary tooling, but a UI that knows the
// vendor's query language has to be rewritten rather than repointed.
//
// So the screens depend on this interface. Today it resolves to local storage,
// and to the ReFi API when one is configured. Neither the reducer nor any
// screen can tell the difference, which is the whole point: swapping the store
// becomes a change to one adapter file.

/** A player's persisted profile. Mirrors PlayerProfile minus derived state. */
export type ProfileSnapshot = Omit<PlayerProfile, 'sessionId'>;

export interface TipRecord {
  tipCode: string;
  state: string;
  lastShownAt?: string;
  completedAt?: string;
}

export interface DailyTapeSubmission {
  tapeDate: string;
  /**
   * Which authored tape this decision answered. The date says when the call
   * was made; the id says what it was about, and the two can diverge (an
   * authored tape rotates through the calendar). daily_tape_submissions
   * requires it, so a submission without it cannot reach the database.
   */
  tapeId: string;
  playerAction: string;
  score: number;
}

// ─── Remote results ───────────────────────────────────────────────────────────
//
// A remote read has five honest answers, and collapsing them to one `null`
// was the profile-reset bug in miniature: "the server has no profile" and
// "the network is down" both came back as nothing, so an outage was treated
// as a fresh player. A caller deciding whether to hydrate must be able to
// tell absence from failure.

export type RemoteResult<T> =
  /** The server answered with a value. */
  | { kind: 'VALUE'; value: T }
  /** The server answered: it holds nothing for this key. A real absence. */
  | { kind: 'NOT_FOUND' }
  /** The server answered with an error status. Not an absence. */
  | { kind: 'HTTP_ERROR'; status: number }
  /** No answer at all: offline, blocked, DNS, timeout. Not an absence. */
  | { kind: 'NETWORK_ERROR' }
  /** The server answered 2xx but the body did not parse. Not an absence. */
  | { kind: 'INVALID' };

export interface PersistencePort {
  /** Which store is behind this port, for diagnostics and copy. */
  readonly kind: 'LOCAL' | 'REFI_API';

  loadProfile(sessionId: string): Promise<ProfileSnapshot | null>;
  saveProfile(sessionId: string, profile: ProfileSnapshot): Promise<void>;

  saveTipState(sessionId: string, record: TipRecord): Promise<void>;
  saveGuidanceMode(sessionId: string, mode: string): Promise<void>;

  loadDailyTape(sessionId: string, tapeDate: string): Promise<DailyTapeSubmission | null>;
  saveDailyTape(sessionId: string, submission: DailyTapeSubmission): Promise<void>;

  // Run Records and machine versions. Local storage is authoritative on this
  // device (the synchronous stores in runRecord.ts / machineVersions.ts);
  // these methods exist so a configured remote can mirror what local holds
  // and fill gaps local does not. Loads return RemoteResult because the
  // caller must distinguish "the server holds nothing" from "the server
  // could not be asked" before it dares treat the answer as an absence.
  loadRunRecords(sessionId: string): Promise<RemoteResult<RunRecord[]>>;
  saveRunRecord(sessionId: string, record: RunRecord): Promise<RemoteResult<null>>;
  loadMachineVersions(sessionId: string): Promise<RemoteResult<MachineVersionRecord[]>>;
  saveMachineVersion(sessionId: string, record: MachineVersionRecord): Promise<RemoteResult<null>>;

  /**
   * Deliver one telemetry envelope. Returns false on any failure, without
   * throwing: a player is never stopped by a telemetry problem, and the
   * caller's durable buffer retries.
   */
  deliverEvent(envelope: EventEnvelope): Promise<boolean>;
}
