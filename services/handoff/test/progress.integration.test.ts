import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { loadProgress } from "../src/progress.js";

// Integration test: every query loadProgress issues, run against the real
// founding schema.
//
// This exists because of a defect the mocked tests could not see. The
// machine-version count used to join through an alpha_sessions link table.
// The founding schema does not have one, so the query throws, and failSoft
// catches the throw and returns zero. Nothing crashes. Nothing alerts. Every
// handoff token quietly carries machineVersionCount 0, and the number is
// wrong for exactly the players who did the most work.
//
// Fail-soft reads are the right behaviour for a mint endpoint, and they are
// precisely why the query surface has to be checked against a real database:
// softness turns a schema error into a silent data error. A mock cannot catch
// that, because a mock agrees with whatever SQL you hand it.
//
// Skipped when DATABASE_URL is unset, so the ordinary unit suite stays offline.

const DATABASE_URL = process.env.DATABASE_URL;
// fileURLToPath, not URL.pathname: the latter percent-encodes spaces and this
// repository lives under a path that has them.
const SCHEMA = fileURLToPath(new URL(
  "../../../db/migrations/0001_founding_schema.sql",
  import.meta.url,
));

describe("loadProgress against the founding schema", {
  skip: DATABASE_URL ? false : "DATABASE_URL not set",
}, () => {
  let db: Client;

  before(async () => {
    db = new Client({ connectionString: DATABASE_URL });
    await db.connect();
    await db.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    await db.query(readFileSync(SCHEMA, "utf8"));

    // A player who has done real work, and a second one whose data must never
    // be counted into the first one's token.
    await db.query(`INSERT INTO game_sessions (id) VALUES ('ses_player'), ('ses_other')`);

    await db.query(`
      INSERT INTO player_profiles (session_id, machine_beats, machine_attempts)
      VALUES ('ses_player', 3, 12), ('ses_other', 99, 99)`);

    // The client mints run ids and supplies volatility; the schema deliberately
    // has no default for either, so this fixture writes what a real client writes.
    await db.query(`
      INSERT INTO arena_runs
        (id, session_id, arena_id, machine_id, state, total_checkpoints,
         portfolio_value, cash_weight, volatility, seed)
      VALUES
        ('run_a1b2c3d4e5f60718293a4b01', 'ses_player', 'covid_black_swan', 'refi_rules', 'COMPLETED', 22, 100000, 0.2, 0.16, 1),
        ('run_a1b2c3d4e5f60718293a4b02', 'ses_player', 'recovery_trap',    'refi_rules', 'COMPLETED', 6,  100000, 0.2, 0.16, 2),
        -- A second run of an arena already completed: the query is DISTINCT.
        ('run_a1b2c3d4e5f60718293a4b03', 'ses_player', 'covid_black_swan', 'refi_rules', 'COMPLETED', 22, 100000, 0.2, 0.16, 3),
        -- Still in flight, so not completed.
        ('run_a1b2c3d4e5f60718293a4b04', 'ses_player', 'inflation_shift',  'refi_rules', 'ACTIVE',    8,  100000, 0.2, 0.16, 4),
        ('run_a1b2c3d4e5f60718293a4b05', 'ses_other',  'banking_stress',   'refi_rules', 'COMPLETED', 8,  100000, 0.2, 0.16, 5)`);

    await db.query(`
      INSERT INTO module_unlocks (session_id, module_code)
      VALUES ('ses_player', 'machine_builder'), ('ses_player', 'correlation_map'),
             ('ses_other', 'machine_builder')`);

    await db.query(`
      INSERT INTO player_machine_versions
        (session_id, machine_name, version, configuration_json, build_hash)
      VALUES
        ('ses_player', 'Z333Q', 1, '{}'::jsonb, 'h1'),
        ('ses_player', 'Z333Q', 2, '{}'::jsonb, 'h2'),
        ('ses_player', 'Z333Q', 3, '{}'::jsonb, 'h3'),
        ('ses_other',  'OTHER', 1, '{}'::jsonb, 'h9')`);
  });

  after(async () => { await db?.end(); });

  test("every progress value is read from the database, not degraded to zero", async () => {
    const input = await loadProgress({
      db,
      sessionId: "ses_player",
      progressSnapshotId: "snap_1",
      intendedDestination: "ELIGIBILITY",
    });

    assert.deepEqual(
      [...input.completedArenas].sort(),
      ["covid_black_swan", "recovery_trap"],
      "completed arenas were wrong, or an in-flight run counted as finished",
    );
    assert.equal(input.machineBuilderUnlocked, true);
    assert.equal(
      input.machineVersionCount, 3,
      "machine versions read as 0 — the query does not match the schema",
    );
    assert.equal(input.machineBeatRate, 3 / 12);
    assert.equal(input.sub, "ses_player");
    assert.equal(input.progressSnapshotId, "snap_1");
  });

  test("one player's progress never counts another's", async () => {
    const input = await loadProgress({
      db,
      sessionId: "ses_other",
      progressSnapshotId: "snap_2",
      intendedDestination: "PAPER",
    });
    assert.deepEqual(input.completedArenas, ["banking_stress"]);
    assert.equal(input.machineVersionCount, 1);
    assert.equal(input.machineBeatRate, 1);
  });

  test("a session with no progress reads as empty rather than failing", async () => {
    await db.query(`INSERT INTO game_sessions (id) VALUES ('ses_fresh')`);
    const input = await loadProgress({
      db,
      sessionId: "ses_fresh",
      progressSnapshotId: "snap_3",
      intendedDestination: "ELIGIBILITY",
    });
    assert.deepEqual(input.completedArenas, []);
    assert.equal(input.machineBuilderUnlocked, false);
    assert.equal(input.machineVersionCount, 0);
    assert.equal(input.machineBeatRate, null, "no attempts is not a zero beat rate");
  });

  test("an unknown session reads as empty rather than throwing", async () => {
    const input = await loadProgress({
      db,
      sessionId: "ses_does_not_exist",
      progressSnapshotId: "snap_4",
      intendedDestination: "ELIGIBILITY",
    });
    assert.deepEqual(input.completedArenas, []);
    assert.equal(input.machineVersionCount, 0);
  });

  test("the beat rate stays inside 0 and 1 even if the counts disagree", async () => {
    // Defensive: beats above attempts would be a bug elsewhere, but the token
    // must never carry a rate above 1.
    await db.query(`INSERT INTO game_sessions (id) VALUES ('ses_odd')`);
    await db.query(`
      INSERT INTO player_profiles (session_id, machine_beats, machine_attempts)
      VALUES ('ses_odd', 5, 2)`);
    const input = await loadProgress({
      db,
      sessionId: "ses_odd",
      progressSnapshotId: "snap_5",
      intendedDestination: "ELIGIBILITY",
    });
    assert.equal(input.machineBeatRate, 1);
  });
});
