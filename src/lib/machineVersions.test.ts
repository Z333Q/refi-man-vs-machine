import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_MACHINE_CONFIG, DEFAULT_GUARDRAILS } from './gameTypes';
import type { MachineConfig, MachineModuleId } from './gameTypes';
import {
  MACHINE_RECORD_VERSION, MAX_STORED_VERSIONS, applyRemoteMachineVersion,
  clearMachineVersions, getMachineVersion, isUnchangedFromLatest,
  latestMachineVersion, listMachineVersions, lockMachineVersion,
  machineBuildHash, nextVersionNumber, saveMachineVersion,
  setMachineVersionMirror, toPlayerMachine, versionLabel,
} from './machineVersions';

// A machine is meant to accumulate: §18 ends the builder tutorial on "EVERY
// CHANGE CREATES A NEW TESTABLE VERSION. BUILD. TEST. DIAGNOSE. REVISE." The
// builder held its config in component state, so a compiled machine existed
// until the screen unmounted and then did not, and there was nothing to revise.

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

const ALL_MODULES: MachineModuleId[] = [
  'UNIVERSE', 'ELIGIBILITY', 'SIGNAL', 'CONSTRUCTION',
  'GUARDRAILS', 'EXECUTION', 'MONITORING',
];

function cfg(overrides: Partial<MachineConfig> = {}): MachineConfig {
  return { ...DEFAULT_MACHINE_CONFIG, guardrails: { ...DEFAULT_GUARDRAILS }, ...overrides };
}

// ─── Build hash ───────────────────────────────────────────────────────────────

test('the same machine hashes the same way twice', () => {
  assert.equal(machineBuildHash(cfg(), ALL_MODULES), machineBuildHash(cfg(), ALL_MODULES));
});

test('a different configuration hashes differently', () => {
  // The old implementation hashed the version string, so this held for every
  // pair of machines at the same version number.
  const a = machineBuildHash(cfg(), ALL_MODULES);
  const b = machineBuildHash(cfg({ signal: 'RF_RL_PIPELINE' }), ALL_MODULES);
  assert.notEqual(a, b, 'changing the signal layer must change the build');
});

test('a changed guardrail changes the build, however deep it sits', () => {
  const a = machineBuildHash(cfg(), ALL_MODULES);
  const b = machineBuildHash(
    cfg({ guardrails: { ...DEFAULT_GUARDRAILS, maxPositionPct: 0.05 } }),
    ALL_MODULES,
  );
  assert.notEqual(a, b);
});

test('key order does not change the hash', () => {
  // Same values, different insertion order. A hash that moved here would
  // depend on which edit produced the object rather than on what it holds.
  const forward = cfg();
  const reordered = Object.fromEntries(
    Object.entries(forward).reverse(),
  ) as unknown as MachineConfig;
  assert.equal(machineBuildHash(forward, ALL_MODULES), machineBuildHash(reordered, ALL_MODULES));
});

test('module order does not change the hash: a set is a set', () => {
  const a = machineBuildHash(cfg(), ALL_MODULES);
  const b = machineBuildHash(cfg(), [...ALL_MODULES].reverse());
  assert.equal(a, b);
});

test('installing a module changes the hash', () => {
  const a = machineBuildHash(cfg(), ['UNIVERSE']);
  const b = machineBuildHash(cfg(), ['UNIVERSE', 'SIGNAL']);
  assert.notEqual(a, b);
});

test('the hash is shaped for the compile display', () => {
  assert.match(machineBuildHash(cfg(), ALL_MODULES), /^[0-9A-F]{4}:[0-9A-F]{4}:[0-9A-F]{4}$/);
});

// ─── Versioning ───────────────────────────────────────────────────────────────

test('a compiled version survives being stored and read back', () => {
  clearMachineVersions();
  const rec = saveMachineVersion('PLAYER MACHINE', cfg(), ALL_MODULES, '2026-01-01T00:00:00.000Z');
  assert.equal(rec.version, 1);
  assert.equal(rec.recordVersion, MACHINE_RECORD_VERSION);
  const back = getMachineVersion('PLAYER MACHINE', 1);
  assert.ok(back);
  assert.equal(back.buildHash, rec.buildHash);
});

test('each real change earns the next version number', () => {
  clearMachineVersions();
  saveMachineVersion('M', cfg(), ALL_MODULES);
  const second = saveMachineVersion('M', cfg({ signal: 'RF_RL_PIPELINE' }), ALL_MODULES);
  const third = saveMachineVersion('M', cfg({ signal: 'QUALITY_FACTOR' }), ALL_MODULES);
  assert.equal(second.version, 2);
  assert.equal(third.version, 3);
  assert.equal(listMachineVersions('M').length, 3);
});

