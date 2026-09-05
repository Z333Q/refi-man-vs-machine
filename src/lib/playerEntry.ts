// Where a player lands when they press ENTER THE MARKET.
//
// The title screen used to route on `refi_tutorial_complete`. The tutorial
// stopped gating play on 2026-08 (CP1 coaches by being played), so a fresh
// player never set that flag, and the Hub's START RUN then sent them into the
// tutorial the title had deliberately routed around. Progression must not
// depend on a screen that is no longer on the path.
//
// The signal that actually matters is whether the player has ever made a
// decision. That is read from the run record first (the record is the truth),
// with a small flag as a fast path and the legacy tutorial flag honoured so an
// existing player is not re-routed into their first checkpoint.

import { listRunRecords } from './runRecord';

export const FIRST_DECISION_KEY = 'refi_first_decision';
const LEGACY_TUTORIAL_KEY = 'refi_tutorial_complete';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** True once the player has committed at least one real decision. */
export function hasMadeFirstDecision(): boolean {
  if (read(FIRST_DECISION_KEY) === '1') return true;
  if (read(LEGACY_TUTORIAL_KEY) === '1') return true;
  try {
    return listRunRecords().some(r => r.decisions.length > 0);
  } catch {
    return false;
  }
}

/** Called on commit. Idempotent. */
export function markFirstDecision(): void {
  try { localStorage.setItem(FIRST_DECISION_KEY, '1'); } catch { /* storage unavailable */ }
}
