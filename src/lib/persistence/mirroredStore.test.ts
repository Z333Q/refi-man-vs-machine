import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import type { RefiRemote } from './refiApi';
import type { RemoteResult, ProfileSnapshot } from './types';
import { makeMirroredStore, hydrateFromRemote, wireMirrors, syncConflicts } from './mirroredStore';
import {
  clearRunRecords, getRunRecord, projectRun, saveRun, setRunRecordMirror,
  type RunRecord,
} from '../runRecord';
import {
  clearMachineVersions, getMachineVersion, saveMachineVersion, setMachineVersionMirror,
  type MachineVersionRecord,
} from '../machineVersions';
import { createInitialRun, commitDecisionCommand, advanceRunCheckpoint, attachThesis } from '../runEngine';
import type { RunState } from '../gameTypes';
import { DEFAULT_MACHINE_CONFIG, DEFAULT_GUARDRAILS } from '../gameTypes';
import '../arenaIndex';

// ─── The outage law ───────────────────────────────────────────────────────────
// The bug this file guards against: with a remote configured, a server outage
// used to read as an empty account. Every test here is some form of "the
// remote failing, lying, or holding nothing can never erase what this device
// holds."

// node has no localStorage; the same in-memory twin the other store tests use.
function installStorage() {
  let store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store = new Map(); },
  };
}
installStorage();

beforeEach(() => {
  (globalThis.localStorage as { clear(): void }).clear();
  clearRunRecords();
  clearMachineVersions();
  setRunRecordMirror(null);
  setMachineVersionMirror(null);
});

/** A remote whose every answer is scripted. Unscripted methods answer NETWORK_ERROR. */
function fakeRemote(overrides: Partial<RefiRemote> = {}): RefiRemote & {
  saved: { runs: RunRecord[]; machines: MachineVersionRecord[]; profiles: ProfileSnapshot[] };
} {
  const down = async <T>(): Promise<RemoteResult<T>> => ({ kind: 'NETWORK_ERROR' });
  const saved = {
    runs: [] as RunRecord[],
    machines: [] as MachineVersionRecord[],
    profiles: [] as ProfileSnapshot[],
  };
  return {
    saved,
    loadProfile: down,
    saveProfile: async (_s, p) => { saved.profiles.push(p); return { kind: 'VALUE', value: null }; },
    saveTipState: down,
    saveGuidanceMode: down,
    loadDailyTape: down,
    saveDailyTape: down,
    loadRunRecords: down,
    saveRunRecord: async (_s, r) => { saved.runs.push(r); return { kind: 'VALUE', value: null }; },
    loadMachineVersions: down,
    saveMachineVersion: async (_s, m) => { saved.machines.push(m); return { kind: 'VALUE', value: null }; },
    deliverEvent: async () => false,
    ...overrides,
  };
}

function runWith(n: number, id = 'run_local_0001'): RunState {
  let run: RunState = { ...createInitialRun(1234), id };
  for (let i = 0; i < n; i++) {
    const out = commitDecisionCommand(run, { action: 'HOLD', conviction: 50 });
    assert.ok(out);
    run = attachThesis(out.run, 'THESIS_UNCHANGED');
    run = advanceRunCheckpoint(run);
  }
  return run;
}

function machineCfg() {
  return { ...DEFAULT_MACHINE_CONFIG, guardrails: { ...DEFAULT_GUARDRAILS } };
}

const MODULES = ['UNIVERSE', 'SIGNAL'] as const;

// ─── Profile ──────────────────────────────────────────────────────────────────

test('a local profile answers immediately; the remote is only probed in the background', async () => {
  // A remote that never answers: if the local hit waited on it, this test
  // could not resolve.
  const never = new Promise<never>(() => {});
  const store = makeMirroredStore(fakeRemote({
    loadProfile: () => never as never,
  }));
  await store.saveProfile('ses_probe_slow', { alphaXp: 500 } as ProfileSnapshot);
  const back = await store.loadProfile('ses_probe_slow');
  assert.equal((back as { alphaXp: number } | null)?.alphaXp, 500,
    'local answers without waiting for the remote probe');
});

