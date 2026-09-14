import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
// fileURLToPath, not URL.pathname: the latter percent-encodes spaces and this
// repository lives under a path that has them.
const MIGRATIONS = fileURLToPath(new URL('./migrations/', import.meta.url));

/** Every migration, in file order: the schema under test is the chain, not
 *  the founding file alone, or a later ALTER could drift unobserved. */
export function migrationsSql(): string {
  return readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()
    .map(f => readFileSync(MIGRATIONS + f, 'utf8')).join('\n');
}

describe('founding schema', { skip: DATABASE_URL ? false : 'DATABASE_URL not set' }, () => {
  let db: Client;

  before(async () => {
    db = new Client({ connectionString: DATABASE_URL });
    await db.connect();
    // A clean slate each run: the schema is applied fresh rather than migrated.
    await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await db.query(migrationsSql());
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

  test('a client-minted run id round-trips exactly', async () => {
    // The Run Record, the telemetry envelope, and this row all carry the id
    // the client minted when the run began. If the database rewrote it, the
    // mirror would hold a run nothing else can name.
    await inRollback(async c => {
      await c.query(`INSERT INTO game_sessions (id) VALUES ('ses_run')`);
      const runId = 'run_0123456789abcdef01234567';
      await c.query(
        `INSERT INTO arena_runs (id, session_id, arena_id, machine_id, total_checkpoints,
                                 portfolio_value, cash_weight, volatility, seed)
         VALUES ($1, 'ses_run', 'covid', 'spy_benchmark', 22, 100000, 0.10, 0.185, 42)`,
        [runId]);
      const { rows } = await c.query(
        `SELECT id, volatility, critical_failure_checkpoint, updated_at
         FROM arena_runs WHERE id=$1`, [runId]);
      assert.equal(rows[0].id, runId, 'run id was rewritten by the database');
      assert.equal(Number(rows[0].volatility), 0.185);
      assert.equal(rows[0].critical_failure_checkpoint, null);
      assert.notEqual(rows[0].updated_at, null);

      // Volatility has no default on purpose: zero is a real claim, and a
      // writer that omits the value must fail rather than manufacture one.
      await assert.rejects(
        c.query(
          `INSERT INTO arena_runs (id, session_id, arena_id, machine_id, total_checkpoints,
                                   portfolio_value, cash_weight, seed)
           VALUES ('run_missing_volatility_000', 'ses_run', 'covid', 'spy_benchmark', 22,
                   100000, 0.10, 43)`),
        /volatility/);
    });
  });

  test('a decision without a commit time stays null instead of gaining a fabricated one', async () => {
    await inRollback(async c => {
      await c.query(`INSERT INTO game_sessions (id) VALUES ('ses_dec')`);
      const runId = 'run_fedcba9876543210fedcba98';
      await c.query(
        `INSERT INTO arena_runs (id, session_id, arena_id, machine_id, total_checkpoints,
                                 portfolio_value, cash_weight, volatility, seed)
         VALUES ($1, 'ses_dec', 'covid', 'spy_benchmark', 22, 100000, 0.10, 0, 7)`,
        [runId]);
      await c.query(
        `INSERT INTO checkpoint_decisions (run_id, checkpoint_sequence, action_code, turnover_cost)
         VALUES ($1, 1, 'HOLD', 0.004)`, [runId]);
      const { rows } = await c.query(
        `SELECT run_id, committed_at, turnover_cost FROM checkpoint_decisions WHERE run_id=$1`,
        [runId]);
      assert.equal(rows[0].run_id, runId);
      assert.equal(rows[0].committed_at, null,
        'a commit time the player never made was fabricated by a default');
      assert.equal(Number(rows[0].turnover_cost), 0.004);
    });
  });

  test('no vendor auth construct survived into the schema', async () => {
    // Comments are excluded: the header explains what was removed and has to
    // be able to name it.
    const sql = migrationsSql()
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    for (const construct of ['auth.uid()', 'auth.users', 'TO authenticated', 'TO anon']) {
      assert.equal(sql.includes(construct), false, `${construct} is still in the schema`);
    }
  });
});

// ─── Growth data foundation (0003) ───────────────────────────────────────────
//
// The growth schema makes four promises the DDL cannot keep on its own: that a
// handle is spelled one way, that a retired handle is never handed to anybody
// else, that a session has exactly one origin story, and that an experiment
// cohort is decided once. Each is checked here against a real database,
// because each is enforced by a constraint whose absence would be silent.

describe('growth data foundation', { skip: DATABASE_URL ? false : 'DATABASE_URL not set' }, () => {
  let db: Client;

  before(async () => {
    db = new Client({ connectionString: DATABASE_URL });
    await db.connect();
    await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await db.query(migrationsSql());
  });

  after(async () => { await db?.end(); });

  async function inRollback(fn: (c: Client) => Promise<void>) {
    await db.query('BEGIN');
    try { await fn(db); } finally { await db.query('ROLLBACK'); }
  }

  async function newUser(c: Client): Promise<string> {
    const { rows } = await c.query(`INSERT INTO app_users DEFAULT VALUES RETURNING id`);
    return rows[0].id;
  }

  /**
   * Expect one statement to be rejected, without poisoning the block around it.
   *
   * A failed statement aborts the whole transaction in PostgreSQL, so a test
   * that checks several constraints in one rollback block would see every
   * later statement fail with 25P02 and pass or fail for the wrong reason.
   * Each expected failure gets its own savepoint.
   */
  async function rejects(c: Client, run: () => Promise<unknown>, re: RegExp, msg?: string) {
    await c.query('SAVEPOINT expect_failure');
    try {
      await assert.rejects(run(), re, msg);
    } finally {
      await c.query('ROLLBACK TO SAVEPOINT expect_failure');
    }
  }

  test('the handle law is the column, not a convention', async () => {
    await inRollback(async c => {
      const user = await newUser(c);
      const claim = (handle: string) =>
        c.query(`INSERT INTO public_player_profiles (user_id, handle) VALUES ($1, $2)`,
          [user, handle]);

      for (const bad of [
        'ab',                    // shorter than three
        'a'.repeat(21),          // longer than twenty
        'Z333Q',                 // uppercase: canonical storage is lowercase
        '_leading',              // must start alphanumeric
        'trailing_',             // must end alphanumeric
        'has space',
        'has-hyphen',
        'émoji_free',
      ]) {
        await rejects(c, () => claim(bad), /handle_check/, `"${bad}" was accepted as a handle`);
      }

      await claim('z333q');
      const { rows } = await c.query(`SELECT handle FROM public_player_profiles WHERE user_id=$1`,
        [user]);
      assert.equal(rows[0].handle, 'z333q');
    });
  });

  test('two people cannot hold the same handle', async () => {
    await inRollback(async c => {
      const [a, b] = [await newUser(c), await newUser(c)];
      await c.query(`INSERT INTO public_player_profiles (user_id, handle) VALUES ($1,'taken')`, [a]);
      await rejects(c,
        () => c.query(`INSERT INTO public_player_profiles (user_id, handle) VALUES ($1,'taken')`, [b]),
        /duplicate key|unique/i);
    });
  });

  test('visibility ships with only the states the API can enforce', async () => {
    await inRollback(async c => {
      const user = await newUser(c);
      await rejects(c,
        () => c.query(`INSERT INTO public_player_profiles (user_id, handle, visibility)
                       VALUES ($1, 'friendly', 'friends')`, [user]),
        /visibility_check/,
        'friends visibility shipped before a friend graph existed');

      await c.query(`INSERT INTO public_player_profiles (user_id, handle, visibility)
                     VALUES ($1, 'quiet', 'private')`, [user]);
    });
  });

  // The architectural invariant, not an implementation detail: the profile is
  // the person's page and goes when they do, the handle is a reservation and
  // stays. Cascading the history too would release a retired name to the next
  // person who asked for it.
  test('a deleted account takes its profile and leaves its handle reserved', async () => {
    await inRollback(async c => {
      const user = await newUser(c);
      await c.query(`INSERT INTO public_player_profiles (user_id, handle) VALUES ($1,'departed')`,
        [user]);
      await c.query(`INSERT INTO player_handle_history (handle, user_id) VALUES ('departed', $1)`,
        [user]);

      await c.query(`DELETE FROM app_users WHERE id = $1`, [user]);

      const { rows: profiles } = await c.query(
        `SELECT count(*)::int AS n FROM public_player_profiles WHERE handle = 'departed'`);
      assert.equal(profiles[0].n, 0, 'the public profile outlived the account');

      const { rows: history } = await c.query(
        `SELECT user_id, released_at FROM player_handle_history WHERE handle = 'departed'`);
      assert.equal(history.length, 1, 'the handle reservation was deleted with the account');
      assert.equal(history[0].user_id, null, 'the reservation still names a user that is gone');

      // And it is still reserved against the next claimant.
      const next = await newUser(c);
      await rejects(c,
        () => c.query(`INSERT INTO player_handle_history (handle, user_id) VALUES ('departed', $1)`,
          [next]),
        /duplicate key|unique/i,
        'a retired handle was reassigned');
    });
  });

  test('one account cannot hold two current handles', async () => {
    await inRollback(async c => {
      const user = await newUser(c);
      await c.query(`INSERT INTO player_handle_history (handle, user_id) VALUES ('first', $1)`,
        [user]);
      await rejects(c,
        () => c.query(`INSERT INTO player_handle_history (handle, user_id) VALUES ('second', $1)`,
          [user]),
        /one_current/,
        'a rename left two live reservations behind');

      // A rename closes the old row and opens the new one, in one transaction.
      await c.query(`UPDATE player_handle_history SET released_at = now() WHERE handle = 'first'`);
      await c.query(`INSERT INTO player_handle_history (handle, user_id) VALUES ('second', $1)`,
        [user]);
      const { rows } = await c.query(
        `SELECT count(*)::int AS n FROM player_handle_history
         WHERE user_id = $1 AND released_at IS NULL`, [user]);
      assert.equal(rows[0].n, 1);
    });
  });

  test('a session has one first touch and as many meaningful ones as it earns', async () => {
    await inRollback(async c => {
      await c.query(`INSERT INTO game_sessions (id) VALUES ('ses_touch')`);
      const touch = (kind: string, source: string) =>
        c.query(`INSERT INTO acquisition_touches (session_id, kind, source)
                 VALUES ('ses_touch', $1, $2)`, [kind, source]);

      await touch('first', 'creator_link');
      await rejects(c, () => touch('first', 'later_link'), /one_first/,
        'a second origin story was written for one session');

      await touch('meaningful', 'challenge');
      await touch('meaningful', 'daily_tape');
      await rejects(c, () => touch('bookmark', 'x'), /kind_check/);

      const { rows } = await c.query(
        `SELECT count(*)::int AS n FROM acquisition_touches WHERE session_id='ses_touch'`);
      assert.equal(rows[0].n, 3);
    });
  });

  test('attribution is session-scoped and reaches the person through the link', async () => {
    // Never copied onto the user: claiming an identity must not rewrite how
    // the player arrived, and there is only one path to the fact.
    await inRollback(async c => {
      const user = await newUser(c);
      await c.query(`INSERT INTO game_sessions (id, user_id, linked_at)
                     VALUES ('ses_attr', $1, now())`, [user]);
      await c.query(`INSERT INTO acquisition_touches (session_id, kind, source, campaign)
                     VALUES ('ses_attr', 'first', 'x', 'launch')`);

      const { rows } = await c.query(
        `SELECT t.campaign FROM acquisition_touches t
         JOIN game_sessions s ON s.id = t.session_id WHERE s.user_id = $1`, [user]);
      assert.equal(rows[0].campaign, 'launch');

      const { rows: cols } = await c.query(
        `SELECT count(*)::int AS n FROM information_schema.columns
         WHERE table_name = 'acquisition_touches' AND column_name = 'user_id'`);
      assert.equal(cols[0].n, 0, 'attribution grew a second source of truth');
    });
  });

  test('deleting a session takes its touches and assignments with it', async () => {
    await inRollback(async c => {
      await c.query(`INSERT INTO game_sessions (id) VALUES ('ses_bye')`);
      await c.query(`INSERT INTO acquisition_touches (session_id, kind) VALUES ('ses_bye','first')`);
      await c.query(`INSERT INTO experiment_assignments (session_id, experiment_id, variant)
                     VALUES ('ses_bye', 'hero_copy', 'B')`);
      await c.query(`DELETE FROM game_sessions WHERE id = 'ses_bye'`);

      for (const table of ['acquisition_touches', 'experiment_assignments']) {
        const { rows } = await c.query(
          `SELECT count(*)::int AS n FROM ${table} WHERE session_id = 'ses_bye'`);
        assert.equal(rows[0].n, 0, `${table} outlived its session`);
      }
    });
  });

  test('a campaign outlives the creator who made it', async () => {
    await inRollback(async c => {
      const creator = await newUser(c);
      await c.query(`INSERT INTO growth_campaigns (slug, kind, creator_id)
                     VALUES ('kiu_desk', 'creator', $1)`, [creator]);
      await rejects(c,
        () => c.query(`INSERT INTO growth_campaigns (slug, kind) VALUES ('paid_x', 'billboard')`),
        /kind_check/);

      await c.query(`DELETE FROM app_users WHERE id = $1`, [creator]);
      const { rows } = await c.query(
        `SELECT creator_id FROM growth_campaigns WHERE slug = 'kiu_desk'`);
      assert.equal(rows.length, 1, 'deleting the creator deleted how players arrived');
      assert.equal(rows[0].creator_id, null);
    });
  });

  test('an attributed campaign cannot be deleted out from under its arrivals', async () => {
    await inRollback(async c => {
      const { rows: [campaign] } = await c.query(
        `INSERT INTO growth_campaigns (slug, kind) VALUES ('partner_a','partner') RETURNING id`);
      await c.query(`INSERT INTO game_sessions (id) VALUES ('ses_camp')`);
      await c.query(`INSERT INTO acquisition_touches (session_id, kind, campaign_id)
                     VALUES ('ses_camp', 'first', $1)`, [campaign.id]);
      await rejects(c,
        () => c.query(`DELETE FROM growth_campaigns WHERE id = $1`, [campaign.id]),
        /foreign key|violates/i);
    });
  });

  test('an experiment cohort is decided once per session', async () => {
    await inRollback(async c => {
      await c.query(`INSERT INTO game_sessions (id) VALUES ('ses_exp')`);
      await c.query(`INSERT INTO experiment_assignments (session_id, experiment_id, variant)
                     VALUES ('ses_exp', 'start_cta', 'A')`);
      await rejects(c,
        () => c.query(`INSERT INTO experiment_assignments (session_id, experiment_id, variant)
                       VALUES ('ses_exp', 'start_cta', 'B')`),
        /duplicate key|unique/i,
        'a player was moved between variants mid-test');

      // A different experiment is a different row, not a conflict.
      await c.query(`INSERT INTO experiment_assignments (session_id, experiment_id, variant)
                     VALUES ('ses_exp', 'share_cta', 'B')`);
    });
  });

  test('the outbox hands back the backlog in the order it was written', async () => {
    await inRollback(async c => {
      for (const topic of ['a', 'b', 'c']) {
        await c.query(`INSERT INTO outbox_events (topic, payload) VALUES ($1, '{}'::jsonb)`,
          [topic]);
      }
      await c.query(`UPDATE outbox_events SET processed_at = now() WHERE topic = 'a'`);
      const { rows } = await c.query(
        `SELECT topic FROM outbox_events WHERE processed_at IS NULL ORDER BY id`);
      assert.deepEqual(rows.map(r => r.topic), ['b', 'c']);
    });
  });

  test('an event that reports no experiments differs from one that reported nothing', async () => {
    await inRollback(async c => {
      await c.query(
        `INSERT INTO game_events (event_id, event_type, event_version, occurred_at)
         VALUES ('evt_pre_d', 'arena.started', 1, now())`);
      await c.query(
        `INSERT INTO game_events (event_id, event_type, event_version, occurred_at,
                                  experiment_assignments)
         VALUES ('evt_post_d', 'arena.started', 1, now(), '{"hero_copy":"B"}'::jsonb)`);

      const { rows } = await c.query(
        `SELECT event_id, experiment_assignments FROM game_events WHERE event_id = $1`,
        ['evt_pre_d']);
      assert.equal(rows[0].experiment_assignments, null,
        'an event gained an experiment claim its emitter never made');

      const { rows: reported } = await c.query(
        `SELECT experiment_assignments FROM game_events WHERE event_id = $1`, ['evt_post_d']);
      assert.deepEqual(reported[0].experiment_assignments, { hero_copy: 'B' });
    });
  });
});

// ─── Migration order (no database required) ──────────────────────────────────

describe('migration ownership', () => {
  const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();

  test('no migration references a table a later migration creates', () => {
    // The cross-migration law, checked against the files rather than the
    // document: 0003 cannot point at challenges (0004) or seasons (0005),
    // because a foreign key to a table that does not exist yet makes the
    // migration unappliable in the order it actually runs.
    const created = new Set<string>();
    for (const file of files) {
      const sql = readFileSync(MIGRATIONS + file, 'utf8')
        .split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
      for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
        created.add(m[1].toLowerCase());
      }
      for (const m of sql.matchAll(/REFERENCES\s+([a-z_][a-z0-9_]*)/gi)) {
        const target = m[1].toLowerCase();
        assert.ok(created.has(target),
          `${file} references ${target}, which no migration up to and including it creates`);
      }
    }
  });

  test('0003 owns its tables and nothing a later PR owns', () => {
    const sql = readFileSync(MIGRATIONS + '0003_growth_data_foundation.sql', 'utf8');
    const created = [...sql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z_][a-z0-9_]*)/gi)]
      .map(m => m[1].toLowerCase()).sort();
    assert.deepEqual(created, [
      'acquisition_touches', 'experiment_assignments', 'growth_campaigns',
      'outbox_events', 'player_handle_history', 'public_player_profiles',
    ]);

    const body = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    for (const later of [
      'challenges', 'challenge_attempts', 'result_cards', 'seasons', 'season_arenas',
      'ranked_attempts', 'ranked_decisions', 'season_results', 'community_links',
      'crews', 'crew_members', 'product_state_projections',
    ]) {
      assert.equal(new RegExp(`\\b${later}\\b`).test(body), false,
        `0003 names ${later}, which a later migration owns`);
    }
  });
});
