import { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type {
  RunState, PlayerProfile, ActionCode, ArenaId, ThesisCode, ModuleCode,
} from '../lib/gameTypes';
import { getCheckpoint } from '../lib/arenas';
import { type DecisionCommand } from '../lib/runEngine';
import { createDefaultProfile } from '../lib/progressionEngine';
import {
  reducer, mintSeed, type GameState,
} from './gameReducer';
import { getSessionId } from '../lib/identity';
import { persistence } from '../lib/persistence';
import {
  emitEvent, beginRunTelemetry, endRunTelemetry, setRunTelemetryId, covidCrisisDayToISO,
} from '../lib/events';
import { markProgressSaved } from '../lib/alphaIdentity';
import {
  saveRun, latestUnfinishedRun, replayRun, replayMatchesRecord,
} from '../lib/runRecord';
import { DEFAULT_ARENA_ID } from '../lib/arenas';

// §56 checkpoint id from the arena code + sequence (e.g. cp_covid_black_swan_007).
function checkpointId(arenaId: string, sequence: number): string {
  return `cp_${arenaId}_${String(sequence).padStart(3, '0')}`;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface GameContextValue {
  state: GameState;
  startRun: (arenaId?: ArenaId, machineId?: string) => void;
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

  // Load the saved profile on mount.
  //
  // This used to read four tables from a database the browser talked to
  // directly, and to insert a fresh row when it found nothing. It always found
  // nothing: the insert was rejected by owner-scoped policies the game cannot
  // satisfy, because no player ever authenticates. The rejection was swallowed,
  // so every reload silently started from zero XP.
  useEffect(() => {
    const sessionId = getSessionId();

    const load = async () => {
      const saved = await persistence.loadProfile(sessionId);
      const profile: PlayerProfile = saved
        ? { ...createDefaultProfile(sessionId), ...saved, sessionId }
        : createDefaultProfile(sessionId);
      dispatch({ type: 'LOAD_PROFILE', profile });
    };

    void load();
  }, []);

  // Persist profile changes.
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

    const { sessionId: _sessionId, ...snapshot } = state.profile;
    void persistence.saveProfile(getSessionId(), snapshot);
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
      const cp = getCheckpoint(run.arenaId, run.currentCheckpoint);
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
      const cp = getCheckpoint(run.arenaId, d.checkpointSequence);
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

  const startRun = useCallback((arenaId: ArenaId = DEFAULT_ARENA_ID, machineId: string = 'refi_rules') => {
    // New run → new correlation chain. beginRunTelemetry stamps a run id
    // that every event in this run shares (§56 run_id / correlation_id).
    // The Run Record reuses that same id rather than minting a second one, so
    // a stored run and its event stream can be read against each other.
    const runId = beginRunTelemetry();
    dispatch({ type: 'START_RUN', runId, seed: mintSeed(), arenaId, machineId });
    emitEvent('arena.started', { arenaId, machineId }, { arenaId });
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

  const currentCheckpointData = state.run ? getCheckpoint(state.run.arenaId, state.run.currentCheckpoint) : undefined;

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