test('a local hit does not open the mirror by itself: an unanswered probe keeps saves local-only', async () => {
  const remote = fakeRemote({
    loadProfile: async () => ({ kind: 'NETWORK_ERROR' }),
  });
  const store = makeMirroredStore(remote);
  await store.saveProfile('ses_probe_err', { alphaXp: 10 } as ProfileSnapshot);
  await store.loadProfile('ses_probe_err');
  await new Promise(resolve => setImmediate(resolve));
  await store.saveProfile('ses_probe_err', { alphaXp: 20 } as ProfileSnapshot);
  assert.equal(remote.saved.profiles.length, 0,
    'a local profile alone must never count as having heard the server');
});

test('the background probe opens the mirror on NOT_FOUND', async () => {
  const remote = fakeRemote({
    loadProfile: async () => ({ kind: 'NOT_FOUND' }),
  });
  const store = makeMirroredStore(remote);
  await store.saveProfile('ses_probe_nf', { alphaXp: 10 } as ProfileSnapshot);
  await store.loadProfile('ses_probe_nf');
  await new Promise(resolve => setImmediate(resolve));
  await store.saveProfile('ses_probe_nf', { alphaXp: 20 } as ProfileSnapshot);
  assert.equal(remote.saved.profiles.length, 1, 'the server said "no profile": mirroring is safe');
});

test('a differing remote profile blocks the upward mirror; local is kept and the conflict surfaced', async () => {
  const remote = fakeRemote({
    loadProfile: async () => ({ kind: 'VALUE', value: { alphaXp: 999 } as ProfileSnapshot }),
  });
  const store = makeMirroredStore(remote);
  await store.saveProfile('ses_probe_diff', { alphaXp: 10 } as ProfileSnapshot);
  const back = await store.loadProfile('ses_probe_diff');
  assert.equal((back as { alphaXp: number } | null)?.alphaXp, 10, 'local is kept for gameplay');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(
    syncConflicts().some(c => c.kind === 'PROFILE' && c.key === 'ses_probe_diff'),
    'the divergence is surfaced, not swallowed',
  );
  await store.saveProfile('ses_probe_diff', { alphaXp: 20 } as ProfileSnapshot);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(remote.saved.profiles.length, 0,
    'a divergent remote must never be overwritten by an automatic upward mirror');
});

test('a remote profile canonically equal to local arms the mirror despite key order', async () => {
  const local = { alphaXp: 10, rankCode: 'ANALYST' } as unknown as ProfileSnapshot;
  // The same profile with reversed key insertion order: not a conflict.
  const reordered = { rankCode: 'ANALYST', alphaXp: 10 } as unknown as ProfileSnapshot;
  const remote = fakeRemote({
    loadProfile: async () => ({ kind: 'VALUE', value: reordered }),
  });
  const store = makeMirroredStore(remote);
  await store.saveProfile('ses_probe_eq', local);
  await store.loadProfile('ses_probe_eq');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(
    !syncConflicts().some(c => c.key === 'ses_probe_eq'),
    'object insertion order must not create a false conflict',
  );
  await store.saveProfile('ses_probe_eq', { ...local, alphaXp: 20 } as ProfileSnapshot);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(remote.saved.profiles.length, 1, 'equality arms the mirror');
});

test('a remote outage on a fresh device reads as nothing to hydrate, and holds profile mirroring', async () => {
  const remote = fakeRemote({
    loadProfile: async () => ({ kind: 'HTTP_ERROR', status: 503 }),
  });
  const store = makeMirroredStore(remote);

  assert.equal(await store.loadProfile('ses_outage'), null);
  await store.saveProfile('ses_outage', { alphaXp: 10 } as ProfileSnapshot);
  assert.equal(remote.saved.profiles.length, 0,
    'until the server has answered for this session, a default profile must not be pushed over the real one');
});

test('a remote NOT_FOUND is a real absence: mirroring proceeds', async () => {
  const remote = fakeRemote({
    loadProfile: async () => ({ kind: 'NOT_FOUND' }),
  });
  const store = makeMirroredStore(remote);
  assert.equal(await store.loadProfile('ses_new'), null);
  await store.saveProfile('ses_new', { alphaXp: 10 } as ProfileSnapshot);
  assert.equal(remote.saved.profiles.length, 1, 'the server said "no profile": pushing one is safe');
});

