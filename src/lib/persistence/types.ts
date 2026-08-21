import type { PlayerProfile } from '../gameTypes';
import type { EventEnvelope } from '../eventBuffer';

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
  playerAction: string;
  score: number;
}

export interface PersistencePort {
  /** Which store is behind this port, for diagnostics and copy. */
  readonly kind: 'LOCAL' | 'REFI_API';

  loadProfile(sessionId: string): Promise<ProfileSnapshot | null>;
  saveProfile(sessionId: string, profile: ProfileSnapshot): Promise<void>;

  saveTipState(sessionId: string, record: TipRecord): Promise<void>;
  saveGuidanceMode(sessionId: string, mode: string): Promise<void>;

  loadDailyTape(sessionId: string, tapeDate: string): Promise<DailyTapeSubmission | null>;
  saveDailyTape(sessionId: string, submission: DailyTapeSubmission): Promise<void>;

  /**
   * Deliver one telemetry envelope. Returns false on any failure, without
   * throwing: a player is never stopped by a telemetry problem, and the
   * caller's durable buffer retries.
   */
  deliverEvent(envelope: EventEnvelope): Promise<boolean>;
}
