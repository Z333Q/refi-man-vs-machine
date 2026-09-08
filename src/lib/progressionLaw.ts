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

// ─── The TACO gate (owner ruling 2026-09-06) ─────────────────────────────────
//
// The final boss was reachable through Autopsy → Alpha Profile → Basket Writer
// → LOCK BASKET, and its unlock screen printed eight prerequisites as a fixture
// no code verified. The gate is now derived, here, from the four stores that
// hold the evidence. The spec 5 journey runs COVID, Recovery, Inflation,
// Banking, Builder, stress test, Gauntlet, then TACO; MACHINE SEASON and
// POLICY WRITER do not exist and are not required.

export const TACO_ARENA_ID = 'taco_protocol';

/** The regimes that must be finished, win or lose, before TACO. */
export const TACO_REQUIRED_ARENAS = [
  'covid_black_swan', 'recovery_trap', 'inflation_shift', 'banking_stress',
] as const;

/** The evidence the gate reads. Structural, so screens and tests pass slices. */
export interface TacoEvidence {
  records: readonly ProgressView[];
  /** A machine has been compiled (compile is deploy). */
  machineCompiled: boolean;
  /** A basket has been locked. */
  basketLocked: boolean;
  /** A Blind Gauntlet has been run. */
  gauntletRun: boolean;
}

export interface TacoRequirement {
  key: string;
  label: string;
  met: boolean;
}

/** Every requirement with its current truth, in the order the journey runs. */
export function tacoRequirements(e: TacoEvidence): TacoRequirement[] {
  const arenaLabel: Record<string, string> = {
    covid_black_swan: 'COVID BLACK SWAN',
    recovery_trap: 'RECOVERY TRAP',
    inflation_shift: 'INFLATION SHIFT',
    banking_stress: 'BANKING STRESS',
  };
  return [
    ...TACO_REQUIRED_ARENAS.map(id => ({
      key: id, label: arenaLabel[id], met: arenaCompleted(e.records, id),
    })),
    { key: 'machine', label: 'MACHINE COMPILED', met: e.machineCompiled },
    { key: 'gauntlet', label: 'BLIND GAUNTLET RUN', met: e.gauntletRun },
    { key: 'basket', label: 'BASKET LOCKED', met: e.basketLocked },
  ];
}

export function tacoUnlocked(e: TacoEvidence): boolean {
  return tacoRequirements(e).every(r => r.met);
}

/** The first thing still standing between the player and the final boss. */
export function tacoNextRequirement(e: TacoEvidence): TacoRequirement | null {
  return tacoRequirements(e).find(r => !r.met) ?? null;
}

// ─── Game completion ─────────────────────────────────────────────────────────

/** The game is complete once TACO has been finished, win or lose. */
export function gameCompleted(records: readonly ProgressView[]): boolean {
  return arenaCompleted(records, TACO_ARENA_ID);
}