test('a remote profile fills a local gap and is kept locally afterwards', async () => {
  const remote = fakeRemote({
    loadProfile: async () => ({ kind: 'VALUE', value: { alphaXp: 777 } as ProfileSnapshot }),
  });
  const store = makeMirroredStore(remote);
  const first = await store.loadProfile('ses_b');
  assert.equal((first as { alphaXp: number } | null)?.alphaXp, 777);

  // Now held locally: a later outage changes nothing.
  const offline = makeMirroredStore(fakeRemote());
  const second = await offline.loadProfile('ses_b');
  assert.equal((second as { alphaXp: number } | null)?.alphaXp, 777);
});

test('profile saves land locally first and mirror after the server has been heard', async () => {
  const remote = fakeRemote({ loadProfile: async () => ({ kind: 'NOT_FOUND' }) });
  const store = makeMirroredStore(remote);
  await store.loadProfile('ses_c');
  await store.saveProfile('ses_c', { alphaXp: 42 } as ProfileSnapshot);
  const back = await store.loadProfile('ses_c');
  assert.equal((back as { alphaXp: number } | null)?.alphaXp, 42);
  assert.equal(remote.saved.profiles.length, 1);
});

// ─── Runs and machines ────────────────────────────────────────────────────────

test('an API 404 cannot erase a local run', async () => {
  saveRun(runWith(2), '2026-01-01T00:00:00.000Z');
  const remote = fakeRemote({
    loadRunRecords: async () => ({ kind: 'NOT_FOUND' }),
    loadMachineVersions: async () => ({ kind: 'NOT_FOUND' }),
  });
  await hydrateFromRemote(remote, 'ses_a');
  assert.equal(getRunRecord('run_local_0001')?.decisions.length, 2,
    'the server holding nothing must never read as this device holding nothing');
});

test('an API 500 cannot erase a local run', async () => {
  saveRun(runWith(2), '2026-01-01T00:00:00.000Z');
  const remote = fakeRemote({
    loadRunRecords: async () => ({ kind: 'HTTP_ERROR', status: 500 }),
    loadMachineVersions: async () => ({ kind: 'HTTP_ERROR', status: 500 }),
  });
  await hydrateFromRemote(remote, 'ses_a');
  assert.equal(getRunRecord('run_local_0001')?.decisions.length, 2);
});

test('a malformed remote payload cannot erase or corrupt local state', async () => {
  const localRun = saveRun(runWith(2), '2026-01-01T00:00:00.000Z');
  assert.ok(localRun);
  const garbage = [
    null,
    'not a record',
    { runId: 'run_local_0001' },                       // same id, no decisions
    { recordVersion: 99, runId: 'run_v99', decisions: [] },
  ] as unknown as RunRecord[];
  const remote = fakeRemote({
    loadRunRecords: async () => ({ kind: 'VALUE', value: garbage }),
    loadMachineVersions: async () => ({ kind: 'INVALID' }),
  });
  await hydrateFromRemote(remote, 'ses_a');
  assert.equal(getRunRecord('run_local_0001')?.decisions.length, 2,
    'garbage wearing a local run id must not displace the local run');
  assert.equal(getRunRecord('run_v99'), null, 'an unknown record version is refused, not stored');
});

test('a network error during hydration leaves local exactly as it was', async () => {
  saveRun(runWith(1), '2026-01-01T00:00:00.000Z');
  saveMachineVersion('M', machineCfg(), MODULES, '2026-01-01T00:00:00.000Z');
  await hydrateFromRemote(fakeRemote(), 'ses_a');
  assert.ok(getRunRecord('run_local_0001'));
  assert.ok(getMachineVersion('M', 1));
});

test('hydration adopts remote records only into local gaps', async () => {
  const localRun = saveRun(runWith(2), '2026-01-01T00:00:00.000Z');
  assert.ok(localRun);
  const gapRecord = projectRun(runWith(1, 'run_other_device'), '2026-01-05T00:00:00.000Z');
  assert.ok(gapRecord);
  const conflicting = { ...localRun, playerScore: localRun.playerScore + 5 };

  const remote = fakeRemote({
    loadRunRecords: async () => ({ kind: 'VALUE', value: [gapRecord, conflicting] }),
    loadMachineVersions: async () => ({ kind: 'NOT_FOUND' }),
  });
  await hydrateFromRemote(remote, 'ses_a');

  assert.ok(getRunRecord('run_other_device'), 'the gap is filled');
  assert.equal(getRunRecord('run_local_0001')?.playerScore, localRun.playerScore,
    'the conflicting remote record must not displace local');
  assert.ok(
    syncConflicts().some(c => c.kind === 'RUN' && c.key === 'run_local_0001'),
    'the conflict is surfaced, not swallowed',
  );
});

