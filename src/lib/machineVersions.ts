// ─── Machine versions ─────────────────────────────────────────────────────────
//
// §17 calls the Machine Builder the central progression system, and §18 ends
// it on "EVERY CHANGE CREATES A NEW TESTABLE VERSION. BUILD. TEST. DIAGNOSE.
// REVISE." None of that was true: the builder held its config in local
// component state, so a compiled machine existed until the screen unmounted
// and then did not. `player_machine_versions` has been in the schema since the
// canonical-objects migration with nothing writing to it.
//
// Storage is local and synchronous for the same reason the Run Record is (see
// runRecord.ts): the builder reads it in render and a compile must be durable
// the moment the button is released. Local is authoritative on this device; a
// configured remote is a mirror that hears about writes through the hook below
// and may fill gaps through applyRemoteMachineVersion, never overwrite.

import type { MachineConfig, MachineModuleId, PlayerMachine } from './gameTypes';

/** Bumped when the record shape changes in a way a reader must notice. */
export const MACHINE_RECORD_VERSION = 1;

/** How many versions to keep. A machine's history is the point of versioning. */
export const MAX_STORED_VERSIONS = 50;

const STORE_KEY = 'refi_machine_versions';

// ─── Build hash ───────────────────────────────────────────────────────────────

/**
 * Canonical JSON: object keys in sorted order at every depth.
 *
 * Without this the hash would depend on key insertion order, so the same
 * machine could hash two ways depending on which edit produced it, which
 * defeats the entire point of a build hash.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/** FNV-1a, 32-bit. Not cryptographic; this identifies a build, it does not protect one. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The build hash for a machine, derived from what the machine actually is.
 *
 * The previous implementation hashed the version *string*, so every player's
 * v0.3 shared a hash and changing every guardrail changed nothing. A build
 * hash that does not move when the build moves is worse than none: it invites
 * exactly the trust §57 is trying to earn and then does not deserve it.
 *
 * Two machines hash the same if and only if their configuration and installed
 * modules match. Module order does not count; a set is a set.
 */
export function machineBuildHash(
  config: MachineConfig,
  installedModules: readonly MachineModuleId[],
): string {
  const payload = canonical({
    config,
    modules: [...installedModules].sort(),
  });
  const a = fnv1a(payload);
  const b = fnv1a(`${payload}:1`);
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(8, '0');
  const all = hex(a) + hex(b);
  return `${all.slice(0, 4)}:${all.slice(4, 8)}:${all.slice(8, 12)}`;
}

// ─── Shape ────────────────────────────────────────────────────────────────────

/** One compiled machine version. Mirrors `player_machine_versions`. */
export interface MachineVersionRecord {
  recordVersion: number;
  machineId: string;
  machineName: string;
  /** 1, 2, 3 … rendered as v0.1, v0.2 … by versionString. */
  version: number;
  config: MachineConfig;
  installedModules: MachineModuleId[];
  buildHash: string;
  createdAt: string;
  /** Set when the player locks the version (§18 "LOCK v0.1"). */
  lockedAt: string | null;
  /** Arenas this exact build has been stress-tested against. */
  arenasCompleted: string[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

function readAll(): MachineVersionRecord[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as MachineVersionRecord[]).filter(
      r => r && typeof r === 'object' && r.recordVersion === MACHINE_RECORD_VERSION,
    );
  } catch {
    return [];
  }
}

function writeAll(records: MachineVersionRecord[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(records.slice(0, MAX_STORED_VERSIONS)));
  } catch {
    // Storage unavailable. A version that cannot be stored must not stop the
    // player compiling one.
  }
}

/** Newest version first. */
export function listMachineVersions(machineName?: string): MachineVersionRecord[] {
  const all = readAll();
  const scoped = machineName ? all.filter(r => r.machineName === machineName) : all;
  return scoped.sort((a, b) => b.version - a.version);
}

export function latestMachineVersion(machineName?: string): MachineVersionRecord | null {
  return listMachineVersions(machineName)[0] ?? null;
}

export function getMachineVersion(machineName: string, version: number): MachineVersionRecord | null {
  return readAll().find(r => r.machineName === machineName && r.version === version) ?? null;
}

/** The number the next compile of this machine will carry. */
export function nextVersionNumber(machineName: string): number {
  return (latestMachineVersion(machineName)?.version ?? 0) + 1;
}

/**
 * Whether this configuration differs from the newest stored version.
 *
 * "More activity is not the same as better activity" (§18). A compile that
 * changes nothing should not consume a version number, or the history stops
 * describing the evolution of a machine and starts counting button presses.
 */
export function isUnchangedFromLatest(
  machineName: string,
  config: MachineConfig,
  installedModules: readonly MachineModuleId[],
): boolean {
  const latest = latestMachineVersion(machineName);
  if (!latest) return false;
  return latest.buildHash === machineBuildHash(config, installedModules);
}

/**
 * Store a compiled version.
 *
 * Returns the record written, or the existing one when the configuration is
 * byte-identical to the newest version — recompiling an unchanged machine is
 * not a new version of it.
 */
