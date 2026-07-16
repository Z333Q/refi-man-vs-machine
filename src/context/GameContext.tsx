import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type {
  RunState, PlayerProfile, ActionCode, ThesisCode, ModuleCode,
  RunDecision, BehavioralFlag, DimensionCode,
} from '../lib/gameTypes';
import { COVID_CHECKPOINTS, getCheckpoint } from '../lib/covidArena';
import { scoreCheckpoint, computeXpAward, getDimensionUpdates } from '../lib/scoringEngine';
import { createDefaultProfile, updateDimensions, checkModuleUnlocks, getRankForXp } from '../lib/progressionEngine';
import { supabase, getSessionId } from '../lib/supabase';

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

// ─── Initial portfolio state ──────────────────────────────────────────────────

// U.S. equities only. Bonds, gold, and commodities are signals, not positions.
// Embedded risks: TRAVEL (DAL+MAR=16%), TECH CONC (MSFT+AAPL=20%), CYCLICAL (CAT+XOM+HD=23%)
const initialPortfolio: RunState['portfolio'] = {
  value: 100000,
  cashWeight: 0.15,
  positions: [
    { symbol: 'MSFT', weight: 0.10, pnl: 0, riskContrib: 0.14, sector: 'TECHNOLOGY' },
    { symbol: 'AAPL', weight: 0.10, pnl: 0, riskContrib: 0.14, sector: 'TECHNOLOGY' },
    { symbol: 'JPM',  weight: 0.10, pnl: 0, riskContrib: 0.18, sector: 'FINANCIALS' },
    { symbol: 'DAL',  weight: 0.08, pnl: 0, riskContrib: 0.20, sector: 'AIRLINES' },
    { symbol: 'MAR',  weight: 0.08, pnl: 0, riskContrib: 0.18, sector: 'HOTELS' },
    { symbol: 'XOM',  weight: 0.08, pnl: 0, riskContrib: 0.16, sector: 'ENERGY' },
    { symbol: 'JNJ',  weight: 0.08, pnl: 0, riskContrib: 0.07, sector: 'HEALTHCARE' },
    { symbol: 'PG',   weight: 0.08, pnl: 0, riskContrib: 0.06, sector: 'CONSUMER STAPLES' },
    { symbol: 'CAT',  weight: 0.08, pnl: 0, riskContrib: 0.15, sector: 'INDUSTRIALS' },
    { symbol: 'HD',   weight: 0.07, pnl: 0, riskContrib: 0.10, sector: 'CONSUMER DISCRETIONARY' },
  ],
  drawdown: 0,
  volatility: 0.16,
  sectorExposure: {
    TECHNOLOGY: 0.20, FINANCIALS: 0.10, AIRLINES: 0.08,
    HOTELS: 0.08, ENERGY: 0.08, HEALTHCARE: 0.08,
    'CONSUMER STAPLES': 0.08, INDUSTRIALS: 0.08, 'CONSUMER DISCRETIONARY': 0.07,
  },
  turnoverUsed: 0,
  correlationIndex: 0.48,
};

function createInitialRun(): RunState {
  return {
    id: null,
    arenaId: 'covid_black_swan',
    machineId: 'refi_rules',
    currentCheckpoint: 1,
    totalCheckpoints: COVID_CHECKPOINTS.length,
    phase: 'SIGNAL',
    portfolio: { ...initialPortfolio },
    playerScore: 50,
    machineScore: 50,
    decisions: [],
    criticalFailure: false,
    activeModules: ['PRICE_RETURN', 'PORTFOLIO_SUMMARY', 'SECTOR_EXPOSURE', 'NEWS_FEED'],
    investigatedModules: [],
    pendingAction: null,
    pendingThesis: null,
    pendingConfidence: 0.6,
    result: 'ACTIVE',
  };
}

// ─── Portfolio simulation ─────────────────────────────────────────────────────