test('recompiling an unchanged machine does not consume a version', () => {
  // §18: more activity is not the same as better activity. A history that
  // counts button presses stops describing the evolution of a machine.
  clearMachineVersions();
  const first = saveMachineVersion('M', cfg(), ALL_MODULES);
  const again = saveMachineVersion('M', cfg(), ALL_MODULES);
  assert.equal(again.version, first.version);
  assert.equal(listMachineVersions('M').length, 1);
  assert.equal(isUnchangedFromLatest('M', cfg(), ALL_MODULES), true);
});

test('an unchanged check on a machine with no history is false, not a crash', () => {
  clearMachineVersions();
  assert.equal(isUnchangedFromLatest('NEVER_BUILT', cfg(), ALL_MODULES), false);
});

test('the next version number is predicted from the store, not a component counter', () => {
  clearMachineVersions();
  assert.equal(nextVersionNumber('M'), 1);
  saveMachineVersion('M', cfg(), ALL_MODULES);
  assert.equal(nextVersionNumber('M'), 2);
});

test('history is newest first, and scoped to its machine', () => {
  clearMachineVersions();
  saveMachineVersion('A', cfg(), ALL_MODULES);
  saveMachineVersion('A', cfg({ signal: 'RF_RL_PIPELINE' }), ALL_MODULES);
  saveMachineVersion('B', cfg(), ALL_MODULES);
  const a = listMachineVersions('A');
  assert.equal(a.length, 2);
  assert.equal(a[0].version, 2, 'newest first');
  assert.equal(listMachineVersions('B').length, 1);
});

test('the store is capped', () => {
  clearMachineVersions();
  for (let i = 0; i < MAX_STORED_VERSIONS + 5; i++) {
    saveMachineVersion('M', cfg({ guardrails: { ...DEFAULT_GUARDRAILS, maxPositionPct: 0.01 + i / 1000 } }), ALL_MODULES);
  }
  assert.ok(listMachineVersions('M').length <= MAX_STORED_VERSIONS);
});

test('locking is recorded, and locking twice does not move the timestamp', () => {
  clearMachineVersions();
  saveMachineVersion('M', cfg(), ALL_MODULES);
  const locked = lockMachineVersion('M', 1, '2026-02-02T00:00:00.000Z');
  assert.equal(locked?.lockedAt, '2026-02-02T00:00:00.000Z');
  const again = lockMachineVersion('M', 1, '2026-09-09T00:00:00.000Z');
  assert.equal(again?.lockedAt, '2026-02-02T00:00:00.000Z', 'a locked build is a fixed record');
});

test('locking a version that does not exist reports failure rather than inventing one', () => {
  clearMachineVersions();
  assert.equal(lockMachineVersion('M', 99), null);
});

test('records from an older shape are dropped, not half-read', () => {
  clearMachineVersions();
  localStorage.setItem(
    'refi_machine_versions',
    JSON.stringify([{ recordVersion: MACHINE_RECORD_VERSION - 1, machineName: 'M', version: 1 }]),
  );
  assert.equal(listMachineVersions('M').length, 0);
});

test('corrupt storage reads as empty', () => {
  clearMachineVersions();
  localStorage.setItem('refi_machine_versions', 'not json');
  assert.deepEqual(listMachineVersions(), []);
});

// ─── Interop ──────────────────────────────────────────────────────────────────

test('version labels match the builder: 1 is v0.1 and 10 is v1.0', () => {
  assert.equal(versionLabel(1), 'v0.1');
  assert.equal(versionLabel(9), 'v0.9');
  assert.equal(versionLabel(10), 'v1.0');
  assert.equal(versionLabel(12), 'v1.2');
});

