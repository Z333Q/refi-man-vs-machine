import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { Pool } from 'pg';

import { makeServer } from '../src/server.js';
import { runFixture, machineFixture, profileFixture } from './fixtures.js';

// Integration test: every endpoint, driven over real HTTP against the real
// founding schema. The unit tests prove the validators; only this proves that
// a domain object survives the trip through PostgreSQL and comes back as the
// same domain object — which is the entire job of this service.
//
// Skipped when DATABASE_URL is unset, so the ordinary unit suite stays offline.

const DATABASE_URL = process.env.DATABASE_URL;
// fileURLToPath, not URL.pathname: the latter percent-encodes spaces and this
// repository lives under a path that has them.
const SCHEMA = fileURLToPath(new URL(
  '../../../db/migrations/0001_founding_schema.sql',
  import.meta.url,
));

describe('persistence-api against the founding schema', {
  skip: DATABASE_URL ? false : 'DATABASE_URL not set',
}, () => {
  let pool: Pool;
  let server: ReturnType<typeof makeServer>;
  let base: string;

  before(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await pool.query(readFileSync(SCHEMA, 'utf8'));

    server = makeServer(pool);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    base = `http://127.0.0.1:${String(addr.port)}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(err => (err ? reject(err) : resolve())));
    await pool.end();
  });

  function call(path: string, sessionId: string | null, init?: RequestInit) {
    return fetch(`${base}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(sessionId ? { 'x-alpha-session': sessionId } : {}),
        ...(init?.headers ?? {}),
      },
    });
  }

  test('health answers without a database', async () => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
  });

  test('a scoped route without the session header is refused', async () => {
    const res = await call('/v1/progress', null);
    assert.equal(res.status, 400);
  });

  test('profile: 404 before first write, then PUT/GET round-trips the domain object', async () => {
    const miss = await call('/v1/progress', 'ses_p1');
    assert.equal(miss.status, 404, 'no profile yet is NOT_FOUND, not an empty profile');

    const profile = profileFixture();
    const put = await call('/v1/progress', 'ses_p1',
      { method: 'PUT', body: JSON.stringify(profile) });
    assert.equal(put.status, 204);

    const got = await call('/v1/progress', 'ses_p1');
    assert.equal(got.status, 200);
    const back = await got.json();
    assert.deepEqual(back, profile,
      'row -> domain object must reproduce exactly what domain object -> row stored');

    // Idempotent: the same PUT twice leaves the same state.
    const again = await call('/v1/progress', 'ses_p1',
      { method: 'PUT', body: JSON.stringify(profile) });
    assert.equal(again.status, 204);
    assert.deepEqual(await (await call('/v1/progress', 'ses_p1')).json(), profile);
  });

  test('profiles are scoped by session: another session sees its own 404', async () => {
    const res = await call('/v1/progress', 'ses_p2');
    assert.equal(res.status, 404);
  });

  test('tips upsert and re-showing increments the count', async () => {
    const tip = { tipCode: 'HOLD_IS_A_DECISION', state: 'SHOWN' };
    assert.equal((await call('/v1/tips', 'ses_t1',
      { method: 'POST', body: JSON.stringify(tip) })).status, 204);
    assert.equal((await call('/v1/tips', 'ses_t1',
      { method: 'POST', body: JSON.stringify({ ...tip, state: 'COMPLETED' }) })).status, 204);
    const { rows } = await pool.query(
      `SELECT tip_state, show_count FROM user_tip_states
       WHERE session_id = 'ses_t1' AND tip_code = 'HOLD_IS_A_DECISION'`);
    assert.equal(rows[0].tip_state, 'COMPLETED');
    assert.equal(rows[0].show_count, 2);
  });

  test('guidance mode round-trips through its settings row', async () => {
    assert.equal((await call('/v1/guidance', 'ses_g1',
      { method: 'PUT', body: JSON.stringify({ mode: 'MINIMAL' }) })).status, 204);
    const { rows } = await pool.query(
      `SELECT guidance_mode FROM guidance_settings WHERE session_id = 'ses_g1'`);
    assert.equal(rows[0].guidance_mode, 'MINIMAL');
  });

  test('daily tape: one decision per day — same call idempotent, different call 409', async () => {
    const tape = { tapeDate: '2026-08-25', tapeId: 'tape_003', playerAction: 'HOLD', score: 7 };
    assert.equal((await call('/v1/daily-tape', 'ses_d1',
      { method: 'POST', body: JSON.stringify(tape) })).status, 204);

    const got = await call('/v1/daily-tape/2026-08-25', 'ses_d1');
    assert.equal(got.status, 200);
    assert.deepEqual(await got.json(), tape);

    // The mirror retries fire-and-forget: the identical submission is a no-op.
    assert.equal((await call('/v1/daily-tape', 'ses_d1',
      { method: 'POST', body: JSON.stringify(tape) })).status, 204);

    // A different answer for the same day is an attempt to re-decide (§6.3).
    const other = { ...tape, playerAction: 'REDUCE_TECH' };
    assert.equal((await call('/v1/daily-tape', 'ses_d1',
      { method: 'POST', body: JSON.stringify(other) })).status, 409);

    // Another day is another decision.
    assert.equal((await call('/v1/daily-tape/2026-08-26', 'ses_d1')).status, 404);
  });

  test('runs: PUT/GET round-trips the Run Record exactly, including a null commit time', async () => {
    const record = runFixture();
    const put = await call(`/v1/runs/${record.runId}`, 'ses_r1',
      { method: 'PUT', body: JSON.stringify(record) });
    assert.equal(put.status, 204);

    const got = await call('/v1/runs', 'ses_r1');
    assert.equal(got.status, 200);
    const list = await got.json() as unknown[];
    assert.equal(list.length, 1);
    assert.deepEqual(list[0], record,
      'the Run Record that comes back must be the Run Record that went in');

    // Idempotent: same PUT, same state, still one run with two decisions.
    assert.equal((await call(`/v1/runs/${record.runId}`, 'ses_r1',
      { method: 'PUT', body: JSON.stringify(record) })).status, 204);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM checkpoint_decisions WHERE run_id = $1`, [record.runId]);
    assert.equal(rows[0].n, 2);

    // The legacy decision's null commit time is stored as null, not defaulted.
    const { rows: nulls } = await pool.query(
      `SELECT committed_at FROM checkpoint_decisions
       WHERE run_id = $1 AND checkpoint_sequence = 2`, [record.runId]);
    assert.equal(nulls[0].committed_at, null);
  });

  test('a run id under a different session is contradictory ownership: 409', async () => {
    const record = runFixture();
    const res = await call(`/v1/runs/${record.runId}`, 'ses_r2',
      { method: 'PUT', body: JSON.stringify(record) });
    assert.equal(res.status, 409);
    // And the run still belongs to its owner.
    const { rows } = await pool.query(
      `SELECT session_id FROM arena_runs WHERE id = $1`, [record.runId]);
    assert.equal(rows[0].session_id, 'ses_r1');
  });

  test('an updated run replaces its own earlier mirror write', async () => {
    const record = runFixture();
    const grown = {
      ...record,
      currentCheckpoint: 3,
      updatedAt: '2026-08-25T12:30:00.000Z',
      decisions: [...record.decisions, {
        ...record.decisions[0],
        checkpointSequence: 3,
        committedAt: '2026-08-25T12:30:00.000Z',
      }],
    };
    assert.equal((await call(`/v1/runs/${record.runId}`, 'ses_r1',
      { method: 'PUT', body: JSON.stringify(grown) })).status, 204);
    const list = await (await call('/v1/runs', 'ses_r1')).json() as { decisions: unknown[] }[];
    assert.equal(list[0]?.decisions.length, 3);
  });

  test('machine versions: PUT/GET round-trips; a different hash on the same key is 409', async () => {
    const record = machineFixture();
    const path = `/v1/machine-versions/${encodeURIComponent(record.machineName)}/1`;
    assert.equal((await call(path, 'ses_m1',
      { method: 'PUT', body: JSON.stringify(record) })).status, 204);

    const list = await (await call('/v1/machine-versions', 'ses_m1')).json() as unknown[];
    assert.deepEqual(list, [record]);

    // Same key, different build: two histories claiming one version number.
    const contradictory = machineFixture({ buildHash: '0000:1111:2222' });
    assert.equal((await call(path, 'ses_m1',
      { method: 'PUT', body: JSON.stringify(contradictory) })).status, 409);

    // The same version under a different session is that session's own record.
    assert.equal((await call(path, 'ses_m2',
      { method: 'PUT', body: JSON.stringify(record) })).status, 204);
  });

  test('a machine lock is one-way on the server too', async () => {
    const record = machineFixture();
    const path = `/v1/machine-versions/${encodeURIComponent(record.machineName)}/1`;
    const locked = machineFixture({ lockedAt: '2026-08-25T13:00:00.000Z' });
    assert.equal((await call(path, 'ses_m1',
      { method: 'PUT', body: JSON.stringify(locked) })).status, 204);

    // A later mirror write without the lock must not clear it.
    assert.equal((await call(path, 'ses_m1',
      { method: 'PUT', body: JSON.stringify(record) })).status, 204);
    const list = await (await call('/v1/machine-versions', 'ses_m1')).json() as
      { lockedAt: string | null }[];
    assert.equal(list[0]?.lockedAt, '2026-08-25T13:00:00.000Z');
  });

  test('telemetry: the envelope lands once, however many times it is delivered', async () => {
    const envelope = {
      event_id: 'evt_integration_001',
      event_type: 'decision.committed',
      event_version: 1,
      occurred_at: '2026-08-25T12:00:00.000Z',
      session_id: 'ses_e1',
      run_id: 'run_a1b2c3d4e5f60718293a4b01',
      payload: { thesis_code: 'THESIS_UNCHANGED' },
    };
    for (let i = 0; i < 3; i++) {
      assert.equal((await fetch(`${base}/v1/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
      })).status, 204);
    }
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM game_events WHERE event_id = 'evt_integration_001'`);
    assert.equal(rows[0].n, 1);
  });

  test('a malformed run body is a 400 and writes nothing', async () => {
    const { volatility: _v, ...missing } = runFixture({ runId: 'run_badbadbadbadbadbadbad01' });
    const res = await call('/v1/runs/run_badbadbadbadbadbadbad01', 'ses_r1',
      { method: 'PUT', body: JSON.stringify(missing) });
    assert.equal(res.status, 400);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM arena_runs WHERE id = 'run_badbadbadbadbadbadbad01'`);
    assert.equal(rows[0].n, 0);
  });
});
