// ─── Game reducer ─────────────────────────────────────────────────────────────
//
// The pure half of the game context: state shape, actions, and the transition
// function. Split out from the provider so it can be tested directly. The
// provider needs Supabase and a browser; none of the rules below do, and two
// of them have already regressed in ways only a test would have caught — a
// module unlock that never reached the run it was earned in, and an unlock
// notice that cleared itself after three seconds underneath an animation.

import type {
  RunState, PlayerProfile, ActionCode, ArenaId, ThesisCode, ModuleCode, DimensionCode,
  BehavioralFlag,
} from '../lib/gameTypes';
import { scoreCheckpoint, computeXpAward, getDimensionUpdates } from '../lib/scoringEngine';
import {
  createInitialRun, commitDecisionCommand, advanceRunCheckpoint, resolveRunResult,
  attachThesis, type DecisionCommand,
} from '../lib/runEngine';
import { updateDimensions, checkModuleUnlocks, getRankForXp } from '../lib/progressionEngine';

// ─── State shape ──────────────────────────────────────────────────────────────

export interface GameState {
  profile: PlayerProfile;
  run: RunState | null;
  lastCheckpointScore: ReturnType<typeof scoreCheckpoint> | null;
  // Behavioural flags from the checkpoint just scored. The verdict grammar
  // reads these to decide whether a winning result carries a forward nudge.
  lastCheckpointFlags: BehavioralFlag[];
  moduleJustUnlocked: ModuleCode | null;
  xpJustEarned: number;
  loaded: boolean;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type GameAction =
  | { type: 'LOAD_PROFILE'; profile: PlayerProfile }
  // The identity and determinism anchor are minted here, not in the engine:
  // both need a clock or an RNG, which the engine may not read.
  | { type: 'START_RUN'; runId: string; seed: number; arenaId: ArenaId; machineId: string }
  // A run rebuilt from its record by replaying the decisions through the
  // engine. The run arrives whole; the reducer only adopts it.
  | { type: 'RESUME_RUN'; run: RunState }
  | { type: 'SET_RUN_PHASE'; phase: RunState['phase'] }
  | { type: 'INVESTIGATE_MODULE'; module: ModuleCode }
  | { type: 'SET_PENDING_ACTION'; action: ActionCode }
  | { type: 'ATTACH_THESIS'; thesis: ThesisCode }
  | { type: 'SET_PENDING_CONFIDENCE'; confidence: number }
  | { type: 'COMMIT_DECISION'; command: DecisionCommand }
  | { type: 'ADVANCE_CHECKPOINT' }
  | { type: 'COMPLETE_RUN'; result: RunState['result'] }
  | { type: 'CLEAR_MODULE_UNLOCK' }
  | { type: 'CLEAR_XP_EARNED' }
  | { type: 'UPDATE_PROFILE_DIMENSION'; updates: Partial<Record<DimensionCode, number>> }
  | { type: 'EARN_XP'; amount: number }
  | { type: 'RECORD_MACHINE_ATTEMPT'; won: boolean };

// ─── Reducer ──────────────────────────────────────────────────────────────────

/**
 * A run's determinism anchor (§54 `arena_runs.seed`).
 *
 * A 32-bit unsigned integer so it survives JSON, localStorage and a Postgres
 * bigint without loss. Sourced from the CSPRNG where there is one; the clock is
 * only a fallback, and a duplicated seed costs replay fidelity, not integrity.
 */
export function mintSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  } catch {
    return Date.now() >>> 0;
  }
}

/** Union of two module lists, order-stable and duplicate-free. */
function mergeModules(current: ModuleCode[], incoming: ModuleCode[]): ModuleCode[] {
  const seen = new Set(current);
  return [...current, ...incoming.filter(m => !seen.has(m))];
}

/**
 * Exported for test. The reducer holds rules that are invisible from the
 * engine and expensive to reach through the UI: which modules a run adopts,
 * and how long an unlock stays on screen. Both have already regressed once.
 */
