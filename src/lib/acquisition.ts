// ─── Acquisition capture ──────────────────────────────────────────────────────
//
// The browser half of attribution: read the environment, apply the rules in
// attribution.ts, remember what has already been recorded, and hand the result
// to the persistence port.
//
// Two laws, both enforced here rather than trusted to call sites:
//
//   FIRST TOUCH WINS, PERMANENTLY. Recorded once per browser session record
//   and never overwritten, whatever the player arrives through later. The
//   database agrees: 0003 holds a partial unique index on kind='first', so a
//   second first touch is refused even if this code is wrong.
//
//   MEANINGFUL TOUCHES ARE ARRIVALS, NOT ACTIVITY. A new one requires an
//   explicit acquisition source that differs from the last one seen. Starting
//   an arena, committing a decision or returning tomorrow produce none: those
//   are product events, and counting them as acquisition would make the
//   channel report describe engagement instead of arrivals.

import {
  parseAttribution, toTouch, isNewMeaningfulTouch, meaningfulKey,
  type AcquisitionTouch, type ParsedAttribution,
} from './attribution';
// Type-only: importing the persistence singleton here would drag the store
// selection, its vendor fallback and import.meta.env into every consumer,
// including tests that have no bundler. The port arrives as an argument.
import type { PersistencePort } from './persistence/types';
import { getSessionId } from './identity';
import type { AttributionContext } from './growth';

const FIRST_TOUCH_KEY = 'refi_touch_first';
const LAST_MEANINGFUL_KEY = 'refi_touch_meaningful';
const PENDING_KEY = 'refi_touch_pending';

/**
 * Cap on undelivered touches held on the device.
 *
 * The first touch is never dropped to make room: it is the one fact here that
 * cannot be reconstructed later, and a device that has been offline long
 * enough to hit this cap is exactly the device whose origin story matters.
 * Surplus meaningful touches are dropped newest-first instead.
 */
const PENDING_MAX = 50;

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or quota. Attribution is best-effort on this device; the
    // server-side uniqueness rule is what actually protects the first touch.
  }
}

/** Everything one arrival produced, for the caller that wants to report it. */
export interface CapturedAcquisition {
  parsed: ParsedAttribution;
  first: AcquisitionTouch | null;
  meaningful: AcquisitionTouch | null;
  /** True when this landing's own touch was acknowledged by the store. */
  persisted: boolean;
  /** Touches still undelivered after this landing, including earlier ones. */
  pending: number;
}

/** The non-sensitive acquisition context an event may carry. */
export function attributionContext(parsed: ParsedAttribution): AttributionContext {
  return { ...parsed.facts };
}

/**
 * Capture this arrival.
 *
 * Environment in, decision out: the URL and referrer are read here and nowhere
 * below, so the policy stays testable without a browser.
 */
export type TouchSink = Pick<PersistencePort, 'saveAcquisitionTouch'>;

export async function captureAcquisition(
  port: TouchSink,
  now: string = new Date().toISOString(),
): Promise<CapturedAcquisition> {
  const parsed = parseAttribution({
    url: window.location.href,
    referrer: typeof document === 'undefined' ? null : document.referrer,
    occurredAt: now,
  });

  const sessionId = getSessionId();
  let first: AcquisitionTouch | null = null;
  let meaningful: AcquisitionTouch | null = null;

  if (!readLocal(FIRST_TOUCH_KEY)) {
    // The first touch is recorded whether or not it names a campaign: an
    // unlabelled arrival is still an arrival, and "direct" is an answer.
    first = toTouch('first', parsed, now);
    writeLocal(FIRST_TOUCH_KEY, JSON.stringify(first));
    enqueuePending(first);
  } else if (isNewMeaningfulTouch(parsed, readLocal(LAST_MEANINGFUL_KEY))) {
    meaningful = toTouch('meaningful', parsed, now);
    writeLocal(LAST_MEANINGFUL_KEY, meaningfulKey(parsed));
    enqueuePending(meaningful);
  }

  // The first arrival also sets the meaningful baseline, so an immediate
  // reload of the same campaign link does not read as a second arrival.
  if (first && parsed.attributable) writeLocal(LAST_MEANINGFUL_KEY, meaningfulKey(parsed));

  // Every landing tries the backlog, not just its own touch. Without this, a
  // first touch whose delivery failed once would never be attempted again:
  // the local key says it was captured, and the row that actually matters
  // would be stranded on the device by one transient network error.
  const delivered = await flushPending(port, sessionId);
  const mine = first ?? meaningful;
  return {
    parsed,
    first,
    meaningful,
    persisted: mine ? delivered.some(t => sameTouch(t, mine)) : false,
    pending: pendingTouches().length,
  };
}

/** Undelivered touches, oldest first. */
export function pendingTouches(): AcquisitionTouch[] {
  const raw = readLocal(PENDING_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AcquisitionTouch[]) : [];
  } catch {
    return [];
  }
}

function enqueuePending(touch: AcquisitionTouch): void {
  const held = pendingTouches();
  if (held.length >= PENDING_MAX) {
    // Drop a meaningful touch, newest first, and never the first touch.
    const victim = held.map((t, i) => ({ t, i })).reverse()
      .find(({ t }) => t.kind === 'meaningful');
    if (!victim) return;
    held.splice(victim.i, 1);
  }
  writeLocal(PENDING_KEY, JSON.stringify([...held, touch]));
}

/**
 * Try to deliver the backlog, oldest first, and keep whatever does not land.
 *
 * A touch leaves the queue only on an acknowledged write, so the original
 * occurred_at travels with it across every retry: the arrival time is when the
 * player arrived, never when the network recovered. The first failure stops
 * the run, because the sink is down and pushing the rest only loses ordering.
 */
async function flushPending(port: TouchSink, sessionId: string): Promise<AcquisitionTouch[]> {
  const queued = pendingTouches();
  if (queued.length === 0) return [];

  const delivered: AcquisitionTouch[] = [];
  for (const touch of queued) {
    if (!(await save(port, sessionId, touch))) break;
    delivered.push(touch);
  }
  if (delivered.length > 0) {
    writeLocal(PENDING_KEY, JSON.stringify(queued.slice(delivered.length)));
  }
  return delivered;
}

/** Identity by value: the same arrival, whatever object carries it. */
function sameTouch(a: AcquisitionTouch, b: AcquisitionTouch): boolean {
  return a.kind === b.kind && a.occurredAt === b.occurredAt &&
    a.source === b.source && a.campaign === b.campaign && a.landingPath === b.landingPath;
}

async function save(
  port: TouchSink,
  sessionId: string,
  touch: AcquisitionTouch,
): Promise<boolean> {
  try {
    return await port.saveAcquisitionTouch(sessionId, touch);
  } catch {
    // Attribution must never be able to break a landing page.
    return false;
  }
}

/** The first touch this device recorded, if any. Read-only. */
export function firstTouch(): AcquisitionTouch | null {
  const raw = readLocal(FIRST_TOUCH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AcquisitionTouch;
  } catch {
    return null;
  }
}
