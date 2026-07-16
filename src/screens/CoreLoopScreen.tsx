import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useTips } from '../context/TipContext';
import type { ActionCode, ThesisCode } from '../lib/gameTypes';
import { getQualityColor } from '../lib/scoringEngine';
import PortfolioConstellation from '../components/game/PortfolioConstellation';
import MachineReveal from '../components/game/MachineReveal';
import MachinePipeline from '../components/game/MachinePipeline';
import MachineEvolution from '../components/game/MachineEvolution';
import { useVisualEvents, visualRegistry } from '../components/game/VisualEventLayer';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivePanel = 'SIGNAL' | 'PORTFOLIO' | 'RISK' | 'DRAFT';

type PositionAction = 'ADD' | 'REDUCE' | 'EXIT' | 'HOLD';

interface DraftOrder {
  symbol: string;
  action: PositionAction;
  amount: number;
}

const HOLD_REASONS: { code: ThesisCode; label: string }[] = [
  { code: 'THESIS_UNCHANGED', label: 'THESIS UNCHANGED' },
  { code: 'LIQUIDITY_PRESERVATION', label: 'INSUFFICIENT INFORMATION' },
  { code: 'VALUATION', label: 'AWAIT CONFIRMATION' },
  { code: 'CONTRARIAN', label: 'VALUATION SUPPORT' },
  { code: 'POLICY_RESPONSE', label: 'POLICY FLOOR' },
];

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

// Maps position action to game ActionCode
function positionActionsToGameAction(orders: DraftOrder[]): ActionCode {
  const hasReduce = orders.some(o => o.action === 'REDUCE' || o.action === 'EXIT');
  const hasAdd = orders.some(o => o.action === 'ADD');
  if (hasReduce && hasAdd) return 'ROTATE_DEFENSIVE';
  if (hasReduce) return 'REDUCE';
  if (hasAdd) return 'ADD_RISK';
  return 'HOLD';
}

interface Props {
  onComplete: () => void;
  onBack: () => void;
  onHelp?: () => void;
}

