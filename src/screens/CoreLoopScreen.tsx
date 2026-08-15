import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useTips } from '../context/TipContext';
import type { ActionBranch } from '../lib/gameTypes';
import { getQualityColor } from '../lib/scoringEngine';
import {
  canAffordAction, isHoldOnly, turnoverCostFor, observationModeReason, resolveRunResult,
  STARTING_CAPITAL,
} from '../lib/runEngine';
import {
  THESIS_OPTIONS, thesisLabel, stanceLine, stanceTitle,
  convictionRange, isConvictionClamped, clampConviction,
  convictionToConfidence, confidenceToConviction,
  CONVICTION_STEP, PANEL_MODULE,
} from '../lib/decisionContract';
import PortfolioConstellation from '../components/game/PortfolioConstellation';
import MachineReveal from '../components/game/MachineReveal';
import MachinePipeline from '../components/game/MachinePipeline';
import MachineEvolution from '../components/game/MachineEvolution';
import { useVisualEvents, visualRegistry } from '../components/game/VisualEventLayer';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivePanel = 'SIGNAL' | 'PORTFOLIO' | 'RISK' | 'DECIDE';

const DIRECTION_COLORS = {
  up: 'text-paper-green',
  down: 'text-risk-red',
  neutral: 'text-phosphor-mid',
};

const MAGNITUDE_CLASSES = {
  low: 'opacity-60',
  medium: 'opacity-80',
  high: 'opacity-100',
  extreme: 'opacity-100 animate-pulse',
};

interface Props {
  onComplete: () => void;
  onBack: () => void;
  onHelp?: () => void;
}

