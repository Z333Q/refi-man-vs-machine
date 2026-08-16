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
import {
  bufferEvent, drainBuffer, restoreBuffer, sinkConfigStatus, describeSinkStatus,
  type BufferStorage, type EventEnvelope,
} from './eventBuffer';

// The §57 event types emitted so far. Extend as more mutations are wired.
// The onboarding.* pair is the top of the alpha funnel and feeds the same
// conversion-funnel metrics as the ReFi SEC-facing product (§7 / §63).
export type GameEventType =
  | 'session.started'
  | 'onboarding.attract_viewed'
  | 'onboarding.entered'
  | 'arena.started'
  | 'checkpoint.loaded'
  | 'decision.committed'
  | 'score.checkpoint.computed'
  | 'arena.passed'
  | 'arena.failed'
  | 'arena.machine_beaten'
  | 'score.run.computed'
  // §4 onboarding funnel: lightweight Alpha identity + handoff (§52/§59)
  | 'player.created'
  | 'player.progress_saved'
  | 'conversion.paper_cta_viewed'
  | 'conversion.paper_started'
  | 'conversion.refi_handoff_started'
  // Gesture telemetry (Addendum C section C.4).
  | 'gesture.started'
  | 'gesture.armed'
  | 'gesture.cancelled'
  | 'gesture.dead_zone_released'
  | 'gesture.committed'
  | 'gesture.focused_controls_opened';

// ─── Marketing-funnel attribution (§1.1 one-way bridge, §7) ──────────────────
// First-touch attribution from the ReFi marketing funnel: UTM params plus a
// `ref`/`aid` campaign id the SEC-facing shell can attach when it links into
// the game. Captured once, persisted, and carried in the analytics envelope
// so a later conversion (paper → handoff, §2.3) can be credited back to the
// funnel. This is marketing attribution only — never suitability data, and
// it stays in the game-analytics stream, separate from formal investor
// records (rules 10–11, §6.6).

export interface FunnelAttribution {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  ref?: string;
  landing?: string;
  capturedAt?: string;
}

const ATTRIBUTION_KEY = 'refi_attribution';

export function captureFunnelAttribution(): FunnelAttribution {
  // First-touch wins: never overwrite an existing capture.
  const existing = getFunnelAttribution();
  if (existing.capturedAt) return existing;

  const params = new URLSearchParams(window.location.search);
  const val = (k: string) => params.get(k) ?? undefined;
  const attr: FunnelAttribution = {
    source: val('utm_source'),
    medium: val('utm_medium'),
    campaign: val('utm_campaign'),
    content: val('utm_content'),
    term: val('utm_term'),
    ref: val('ref') ?? val('aid'),
    landing: window.location.pathname,
    capturedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attr));
  } catch {
    // localStorage unavailable — attribution is best-effort.
  }
  return attr;
}

export function getFunnelAttribution(): FunnelAttribution {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    if (raw) return JSON.parse(raw) as FunnelAttribution;
  } catch {
    // ignore malformed / unavailable storage
  }
  return {};
}

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

// ─── Sink delivery ────────────────────────────────────────────────────────────

/** localStorage, where available. Absent in SSR and locked-down browsers. */
function bufferStore(): BufferStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

let sinkReported = false;

/**
 * Report a misconfigured sink once, loudly, at first emit.
 *
 * The placeholder that broke telemetry survived because nothing ever said so.
 * It is a warning rather than a thrown error because the player must never be
 * stopped by a telemetry problem: the events queue instead.
 */
function reportSinkOnce(): void {
  if (sinkReported) return;
  sinkReported = true;
  const status = sinkConfigStatus(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
  if (status !== 'OK') console.warn(`[refi telemetry] ${describeSinkStatus(status)}`);
}

/** Send one envelope. Returns false on any failure, without throwing. */
async function deliver(envelope: EventEnvelope): Promise<boolean> {
  try {
    const { error } = await supabase.from('game_events').insert(envelope);
    if (error) {
      console.debug('game_events insert failed', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.debug('game_events insert threw', err);
    return false;
  }
}

/**
 * Try to deliver everything queued. Whatever fails goes back, in order.
 *
 * Called opportunistically on emit rather than on a timer: the first successful
 * send after an outage carries the backlog with it, and a sink that is still
 * down costs one failed request rather than a retry storm.
 */
async function flushBuffer(store: BufferStorage): Promise<void> {
  const queued = drainBuffer(store);
  if (queued.length === 0) return;

  const undelivered: EventEnvelope[] = [];
  for (let i = 0; i < queued.length; i++) {
    if (await deliver(queued[i])) continue;
    // First failure stops the flush: the sink is down again, and pushing the
    // rest would just fail in order while losing the ordering guarantee.
    undelivered.push(...queued.slice(i));
    break;
  }
  restoreBuffer(store, undelivered);
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
  reportSinkOnce();

  const store = bufferStore();

  // Best-effort for the player, durable for the record: a failed send queues
  // rather than vanishing, and the next success carries the backlog with it.
  if (!store) {
    await deliver(envelope);
    return;
  }

  await flushBuffer(store);

  if (!(await deliver(envelope))) {
    bufferEvent(store, envelope);
  }
}
