// ─── Wire contract ────────────────────────────────────────────────────────────
//
// What the browser sends is the domain record, verbatim (Step 7 removed the
// client-side SQL serializers on purpose). This service owns both directions
// of the mapping — domain object -> PostgreSQL row, and row -> validated
// domain object — so this file is where the wire shapes are checked,
// fail-closed: a payload that does not parse into the domain shape is a 400,
// never a partial row.
//
// The shapes mirror src/lib/runRecord.ts, src/lib/machineVersions.ts and
// src/lib/persistence/types.ts in the game client. They are restated here
// rather than imported because the service is its own package and, more
// importantly, because server-side validation must not be definitionally
// identical to whatever the client happens to claim.

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The record shape version the client writes today (see runRecord.ts). */
export const RUN_RECORD_VERSION = 2;
export const MACHINE_RECORD_VERSION = 1;

export interface WireDecision {
  checkpointSequence: number;
  actionCode: string;
  thesisCode: string | null;
  confidence: number | null;
  modulesConsulted: string[];
  turnoverCost: number;
  scoreContribution: number;
  quality: string;
  behavioralFlags: string[];
  machineActionCode: string;
  /** Null only for decisions migrated from v1 records, whose commit time was
   *  never captured. A newly authored decision carries a real timestamp; the
   *  server never invents one (the column deliberately has no default). */
  committedAt: string | null;
}

export interface WireRunRecord {
  recordVersion: number;
  runId: string;
  seed: number;
  arenaId: string;
  machineId: string;
  state: string;
  result: string | null;
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
  decisions: WireDecision[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface WireMachineVersion {
  recordVersion: number;
  machineId: string;
  machineName: string;
  version: number;
  config: Record<string, unknown>;
  installedModules: string[];
  buildHash: string;
  createdAt: string;
  lockedAt: string | null;
  arenasCompleted: string[];
}

export interface WireProfile {
  handle: string | null;
  alphaXp: number;
  rankCode: string;
  machineBeats: number;
  machineAttempts: number;
  currentStreak: number;
  bestStreak: number;
  archetype: string | null;
  decisionStreak: number;
  lastActiveDate: string | null;
  dimensions: Record<string, { score: number; sampleSize: number }>;
  unlockedModules: string[];
  machineLadder: Record<
    string,
    { wins: number; losses: number; status: 'LOCKED' | 'ACTIVE' | 'DEFEATED' }
  >;
}

export interface WireTip {
  tipCode: string;
  state: string;
  lastShownAt?: string;
  completedAt?: string;
}

export interface WireTape {
  tapeDate: string;
  tapeId: string;
  playerAction: string;
  score: number;
}

export interface WireEvent {
  event_id: string;
  event_type: string;
  event_version: number;
  occurred_at: string;
  alpha_player_id?: string | null;
  formal_user_id?: string | null;
  session_id?: string | null;
  arena_id?: string | null;
  run_id?: string | null;
  checkpoint_id?: string | null;
  simulation_timestamp?: string | null;
  correlation_id?: string | null;
  causation_id?: string | null;
  payload?: Record<string, unknown>;
}

// ─── Primitive checks ─────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function bad(field: string): never {
  throw new HttpError(400, `invalid or missing field: ${field}`);
}

function str(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  if (typeof v !== 'string' || v.length === 0) bad(k);
  return v;
}

function strOrNull(o: Record<string, unknown>, k: string): string | null {
  const v = o[k];
  if (v === null) return null;
  if (typeof v !== 'string') bad(k);
  return v;
}

function num(o: Record<string, unknown>, k: string): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v)) bad(k);
  return v;
}

function numOrNull(o: Record<string, unknown>, k: string): number | null {
  const v = o[k];
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) bad(k);
  return v;
}

function bool(o: Record<string, unknown>, k: string): boolean {
  const v = o[k];
  if (typeof v !== 'boolean') bad(k);
  return v;
}

function strArray(o: Record<string, unknown>, k: string): string[] {
  const v = o[k];
  if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) bad(k);
  return v as string[];
}

function isoDate(o: Record<string, unknown>, k: string): string {
  const v = str(o, k);
  if (Number.isNaN(Date.parse(v))) bad(k);
  return v;
}

function isoDateOrNull(o: Record<string, unknown>, k: string): string | null {
  const v = strOrNull(o, k);
  if (v !== null && Number.isNaN(Date.parse(v))) bad(k);
  return v;
}

