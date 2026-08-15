import { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type {
  RunState, PlayerProfile, ActionCode, ThesisCode, ModuleCode, DimensionCode,
} from '../lib/gameTypes';
import { getCheckpoint } from '../lib/covidArena';
import { scoreCheckpoint, computeXpAward, getDimensionUpdates } from '../lib/scoringEngine';
import {
  createInitialRun, commitPendingDecision, advanceRunCheckpoint, resolveRunResult,
} from '../lib/runEngine';
import { createDefaultProfile, updateDimensions, checkModuleUnlocks, getRankForXp } from '../lib/progressionEngine';
import { supabase, getSessionId } from '../lib/supabase';
import {
  emitEvent, beginRunTelemetry, endRunTelemetry, covidCrisisDayToISO,
} from '../lib/events';
import { markProgressSaved } from '../lib/alphaIdentity';

// §56 checkpoint id from the arena code + sequence (e.g. cp_covid_black_swan_007).
function checkpointId(arenaId: string, sequence: number): string {
  return `cp_${arenaId}_${String(sequence).padStart(3, '0')}`;
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface GameState {
  profile: PlayerProfile;
  run: RunState | null;
  lastCheckpointScore: ReturnType<typeof scoreCheckpoint> | null;
  moduleJustUnlocked: ModuleCode | null;
  xpJustEarned: number;
  loaded: boolean;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type GameAction =
  | { type: 'LOAD_PROFILE'; profile: PlayerProfile }
  | { type: 'START_RUN' }
  | { type: 'SET_RUN_PHASE'; phase: RunState['phase'] }
  | { type: 'INVESTIGATE_MODULE'; module: ModuleCode }
  | { type: 'SET_PENDING_ACTION'; action: ActionCode }
  | { type: 'SET_PENDING_THESIS'; thesis: ThesisCode }
  | { type: 'SET_PENDING_CONFIDENCE'; confidence: number }
  | { type: 'COMMIT_DECISION' }
  | { type: 'ADVANCE_CHECKPOINT' }
  | { type: 'COMPLETE_RUN'; result: RunState['result'] }
  | { type: 'CLEAR_MODULE_UNLOCK' }
  | { type: 'CLEAR_XP_EARNED' }
  | { type: 'UPDATE_PROFILE_DIMENSION'; updates: Partial<Record<DimensionCode, number>> }
  | { type: 'EARN_XP'; amount: number }
  | { type: 'RECORD_MACHINE_ATTEMPT'; won: boolean };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'LOAD_PROFILE':
      return { ...state, profile: action.profile, loaded: true };

    case 'START_RUN':
      return { ...state, run: createInitialRun(), lastCheckpointScore: null };

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

    case 'SET_PENDING_THESIS':
      if (!state.run) return state;
      return { ...state, run: { ...state.run, pendingThesis: action.thesis } };

    case 'SET_PENDING_CONFIDENCE':
      if (!state.run) return state;
      return { ...state, run: { ...state.run, pendingConfidence: action.confidence } };

    case 'COMMIT_DECISION': {
      const { run } = state;
      if (!run) return state;

      // Run-state transition lives in the pure engine; the reducer keeps only
      // the profile side (XP, dimensions, module unlocks).
      const outcome = commitPendingDecision(run);
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
        xpJustEarned: xpEarned,
        moduleJustUnlocked: newModuleUnlocks[0] ?? null,
        profile: {
          ...state.profile,
          alphaXp: newXp,
          rankCode: getRankForXp(newXp),
          dimensions: newDimensions,
          unlockedModules: newUnlocked,
        },
        run: outcome.run,
      };
    }

    case 'ADVANCE_CHECKPOINT': {
      if (!state.run) return state;
      return { ...state, run: advanceRunCheckpoint(state.run) };
    }

    case 'COMPLETE_RUN': {
      if (!state.run) return state;
      // Observation mode is enforced here, not at the call site: a run that
      // crossed the critical drawdown cannot report MACHINE_BEATEN, and so
      // cannot bank a machine beat or extend a streak.
      const result = resolveRunResult(state.run, action.result);
      const won = result === 'MACHINE_BEATEN';
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

// ─── Context ──────────────────────────────────────────────────────────────────

interface GameContextValue {
  state: GameState;
  startRun: () => void;
  setPhase: (phase: RunState['phase']) => void;
  investigateModule: (module: ModuleCode) => void;
  setPendingAction: (action: ActionCode) => void;
  setPendingThesis: (thesis: ThesisCode) => void;
  setPendingConfidence: (confidence: number) => void;
  commitDecision: () => void;
  advanceCheckpoint: () => void;
  completeRun: (result: RunState['result']) => void;
  clearModuleUnlock: () => void;
  clearXpEarned: () => void;
  earnXp: (amount: number) => void;
  currentCheckpointData: ReturnType<typeof getCheckpoint>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    profile: createDefaultProfile(getSessionId()),
    run: null,
    lastCheckpointScore: null,
    moduleJustUnlocked: null,
    xpJustEarned: 0,
    loaded: false,
  });

  // Load profile from Supabase on mount
  useEffect(() => {
    const sessionId = getSessionId();

    const load = async () => {
      const { data } = await supabase
        .from('player_profiles')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (data) {
        const { data: dims } = await supabase
          .from('alpha_profile_dimensions')
          .select('*')
          .eq('session_id', sessionId);

        const { data: modules } = await supabase
          .from('module_unlocks')
          .select('module_code')
          .eq('session_id', sessionId);

        const { data: ladder } = await supabase
          .from('machine_ladder_progress')
          .select('*')
          .eq('session_id', sessionId);

        const dimensionMap: PlayerProfile['dimensions'] = {
          STOCK_SELECTION: { score: 50, sampleSize: 0 },
          POSITION_SIZING: { score: 50, sampleSize: 0 },
          LOSS_CONTROL: { score: 50, sampleSize: 0 },
          REENTRY_DISCIPLINE: { score: 50, sampleSize: 0 },
          TURNOVER_DISCIPLINE: { score: 50, sampleSize: 0 },
          REGIME_ADAPTATION: { score: 50, sampleSize: 0 },
          RULE_ADHERENCE: { score: 50, sampleSize: 0 },
          ACTION_BIAS_SCORE: { score: 50, sampleSize: 0 },
          CONCENTRATION_CONTROL: { score: 50, sampleSize: 0 },
          DECISION_CONSISTENCY: { score: 50, sampleSize: 0 },
        };

        dims?.forEach(d => {
          const key = d.dimension_code as keyof typeof dimensionMap;
          if (key in dimensionMap) {
            dimensionMap[key] = { score: parseFloat(d.score), sampleSize: d.sample_size };
          }
        });

        const unlockedModules = (modules ?? []).map((m: { module_code: ModuleCode }) => m.module_code);

        const machineLadder: PlayerProfile['machineLadder'] = {
          market_index: { wins: 0, losses: 0, status: 'ACTIVE' },
          refi_rules: { wins: 0, losses: 0, status: 'ACTIVE' },
          crisis_machine: { wins: 0, losses: 0, status: 'LOCKED' },
          regime_machine: { wins: 0, losses: 0, status: 'LOCKED' },
          refi_alpha: { wins: 0, losses: 0, status: 'LOCKED' },
          refi_ensemble: { wins: 0, losses: 0, status: 'LOCKED' },
          taco_protocol: { wins: 0, losses: 0, status: 'LOCKED' },
        };

        ladder?.forEach((l: { machine_id: string; wins: number; losses: number; status: string }) => {
          if (l.machine_id in machineLadder) {
            machineLadder[l.machine_id] = {
              wins: l.wins,
              losses: l.losses,
              status: l.status as 'LOCKED' | 'ACTIVE' | 'DEFEATED',
            };
          }
        });

        const profile: PlayerProfile = {
          sessionId,
          handle: data.handle,
          alphaXp: data.alpha_xp,
          rankCode: data.rank_code,
          machineBeats: data.machine_beats,
          machineAttempts: data.machine_attempts,
          currentStreak: data.current_streak,
          bestStreak: data.best_streak,
          archetype: data.archetype ?? 'UNCLASSIFIED',
          decisionStreak: data.decision_streak,
          lastActiveDate: data.last_active_date,
          dimensions: dimensionMap,
          unlockedModules,
          machineLadder,
        };

        dispatch({ type: 'LOAD_PROFILE', profile });
      } else {
        // Create new profile
        const newProfile = createDefaultProfile(sessionId);
        await supabase.from('player_profiles').insert({
          session_id: sessionId,
          alpha_xp: 0,
          rank_code: 'INITIATE',
          machine_beats: 0,
          machine_attempts: 0,
          current_streak: 0,
          best_streak: 0,
          decision_streak: 0,
        });
        dispatch({ type: 'LOAD_PROFILE', profile: newProfile });
      }
    };

    load();
  }, []);

  // Persist profile changes to Supabase
  const progressSavedRef = useRef(false);
  useEffect(() => {
    if (!state.loaded) return;

    // §4 Stage 2 "save progress": once the player has made real progress,
    // ensure a lightweight Alpha identity exists and record the save for the
    // onboarding funnel (once per session).
    if (!progressSavedRef.current && state.profile.alphaXp > 0) {
      progressSavedRef.current = true;
      markProgressSaved();
    }

    const sessionId = getSessionId();

    const save = async () => {
      await supabase.from('player_profiles').upsert({
        session_id: sessionId,
        alpha_xp: state.profile.alphaXp,
        rank_code: state.profile.rankCode,
        machine_beats: state.profile.machineBeats,
        machine_attempts: state.profile.machineAttempts,
        current_streak: state.profile.currentStreak,
        best_streak: state.profile.bestStreak,
        archetype: state.profile.archetype,
        decision_streak: state.profile.decisionStreak,
        last_active_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' });

      // Save dimensions
      await Promise.all(
        Object.entries(state.profile.dimensions).map(([code, data]) =>
          supabase.from('alpha_profile_dimensions').upsert({
            session_id: sessionId,
            dimension_code: code,
            score: data.score,
            sample_size: data.sampleSize,
            last_updated: new Date().toISOString(),
          }, { onConflict: 'session_id,dimension_code' })
        )
      );
    };

    save();
  }, [state.profile, state.loaded]);

  // ─── Event-envelope emission (§56 / §4.2) ────────────────────────────────
  // Emission lives in effects, not the reducer, so the reducer stays pure.
  // Each effect watches a state transition and emits the matching §57 event.

  // session.started — once per mount.
  useEffect(() => {
    emitEvent('session.started', { sessionId: getSessionId() });
  }, []);

  // checkpoint.loaded — whenever the active checkpoint changes.
  const prevCheckpoint = useRef<number | null>(null);
  useEffect(() => {
    const run = state.run;
    if (!run) { prevCheckpoint.current = null; return; }
    if (run.currentCheckpoint !== prevCheckpoint.current) {
      const cp = getCheckpoint(run.currentCheckpoint);
      emitEvent('checkpoint.loaded',
        { sequence: run.currentCheckpoint, phase: cp?.phase, crisisDay: cp?.crisisDay },
        {
          arenaId: run.arenaId,
          checkpointId: checkpointId(run.arenaId, run.currentCheckpoint),
          simulationTimestamp: covidCrisisDayToISO(cp?.crisisDay),
        },
      );
      prevCheckpoint.current = run.currentCheckpoint;
    }
  }, [state.run]);

  // decision.committed + score.checkpoint.computed — when a decision lands.
  const prevDecisionCount = useRef(0);
  useEffect(() => {
    const run = state.run;
    if (!run) { prevDecisionCount.current = 0; return; }
    if (run.decisions.length > prevDecisionCount.current) {
      const d = run.decisions[run.decisions.length - 1];
      const cp = getCheckpoint(d.checkpointSequence);
      const ctx = {
        arenaId: run.arenaId,
        checkpointId: checkpointId(run.arenaId, d.checkpointSequence),
        simulationTimestamp: covidCrisisDayToISO(cp?.crisisDay),
      };
      emitEvent('decision.committed', {
        actionCode: d.actionCode,
        thesisCode: d.thesisCode ?? null,
        confidence: d.confidence ?? null,
        machineActionCode: d.machineActionCode,
        modulesConsulted: d.modulesConsulted,
        behavioralFlags: d.behavioralFlags,
      }, ctx);
      emitEvent('score.checkpoint.computed', {
        scoreContribution: d.scoreContribution,
        quality: d.quality,
        playerScore: run.playerScore,
        machineScore: run.machineScore,
      }, ctx);
    }
    prevDecisionCount.current = run.decisions.length;
  }, [state.run]);

  // arena.passed / arena.failed / arena.machine_beaten + score.run.computed —
  // once, when the run reaches a terminal result.
  const prevResult = useRef<RunState['result'] | null>(null);
  useEffect(() => {
    const run = state.run;
    const result = run?.result ?? null;
    if (run && result && result !== 'ACTIVE' && result !== prevResult.current) {
      const evt =
        result === 'MACHINE_BEATEN' ? 'arena.machine_beaten' :
        result === 'PASSED' ? 'arena.passed' :
        'arena.failed';
      const ctx = { arenaId: run.arenaId };
      emitEvent(evt, {
        result,
        playerScore: run.playerScore,
        machineScore: run.machineScore,
        criticalFailure: run.criticalFailure,
      }, ctx);
      emitEvent('score.run.computed', {
        result,
        playerScore: run.playerScore,
        machineScore: run.machineScore,
        checkpointsCompleted: run.decisions.length,
      }, ctx);
      endRunTelemetry();
    }
    prevResult.current = result;
  }, [state.run]);

  const startRun = useCallback(() => {
    // New run → new correlation chain. beginRunTelemetry stamps a run id
    // that every event in this run shares (§56 run_id / correlation_id).
    beginRunTelemetry();
    dispatch({ type: 'START_RUN' });
    const arenaId = 'covid_black_swan';
    emitEvent('arena.started', { arenaId, machineId: 'refi_rules' }, { arenaId });
  }, []);
  const setPhase = useCallback((phase: RunState['phase']) => dispatch({ type: 'SET_RUN_PHASE', phase }), []);
  const investigateModule = useCallback((module: ModuleCode) => dispatch({ type: 'INVESTIGATE_MODULE', module }), []);
  const setPendingAction = useCallback((action: ActionCode) => dispatch({ type: 'SET_PENDING_ACTION', action }), []);
  const setPendingThesis = useCallback((thesis: ThesisCode) => dispatch({ type: 'SET_PENDING_THESIS', thesis }), []);
  const setPendingConfidence = useCallback((confidence: number) => dispatch({ type: 'SET_PENDING_CONFIDENCE', confidence }), []);
  const commitDecision = useCallback(() => dispatch({ type: 'COMMIT_DECISION' }), []);
  const advanceCheckpoint = useCallback(() => dispatch({ type: 'ADVANCE_CHECKPOINT' }), []);
  const completeRun = useCallback((result: RunState['result']) => dispatch({ type: 'COMPLETE_RUN', result }), []);
  const clearModuleUnlock = useCallback(() => dispatch({ type: 'CLEAR_MODULE_UNLOCK' }), []);
  const clearXpEarned = useCallback(() => dispatch({ type: 'CLEAR_XP_EARNED' }), []);
  const earnXp = useCallback((amount: number) => dispatch({ type: 'EARN_XP', amount }), []);

  const currentCheckpointData = state.run ? getCheckpoint(state.run.currentCheckpoint) : undefined;

  return (
    <GameContext.Provider value={{
      state,
      startRun,
      setPhase,
      investigateModule,
      setPendingAction,
      setPendingThesis,
      setPendingConfidence,
      commitDecision,
      advanceCheckpoint,
      completeRun,
      clearModuleUnlock,
      clearXpEarned,
      earnXp,
      currentCheckpointData,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
