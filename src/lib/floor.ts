// ─── The floor ────────────────────────────────────────────────────────────────
//
// §11: never two overlays. The tip system enforced this for tips; talking
// windows (the terminal voice) now share the same exclusivity, so the rule
// needs one arbiter both consult instead of two private ones that can disagree.
//
// "The floor" is who is allowed to address the player right now: at most one
// owner, tip or speech. Claiming is first-come; a denied claimant subscribes
// and retries when the floor releases. Nothing here reads a clock or an RNG —
// the floor changes only when an owner claims or releases it
// (terminalVoice.test.ts asserts that against this file's source).

export type FloorOwnerKind = 'TIP' | 'SPEECH';

export interface FloorOwner {
  kind: FloorOwnerKind;
  id: string;
}

let holder: FloorOwner | null = null;

// The most recent speech to hold the floor. The one-cursor rule hangs off
// this: the blinking cursor belongs to the latest thing the player was given
// to read, and only that thing, even after its speech has finished.
let lastSpeaker: string | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of [...listeners]) fn();
}

function sameOwner(a: FloorOwner, b: FloorOwner): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** Who holds the floor right now, or null when it is open. */
export function floorHolder(): FloorOwner | null {
  return holder;
}

/** The id of the most recent speech to have held the floor. */
export function lastSpeechId(): string | null {
  return lastSpeaker;
}

/**
 * Claim the floor. Returns false if someone else holds it — the caller waits
 * and retries on release rather than stacking. Re-claiming by the current
 * holder is idempotent and succeeds.
 */
export function claimFloor(owner: FloorOwner): boolean {
  if (holder !== null && !sameOwner(holder, owner)) return false;
  const changed = holder === null;
  holder = owner;
  if (owner.kind === 'SPEECH') lastSpeaker = owner.id;
  if (changed) notify();
  return true;
}

/** Release the floor. Only the current holder can release it. */
export function releaseFloor(owner: FloorOwner): void {
  if (holder !== null && sameOwner(holder, owner)) {
    holder = null;
    notify();
  }
}

/** Subscribe to floor changes (claim from open, release). */
export function subscribeFloor(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Test-only: put the room back the way it was found. */
export function resetFloorForTests(): void {
  holder = null;
  lastSpeaker = null;
  listeners.clear();
}