// The client mints run ids as run_<24 hex> (see events.ts mkId); the fixture
// ids in tests follow the same shape. Anything else is not a run this system
// minted.
const RUN_ID = /^run_[0-9a-z_]{1,64}$/i;
const SESSION_ID = /^[\w.:-]{1,128}$/;
const BUILD_HASH = /^[0-9A-F]{4}:[0-9A-F]{4}:[0-9A-F]{4}$/;

export function validSessionId(value: unknown): string {
  if (typeof value !== 'string' || !SESSION_ID.test(value)) {
    throw new HttpError(400, 'x-alpha-session header is required');
  }
  return value;
}

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateRunRecord(body: unknown, runIdFromUrl: string): WireRunRecord {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a run record');
  if (body['recordVersion'] !== RUN_RECORD_VERSION) {
    throw new HttpError(400, `unsupported recordVersion (expected ${String(RUN_RECORD_VERSION)})`);
  }
  const runId = str(body, 'runId');
  if (!RUN_ID.test(runId)) bad('runId');
  if (runId !== runIdFromUrl) {
    throw new HttpError(400, 'runId in body does not match the URL');
  }
  const decisionsRaw = body['decisions'];
  if (!Array.isArray(decisionsRaw)) bad('decisions');

  const decisions = decisionsRaw.map((d: unknown, i: number): WireDecision => {
    if (!isRecord(d)) bad(`decisions[${String(i)}]`);
    // committedAt must be PRESENT: string for a decision authored under v2,
    // null only for one migrated from v1. An absent key is a client that has
    // not adopted the provenance contract, and accepting it would let new
    // decisions silently lose their commit time.
    if (!('committedAt' in d)) bad(`decisions[${String(i)}].committedAt`);
    return {
      checkpointSequence: num(d, 'checkpointSequence'),
      actionCode: str(d, 'actionCode'),
      thesisCode: strOrNull(d, 'thesisCode'),
      confidence: numOrNull(d, 'confidence'),
      modulesConsulted: strArray(d, 'modulesConsulted'),
      turnoverCost: num(d, 'turnoverCost'),
      scoreContribution: num(d, 'scoreContribution'),
      quality: str(d, 'quality'),
      behavioralFlags: strArray(d, 'behavioralFlags'),
      machineActionCode: str(d, 'machineActionCode'),
      committedAt: isoDateOrNull(d, 'committedAt'),
    };
  });

  return {
    recordVersion: RUN_RECORD_VERSION,
    runId,
    seed: num(body, 'seed'),
    arenaId: str(body, 'arenaId'),
    machineId: str(body, 'machineId'),
    state: str(body, 'state'),
    result: strOrNull(body, 'result'),
    currentCheckpoint: num(body, 'currentCheckpoint'),
    totalCheckpoints: num(body, 'totalCheckpoints'),
    playerScore: num(body, 'playerScore'),
    machineScore: num(body, 'machineScore'),
    criticalFailure: bool(body, 'criticalFailure'),
    criticalFailureCheckpoint: numOrNull(body, 'criticalFailureCheckpoint'),
    portfolioValue: num(body, 'portfolioValue'),
    cashWeight: num(body, 'cashWeight'),
    drawdown: num(body, 'drawdown'),
    volatility: num(body, 'volatility'),
    turnoverUsed: num(body, 'turnoverUsed'),
    decisions,
    startedAt: isoDate(body, 'startedAt'),
    updatedAt: isoDate(body, 'updatedAt'),
    completedAt: isoDateOrNull(body, 'completedAt'),
  };
}

export function validateMachineVersion(
  body: unknown,
  nameFromUrl: string,
  versionFromUrl: number,
): WireMachineVersion {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a machine version record');
  if (body['recordVersion'] !== MACHINE_RECORD_VERSION) {
    throw new HttpError(400, `unsupported recordVersion (expected ${String(MACHINE_RECORD_VERSION)})`);
  }
  const machineName = str(body, 'machineName');
  const version = num(body, 'version');
  if (machineName !== nameFromUrl || version !== versionFromUrl) {
    throw new HttpError(400, 'machineName/version in body do not match the URL');
  }
  if (!Number.isInteger(version) || version < 1) bad('version');
  const config = body['config'];
  if (!isRecord(config)) bad('config');
  const buildHash = str(body, 'buildHash');
  if (!BUILD_HASH.test(buildHash)) bad('buildHash');

  return {
    recordVersion: MACHINE_RECORD_VERSION,
    machineId: str(body, 'machineId'),
    machineName,
    version,
    config,
    installedModules: strArray(body, 'installedModules'),
    buildHash,
    createdAt: isoDate(body, 'createdAt'),
    lockedAt: isoDateOrNull(body, 'lockedAt'),
    arenasCompleted: strArray(body, 'arenasCompleted'),
  };
}

