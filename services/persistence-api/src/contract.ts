// ─── Wire contract ────────────────────────────────────────────────────────────
//
// What the browser sends is the domain record, verbatim (Step 7 removed the
// client-side SQL serializers on purpose). This service owns both directions
// of the mapping — domain object -> PostgreSQL row, and row -> validated
// domain object — so this file is where the wire shapes are checked,
// fail-closed: a payload that does not parse into the domain shape is a 400,
// never a partial row.
//
// The vocabularies below are the closed unions from the game client's
// gameTypes.ts, restated as the server's own authority. A value outside its
// union is refused rather than stored as an arbitrary string: a persistence
// layer that accepts anything cannot later promise what it holds.

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

// ─── Canonical vocabularies (from src/lib/gameTypes.ts) ───────────────────────

export const ACTION_CODES = new Set([
  'HOLD', 'REDUCE', 'ROTATE_DEFENSIVE', 'ROTATE_RISK', 'RAISE_CASH',
  'ADD_RISK', 'STAGED_BUY', 'STAGED_SELL',
]);

export const THESIS_CODES = new Set([
  'DETERIORATING_FUNDAMENTALS', 'PANIC_REDUCTION', 'VOLATILITY_CONTROL',
  'LIQUIDITY_PRESERVATION', 'VALUATION', 'REGIME_CHANGE', 'POLICY_RESPONSE',
  'THESIS_UNCHANGED', 'DIVERSIFICATION', 'MOMENTUM', 'CONTRARIAN',
  'THESIS_UNSTATED',
]);

export const DECISION_QUALITIES = new Set([
  'EXCELLENT', 'GOOD', 'NEUTRAL', 'POOR', 'CRITICAL_ERROR',
]);

export const BEHAVIORAL_FLAGS = new Set([
  'ACTION_BIAS', 'ANCHORING', 'PANIC_REDUCTION_LARGE', 'HIGH_CONVICTION_ACTION',
  'CONFIDENCE_SIZE_MISMATCH', 'THESIS_CONTRADICTION', 'RECENCY_BIAS',
  'REENTRY_DELAY', 'CHASING', 'PATIENCE_POSITIVE', 'ADAPTATION_EVENT',
  'EARLY_REGIME_SENSITIVITY', 'GOOD_PROCESS', 'CASH_DRAG', 'OVERCONFIDENCE',
  'CONTRARIAN_EARLY',
]);

export const MODULE_CODES = new Set([
  'PRICE_RETURN', 'PORTFOLIO_SUMMARY', 'SECTOR_EXPOSURE', 'NEWS_FEED',
  'CORRELATION_MATRIX', 'BLOCK_FIELD', 'DRAWDOWN_MAP', 'REGIME_SCANNER',
  'STAGED_EXECUTION', 'BASKET_WRITER', 'POLICY_WRITER', 'MACHINE_AUDIT',
]);

export const ARENA_IDS = new Set([
  'covid_black_swan', 'recovery_trap', 'inflation_shift', 'banking_stress',
  'taco_protocol',
]);

/** In progression order: the ordinal is the run's forward direction. */
export const RUN_PHASES = [
  'SIGNAL', 'INVESTIGATING', 'COMMITTING', 'RESOLVING', 'COMPARING',
  'LEARNING', 'COMPLETE',
] as const;
const RUN_PHASE_SET = new Set<string>(RUN_PHASES);

export function phaseOrdinal(phase: string): number {
  return RUN_PHASES.indexOf(phase as (typeof RUN_PHASES)[number]);
}

export const RUN_RESULTS = new Set([
  'ACTIVE', 'PASSED', 'FAILED', 'MACHINE_BEATEN', 'ABANDONED',
]);
export const TERMINAL_RESULTS = new Set(['PASSED', 'FAILED', 'MACHINE_BEATEN', 'ABANDONED']);

export const RANK_CODES = new Set([
  'INITIATE', 'ANALYST', 'ASSOCIATE', 'PORTFOLIO_MANAGER', 'SENIOR_PM',
  'CHIEF_INVESTMENT_OFFICER',
]);