export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'LOAD_PROFILE':
      return { ...state, profile: action.profile, loaded: true };

    case 'START_RUN': {
      // A run opens with the base terminal plus everything the player has
      // already earned. Without this a returning player's unlocked modules
      // silently disappear the moment a new run starts.
      const base = createInitialRun(action.seed, action.arenaId, action.machineId);
      return {
        ...state,
        run: {
          ...base,
          id: action.runId,
          activeModules: mergeModules(base.activeModules, state.profile.unlockedModules),
        },
        lastCheckpointScore: null,
        lastCheckpointFlags: [],
      };
    }

    case 'RESUME_RUN':
      return {
        ...state,
        run: action.run,
        // The checkpoint score belongs to a resolution the player already saw.
        // Restoring the run must not reopen it.
        lastCheckpointScore: null,
        lastCheckpointFlags: [],
      };

    case 'SET_RUN_PHASE':
      if (!state.run) return state;
      return { ...state, run: { ...state.run, phase: action.phase } };

    case 'INVESTIGATE_MODULE': {
      if (!state.run) return state;
      const already = state.run.investigatedModules.includes(action.module);
      if (already) return state;
      return {
        ...state,
        run: {
          ...state.run,
          investigatedModules: [...state.run.investigatedModules, action.module],
        },
      };
    }

    case 'SET_PENDING_ACTION':
      if (!state.run) return state;
      return { ...state, run: { ...state.run, pendingAction: action.action, phase: 'COMMITTING' } };

    case 'ATTACH_THESIS':
      if (!state.run) return state;
      // Explains the committed decision; cannot revise it (Addendum C C.5).
      return { ...state, run: attachThesis(state.run, action.thesis) };

    case 'SET_PENDING_CONFIDENCE':
      if (!state.run) return state;
      return { ...state, run: { ...state.run, pendingConfidence: action.confidence } };

    case 'COMMIT_DECISION': {
      const { run } = state;
      if (!run) return state;

      // Run-state transition lives in the pure engine; the reducer keeps only
      // the profile side (XP, dimensions, module unlocks). The command carries
      // the whole decision, so the commit never depends on which pending
      // dispatch happened to land first.
      const outcome = commitDecisionCommand(run, action.command);
      if (!outcome) return state;
      const { score, flags, dimUpdates, checkpoint } = outcome;

      const xpEarned = computeXpAward(score, checkpoint.isRegimeChange);
      const newDimensions = updateDimensions(state.profile.dimensions, getDimensionUpdates(flags, dimUpdates));
      const newXp = state.profile.alphaXp + xpEarned;
      const newModuleUnlocks = checkModuleUnlocks({ ...state.profile, alphaXp: newXp }, run.currentCheckpoint);
      const newUnlocked = [...state.profile.unlockedModules, ...newModuleUnlocks];

      return {
        ...state,
        lastCheckpointScore: score,
        lastCheckpointFlags: flags,
        xpJustEarned: xpEarned,
        moduleJustUnlocked: newModuleUnlocks[0] ?? null,
        profile: {
          ...state.profile,
          alphaXp: newXp,
          rankCode: getRankForXp(newXp),
          dimensions: newDimensions,
          unlockedModules: newUnlocked,
        },
        // A module the player just earned has to become part of the run they
        // earned it in. Unlocks used to land only on the profile, so the
        // terminal's module rack never changed and the unlock the toast
        // announced was nowhere to be found.
        run: newModuleUnlocks.length > 0
          ? { ...outcome.run, activeModules: mergeModules(outcome.run.activeModules, newModuleUnlocks) }
          : outcome.run,
      };
    }

    case 'ADVANCE_CHECKPOINT': {
      if (!state.run) return state;
      return {
        ...state,
        run: advanceRunCheckpoint(state.run),
        // An unlock belongs to the checkpoint that earned it. Leaving that
        // checkpoint is the moment it stops being news, and it is a boundary
        // the player chose, unlike the timer this replaced.
        moduleJustUnlocked: null,
        xpJustEarned: 0,
      };
    }

    case 'COMPLETE_RUN': {
      if (!state.run) return state;
      // Observation mode is enforced here, not at the call site: a run that
      // crossed the critical drawdown cannot report MACHINE_BEATEN, and so
      // cannot bank a machine beat or extend a streak.
      const result = resolveRunResult(state.run, action.result);
      const won = result === 'MACHINE_BEATEN';
      // The run knows which opponent it was against; the ladder entry for
      // that opponent records the outcome. Before this, the per-machine
      // records existed but were never written, so the ladder displayed a
      // standing no run had ever produced (2026-08-25 audit P0).
      const machineId = state.run.machineId;
      const ladderEntry = state.profile.machineLadder[machineId];
      const machineLadder = ladderEntry
        ? {
            ...state.profile.machineLadder,
            [machineId]: {
              wins: ladderEntry.wins + (won ? 1 : 0),
              losses: ladderEntry.losses + (won ? 0 : 1),
              status: won ? 'DEFEATED' as const : ladderEntry.status,
            },
          }
        : state.profile.machineLadder;
      return {
        ...state,
        run: { ...state.run, result, phase: 'COMPLETE' },
        profile: {
          ...state.profile,
          machineAttempts: state.profile.machineAttempts + 1,
          machineBeats: won ? state.profile.machineBeats + 1 : state.profile.machineBeats,
          currentStreak: won ? state.profile.currentStreak + 1 : 0,
          bestStreak: won
            ? Math.max(state.profile.bestStreak, state.profile.currentStreak + 1)
            : state.profile.bestStreak,
          machineLadder,
        },
      };
    }

    case 'CLEAR_MODULE_UNLOCK':
      return { ...state, moduleJustUnlocked: null };

    case 'CLEAR_XP_EARNED':
      return { ...state, xpJustEarned: 0 };

    case 'EARN_XP': {
      const newXp = state.profile.alphaXp + action.amount;
      return {
        ...state,
        xpJustEarned: action.amount,
        profile: {
          ...state.profile,
          alphaXp: newXp,
          rankCode: getRankForXp(newXp),
        },
      };
    }

    case 'RECORD_MACHINE_ATTEMPT': {
      const won = action.won;
      return {
        ...state,
        profile: {
          ...state.profile,
          machineAttempts: state.profile.machineAttempts + 1,
          machineBeats: won ? state.profile.machineBeats + 1 : state.profile.machineBeats,
        },
      };
    }

    case 'UPDATE_PROFILE_DIMENSION': {
      const newDimensions = updateDimensions(state.profile.dimensions, action.updates);
      return { ...state, profile: { ...state.profile, dimensions: newDimensions } };
    }

    default:
      return state;
  }
}

