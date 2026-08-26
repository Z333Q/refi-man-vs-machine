import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HttpError, derivedMachineId, validSessionId, validateEvent, validateGuidance,
  validateMachineVersion, validateProfile, validateRunRecord, validateTape,
  validateTip,
} from '../src/contract.js';
import { runFixture, machineFixture, profileFixture, sid } from './fixtures.js';

// ─── Fail-closed validation ───────────────────────────────────────────────────
// The validators are the API's edge: a payload that does not parse into the
// domain shape must become a 400, never a partial row. These tests are
// offline; the integration suite proves the same shapes against PostgreSQL.

const RUN_URL_ID = 'run_a1b2c3d4e5f60718293a4b01';

function refused(fn: () => unknown, status = 400, needle?: string): void {
  assert.throws(fn, (e: unknown) =>
    e instanceof HttpError && e.status === status
    && (needle === undefined || e.message.includes(needle)));
}

test('a well-formed run record validates and round-trips its fields', () => {
  const rec = validateRunRecord(runFixture(), RUN_URL_ID);
  assert.equal(rec.volatility, 0.185);
  assert.equal(rec.decisions.length, 2);
  assert.equal(rec.decisions[0]?.committedAt, '2026-08-25T12:00:00.000Z');
  assert.equal(rec.decisions[1]?.committedAt, null, 'a legacy null commit time is accepted');
});

test('a run record without volatility is refused', () => {
  const { volatility: _volatility, ...rest } = runFixture();
  refused(() => validateRunRecord(rest, RUN_URL_ID));
});

test('a decision without the committedAt key is refused: absence is not null', () => {
  const fixture = runFixture();
  const decisions = fixture.decisions.map(({ committedAt: _c, ...d }) => d);
  refused(() => validateRunRecord({ ...fixture, decisions }, RUN_URL_ID), 400, 'committedAt');
});

test('a runId outside the canonical run_<24 hex> shape is refused', () => {
  refused(() => validateRunRecord(
    runFixture({ runId: 'run_not-hex' }), 'run_not-hex'));
  refused(() => validateRunRecord(
    runFixture({ runId: 'run_A1B2C3D4E5F60718293A4B01' }), 'run_A1B2C3D4E5F60718293A4B01'),
    400, undefined);
});

test('a runId that does not match the URL is refused', () => {
  refused(() => validateRunRecord(runFixture(), 'run_ffffffffffffffffffffffff'));
});

test('an unsupported record version is refused, not half-read', () => {
  refused(() => validateRunRecord(runFixture({ recordVersion: 1 }), RUN_URL_ID));
});

test('run vocabulary is closed: state, result, action, quality, flags, modules, thesis', () => {
  refused(() => validateRunRecord(runFixture({ state: 'WINNING' }), RUN_URL_ID), 400, 'state');
  refused(() => validateRunRecord(runFixture({ result: 'MACHINE_WIN' }), RUN_URL_ID), 400, 'result');
  refused(() => validateRunRecord(runFixture({ arenaId: 'dotcom_bust' }), RUN_URL_ID), 400, 'arenaId');

  const base = runFixture();
  const decisionWith = (patch: Record<string, unknown>) =>
    ({ ...base, decisions: [{ ...base.decisions[0], ...patch }] });
  refused(() => validateRunRecord(decisionWith({ actionCode: 'YOLO' }), RUN_URL_ID), 400, 'actionCode');
  refused(() => validateRunRecord(decisionWith({ quality: 'SOUND' }), RUN_URL_ID), 400, 'quality');
  refused(() => validateRunRecord(decisionWith({ thesisCode: 'VIBES' }), RUN_URL_ID), 400, 'thesisCode');
  refused(() => validateRunRecord(decisionWith({ behavioralFlags: ['PANICKY'] }), RUN_URL_ID), 400, 'behavioralFlags');
  refused(() => validateRunRecord(decisionWith({ modulesConsulted: ['RISK_PANEL'] }), RUN_URL_ID), 400, 'modulesConsulted');
  refused(() => validateRunRecord(decisionWith({ machineActionCode: 'ROTATE' }), RUN_URL_ID), 400, 'machineActionCode');
});

test('a body that names its own owner is refused, not ignored', () => {
  for (const field of ['sessionId', 'session_id', 'userId', 'user_id', 'ownerId', 'owner_id']) {
    refused(() => validateRunRecord(runFixture({ [field]: 'ses_x' }), RUN_URL_ID), 400, field);
    refused(() => validateProfile({ ...profileFixture(), [field]: 'ses_x' }), 400, field);
    refused(() => validateTape({
      tapeDate: '2026-08-25', tapeId: 't', playerAction: 'HOLD', score: 1, [field]: 'x',
    }), 400, field);
  }
});