function simulatePortfolioAdvance(
  portfolio: RunState['portfolio'],
  action: ActionCode,
  checkpointSeq: number
): RunState['portfolio'] {
  const cp = getCheckpoint(checkpointSeq);
  if (!cp) return portfolio;

  const { returnBias, volatilityDelta, correlationLevel } = cp.portfolioEffect;
  const actionMultiplier =
    action === 'REDUCE' ? 0.6 :
    action === 'RAISE_CASH' ? 0.3 :
    action === 'ADD_RISK' ? 1.4 :
    action === 'ROTATE_DEFENSIVE' ? 0.7 :
    1.0;

  const portfolioReturn = returnBias * actionMultiplier;
  const newValue = portfolio.value * (1 + portfolioReturn);
  const peakValue = 100000;
  const newDrawdown = Math.min(0, (newValue - peakValue) / peakValue);
  const newVolatility = Math.max(0.08, portfolio.volatility + volatilityDelta);
  const cashDelta = action === 'RAISE_CASH' ? 0.10 : action === 'ADD_RISK' ? -0.05 : action === 'REDUCE' ? 0.05 : 0;
  const newCash = Math.max(0.05, Math.min(0.60, portfolio.cashWeight + cashDelta));
  const newTurnover = portfolio.turnoverUsed + (action === 'HOLD' ? 0 : 0.04 + Math.random() * 0.06);

  return {
    ...portfolio,
    value: newValue,
    drawdown: newDrawdown,
    volatility: newVolatility,
    cashWeight: newCash,
    turnoverUsed: newTurnover,
    correlationIndex: correlationLevel,
    positions: portfolio.positions.map(pos => ({
      ...pos,
      pnl: pos.pnl + portfolioReturn * (Math.random() * 0.5 + 0.75),
    })),
  };
}

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
      if (!run || !run.pendingAction) return state;
      const pendingAction = run.pendingAction;
      const cp = getCheckpoint(run.currentCheckpoint);
      if (!cp) return state;

      const branch = cp.availableActions.find(a => a.actionCode === pendingAction);
      const flags: BehavioralFlag[] = branch?.branchEffect.flagsAdd ?? [];
      const dimUpdates = branch?.branchEffect.alphaImpact ?? {};

      const score = scoreCheckpoint({
        action: pendingAction,
        checkpoint: cp,
        flags,
        confidence: run.pendingConfidence,
        turnoverUsed: run.portfolio.turnoverUsed,
        portfolioDD: run.portfolio.drawdown,
        machineDD: run.portfolio.drawdown - 0.02,
      });

      const newDecision: RunDecision = {
        checkpointSequence: run.currentCheckpoint,
        actionCode: pendingAction,
        thesisCode: run.pendingThesis ?? undefined,
        confidence: run.pendingConfidence,
        modulesConsulted: run.investigatedModules,
        scoreContribution: score.totalScore,
        quality: score.quality,
        behavioralFlags: flags,
        machineActionCode: cp.machineDecision.actionCode,
        committed: true,
      };

      const newPortfolio = simulatePortfolioAdvance(run.portfolio, pendingAction, run.currentCheckpoint);
      const newPlayerScore = Math.round((run.playerScore * (run.currentCheckpoint - 1) + score.totalScore) / run.currentCheckpoint);
      const newMachineScore = Math.round((run.machineScore * (run.currentCheckpoint - 1) + score.machineScore) / run.currentCheckpoint);
      const xpEarned = computeXpAward(score, cp.isRegimeChange);
      const newDimensions = updateDimensions(state.profile.dimensions, getDimensionUpdates(flags, dimUpdates));
      const newXp = state.profile.alphaXp + xpEarned;
      const newModuleUnlocks = checkModuleUnlocks({ ...state.profile, alphaXp: newXp }, run.currentCheckpoint);
      const newUnlocked = [...state.profile.unlockedModules, ...newModuleUnlocks];

      const criticalFailure = newPortfolio.drawdown <= -0.20;

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
        run: {
          ...run,
          phase: 'RESOLVING',
          decisions: [...run.decisions, newDecision],
          portfolio: newPortfolio,
          playerScore: newPlayerScore,
          machineScore: newMachineScore,
          pendingAction: null,
          pendingThesis: null,
          investigatedModules: [],
          criticalFailure,
        },
      };
    }

    case 'ADVANCE_CHECKPOINT': {
      if (!state.run) return state;
      const next = state.run.currentCheckpoint + 1;
      if (next > state.run.totalCheckpoints) {
        return { ...state, run: { ...state.run, phase: 'COMPLETE' } };
      }
      return {
        ...state,
        run: {
          ...state.run,
          currentCheckpoint: next,
          phase: 'SIGNAL',
          investigatedModules: [],
          pendingAction: null,
          pendingThesis: null,
        },
      };
    }

    case 'COMPLETE_RUN': {
      if (!state.run) return state;
      const won = action.result === 'MACHINE_BEATEN';
      return {
        ...state,
        run: { ...state.run, result: action.result, phase: 'COMPLETE' },
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
  useEffect(() => {
    if (!state.loaded) return;
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

  const startRun = useCallback(() => dispatch({ type: 'START_RUN' }), []);
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
