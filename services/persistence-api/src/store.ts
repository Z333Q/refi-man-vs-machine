import type { Pool, PoolClient } from 'pg';
import {
  HttpError, RUN_RECORD_VERSION, MACHINE_RECORD_VERSION,
  type WireRunRecord, type WireDecision, type WireMachineVersion,
  type WireProfile, type WireTip, type WireTape, type WireEvent,
} from './contract.js';

// ─── Store ────────────────────────────────────────────────────────────────────
//
// Domain object -> PostgreSQL row, and row -> validated domain object. This is
// the only place either mapping exists (the Step 7 ruling removed it from the
// browser), so a schema change breaks here, loudly, instead of in a client.
//
// Ownership model: every read and write is scoped by the session id from the
// x-alpha-session header. That id is continuity, not authentication — it
// proves nothing about who is asking, so nothing here may cross sessions, and
// a key collision across sessions is a 409, never a merge.
//
// Writes are idempotent: the same PUT twice leaves the same state. The client
// mirrors fire-and-forget and retries freely; a mirror that cannot be safely
// repeated would turn retries into corruption.

/** The session row must exist before anything references it. Idempotent. */
async function ensureSession(c: PoolClient, sessionId: string): Promise<void> {
  await c.query(
    `INSERT INTO game_sessions (id) VALUES ($1)
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now()`,
    [sessionId],
  );
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

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(pool: Pool, sessionId: string): Promise<WireProfile | null> {
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
      `SELECT module_code FROM module_unlocks WHERE session_id = $1 ORDER BY unlocked_at`,
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
    archetype: row.archetype ?? null,
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
    await ensureSession(c, sessionId);

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

    // PUT semantics: the snapshot is the resource. Dimensions and ladder rows
    // not present in the snapshot are removed; module unlock rows keep their
    // original unlocked_at when they survive.
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
    await ensureSession(c, sessionId);
    await c.query(
      `INSERT INTO user_tip_states (session_id, tip_code, tip_state, last_shown_at, completed_at)
       VALUES ($1,$2,$3, COALESCE($4::timestamptz, now()), $5)
       ON CONFLICT (session_id, tip_code) DO UPDATE SET
         tip_state = EXCLUDED.tip_state,
         last_shown_at = EXCLUDED.last_shown_at,
         completed_at = COALESCE(EXCLUDED.completed_at, user_tip_states.completed_at),
         show_count = user_tip_states.show_count + 1`,
      [sessionId, tip.tipCode, tip.state, tip.lastShownAt ?? null, tip.completedAt ?? null],
    );
  });
}

export async function putGuidance(pool: Pool, sessionId: string, mode: string): Promise<void> {
  await inTransaction(pool, async c => {
    await ensureSession(c, sessionId);
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
    await ensureSession(c, sessionId);
    const { rows } = await c.query(
      `SELECT tape_id, action_code FROM daily_tape_submissions
       WHERE session_id = $1 AND tape_date = $2`,
      [sessionId, tape.tapeDate],
    );
    const existing = rows[0];
    if (existing) {
      if (existing.tape_id === tape.tapeId && existing.action_code === tape.playerAction) {
        return; // The same call again: idempotent no-op.
      }
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
    committedAt: row['committed_at']
      ? new Date(row['committed_at'] as string).toISOString()
      : null,
  };
}

export async function listRuns(pool: Pool, sessionId: string): Promise<WireRunRecord[]> {
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
    result: (r.result as string | null) ?? null,
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
    startedAt: new Date(r.started_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
    completedAt: r.completed_at ? new Date(r.completed_at as string).toISOString() : null,
  }));
}

