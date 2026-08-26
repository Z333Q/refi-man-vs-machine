import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HttpError, validSessionId, validateEvent, validateGuidance,
  validateMachineVersion, validateProfile, validateRunRecord, validateTape,
  validateTip,
} from '../src/contract.js';
import { runFixture, machineFixture, profileFixture } from './fixtures.js';

// ─── Fail-closed validation ───────────────────────────────────────────────────
// The validators are the API's edge: a payload that does not parse into the
// domain shape must become a 400, never a partial row. These tests are
// offline; the integration suite proves the same shapes against PostgreSQL.


test('a well-formed run record validates and round-trips its fields', () => {
  const rec = validateRunRecord(runFixture(), 'run_a1b2c3d4e5f60718293a4b01');
  assert.equal(rec.volatility, 0.185);
  assert.equal(rec.decisions.length, 2);
  assert.equal(rec.decisions[0]?.committedAt, '2026-08-25T12:00:00.000Z');
  assert.equal(rec.decisions[1]?.committedAt, null, 'a legacy null commit time is accepted');
});

test('a run record without volatility is refused', () => {
  const { volatility: _volatility, ...rest } = runFixture();
  assert.throws(() => validateRunRecord(rest, 'run_a1b2c3d4e5f60718293a4b01'),
    (e: unknown) => e instanceof HttpError && e.status === 400);
});

test('a decision without the committedAt key is refused: absence is not null', () => {
  const fixture = runFixture();
  const decisions = fixture.decisions.map(({ committedAt: _c, ...d }) => d);
  assert.throws(
    () => validateRunRecord({ ...fixture, decisions }, 'run_a1b2c3d4e5f60718293a4b01'),
    (e: unknown) => e instanceof HttpError && e.status === 400
      && e.message.includes('committedAt'),
  );
});

test('a runId that does not match the URL is refused', () => {
  assert.throws(() => validateRunRecord(runFixture(), 'run_somebody_else'),
    (e: unknown) => e instanceof HttpError && e.status === 400);
});

test('an unsupported record version is refused, not half-read', () => {
  assert.throws(
    () => validateRunRecord(runFixture({ recordVersion: 1 }), 'run_a1b2c3d4e5f60718293a4b01'),
    (e: unknown) => e instanceof HttpError && e.status === 400,
  );
});


test('a well-formed machine version validates', () => {
  const rec = validateMachineVersion(machineFixture(), 'PLAYER MACHINE', 1);
  assert.equal(rec.buildHash, '9F2A:31D8:77C1');
});

test('a malformed build hash is refused', () => {
  assert.throws(
    () => validateMachineVersion(machineFixture({ buildHash: 'nope' }), 'PLAYER MACHINE', 1),
    (e: unknown) => e instanceof HttpError && e.status === 400,
  );
});

test('a machine version whose URL and body disagree is refused', () => {
  assert.throws(() => validateMachineVersion(machineFixture(), 'PLAYER MACHINE', 2),
    (e: unknown) => e instanceof HttpError && e.status === 400);
});


test('a well-formed profile validates', () => {
  const p = validateProfile(profileFixture());
  assert.equal(p.alphaXp, 480);
  assert.equal(p.machineLadder['spy_benchmark']?.status, 'DEFEATED');
});

test('a ladder status outside the vocabulary is refused before it can hit the check constraint', () => {
  const p = profileFixture() as Record<string, unknown>;
  (p['machineLadder'] as Record<string, unknown>)['spy_benchmark'] =
    { wins: 0, losses: 0, status: 'WINNING' };
  assert.throws(() => validateProfile(p),
    (e: unknown) => e instanceof HttpError && e.status === 400);
});

test('a daily tape submission without a tapeId is refused', () => {
  assert.throws(
    () => validateTape({ tapeDate: '2026-08-25', playerAction: 'HOLD', score: 7 }),
    (e: unknown) => e instanceof HttpError && e.status === 400 && e.message.includes('tapeId'),
  );
});

test('tip states and guidance modes are held to their vocabularies', () => {
  assert.throws(() => validateTip({ tipCode: 't', state: 'GLIMPSED' }),
    (e: unknown) => e instanceof HttpError && e.status === 400);
  assert.throws(() => validateGuidance({ mode: 'LOUD' }),
    (e: unknown) => e instanceof HttpError && e.status === 400);
  assert.equal(validateGuidance({ mode: 'MINIMAL' }), 'MINIMAL');
});

test('an event envelope needs only its envelope fields; payload defaults to {}', () => {
  const e = validateEvent({
    event_id: 'evt_01', event_type: 'session.started',
    event_version: 1, occurred_at: '2026-08-25T12:00:00.000Z',
  });
  assert.deepEqual(e.payload, {});
});

test('the session header is required and shaped', () => {
  assert.throws(() => validSessionId(undefined),
    (e: unknown) => e instanceof HttpError && e.status === 400);
  assert.throws(() => validSessionId('has spaces in it'),
    (e: unknown) => e instanceof HttpError && e.status === 400);
  assert.equal(validSessionId('ses_abc-123'), 'ses_abc-123');
});
