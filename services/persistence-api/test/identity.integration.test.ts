import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { Pool } from 'pg';

import { makeServer } from '../src/server.js';
import { sid, testVerifier, asUser, profileFixture, runFixture } from './fixtures.js';

// Merge point 1, against a real database.
//
// Everything here is an invariant about ownership, and ownership is exactly
// the kind of claim that cannot be proved with mocks: whether a second browser
// can attach itself to somebody's account, whether a retired name can be
// taken, and whether a linked session still answers to a header are all
// decisions made by constraints and transactions.

const DATABASE_URL = process.env.DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../db/migrations/', import.meta.url));
const schemaSql = () => readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()
  .map(f => readFileSync(MIGRATIONS + f, 'utf8')).join('\n');

describe('claimed player identity', {
  skip: DATABASE_URL ? false : 'DATABASE_URL not set',
}, () => {
  let pool: Pool;
  let server: ReturnType<typeof makeServer>;
  let base: string;

  before(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await pool.query(schemaSql());
    server = makeServer(pool, testVerifier());
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(err => (err ? reject(err) : resolve())));
    await pool.end();
  });

  function call(path: string, init: RequestInit & { session?: string; as?: string } = {}) {
    const { session, as, ...rest } = init;
    return fetch(`${base}${path}`, {
      ...rest,
      headers: {
        'content-type': 'application/json',
        ...(session ? { 'x-alpha-session': session } : {}),
        ...(as ? asUser(as) : {}),
        ...(rest.headers ?? {}),
      },
    });
  }

  const claim = (session: string, as: string, body: unknown) =>
    call('/v1/identity/claim', { method: 'POST', session, as, body: JSON.stringify(body) });

  // ─── Anonymous play is untouched ────────────────────────────────────────────

  test('a player with no account can still play', async () => {
    const session = sid(0x100);
    assert.equal((await call('/v1/guidance', {
      method: 'PUT', session, body: JSON.stringify({ mode: 'FULL' }),
    })).status, 204);
    assert.equal((await call('/v1/runs', { session })).status, 200);
  });

  test('claiming needs a verified principal, and a body cannot supply one', async () => {
    const session = sid(0x101);
    assert.equal((await call('/v1/identity/claim', {
      method: 'POST', session, body: JSON.stringify({ handle: 'nobody' }),
    })).status, 401, 'an unauthenticated claim was accepted');

    // Ownership fields in the body are ignored, not honoured.
    const res = await claim(session, 'sub_body', {
      handle: 'bodyclaim', user_id: 'usr_someone', provider: 'made_up',
      subject: 'someone_else', email_verified: true,
    });
    assert.equal(res.status, 201);
    const { rows } = await pool.query(
      `SELECT provider, subject FROM user_identities
        JOIN public_player_profiles USING (user_id) WHERE handle = 'bodyclaim'`);
    assert.equal(rows[0].provider, 'stytch', 'the client chose its own provider');
    assert.equal(rows[0].subject, 'sub_body', 'the client chose its own subject');
  });

  // ─── The claim transaction ──────────────────────────────────────────────────

  test('a claim creates identity, reservation, profile and session link together', async () => {
    const session = sid(0x102);
    // Play first: this is the history the claim must not move.
    await call('/v1/guidance', { method: 'PUT', session, body: JSON.stringify({ mode: 'MINIMAL' }) });

    const res = await claim(session, 'sub_alpha', { handle: 'Z333Q', displayName: 'Zeshan' });
    assert.equal(res.status, 201);
    const body = await res.json() as { outcome: string; userId: string; profile: { handle: string } };
    assert.equal(body.outcome, 'CLAIMED');
    // Canonical storage: trimmed and lowercased, whatever was typed.
    assert.equal(body.profile.handle, 'z333q');

    const { rows } = await pool.query(
      `SELECT u.id AS user_id,
              (SELECT count(*)::int FROM user_identities i WHERE i.user_id = u.id) AS identities,
              (SELECT count(*)::int FROM player_handle_history h
                WHERE h.user_id = u.id AND h.released_at IS NULL) AS reservations,
              (SELECT count(*)::int FROM public_player_profiles p WHERE p.user_id = u.id) AS profiles,
              (SELECT count(*)::int FROM game_sessions s
                WHERE s.user_id = u.id AND s.linked_at IS NOT NULL) AS sessions
         FROM app_users u WHERE u.id = $1`, [body.userId]);
    assert.deepEqual(
      { i: rows[0].identities, r: rows[0].reservations, p: rows[0].profiles, s: rows[0].sessions },
      { i: 1, r: 1, p: 1, s: 1 });
  });

  test('a claim copies no progression whatsoever', async () => {
    const session = sid(0x103);
    await call('/v1/guidance', { method: 'PUT', session, body: JSON.stringify({ mode: 'FULL' }) });
    await call(`/v1/runs/${runFixture().runId as string}`, {
      method: 'PUT', session, body: JSON.stringify(runFixture()),
    });
    const before = await pool.query(
      `SELECT count(*)::int AS n FROM arena_runs WHERE session_id = $1`, [session]);

    await claim(session, 'sub_copy', { handle: 'nocopy' });

    const after = await pool.query(
      `SELECT count(*)::int AS n FROM arena_runs WHERE session_id = $1`, [session]);
    assert.equal(after.rows[0].n, before.rows[0].n, 'runs were duplicated onto the account');

    // The history reaches the account the only way it ever does: through the
    // session link. There is no user_id on a run and there must not be.
    const reached = await pool.query(
      `SELECT count(*)::int AS n FROM arena_runs r
         JOIN game_sessions s ON s.id = r.session_id
         JOIN user_identities i ON i.user_id = s.user_id
        WHERE i.subject = 'sub_copy'`);
    assert.equal(reached.rows[0].n, before.rows[0].n);
  });

  test('a repeated claim is idempotent and never renames the account', async () => {
    const session = sid(0x104);
    assert.equal((await claim(session, 'sub_again', { handle: 'firstname' })).status, 201);

    const same = await claim(session, 'sub_again', { handle: 'firstname' });
    assert.equal(same.status, 200);
    assert.equal((await same.json() as { outcome: string }).outcome, 'ALREADY_CLAIMED');

    // A different handle from an account that already has one is a conflict
    // result, not a silent rename: renaming has its own route and cooldown.
    const other = await claim(session, 'sub_again', { handle: 'secondname' });
    const body = await other.json() as { outcome: string; profile: { handle: string } };
    assert.equal(body.outcome, 'ALREADY_CLAIMED_OTHER_HANDLE');
    assert.equal(body.profile.handle, 'firstname', 'the account was silently renamed');

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM player_handle_history WHERE handle = 'secondname'`);
    assert.equal(rows[0].n, 0, 'a rejected claim still reserved the name');
  });

  test('a second browser links to the same account without copying anything', async () => {
    const first = sid(0x105), second = sid(0x106);
    const claimed = await (await claim(first, 'sub_two_browsers', { handle: 'twodevices' })).json() as
      { userId: string };

    await call('/v1/guidance', { method: 'PUT', session: second, body: JSON.stringify({ mode: 'OFF' }) });
    const linked = await call('/v1/identity/link-session', {
      method: 'POST', session: second, as: 'sub_two_browsers',
    });
    assert.equal(linked.status, 200);
    assert.equal((await linked.json() as { userId: string }).userId, claimed.userId);

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM game_sessions WHERE user_id = $1`, [claimed.userId]);
    assert.equal(rows[0].n, 2, 'one account should own both browsers');
  });

  test('nobody can take over somebody else\'s session', async () => {
    const session = sid(0x107);
    await claim(session, 'sub_owner', { handle: 'owner_one' });

    const theft = await call('/v1/identity/link-session', {
      method: 'POST', session, as: 'sub_thief',
    });
    assert.equal(theft.status, 403, 'a session was re-pointed at another account');

    const stolenClaim = await claim(session, 'sub_thief', { handle: 'thiefname' });
    assert.equal(stolenClaim.status, 403);
  });

  // ─── Authorization after the claim ──────────────────────────────────────────

  test('the session header stops being enough once a session is claimed', async () => {
    const session = sid(0x108);
    await call('/v1/progress', { method: 'PUT', session, body: JSON.stringify(profileFixture()) });
    await claim(session, 'sub_auth', { handle: 'authowner' });

    // Header alone: refused, exactly as before this PR.
    const bare = await call('/v1/progress', { session });
    assert.equal(bare.status, 403);
    assert.equal((await bare.json() as { error: string }).error, 'authentication_required');

    // The owner's own credential: allowed again. This is the whole point.
    assert.equal((await call('/v1/progress', { session, as: 'sub_auth' })).status, 200);
    assert.equal((await call('/v1/progress', {
      method: 'PUT', session, as: 'sub_auth', body: JSON.stringify(profileFixture()),
    })).status, 204);

    // Somebody else's credential: still refused, and distinguishably so.
    const wrong = await call('/v1/progress', { session, as: 'sub_stranger' });
    assert.equal(wrong.status, 403);
    assert.equal((await wrong.json() as { error: string }).error, 'forbidden');
  });

  test('every session-scoped route follows the same rule, telemetry included', async () => {
    const session = sid(0x109);
    await claim(session, 'sub_routes', { handle: 'routeowner' });
    const at = '2026-09-14T12:00:00.000Z';

    const cases: [string, RequestInit][] = [
      ['/v1/runs', { method: 'GET' }],
      ['/v1/machine-versions', { method: 'GET' }],
      ['/v1/tips', { method: 'POST', body: JSON.stringify({ tipCode: 'T1', state: 'SHOWN' }) }],
      ['/v1/guidance', { method: 'PUT', body: JSON.stringify({ mode: 'FULL' }) }],
      ['/v1/growth/touches', { method: 'POST', body: JSON.stringify({ kind: 'meaningful', occurredAt: at }) }],
    ];

    for (const [path, init] of cases) {
      assert.equal((await call(path, { ...init, session })).status, 403,
        `${path} still authorised a linked session on the header alone`);
      const owned = await call(path, { ...init, session, as: 'sub_routes' });
      assert.ok(owned.status < 400, `${path} refused its own owner (${String(owned.status)})`);
      assert.equal((await call(path, { ...init, session, as: 'sub_stranger' })).status, 403,
        `${path} let a stranger in`);
    }
  });

  // ─── Handles ────────────────────────────────────────────────────────────────

  test('one handle, one winner, even under concurrent claims', async () => {
    const results = await Promise.all([
      claim(sid(0x110), 'sub_race_a', { handle: 'contested' }),
      claim(sid(0x111), 'sub_race_b', { handle: 'contested' }),
      claim(sid(0x112), 'sub_race_c', { handle: 'contested' }),
    ]);
    const created = results.filter(r => r.status === 201);
    const refused = results.filter(r => r.status === 409);
    assert.equal(created.length, 1, 'more than one account took the same name');
    assert.equal(refused.length, 2);
    for (const r of refused) {
      assert.equal((await r.json() as { error: string }).error, 'HANDLE_UNAVAILABLE',
        'a raw database error reached the client');
    }
  });

  test('reserved and impersonating handles are refused', async () => {
    for (const handle of [
      'refi', 'refi_alpha', 'admin', 'support', 'compliance', 'leaderboard',
      'refi_support', 'refisupport', 'refi_team', 'refi_help', 'r_e_f_i',
      'ReFi_Admin', 'alpha', 'paper', 'signal',
    ]) {
      const res = await claim(sid(0x113), 'sub_reserved', { handle });
      assert.equal(res.status, 422, `${handle} was allowed`);
    }
  });

  test('malformed handles are refused before they reach the database', async () => {
    for (const handle of ['ab', 'a'.repeat(21), '_lead', 'trail_', 'has space', 'has-dash']) {
      assert.equal((await claim(sid(0x114), 'sub_malformed', { handle })).status, 422, handle);
    }
  });

  test('identity is keyed to provider and subject, never to email', async () => {
    // Two principals with the same email are two people. The verifier hands
    // over subjects, and the subject is what the account hangs from.
    const a = await (await claim(sid(0x115), 'sub_email_one', { handle: 'emailone' })).json() as
      { userId: string };
    const b = await (await claim(sid(0x116), 'sub_email_two', { handle: 'emailtwo' })).json() as
      { userId: string };
    assert.notEqual(a.userId, b.userId);

    const { rows } = await pool.query(
      `SELECT count(DISTINCT user_id)::int AS n FROM user_identities
        WHERE subject IN ('sub_email_one','sub_email_two')`);
    assert.equal(rows[0].n, 2);
  });

  test('one authentication identity never becomes two accounts', async () => {
    const [x, y] = await Promise.all([
      call('/v1/identity/link-session', { method: 'POST', session: sid(0x117), as: 'sub_single' }),
      call('/v1/identity/link-session', { method: 'POST', session: sid(0x118), as: 'sub_single' }),
    ]);
    assert.equal(x.status, 200);
    assert.equal(y.status, 200);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM user_identities WHERE subject = 'sub_single'`);
    assert.equal(rows[0].n, 1, 'one person ended up with two accounts');
  });

  // ─── Identity and profile reads ─────────────────────────────────────────────

  test('me reports the caller and nothing about anybody else', async () => {
    const session = sid(0x119);
    await claim(session, 'sub_me', { handle: 'myhandle', displayName: 'Me' });
    const me = await call('/v1/identity/me', { as: 'sub_me' });
    assert.equal(me.status, 200);
    const body = await me.json() as Record<string, unknown>;
    assert.equal((body.profile as { handle: string }).handle, 'myhandle');

    // Never: the provider subject, the email, or any session id.
    const serialised = JSON.stringify(body);
    assert.equal(serialised.includes('sub_me'), false, 'the provider subject leaked');
    assert.equal(serialised.includes('@example.test'), false, 'the email leaked');
    assert.equal(serialised.includes(session), false, 'a session id leaked');

    assert.equal((await call('/v1/identity/me', { as: 'sub_never_claimed' })).status, 404);
    assert.equal((await call('/v1/identity/me')).status, 401);
  });

  test('a public profile shows only public things, and private means private', async () => {
    await claim(sid(0x11a), 'sub_public', { handle: 'seenbyall', displayName: 'Seen' });
    const seen = await call('/v1/profiles/seenbyall');
    assert.equal(seen.status, 200);
    const body = await seen.json() as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(),
      ['avatarUrl', 'bio', 'createdAt', 'displayName', 'handle', 'visibility']);

    await claim(sid(0x11b), 'sub_private', { handle: 'unlisted' });
    assert.equal((await call('/v1/profiles/me', {
      method: 'PATCH', as: 'sub_private', body: JSON.stringify({ visibility: 'private' }),
    })).status, 200);
    assert.equal((await call('/v1/profiles/unlisted')).status, 404,
      'a private profile was readable by the public');
  });

  // ─── Rename, release and reactivation ───────────────────────────────────────

  async function backdateTenure(handle: string, days: number) {
    await pool.query(
      `UPDATE player_handle_history SET held_from = now() - ($2 || ' days')::interval
        WHERE handle = $1`, [handle, String(days)]);
  }

  test('a rename is refused inside the cooldown and allowed after it', async () => {
    await claim(sid(0x120), 'sub_rename', { handle: 'oldname' });

    const tooSoon = await call('/v1/profiles/me', {
      method: 'PATCH', as: 'sub_rename', body: JSON.stringify({ handle: 'newname' }),
    });
    assert.equal(tooSoon.status, 429);
    assert.equal((await tooSoon.json() as { error: string }).error, 'RENAME_TOO_SOON');

    await backdateTenure('oldname', 31);
    assert.equal((await call('/v1/profiles/me', {
      method: 'PATCH', as: 'sub_rename', body: JSON.stringify({ handle: 'newname' }),
    })).status, 200);

    // The old name is released, never deleted, and still belongs to them.
    const { rows } = await pool.query(
      `SELECT user_id IS NOT NULL AS owned, released_at IS NOT NULL AS released
         FROM player_handle_history WHERE handle = 'oldname'`);
    assert.deepEqual(rows[0], { owned: true, released: true });

    // And it does not read as free.
    const moved = await call('/v1/profiles/oldname');
    assert.equal(moved.status, 200);
    assert.deepEqual(await moved.json(), { kind: 'MOVED', currentHandle: 'newname' });
  });

  test('a released handle is not available to anybody else, ever', async () => {
    const stealing = await claim(sid(0x121), 'sub_opportunist', { handle: 'oldname' });
    assert.equal(stealing.status, 409);
  });

  test('the original owner may take their own old handle back after the cooldown', async () => {
    // An explicit reactivation of their own reservation, not a fresh insert:
    // the row already exists and belongs to them, which is exactly why it is
    // theirs to take and nobody else's.
    await backdateTenure('newname', 31);
    const back = await call('/v1/profiles/me', {
      method: 'PATCH', as: 'sub_rename', body: JSON.stringify({ handle: 'oldname' }),
    });
    assert.equal(back.status, 200);
    assert.equal((await back.json() as { handle: string }).handle, 'oldname');

    const { rows } = await pool.query(
      `SELECT released_at IS NULL AS current,
              held_from > now() - interval '1 minute' AS tenure_reset
         FROM player_handle_history WHERE handle = 'oldname'`);
    assert.deepEqual(rows[0], { current: true, tenure_reset: true },
      'reactivation did not restart the cooldown clock');

    // Only one of their names is current at a time.
    const { rows: live } = await pool.query(
      `SELECT count(*)::int AS n FROM player_handle_history h
         JOIN user_identities i ON i.user_id = h.user_id
        WHERE i.subject = 'sub_rename' AND h.released_at IS NULL`);
    assert.equal(live[0].n, 1);
  });

  test('a handle whose owner is gone is retired forever', async () => {
    await claim(sid(0x122), 'sub_departing', { handle: 'departed_one' });
    await pool.query(
      `DELETE FROM app_users WHERE id = (
         SELECT user_id FROM user_identities WHERE subject = 'sub_departing')`);

    // The reservation survived with no owner, which is what retired means.
    const { rows } = await pool.query(
      `SELECT user_id FROM player_handle_history WHERE handle = 'departed_one'`);
    assert.equal(rows[0].user_id, null);

    assert.equal((await claim(sid(0x123), 'sub_scavenger', { handle: 'departed_one' })).status, 409,
      'a dead account\'s handle was handed to somebody else');

    const lookup = await call('/v1/profiles/departed_one');
    assert.equal(lookup.status, 410, 'a retired handle read as merely absent');
  });

  test('a profile patch touches nothing beyond the profile', async () => {
    await claim(sid(0x124), 'sub_patch', { handle: 'patchable' });
    const res = await call('/v1/profiles/me', {
      method: 'PATCH', as: 'sub_patch',
      body: JSON.stringify({
        displayName: 'Display', bio: 'Trader', avatarUrl: 'https://img.example/a.png',
        // Fields that are not the caller's to set, offered anyway.
        userId: 'usr_other', kycStatus: 'APPROVED', brokerageAccount: 'acct_1',
      }),
    });
    assert.equal(res.status, 200);
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'public_player_profiles'`);
    const columns = rows.map(r => r.column_name as string);
    for (const forbidden of ['kyc_status', 'brokerage_account', 'risk_tolerance']) {
      assert.equal(columns.includes(forbidden), false, `${forbidden} exists on a game profile`);
    }
  });
});