export async function putRun(pool: Pool, sessionId: string, run: WireRunRecord): Promise<void> {
  await inTransaction(pool, async c => {
    await ensureSession(c, sessionId);

    // Run ids are globally unique and minted by the client. The same id under
    // a different session is contradictory ownership, never a merge: the
    // header is continuity, not authentication, so the only safe answer is to
    // refuse (the ruled 409).
    const { rows } = await c.query(
      `SELECT session_id FROM arena_runs WHERE id = $1`,
      [run.runId],
    );
    if (rows[0] && rows[0].session_id !== sessionId) {
      throw new HttpError(409, 'this run id belongs to a different session');
    }

    await c.query(
      `INSERT INTO arena_runs
         (id, session_id, arena_id, machine_id, state, current_checkpoint,
          total_checkpoints, portfolio_value, cash_weight, drawdown, volatility,
          turnover_used, player_score, machine_score, result, critical_failure,
          critical_failure_checkpoint, seed, started_at, completed_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (id) DO UPDATE SET
         state = EXCLUDED.state,
         current_checkpoint = EXCLUDED.current_checkpoint,
         portfolio_value = EXCLUDED.portfolio_value,
         cash_weight = EXCLUDED.cash_weight,
         drawdown = EXCLUDED.drawdown,
         volatility = EXCLUDED.volatility,
         turnover_used = EXCLUDED.turnover_used,
         player_score = EXCLUDED.player_score,
         machine_score = EXCLUDED.machine_score,
         result = EXCLUDED.result,
         critical_failure = EXCLUDED.critical_failure,
         critical_failure_checkpoint = EXCLUDED.critical_failure_checkpoint,
         completed_at = EXCLUDED.completed_at,
         updated_at = EXCLUDED.updated_at`,
      [run.runId, sessionId, run.arenaId, run.machineId, run.state,
       run.currentCheckpoint, run.totalCheckpoints, run.portfolioValue,
       run.cashWeight, run.drawdown, run.volatility, run.turnoverUsed,
       run.playerScore, run.machineScore, run.result, run.criticalFailure,
       run.criticalFailureCheckpoint, run.seed, run.startedAt, run.completedAt,
       run.updatedAt],
    );

    // The decisions are replaced as a set: the record is the resource, and a
    // partial merge could stitch two different histories together.
    await c.query(`DELETE FROM checkpoint_decisions WHERE run_id = $1`, [run.runId]);
    for (const d of run.decisions) {
      await c.query(
        `INSERT INTO checkpoint_decisions
           (run_id, checkpoint_sequence, action_code, thesis_code, confidence,
            modules_consulted, decision_quality, score_contribution,
            machine_action_code, behavioral_flags, turnover_cost, committed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [run.runId, d.checkpointSequence, d.actionCode, d.thesisCode, d.confidence,
         d.modulesConsulted, d.quality, d.scoreContribution, d.machineActionCode,
         d.behavioralFlags, d.turnoverCost, d.committedAt],
      );
    }
  });
}

// ─── Machine versions ─────────────────────────────────────────────────────────

export async function listMachineVersions(
  pool: Pool,
  sessionId: string,
): Promise<WireMachineVersion[]> {
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
      machineId?: string;
    };
    const buildHash = r.build_hash as string;
    return {
      recordVersion: MACHINE_RECORD_VERSION,
      machineId: cfg.machineId ?? `mch_${buildHash.replace(/:/g, '').toLowerCase()}`,
      machineName: r.machine_name as string,
      version: Number(r.version),
      config: cfg.config ?? {},
      installedModules: cfg.installedModules ?? [],
      buildHash,
      createdAt: new Date(r.created_at as string).toISOString(),
      lockedAt: r.locked_at ? new Date(r.locked_at as string).toISOString() : null,
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
    await ensureSession(c, sessionId);

    const { rows } = await c.query(
      `SELECT build_hash, locked_at FROM player_machine_versions
       WHERE session_id = $1 AND machine_name = $2 AND version = $3`,
      [sessionId, record.machineName, record.version],
    );
    const existing = rows[0];
    if (existing && existing.build_hash !== record.buildHash) {
      // Two histories claiming the same version number. Refused, per ruling:
      // a version number that meant two builds would poison the whole record.
      throw new HttpError(409, 'this machine version exists with a different build hash');
    }

    const configurationJson = {
      machineId: record.machineId,
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

    // Same build: the owning session may update its own metadata. A lock is
    // one-way — an existing locked_at is never cleared or moved.
    await c.query(
      `UPDATE player_machine_versions
       SET configuration_json = $4,
           locked_at = COALESCE(locked_at, $5)
       WHERE session_id = $1 AND machine_name = $2 AND version = $3`,
      [sessionId, record.machineName, record.version, configurationJson, record.lockedAt],
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
     event.correlation_id, event.causation_id, event.payload ?? {}],
  );
}
