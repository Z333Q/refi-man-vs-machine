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
  /** True when a touch was accepted by the persistence port. */
  persisted: boolean;
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
  let persisted = false;

  if (!readLocal(FIRST_TOUCH_KEY)) {
    // The first touch is recorded whether or not it names a campaign: an
    // unlabelled arrival is still an arrival, and "direct" is an answer.
    first = toTouch('first', parsed, now);
    writeLocal(FIRST_TOUCH_KEY, JSON.stringify(first));
    persisted = (await save(port, sessionId, first)) || persisted;
  } else if (isNewMeaningfulTouch(parsed, readLocal(LAST_MEANINGFUL_KEY))) {
    meaningful = toTouch('meaningful', parsed, now);
    writeLocal(LAST_MEANINGFUL_KEY, meaningfulKey(parsed));
    persisted = (await save(port, sessionId, meaningful)) || persisted;
  }

  // The first arrival also sets the meaningful baseline, so an immediate
  // reload of the same campaign link does not read as a second arrival.
  if (first && parsed.attributable) writeLocal(LAST_MEANINGFUL_KEY, meaningfulKey(parsed));

  return { parsed, first, meaningful, persisted };
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
