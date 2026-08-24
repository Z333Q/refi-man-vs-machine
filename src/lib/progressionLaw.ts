// ─── Progression law ──────────────────────────────────────────────────────────
//
// Owner ruling, 2026-08-25. Two tiers, decided explicitly rather than left to
// emerge from wherever run records happened to be read:
//
//   1. ARENAS CHAIN ON COMPLETION. Finishing a regime opens the next one,
//      win or lose. The player should experience every regime; losing to the
//      machine is itself the lesson.
//
//   2. THE MACHINE BUILDER REQUIRES BRONZE. Building your own machine is
//      earned by completing at least one regime WITHOUT a critical risk
//      failure (Sec 29.2's Bronze: survive the risk budget). A blown-up run
//      still opens the next arena. It does not earn the Builder: the player
//      who could not keep a portfolio inside its limits is not ready to write
//      limits for a machine.
//
// This module is the single home of both rules. Screens derive open/locked
// state from these functions and never re-implement the arithmetic; the test
// file pins the ruling so a refactor cannot quietly change the law.

/** The slice of a run record the law reads. Structural, so tests stay small. */
export interface ProgressView {
  arenaId: string;
  completedAt: string | null;
  criticalFailure: boolean;
}

/** A regime counts as experienced once any run of it has finished. */
export function arenaCompleted(records: readonly ProgressView[], arenaId: string): boolean {
  return records.some(r => r.arenaId === arenaId && r.completedAt !== null);
}

/**
 * Whether the arena after `prevArenaId` is open. The first arena (no
 * predecessor) is always open.
 */
export function nextArenaOpen(
  records: readonly ProgressView[],
  prevArenaId: string | null,
): boolean {
  return prevArenaId === null || arenaCompleted(records, prevArenaId);
}

/** Bronze: a finished run that never breached the arena's critical drawdown. */
export function hasBronzeRun(records: readonly ProgressView[]): boolean {
  return records.some(r => r.completedAt !== null && !r.criticalFailure);
}

/** The Builder's gate, named for what it means rather than how it is computed. */
export function builderUnlocked(records: readonly ProgressView[]): boolean {
  return hasBronzeRun(records);
}

/** Player-facing requirement shown on the locked Builder entry. */
export const BUILDER_UNLOCK_REQUIREMENT =
  'COMPLETE A REGIME WITHOUT A CRITICAL RISK FAILURE';
