import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { Pool } from 'pg';

import { makeServer } from '../src/server.js';
import { runFixture, machineFixture, profileFixture, sid } from './fixtures.js';

// Integration test: every endpoint, driven over real HTTP against the real
// founding schema. The unit tests prove the validators; only this proves that
// a domain object survives the trip through PostgreSQL and comes back as the
// same domain object — and that the mirror's two laws (session boundary,
// monotonic history) hold where they matter, in the database.
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

  function put(path: string, sessionId: string, body: unknown) {
    return call(path, sessionId, { method: 'PUT', body: JSON.stringify(body) });
  }
  function post(path: string, sessionId: string, body: unknown) {
    return call(path, sessionId, { method: 'POST', body: JSON.stringify(body) });
  }

  // ─── Session boundary ───────────────────────────────────────────────────────

  test('health answers without a database', async () => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
  });

  test('a scoped route without the session header is refused', async () => {
    const res = await call('/v1/progress', null);
    assert.equal(res.status, 400);
  });

  test('an unknown session reads 404; an existing anonymous session with nothing reads 200 []', async () => {
    assert.equal((await call('/v1/runs', sid(0x10))).status, 404,
      'a session the server has never seen has nothing, not an empty list');
    assert.equal((await call('/v1/machine-versions', sid(0x10))).status, 404);

    // A write creates the anonymous session; from then on emptiness is real.
    assert.equal((await put('/v1/guidance', sid(0x10), { mode: 'FULL' })).status, 204);
    const runs = await call('/v1/runs', sid(0x10));
    assert.equal(runs.status, 200);
    assert.deepEqual(await runs.json(), []);
    const machines = await call('/v1/machine-versions', sid(0x10));
    assert.equal(machines.status, 200);
    assert.deepEqual(await machines.json(), []);
  });

  test('a session linked to an account is refused for both reads and writes', async () => {
    // A linked session: the boundary this API must never cross. Operations on
    // it belong to a verified principal, which x-alpha-session is not.
    const linked = sid(0x11);
    const { rows: [user] } = await pool.query(
      `INSERT INTO app_users DEFAULT VALUES RETURNING id`);
    await pool.query(
      `INSERT INTO game_sessions (id, user_id, linked_at) VALUES ($1, $2, now())`,
      [linked, user.id]);

    assert.equal((await call('/v1/runs', linked)).status, 403);
    assert.equal((await call('/v1/progress', linked)).status, 403);
    assert.equal((await put('/v1/progress', linked, profileFixture())).status, 403);
    assert.equal((await put(`/v1/runs/${runFixture().runId as string}`, linked, runFixture())).status, 403);

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM player_profiles WHERE session_id = $1`, [linked]);
    assert.equal(rows[0].n, 0, 'the refused write must not have touched anything');
  });

  test('two concurrent first writes to a brand-new session both land, one row', async () => {
    // The client serializes per resource key, not per session, so a tip and a
    // guidance write to a session the server has never seen are legitimately
    // concurrent. Both must succeed; the session must exist exactly once.
    const s = sid(0x12);
    const [guidance, tip] = await Promise.all([
      put('/v1/guidance', s, { mode: 'STANDARD' }),
      post('/v1/tips', s, { tipCode: 'FIRST_TIP', state: 'SHOWN' }),
    ]);
    assert.equal(guidance.status, 204);
    assert.equal(tip.status, 204);

    const { rows: sessions } = await pool.query(
      `SELECT count(*)::int AS n, bool_and(user_id IS NULL) AS anon
       FROM game_sessions WHERE id = $1`, [s]);
    assert.equal(sessions[0].n, 1, 'exactly one session row');
    assert.equal(sessions[0].anon, true, 'the session remains anonymous');

    const { rows: g } = await pool.query(
      `SELECT guidance_mode FROM guidance_settings WHERE session_id = $1`, [s]);
    assert.equal(g[0].guidance_mode, 'STANDARD');
    const { rows: t } = await pool.query(
      `SELECT tip_state FROM user_tip_states WHERE session_id = $1 AND tip_code = 'FIRST_TIP'`, [s]);
    assert.equal(t[0].tip_state, 'SHOWN');
  });

  // ─── Profile ────────────────────────────────────────────────────────────────

  test('profile: 404 before first write, then PUT/GET round-trips the domain object', async () => {
    const s = sid(0x20);
    assert.equal((await put('/v1/guidance', s, { mode: 'FULL' })).status, 204);
    const miss = await call('/v1/progress', s);
    assert.equal(miss.status, 404, 'no profile yet is NOT_FOUND, not an empty profile');

    const profile = profileFixture();
    assert.equal((await put('/v1/progress', s, profile)).status, 204);

    const got = await call('/v1/progress', s);
    assert.equal(got.status, 200);
    assert.deepEqual(await got.json(), profile,
      'row -> domain object must reproduce exactly what domain object -> row stored');

    // Idempotent: the same PUT twice leaves the same state.
    assert.equal((await put('/v1/progress', s, profile)).status, 204);
    assert.deepEqual(await (await call('/v1/progress', s)).json(), profile);
  });

  test('a legacy SQL null archetype reads back as the explicit UNCLASSIFIED', async () => {
    const s = sid(0x21);
    await pool.query(`INSERT INTO game_sessions (id) VALUES ($1)`, [s]);
    await pool.query(
      `INSERT INTO player_profiles (session_id, archetype) VALUES ($1, NULL)`, [s]);
    const got = await call('/v1/progress', s);
    assert.equal(got.status, 200);
    assert.equal((await got.json() as { archetype: string }).archetype, 'UNCLASSIFIED',
      'the domain Archetype is never null; the truthful mapping is the explicit value');
  });

  // ─── Tips and guidance ──────────────────────────────────────────────────────

  test('tips record only the provenance the record establishes', async () => {
    const s = sid(0x30);
    // No lastShownAt supplied: nothing is invented.
    assert.equal((await post('/v1/tips', s,
      { tipCode: 'HOLD_IS_A_DECISION', state: 'SHOWN' })).status, 204);
    let { rows } = await pool.query(
      `SELECT tip_state, last_shown_at, show_count FROM user_tip_states
       WHERE session_id = $1 AND tip_code = 'HOLD_IS_A_DECISION'`, [s]);
    assert.equal(rows[0].tip_state, 'SHOWN');
    assert.equal(rows[0].last_shown_at, null, 'a missing lastShownAt must not become now()');
    assert.equal(rows[0].show_count, 0,
      'a TipRecord cannot prove a display happened, so none may be counted');

    // A state update with a real timestamp carries it; the count still does
    // not move, and an exact retry is a true no-op.
    const update = {
      tipCode: 'HOLD_IS_A_DECISION', state: 'COMPLETED',
      lastShownAt: '2026-08-25T12:00:00.000Z', completedAt: '2026-08-25T12:01:00.000Z',
    };
    assert.equal((await post('/v1/tips', s, update)).status, 204);
    assert.equal((await post('/v1/tips', s, update)).status, 204);
    ({ rows } = await pool.query(
      `SELECT tip_state, last_shown_at, completed_at, show_count FROM user_tip_states
       WHERE session_id = $1 AND tip_code = 'HOLD_IS_A_DECISION'`, [s]));
    assert.equal(rows[0].tip_state, 'COMPLETED');
    assert.equal(new Date(rows[0].last_shown_at as string).toISOString(), '2026-08-25T12:00:00.000Z');
    assert.equal(new Date(rows[0].completed_at as string).toISOString(), '2026-08-25T12:01:00.000Z');
    assert.equal(rows[0].show_count, 0);

    // A later record without timestamps keeps the established ones.
    assert.equal((await post('/v1/tips', s,
      { tipCode: 'HOLD_IS_A_DECISION', state: 'DISMISSED' })).status, 204);
    ({ rows } = await pool.query(
      `SELECT last_shown_at, completed_at FROM user_tip_states
       WHERE session_id = $1 AND tip_code = 'HOLD_IS_A_DECISION'`, [s]));
    assert.equal(new Date(rows[0].last_shown_at as string).toISOString(), '2026-08-25T12:00:00.000Z');
    assert.equal(new Date(rows[0].completed_at as string).toISOString(), '2026-08-25T12:01:00.000Z');
  });

  test('guidance mode round-trips through its settings row', async () => {
    const s = sid(0x31);
    assert.equal((await put('/v1/guidance', s, { mode: 'MINIMAL' })).status, 204);
    const { rows } = await pool.query(
      `SELECT guidance_mode FROM guidance_settings WHERE session_id = $1`, [s]);
    assert.equal(rows[0].guidance_mode, 'MINIMAL');
  });

  // ─── Daily tape ─────────────────────────────────────────────────────────────

  test('daily tape: identical means every fact including the score', async () => {
    const s = sid(0x40);
    const tape = { tapeDate: '2026-08-25', tapeId: 'tape_003', playerAction: 'HOLD', score: 7 };
    assert.equal((await post('/v1/daily-tape', s, tape)).status, 204);

    const got = await call('/v1/daily-tape/2026-08-25', s);
    assert.equal(got.status, 200);
    assert.deepEqual(await got.json(), tape);

    // The mirror retries fire-and-forget: the identical submission is a no-op.
    assert.equal((await post('/v1/daily-tape', s, tape)).status, 204);

    // A different answer for the same day is an attempt to re-decide (§6.3).
    assert.equal((await post('/v1/daily-tape', s,
      { ...tape, playerAction: 'REDUCE' })).status, 409);
    // The same answer with a different score is not "identical" either: a
    // silent first-score-wins would hide a real disagreement.
    assert.equal((await post('/v1/daily-tape', s, { ...tape, score: 9 })).status, 409);

    // Another day is another decision.
    assert.equal((await call('/v1/daily-tape/2026-08-26', s)).status, 404);
  });

  // ─── Runs: round-trip ───────────────────────────────────────────────────────

  const RUN_SESSION = sid(0x50);

  test('runs: PUT/GET round-trips the Run Record exactly, including a null commit time', async () => {
    const record = runFixture();
    assert.equal((await put(`/v1/runs/${record.runId as string}`, RUN_SESSION, record)).status, 204);

    const got = await call('/v1/runs', RUN_SESSION);
    assert.equal(got.status, 200);
    const list = await got.json() as unknown[];
    assert.equal(list.length, 1);
    assert.deepEqual(list[0], record,
      'the Run Record that comes back must be the Run Record that went in');

    // Exact retry: a true no-op, still one run with two decisions.
    assert.equal((await put(`/v1/runs/${record.runId as string}`, RUN_SESSION, record)).status, 204);
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
    const other = sid(0x51);
    assert.equal((await put(`/v1/runs/${record.runId as string}`, other, record)).status, 409);
    const { rows } = await pool.query(
      `SELECT session_id FROM arena_runs WHERE id = $1`, [record.runId]);
    assert.equal(rows[0].session_id, RUN_SESSION, 'the run still belongs to its owner');
  });

  // ─── Runs: monotonic history ────────────────────────────────────────────────

  function decision(sequence: number, patch: Record<string, unknown> = {}) {
    return {
      checkpointSequence: sequence,
      actionCode: 'HOLD',
      thesisCode: 'THESIS_UNCHANGED',
      confidence: 0.6,
      modulesConsulted: [],
      turnoverCost: 0,
      scoreContribution: 1,
      quality: 'GOOD',
      behavioralFlags: [],
      machineActionCode: 'HOLD',
      committedAt: `2026-08-25T12:0${String(sequence)}:00.000Z`,
      ...patch,
    };
  }

  test('a valid appended decision advances the run; a stale shorter history cannot truncate it', async () => {
    const s = sid(0x52);
    const runId = 'run_b1b2c3d4e5f60718293a4b02';
    const two = runFixture({
      runId, decisions: [decision(1), decision(2)], currentCheckpoint: 2,
    });
    assert.equal((await put(`/v1/runs/${runId}`, s, two)).status, 204);

    const three = runFixture({
      runId, decisions: [decision(1), decision(2), decision(3)], currentCheckpoint: 3,
      updatedAt: '2026-08-25T12:30:00.000Z',
    });
    assert.equal((await put(`/v1/runs/${runId}`, s, three)).status, 204);
    let list = await (await call('/v1/runs', s)).json() as { decisions: unknown[] }[];
    assert.equal(list[0]?.decisions.length, 3, 'the valid longer history appends');

    // The stale two-decision record arrives late: nothing is destroyed.
    assert.equal((await put(`/v1/runs/${runId}`, s, two)).status, 204);
    list = await (await call('/v1/runs', s)).json() as
      { decisions: unknown[]; currentCheckpoint: number }[];
    assert.equal(list[0]?.decisions.length, 3, 'a stale shorter run cannot truncate history');
    assert.equal(list[0]?.currentCheckpoint, 3, 'a stale earlier checkpoint cannot regress the run');
  });

  test('immutable run fields cannot be contradicted', async () => {
    const s = sid(0x53);
    const runId = 'run_c1b2c3d4e5f60718293a4b03';
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [decision(1)] }))).status, 204);
    for (const patch of [
      { seed: 9999 },
      { arenaId: 'recovery_trap' },
      { machineId: 'spy_benchmark' },
      { totalCheckpoints: 30 },
      { startedAt: '2026-08-25T10:00:00.000Z' },
    ]) {
      assert.equal((await put(`/v1/runs/${runId}`, s,
        runFixture({ runId, decisions: [decision(1)], ...patch }))).status, 409,
        `mutating ${Object.keys(patch)[0] as string} must be refused`);
    }
  });

  test('a stored decision cannot be rewritten', async () => {
    const s = sid(0x54);
    const runId = 'run_d1b2c3d4e5f60718293a4b04';
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [decision(1)] }))).status, 204);
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [decision(1, { actionCode: 'REDUCE' })] }))).status, 409);
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [decision(1, { scoreContribution: 5 })] }))).status, 409);
  });

  test('thesis and commit time are one-way enrichments, never rewrites', async () => {
    const s = sid(0x55);
    const runId = 'run_e1b2c3d4e5f60718293a4b05';
    const bare = decision(1, { thesisCode: null, committedAt: null });
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [bare] }))).status, 204);

    // null -> value: both enrichments land.
    const enriched = decision(1);
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [enriched] }))).status, 204);
    let list = await (await call('/v1/runs', s)).json() as
      { decisions: { thesisCode: string | null; committedAt: string | null }[] }[];
    assert.equal(list[0]?.decisions[0]?.thesisCode, 'THESIS_UNCHANGED');
    assert.equal(list[0]?.decisions[0]?.committedAt, '2026-08-25T12:01:00.000Z');

    // value -> null: the established values stand.
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [bare] }))).status, 204);
    list = await (await call('/v1/runs', s)).json() as
      { decisions: { thesisCode: string | null; committedAt: string | null }[] }[];
    assert.equal(list[0]?.decisions[0]?.thesisCode, 'THESIS_UNCHANGED',
      'a stale null must not erase an established thesis');
    assert.equal(list[0]?.decisions[0]?.committedAt, '2026-08-25T12:01:00.000Z',
      'a stale null must not erase an established commit time');

    // value -> different value: contradiction.
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [decision(1, { thesisCode: 'MOMENTUM' })] }))).status, 409);
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [decision(1, { committedAt: '2026-08-25T23:59:00.000Z' })] }))).status, 409);
  });

  test('a terminal result never regresses or mutates', async () => {
    const s = sid(0x56);
    const runId = 'run_f1b2c3d4e5f60718293a4b06';
    const done = runFixture({
      runId, decisions: [decision(1)], state: 'COMPLETE', result: 'FAILED',
      completedAt: '2026-08-25T13:00:00.000Z',
    });
    assert.equal((await put(`/v1/runs/${runId}`, s, done)).status, 204);

    // Another terminal result for the same run: contradiction.
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [decision(1)], state: 'COMPLETE', result: 'PASSED' }))).status, 409);

    // A stale ACTIVE record: the concluded run does not come back to life.
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [decision(1)], state: 'SIGNAL', result: 'ACTIVE' }))).status, 204);
    const list = await (await call('/v1/runs', s)).json() as
      { result: string; state: string; completedAt: string | null }[];
    assert.equal(list[0]?.result, 'FAILED');
    assert.equal(list[0]?.state, 'COMPLETE');
    assert.equal(list[0]?.completedAt, '2026-08-25T13:00:00.000Z');
  });

  test('same decision count: state moves forward but never backward', async () => {
    const s = sid(0x57);
    const runId = 'run_a2b2c3d4e5f60718293a4b07';
    const investigating = runFixture({
      runId, decisions: [decision(1)], currentCheckpoint: 2, state: 'INVESTIGATING',
    });
    assert.equal((await put(`/v1/runs/${runId}`, s, investigating)).status, 204);

    // Forward within the same checkpoint: accepted.
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [decision(1)], currentCheckpoint: 2, state: 'COMMITTING' }))).status, 204);
    let list = await (await call('/v1/runs', s)).json() as { state: string }[];
    assert.equal(list[0]?.state, 'COMMITTING');

    // Backward: stale, no regression.
    assert.equal((await put(`/v1/runs/${runId}`, s,
      runFixture({ runId, decisions: [decision(1)], currentCheckpoint: 2, state: 'SIGNAL' }))).status, 204);
    list = await (await call('/v1/runs', s)).json() as { state: string }[];
    assert.equal(list[0]?.state, 'COMMITTING', 'phase must never move backward');
  });

  test('a longer history with an earlier checkpoint cannot append and regress', async () => {
    // Internally inconsistent (or stale beyond repair): more decisions than
    // the store holds, but an earlier checkpoint and phase. It must not get
    // to append its extra decision and then drag the scalar state backwards.
    const s = sid(0x58);
    const runId = 'run_a3b2c3d4e5f60718293a4b08';
    const stored = runFixture({
      runId, decisions: [decision(1), decision(2)],
      currentCheckpoint: 3, state: 'COMMITTING',
    });
    assert.equal((await put(`/v1/runs/${runId}`, s, stored)).status, 204);

    const inconsistent = runFixture({
      runId, decisions: [decision(1), decision(2), decision(3)],
      currentCheckpoint: 2, state: 'SIGNAL',
    });
    assert.equal((await put(`/v1/runs/${runId}`, s, inconsistent)).status, 204,
      'stale, so a no-op, not an error');

    const list = await (await call('/v1/runs', s)).json() as
      { currentCheckpoint: number; state: string; decisions: unknown[] }[];
    assert.equal(list[0]?.currentCheckpoint, 3, 'the checkpoint must not regress');
    assert.equal(list[0]?.state, 'COMMITTING', 'the phase must not regress');
    assert.equal(list[0]?.decisions.length, 2,
      'the inconsistent extra decision must not have been appended');
  });

  // ─── Machine versions ───────────────────────────────────────────────────────

  const MACHINE_SESSION = sid(0x60);
  const MACHINE_PATH = `/v1/machine-versions/${encodeURIComponent('PLAYER MACHINE')}/1`;

  test('machine versions: PUT/GET round-trips; a different hash on the same key is 409', async () => {
    const record = machineFixture();
    assert.equal((await put(MACHINE_PATH, MACHINE_SESSION, record)).status, 204);

    const list = await (await call('/v1/machine-versions', MACHINE_SESSION)).json() as unknown[];
    assert.deepEqual(list, [record]);

    // Same key, different build: two histories claiming one version number.
    const contradictory = machineFixture({ installedModules: ['UNIVERSE', 'SIGNAL', 'GUARDRAILS'] });
    assert.equal((await put(MACHINE_PATH, MACHINE_SESSION, contradictory)).status, 409);

    // The same version under a different session is that session's own record.
    assert.equal((await put(MACHINE_PATH, sid(0x61), record)).status, 204);
  });

  test('a machine lock is one-way and single-valued on the server', async () => {
    const locked = machineFixture({ lockedAt: '2026-08-25T13:00:00.000Z' });
    assert.equal((await put(MACHINE_PATH, MACHINE_SESSION, locked)).status, 204);

    // A later mirror write without the lock: stale, the lock stands.
    assert.equal((await put(MACHINE_PATH, MACHINE_SESSION, machineFixture())).status, 204);
    let list = await (await call('/v1/machine-versions', MACHINE_SESSION)).json() as
      { lockedAt: string | null }[];
    assert.equal(list[0]?.lockedAt, '2026-08-25T13:00:00.000Z');

    // The same lock again: no-op.
    assert.equal((await put(MACHINE_PATH, MACHINE_SESSION, locked)).status, 204);
    // A different lock: two contradictory histories.
    assert.equal((await put(MACHINE_PATH, MACHINE_SESSION,
      machineFixture({ lockedAt: '2026-08-26T09:00:00.000Z' }))).status, 409);
    list = await (await call('/v1/machine-versions', MACHINE_SESSION)).json() as
      { lockedAt: string | null }[];
    assert.equal(list[0]?.lockedAt, '2026-08-25T13:00:00.000Z');
  });

  test('arenasCompleted moves as a set: superset advances, subset is stale, divergence is 409', async () => {
    const s = sid(0x62);
    const path = `/v1/machine-versions/${encodeURIComponent('SET MACHINE')}/1`;
    const withOne = machineFixture({
      machineName: 'SET MACHINE', arenasCompleted: ['covid_black_swan'],
    });
    assert.equal((await put(path, s, withOne)).status, 204);

    // Exact same set: no-op.
    assert.equal((await put(path, s, withOne)).status, 204);

    // Superset: advances.
    assert.equal((await put(path, s, machineFixture({
      machineName: 'SET MACHINE', arenasCompleted: ['covid_black_swan', 'recovery_trap'],
    }))).status, 204);
    let list = await (await call('/v1/machine-versions', s)).json() as
      { arenasCompleted: string[] }[];
    assert.deepEqual(new Set(list[0]?.arenasCompleted),
      new Set(['covid_black_swan', 'recovery_trap']));

    // Subset: stale, kept.
    assert.equal((await put(path, s, withOne)).status, 204);
    list = await (await call('/v1/machine-versions', s)).json() as
      { arenasCompleted: string[] }[];
    assert.deepEqual(new Set(list[0]?.arenasCompleted),
      new Set(['covid_black_swan', 'recovery_trap']),
      'a stale subset must not shrink the set');

    // Divergent: neither side is entitled to auto-union.
    assert.equal((await put(path, s, machineFixture({
      machineName: 'SET MACHINE', arenasCompleted: ['covid_black_swan', 'banking_stress'],
    }))).status, 409);
  });

  test('the stored machine id is derived from the hash, not persisted JSON', async () => {
    const { rows } = await pool.query(
      `SELECT configuration_json FROM player_machine_versions
       WHERE session_id = $1 AND machine_name = 'PLAYER MACHINE'`, [MACHINE_SESSION]);
    assert.ok(!('machineId' in (rows[0].configuration_json as Record<string, unknown>)),
      'persisting machineId would let it disagree with the hash it derives from');
  });

  // ─── Telemetry ──────────────────────────────────────────────────────────────

  test('telemetry: the envelope lands once, however many times it is delivered', async () => {
    const envelope = {
      event_id: 'evt_integration_001',
      event_type: 'decision.committed',
      event_version: 1,
      occurred_at: '2026-08-25T12:00:00.000Z',
      session_id: sid(0x70),
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

  test('telemetry without a canonical session_id is refused', async () => {
    const res = await fetch(`${base}/v1/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event_id: 'evt_integration_002', event_type: 'session.started',
        event_version: 1, occurred_at: '2026-08-25T12:00:00.000Z',
        payload: {},
      }),
    });
    assert.equal(res.status, 400);
  });

  // ─── Malformed bodies ───────────────────────────────────────────────────────

  test('a malformed run body is a 400 and writes nothing', async () => {
    const badId = 'run_badbadbadbadbadbadbad1'.slice(0, 28);
    const { volatility: _v, ...missing } = runFixture({ runId: badId });
    const res = await put(`/v1/runs/${badId}`, RUN_SESSION, missing);
    assert.equal(res.status, 400);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM arena_runs WHERE id = $1`, [badId]);
    assert.equal(rows[0].n, 0);
  });
});
