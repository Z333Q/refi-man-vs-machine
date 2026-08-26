import type { Pool, PoolClient } from 'pg';
import {
  HttpError, RUN_RECORD_VERSION, MACHINE_RECORD_VERSION, TERMINAL_RESULTS,
  derivedMachineId, phaseOrdinal,
  type WireRunRecord, type WireDecision, type WireMachineVersion,
  type WireProfile, type WireTip, type WireTape, type WireEvent,
} from './contract.js';

// ─── Store ────────────────────────────────────────────────────────────────────
//
// Domain object -> PostgreSQL row, and row -> validated domain object. This is
// the only place either mapping exists (the Step 7 ruling removed it from the
// browser), so a schema change breaks here, loudly, instead of in a client.
//
// Two laws govern everything below.
//
// Ownership: every read and write is scoped by the session id from the
// x-alpha-session header, which is continuity, not authentication. An
// anonymous session may read and write its own progress. A session that has
// been linked to an account is out of this API's authority entirely: those
// operations must resolve a verified principal, so both reads and writes
// answer 403 until that path exists. Nothing crosses sessions, and a key
// collision across sessions is a 409, never a merge.
//
// Monotonicity: the mirror hears fire-and-forget writes that can arrive late
// and out of order, so no write may destroy history. Runs only ever extend
// (their decision list is append-only and their state moves forward), machine
// versions only ever gain a lock or completed arenas, and a stale write is a
// no-op rather than a regression. Contradiction — a different history claiming
// the same identity — is always 409.

// ─── Session boundary ─────────────────────────────────────────────────────────

/**
 * Resolve the session for a scoped read. No row means nothing to read (404,
 * which the client maps to NOT_FOUND); a linked session is refused (403)
 * because the header proves nothing about who is asking.
 */