export const ARCHETYPES = new Set([
  'REGIME_HUNTER', 'DEFENSIVE_ALLOCATOR', 'MOMENTUM_RIDER', 'CONTRARIAN',
  'RISK_ARCHITECT', 'PATIENT_COMPOUNDER', 'TACTICAL_ROTATOR', 'POLICY_BUILDER',
  'UNCLASSIFIED',
]);

export const DIMENSION_CODES = new Set([
  'STOCK_SELECTION', 'POSITION_SIZING', 'LOSS_CONTROL', 'REENTRY_DISCIPLINE',
  'TURNOVER_DISCIPLINE', 'REGIME_ADAPTATION', 'RULE_ADHERENCE',
  'ACTION_BIAS_SCORE', 'CONCENTRATION_CONTROL', 'DECISION_CONSISTENCY',
]);

export const MACHINE_MODULE_IDS = new Set([
  'UNIVERSE', 'ELIGIBILITY', 'SIGNAL', 'CONSTRUCTION', 'GUARDRAILS',
  'EXECUTION', 'MONITORING',
]);

const UNIVERSE_CHOICES = new Set(['US_ALL', 'SP500', 'US_LIQUID']);
const ELIGIBILITY_CHOICES = new Set(['NONE', 'FUNDAMENTAL', 'FUNDAMENTAL_LIQUIDITY', 'ROBUSTNESS']);
const SIGNAL_CHOICES = new Set(['PRICE_MOMENTUM', 'REGIME_CLASSIFIER', 'RF_RL_PIPELINE', 'QUALITY_FACTOR']);
const CONSTRUCTION_CHOICES = new Set(['EQUAL_WEIGHT', 'RISK_PARITY', 'SIGNAL_WEIGHTED', 'CONSTRAINED_OPT']);
const EXECUTION_CHOICES = new Set(['DAILY_CLOSE', 'INTRADAY_1H', 'WEEKLY', 'STAGED_3TRANCHE']);
const MONITORING_CHOICES = new Set(['PASSIVE', 'CORRELATION_ALERT', 'REGIME_SCANNER', 'FULL_RISK_MONITOR']);
const GUARDRAIL_FIELDS = [
  'maxPositionPct', 'maxSectorPct', 'maxCorrelation', 'drawdownGatePct', 'cashFloorPct',
] as const;

const TIP_STATES = new Set(['UNSEEN', 'SHOWN', 'SNOOZED', 'DISMISSED', 'COMPLETED']);
const GUIDANCE_MODES = new Set(['FULL', 'STANDARD', 'MINIMAL', 'OFF']);

// ─── Canonical browser identifiers ────────────────────────────────────────────
//
// Exact shapes, because the browser mints them exactly: identity.ts generates
// ses_<20 lowercase hex> and events.ts mkId generates run_<24 lowercase hex>.
// A looser pattern would let an attacker park arbitrary strings as sessions.

const SESSION_ID = /^ses_[0-9a-f]{20}$/;
const RUN_ID = /^run_[0-9a-f]{24}$/;

export function validSessionId(value: unknown): string {
  if (typeof value !== 'string' || !SESSION_ID.test(value)) {
    throw new HttpError(400, 'x-alpha-session header is required (ses_<20 hex>)');
  }
  return value;
}

// ─── Build hash (mirror of src/lib/machineVersions.ts) ────────────────────────
//
// The server recomputes the canonical build hash so it cannot persist an
// impossible machine record: a stored hash that does not follow from the
// stored configuration would poison every identity derived from it.

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function machineBuildHash(
  config: Record<string, unknown>,
  installedModules: readonly string[],
): string {
  const payload = canonical({ config, modules: [...installedModules].sort() });
  const a = fnv1a(payload);
  const b = fnv1a(`${payload}:1`);
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(8, '0');
  const all = hex(a) + hex(b);
  return `${all.slice(0, 4)}:${all.slice(4, 8)}:${all.slice(8, 12)}`;
}

export function derivedMachineId(buildHash: string): string {
  return `mch_${buildHash.replace(/:/g, '').toLowerCase()}`;
}

