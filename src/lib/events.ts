// Game-event envelope emitter (§56 / §57, mandatory from G0 per §4.2).
//
// Every gameplay mutation emits a game_events row using the §56 envelope.
// This is append-only telemetry: it must never break gameplay, so writes
// are fire-and-forget and errors are swallowed (logged at debug level).
//
// Identity note: pre-auth (before G2 magic-link) there is no alpha_player,
// so alpha_player_id is null and session_id carries the localStorage
// session id ('ses_...'). The game_events columns are text (see the
// canonical_objects migration) so these §56 string ids persist verbatim.
//
// occurred_at vs simulation_timestamp: occurred_at is wall-clock (when the
// player acted); simulation_timestamp is the in-game point in time the
// checkpoint represents. Their separation is what makes "the machine never
// sees the future" auditable (§69 / §4.2).

import { supabase, getSessionId } from './supabase';

// The §57 event types emitted so far. Extend as more mutations are wired.
export type GameEventType =
  | 'session.started'
  | 'arena.started'
  | 'checkpoint.loaded'
  | 'decision.committed'
  | 'score.checkpoint.computed'
  | 'arena.passed'
  | 'arena.failed'
  | 'arena.machine_beaten'
  | 'score.run.computed'
  // Gesture telemetry (Addendum C section C.4). Cancellations carry a reason so
  // exploration can be told apart from a pointer-capture defect: a 10% cancel
  // rate from players trying the draw is healthy, the same rate from lost
  // capture is a bug.
  | 'gesture.started'
  | 'gesture.armed'
  | 'gesture.cancelled'
  | 'gesture.dead_zone_released'
  | 'gesture.committed'
  | 'gesture.focused_controls_opened';

interface EmitOptions {
  arenaId?: string | null;
  runId?: string | null;
  checkpointId?: string | null;
  simulationTimestamp?: string | null;
  correlationId?: string | null;
  alphaPlayerId?: string | null;
}

function mkId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

// A run's id is generated client-side at arena start and shared by every
// event in that run; it also serves as the default correlation id so a
// full run reads as one causal chain.
let currentRunId: string | null = null;
let lastEventId: string | null = null;

export function beginRunTelemetry(): string {
  currentRunId = mkId('run');
  return currentRunId;
}

export function endRunTelemetry(): void {
  currentRunId = null;
}

export function getCurrentRunId(): string | null {
  return currentRunId;
}

// COVID arena checkpoints carry a display label ('JAN 22'), not an ISO
// date. The single G0 arena is a 2020 scenario, so map the label to an
// ISO instant for simulation_timestamp; return null if it can't be parsed
// (versioned arena rows carry real timestamps from G3, §4.4).
const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

export function covidCrisisDayToISO(crisisDay: string | undefined): string | null {
  if (!crisisDay) return null;
  const m = crisisDay.trim().toUpperCase().match(/^([A-Z]{3})\s+(\d{1,2})$/);
  if (!m) return null;
  const month = MONTHS[m[1]];
  if (!month) return null;
  const day = m[2].padStart(2, '0');
  // COVID arena spans Jan–Mar 2020; markets close ~21:00 UTC (16:00 ET).
  return `2020-${month}-${day}T21:00:00Z`;
}

export async function emitEvent(
  eventType: GameEventType,
  payload: Record<string, unknown> = {},
  opts: EmitOptions = {},
): Promise<void> {
  const eventId = mkId('evt');
  const runId = opts.runId ?? currentRunId;
  const envelope = {
    event_id: eventId,
    event_type: eventType,
    event_version: 1,
    occurred_at: new Date().toISOString(),
    alpha_player_id: opts.alphaPlayerId ?? null,
    formal_user_id: null,
    session_id: getSessionId(),
    arena_id: opts.arenaId ?? null,
    run_id: runId,
    checkpoint_id: opts.checkpointId ?? null,
    simulation_timestamp: opts.simulationTimestamp ?? null,
    correlation_id: opts.correlationId ?? runId ?? getSessionId(),
    causation_id: lastEventId,
    payload,
  };

  lastEventId = eventId;

  try {
    const { error } = await supabase.from('game_events').insert(envelope);
    if (error) {
      // Telemetry is best-effort; never surface to the player.
      console.debug('game_events insert failed', error.message);
    }
  } catch (err) {
    console.debug('game_events insert threw', err);
  }
}