test('a well-formed machine version validates, with its id derived from the hash', () => {
  const fixture = machineFixture();
  const rec = validateMachineVersion(fixture, 'PLAYER MACHINE', 1);
  assert.equal(rec.buildHash, fixture.buildHash);
  assert.equal(rec.machineId, derivedMachineId(rec.buildHash));
});

test('a build hash that does not follow from the configuration is refused', () => {
  refused(() => validateMachineVersion(
    machineFixture({ buildHash: '0000:1111:2222' }), 'PLAYER MACHINE', 1), 400, 'buildHash');
});

test('a machineId that does not derive from the build hash is refused', () => {
  refused(() => validateMachineVersion(
    machineFixture({ machineId: 'mch_somethingelse' }), 'PLAYER MACHINE', 1), 400, 'machineId');
});

test('a machine config outside the closed choices is refused', () => {
  const config = { ...machineFixture().config, signal: 'ASTROLOGY' };
  refused(() => validateMachineVersion(
    machineFixture({ config }), 'PLAYER MACHINE', 1), 400, 'signal');
  const modules = ['UNIVERSE', 'VIBES'];
  refused(() => validateMachineVersion(
    machineFixture({ installedModules: modules }), 'PLAYER MACHINE', 1), 400, 'installedModules');
});

test('a machine version whose URL and body disagree is refused', () => {
  refused(() => validateMachineVersion(machineFixture(), 'PLAYER MACHINE', 2));
});

test('a well-formed profile validates', () => {
  const p = validateProfile(profileFixture());
  assert.equal(p.alphaXp, 480);
  assert.equal(p.machineLadder['spy_benchmark']?.status, 'DEFEATED');
});

test('profile vocabulary is closed: rank, archetype, dimensions, modules, ladder status', () => {
  refused(() => validateProfile({ ...profileFixture(), rankCode: 'WOLF_OF_WALL_ST' }), 400, 'rankCode');
  refused(() => validateProfile({ ...profileFixture(), archetype: null }), 400, 'archetype');
  refused(() => validateProfile({ ...profileFixture(), archetype: 'DEGEN' }), 400, 'archetype');
  refused(() => validateProfile({
    ...profileFixture(), dimensions: { VIBES: { score: 1, sampleSize: 1 } },
  }), 400, 'dimensions');
  refused(() => validateProfile({
    ...profileFixture(), unlockedModules: ['MACHINE_BUILDER'],
  }), 400, 'unlockedModules');
  const p = profileFixture() as Record<string, unknown>;
  (p['machineLadder'] as Record<string, unknown>)['spy_benchmark'] =
    { wins: 0, losses: 0, status: 'WINNING' };
  refused(() => validateProfile(p));
});

test('a daily tape submission without a tapeId is refused', () => {
  refused(() => validateTape({ tapeDate: '2026-08-25', playerAction: 'HOLD', score: 7 }),
    400, 'tapeId');
});

test('a daily tape action outside the action vocabulary is refused', () => {
  refused(() => validateTape({
    tapeDate: '2026-08-25', tapeId: 't1', playerAction: 'REDUCE_TECH', score: 7,
  }), 400, 'playerAction');
});

test('tip states and guidance modes are held to their vocabularies', () => {
  refused(() => validateTip({ tipCode: 't', state: 'GLIMPSED' }));
  refused(() => validateGuidance({ mode: 'LOUD' }));
  assert.equal(validateGuidance({ mode: 'MINIMAL' }), 'MINIMAL');
});

test('an event envelope requires a canonical session_id and an object payload', () => {
  const good = {
    event_id: 'evt_01', event_type: 'session.started',
    event_version: 1, occurred_at: '2026-08-25T12:00:00.000Z',
    session_id: sid(1), payload: { source: 'test' },
  };
  assert.deepEqual(validateEvent(good).payload, { source: 'test' });

  const { session_id: _s, ...noSession } = good;
  refused(() => validateEvent(noSession), 400, 'session_id');
  refused(() => validateEvent({ ...good, session_id: 'ses_short' }), 400, 'session_id');
  refused(() => validateEvent({ ...good, payload: 'not an object' }), 400, 'payload');
  const { payload: _p, ...noPayload } = good;
  refused(() => validateEvent(noPayload), 400, 'payload');
  refused(() => validateEvent({ ...good, run_id: 'run_not-canonical' }), 400, 'run_id');
});

test('the session header is required and exactly ses_<20 hex>', () => {
  refused(() => validSessionId(undefined));
  refused(() => validSessionId('has spaces in it'));
  refused(() => validSessionId('ses_abc-123'), 400);
  refused(() => validSessionId('ses_' + 'a'.repeat(19)));
  assert.equal(validSessionId(sid(7)), sid(7));
});
