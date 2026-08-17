import { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type {
  RunState, PlayerProfile, ActionCode, ThesisCode, ModuleCode,
} from '../lib/gameTypes';
import { getCheckpoint } from '../lib/covidArena';
import { type DecisionCommand } from '../lib/runEngine';
import { createDefaultProfile } from '../lib/progressionEngine';
import {
  reducer, mintSeed, type GameState,
} from './gameReducer';
import { supabase, getSessionId } from '../lib/supabase';
import {
  emitEvent, beginRunTelemetry, endRunTelemetry, setRunTelemetryId, covidCrisisDayToISO,
} from '../lib/events';
import { markProgressSaved } from '../lib/alphaIdentity';
import {
  saveRun, latestUnfinishedRun, replayRun, replayMatchesRecord,
} from '../lib/runRecord';

// §56 checkpoint id from the arena code + sequence (e.g. cp_covid_black_swan_007).
function checkpointId(arenaId: string, sequence: number): string {
  return `cp_${arenaId}_${String(sequence).padStart(3, '0')}`;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface GameContextValue {
  state: GameState;
  startRun: () => void;
  /** Re-enter the stored unfinished run. False when it cannot be reproduced. */
  resumeRun: () => boolean;
  setPhase: (phase: RunState['phase']) => void;
  investigateModule: (module: ModuleCode) => void;
  setPendingAction: (action: ActionCode) => void;
  attachThesis: (thesis: ThesisCode) => void;
  setPendingConfidence: (confidence: number) => void;
  commitDecision: (command: DecisionCommand) => void;
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
    lastCheckpointFlags: [],
    moduleJustUnlocked: null,
    xpJustEarned: 0,
    loaded: false,
  });

  // The profile as of the latest render, readable from a stable callback.
  // resumeRun needs the unlocked modules but must not be rebuilt every time
  // XP moves, or the resume offer would re-render on every commit.
  const profileRef = useRef(state.profile);
  profileRef.current = state.profile;

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

  // The Run Record (§57). Written whenever the run's shape changes, so an
  // abandoned run still leaves behind the decisions the player did make and a
  // refresh no longer destroys the evidence the autopsy is built from.
  //
  // Keyed on the transitions worth a write rather than on the run object, so a
  // panel tab does not re-serialise the run.
  //
  // The thesis is one of those transitions and is easy to miss: it attaches
  // after the commit, leaving the decision count, the phase and the result all
  // unchanged. Without it in the key, every stored decision reads
  // THESIS_UNSTATED however carefully the player answered.
  const lastDecision = state.run?.decisions[state.run.decisions.length - 1];
  useEffect(() => {
    if (!state.run?.id) return;
    saveRun(state.run);
  }, [
    state.run?.id,
    state.run?.decisions.length,
    state.run?.phase,
    state.run?.result,
    lastDecision?.thesisCode,
    // Reading the whole run at write time is intended; the deps above only
    // decide when.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

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
    // The Run Record reuses that same id rather than minting a second one, so
    // a stored run and its event stream can be read against each other.
    const runId = beginRunTelemetry();
    dispatch({ type: 'START_RUN', runId, seed: mintSeed() });
    const arenaId = 'covid_black_swan';
    emitEvent('arena.started', { arenaId, machineId: 'refi_rules' }, { arenaId });
  }, []);
  /**
   * Re-enter the run the player left, rebuilt by replaying its decisions.
   *
   * Returns false and changes nothing when the record cannot be reproduced
   * exactly — content or scoring has moved since it was stored. Declining is
   * the honest outcome: resuming into a run whose numbers have silently
   * shifted is worse than starting again.
   */
  const resumeRun = useCallback((): boolean => {
    const record = latestUnfinishedRun();
    if (!record || record.decisions.length === 0) return false;

    const replayed = replayRun(record, profileRef.current.unlockedModules);
    if (!replayed || !replayMatchesRecord(record, replayed)) return false;

    // The resumed run keeps its original id, so its events and its record stay
    // one chain across the interruption.
    setRunTelemetryId(record.runId);
    dispatch({ type: 'RESUME_RUN', run: replayed });
    emitEvent('session.resumed', {
      arenaId: record.arenaId,
      checkpoint: record.currentCheckpoint,
      decisions: record.decisions.length,
    }, { arenaId: record.arenaId });
    return true;
  }, []);

  const setPhase = useCallback((phase: RunState['phase']) => dispatch({ type: 'SET_RUN_PHASE', phase }), []);
  const investigateModule = useCallback((module: ModuleCode) => dispatch({ type: 'INVESTIGATE_MODULE', module }), []);
  const setPendingAction = useCallback((action: ActionCode) => dispatch({ type: 'SET_PENDING_ACTION', action }), []);
  const attachDecisionThesis = useCallback((thesis: ThesisCode) => dispatch({ type: 'ATTACH_THESIS', thesis }), []);
  const setPendingConfidence = useCallback((confidence: number) => dispatch({ type: 'SET_PENDING_CONFIDENCE', confidence }), []);
  const commitDecision = useCallback(
    (command: DecisionCommand) => dispatch({ type: 'COMMIT_DECISION', command }),
    [],
  );
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
      resumeRun,
      setPhase,
      investigateModule,
      setPendingAction,
      attachThesis: attachDecisionThesis,
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