export default function CoreLoopScreen({ onComplete, onBack, onHelp }: Props) {
  const {
    state,
    startRun,
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

  const [activePanel, setActivePanel] = useState<ActivePanel>('SIGNAL');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [orderAction, setOrderAction] = useState<PositionAction | null>(null);
  const [orderAmount, setOrderAmount] = useState<number>(2000);
  const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([]);
  const [holdReason, setHoldReason] = useState<ThesisCode | null>(null);
  const [holdConfirmed, setHoldConfirmed] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [revealDelay, setRevealDelay] = useState(0);
  const [commitConfirm, setCommitConfirm] = useState(false);

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

  // Reset draft when checkpoint advances
  useEffect(() => {
    setDraftOrders([]);
    setHoldReason(null);
    setHoldConfirmed(false);
    setCommitConfirm(false);
    setSelectedSymbol(null);
    setOrderAction(null);
    setActivePanel('SIGNAL');
  }, [run?.currentCheckpoint]);

  // Keyboard: P/R/S/C/H/ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (run?.phase !== 'SIGNAL' && run?.phase !== 'INVESTIGATING') return;
      if (e.key === 'p' || e.key === 'P') setActivePanel('PORTFOLIO');
      if (e.key === 'r' || e.key === 'R') setActivePanel('RISK');
      if (e.key === 's' || e.key === 'S') setActivePanel('SIGNAL');
      if (e.key === 'd' || e.key === 'D') setActivePanel('DRAFT');
      if (e.key === 'Escape') {
        setSelectedSymbol(null);
        setOrderAction(null);
        setCommitConfirm(false);
      }
      if (e.key === 'Enter' && commitConfirm) handleFinalCommit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.phase, commitConfirm]);

  const triggerCountdown = useCallback(() => {
    setCountdownActive(true);
    setCountdown(3);
  }, []);

  useEffect(() => {
    if (!countdownActive) return;
    if (countdown <= 0) {
      setCountdownActive(false);
      advanceCheckpoint();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdownActive, countdown, advanceCheckpoint]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const addToDraft = () => {
    if (!selectedSymbol || !orderAction) return;
    setDraftOrders(d => {
      const existing = d.findIndex(o => o.symbol === selectedSymbol);
      if (existing >= 0) {
        const updated = [...d];
        updated[existing] = { symbol: selectedSymbol, action: orderAction, amount: orderAmount };
        return updated;
      }
      return [...d, { symbol: selectedSymbol, action: orderAction, amount: orderAmount }];
    });
    setSelectedSymbol(null);
    setOrderAction(null);
    setOrderAmount(2000);
    setActivePanel('DRAFT');
    tipOnce('first_order', () => triggerEvent('tutorial.first_order_added'));
  };

  const removeFromDraft = (symbol: string) => {
    setDraftOrders(d => d.filter(o => o.symbol !== symbol));
  };

  const handleHoldCommit = () => {
    if (!holdReason) return;
    setPendingAction('HOLD');
    setPendingThesis(holdReason);
    setPendingConfidence(0.7);
    setHoldConfirmed(true);
    setCommitConfirm(true);
    setActivePanel('DRAFT');
  };

  const handleDraftCommit = () => {
    if (draftOrders.length === 0 && !holdConfirmed) return;
    if (!holdConfirmed) {
      const gameAction = positionActionsToGameAction(draftOrders);
      setPendingAction(gameAction);
      setPendingConfidence(0.7);
    }
    setCommitConfirm(true);
    setActivePanel('DRAFT');
    tipOnce('draft_ready', () => triggerEvent('tutorial.draft_ready'));
  };

  const handleFinalCommit = () => {
    commitDecision();
    setCommitConfirm(false);
  };

  const handleLearnNext = () => {
    if (!run) return;
    if (run.currentCheckpoint >= run.totalCheckpoints) {
      const won = run.playerScore > run.machineScore;
      completeRun(won ? 'MACHINE_BEATEN' : 'PASSED');
      onComplete();
    } else {
      triggerCountdown();
    }
  };

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
  const portfolioGain = ((portfolio.value - 100000) / 100000) * 100;
  const isObservation = portfolio.drawdown <= -0.20;
  const hasDraft = draftOrders.length > 0 || holdConfirmed;

  const PANEL_TABS: { id: ActivePanel; label: string; key: string }[] = [
    { id: 'SIGNAL', label: 'SIGNAL', key: 'S' },
    { id: 'PORTFOLIO', label: 'PORTFOLIO', key: 'P' },
    { id: 'RISK', label: 'RISK', key: 'R' },
    { id: 'DRAFT', label: `DRAFT${draftOrders.length > 0 ? ` (${draftOrders.length})` : ''}`, key: 'D' },
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
            <div className="flex justify-between">
              <span className="text-phosphor-dim">TURNOVER</span>
              <span className={portfolio.turnoverUsed > 0.3 ? 'text-alert-amber' : 'text-phosphor'}>
                {(portfolio.turnoverUsed * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* ── Center: decision workspace ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Decision-phase workspace */}
          {(phase === 'SIGNAL' || phase === 'INVESTIGATING') && (
            <>
              {/* Panel tabs */}
              <div className="flex border-b border-phosphor/15 flex-shrink-0">
                {PANEL_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActivePanel(tab.id);
                      if (tab.id === 'PORTFOLIO') tipOnce('portfolio_open', () => triggerEvent('tutorial.portfolio_open'));
                      if (tab.id === 'RISK') tipOnce('risk_view', () => triggerEvent('risk.first_risk_contribution_view'));
                    }}
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
                      <div className="border border-alert-amber/40 bg-alert-amber/5 px-4 py-2.5 text-alert-amber text-xs tracking-widest">
                        ▲ REGIME CHANGE SIGNAL
                      </div>
                    )}

                    {isObservation && (
                      <div className="border border-alert-amber/60 bg-alert-amber/8 px-4 py-3 mt-3 text-alert-amber text-xs leading-relaxed">
                        OBSERVATION MODE: DRAWDOWN EXCEEDS -20%. RUN CONTINUES BUT CANNOT PASS. USE THIS TIME TO STUDY MACHINE DECISIONS.
                      </div>
                    )}
                  </div>
                )}

                {/* PORTFOLIO panel */}
                {activePanel === 'PORTFOLIO' && (
                  <div className="p-5">
                    <div className="text-phosphor-dim text-xs tracking-widest mb-3">YOUR POSITIONS · CLICK TO ORDER</div>

                    {/* Constellation visualization */}
                    {portfolio.positions.length > 0 && (
                      <div className="flex justify-center mb-4 border border-phosphor/10 bg-terminal-deep/40 py-2">
                        <PortfolioConstellation
                          positions={portfolio.positions}
                          correlationIndex={portfolio.correlationIndex}
                          drawdown={portfolio.drawdown}
                          highlightSymbol={selectedSymbol}
                          onSelectSymbol={sym => {
                            setSelectedSymbol(sym);
                            setOrderAction(null);
                            tipOnce('position_selected', () => triggerEvent('tutorial.position_selected'));
                          }}
                          width={340}
                          height={200}
                        />
                      </div>
                    )}

                    <div className="space-y-1.5 mb-4">
                      {portfolio.positions.map(pos => (
                        <button
                          key={pos.symbol}
                          onClick={() => {
                            setSelectedSymbol(pos.symbol);
                            setOrderAction(null);
                            tipOnce('position_selected', () => triggerEvent('tutorial.position_selected'));
                          }}
                          className={`w-full flex items-center justify-between text-xs p-2.5 border transition-all ${
                            selectedSymbol === pos.symbol
                              ? 'border-phosphor bg-phosphor/10 text-phosphor'
                              : 'border-phosphor/15 text-phosphor-mid hover:border-phosphor/35 hover:text-phosphor hover:bg-phosphor/5 cursor-pointer'
                          }`}
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
                            <span className="text-phosphor-dim text-xs">
                              {draftOrders.find(o => o.symbol === pos.symbol)
                                ? `[${draftOrders.find(o => o.symbol === pos.symbol)?.action}]`
                                : ''}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Order ticket */}
                    {selectedSymbol && (
                      <div className="border border-phosphor/30 bg-phosphor/5 p-4 animate-boot-fade">
                        <div className="text-phosphor-dim text-xs tracking-widest mb-3">
                          ORDER TICKET · {selectedSymbol}
                        </div>

                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {(['ADD', 'REDUCE', 'EXIT'] as PositionAction[]).map(ac => (
                            <button
                              key={ac}
                              onClick={() => {
                                setOrderAction(ac);
                                if ((ac === 'EXIT' || ac === 'REDUCE') && portfolio.drawdown < -0.10) {
                                  tipOnce('large_reduction', () => triggerEvent('arena.large_reduction_proposed'));
                                }
                              }}
                              className={`py-2 text-xs tracking-wide border transition-colors ${
                                orderAction === ac
                                  ? 'border-phosphor bg-phosphor/15 text-phosphor'
                                  : 'border-phosphor/20 text-phosphor-dim hover:border-phosphor/40 hover:text-phosphor'
                              }`}
                            >
                              {ac}
                            </button>
                          ))}
                          <button
                            onClick={() => setSelectedSymbol(null)}
                            className="py-2 text-xs tracking-wide border border-phosphor/10 text-phosphor-dim hover:border-phosphor/20 transition-colors"
                          >
                            CANCEL
                          </button>
                        </div>

                        {orderAction && orderAction !== 'EXIT' && (
                          <div className="mb-3">
                            <div className="text-phosphor-dim text-xs mb-2">
                              AMOUNT: <span className="text-phosphor">${orderAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex gap-2">
                              {[1000, 2000, 5000, 10000].map(amt => (
                                <button
                                  key={amt}
                                  onClick={() => setOrderAmount(amt)}
                                  className={`text-xs px-2 py-1 border transition-colors ${
                                    orderAmount === amt
                                      ? 'border-phosphor text-phosphor bg-phosphor/10'
                                      : 'border-phosphor/15 text-phosphor-dim hover:border-phosphor/30'
                                  }`}
                                >
                                  ${(amt / 1000).toFixed(0)}K
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={addToDraft}
                          disabled={!orderAction}
                          className={`w-full py-2 text-xs tracking-widest border transition-colors ${
                            orderAction
                              ? 'border-phosphor text-phosphor hover:bg-phosphor/10'
                              : 'border-phosphor/10 text-phosphor-dim cursor-not-allowed'
                          }`}
                        >
                          ADD TO DRAFT →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* RISK panel */}
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

                    {isObservation && (
                      <div className="border border-risk-red/60 bg-risk-red/5 px-4 py-3 text-risk-red text-xs leading-relaxed">
                        OBSERVATION MODE ACTIVE. DRAWDOWN {Math.abs(portfolio.drawdown * 100).toFixed(1)}% EXCEEDS -20% THRESHOLD. RUN CONTINUES — MACHINE COMPARISON ONLY.
                      </div>
                    )}
                  </div>
                )}

                {/* DRAFT panel */}
                {activePanel === 'DRAFT' && (
                  <div className="p-5">
                    <div className="text-phosphor-dim text-xs tracking-widest mb-3">DECISION DRAFT</div>

                    {draftOrders.length === 0 && !holdConfirmed && (
                      <div className="border border-phosphor/10 p-4 text-center text-phosphor-dim text-xs mb-4">
                        NO ORDERS DRAFTED.
                        <div className="mt-1 text-phosphor-dim/50">GO TO PORTFOLIO → CLICK A POSITION → ORDER</div>
                      </div>
                    )}

                    {draftOrders.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {draftOrders.map(o => (
                          <div key={o.symbol} className="flex items-center justify-between text-xs border border-phosphor/20 p-3">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-phosphor">{o.symbol}</span>
                              <span className={`${o.action === 'ADD' ? 'text-paper-green' : 'text-risk-red'}`}>
                                {o.action}
                              </span>
                              {o.action !== 'EXIT' && (
                                <span className="text-phosphor-dim">${o.amount.toLocaleString()}</span>
                              )}
                            </div>
                            <button
                              onClick={() => removeFromDraft(o.symbol)}
                              className="text-phosphor-dim hover:text-risk-red transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setActivePanel('PORTFOLIO')}
                          className="text-phosphor-dim text-xs hover:text-phosphor transition-colors"
                        >
                          + ADD MORE ORDERS
                        </button>
                      </div>
                    )}

                    {holdConfirmed && (
                      <div className="border border-phosphor/30 bg-phosphor/5 p-3 mb-4 text-xs">
                        <div className="text-phosphor-dim tracking-widest mb-1">HOLD DECISION</div>
                        <div className="text-phosphor">
                          {HOLD_REASONS.find(r => r.code === holdReason)?.label ?? holdReason}
                        </div>
                        <button
                          onClick={() => { setHoldConfirmed(false); setHoldReason(null); }}
                          className="text-phosphor-dim text-xs mt-1 hover:text-phosphor transition-colors"
                        >
                          ← CHANGE
                        </button>
                      </div>
                    )}

                    {!holdConfirmed && (
                      <>
                        <div className="border-t border-phosphor/10 pt-4 mb-3">
                          <div className="text-phosphor-dim text-xs tracking-widest mb-2" ref={el => { if (el && cp.isHoldValid) tipOnce('hold_available', () => triggerEvent('tutorial.hold_available')); }}>OR HOLD — SELECT REASON</div>
                          <div className="space-y-1.5">
                            {HOLD_REASONS.map(r => (
                              <button
                                key={r.code}
                                onClick={() => setHoldReason(r.code)}
                                className={`w-full text-left text-xs py-2 px-3 border transition-colors ${
                                  holdReason === r.code
                                    ? 'border-phosphor bg-phosphor/10 text-phosphor'
                                    : 'border-phosphor/15 text-phosphor-dim hover:border-phosphor/30 hover:text-phosphor-mid'
                                }`}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                          {holdReason && (
                            <button
                              onClick={handleHoldCommit}
                              className="mt-3 w-full py-2 text-xs tracking-widest border border-phosphor/40 text-phosphor hover:bg-phosphor/10 transition-colors"
                            >
                              CONFIRM HOLD →
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {/* Commit confirmation */}
                    {commitConfirm ? (
                      <div className="border border-phosphor/40 bg-phosphor/5 p-4 animate-boot-fade">
                        <div className="text-phosphor-dim text-xs tracking-widest mb-2">CONFIRM COMMIT</div>
                        <div className="text-phosphor text-sm font-bold mb-1">
                          {holdConfirmed ? 'HOLD' : positionActionsToGameAction(draftOrders)}
                        </div>
                        {!holdConfirmed && draftOrders.length > 0 && (
                          <div className="text-phosphor-dim text-xs mb-3">
                            {draftOrders.map(o => `${o.action} ${o.symbol}`).join(' · ')}
                          </div>
                        )}
                        <div className="text-phosphor-dim text-xs mb-4">
                          THIS CANNOT BE UNDONE. THE MARKET WILL RESOLVE.
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
                      hasDraft && !commitConfirm && (
                        <button
                          onClick={handleDraftCommit}
                          className="cmd-button-primary w-full py-3 text-xs tracking-widest"
                        >
                          REVIEW & COMMIT ▶
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Resolve / Compare / Learn ── */}
          {(phase === 'RESOLVING' || phase === 'COMPARING' || phase === 'LEARNING') && lastCheckpointScore && (
            <div className="flex-1 overflow-y-auto p-6">
              {/* Machine pipeline — processing animation */}
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
                    {run.decisions[run.decisions.length - 1]?.actionCode}
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
                {cp.isHoldValid && run.decisions[run.decisions.length - 1]?.actionCode === 'HOLD' && cp.holdTeaching && (
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
              {countdownActive ? (
                <div className="text-center py-4">
                  <div className="text-phosphor-dim text-xs tracking-widest mb-1">NEXT SIGNAL IN</div>
                  <div className="text-phosphor text-5xl font-bold">{countdown}</div>
                </div>
              ) : run.currentCheckpoint >= run.totalCheckpoints ? (
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
              <div className={`text-3xl font-bold mb-2 ${run.playerScore > run.machineScore ? 'text-paper-green' : 'text-risk-red'}`}>
                {run.playerScore > run.machineScore ? 'MACHINE BEATEN' : 'MACHINE WINS'}
              </div>
              <div className="text-phosphor-mid text-sm mb-6">
                {run.playerScore} vs {run.machineScore}
              </div>
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
      {(phase === 'SIGNAL' || phase === 'INVESTIGATING') && (
        <div className="border-t border-phosphor/15 px-4 py-2.5 flex items-center gap-4 bg-terminal-deep/40 flex-shrink-0">
          <button
            onClick={() => { setActivePanel('PORTFOLIO'); }}
            className="text-xs tracking-widest text-phosphor-dim hover:text-phosphor transition-colors border border-phosphor/20 px-3 py-1.5 hover:border-phosphor/40"
          >
            [P] ORDER
          </button>
          <button
            onClick={() => { setActivePanel('DRAFT'); setHoldReason(null); }}
            className="text-xs tracking-widest text-phosphor-dim hover:text-phosphor transition-colors border border-phosphor/20 px-3 py-1.5 hover:border-phosphor/40"
          >
            [H] HOLD
          </button>
          <button
            onClick={() => setActivePanel('RISK')}
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
          {hasDraft && !commitConfirm && (
            <button
              onClick={handleDraftCommit}
              className="text-xs tracking-widest text-phosphor border border-phosphor/60 px-4 py-1.5 hover:bg-phosphor/10 transition-colors"
            >
              REVIEW DRAFT ({draftOrders.length > 0 ? draftOrders.length : 'HOLD'}) →
            </button>
          )}
          {/* 5-question footer */}
          <div className="hidden xl:flex items-center gap-6 text-xs text-phosphor-dim ml-4 pl-4 border-l border-phosphor/10">
            <div>WHAT: <span className="text-phosphor">{cp.crisisDay}</span></div>
            <div>INFO: <span className="text-phosphor">SIGNAL+PORTFOLIO+RISK</span></div>
            <div>DO: <span className="text-phosphor">ORDER·HOLD</span></div>
            <div>VS MCH: <span className={run.playerScore >= run.machineScore ? 'text-paper-green' : 'text-risk-red'}>
              {run.playerScore} · {run.machineScore}
            </span></div>
          </div>
        </div>
      )}
    </div>
  );
}
