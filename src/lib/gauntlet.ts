// ─── Blind Gauntlet (§7.5) ────────────────────────────────────────────────────
//
// "BEATING A MACHINE ONCE IS POSSIBLE. DOING IT REPEATEDLY, ACROSS DIFFERENT
//  MARKET REGIMES, UNDER THE SAME RISK LIMITS, IS HARD."
//
// That claim is §1.4's marketing thesis, and until now nothing in the game
// tested it. Every arena was played in isolation, so a machine tuned to one
// regime looked exactly as good as a machine that generalises.
//
// The gauntlet is the test: several regimes in sequence with the machine locked
// across the whole run (§7.5). No mid-series structural change is permitted —
// that is the Adaptive Gauntlet of §7.6, which is a different mode and a
// different lesson. Locking the machine is the entire point. A configuration
// that wins COVID by being defensive and then loses Recovery by being defensive
// has not built a process; it has fitted one regime.
//
// The gauntlet runs the same stress test the builder does, arena by arena,
// through the same engine the player commits through. It adds no scoring of its
// own: a gauntlet result is its legs, and the summary is arithmetic over them.

import type { ArenaId, MachineConfig } from './gameTypes';
import { getArena } from './arenas';
import { runStressTest, type StressTestResult } from './stressTest';

/**
 * The regimes a gauntlet crosses, in progression order.
 *
 * TACO is deliberately absent. §20 places it after the gauntlet as the final
 * boss, and §25.1 makes it a reflexivity test rather than a regime, so folding
 * it in here would both spoil the progression and average a different kind of
 * result into a regime score.
 */
export const GAUNTLET_ARENAS: ArenaId[] = [
  'covid_black_swan',
  'recovery_trap',
  'inflation_shift',
  'banking_stress',
];

export interface GauntletLeg {
  arenaId: ArenaId;
  arenaName: string;
  lesson: string;
  result: StressTestResult;
  /** Points above or below this arena's published par. */
  vsPar: number;
  survived: boolean;
}

export interface GauntletResult {
  legs: GauntletLeg[];
  /** Summed across every regime. */
  totalVsPar: number;
  /** Legs finished without breaching the arena's risk budget. */
  survivedCount: number;
  /** Legs where the machine finished above par. */
  beatParCount: number;
  /**
   * The gap between the machine's best and worst regime.
   *
   * The headline number of the whole mode. A small spread is a process; a large
   * one is a machine that happens to suit a regime, however good its best leg
   * looks in isolation.
   */
  consistencySpread: number;
  worstArena: ArenaId | null;
  bestArena: ArenaId | null;
}

/**
 * Run one machine across every gauntlet regime, unchanged.
 *
 * The config is passed to each leg by value and never rewritten between them,
 * which is what "machine locked across the sequence" means in code. Each leg
 * starts from its own arena's book, because a gauntlet that carried a portfolio
 * between regimes would be testing luck of the handoff rather than the rules.
 */
export function runGauntlet(
  config: MachineConfig,
  options: { seed?: number; arenas?: ArenaId[] } = {},
): GauntletResult {
  const seed = options.seed ?? 0;
  const arenas = options.arenas ?? GAUNTLET_ARENAS;

  const legs: GauntletLeg[] = [];
  for (const arenaId of arenas) {
    const arena = getArena(arenaId);
    if (!arena) continue;
    const result = runStressTest(config, { seed, arenaId });
    legs.push({
      arenaId,
      arenaName: arena.name,
      lesson: arena.lesson,
      result,
      vsPar: result.vsPar,
      survived: !result.criticalFailure && result.steps.length === arena.checkpoints.length,
    });
  }

  if (legs.length === 0) {
    return {
      legs, totalVsPar: 0, survivedCount: 0, beatParCount: 0,
      consistencySpread: 0, worstArena: null, bestArena: null,
    };
  }

  const sorted = [...legs].sort((a, b) => a.vsPar - b.vsPar);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];

  return {
    legs,
    totalVsPar: legs.reduce((a, l) => a + l.vsPar, 0),
    survivedCount: legs.filter(l => l.survived).length,
    beatParCount: legs.filter(l => l.vsPar > 0).length,
    consistencySpread: best.vsPar - worst.vsPar,
    worstArena: worst.arenaId,
    bestArena: best.arenaId,
  };
}

/**
 * The gauntlet's reading of a machine.
 *
 * Ordered so the most important failure is stated first. Surviving every regime
 * outranks scoring well in one, and a wide spread is reported as a warning even
 * when the total looks respectable — because a machine that is excellent in one
 * regime and broken in another is exactly what §1.3 says a player will mistake
 * for skill.
 */
export function gauntletVerdict(result: GauntletResult): { headline: string; detail: string } {
  const n = result.legs.length;
  if (n === 0) {
    return { headline: 'NO REGIMES RUN.', detail: 'The gauntlet had nothing to test.' };
  }

  const failed = result.legs.filter(l => !l.survived);
  if (failed.length > 0) {
    const names = failed.map(l => l.arenaName).join(', ');
    return {
      headline: `BROKE IN ${failed.length} OF ${n} REGIMES.`,
      detail: `${names}. A machine that does not survive every regime has not been tested by the ones it did survive.`,
    };
  }

  if (result.beatParCount === n) {
    return {
      headline: `BEAT PAR IN ALL ${n} REGIMES.`,
      detail: `Spread of ${result.consistencySpread} between best and worst. This is the result the game is built to make hard.`,
    };
  }

  if (result.beatParCount === 0) {
    return {
      headline: `SURVIVED ALL ${n}, BEAT NONE.`,
      detail: 'The rules held everywhere and were sharp nowhere. Survival is the floor, not the objective.',
    };
  }

  return {
    headline: `BEAT PAR IN ${result.beatParCount} OF ${n}.`,
    detail: `Spread of ${result.consistencySpread} between best and worst regime. The gap between them is the machine's real weakness, not the average.`,
  };
}