export function validateProfile(body: unknown): WireProfile {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a profile snapshot');

  const dimensionsRaw = body['dimensions'];
  if (!isRecord(dimensionsRaw)) bad('dimensions');
  const dimensions: WireProfile['dimensions'] = {};
  for (const [code, v] of Object.entries(dimensionsRaw)) {
    if (!isRecord(v)) bad(`dimensions.${code}`);
    dimensions[code] = { score: num(v, 'score'), sampleSize: num(v, 'sampleSize') };
  }

  const ladderRaw = body['machineLadder'];
  if (!isRecord(ladderRaw)) bad('machineLadder');
  const machineLadder: WireProfile['machineLadder'] = {};
  for (const [machineId, v] of Object.entries(ladderRaw)) {
    if (!isRecord(v)) bad(`machineLadder.${machineId}`);
    const status = str(v, 'status');
    if (status !== 'LOCKED' && status !== 'ACTIVE' && status !== 'DEFEATED') {
      bad(`machineLadder.${machineId}.status`);
    }
    machineLadder[machineId] = { wins: num(v, 'wins'), losses: num(v, 'losses'), status };
  }

  return {
    handle: strOrNull(body, 'handle'),
    alphaXp: num(body, 'alphaXp'),
    rankCode: str(body, 'rankCode'),
    machineBeats: num(body, 'machineBeats'),
    machineAttempts: num(body, 'machineAttempts'),
    currentStreak: num(body, 'currentStreak'),
    bestStreak: num(body, 'bestStreak'),
    archetype: strOrNull(body, 'archetype'),
    decisionStreak: num(body, 'decisionStreak'),
    lastActiveDate: strOrNull(body, 'lastActiveDate'),
    dimensions,
    unlockedModules: strArray(body, 'unlockedModules'),
    machineLadder,
  };
}

const TIP_STATES = new Set(['UNSEEN', 'SHOWN', 'SNOOZED', 'DISMISSED', 'COMPLETED']);
const GUIDANCE_MODES = new Set(['FULL', 'STANDARD', 'MINIMAL', 'OFF']);

export function validateTip(body: unknown): WireTip {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a tip record');
  const state = str(body, 'state');
  if (!TIP_STATES.has(state)) bad('state');
  const tip: WireTip = { tipCode: str(body, 'tipCode'), state };
  if (body['lastShownAt'] !== undefined && body['lastShownAt'] !== null) {
    tip.lastShownAt = isoDate(body, 'lastShownAt');
  }
  if (body['completedAt'] !== undefined && body['completedAt'] !== null) {
    tip.completedAt = isoDate(body, 'completedAt');
  }
  return tip;
}

export function validateGuidance(body: unknown): string {
  if (!isRecord(body)) throw new HttpError(400, 'body must be { mode }');
  const mode = str(body, 'mode');
  if (!GUIDANCE_MODES.has(mode)) bad('mode');
  return mode;
}

const TAPE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateTape(body: unknown): WireTape {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a daily tape submission');
  const tapeDate = str(body, 'tapeDate');
  if (!TAPE_DATE.test(tapeDate)) bad('tapeDate');
  return {
    tapeDate,
    tapeId: str(body, 'tapeId'),
    playerAction: str(body, 'playerAction'),
    score: num(body, 'score'),
  };
}

export function validateEvent(body: unknown): WireEvent {
  if (!isRecord(body)) throw new HttpError(400, 'body must be an event envelope');
  const optional = (k: string): string | null => {
    const v = body[k];
    if (v === undefined || v === null) return null;
    if (typeof v !== 'string') bad(k);
    return v;
  };
  const payload = body['payload'];
  return {
    event_id: str(body, 'event_id'),
    event_type: str(body, 'event_type'),
    event_version: num(body, 'event_version'),
    occurred_at: isoDate(body, 'occurred_at'),
    alpha_player_id: optional('alpha_player_id'),
    formal_user_id: optional('formal_user_id'),
    session_id: optional('session_id'),
    arena_id: optional('arena_id'),
    run_id: optional('run_id'),
    checkpoint_id: optional('checkpoint_id'),
    simulation_timestamp: optional('simulation_timestamp'),
    correlation_id: optional('correlation_id'),
    causation_id: optional('causation_id'),
    payload: isRecord(payload) ? payload : {},
  };
}