export async function resolveSessionForRead(pool: Pool, sessionId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT user_id FROM game_sessions WHERE id = $1`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, 'unknown session');
  if (row.user_id !== null) {
    throw new HttpError(403, 'authentication_required');
  }
}

/**
 * Resolve the session for a scoped write, inside the caller's transaction.
 * A missing row is created (anonymous play starts here); an anonymous row is
 * touched; a linked row is refused before anything else happens — never
 * blindly upserted first.
 */
async function resolveSessionForWrite(c: PoolClient, sessionId: string): Promise<void> {
  const { rows } = await c.query(
    `SELECT user_id FROM game_sessions WHERE id = $1 FOR UPDATE`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) {
    await c.query(`INSERT INTO game_sessions (id) VALUES ($1)`, [sessionId]);
    return;
  }
  if (row.user_id !== null) {
    throw new HttpError(403, 'authentication_required');
  }
  await c.query(`UPDATE game_sessions SET last_seen_at = now() WHERE id = $1`, [sessionId]);
}

async function inTransaction<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (err) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
}

/** Numeric equality at a column's scale, so a value that round-trips through
 *  numeric(p,s) still equals the raw float the client re-sends. */
function sameAtScale(a: number | null, b: number | null, scale: number): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < 0.5 * Math.pow(10, -scale);
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return Date.parse(a) === Date.parse(b);
}

function iso(v: unknown): string {
  return new Date(v as string).toISOString();
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(pool: Pool, sessionId: string): Promise<WireProfile | null> {
  await resolveSessionForRead(pool, sessionId);
  const { rows } = await pool.query(
    `SELECT handle, alpha_xp, rank_code, machine_beats, machine_attempts,
            current_streak, best_streak, archetype, decision_streak, last_active_date
     FROM player_profiles WHERE session_id = $1`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) return null;

  const [dims, modules, ladder] = await Promise.all([
    pool.query(
      `SELECT dimension_code, score, sample_size
       FROM alpha_profile_dimensions WHERE session_id = $1`,
      [sessionId],
    ),
    pool.query(
      // The secondary key makes the order deterministic when several modules
      // arrive in one write and share an unlocked_at.
      `SELECT module_code FROM module_unlocks
       WHERE session_id = $1 ORDER BY unlocked_at, module_code`,
      [sessionId],
    ),
    pool.query(
      `SELECT machine_id, wins, losses, status
       FROM machine_ladder_progress WHERE session_id = $1`,
      [sessionId],
    ),
  ]);

  const dimensions: WireProfile['dimensions'] = {};
  for (const d of dims.rows) {
    dimensions[d.dimension_code as string] = {
      score: Number(d.score),
      sampleSize: Number(d.sample_size),
    };
  }
  const machineLadder: WireProfile['machineLadder'] = {};
  for (const l of ladder.rows) {
    machineLadder[l.machine_id as string] = {
      wins: Number(l.wins),
      losses: Number(l.losses),
      status: l.status as 'LOCKED' | 'ACTIVE' | 'DEFEATED',
    };
  }

  return {
    handle: row.handle ?? null,
    alphaXp: Number(row.alpha_xp),
    rankCode: row.rank_code as string,
    machineBeats: Number(row.machine_beats),
    machineAttempts: Number(row.machine_attempts),
    currentStreak: Number(row.current_streak),
    bestStreak: Number(row.best_streak),
    // The domain Archetype is never null; a legacy SQL null maps truthfully
    // to the explicit unclassified value rather than an impossible shape.
    archetype: (row.archetype as string | null) ?? 'UNCLASSIFIED',
    decisionStreak: Number(row.decision_streak),
    lastActiveDate: row.last_active_date
      ? new Date(row.last_active_date as string).toISOString().slice(0, 10)
      : null,
    dimensions,
    unlockedModules: modules.rows.map(m => m.module_code as string),
    machineLadder,
  };
}

export async function putProfile(pool: Pool, sessionId: string, p: WireProfile): Promise<void> {
  await inTransaction(pool, async c => {
    await resolveSessionForWrite(c, sessionId);

    await c.query(
      `INSERT INTO player_profiles
         (session_id, handle, alpha_xp, rank_code, machine_beats, machine_attempts,
          current_streak, best_streak, archetype, decision_streak, last_active_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (session_id) DO UPDATE SET
         handle = EXCLUDED.handle,
         alpha_xp = EXCLUDED.alpha_xp,
         rank_code = EXCLUDED.rank_code,
         machine_beats = EXCLUDED.machine_beats,
         machine_attempts = EXCLUDED.machine_attempts,
         current_streak = EXCLUDED.current_streak,
         best_streak = EXCLUDED.best_streak,
         archetype = EXCLUDED.archetype,
         decision_streak = EXCLUDED.decision_streak,
         last_active_date = EXCLUDED.last_active_date,
         updated_at = now()`,
      [sessionId, p.handle, p.alphaXp, p.rankCode, p.machineBeats, p.machineAttempts,
       p.currentStreak, p.bestStreak, p.archetype, p.decisionStreak, p.lastActiveDate],
    );

    // PUT semantics (accepted departure): the snapshot is the resource.
    // Dimensions and ladder rows not present in the snapshot are removed;
    // module unlock rows keep their original unlocked_at when they survive.
    await c.query(
      `DELETE FROM alpha_profile_dimensions
       WHERE session_id = $1 AND NOT (dimension_code = ANY($2::text[]))`,
      [sessionId, Object.keys(p.dimensions)],
    );
    for (const [code, d] of Object.entries(p.dimensions)) {
      await c.query(
        `INSERT INTO alpha_profile_dimensions (session_id, dimension_code, score, sample_size)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (session_id, dimension_code) DO UPDATE SET
           score = EXCLUDED.score, sample_size = EXCLUDED.sample_size, last_updated = now()`,
        [sessionId, code, d.score, d.sampleSize],
      );
    }

    await c.query(
      `DELETE FROM module_unlocks
       WHERE session_id = $1 AND NOT (module_code = ANY($2::text[]))`,
      [sessionId, p.unlockedModules],
    );
    for (const moduleCode of p.unlockedModules) {
      await c.query(
        `INSERT INTO module_unlocks (session_id, module_code, xp_at_unlock)
         VALUES ($1,$2,$3) ON CONFLICT (session_id, module_code) DO NOTHING`,
        [sessionId, moduleCode, p.alphaXp],
      );
    }

    await c.query(
      `DELETE FROM machine_ladder_progress
       WHERE session_id = $1 AND NOT (machine_id = ANY($2::text[]))`,
      [sessionId, Object.keys(p.machineLadder)],
    );
    for (const [machineId, l] of Object.entries(p.machineLadder)) {
      await c.query(
        `INSERT INTO machine_ladder_progress (session_id, machine_id, wins, losses, status)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (session_id, machine_id) DO UPDATE SET
           wins = EXCLUDED.wins, losses = EXCLUDED.losses, status = EXCLUDED.status`,
        [sessionId, machineId, l.wins, l.losses, l.status],
      );
    }
  });
}

// ─── Tips and guidance ────────────────────────────────────────────────────────

export async function putTip(pool: Pool, sessionId: string, tip: WireTip): Promise<void> {
  await inTransaction(pool, async c => {
    await resolveSessionForWrite(c, sessionId);
    // Provenance is only what the record establishes. A missing lastShownAt
    // stays missing (never now()), completedAt only ever comes from the
    // record, and show_count is untouched in both directions: a TipRecord
    // cannot prove that another display occurred, so counting one would be
    // invented data. Inserted rows start at zero proven displays.
    await c.query(
      `INSERT INTO user_tip_states
         (session_id, tip_code, tip_state, first_shown_at, last_shown_at, completed_at, show_count)
       VALUES ($1,$2,$3,$4::timestamptz,$4::timestamptz,$5,0)
       ON CONFLICT (session_id, tip_code) DO UPDATE SET
         tip_state = EXCLUDED.tip_state,
         last_shown_at = COALESCE(EXCLUDED.last_shown_at, user_tip_states.last_shown_at),
         completed_at = COALESCE(EXCLUDED.completed_at, user_tip_states.completed_at)`,
      [sessionId, tip.tipCode, tip.state, tip.lastShownAt ?? null, tip.completedAt ?? null],
    );
  });
}

export async function putGuidance(pool: Pool, sessionId: string, mode: string): Promise<void> {
  await inTransaction(pool, async c => {
    await resolveSessionForWrite(c, sessionId);
    await c.query(
      `INSERT INTO guidance_settings (session_id, guidance_mode)
       VALUES ($1,$2)
       ON CONFLICT (session_id) DO UPDATE SET
         guidance_mode = EXCLUDED.guidance_mode, updated_at = now()`,
      [sessionId, mode],
    );
  });
}

// ─── Daily tape ───────────────────────────────────────────────────────────────

export async function getTape(
  pool: Pool,
  sessionId: string,
  tapeDate: string,
): Promise<WireTape | null> {
  await resolveSessionForRead(pool, sessionId);
  const { rows } = await pool.query(
    `SELECT tape_id, action_code, player_score
     FROM daily_tape_submissions WHERE session_id = $1 AND tape_date = $2`,
    [sessionId, tapeDate],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    tapeDate,
    tapeId: row.tape_id as string,
    playerAction: row.action_code as string,
    score: Number(row.player_score ?? 0),
  };
}

export async function putTape(pool: Pool, sessionId: string, tape: WireTape): Promise<void> {
  await inTransaction(pool, async c => {
    await resolveSessionForWrite(c, sessionId);
    const { rows } = await c.query(
      `SELECT tape_id, action_code, player_score FROM daily_tape_submissions
       WHERE session_id = $1 AND tape_date = $2 FOR UPDATE`,
      [sessionId, tape.tapeDate],
    );
    const existing = rows[0];
    if (existing) {
      // "Identical" means every persisted decision fact agrees — the score
      // included. Quietly keeping one score while calling the request
      // identical would hide a real disagreement.
      const identical =
        existing.tape_id === tape.tapeId &&
        existing.action_code === tape.playerAction &&
        sameAtScale(Number(existing.player_score ?? 0), tape.score, 2);
      if (identical) return;
      // One decision per tape per session (§6.3). A different answer for the
      // same day is not an update; it is an attempt to re-decide.
      throw new HttpError(409, 'a different decision already exists for this tape date');
    }
    await c.query(
      `INSERT INTO daily_tape_submissions
         (session_id, tape_date, tape_id, action_code, player_score, score_revealed)
       VALUES ($1,$2,$3,$4,$5,true)`,
      [sessionId, tape.tapeDate, tape.tapeId, tape.playerAction, tape.score],
    );
  });
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

function rowToDecision(row: Record<string, unknown>): WireDecision {
  return {
    checkpointSequence: Number(row['checkpoint_sequence']),
    actionCode: row['action_code'] as string,
    thesisCode: (row['thesis_code'] as string | null) ?? null,
    confidence: row['confidence'] === null ? null : Number(row['confidence']),
    modulesConsulted: (row['modules_consulted'] as string[] | null) ?? [],
    turnoverCost: Number(row['turnover_cost'] ?? 0),
    scoreContribution: Number(row['score_contribution'] ?? 0),
    quality: (row['decision_quality'] as string | null) ?? 'NEUTRAL',
    behavioralFlags: (row['behavioral_flags'] as string[] | null) ?? [],
    machineActionCode: (row['machine_action_code'] as string | null) ?? 'HOLD',
    committedAt: row['committed_at'] ? iso(row['committed_at']) : null,
  };
}

export async function listRuns(pool: Pool, sessionId: string): Promise<WireRunRecord[]> {
  await resolveSessionForRead(pool, sessionId);
  const { rows } = await pool.query(
    `SELECT * FROM arena_runs WHERE session_id = $1 ORDER BY updated_at DESC LIMIT 50`,
    [sessionId],
  );
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id as string);
  const { rows: decisionRows } = await pool.query(
    `SELECT * FROM checkpoint_decisions
     WHERE run_id = ANY($1::text[]) ORDER BY checkpoint_sequence`,
    [ids],
  );
  const bySequence = new Map<string, WireDecision[]>();
  for (const d of decisionRows) {
    const runId = d.run_id as string;
    const list = bySequence.get(runId) ?? [];
    list.push(rowToDecision(d as Record<string, unknown>));
    bySequence.set(runId, list);
  }

  return rows.map((r): WireRunRecord => ({
    recordVersion: RUN_RECORD_VERSION,
    runId: r.id as string,
    seed: Number(r.seed),
    arenaId: r.arena_id as string,
    machineId: r.machine_id as string,
    state: r.state as string,
    result: (r.result as string | null) ?? 'ACTIVE',
    currentCheckpoint: Number(r.current_checkpoint),
    totalCheckpoints: Number(r.total_checkpoints),
    playerScore: Number(r.player_score ?? 0),
    machineScore: Number(r.machine_score ?? 0),
    criticalFailure: Boolean(r.critical_failure),
    criticalFailureCheckpoint:
      r.critical_failure_checkpoint === null ? null : Number(r.critical_failure_checkpoint),
    portfolioValue: Number(r.portfolio_value),
    cashWeight: Number(r.cash_weight),
    drawdown: Number(r.drawdown),
    volatility: Number(r.volatility),
    turnoverUsed: Number(r.turnover_used),
    decisions: bySequence.get(r.id as string) ?? [],
    startedAt: iso(r.started_at),
    updatedAt: iso(r.updated_at),
    completedAt: r.completed_at ? iso(r.completed_at) : null,
  }));
}

/**
 * The overlap law: where an incoming history covers decisions the store
 * already holds, they must be the same decisions. Everything about a
 * committed decision is immutable except two one-way enrichments — a thesis
 * attached after the commit, and a commit time a legacy record was missing.
 * Returns the enrichments to apply; throws 409 on any contradiction.
 */
function validateOverlap(
  existing: WireDecision[],
  incoming: WireDecision[],
): { sequence: number; thesisCode?: string; committedAt?: string }[] {
  const enrichments: { sequence: number; thesisCode?: string; committedAt?: string }[] = [];
  for (let i = 0; i < existing.length; i++) {
    const ex = existing[i] as WireDecision;
    const inc = incoming[i] as WireDecision;
    const contradiction =
      ex.checkpointSequence !== inc.checkpointSequence ||
      ex.actionCode !== inc.actionCode ||
      !sameAtScale(ex.confidence, inc.confidence, 3) ||
      JSON.stringify(ex.modulesConsulted) !== JSON.stringify(inc.modulesConsulted) ||
      !sameAtScale(ex.turnoverCost, inc.turnoverCost, 6) ||
      !sameAtScale(ex.scoreContribution, inc.scoreContribution, 2) ||
      ex.quality !== inc.quality ||
      JSON.stringify(ex.behavioralFlags) !== JSON.stringify(inc.behavioralFlags) ||
      ex.machineActionCode !== inc.machineActionCode;
    if (contradiction) {
      throw new HttpError(409,
        `decision ${String(ex.checkpointSequence)} contradicts the stored history`);
    }

    const enrichment: { sequence: number; thesisCode?: string; committedAt?: string } =
      { sequence: ex.checkpointSequence };
    let enriched = false;

    if (ex.thesisCode === null && inc.thesisCode !== null) {
      enrichment.thesisCode = inc.thesisCode;
      enriched = true;
    } else if (ex.thesisCode !== null && inc.thesisCode !== null
        && ex.thesisCode !== inc.thesisCode) {
      throw new HttpError(409,
        `decision ${String(ex.checkpointSequence)}: thesis contradicts the stored history`);
    }
    // inc null while ex has a value: stale record; the stored value stands.

    if (ex.committedAt === null && inc.committedAt !== null) {
      enrichment.committedAt = inc.committedAt;
      enriched = true;
    } else if (ex.committedAt !== null && inc.committedAt !== null
        && !sameInstant(ex.committedAt, inc.committedAt)) {
      throw new HttpError(409,
        `decision ${String(ex.checkpointSequence)}: commit time contradicts the stored history`);
    }

    if (enriched) enrichments.push(enrichment);
  }
  return enrichments;
}

/**
 * The run progression comparator: (currentCheckpoint, phase ordinal, decision
 * count, terminal-ness), lexicographic. Positive = incoming is ahead.
 */
function compareProgress(
  existing: { currentCheckpoint: number; state: string; decisionCount: number; result: string },
  incoming: { currentCheckpoint: number; state: string; decisionCount: number; result: string },
): number {
  const tuple = (r: typeof existing) => [
    r.currentCheckpoint,
    phaseOrdinal(r.state),
    r.decisionCount,
    TERMINAL_RESULTS.has(r.result) ? 1 : 0,
  ];
  const a = tuple(incoming);
  const b = tuple(existing);
  for (let i = 0; i < a.length; i++) {
    if ((a[i] as number) !== (b[i] as number)) return (a[i] as number) - (b[i] as number);
  }
  return 0;
}

async function insertDecisions(
  c: PoolClient,
  runId: string,
  decisions: WireDecision[],
): Promise<void> {
  for (const d of decisions) {
    await c.query(
      `INSERT INTO checkpoint_decisions
         (run_id, checkpoint_sequence, action_code, thesis_code, confidence,
          modules_consulted, decision_quality, score_contribution,
          machine_action_code, behavioral_flags, turnover_cost, committed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [runId, d.checkpointSequence, d.actionCode, d.thesisCode, d.confidence,
       d.modulesConsulted, d.quality, d.scoreContribution, d.machineActionCode,
       d.behavioralFlags, d.turnoverCost, d.committedAt],
    );
  }
}

