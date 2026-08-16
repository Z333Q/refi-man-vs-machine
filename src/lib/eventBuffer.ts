// ─── Event buffer ─────────────────────────────────────────────────────────────
// A durable queue in front of the telemetry sink.
//
// Why this exists: the sink was pointed at placeholder credentials for the
// whole life of the project, every insert failed, and the failure was swallowed
// as best-effort. Nothing was recorded and nothing was recoverable, so three
// separate guards on shipped behaviour (Amendment 1's rollback trigger,
// Amendment 2's, and the engagement-floor review criterion) had no data to read
// and no backlog to read it from.
//
// Best-effort was the right call for the player, who must never see a telemetry
// error. It was the wrong call for the record. A queue keeps both: the player
// still sees nothing, and the events survive until a sink exists to take them.
//
// Deliberately storage-agnostic and free of DOM types, so the ordering,
// capacity and drain semantics are testable without a browser. The same shape
// serves whichever sink lands: Supabase today, a Cloud Run endpoint over Neon
// next, BigQuery later.

/** The subset of Storage this needs. Injected so tests need no DOM. */
export interface BufferStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A §51 event envelope. Opaque here: the buffer never inspects the payload. */
export interface EventEnvelope {
  event_id: string;
  [key: string]: unknown;
}

export const BUFFER_KEY = 'refi_event_buffer';

/**
 * Cap on retained events.
 *
 * localStorage is a handful of megabytes and shared with the rest of the game,
 * so the queue is bounded. When it overflows the OLDEST events are dropped, not
 * the newest: a full buffer means the sink has been down a long time, and the
 * recent events are the ones describing what the player is doing now.
 */
export const BUFFER_MAX = 500;

export function readBuffer(storage: BufferStorage): EventEnvelope[] {
  try {
    const raw = storage.getItem(BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything without an id cannot be de-duplicated on drain, so it is not a
    // usable record and is discarded rather than half-kept.
    return parsed.filter((e): e is EventEnvelope =>
      Boolean(e) && typeof e === 'object' && typeof (e as EventEnvelope).event_id === 'string');
  } catch {
    // Corrupt or unavailable storage must never break the game.
    return [];
  }
}

function write(storage: BufferStorage, events: EventEnvelope[]): boolean {
  try {
    storage.setItem(BUFFER_KEY, JSON.stringify(events));
    return true;
  } catch {
    return false;
  }
}

export interface BufferResult {
  /** Events now held, after any overflow trimming. */
  size: number;
  /** How many were dropped from the front to make room. */
  dropped: number;
  /** False when storage refused the write; the event is simply lost. */
  stored: boolean;
}

/**
 * Append one event. Order is preserved because envelopes carry `causation_id`
 * chains, and a queue that reordered them would corrupt the causal record it
 * exists to protect.
 */
export function bufferEvent(storage: BufferStorage, event: EventEnvelope): BufferResult {
  const current = readBuffer(storage);

  // An event already queued is never queued twice: a retry that fails after
  // the write would otherwise duplicate it on every attempt.
  if (current.some(e => e.event_id === event.event_id)) {
    return { size: current.length, dropped: 0, stored: true };
  }

  const next = [...current, event];
  const overflow = Math.max(0, next.length - BUFFER_MAX);
  const trimmed = overflow > 0 ? next.slice(overflow) : next;

  return { size: trimmed.length, dropped: overflow, stored: write(storage, trimmed) };
}

/**
 * Take everything and clear the queue.
 *
 * The caller owns delivery from here. If delivery fails it must call
 * `restoreBuffer` with what it could not send, which is why this does not
 * clear optimistically in two steps: a drain that cleared before the caller
 * had the events in hand would lose them to a refresh in between.
 */
export function drainBuffer(storage: BufferStorage): EventEnvelope[] {
  const events = readBuffer(storage);
  if (events.length > 0) {
    try { storage.removeItem(BUFFER_KEY); } catch { /* nothing to do */ }
  }
  return events;
}

/**
 * Put undelivered events back at the FRONT, ahead of anything queued while
 * delivery was in flight, so the causal order survives a failed flush.
 */
export function restoreBuffer(storage: BufferStorage, events: EventEnvelope[]): BufferResult {
  if (events.length === 0) {
    const size = readBuffer(storage).length;
    return { size, dropped: 0, stored: true };
  }
  const queuedSince = readBuffer(storage);
  const seen = new Set(events.map(e => e.event_id));
  const merged = [...events, ...queuedSince.filter(e => !seen.has(e.event_id))];
  const overflow = Math.max(0, merged.length - BUFFER_MAX);
  const trimmed = overflow > 0 ? merged.slice(overflow) : merged;
  return { size: trimmed.length, dropped: overflow, stored: write(storage, trimmed) };
}

// ─── Sink configuration ───────────────────────────────────────────────────────

export type SinkConfigStatus = 'OK' | 'MISSING' | 'PLACEHOLDER' | 'MALFORMED';

/**
 * Whether the configured sink can possibly work.
 *
 * The placeholder that broke telemetry passed every check anyone ran, because
 * the only check anyone ran was "is this variable non-empty". It was. This
 * distinguishes a credential that is present from one that is real, so the
 * failure is loud at startup in development instead of silent forever.
 *
 * Deliberately shape-based rather than a network call: startup must not depend
 * on reaching anything, and a wrong-but-well-formed URL is caught by the buffer
 * plus the drain path rather than by a probe that would slow every boot.
 */
export function sinkConfigStatus(url: string | undefined, key: string | undefined): SinkConfigStatus {
  if (!url || !key) return 'MISSING';

  const host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!host) return 'MALFORMED';

  // Words that only ever appear in a value nobody replaced.
  if (/placeholder|example|your-|yourproject|changeme|todo|xxx|dummy|sample/i.test(host)) {
    return 'PLACEHOLDER';
  }

  // A Supabase host is a 20-character project ref. Anything else on that domain
  // is not a project that exists. Custom domains are left alone.
  const supabase = host.match(/^([a-z0-9-]+)\.supabase\.(co|in)$/i);
  if (supabase && !/^[a-z]{20}$/.test(supabase[1])) return 'PLACEHOLDER';

  // The anon key is a JWT. A shape-correct string whose payload is not JSON is
  // a stand-in, which is exactly what shipped.
  const segments = key.split('.');
  if (segments.length !== 3) return 'MALFORMED';
  try {
    const pad = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
    const claims = JSON.parse(json);
    if (!claims || typeof claims !== 'object') return 'MALFORMED';
  } catch {
    return 'PLACEHOLDER';
  }

  return 'OK';
}

export function describeSinkStatus(status: SinkConfigStatus): string {
  switch (status) {
    case 'OK': return 'Telemetry sink configured.';
    case 'MISSING': return 'Telemetry sink not configured: no URL or key. Events will queue locally.';
    case 'PLACEHOLDER': return 'Telemetry sink is a PLACEHOLDER, not a real project. Nothing will be recorded. Events will queue locally until a real sink is configured.';
    case 'MALFORMED': return 'Telemetry sink credentials are malformed. Events will queue locally.';
  }
}
