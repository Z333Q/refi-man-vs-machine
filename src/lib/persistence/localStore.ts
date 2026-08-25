import type {
  PersistencePort, ProfileSnapshot, TipRecord, DailyTapeSubmission,
} from './types';
import type { EventEnvelope } from '../eventBuffer';
import { listRunRecords, applyRemoteRun } from '../runRecord';
import { listMachineVersions, applyRemoteMachineVersion } from '../machineVersions';

// ─── Local persistence ────────────────────────────────────────────────────────
//
// The store the game actually had, made real.
//
// Profile state was written to a remote database and nowhere else, and every
// one of those writes was rejected: the policies are owner-scoped to an
// authenticated user and the game has never authenticated anyone. The failures
// were swallowed, so nothing said so, and the effect was that Alpha XP, rank,
// the machine ladder and unlocked modules reset on every page load. "SAVE YOUR
// RUN" saved nothing.
//
// Writing them here fixes that. It is also the honest description of what a
// no-account player's progress is: local, on this device, until they choose an
// account and the API adopts it.

const PROFILE_KEY = 'refi_profile';
const TIP_STATE_KEY = 'refi_tip_states';
const TAPE_KEY = 'refi_daily_tape';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Private mode, quota, or a value from an older shape. Progress is
    // best-effort: a store that cannot be read starts empty rather than
    // taking the screen down.
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // As above: a failed write must never interrupt play.
  }
}

/** Namespaced per session, so two sessions on one device stay separate. */
function scoped(key: string, sessionId: string): string {
  return `${key}:${sessionId}`;
}

export const localStore: PersistencePort = {
  kind: 'LOCAL',

  async loadProfile(sessionId) {
    return read<ProfileSnapshot>(scoped(PROFILE_KEY, sessionId));
  },

  async saveProfile(sessionId, profile) {
    write(scoped(PROFILE_KEY, sessionId), profile);
  },

  async saveTipState(sessionId, record) {
    const all = read<Record<string, TipRecord>>(scoped(TIP_STATE_KEY, sessionId)) ?? {};
    all[record.tipCode] = { ...all[record.tipCode], ...record };
    write(scoped(TIP_STATE_KEY, sessionId), all);
  },

  async saveGuidanceMode() {
    // Guidance mode already has its own key, written by the tip context on the
    // path that reads it back. Duplicating it here would give one setting two
    // sources of truth.
  },

  async loadDailyTape(sessionId, tapeDate) {
    const all = read<Record<string, DailyTapeSubmission>>(scoped(TAPE_KEY, sessionId)) ?? {};
    return all[tapeDate] ?? null;
  },

  async saveDailyTape(sessionId, submission) {
    const all = read<Record<string, DailyTapeSubmission>>(scoped(TAPE_KEY, sessionId)) ?? {};
    all[submission.tapeDate] = submission;
    write(scoped(TAPE_KEY, sessionId), all);
  },

  // Run Records and machine versions live in their own synchronous stores
  // (runRecord.ts, machineVersions.ts): the Bronze gate and the builder read
  // them in render, so their durability cannot wait on a promise. These port
  // methods are the async view over the same data, not a second copy of it.
  // The stores predate per-session scoping and keep their unscoped keys; the
  // sessionId parameter is for the remote side of the port, which does need
  // to say whose stream it is asking about.

  async loadRunRecords() {
    return { kind: 'VALUE' as const, value: listRunRecords() };
  },

  async saveRunRecord(_sessionId, record) {
    // Idempotent: a record the store already holds is kept (local wins), so
    // routing a save through the port never overwrites the synchronous store.
    applyRemoteRun(record);
    return { kind: 'VALUE' as const, value: null };
  },

  async loadMachineVersions() {
    return { kind: 'VALUE' as const, value: listMachineVersions() };
  },

  async saveMachineVersion(_sessionId, record) {
    applyRemoteMachineVersion(record);
    return { kind: 'VALUE' as const, value: null };
  },

  async deliverEvent(_envelope: EventEnvelope) {
    // Nothing to deliver to. The caller's durable buffer keeps the backlog, so
    // events survive until a real sink is configured.
    return false;
  },
};
