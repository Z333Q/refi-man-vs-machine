import type { PersistencePort } from './types';
import type { RefiRemote } from './refiApi';
import { localStore } from './localStore';
import {
  applyRemoteRun, setRunRecordMirror, type RemoteRunOutcome,
} from '../runRecord';
import {
  applyRemoteMachineVersion, setMachineVersionMirror, type RemoteMachineOutcome,
} from '../machineVersions';

// ─── Mirrored store ───────────────────────────────────────────────────────────
//
// The composition that replaces the old either/or: with an API configured, the
// game used to hand persistence to the remote outright, so a server outage
// read as an empty account and a fresh default profile overwrote real
// progress. Here the local store is authoritative on this device, always
// written first and always read first; the remote is a mirror that is told
// about writes and consulted only to fill local gaps.
//
// Conflict policy, everywhere in this file: local-authoritative. A remote
// record is adopted only where local holds nothing for that key. Where the
// two disagree, local is kept and the disagreement is preserved and surfaced
// through syncConflicts(), never resolved by comparing timestamps.

/** A disagreement between this device and the mirror, kept for inspection. */
export interface SyncConflict {
  kind: 'RUN' | 'MACHINE_VERSION' | 'PROFILE' | 'REFUSED';
  key: string;
  detail: string;
}

const conflicts: SyncConflict[] = [];

/** Conflicts and refusals seen since load, oldest first. */
export function syncConflicts(): readonly SyncConflict[] {
  return conflicts;
}

function recordConflict(conflict: SyncConflict): void {
  conflicts.push(conflict);
  // Surfaced for diagnosis; the player-facing surface for this is a later
  // decision, and silence in the meantime would hide real data loss risk.
  console.warn(`[persistence] ${conflict.kind} ${conflict.key}: ${conflict.detail}`);
}

function noteRunOutcome(runId: string, outcome: RemoteRunOutcome): void {
  if (outcome.kind === 'CONFLICT') {
    recordConflict({
      kind: 'RUN', key: runId,
      detail: 'remote and local hold different records for this run; local kept',
    });
  } else if (outcome.kind === 'REFUSED') {
    recordConflict({ kind: 'REFUSED', key: runId, detail: outcome.reason });
  }
}

function noteMachineOutcome(key: string, outcome: RemoteMachineOutcome): void {
  if (outcome.kind === 'CONFLICT') {
    recordConflict({
      kind: 'MACHINE_VERSION', key,
      detail: 'same machine name and version with a different build hash; local kept',
    });
  } else if (outcome.kind === 'METADATA_DIVERGENCE') {
    recordConflict({
      kind: 'MACHINE_VERSION', key,
      detail: 'same build with diverging metadata (lockedAt / arenasCompleted); local kept, nothing merged',
    });
  } else if (outcome.kind === 'REFUSED') {
    recordConflict({ kind: 'REFUSED', key, detail: outcome.reason });
  }
}

// ─── Profile mirror guard ─────────────────────────────────────────────────────
//
// Mirroring a profile save upward is only safe once the server's answer for
// this session has been heard. Without that, a fresh device during an outage
// would create a default profile locally and then push it over the real one
// the moment the network returned. VALUE and NOT_FOUND both count as heard;
// an error of any kind does not.
//
// The guard applies on the local-hit path too. An earlier revision marked the
// session as heard the moment a local profile was found, which meant a device
// with any local profile mirrored upward without the server ever answering —
// exactly the blind write the guard exists to prevent. Now a local hit returns
// immediately (local is the authority for gameplay) while a background probe
// asks the remote; only its VALUE or NOT_FOUND answer opens the mirror, and a
// VALUE that disagrees with local is surfaced as a diagnostic before the local
// record, which is kept, resumes mirroring over it.

const heardFrom = new Set<string>();
const probing = new Set<string>();

function probeRemoteProfile(
  remote: RefiRemote,
  sessionId: string,
  local: unknown,
): void {
  if (heardFrom.has(sessionId) || probing.has(sessionId)) return;
  probing.add(sessionId);
  void remote.loadProfile(sessionId).then(answer => {
    probing.delete(sessionId);
    if (answer.kind === 'VALUE') {
      heardFrom.add(sessionId);
      if (JSON.stringify(answer.value) !== JSON.stringify(local)) {
        recordConflict({
          kind: 'PROFILE', key: sessionId,
          detail: 'remote profile differs from local; local kept and mirrored as the device authority',
        });
      }
    } else if (answer.kind === 'NOT_FOUND') {
      heardFrom.add(sessionId);
    }
    // Any error: still not heard. The next loadProfile probes again.
  }).catch(() => { probing.delete(sessionId); });
}

