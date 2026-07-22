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
  /** Verified identity that becomes the token `sub` (Firebase uid, else session id). */
  sub: string;
  /** Key the game's progress rows are stored under (session id today). */
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
 * NOTE: the SQL column/table names below reflect the game's current schema
 * (arena_runs, player_profiles, module_unlocks). Verify against the live
 * migrations before deploy; keep the mapping here (single place) if they drift.
 * Behavioral DimensionCode scores are deliberately NOT read — they never leave
 * the game (spec §6.6).
 */
export async function loadProgress(
  args: LoadProgressArgs,
): Promise<HandoffInput> {
  const { db, sessionId } = args;

  const completed = await db.query<{ arena_id: string }>(
    `select distinct arena_id
       from arena_runs
      where session_id = $1 and state = 'completed'`,
    [sessionId],
  );

  const profile = await db.query<{
    machine_beats: number | null;
    machine_attempts: number | null;
    machine_version_count: number | null;
  }>(
    `select machine_beats, machine_attempts, machine_version_count
       from player_profiles
      where session_id = $1
      limit 1`,
    [sessionId],
  );

  const unlock = await db.query<{ n: number }>(
    `select count(*)::int as n
       from module_unlocks
      where session_id = $1 and module_id = 'machine_builder'`,
    [sessionId],
  );

  const p = profile.rows[0];
  const beats = p?.machine_beats ?? 0;
  const attempts = p?.machine_attempts ?? 0;
  const machineBeatRate =
    attempts > 0 ? Math.min(1, Math.max(0, beats / attempts)) : null;

  const input: HandoffInput = {
    sub: args.sub,
    progressSnapshotId: args.progressSnapshotId,
    completedArenas: completed.rows.map((r) => r.arena_id),
    machineBuilderUnlocked: (unlock.rows[0]?.n ?? 0) > 0,
    machineVersionCount: p?.machine_version_count ?? 0,
    machineBeatRate,
    intendedDestination: args.intendedDestination,
  };
  return args.campaignSource
    ? { ...input, campaignSource: args.campaignSource }
    : input;
}