test('a stored version converts to the machine the rest of the game passes around', () => {
  clearMachineVersions();
  const rec = saveMachineVersion('M', cfg(), ALL_MODULES, '2026-01-01T00:00:00.000Z');
  const machine = toPlayerMachine(rec);
  assert.equal(machine.name, 'M');
  assert.equal(machine.versionNumber, 1);
  assert.equal(machine.version, 'v0.1');
  assert.equal(machine.compiledAt, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(machine.installedModules, rec.installedModules);
});

test('the serialized record names no identity: no alpha_player_id, no session_id, no owner', () => {
  clearMachineVersions();
  const rec = saveMachineVersion('M', cfg(), ALL_MODULES, '2026-01-01T00:00:00.000Z');
  const wire = JSON.stringify(rec);
  for (const field of ['alpha_player_id', 'session_id', 'owner_id', 'alphaPlayerId', 'sessionId']) {
    assert.ok(!wire.includes(field),
      `${field} must not travel in the record; identity is the transport header's job`);
  }
});

// ─── Remote mirror ────────────────────────────────────────────────────────────

test('a save is announced to the mirror, and a failing mirror never reaches the compile', () => {
  clearMachineVersions();
  const announced: string[] = [];
  setMachineVersionMirror(r => { announced.push(`${r.machineName} v${r.version}`); });
  saveMachineVersion('M', cfg(), ALL_MODULES, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(announced, ['M v1']);

  setMachineVersionMirror(() => { throw new Error('mirror down'); });
  assert.doesNotThrow(() =>
    saveMachineVersion('M', cfg({ signal: 'RF_RL_PIPELINE' }), ALL_MODULES));
  setMachineVersionMirror(null);
});

test('locking a version is announced to the mirror', () => {
  clearMachineVersions();
  const announced: Array<string | null> = [];
  saveMachineVersion('M', cfg(), ALL_MODULES, '2026-01-01T00:00:00.000Z');
  setMachineVersionMirror(r => { announced.push(r.lockedAt); });
  lockMachineVersion('M', 1, '2026-01-02T00:00:00.000Z');
  assert.deepEqual(announced, ['2026-01-02T00:00:00.000Z']);
  setMachineVersionMirror(null);
});

test('a remote version fills a local gap and nothing else', () => {
  clearMachineVersions();
  const rec = saveMachineVersion('M', cfg(), ALL_MODULES, '2026-01-01T00:00:00.000Z');
  clearMachineVersions();

  assert.equal(applyRemoteMachineVersion(rec).kind, 'ADOPTED');
  assert.equal(getMachineVersion('M', 1)?.buildHash, rec.buildHash);
  // Offering it again finds local already holds it: local is kept.
  assert.equal(applyRemoteMachineVersion(rec).kind, 'LOCAL_KEPT');
});

test('same name and version with a different build hash is refused as a conflict', () => {
  clearMachineVersions();
  const local = saveMachineVersion('M', cfg(), ALL_MODULES, '2026-01-01T00:00:00.000Z');
  const otherConfig = cfg({ signal: 'RF_RL_PIPELINE' });
  const remote = {
    ...local,
    config: otherConfig,
    buildHash: machineBuildHash(otherConfig, ALL_MODULES),
  };

  const outcome = applyRemoteMachineVersion(remote);
  assert.equal(outcome.kind, 'CONFLICT');
  assert.equal(getMachineVersion('M', 1)?.buildHash, local.buildHash,
    'local must be kept; a version number that meant two builds poisons the record');
  if (outcome.kind === 'CONFLICT') {
    assert.equal(outcome.remote.buildHash, remote.buildHash,
      'the conflicting remote build is preserved in the outcome, not dropped');
  }
});

test('same build with diverging metadata: no field merge, local unchanged, divergence reported', () => {
  clearMachineVersions();
  const local = saveMachineVersion('M', cfg(), ALL_MODULES, '2026-01-01T00:00:00.000Z');
  assert.equal(local.lockedAt, null);

  // The same build as seen by another device: locked there, stress-tested there.
  const remote = {
    ...local,
    lockedAt: '2026-01-02T00:00:00.000Z',
    arenasCompleted: ['covid_black_swan'],
  };

  const outcome = applyRemoteMachineVersion(remote);
  assert.equal(outcome.kind, 'METADATA_DIVERGENCE');

  const kept = getMachineVersion('M', 1);
  assert.ok(kept);
  assert.equal(kept.lockedAt, null,
    'a lockedAt must not be adopted from remote; that would be a field merge');
  assert.deepEqual(kept.arenasCompleted, [],
    'arenasCompleted must not be unioned; anonymous-session persistence has no merge authority');
  if (outcome.kind === 'METADATA_DIVERGENCE') {
    assert.equal(outcome.remote.lockedAt, '2026-01-02T00:00:00.000Z',
      'the diverging remote record is preserved in the outcome, not dropped');
  }
});

test('a remote record whose hash does not match its own contents is refused', () => {
  clearMachineVersions();
  const rec = saveMachineVersion('M', cfg(), ALL_MODULES, '2026-01-01T00:00:00.000Z');
  clearMachineVersions();
  const tampered = { ...rec, buildHash: '0000:0000:0000' };
  assert.equal(applyRemoteMachineVersion(tampered).kind, 'REFUSED');
  assert.equal(getMachineVersion('M', 1), null, 'a refused record must not be stored');
});

test('the latest version is what a returning builder reopens', () => {
  clearMachineVersions();
  saveMachineVersion('M', cfg(), ALL_MODULES);
  saveMachineVersion('M', cfg({ execution: 'INTRADAY_1H' }), ALL_MODULES);
  const latest = latestMachineVersion('M');
  assert.equal(latest?.version, 2);
  assert.equal(latest?.config.execution, 'INTRADAY_1H');
});
