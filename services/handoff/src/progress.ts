import type { HandoffInput, IntendedDestination } from "./contract.js";

/**
 * Minimal query surface — satisfied by `pg.Pool`/`pg.Client`. Injected so the
 * mapping logic is unit-testable without a live database.
 */
export interface Queryable {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: R[] }>;
}

export interface LoadProgressArgs {
  db: Queryable;
  /** Player identity — session id today; auth uid once identity is upgraded. */
  sessionId: string;
  progressSnapshotId: string;
  intendedDestination: IntendedDestination;
  campaignSource?: string;
}

/**
 * Read the player's progress from Postgres and shape it into HandoffInput.
 * Claims are SERVER-derived (never client-asserted), so a tampered client
 * cannot inflate its alpha achievements on the token.
 *
 * SQL verified against db/migrations/0001_founding_schema.sql, which every
 * query here is exercised against by progress.integration.test.ts:
 *   - arena_runs(session_id, arena_id, state) — state vocabulary is
 *     schema-defaulted 'ACTIVE'; matched case-insensitively.
 *   - player_profiles(session_id, machine_beats, machine_attempts).
 *   - module_unlocks(session_id, module_code) — column is module_code.
 *   - player_machine_versions(session_id) — progress is keyed to the session
 *     directly. This used to join through an alpha_sessions link table that
 *     the founding schema does not have, and the failure mode is the reason
 *     the integration test exists: the join would throw, failSoft would
 *     swallow it, and every token would carry machineVersionCount 0 with
 *     nothing on fire.
 *
 * Each read FAILS SOFT to zero progress: the token is the funnel credential,
 * progress is only a waitlist-scoring bonus, so a schema drift must degrade
 * the score — never 500 the mint. Failures are logged for detection, and the
 * integration test is what stops that softness from hiding drift.
 * Behavioral DimensionCode scores are deliberately NOT read — they never leave
 * the game (spec §6.6).
 */
export async function loadProgress(
  args: LoadProgressArgs,
): Promise<HandoffInput> {
  const { db, sessionId } = args;

  const completedArenas = await failSoft(
    "completed_arenas",
    [] as string[],
    async () => {
      const completed = await db.query<{ arena_id: string }>(
        `select distinct arena_id
           from arena_runs
          where session_id = $1 and upper(state) = 'COMPLETED'`,
        [sessionId],
      );
      return completed.rows.map((r) => r.arena_id);
    },
  );

  const { beats, attempts } = await failSoft(
    "player_profile",
    { beats: 0, attempts: 0 },
    async () => {
      const profile = await db.query<{
        machine_beats: number | null;
        machine_attempts: number | null;
      }>(
        `select machine_beats, machine_attempts
           from player_profiles
          where session_id = $1
          limit 1`,
        [sessionId],
      );
      const p = profile.rows[0];
      return { beats: p?.machine_beats ?? 0, attempts: p?.machine_attempts ?? 0 };
    },
  );

  const machineBuilderUnlocked = await failSoft(
    "module_unlocks",
    false,
    async () => {
      const unlock = await db.query<{ n: number }>(
        `select count(*)::int as n
           from module_unlocks
          where session_id = $1 and module_code = 'machine_builder'`,
        [sessionId],
      );
      return (unlock.rows[0]?.n ?? 0) > 0;
    },
  );

  const machineVersionCount = await failSoft(
    "machine_versions",
    0,
    async () => {
      const versions = await db.query<{ n: number }>(
        `select count(*)::int as n
           from player_machine_versions
          where session_id = $1`,
        [sessionId],
      );
      return versions.rows[0]?.n ?? 0;
    },
  );

  const machineBeatRate =
    attempts > 0 ? Math.min(1, Math.max(0, beats / attempts)) : null;

  const input: HandoffInput = {
    sub: sessionId,
    progressSnapshotId: args.progressSnapshotId,
    completedArenas,
    machineBuilderUnlocked,
    machineVersionCount,
    machineBeatRate,
    intendedDestination: args.intendedDestination,
  };
  return args.campaignSource
    ? { ...input, campaignSource: args.campaignSource }
    : input;
}

async function failSoft<T>(
  label: string,
  fallback: T,
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch (err) {
    console.error(
      `loadProgress: ${label} read failed; degrading to zero progress:`,
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}