/**
 * Build the port used when a ReFi API is configured: local first for
 * durability and reads, remote as a best-effort mirror and gap filler.
 */
export function makeMirroredStore(remote: RefiRemote): PersistencePort {
  return {
    kind: 'REFI_API',

    async loadProfile(sessionId) {
      const local = await localStore.loadProfile(sessionId);
      if (local) {
        // Local answers now; the server's answer arrives in the background
        // and is what opens the upward mirror — never the local hit itself.
        probeRemoteProfile(remote, sessionId, local);
        return local;
      }
      const answer = await remote.loadProfile(sessionId);
      if (answer.kind === 'VALUE') {
        heardFrom.add(sessionId);
        await localStore.saveProfile(sessionId, answer.value);
        return answer.value;
      }
      if (answer.kind === 'NOT_FOUND') heardFrom.add(sessionId);
      // NOT_FOUND: a genuinely new player. Anything else: an outage, which
      // must read as "nothing to hydrate from", never as "no account" — the
      // guard above keeps saves from mirroring until the server has spoken.
      return null;
    },

    async saveProfile(sessionId, profile) {
      // Durability is local and immediate; the mirror is told afterwards and
      // its failure is its own problem.
      await localStore.saveProfile(sessionId, profile);
      if (heardFrom.has(sessionId)) void remote.saveProfile(sessionId, profile);
    },

    async saveTipState(sessionId, record) {
      await localStore.saveTipState(sessionId, record);
      void remote.saveTipState(sessionId, record);
    },

    async saveGuidanceMode(sessionId, mode) {
      await localStore.saveGuidanceMode(sessionId, mode);
      void remote.saveGuidanceMode(sessionId, mode);
    },

    async loadDailyTape(sessionId, tapeDate) {
      const local = await localStore.loadDailyTape(sessionId, tapeDate);
      if (local) return local;
      const answer = await remote.loadDailyTape(sessionId, tapeDate);
      if (answer.kind === 'VALUE') {
        await localStore.saveDailyTape(sessionId, answer.value);
        return answer.value;
      }
      return null;
    },

    async saveDailyTape(sessionId, submission) {
      await localStore.saveDailyTape(sessionId, submission);
      void remote.saveDailyTape(sessionId, submission);
    },

    async loadRunRecords(sessionId) {
      return remote.loadRunRecords(sessionId);
    },

    async saveRunRecord(sessionId, record) {
      return remote.saveRunRecord(sessionId, record);
    },

    async loadMachineVersions(sessionId) {
      return remote.loadMachineVersions(sessionId);
    },

    async saveMachineVersion(sessionId, record) {
      return remote.saveMachineVersion(sessionId, record);
    },

    deliverEvent: remote.deliverEvent,
  };
}

// ─── Run and machine sync ─────────────────────────────────────────────────────

/**
 * Wire the domain stores' mirror hooks to the remote. From here on, every
 * saved run and compiled machine version is announced to the API,
 * fire-and-forget: a dead mirror slows nothing and erases nothing.
 */
export function wireMirrors(remote: RefiRemote, sessionId: () => string): void {
  setRunRecordMirror(record => {
    void remote.saveRunRecord(sessionId(), record);
  });
  setMachineVersionMirror(record => {
    void remote.saveMachineVersion(sessionId(), record);
  });
}

/**
 * One background pass: ask the mirror what it holds and adopt what local is
 * missing. Local resume, the Bronze gate and the builder never wait on this —
 * they read the synchronous stores immediately, and anything adopted here
 * appears on their next read. Errors leave local exactly as it was.
 */
export async function hydrateFromRemote(remote: RefiRemote, sessionId: string): Promise<void> {
  const [runs, machines] = await Promise.all([
    remote.loadRunRecords(sessionId),
    remote.loadMachineVersions(sessionId),
  ]);

  if (runs.kind === 'VALUE' && Array.isArray(runs.value)) {
    for (const record of runs.value) {
      noteRunOutcome(String(record?.runId ?? '?'), applyRemoteRun(record));
    }
  }

  if (machines.kind === 'VALUE' && Array.isArray(machines.value)) {
    for (const record of machines.value) {
      const key = `${String(record?.machineName ?? '?')} v${String(record?.version ?? '?')}`;
      noteMachineOutcome(key, applyRemoteMachineVersion(record));
    }
  }
}
