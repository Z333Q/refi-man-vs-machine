import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

// Schema tests, run against a real PostgreSQL.
//
// The schema makes promises that only a database can check: that a player can
// play without an account, that linking one later loses nothing, that a person
// can hold several logins, and that deleting the wrong row cannot quietly take
// somebody's progress with it. Reading the DDL does not verify any of that.
//
// Skipped when DATABASE_URL is unset, so the ordinary suite stays offline.

const DATABASE_URL = process.env.DATABASE_URL;
const SCHEMA = new URL('./migrations/0001_founding_schema.sql', import.meta.url).pathname;

describe('founding schema', { skip: DATABASE_URL ? false : 'DATABASE_URL not set' }, () => {
  let db: Client;

  before(async () => {
    db = new Client({ connectionString: DATABASE_URL });
    await db.connect();
    // A clean slate each run: the schema is applied fresh rather than migrated.
    await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await db.query(readFileSync(SCHEMA, 'utf8'));
  });

  after(async () => { await db?.end(); });

  // Each test runs in a transaction that is rolled back, so order never matters.
  async function inRollback(fn: (c: Client) => Promise<void>) {
    await db.query('BEGIN');
    try { await fn(db); } finally { await db.query('ROLLBACK'); }
  }

  test('a player can play with no account at all', async () => {
    await inRollback(async c => {
      await c.query(`INSERT INTO game_sessions (id) VALUES ('ses_anon')`);
      await c.query(
        `INSERT INTO player_profiles (session_id, alpha_xp, rank_code)
         VALUES ('ses_anon', 250, 'ANALYST')`);
      const { rows } = await c.query(
        `SELECT alpha_xp, (SELECT user_id FROM game_sessions WHERE id='ses_anon') AS user_id
         FROM player_profiles WHERE session_id='ses_anon'`);
      assert.equal(rows[0].alpha_xp, 250);
      assert.equal(rows[0].user_id, null, 'anonymous progress required an account');
    });
  });

  test('linking a session to an account keeps the progress that was already there', async () => {
    await inRollback(async c => {
      await c.query(`INSERT INTO game_sessions (id) VALUES ('ses_link')`);
      await c.query(`INSERT INTO player_profiles (session_id, alpha_xp) VALUES ('ses_link', 420)`);

      const { rows: [user] } = await c.query(
        `INSERT INTO app_users DEFAULT VALUES RETURNING id`);
      await c.query(
        `UPDATE game_sessions SET user_id = $1, linked_at = now() WHERE id = 'ses_link'`,
        [user.id]);

      // Reached through the session, which is the only path that exists.
      const { rows } = await c.query(
        `SELECT p.alpha_xp FROM player_profiles p
         JOIN game_sessions s ON s.id = p.session_id
         WHERE s.user_id = $1`, [user.id]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].alpha_xp, 420, 'progress did not survive the link');
    });
  });

  test('one person can hold several logins', async () => {
    await inRollback(async c => {
      const { rows: [user] } = await c.query(`INSERT INTO app_users DEFAULT VALUES RETURNING id`);
      for (const [provider, subject] of [
        ['google', 'g-123'], ['password', 'p-123'], ['saml.acme', 's-123'],
      ]) {
        await c.query(
          `INSERT INTO user_identities (user_id, provider, subject) VALUES ($1,$2,$3)`,
          [user.id, provider, subject]);
      }
      const { rows } = await c.query(
        `SELECT count(*)::int AS n FROM user_identities WHERE user_id = $1`, [user.id]);
      assert.equal(rows[0].n, 3);
    });
  });

  test('the same provider identity cannot belong to two people', async () => {
    await inRollback(async c => {
      const { rows: [a] } = await c.query(`INSERT INTO app_users DEFAULT VALUES RETURNING id`);
      const { rows: [b] } = await c.query(`INSERT INTO app_users DEFAULT VALUES RETURNING id`);
      await c.query(
        `INSERT INTO user_identities (user_id, provider, subject) VALUES ($1,'google','same')`,
        [a.id]);
      await assert.rejects(
        c.query(`INSERT INTO user_identities (user_id, provider, subject) VALUES ($1,'google','same')`,
          [b.id]),
        /duplicate key|unique/i);
    });
  });

  test('a link has to record when it happened', async () => {
    await inRollback(async c => {
      const { rows: [user] } = await c.query(`INSERT INTO app_users DEFAULT VALUES RETURNING id`);
      await assert.rejects(
        c.query(`INSERT INTO game_sessions (id, user_id) VALUES ('ses_half', $1)`, [user.id]),
        /game_sessions_link_records_when/,
        'a session claimed an owner with no record of when');
    });
  });

  test('a session that outlived its account keeps the fact that it was linked', async () => {
    // user_id is the current owner; linked_at is history. The pair
    // (null, set) is what closing an account leaves behind, and it is true.
    await inRollback(async c => {
      await c.query(`INSERT INTO game_sessions (id, linked_at) VALUES ('ses_orphan', now())`);
      const { rows } = await c.query(
        `SELECT user_id, linked_at IS NOT NULL AS was_linked
         FROM game_sessions WHERE id = 'ses_orphan'`);
      assert.equal(rows[0].user_id, null);
      assert.equal(rows[0].was_linked, true);
    });
  });

  test('closing an account does not delete the play behind it', async () => {
    await inRollback(async c => {
      const { rows: [user] } = await c.query(`INSERT INTO app_users DEFAULT VALUES RETURNING id`);
      await c.query(
        `INSERT INTO game_sessions (id, user_id, linked_at) VALUES ('ses_keep', $1, now())`,
        [user.id]);
      await c.query(`INSERT INTO player_profiles (session_id, alpha_xp) VALUES ('ses_keep', 99)`);

      await c.query(`DELETE FROM app_users WHERE id = $1`, [user.id]);

      const { rows } = await c.query(
        `SELECT alpha_xp FROM player_profiles WHERE session_id = 'ses_keep'`);
      assert.equal(rows.length, 1, 'deleting the account took the progress with it');
      assert.equal(rows[0].alpha_xp, 99);
    });
  });

  test('deleting a session takes its own progress with it', async () => {
    await inRollback(async c => {
      await c.query(`INSERT INTO game_sessions (id) VALUES ('ses_gone')`);
      await c.query(`INSERT INTO player_profiles (session_id, alpha_xp) VALUES ('ses_gone', 5)`);
      await c.query(`INSERT INTO user_tip_states (session_id, tip_code) VALUES ('ses_gone', 'T1')`);
      await c.query(`DELETE FROM game_sessions WHERE id = 'ses_gone'`);

      for (const table of ['player_profiles', 'user_tip_states']) {
        const { rows } = await c.query(
          `SELECT count(*)::int AS n FROM ${table} WHERE session_id = 'ses_gone'`);
        assert.equal(rows[0].n, 0, `${table} outlived its session`);
      }
    });
  });

  test('telemetry accepts an event whose session is unknown', async () => {
    // Events arrive before, after, and independently of the rows they mention.
    // A sink that can reject a write loses data exactly when it matters.
    await inRollback(async c => {
      await c.query(
        `INSERT INTO game_events (event_id, event_type, event_version, occurred_at, session_id)
         VALUES ('evt_1', 'session.started', 1, now(), 'ses_never_existed')`);
      const { rows } = await c.query(`SELECT count(*)::int AS n FROM game_events`);
      assert.equal(rows[0].n, 1);
    });
  });

  test('the playable universe stays U.S. equities', async () => {
    await inRollback(async c => {
      await assert.rejects(
        c.query(`INSERT INTO securities (symbol, name, asset_class)
                 VALUES ('BTC', 'Bitcoin', 'CRYPTO')`),
        /securities_us_equity_only/);
    });
  });

  test('one daily tape decision per session per day', async () => {
    await inRollback(async c => {
      await c.query(`INSERT INTO game_sessions (id) VALUES ('ses_tape')`);
      const insert = `INSERT INTO daily_tape_submissions
        (session_id, tape_date, tape_id, action_code) VALUES ('ses_tape','2026-08-21','t1','HOLD')`;
      await c.query(insert);
      await assert.rejects(c.query(insert), /duplicate key|unique/i);
    });
  });

  test('no vendor auth construct survived into the schema', async () => {
    // Comments are excluded: the header explains what was removed and has to
    // be able to name it.
    const sql = readFileSync(SCHEMA, 'utf8')
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    for (const construct of ['auth.uid()', 'auth.users', 'TO authenticated', 'TO anon']) {
      assert.equal(sql.includes(construct), false, `${construct} is still in the schema`);
    }
  });
});