test('a run save completes without awaiting the remote, even one that never answers', () => {
  // A mirror whose promise never settles: if the save path awaited it, this
  // test could not reach its assertions.
  const never = new Promise<never>(() => {});
  wireMirrors(fakeRemote({
    saveRunRecord: () => never as never,
  }), () => 'ses_hang');

  const rec = saveRun(runWith(1), '2026-01-01T00:00:00.000Z');
  assert.ok(rec, 'saveRun returned synchronously');
  assert.equal(getRunRecord('run_local_0001')?.decisions.length, 1,
    'local durability is complete before the remote has answered');

  setRunRecordMirror(null);
  setMachineVersionMirror(null);
});

test('a machine compile completes without awaiting the remote, even one that never answers', () => {
  const never = new Promise<never>(() => {});
  wireMirrors(fakeRemote({
    saveMachineVersion: () => never as never,
  }), () => 'ses_hang');

  const rec = saveMachineVersion('M', machineCfg(), MODULES, '2026-01-01T00:00:00.000Z');
  assert.equal(rec.version, 1, 'the compile returned synchronously');
  assert.equal(getMachineVersion('M', 1)?.buildHash, rec.buildHash,
    'the version is readable before the remote has answered');

  setRunRecordMirror(null);
  setMachineVersionMirror(null);
});

test('mirror writes to one resource run strictly in call order', async () => {
  // Remote write 1 is held open; write 2 must not begin until it settles.
  const began: number[] = [];
  let releaseFirst: () => void = () => undefined;
  const firstHeld = new Promise<void>(resolve => { releaseFirst = resolve; });
  let callIndex = 0;
  const remote = fakeRemote({
    saveRunRecord: async () => {
      const n = ++callIndex;
      began.push(n);
      if (n === 1) await firstHeld;
      return { kind: 'VALUE', value: null };
    },
  });
  wireMirrors(remote, () => 'ses_queue');

  saveRun(runWith(1), '2026-01-01T00:00:00.000Z');
  saveRun(runWith(2), '2026-01-02T00:00:00.000Z');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(began, [1], 'write 2 must not begin while write 1 is in flight');

  releaseFirst();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(began, [1, 2], 'write 2 runs after write 1 settles');

  setRunRecordMirror(null);
  setMachineVersionMirror(null);
});

test('a failed mirror write does not block the writes queued behind it', async () => {
  const began: string[] = [];
  let calls = 0;
  const remote = fakeRemote({
    saveRunRecord: async (_s, r) => {
      calls += 1;
      began.push(r.updatedAt);
      if (calls === 1) throw new Error('mirror down');
      return { kind: 'VALUE', value: null };
    },
  });
  wireMirrors(remote, () => 'ses_queue_fail');

  saveRun(runWith(1), '2026-01-01T00:00:00.000Z');
  saveRun(runWith(2), '2026-01-02T00:00:00.000Z');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(began.length, 2, 'the queue advances past a failed task');

  setRunRecordMirror(null);
  setMachineVersionMirror(null);
});

test('wired mirrors announce run saves and machine compiles to the remote', async () => {
  const remote = fakeRemote();
  wireMirrors(remote, () => 'ses_wire');

  saveRun(runWith(1), '2026-01-01T00:00:00.000Z');
  saveMachineVersion('M', machineCfg(), MODULES, '2026-01-01T00:00:00.000Z');
  // The announcements are fire-and-forget promises; let them settle.
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(remote.saved.runs.length, 1);
  assert.equal(remote.saved.runs[0].runId, 'run_local_0001');
  assert.equal(remote.saved.machines.length, 1);
  assert.equal(remote.saved.machines[0].machineName, 'M');

  setRunRecordMirror(null);
  setMachineVersionMirror(null);
});