export function saveMachineVersion(
  machineName: string,
  config: MachineConfig,
  installedModules: readonly MachineModuleId[],
  now: string = new Date().toISOString(),
): MachineVersionRecord {
  const buildHash = machineBuildHash(config, installedModules);
  const latest = latestMachineVersion(machineName);
  if (latest && latest.buildHash === buildHash) return latest;

  const record: MachineVersionRecord = {
    recordVersion: MACHINE_RECORD_VERSION,
    machineId: `mch_${buildHash.replace(/:/g, '').toLowerCase()}`,
    machineName,
    version: (latest?.version ?? 0) + 1,
    config,
    installedModules: [...installedModules],
    buildHash,
    createdAt: now,
    lockedAt: null,
    arenasCompleted: [],
  };

  writeAll([record, ...readAll()].sort((a, b) => b.version - a.version));
  announceToMirror(record);
  return record;
}

/** Lock a version (§18). Locking is one-way; a locked build is a fixed record. */
export function lockMachineVersion(
  machineName: string,
  version: number,
  now: string = new Date().toISOString(),
): MachineVersionRecord | null {
  const all = readAll();
  const idx = all.findIndex(r => r.machineName === machineName && r.version === version);
  if (idx < 0) return null;
  if (all[idx].lockedAt) return all[idx];

  const locked = { ...all[idx], lockedAt: now };
  all[idx] = locked;
  writeAll(all);
  announceToMirror(locked);
  return locked;
}

export function clearMachineVersions(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // See writeAll.
  }
}

// ─── Interop ──────────────────────────────────────────────────────────────────

/** Render a version number the way the builder shows it: 1 → "v0.1", 10 → "v1.0". */
export function versionLabel(version: number): string {
  return `v${Math.floor(version / 10)}.${version % 10}`;
}

/** A stored version as the in-memory machine the rest of the game passes around. */
export function toPlayerMachine(record: MachineVersionRecord): PlayerMachine {
  return {
    machineId: record.machineId,
    name: record.machineName,
    version: versionLabel(record.version),
    versionNumber: record.version,
    config: record.config,
    compiledAt: record.createdAt,
    installedModules: record.installedModules,
    arenasCompleted: record.arenasCompleted,
  };
}

// ─── Remote mirror ────────────────────────────────────────────────────────────
//
// Same arrangement as the Run Record: local is authoritative, the remote is a
// mirror announced to on write and consulted only to fill gaps. The hook
// indirection keeps this module free of the persistence port.

let mirror: ((record: MachineVersionRecord) => void) | null = null;

/** Install the fire-and-forget announcer. Pass null to detach (tests). */
export function setMachineVersionMirror(
  fn: ((record: MachineVersionRecord) => void) | null,
): void {
  mirror = fn;
}

function announceToMirror(record: MachineVersionRecord): void {
  try {
    mirror?.(record);
  } catch {
    // Best-effort by contract; a failing mirror must never reach the compile.
  }
}

/** What became of one remote machine version offered to the local store. */
export type RemoteMachineOutcome =
  /** The (machine, version) was a local gap; it is now stored. */
  | { kind: 'ADOPTED' }
  /** Local already holds this identical record; local is kept unchanged. */
  | { kind: 'LOCAL_KEPT' }
  /** Same build, but persisted metadata (lockedAt, arenasCompleted, …)
   *  differs. This layer is anonymous-session persistence, not multi-device
   *  merge: local is kept unchanged, nothing is field-merged, and the
   *  divergence is reported as a diagnostic. */
  | { kind: 'METADATA_DIVERGENCE'; local: MachineVersionRecord; remote: MachineVersionRecord }
  /** Local holds the same machine name and version with a DIFFERENT build
   *  hash: two histories claim the same version number. Refused outright —
   *  a version number that meant two builds would poison the whole record.
   *  Local is kept; the remote build is preserved in the outcome. */
  | { kind: 'CONFLICT'; local: MachineVersionRecord; remote: MachineVersionRecord }
  /** The remote payload was not a usable machine version record. */
  | { kind: 'REFUSED'; reason: string };

/**
 * Offer one remote machine version to the local store: local-authoritative
 * gap hydration. The build hash is recomputed from the remote configuration
 * before anything is adopted — a record whose stored hash does not match its
 * own contents is refused, because the hash is the identity everything else
 * (machineId, conflict detection, §57 trust copy) hangs from.
 */
export function applyRemoteMachineVersion(remote: MachineVersionRecord): RemoteMachineOutcome {
  if (!remote || typeof remote !== 'object'
      || typeof remote.machineName !== 'string' || !remote.machineName
      || typeof remote.version !== 'number'
      || !remote.config || typeof remote.config !== 'object'
      || !Array.isArray(remote.installedModules)) {
    return { kind: 'REFUSED', reason: 'not a machine version record' };
  }
  if (remote.recordVersion !== MACHINE_RECORD_VERSION) {
    return { kind: 'REFUSED', reason: `unknown record version ${String(remote.recordVersion)}` };
  }
  if (machineBuildHash(remote.config, remote.installedModules) !== remote.buildHash) {
    return { kind: 'REFUSED', reason: 'build hash does not match configuration' };
  }

  const local = getMachineVersion(remote.machineName, remote.version);
  if (!local) {
    writeAll([remote, ...readAll()].sort((a, b) => b.version - a.version));
    return { kind: 'ADOPTED' };
  }
  if (local.buildHash !== remote.buildHash) return { kind: 'CONFLICT', local, remote };
  // Same build. Identical means identical in full, not merely hash-equal:
  // lockedAt and arenasCompleted are persisted history too, and a divergence
  // there is preserved and reported rather than merged by any rule.
  if (JSON.stringify(local) === JSON.stringify(remote)) return { kind: 'LOCAL_KEPT' };
  return { kind: 'METADATA_DIVERGENCE', local, remote };
}