// ─── Wire shapes ──────────────────────────────────────────────────────────────

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
  result: string;
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
  archetype: string;
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
  session_id: string;
  alpha_player_id?: string | null;
  formal_user_id?: string | null;
  arena_id?: string | null;
  run_id?: string | null;
  checkpoint_id?: string | null;
  simulation_timestamp?: string | null;
  correlation_id?: string | null;
  causation_id?: string | null;
  payload: Record<string, unknown>;
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

function inSet(o: Record<string, unknown>, k: string, allowed: Set<string>): string {
  const v = str(o, k);
  if (!allowed.has(v)) throw new HttpError(400, `${k}: '${v}' is outside its vocabulary`);
  return v;
}

function setArray(o: Record<string, unknown>, k: string, allowed: Set<string>): string[] {
  const v = o[k];
  if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) bad(k);
  for (const x of v as string[]) {
    if (!allowed.has(x)) throw new HttpError(400, `${k}: '${x}' is outside its vocabulary`);
  }
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

/**
 * Ownership comes from the transport (the session header), never the body. A
 * body that names an owner is refused rather than ignored: silently dropping
 * the claim would leave the client believing the server honored it.
 */
const IDENTITY_FIELDS = ['sessionId', 'session_id', 'userId', 'user_id', 'ownerId', 'owner_id'];
function rejectIdentityFields(body: Record<string, unknown>): void {
  for (const field of IDENTITY_FIELDS) {
    if (field in body) {
      throw new HttpError(400, `${field} must not appear in the body; ownership is the transport's job`);
    }
  }
}

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateRunRecord(body: unknown, runIdFromUrl: string): WireRunRecord {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a run record');
  rejectIdentityFields(body);
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
    const thesisCode = strOrNull(d, 'thesisCode');
    if (thesisCode !== null && !THESIS_CODES.has(thesisCode)) {
      throw new HttpError(400, `thesisCode: '${thesisCode}' is outside its vocabulary`);
    }
    return {
      checkpointSequence: num(d, 'checkpointSequence'),
      actionCode: inSet(d, 'actionCode', ACTION_CODES),
      thesisCode,
      confidence: numOrNull(d, 'confidence'),
      modulesConsulted: setArray(d, 'modulesConsulted', MODULE_CODES),
      turnoverCost: num(d, 'turnoverCost'),
      scoreContribution: num(d, 'scoreContribution'),
      quality: inSet(d, 'quality', DECISION_QUALITIES),
      behavioralFlags: setArray(d, 'behavioralFlags', BEHAVIORAL_FLAGS),
      machineActionCode: inSet(d, 'machineActionCode', ACTION_CODES),
      committedAt: isoDateOrNull(d, 'committedAt'),
    };
  });

  const state = str(body, 'state');
  if (!RUN_PHASE_SET.has(state)) {
    throw new HttpError(400, `state: '${state}' is outside its vocabulary`);
  }

  return {
    recordVersion: RUN_RECORD_VERSION,
    runId,
    seed: num(body, 'seed'),
    arenaId: inSet(body, 'arenaId', ARENA_IDS),
    machineId: str(body, 'machineId'),
    state,
    result: inSet(body, 'result', RUN_RESULTS),
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

function validateMachineConfig(config: Record<string, unknown>): void {
  inSet(config, 'universe', UNIVERSE_CHOICES);
  inSet(config, 'eligibility', ELIGIBILITY_CHOICES);
  inSet(config, 'signal', SIGNAL_CHOICES);
  inSet(config, 'construction', CONSTRUCTION_CHOICES);
  inSet(config, 'execution', EXECUTION_CHOICES);
  inSet(config, 'monitoring', MONITORING_CHOICES);
  const guardrails = config['guardrails'];
  if (!isRecord(guardrails)) bad('config.guardrails');
  for (const field of GUARDRAIL_FIELDS) num(guardrails, field);
}

export function validateMachineVersion(
  body: unknown,
  nameFromUrl: string,
  versionFromUrl: number,
): WireMachineVersion {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a machine version record');
  rejectIdentityFields(body);
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
  validateMachineConfig(config);
  const installedModules = setArray(body, 'installedModules', MACHINE_MODULE_IDS);
  const buildHash = str(body, 'buildHash');

  // The hash is the machine's identity, so it must actually follow from the
  // machine: recompute it with the client's algorithm and refuse a record
  // whose stored hash contradicts its own contents.
  const recomputed = machineBuildHash(config, installedModules);
  if (buildHash !== recomputed) {
    throw new HttpError(400, 'buildHash does not match the configuration');
  }
  const machineId = str(body, 'machineId');
  if (machineId !== derivedMachineId(buildHash)) {
    throw new HttpError(400, 'machineId does not match its build hash');
  }

  return {
    recordVersion: MACHINE_RECORD_VERSION,
    machineId,
    machineName,
    version,
    config,
    installedModules,
    buildHash,
    createdAt: isoDate(body, 'createdAt'),
    lockedAt: isoDateOrNull(body, 'lockedAt'),
    arenasCompleted: setArray(body, 'arenasCompleted', ARENA_IDS),
  };
}

export function validateProfile(body: unknown): WireProfile {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a profile snapshot');
  rejectIdentityFields(body);

  const dimensionsRaw = body['dimensions'];
  if (!isRecord(dimensionsRaw)) bad('dimensions');
  const dimensions: WireProfile['dimensions'] = {};
  for (const [code, v] of Object.entries(dimensionsRaw)) {
    if (!DIMENSION_CODES.has(code)) {
      throw new HttpError(400, `dimensions: '${code}' is outside its vocabulary`);
    }
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
    rankCode: inSet(body, 'rankCode', RANK_CODES),
    machineBeats: num(body, 'machineBeats'),
    machineAttempts: num(body, 'machineAttempts'),
    currentStreak: num(body, 'currentStreak'),
    bestStreak: num(body, 'bestStreak'),
    // The domain Archetype is never null: unclassified players carry the
    // explicit UNCLASSIFIED value (see gameTypes.ts).
    archetype: inSet(body, 'archetype', ARCHETYPES),
    decisionStreak: num(body, 'decisionStreak'),
    lastActiveDate: strOrNull(body, 'lastActiveDate'),
    dimensions,
    unlockedModules: setArray(body, 'unlockedModules', MODULE_CODES),
    machineLadder,
  };
}

export function validateTip(body: unknown): WireTip {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a tip record');
  rejectIdentityFields(body);
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
  rejectIdentityFields(body);
  const mode = str(body, 'mode');
  if (!GUIDANCE_MODES.has(mode)) bad('mode');
  return mode;
}

const TAPE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateTape(body: unknown): WireTape {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a daily tape submission');
  rejectIdentityFields(body);
  const tapeDate = str(body, 'tapeDate');
  if (!TAPE_DATE.test(tapeDate)) bad('tapeDate');
  return {
    tapeDate,
    tapeId: str(body, 'tapeId'),
    playerAction: inSet(body, 'playerAction', ACTION_CODES),
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
  // Telemetry is unauthenticated by design (no session header on the route),
  // so the envelope itself must say whose stream it belongs to, canonically.
  const sessionId = body['session_id'];
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) bad('session_id');
  const runId = optional('run_id');
  if (runId !== null && !RUN_ID.test(runId)) bad('run_id');
  const payload = body['payload'];
  if (!isRecord(payload)) {
    // Not silently {}: a malformed payload means the sender is broken, and
    // storing an empty object would hide that from everyone downstream.
    bad('payload');
  }
  return {
    event_id: str(body, 'event_id'),
    event_type: str(body, 'event_type'),
    event_version: num(body, 'event_version'),
    occurred_at: isoDate(body, 'occurred_at'),
    session_id: sessionId,
    alpha_player_id: optional('alpha_player_id'),
    formal_user_id: optional('formal_user_id'),
    arena_id: optional('arena_id'),
    run_id: runId,
    checkpoint_id: optional('checkpoint_id'),
    simulation_timestamp: optional('simulation_timestamp'),
    correlation_id: optional('correlation_id'),
    causation_id: optional('causation_id'),
    payload,
  };
}