export async function putRun(pool: Pool, sessionId: string, run: WireRunRecord): Promise<void> {
  await inTransaction(pool, async c => {
    await resolveSessionForWrite(c, sessionId);

    const { rows } = await c.query(
      `SELECT * FROM arena_runs WHERE id = $1 FOR UPDATE`,
      [run.runId],
    );
    const existing = rows[0];

    if (!existing) {
      await c.query(
        `INSERT INTO arena_runs
           (id, session_id, arena_id, machine_id, state, current_checkpoint,
            total_checkpoints, portfolio_value, cash_weight, drawdown, volatility,
            turnover_used, player_score, machine_score, result, critical_failure,
            critical_failure_checkpoint, seed, started_at, completed_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [run.runId, sessionId, run.arenaId, run.machineId, run.state,
         run.currentCheckpoint, run.totalCheckpoints, run.portfolioValue,
         run.cashWeight, run.drawdown, run.volatility, run.turnoverUsed,
         run.playerScore, run.machineScore, run.result, run.criticalFailure,
         run.criticalFailureCheckpoint, run.seed, run.startedAt, run.completedAt,
         run.updatedAt],
      );
      await insertDecisions(c, run.runId, run.decisions);
      return;
    }

    // Run ids are globally unique and minted by the client. The same id under
    // a different session is contradictory ownership, never a merge: the
    // header is continuity, not authentication, so the only safe answer is to
    // refuse (the ruled 409).
    if (existing.session_id !== sessionId) {
      throw new HttpError(409, 'this run id belongs to a different session');
    }

    // What a run IS never changes after it opens. A record claiming otherwise
    // is not a stale mirror write; it is a different run wearing this one's id.
    if (Number(existing.seed) !== run.seed
        || existing.arena_id !== run.arenaId
        || existing.machine_id !== run.machineId
        || Number(existing.total_checkpoints) !== run.totalCheckpoints
        || !sameInstant(iso(existing.started_at), run.startedAt)) {
      throw new HttpError(409, 'immutable run fields contradict the stored run');
    }

    const existingResult = (existing.result as string | null) ?? 'ACTIVE';
    const existingTerminal = TERMINAL_RESULTS.has(existingResult);
    const incomingTerminal = TERMINAL_RESULTS.has(run.result);
    if (existingTerminal && incomingTerminal && existingResult !== run.result) {
      throw new HttpError(409, 'a terminal result cannot mutate into another terminal result');
    }

    const { rows: decisionRows } = await c.query(
      `SELECT * FROM checkpoint_decisions
       WHERE run_id = $1 ORDER BY checkpoint_sequence FOR UPDATE`,
      [run.runId],
    );
    const existingDecisions = decisionRows.map(r => rowToDecision(r as Record<string, unknown>));

    // The stored history must be a prefix of the incoming history (or the
    // incoming, of the stored, when the write is stale). Contradiction in the
    // overlap is 409 either way; a shorter incoming history that agrees with
    // its overlap is simply stale, and stale is a no-op, never a truncation.
    const overlap = Math.min(existingDecisions.length, run.decisions.length);
    const enrichments = validateOverlap(
      existingDecisions.slice(0, overlap),
      run.decisions.slice(0, overlap),
    );

    // Enrichments are one-way and safe to apply even from an otherwise stale
    // record: a thesis or commit time observed once is true forever.
    for (const e of enrichments) {
      if (e.thesisCode !== undefined) {
        await c.query(
          `UPDATE checkpoint_decisions SET thesis_code = $3
           WHERE run_id = $1 AND checkpoint_sequence = $2`,
          [run.runId, e.sequence, e.thesisCode],
        );
      }
      if (e.committedAt !== undefined) {
        await c.query(
          `UPDATE checkpoint_decisions SET committed_at = $3
           WHERE run_id = $1 AND checkpoint_sequence = $2`,
          [run.runId, e.sequence, e.committedAt],
        );
      }
    }

    if (run.decisions.length < existingDecisions.length) {
      return; // Stale shorter history: validated, enriched, nothing destroyed.
    }

    // A terminal run does not come back to life: an ACTIVE record for a run
    // already concluded is stale, whatever else it carries.
    if (existingTerminal && !incomingTerminal) {
      return;
    }

    const appended = run.decisions.slice(existingDecisions.length);
    const progress = compareProgress(
      {
        currentCheckpoint: Number(existing.current_checkpoint),
        state: existing.state as string,
        decisionCount: existingDecisions.length,
        result: existingResult,
      },
      {
        currentCheckpoint: run.currentCheckpoint,
        state: run.state,
        decisionCount: run.decisions.length,
        result: run.result,
      },
    );

    if (appended.length === 0 && progress < 0) {
      return; // Same history, earlier state: stale, and state never regresses.
    }

    await insertDecisions(c, run.runId, appended);

    // The accepted record's scalar state wins going forward. completed_at,
    // once set, never moves (the client holds the same rule).
    await c.query(
      `UPDATE arena_runs SET
         state = $2, current_checkpoint = $3, portfolio_value = $4,
         cash_weight = $5, drawdown = $6, volatility = $7, turnover_used = $8,
         player_score = $9, machine_score = $10, result = $11,
         critical_failure = $12, critical_failure_checkpoint = $13,
         completed_at = COALESCE(arena_runs.completed_at, $14),
         updated_at = $15
       WHERE id = $1`,
      [run.runId, run.state, run.currentCheckpoint, run.portfolioValue,
       run.cashWeight, run.drawdown, run.volatility, run.turnoverUsed,
       run.playerScore, run.machineScore, run.result, run.criticalFailure,
       run.criticalFailureCheckpoint, run.completedAt, run.updatedAt],
    );
  });
}

// ─── Machine versions ─────────────────────────────────────────────────────────

export async function listMachineVersions(
  pool: Pool,
  sessionId: string,
): Promise<WireMachineVersion[]> {
  await resolveSessionForRead(pool, sessionId);
  const { rows } = await pool.query(
    `SELECT machine_name, version, configuration_json, build_hash, locked_at, created_at
     FROM player_machine_versions WHERE session_id = $1
     ORDER BY machine_name, version DESC`,
    [sessionId],
  );
  return rows.map((r): WireMachineVersion => {
    const cfg = r.configuration_json as {
      config?: Record<string, unknown>;
      installedModules?: string[];
      arenasCompleted?: string[];
    };
    const buildHash = r.build_hash as string;
    return {
      recordVersion: MACHINE_RECORD_VERSION,
      // Derived, never stored: the id IS the hash, and persisting a second
      // copy would let the two disagree.
      machineId: derivedMachineId(buildHash),
      machineName: r.machine_name as string,
      version: Number(r.version),
      config: cfg.config ?? {},
      installedModules: cfg.installedModules ?? [],
      buildHash,
      createdAt: iso(r.created_at),
      lockedAt: r.locked_at ? iso(r.locked_at) : null,
      arenasCompleted: cfg.arenasCompleted ?? [],
    };
  });
}

export async function putMachineVersion(
  pool: Pool,
  sessionId: string,
  record: WireMachineVersion,
): Promise<void> {
  await inTransaction(pool, async c => {
    await resolveSessionForWrite(c, sessionId);

    const { rows } = await c.query(
      `SELECT configuration_json, build_hash, locked_at, created_at
       FROM player_machine_versions
       WHERE session_id = $1 AND machine_name = $2 AND version = $3 FOR UPDATE`,
      [sessionId, record.machineName, record.version],
    );
    const existing = rows[0];

    const configurationJson = {
      config: record.config,
      installedModules: record.installedModules,
      arenasCompleted: record.arenasCompleted,
    };

    if (!existing) {
      await c.query(
        `INSERT INTO player_machine_versions
           (session_id, machine_name, version, configuration_json, build_hash, locked_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [sessionId, record.machineName, record.version, configurationJson,
         record.buildHash, record.lockedAt, record.createdAt],
      );
      return;
    }

    if (existing.build_hash !== record.buildHash) {
      // Two histories claiming the same version number. Refused, per ruling:
      // a version number that meant two builds would poison the whole record.
      throw new HttpError(409, 'this machine version exists with a different build hash');
    }
    if (!sameInstant(iso(existing.created_at), record.createdAt)) {
      throw new HttpError(409, 'createdAt contradicts the stored machine version');
    }
    // config and installedModules are pinned by the recomputed hash equality;
    // nothing to compare beyond it.

    // A lock is one-way: gaining one is progress, losing one is a stale
    // record, and two different locks are two contradictory histories.
    const existingLock = existing.locked_at ? iso(existing.locked_at) : null;
    let winningLock = existingLock;
    if (existingLock === null && record.lockedAt !== null) {
      winningLock = record.lockedAt;
    } else if (existingLock !== null && record.lockedAt !== null
        && !sameInstant(existingLock, record.lockedAt)) {
      throw new HttpError(409, 'lockedAt contradicts the stored machine version');
    }

    // arenasCompleted moves as a set, monotonically: a superset advances, a
    // subset is stale, and two divergent sets are a metadata conflict nobody
    // is entitled to auto-union.
    const existingArenas = new Set<string>(
      (existing.configuration_json as { arenasCompleted?: string[] }).arenasCompleted ?? [],
    );
    const incomingArenas = new Set(record.arenasCompleted);
    const incomingHasAll = [...existingArenas].every(a => incomingArenas.has(a));
    const existingHasAll = [...incomingArenas].every(a => existingArenas.has(a));
    let winningArenas: string[];
    if (incomingHasAll) {
      winningArenas = [...incomingArenas]; // equal or superset: advance
    } else if (existingHasAll) {
      winningArenas = [...existingArenas]; // subset: stale, keep stored
    } else {
      throw new HttpError(409, 'metadata_conflict: stored and incoming arenasCompleted diverge');
    }

    await c.query(
      `UPDATE player_machine_versions
       SET configuration_json = $4, locked_at = $5
       WHERE session_id = $1 AND machine_name = $2 AND version = $3`,
      [sessionId, record.machineName, record.version,
       { ...configurationJson, arenasCompleted: winningArenas }, winningLock],
    );
  });
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export async function insertEvent(pool: Pool, event: WireEvent): Promise<void> {
  // Append-only, idempotent on event_id: the client's durable buffer retries
  // deliveries, and a retry must not duplicate the event.
  await pool.query(
    `INSERT INTO game_events
       (event_id, event_type, event_version, occurred_at, alpha_player_id,
        formal_user_id, session_id, arena_id, run_id, checkpoint_id,
        simulation_timestamp, correlation_id, causation_id, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (event_id) DO NOTHING`,
    [event.event_id, event.event_type, event.event_version, event.occurred_at,
     event.alpha_player_id, event.formal_user_id, event.session_id, event.arena_id,
     event.run_id, event.checkpoint_id, event.simulation_timestamp,
     event.correlation_id, event.causation_id, event.payload],
  );
}