export default function CoreLoopScreen({ onComplete, onBack, onHelp }: Props) {
  const {
    state,
    startRun,
    investigateModule,
    setPendingAction,
    setPendingThesis,
    setPendingConfidence,
    commitDecision,
    advanceCheckpoint,
    completeRun,
    clearModuleUnlock,
    currentCheckpointData,
  } = useGame();

  const { run, lastCheckpointScore, moduleJustUnlocked, xpJustEarned } = state;
  const { triggerEvent } = useTips();
  const { emit: emitVisual } = useVisualEvents();

  // ─── Tip tracking refs (prevent duplicate triggers) ──────────────────────────
  const tipsTriggered = useRef<Set<string>>(new Set());
  const tipOnce = useCallback((key: string, fn: () => void) => {
    if (!tipsTriggered.current.has(key)) {
      tipsTriggered.current.add(key);
      fn();
    }
  }, []);

  // ─── Local UI state ─────────────────────────────────────────────────────────
  // The decision itself (stance, thesis, conviction) lives in run state. Local
  // state is only which panel is open and whether the confirm step is showing.

  const [activePanel, setActivePanel] = useState<ActivePanel>('SIGNAL');
  const [commitConfirm, setCommitConfirm] = useState(false);
  const [revealDelay, setRevealDelay] = useState(0);

  // ─── Side effects ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!run) startRun();
  }, [run, startRun]);

  // Tip: first signal
  useEffect(() => {
    if (run?.phase === 'SIGNAL' && run.currentCheckpoint === 1) {
      tipOnce('signal_tip', () => triggerEvent('tutorial.first_signal'));
    }
  }, [run?.phase, run?.currentCheckpoint, tipOnce, triggerEvent]);

  // Visual: regime change
  useEffect(() => {
    if (run?.phase === 'SIGNAL' && currentCheckpointData?.isRegimeChange) {
      const cpKey = `vis_regime_${run.currentCheckpoint}`;
      tipOnce(cpKey, () =>
        emitVisual({
          type: 'REGIME_SHIFT',
          intensity: 0.8,
          payload: {
            regime: currentCheckpointData.phase.replace(/_/g, ' '),
            description: currentCheckpointData.signalTitle,
          },
          ...visualRegistry.REGIME_SHIFT,
        }),
      );
    }
  }, [run?.phase, run?.currentCheckpoint, currentCheckpointData, tipOnce, emitVisual]);

  // Tip: machine reveal
  useEffect(() => {
    if (run?.phase === 'RESOLVING') {
      tipOnce('machine_reveal_tip', () => {
        setTimeout(() => triggerEvent('tutorial.machine_reveal'), 1200);
      });
    }
  }, [run?.phase, tipOnce, triggerEvent]);

  // Tip: first score
  useEffect(() => {
    if (run?.phase === 'LEARNING' && lastCheckpointScore) {
      tipOnce('score_tip', () => triggerEvent('tutorial.first_score'));
    }
  }, [run?.phase, lastCheckpointScore, tipOnce, triggerEvent]);

  // Tip: covid arena enter
  useEffect(() => {
    if (run?.arenaId === 'covid_black_swan' && run.currentCheckpoint === 1 && run.phase === 'SIGNAL') {
      tipOnce('covid_enter', () => triggerEvent('arena.covid_enter'));
    }
  }, [run?.arenaId, run?.currentCheckpoint, run?.phase, tipOnce, triggerEvent]);

  // Tip + visual: drawdown warning
  useEffect(() => {
    if (run && run.portfolio.drawdown < -0.08) {
      tipOnce('drawdown_warn', () => triggerEvent('risk.drawdown_warning'));
      tipOnce('vis_drawdown', () =>
        emitVisual({
          type: 'DRAWDOWN_WARNING',
          intensity: Math.min(1, Math.abs(run.portfolio.drawdown) / 0.2),
          payload: {
            drawdown: run.portfolio.drawdown,
            message: `PORTFOLIO DRAWDOWN AT ${(run.portfolio.drawdown * 100).toFixed(1)}%. REVIEW RISK EXPOSURE.`,
          },
          ...visualRegistry.DRAWDOWN_WARNING,
        }),
      );
    }
  }, [run?.portfolio.drawdown, tipOnce, triggerEvent, emitVisual]);

  // Tip + visual: correlation spike
  useEffect(() => {
    if (run && run.portfolio.correlationIndex > 0.75) {
      tipOnce('correlation_spike', () => triggerEvent('arena.correlation_spike'));
      tipOnce('vis_correlation', () =>
        emitVisual({
          type: 'CORRELATION_COLLAPSE',
          intensity: run.portfolio.correlationIndex,
          payload: {
            correlationBefore: 0.35,
            correlationAfter: run.portfolio.correlationIndex,
            riskClustersBefore: 5,
            riskClustersAfter: 2,
          },
          ...visualRegistry.CORRELATION_COLLAPSE,
        }),
      );
    }
  }, [run?.portfolio.correlationIndex, tipOnce, triggerEvent, emitVisual]);

  // Tip + visual: cash raised
  useEffect(() => {
    if (run && run.portfolio.cashWeight > 0.30) {
      tipOnce('cash_raised', () => triggerEvent('arena.cash_raised'));
      tipOnce('vis_cash', () =>
        emitVisual({
          type: 'CASH_RAISED',
          intensity: run.portfolio.cashWeight,
          payload: {
            cashBefore: Math.max(0, run.portfolio.cashWeight - 0.12),
            cashAfter: run.portfolio.cashWeight,
          },
          ...visualRegistry.CASH_RAISED,
        }),
      );
    }
  }, [run?.portfolio.cashWeight, tipOnce, triggerEvent, emitVisual]);

  // Tip: module unlocks
  useEffect(() => {
    if (moduleJustUnlocked === 'CORRELATION_MATRIX') {
      triggerEvent('module.correlation_matrix_unlocked');
    }
    if (moduleJustUnlocked === 'REGIME_SCANNER') {
      triggerEvent('module.regime_scanner_unlocked');
    }
    if (moduleJustUnlocked === 'STAGED_EXECUTION') {
      triggerEvent('arena.staged_execution_unlocked');
    }
    if (moduleJustUnlocked) {
      const t = setTimeout(() => clearModuleUnlock(), 3000);
      return () => clearTimeout(t);
    }
  }, [moduleJustUnlocked, clearModuleUnlock, triggerEvent]);

  // RESOLVING: MachinePipeline drives reveal via onComplete → setRevealDelay(1)
  // COMPARING/LEARNING: show content immediately
  useEffect(() => {
    if (run?.phase === 'RESOLVING') {
      setRevealDelay(0);
    } else if (run?.phase === 'COMPARING' || run?.phase === 'LEARNING') {
      setRevealDelay(1);
    }
  }, [run?.phase]);

  // Reset the decision surface when the checkpoint advances
  useEffect(() => {
    setCommitConfirm(false);
    setActivePanel('SIGNAL');
  }, [run?.currentCheckpoint]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const openPanel = useCallback((panel: ActivePanel) => {
    setActivePanel(panel);
    if (panel === 'PORTFOLIO') {
      investigateModule(PANEL_MODULE.PORTFOLIO);
      tipOnce('portfolio_open', () => triggerEvent('tutorial.portfolio_open'));
    }
    if (panel === 'RISK') {
      investigateModule(PANEL_MODULE.RISK);
      tipOnce('risk_view', () => triggerEvent('risk.first_risk_contribution_view'));
    }
  }, [investigateModule, tipOnce, triggerEvent]);

  const selectStance = useCallback((branch: ActionBranch) => {
    setPendingAction(branch.actionCode);
    setCommitConfirm(false);
    setActivePanel('DECIDE');
    tipOnce('stance_selected', () => triggerEvent('tutorial.position_selected'));
    if (branch.actionCode !== 'HOLD' && run && run.portfolio.drawdown < -0.10) {
      tipOnce('large_reduction', () => triggerEvent('arena.large_reduction_proposed'));
    }
    if (branch.actionCode === 'HOLD') {
      tipOnce('hold_available', () => triggerEvent('tutorial.hold_available'));
    }
  }, [setPendingAction, tipOnce, triggerEvent, run]);

  const adjustConviction = useCallback((next: number) => {
    if (!run) return;
    setPendingConfidence(convictionToConfidence(clampConviction(next, run.currentCheckpoint)));
  }, [run, setPendingConfidence]);

  const handleReview = useCallback(() => {
    if (!run?.pendingAction || !run.pendingThesis) return;
    setCommitConfirm(true);
    setActivePanel('DECIDE');
    tipOnce('draft_ready', () => triggerEvent('tutorial.draft_ready'));
  }, [run?.pendingAction, run?.pendingThesis, tipOnce, triggerEvent]);

  const handleFinalCommit = useCallback(() => {
    commitDecision();
    setCommitConfirm(false);
  }, [commitDecision]);

  const handleLearnNext = useCallback(() => {
    if (!run) return;
    if (run.currentCheckpoint >= run.totalCheckpoints) {
      const won = run.playerScore > run.machineScore;
      completeRun(won ? 'MACHINE_BEATEN' : 'PASSED');
      onComplete();
    } else {
      // No countdown. The next signal arrives when the player asks for it.
      advanceCheckpoint();
    }
  }, [run, completeRun, onComplete, advanceCheckpoint]);

  // ─── Keyboard ────────────────────────────────────────────────────────────────
  // Every key here has a visible, clickable equivalent on screen.

  const decisionPhase = run?.phase === 'SIGNAL' || run?.phase === 'INVESTIGATING' || run?.phase === 'COMMITTING';
  const branches = useMemo(
    () => currentCheckpointData?.availableActions ?? [],
    [currentCheckpointData],
  );

  useEffect(() => {
    if (!decisionPhase || !run) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'Enter') {
        if (commitConfirm) handleFinalCommit();
        else handleReview();
        return;
      }
      if (e.key === 'Escape') { setCommitConfirm(false); return; }
      if (e.key === 'p' || e.key === 'P') { openPanel('PORTFOLIO'); return; }
      if (e.key === 'r' || e.key === 'R') { openPanel('RISK'); return; }
      if (e.key === 's' || e.key === 'S') { openPanel('SIGNAL'); return; }
      if (e.key === 'd' || e.key === 'D') { openPanel('DECIDE'); return; }

      // 1..4 select a stance card
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= branches.length) {
        const branch = branches[n - 1];
        if (canAffordAction(run, branch.actionCode, currentCheckpointData)) selectStance(branch);
        return;
      }

      // Arrows adjust conviction once a stance is chosen
      if (run.pendingAction) {
        const conviction = confidenceToConviction(run.pendingConfidence);
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          adjustConviction(conviction + CONVICTION_STEP);
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          adjustConviction(conviction - CONVICTION_STEP);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    decisionPhase, run, branches, currentCheckpointData, commitConfirm,
    handleFinalCommit, handleReview, openPanel, selectStance, adjustConviction,
  ]);

  // ─── Guard ───────────────────────────────────────────────────────────────────

  if (!run || !currentCheckpointData) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <span className="font-mono text-phosphor text-sm tracking-widest animate-pulse">
          INITIALIZING RUN...
        </span>
      </div>
    );
  }

  const cp = currentCheckpointData;
  const phase = run.phase;
  const portfolio = run.portfolio;
  const portfolioGain = ((portfolio.value - STARTING_CAPITAL) / STARTING_CAPITAL) * 100;
  const isObservation = run.criticalFailure;

  // ─── Decision state ──────────────────────────────────────────────────────────

  const stance = run.pendingAction;
  const thesis = run.pendingThesis;
  const conviction = confidenceToConviction(run.pendingConfidence);
  const range = convictionRange(run.currentCheckpoint);
  const convictionClamped = isConvictionClamped(run.currentCheckpoint);
  const decisionReady = Boolean(stance && thesis);
  const selectedBranch = branches.find(b => b.actionCode === stance) ?? null;

  // ─── Turnover ────────────────────────────────────────────────────────────────

  const turnoverBudget = run.turnoverBudget;
  const turnoverSpentPct = turnoverBudget > 0 ? portfolio.turnoverUsed / turnoverBudget : 1;
  const turnoverExhausted = isHoldOnly(run, cp);
  const turnoverColor =
    turnoverSpentPct > 0.85 ? 'text-risk-red' :
    turnoverSpentPct > 0.60 ? 'text-alert-amber' :
    'text-phosphor';
  const turnoverBarColor =
    turnoverSpentPct > 0.85 ? 'bg-risk-red' :
    turnoverSpentPct > 0.60 ? 'bg-alert-amber' :
    'bg-phosphor';

  // A run in observation mode cannot report MACHINE_BEATEN, whatever the
  // average score says. The engine resolves it; the screen only reports it.
  const observationReason = observationModeReason(run);
  const beatTheMachine =
    resolveRunResult(run, run.playerScore > run.machineScore ? 'MACHINE_BEATEN' : 'PASSED') === 'MACHINE_BEATEN';

  const lastDecision = run.decisions[run.decisions.length - 1];
  const earnedProcessCredit = Boolean(lastDecision?.behavioralFlags.includes('GOOD_PROCESS')) && cp.isRegimeChange;

  const PANEL_TABS: { id: ActivePanel; label: string; key: string }[] = [
    { id: 'SIGNAL', label: 'SIGNAL', key: 'S' },
    { id: 'PORTFOLIO', label: 'PORTFOLIO', key: 'P' },
    { id: 'RISK', label: 'RISK', key: 'R' },
    { id: 'DECIDE', label: decisionReady ? 'DECIDE ✓' : 'DECIDE', key: 'D' },
  ];

  return (
    <div className="min-h-screen bg-terminal-black terminal-screen flex flex-col font-mono">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-phosphor/15 bg-terminal-deep/60 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-phosphor-dim text-xs hover:text-phosphor transition-colors tracking-widest"
          >
            ← ABORT
          </button>
          <div className="h-4 w-px bg-phosphor/20" />
          <span className="text-phosphor-dim text-xs tracking-widest">COVID BLACK SWAN</span>
          <div className="h-4 w-px bg-phosphor/20" />
          <span className="text-phosphor text-xs tracking-widest">
            CP {String(run.currentCheckpoint).padStart(2, '0')} / {String(run.totalCheckpoints).padStart(2, '0')}
          </span>
          {isObservation && (
            <span className="text-alert-amber text-xs tracking-widest animate-pulse border border-alert-amber/40 px-2 py-0.5">
              OBSERVATION MODE
            </span>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${run.playerScore >= run.machineScore ? 'text-paper-green' : 'text-risk-red'}`}>
              YOU {run.playerScore}
            </span>
            <span className="text-phosphor-dim text-xs">·</span>
            <span className="text-phosphor-mid text-xs">MCH {run.machineScore}</span>
          </div>
          <div className={`text-xs font-bold tabular-nums ${portfolioGain >= 0 ? 'text-paper-green' : 'text-risk-red'}`}>
            {portfolioGain >= 0 ? '+' : ''}{portfolioGain.toFixed(2)}%
          </div>
          {onHelp && (
            <button onClick={onHelp} className="text-phosphor-dim text-xs hover:text-phosphor transition-colors">
              ? HELP
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-terminal-panel">
        <div
          className="h-full bg-phosphor/40 transition-all duration-700"
          style={{ width: `${((run.currentCheckpoint - 1) / run.totalCheckpoints) * 100}%` }}
        />
      </div>

      {/* Module unlock toast */}
      {moduleJustUnlocked && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-terminal-deep border border-paper-green/60 px-6 py-3 text-xs tracking-widest text-paper-green animate-boot-fade">
          ▲ MODULE UNLOCKED: {moduleJustUnlocked.replace(/_/g, ' ')}
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: signal sidebar ── */}
        <div className="w-64 flex-shrink-0 border-r border-phosphor/10 flex flex-col">
          <div className="px-4 py-3 border-b border-phosphor/10 bg-terminal-deep/40">
            <div className="text-phosphor-dim text-xs tracking-widest mb-1">
              {cp.phase.replace(/_/g, ' ')} · {cp.crisisDay}
            </div>
            <div className="text-phosphor text-sm font-bold leading-tight">{cp.signalTitle}</div>
          </div>

          <div className="px-4 py-3 border-b border-phosphor/10 text-phosphor-mid text-xs leading-relaxed overflow-y-auto max-h-36">
            {cp.signalBody}
          </div>

          <div className="px-4 py-3 border-b border-phosphor/10">
            <div className="text-phosphor-dim text-xs tracking-widest mb-2">MARKET DATA</div>
            <div className="space-y-1.5">
              {cp.marketSignals.map((sig, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-phosphor-dim text-xs">{sig.indicator}</span>
                  <span className={`text-xs font-bold tabular-nums ${DIRECTION_COLORS[sig.direction]} ${MAGNITUDE_CLASSES[sig.magnitude]}`}>
                    {sig.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 px-4 py-3 overflow-y-auto">
            <div className="text-phosphor-dim text-xs tracking-widest mb-2">WIRE</div>
            <div className="space-y-2">
              {cp.eventFeed.slice(0, 4).map((ev, i) => (
                <div key={i} className="border-l-2 border-phosphor/20 pl-2">
                  <div className="text-phosphor-dim text-xs tracking-widest">{ev.category}</div>
                  <div className="text-phosphor-mid text-xs leading-snug mt-0.5">{ev.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-2 border-t border-phosphor/10 bg-terminal-deep/40 text-xs space-y-0.5">
            <div className="flex justify-between">
              <span className="text-phosphor-dim">CASH</span>
              <span className="text-phosphor">{(portfolio.cashWeight * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-phosphor-dim">DRAWDOWN</span>
              <span className={portfolio.drawdown < -0.10 ? 'text-risk-red' : portfolio.drawdown < -0.05 ? 'text-alert-amber' : 'text-phosphor'}>
                {(portfolio.drawdown * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <div className="flex justify-between">
                <span className="text-phosphor-dim">TURNOVER BUDGET</span>
                <span className={turnoverColor}>
                  {(portfolio.turnoverUsed * 100).toFixed(0)}% / {(turnoverBudget * 100).toFixed(0)}%
                </span>
              </div>
              <div
                className="mt-1 h-1.5 bg-phosphor/10"
                role="meter"
                aria-label="TURNOVER BUDGET SPENT"
                aria-valuenow={Math.round(turnoverSpentPct * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full ${turnoverBarColor}`}
                  style={{ width: `${Math.min(100, turnoverSpentPct * 100)}%` }}
                />
              </div>
              {turnoverExhausted && (
                <div className="text-risk-red text-xs tracking-widest mt-1">
                  TURNOVER BUDGET EXHAUSTED. HOLD ONLY.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Center: decision workspace ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {decisionPhase && (
            <>
              {/* Panel tabs */}
              <div className="flex border-b border-phosphor/15 flex-shrink-0">
                {PANEL_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => openPanel(tab.id)}
                    className={`px-4 py-2.5 text-xs tracking-widest border-r border-phosphor/10 transition-colors flex-shrink-0 ${
                      activePanel === tab.id
                        ? 'text-phosphor bg-phosphor/8 border-b border-phosphor'
                        : 'text-phosphor-dim hover:text-phosphor-mid hover:bg-phosphor/5'
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1.5 text-phosphor-dim/50 text-xs">[{tab.key}]</span>
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-y-auto">

                {/* SIGNAL panel */}
                {activePanel === 'SIGNAL' && (
                  <div className="p-5">
                    <div className="text-phosphor-dim text-xs tracking-widest mb-1">TODAY'S SIGNAL</div>
                    <div className="text-phosphor text-lg font-bold mb-3 leading-snug">{cp.signalTitle}</div>
                    <div className="text-phosphor-mid text-xs leading-relaxed mb-5">{cp.signalBody}</div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {cp.eventFeed.map((ev, i) => (
                        <div key={i} className="border-l-2 border-phosphor/20 pl-3">
                          <div className="text-phosphor-dim text-xs tracking-widest">{ev.category}</div>
                          <div className="text-phosphor-mid text-xs mt-0.5 leading-snug">{ev.text}</div>
                        </div>
                      ))}
                    </div>

                    {cp.isRegimeChange && (
                      <div className="border border-alert-amber/40 bg-alert-amber/5 px-4 py-2.5 text-alert-amber text-xs tracking-widest mb-3">
                        ▲ REGIME CHANGE SIGNAL
                      </div>
                    )}

                    {isObservation && (
                      <div className="border border-alert-amber/60 bg-alert-amber/8 px-4 py-3 mb-3 text-alert-amber text-xs leading-relaxed">
                        OBSERVATION MODE: DRAWDOWN EXCEEDS -20%. RUN CONTINUES BUT CANNOT PASS. USE THIS TIME TO STUDY MACHINE DECISIONS.
                      </div>
                    )}

                    <button
                      onClick={() => openPanel('DECIDE')}
                      className="cmd-button-primary w-full py-3 text-xs tracking-widest"
                    >
                      DECIDE ▶ [D]
                    </button>
                  </div>
                )}

                {/* PORTFOLIO panel: read-only investigation */}
                {activePanel === 'PORTFOLIO' && (
                  <div className="p-5">
                    <div className="text-phosphor-dim text-xs tracking-widest mb-3">
                      YOUR POSITIONS · READ ONLY
                    </div>

                    {portfolio.positions.length > 0 && (
                      <div className="flex justify-center mb-4 border border-phosphor/10 bg-terminal-deep/40 py-2">
                        <PortfolioConstellation
                          positions={portfolio.positions}
                          correlationIndex={portfolio.correlationIndex}
                          drawdown={portfolio.drawdown}
                          width={340}
                          height={200}
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {portfolio.positions.map(pos => (
                        <div
                          key={pos.symbol}
                          className="w-full flex items-center justify-between text-xs p-2.5 border border-phosphor/15 text-phosphor-mid"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-phosphor w-10">{pos.symbol}</span>
                            <span className="text-phosphor-dim">{pos.sector}</span>
                          </div>
                          <div className="flex items-center gap-3 tabular-nums">
                            <span>{Math.round(pos.weight * 100)}%</span>
                            <span className={pos.pnl >= 0 ? 'text-paper-green' : 'text-risk-red'}>
                              {pos.pnl >= 0 ? '+' : ''}{(pos.pnl * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-phosphor-dim text-xs leading-relaxed mt-4 border-t border-phosphor/10 pt-3">
                      YOU DO NOT TRADE INDIVIDUAL POSITIONS. YOU SET A STANCE FOR THE WHOLE PORTFOLIO.
                    </div>
                  </div>
                )}

                {/* RISK panel: read-only investigation */}
                {activePanel === 'RISK' && (
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'PORTFOLIO VALUE', value: `$${Math.round(portfolio.value).toLocaleString()}`, warn: false },
                        { label: 'DRAWDOWN', value: `${(portfolio.drawdown * 100).toFixed(1)}%`, warn: portfolio.drawdown < -0.10 },
                        { label: 'VOLATILITY', value: `${(portfolio.volatility * 100).toFixed(1)}%`, warn: portfolio.volatility > 0.25 },
                        { label: 'TURNOVER USED', value: `${(portfolio.turnoverUsed * 100).toFixed(0)}%`, warn: portfolio.turnoverUsed > 0.30 },
                        { label: 'CASH WEIGHT', value: `${(portfolio.cashWeight * 100).toFixed(0)}%`, warn: portfolio.cashWeight < 0.05 },
                        { label: 'CORRELATION', value: portfolio.correlationIndex.toFixed(2), warn: portfolio.correlationIndex > 0.80 },
                      ].map(m => (
                        <div key={m.label} className="terminal-panel p-3">
                          <div className="text-phosphor-dim text-xs tracking-widest mb-1">{m.label}</div>
                          <div className={`text-sm font-bold ${m.warn ? 'text-alert-amber' : 'text-phosphor'}`}>
                            {m.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="terminal-panel p-4">
                      <div className="text-phosphor-dim text-xs tracking-widest mb-3">SECTOR EXPOSURE</div>
                      <div className="space-y-2">
                        {Object.entries(portfolio.sectorExposure).map(([sector, pct]) => (
                          <div key={sector}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-phosphor-dim">{sector}</span>
                              <span className={pct > 0.25 ? 'text-alert-amber' : 'text-phosphor'}>
                                {Math.round(pct * 100)}%
                              </span>
                            </div>
                            <div className="h-1 bg-phosphor/10">
                              <div
                                className={`h-full transition-all ${pct > 0.25 ? 'bg-alert-amber' : 'bg-phosphor/40'}`}
                                style={{ width: `${Math.min(100, pct * 300)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {cp.isRegimeChange && (
                      <div className="border border-phosphor/25 bg-phosphor/5 px-4 py-2.5 text-phosphor text-xs tracking-widest">
                        ✓ RISK CONSULTED BEFORE A REGIME CALL. THIS IS RECORDED.
                      </div>
                    )}

                    {isObservation && (
                      <div className="border border-risk-red/60 bg-risk-red/5 px-4 py-3 text-risk-red text-xs leading-relaxed">
                        OBSERVATION MODE ACTIVE. DRAWDOWN {Math.abs(portfolio.drawdown * 100).toFixed(1)}% EXCEEDS -20% THRESHOLD. RUN CONTINUES, MACHINE COMPARISON ONLY.
                      </div>
                    )}
                  </div>
                )}

                {/* DECIDE panel: stance, thesis, conviction */}
                {activePanel === 'DECIDE' && (
                  <div className="p-5">

                    {/* ── 1. Stance ── */}
                    <div className="text-phosphor-dim text-xs tracking-widest mb-2">
                      1 · STANCE
                    </div>
                    <div className="space-y-2 mb-6">
                      {branches.map((branch, i) => {
                        const affordable = canAffordAction(run, branch.actionCode, cp);
                        const selected = stance === branch.actionCode;
                        const cost = turnoverCostFor(branch.actionCode, cp);
                        return (
                          <button
                            key={branch.actionCode}
                            onClick={() => affordable && selectStance(branch)}
                            disabled={!affordable}
                            aria-pressed={selected}
                            className={`w-full text-left p-3 border transition-colors ${
                              selected
                                ? 'border-phosphor bg-phosphor/10'
                                : affordable
                                  ? 'border-phosphor/20 hover:border-phosphor/45 hover:bg-phosphor/5'
                                  : 'border-phosphor/10 opacity-40 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-phosphor-dim/60 text-xs">[{i + 1}]</span>
                                <span className={`text-sm font-bold tracking-wide ${selected ? 'text-phosphor' : 'text-phosphor-mid'}`}>
                                  {stanceTitle(branch)}
                                </span>
                                {selected && <span className="text-phosphor text-xs">✓</span>}
                              </div>
                              <span className={`text-xs tabular-nums ${affordable ? 'text-phosphor-dim' : 'text-risk-red'}`}>
                                {cost === 0 ? 'FREE' : `${(cost * 100).toFixed(0)}% TURNOVER`}
                              </span>
                            </div>
                            <div className="text-phosphor-dim text-xs leading-snug mt-1 pl-7">
                              {stanceLine(branch)}
                            </div>
                            {!affordable && (
                              <div className="text-risk-red text-xs tracking-widest mt-1 pl-7">
                                NOT ENOUGH TURNOVER BUDGET REMAINING.
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* ── 2. Thesis ── */}
                    <div className={stance ? '' : 'opacity-40 pointer-events-none'}>
                      <div className="text-phosphor-dim text-xs tracking-widest mb-2">
                        2 · THESIS · WHY THIS STANCE
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mb-6">
                        {THESIS_OPTIONS.map(t => (
                          <button
                            key={t.code}
                            onClick={() => { setPendingThesis(t.code); setCommitConfirm(false); }}
                            aria-pressed={thesis === t.code}
                            className={`text-left text-xs py-2 px-3 border transition-colors ${
                              thesis === t.code
                                ? 'border-phosphor bg-phosphor/10 text-phosphor'
                                : 'border-phosphor/15 text-phosphor-dim hover:border-phosphor/35 hover:text-phosphor-mid'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── 3. Conviction ── */}
                    <div className={stance ? '' : 'opacity-40 pointer-events-none'}>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-phosphor-dim text-xs tracking-widest">3 · CONVICTION</span>
                        <span className="text-phosphor text-lg font-bold tabular-nums">{conviction}</span>
                      </div>
                      <div className="flex items-center gap-3 mb-1">
                        <button
                          onClick={() => adjustConviction(conviction - CONVICTION_STEP)}
                          aria-label="LOWER CONVICTION"
                          className="w-8 h-8 border border-phosphor/25 text-phosphor-dim hover:text-phosphor hover:border-phosphor/50 transition-colors"
                        >
                          −
                        </button>
                        <input
                          type="range"
                          min={range.min}
                          max={range.max}
                          step={CONVICTION_STEP}
                          value={conviction}
                          onChange={e => adjustConviction(Number(e.target.value))}
                          aria-label="CONVICTION"
                          className="flex-1 accent-phosphor"
                        />
                        <button
                          onClick={() => adjustConviction(conviction + CONVICTION_STEP)}
                          aria-label="RAISE CONVICTION"
                          className="w-8 h-8 border border-phosphor/25 text-phosphor-dim hover:text-phosphor hover:border-phosphor/50 transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex justify-between text-phosphor-dim text-xs mb-1">
                        <span>{range.min}</span>
                        <span>{range.max}</span>
                      </div>
                      {convictionClamped && (
                        <div className="text-phosphor-dim text-xs tracking-widest mb-6">
                          CONVICTION RANGE OPENS AT CP5
                        </div>
                      )}
                      {!convictionClamped && <div className="mb-6" />}
                    </div>

                    {/* ── Commit ── */}
                    {commitConfirm ? (
                      <div className="border border-phosphor/40 bg-phosphor/5 p-4 animate-boot-fade">
                        <div className="text-phosphor-dim text-xs tracking-widest mb-2">CONFIRM DECISION</div>
                        <div className="text-phosphor text-sm font-bold mb-1">
                          {selectedBranch ? stanceTitle(selectedBranch) : stance}
                        </div>
                        <div className="text-phosphor-mid text-xs mb-1">
                          {thesisLabel(thesis)} · CONVICTION {conviction}
                        </div>
                        <div className="text-phosphor-dim text-xs mb-4">
                          TURNOVER COST {stance ? (turnoverCostFor(stance, cp) * 100).toFixed(0) : 0}%. THIS CANNOT BE UNDONE. THE MARKET WILL RESOLVE.
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleFinalCommit}
                            className="flex-1 py-2.5 text-xs tracking-widest border border-phosphor text-phosphor hover:bg-phosphor/15 transition-colors"
                          >
                            COMMIT ▶ [ENTER]
                          </button>
                          <button
                            onClick={() => setCommitConfirm(false)}
                            className="px-4 py-2.5 text-xs tracking-widest border border-phosphor/20 text-phosphor-dim hover:border-phosphor/40 transition-colors"
                          >
                            REVISE
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleReview}
                        disabled={!decisionReady}
                        className={`w-full py-3 text-xs tracking-widest border transition-colors ${
                          decisionReady
                            ? 'border-phosphor text-phosphor hover:bg-phosphor/10'
                            : 'border-phosphor/10 text-phosphor-dim cursor-not-allowed'
                        }`}
                      >
                        {stance
                          ? thesis ? 'REVIEW & COMMIT ▶ [ENTER]' : 'SELECT A THESIS TO CONTINUE'
                          : 'SELECT A STANCE TO CONTINUE'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Resolve / Compare / Learn ── */}
          {(phase === 'RESOLVING' || phase === 'COMPARING' || phase === 'LEARNING') && lastCheckpointScore && (
            <div className="flex-1 overflow-y-auto p-6">
              {/* Machine pipeline: processing animation */}
              {phase === 'RESOLVING' && revealDelay === 0 && (
                <div className="mb-5 border border-phosphor/10 bg-terminal-deep/40 p-4">
                  <MachinePipeline
                    autoPlay
                    autoPlayDurationMs={750}
                    onComplete={() => setRevealDelay(1)}
                  />
                </div>
              )}

              {/* Your call vs machine reveal */}
              <div
                className="grid grid-cols-2 gap-4 mb-5 transition-opacity duration-500"
                style={{ opacity: revealDelay }}
              >
                <div className="border border-phosphor/20 bg-terminal-deep/40 p-4">
                  <div className="text-phosphor-dim text-xs tracking-widest mb-2">YOUR CALL</div>
                  <div className="text-phosphor text-xl font-bold tracking-wide">
                    {lastDecision?.actionCode}
                  </div>
                  <div className="text-phosphor-dim text-xs mt-1">
                    {thesisLabel(lastDecision?.thesisCode)} · CONVICTION {confidenceToConviction(lastDecision?.confidence ?? 0)}
                  </div>
                </div>
                <div className="border border-phosphor/15 bg-terminal-deep/30 p-4">
                  <MachineReveal
                    action={cp.machineDecision.actionCode}
                    reasoning={cp.machineDecision.policyReason}
                    durationMs={600}
                  />
                </div>
              </div>

              {/* Score card */}
              <div
                className="border px-5 py-4 mb-4 transition-opacity duration-700"
                style={{
                  borderColor: getQualityColor(lastCheckpointScore.quality) + '60',
                  opacity: revealDelay,
                }}
              >
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="text-phosphor-dim text-xs tracking-widest">CHECKPOINT SCORE</div>
                    <div className="text-4xl font-bold mt-1" style={{ color: getQualityColor(lastCheckpointScore.quality) }}>
                      {lastCheckpointScore.totalScore}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-phosphor-dim text-xs tracking-widest">MACHINE</div>
                    <div className="text-2xl font-bold text-phosphor-mid mt-1">{lastCheckpointScore.machineScore}</div>
                    <div className="text-phosphor-dim text-xs tracking-widest mt-0.5">PAR {cp.machinePar}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                  {[
                    { label: 'RAER', val: lastCheckpointScore.raerScore },
                    { label: 'DRAWDOWN', val: lastCheckpointScore.drawdownScore },
                    { label: 'DOWNSIDE', val: lastCheckpointScore.downsideScore },
                    { label: 'REGIME', val: lastCheckpointScore.regimeAdaptScore },
                    { label: 'TURNOVER', val: lastCheckpointScore.turnoverScore },
                    { label: 'CONSISTENCY', val: lastCheckpointScore.consistencyScore },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div className="text-phosphor-dim">{label}</div>
                      <div className="text-phosphor font-bold">{val}</div>
                    </div>
                  ))}
                </div>

                {earnedProcessCredit && (
                  <div className="text-paper-green text-xs tracking-wide mb-2">
                    PROCESS: CONSULTED RISK BEFORE A REGIME CALL. +
                  </div>
                )}

                {lastCheckpointScore.delta > 0 ? (
                  <div className="text-paper-green text-xs tracking-wide">▲ +{lastCheckpointScore.delta} VS MACHINE</div>
                ) : lastCheckpointScore.delta < 0 ? (
                  <div className="text-risk-red text-xs tracking-wide">▼ {lastCheckpointScore.delta} VS MACHINE</div>
                ) : (
                  <div className="text-phosphor-mid text-xs tracking-wide">= TIED WITH MACHINE</div>
                )}
              </div>

              {/* Teaching */}
              <div
                className="border border-phosphor/15 bg-terminal-deep/40 px-4 py-3 mb-4 transition-opacity duration-700"
                style={{ opacity: revealDelay }}
              >
                <div className="text-phosphor-dim text-xs tracking-widest mb-1">PROCESS NOTE</div>
                <div className="text-phosphor-mid text-xs leading-relaxed">{cp.teachingPoint}</div>
                {cp.isHoldValid && lastDecision?.actionCode === 'HOLD' && cp.holdTeaching && (
                  <div className="mt-2 text-paper-green text-xs">✓ {cp.holdTeaching}</div>
                )}
              </div>

              {/* Machine reasoning */}
              <div className="mb-4 transition-opacity duration-700" style={{ opacity: revealDelay }}>
                <div className="text-phosphor-dim text-xs tracking-widest mb-2">MACHINE REASONING</div>
                <div className="space-y-1">
                  {cp.machineDecision.reasoning.slice(0, 3).map((r, i) => (
                    <div key={i} className="text-phosphor-dim text-xs border-l border-phosphor/20 pl-2">{r}</div>
                  ))}
                </div>
              </div>

              {xpJustEarned > 0 && (
                <div className="text-paper-green text-xs tracking-widest mb-4 transition-opacity duration-700" style={{ opacity: revealDelay }}>
                  + {xpJustEarned} ALPHA XP EARNED
                </div>
              )}

              {/* Advance */}
              {run.currentCheckpoint >= run.totalCheckpoints ? (
                <button
                  onClick={() => {
                    const won = run.playerScore > run.machineScore;
                    completeRun(won ? 'MACHINE_BEATEN' : 'PASSED');
                    onComplete();
                  }}
                  className="cmd-button-primary w-full py-3 text-sm tracking-widest"
                >
                  VIEW RUN RESULTS ▶
                </button>
              ) : (
                <button onClick={handleLearnNext} className="cmd-button-primary w-full py-3 text-sm tracking-widest">
                  NEXT SIGNAL ▶
                </button>
              )}
            </div>
          )}

          {/* ── COMPLETE ── */}
          {phase === 'COMPLETE' && (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="text-phosphor-dim text-xs tracking-widest mb-2">RUN COMPLETE</div>
              <div className={`text-3xl font-bold mb-2 ${beatTheMachine ? 'text-paper-green' : 'text-risk-red'}`}>
                {beatTheMachine ? 'MACHINE BEATEN' : 'MACHINE WINS'}
              </div>
              <div className="text-phosphor-mid text-sm mb-2">
                {run.playerScore} vs {run.machineScore}
              </div>
              {observationReason && (
                <div className="text-risk-red text-xs tracking-widest text-center max-w-md mb-4 leading-relaxed">
                  {observationReason}
                </div>
              )}
              <div className="mb-2" />
              <button onClick={onComplete} className="cmd-button-primary px-8 py-3 tracking-widest text-sm">
                VIEW AUTOPSY ▶
              </button>
            </div>
          )}
        </div>

        {/* ── Right: status sidebar ── */}
        <div className="w-52 flex-shrink-0 border-l border-phosphor/10 flex flex-col">
          <div className="px-4 py-3 border-b border-phosphor/10 bg-terminal-deep/40">
            <div className="text-phosphor-dim text-xs tracking-widest mb-2">ALPHA PROFILE</div>
            <div className="text-phosphor text-xs font-bold">{state.profile.rankCode.replace(/_/g, ' ')}</div>
            <div className="text-phosphor-dim text-xs mt-0.5">{state.profile.alphaXp} XP</div>
          </div>

          <div className="flex-1 px-3 py-3 overflow-y-auto">
            <div className="text-phosphor-dim text-xs tracking-widest mb-2">DECISION LOG</div>
            <div className="space-y-1.5">
              {run.decisions.map((d, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-phosphor-dim">CP{String(d.checkpointSequence).padStart(2, '0')}</span>
                  <span className={`font-bold ${
                    d.quality === 'EXCELLENT' ? 'text-paper-green' :
                    d.quality === 'GOOD' ? 'text-phosphor' :
                    d.quality === 'NEUTRAL' ? 'text-phosphor-mid' :
                    d.quality === 'POOR' ? 'text-alert-amber' :
                    'text-risk-red'
                  }`}>{d.actionCode}</span>
                  <span className="text-phosphor-dim">{d.scoreContribution}</span>
                </div>
              ))}
              {run.decisions.length === 0 && (
                <div className="text-phosphor-dim text-xs">NO DECISIONS YET</div>
              )}
            </div>
          </div>

          <div className="px-3 py-3 border-t border-phosphor/10">
            <MachineEvolution
              activeModules={run.activeModules}
              justUnlocked={moduleJustUnlocked ?? null}
              compact
            />
          </div>
        </div>
      </div>

      {/* ── Contextual action bar ── */}
      {decisionPhase && (
        <div className="border-t border-phosphor/15 px-4 py-2.5 flex items-center gap-4 bg-terminal-deep/40 flex-shrink-0">
          <button
            onClick={() => openPanel('DECIDE')}
            className="text-xs tracking-widest text-phosphor-dim hover:text-phosphor transition-colors border border-phosphor/20 px-3 py-1.5 hover:border-phosphor/40"
          >
            [D] DECIDE
          </button>
          <button
            onClick={() => openPanel('PORTFOLIO')}
            className="text-xs tracking-widest text-phosphor-dim hover:text-phosphor transition-colors border border-phosphor/20 px-3 py-1.5 hover:border-phosphor/40"
          >
            [P] PORTFOLIO
          </button>
          <button
            onClick={() => openPanel('RISK')}
            className="text-xs tracking-widest text-phosphor-dim hover:text-phosphor transition-colors border border-phosphor/20 px-3 py-1.5 hover:border-phosphor/40"
          >
            [R] RISK
          </button>
          {onHelp && (
            <button
              onClick={onHelp}
              className="text-xs tracking-widest text-phosphor-dim hover:text-phosphor transition-colors border border-phosphor/15 px-3 py-1.5 hover:border-phosphor/30"
            >
              [?] HELP
            </button>
          )}
          <div className="flex-1" />
          {decisionReady && !commitConfirm && (
            <button
              onClick={handleReview}
              className="text-xs tracking-widest text-phosphor border border-phosphor/60 px-4 py-1.5 hover:bg-phosphor/10 transition-colors"
            >
              REVIEW DECISION →
            </button>
          )}
          {/* 5-question footer */}
          <div className="hidden xl:flex items-center gap-6 text-xs text-phosphor-dim ml-4 pl-4 border-l border-phosphor/10">
            <div>WHAT: <span className="text-phosphor">{cp.crisisDay}</span></div>
            <div>INFO: <span className="text-phosphor">SIGNAL+PORTFOLIO+RISK</span></div>
            <div>DO: <span className="text-phosphor">STANCE·THESIS·CONVICTION</span></div>
            <div>VS MCH: <span className={run.playerScore >= run.machineScore ? 'text-paper-green' : 'text-risk-red'}>
              {run.playerScore} · {run.machineScore}
            </span></div>
          </div>
        </div>
      )}
    </div>
  );
}
