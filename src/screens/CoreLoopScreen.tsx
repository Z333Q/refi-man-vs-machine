import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useTips } from '../context/TipContext';
import type { ActionBranch, ThesisCode } from '../lib/gameTypes';
import { getQualityColor } from '../lib/scoringEngine';
import { deriveVerdict, verdictStamp } from '../lib/verdict';
import {
  canAffordAction, isHoldOnly, turnoverCostFor, observationModeReason, resolveRunResult,
  STARTING_CAPITAL, actionReturnMultiplier, runRiskAdjusted, type DecisionCommand,
} from '../lib/runEngine';
import {
  thesisLabel, thesisOptionsFor, stanceTitle,
  convictionSpan, convictionGovernor, isGovernorActive, clampConviction,
  convictionToConfidence, confidenceToConviction, isDetent, isLandmark, CONVICTION_DEFAULT,
  CONVICTION_KEY_STEP, CONVICTION_KEY_STEP_COARSE,
  GOVERNOR_CAPTION, PANEL_MODULE, THESIS_TIMEOUT_MS, THESIS_TIMEOUT_CODE,
} from '../lib/decisionContract';
import { classifyDevice, type DeviceClass, type RegionBounds } from '../lib/gestureGeometry';
import PullToCommit from '../components/game/PullToCommit';
import PortfolioConstellation from '../components/game/PortfolioConstellation';
import MachineReveal from '../components/game/MachineReveal';
import ResolutionRace from '../components/game/ResolutionRace';
import MachineEvolution from '../components/game/MachineEvolution';
import { useVisualEvents, visualRegistry } from '../components/game/VisualEventLayer';
import { Spotlight } from '../components/onboarding/Spotlight';
import { FiveQuestionSpine } from '../components/onboarding/FiveQuestionSpine';
import { ArcRail } from '../components/onboarding/ArcRail';

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

/** Sharpe needs two resolved checkpoints before it means anything. */
function fmtSharpe(v: number | null): string {
  return v === null ? '--' : v.toFixed(2);
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
    investigateModule,
    setPendingAction,
    attachThesis,
    setPendingConfidence,
    commitDecision,
    advanceCheckpoint,
    completeRun,
    clearModuleUnlock,
    currentCheckpointData,
  } = useGame();

  const { run, lastCheckpointScore, lastCheckpointFlags, moduleJustUnlocked, xpJustEarned } = state;
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
  // The post-commit thesis prompt. Shown between the release and the reveal so
  // the player explains an instinct already exposed (Addendum B B2, C C.5).
  const [thesisPrompt, setThesisPrompt] = useState(false);
  // Whole seconds left before the prompt auto-skips, so the window is visible
  // on the surface rather than expiring under the player's hand.
  const [thesisSecondsLeft, setThesisSecondsLeft] = useState(
    Math.ceil(THESIS_TIMEOUT_MS / 1000),
  );
  // The sub-metrics and the authored teaching note live one tap deeper, so the
  // result reads as one verdict rather than a verdict arguing with a lecture.
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ─── Gesture geometry ───────────────────────────────────────────────────────
  // The device class is decided once per run from the usable decision region,
  // never from raw viewport dimensions (Addendum C C.3). Browser chrome, safe
  // areas and embedded webviews all distort the viewport, and a class that
  // moved mid-run would silently recalibrate the hand. Resize and orientation
  // still cancel an active gesture through the state machine; they do not
  // reclassify the geometry.
  const convictionInputRef = useRef<HTMLInputElement | null>(null);
  const [regionBounds, setRegionBounds] = useState<RegionBounds | null>(null);
  const [deviceClass, setDeviceClass] = useState<DeviceClass>('STANDARD');

  /**
   * Measure the decision region the moment it first exists, and freeze the
   * classification for the rest of the run.
   *
   * This is a callback ref rather than an effect on purpose. The stance region
   * lives inside the DECIDE panel, which is gated on both `activePanel` and
   * `decisionPhase`; an effect would have to name every piece of state that can
   * mount it, and the day one of them is missed the region stays unmeasured and
   * every pull silently falls back to the precise controls forever. React calls
   * this when the node attaches, whatever caused the mount.
   *
   * It measures once. Later attachments (panel reopened, next checkpoint) find
   * bounds already set and leave the class alone, so the geometry cannot shift
   * under a hand that has already calibrated to it.
   */
  const measureDecisionRegion = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setRegionBounds(prev => {
      if (prev) return prev;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return prev;
      setDeviceClass(classifyDevice({ width: rect.width, height: rect.height }));
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    });
  }, []);

  // ─── First-run coaching (P0 IA: a guided, spotlit first checkpoint) ───────────
  const [reducedMotion, setReducedMotion] = useState(false);
  const [coachStep, setCoachStep] = useState(0);
  const [coachDone, setCoachDone] = useState(() => {
    try { return localStorage.getItem('refi_cp1_coached') === '1'; } catch { return true; }
  });
  const COACH_STEPS = [
    {
      sel: '[data-spotlight="cp-signal"]',
      title: 'READ WHAT CHANGED',
      body: 'This is the market signal at this moment in history. It tells you what changed: it does not tell you what to do. That call is yours.',
      hint: 'THE SIGNAL IS YOUR INFORMATION EDGE',
    },
    {
      sel: '[data-spotlight="cp-actions"]',
      title: 'CHOOSE YOUR STANCE',
      body: 'Choose the stance that matches your read. HOLD is a real, scored decision. Set how strongly you believe it. Trading more is never rewarded.',
      hint: 'STANCE · CONVICTION · COMMIT',
    },
  ];
  const finishCoach = () => {
    setCoachDone(true);
    try { localStorage.setItem('refi_cp1_coached', '1'); } catch { /* best-effort */ }
  };

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Keep the signal panel visible while the first coaching step points at it.
  useEffect(() => {
    const active = !coachDone && run?.currentCheckpoint === 1 &&
      (run?.phase === 'SIGNAL' || run?.phase === 'INVESTIGATING');
    if (active && coachStep === 0) setActivePanel('SIGNAL');
  }, [coachDone, coachStep, run?.currentCheckpoint, run?.phase]);

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

  // Amendment 1 compensating control: the governor is gone, so the calibration
  // lesson has to arrive as consequence instead. Fires once, at the second
  // checkpoint, where the player has already committed once and the number
  // starts to mean something.
  useEffect(() => {
    if (run?.currentCheckpoint === 2 && run.phase === 'SIGNAL') {
      tipOnce('conviction_consequence', () => triggerEvent('decision.conviction_available'));
    }
  }, [run?.currentCheckpoint, run?.phase, tipOnce, triggerEvent]);

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
    setThesisPrompt(false);
    setActivePanel('SIGNAL');
  }, [run?.currentCheckpoint]);

  // The thesis prompt never blocks the reveal. On timeout the decision records
  // THESIS_UNSTATED, which is a real behavioral signal rather than a gap.
  //
  // The countdown is ticked in whole seconds and rendered, because an unstated
  // thesis has to be a choice the player declined to make. A prompt that
  // vanished mid-read records a behaviour the player never had, and that lands
  // in the Alpha Profile as fact.
  useEffect(() => {
    if (!thesisPrompt) {
      setThesisSecondsLeft(Math.ceil(THESIS_TIMEOUT_MS / 1000));
      return;
    }
    const deadline = Date.now() + THESIS_TIMEOUT_MS;
    const tick = setInterval(() => {
      setThesisSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    const t = setTimeout(() => {
      attachThesis(THESIS_TIMEOUT_CODE);
      setThesisPrompt(false);
    }, THESIS_TIMEOUT_MS);
    return () => { clearInterval(tick); clearTimeout(t); };
  }, [thesisPrompt, attachThesis]);

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
    tipOnce('stance_selected', () => triggerEvent('tutorial.stance_selected'));
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

  /**
   * The precise fallback, and the destination of anything that is not a clean
   * pull: keyboard activation, a timid dead-zone release, and a grip without
   * the clearance to reach full draw all land here.
   *
   * An unaffordable stance is never selected by this path. The card can explain
   * why it is priced out, but it must not become the pending decision through a
   * callback shared with the affordable cards.
   */
  const openFocusedControls = useCallback((branch: ActionBranch) => {
    if (!run) return;
    if (!canAffordAction(run, branch.actionCode, currentCheckpointData)) return;
    selectStance(branch);
    setActivePanel('DECIDE');
    // An actual focus move, not just a state change: the fallback has to leave
    // the caret on the control the player now needs.
    window.requestAnimationFrame(() => {
      const input = convictionInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }, [run, currentCheckpointData, selectStance, reducedMotion]);

  const handleReview = useCallback(() => {
    if (!run?.pendingAction) return;
    setCommitConfirm(true);
    setActivePanel('DECIDE');
    tipOnce('review_ready', () => triggerEvent('tutorial.review_ready'));
  }, [run?.pendingAction, tipOnce, triggerEvent]);

  // The post-commit UI sequence, shared by both doors so the screen cannot end
  // up in a different state depending on how the decision was made.
  const afterCommit = useCallback(() => {
    setCommitConfirm(false);
    setThesisPrompt(true);
  }, []);

  /**
   * The one place this screen commits. Both doors call it with a complete
   * command; nothing here reads pending state, so a commit can never pick up a
   * half-applied stance or a stale conviction.
   */
  const submitDecision = useCallback((command: DecisionCommand) => {
    commitDecision(command);
    afterCommit();
  }, [commitDecision, afterCommit]);

  // The precise door: whatever the slider and keyboard have built becomes the
  // command. Same boundary as the gesture, same engine call.
  const handleFinalCommit = useCallback(() => {
    if (!run?.pendingAction) return;
    submitDecision({
      action: run.pendingAction,
      conviction: confidenceToConviction(run.pendingConfidence),
    });
  }, [run?.pendingAction, run?.pendingConfidence, submitDecision]);

  const pickThesis = useCallback((code: ThesisCode) => {
    attachThesis(code);
    setThesisPrompt(false);
  }, [attachThesis]);

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

      // Conviction, once a stance is chosen. Integer resolution would make a
      // plain arrow traverse 45 keystrokes wide, so the keyboard gets the same
      // three speeds the hand gets from detents: fine, detent, and end stop.
      if (run.pendingAction) {
        const current = confidenceToConviction(run.pendingConfidence);
        const bounds = convictionGovernor(run.currentCheckpoint);
        const coarse = e.shiftKey;
        const step = coarse ? CONVICTION_KEY_STEP_COARSE : CONVICTION_KEY_STEP;

        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          adjustConviction(current + step);
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          adjustConviction(current - step);
        }
        if (e.key === 'PageUp') {
          e.preventDefault();
          adjustConviction(current + CONVICTION_KEY_STEP_COARSE);
        }
        if (e.key === 'PageDown') {
          e.preventDefault();
          adjustConviction(current - CONVICTION_KEY_STEP_COARSE);
        }
        if (e.key === 'Home') { e.preventDefault(); adjustConviction(bounds.min); }
        if (e.key === 'End') { e.preventDefault(); adjustConviction(bounds.max); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    decisionPhase, run, branches, currentCheckpointData, commitConfirm,
    handleFinalCommit, handleReview, openPanel, selectStance, adjustConviction,
  ]);

  // Thesis prompt keyboard: same 1..n grammar as the stance cards.
  useEffect(() => {
    if (!thesisPrompt || !run) return;
    const decision = run.decisions[run.decisions.length - 1];
    const branch = decision
      ? (currentCheckpointData?.availableActions ?? []).find(b => b.actionCode === decision.actionCode)
      : undefined;
    if (!branch) return;
    const options = thesisOptionsFor(branch);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { pickThesis(THESIS_TIMEOUT_CODE); return; }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) pickThesis(options[n - 1].code);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [thesisPrompt, run, currentCheckpointData, pickThesis]);

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
  const conviction = confidenceToConviction(run.pendingConfidence);
  // The control always spans the permanent range; the governor caps the value.
  const span = convictionSpan();
  const governor = convictionGovernor(run.currentCheckpoint);
  const governed = isGovernorActive(run.currentCheckpoint);
  const decisionReady = Boolean(stance);
  const selectedBranch = branches.find(b => b.actionCode === stance) ?? null;

  // The conviction committed at the previous checkpoint, drawn as a faint
  // marker on the pull meter so the hand has a reference to move against.
  // One verdict per checkpoint, derived from the score the player is looking at.
  const verdict = lastCheckpointScore
    ? deriveVerdict(lastCheckpointScore, lastCheckpointFlags)
    : null;

  // A stable seed for the resolution race. §54 authors a per-run `seed` on
  // arena_runs; RunState does not carry one yet, so the race is seeded from the
  // arena identity instead. Presentation only: it never reaches scoring, and
  // the curves are pinned to authored endpoints regardless.
  // Not memoised: this sits after the run guard, where a hook would be
  // conditional, and an FNV hash of a short string is cheaper than the memo.
  const raceSeed = (() => {
    let h = 2166136261;
    for (const ch of run.arenaId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  })();

  const previousDecision = run.decisions[run.decisions.length - 1];
  const previousConviction = previousDecision
    ? confidenceToConviction(previousDecision.confidence ?? 0)
    : null;

  // TODO(addendum-c): the player-facing mute/settings surface is not built yet,
  // so the tick channel is left audible and only reduced motion is honoured.
  // Tracked as outstanding Addendum C work; see the PR report.
  const audioMuted = false;

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

  // Endpoints for the race, derived from the same multiplier the engine
  // applied, so the curve cannot finish where the score disagrees.
  const racePlayerReturn = lastDecision
    ? cp.portfolioEffect.returnBias * actionReturnMultiplier(lastDecision.actionCode)
    : 0;
  const raceMachineReturn =
    cp.portfolioEffect.returnBias * actionReturnMultiplier(cp.machineDecision.actionCode);

  // The branch that was actually committed, for the post-commit thesis prompt.
  const selectedCommittedBranch = lastDecision
    ? branches.find(b => b.actionCode === lastDecision.actionCode) ?? null
    : null;
  const earnedProcessCredit = Boolean(lastDecision?.behavioralFlags.includes('GOOD_PROCESS')) && cp.isRegimeChange;

  // Risk-adjusted standing, reconstructed from the decision record each render.
  const riskAdjusted = runRiskAdjusted(run);

  const PANEL_TABS: { id: ActivePanel; label: string; key: string }[] = [
    { id: 'SIGNAL', label: 'SIGNAL', key: 'S' },
    { id: 'PORTFOLIO', label: 'PORTFOLIO', key: 'P' },
    { id: 'RISK', label: 'RISK', key: 'R' },
    { id: 'DECIDE', label: decisionReady ? 'DECIDE ✓' : 'DECIDE', key: 'D' },
  ];

  return (
    <div className="min-h-screen bg-terminal-black terminal-screen flex flex-col font-mono">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 border-b border-phosphor/15 bg-terminal-deep/60 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={onBack}
            className="text-phosphor-dim text-xs hover:text-phosphor transition-colors tracking-widest"
          >
            ← ABORT
          </button>
          <div className="hidden sm:block h-4 w-px bg-phosphor/20" />
          <span className="hidden sm:inline text-phosphor-dim text-xs tracking-widest whitespace-nowrap">
            COVID BLACK SWAN
          </span>
          <div className="h-4 w-px bg-phosphor/20" />
          <span className="text-phosphor text-xs tracking-widest whitespace-nowrap tabular-nums">
            CP {String(run.currentCheckpoint).padStart(2, '0')} / {String(run.totalCheckpoints).padStart(2, '0')}
          </span>
          <div className="hidden lg:flex items-center gap-4">
            <div className="h-4 w-px bg-phosphor/20" />
            <ArcRail current="PLAY" />
          </div>
          {isObservation && (
            <span className="text-alert-amber text-xs tracking-widest animate-pulse border border-alert-amber/40 px-2 py-0.5">
              OBSERVATION MODE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap tabular-nums">
            <span className={`text-xs font-bold ${run.playerScore >= run.machineScore ? 'text-paper-green' : 'text-risk-red'}`}>
              YOU {run.playerScore}
            </span>
            <span className="hidden sm:inline text-phosphor-dim text-xs">·</span>
            <span className="text-phosphor-mid text-xs">MCH {run.machineScore}</span>
          </div>
          {/* Return and risk-adjusted return, side by side. The game's whole
              argument is that the second one is the real scoreboard, so it is
              never further away than the first. */}
          <div className="flex items-center gap-2" title="RETURN VS RISK TAKEN TO GET IT">
            <span className={`text-xs font-bold tabular-nums ${portfolioGain >= 0 ? 'text-paper-green' : 'text-risk-red'}`}>
              {portfolioGain >= 0 ? '+' : ''}{portfolioGain.toFixed(2)}%
            </span>
            <span className="text-phosphor-dim text-xs">·</span>
            <span className="text-phosphor-dim text-xs tracking-widest">SHARPE</span>
            <span className={`text-xs font-bold tabular-nums ${
              riskAdjusted.playerSharpe === null ? 'text-phosphor-dim'
                : riskAdjusted.machineSharpe !== null && riskAdjusted.playerSharpe >= riskAdjusted.machineSharpe
                  ? 'text-paper-green' : 'text-risk-red'
            }`}>
              {fmtSharpe(riskAdjusted.playerSharpe)}
            </span>
            <span className="text-phosphor-mid text-xs tabular-nums">
              / MCH {fmtSharpe(riskAdjusted.machineSharpe)}
            </span>
          </div>
          {onHelp && (
            <button
              onClick={onHelp}
              className="text-phosphor-dim text-xs hover:text-phosphor transition-colors whitespace-nowrap pl-1"
            >
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

        {/* ── Left: signal sidebar ──
             Desktop only. Below lg the rails would consume 464px of a 390px
             viewport without shrinking, collapsing the centre pane (which holds
             every interactive control) to nothing behind an overflow-hidden
             parent. The signal headline and body are step 1 of the checkpoint
             loop, so they are re-rendered above the tabs on small screens
             rather than dropped. */}
        <div className="hidden lg:flex w-64 flex-shrink-0 border-r border-phosphor/10 flex-col">
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
              {/* The READ step, for viewports with no left rail.
                  Headline only, and suppressed on the SIGNAL tab, which renders
                  the same headline and body directly below it. Carrying both
                  filled the entire first screen of a phone with one paragraph
                  printed twice. This is a persistent orientation strip for the
                  other three tabs, not a second copy of the signal. */}
              {activePanel !== 'SIGNAL' && (
                <div className="lg:hidden px-4 py-2 border-b border-phosphor/10 bg-terminal-deep/40 flex-shrink-0">
                  <div className="text-phosphor-dim text-xs tracking-widest">
                    {cp.phase.replace(/_/g, ' ')} · {cp.crisisDay}
                  </div>
                  <div className="text-phosphor text-xs font-bold leading-tight mt-0.5">{cp.signalTitle}</div>
                </div>
              )}

              {/* Panel tabs. Scrollable rather than wrapping: four tabs at a
                  legible tap size exceed a narrow viewport, and a wrapped row
                  would push the decision surface below the fold. */}
              <div className="flex border-b border-phosphor/15 flex-shrink-0 overflow-x-auto scrollbar-hide">
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
                  <div className="p-5" data-spotlight="cp-signal">
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
                    {/* The head-to-head the run is actually scored on. Return
                        alone flatters whoever took the most risk, so it is
                        never shown here without the Sharpe beside it. */}
                    <div className="terminal-panel p-4">
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-phosphor-dim text-xs tracking-widest">RISK-ADJUSTED · YOU VS MACHINE</span>
                        <span className="text-phosphor-dim/70 text-xs tracking-widest">
                          {riskAdjusted.samples} CHECKPOINT{riskAdjusted.samples === 1 ? '' : 'S'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div />
                        <div className="text-phosphor-dim tracking-widest text-right">YOU</div>
                        <div className="text-phosphor-dim tracking-widest text-right">MACHINE</div>

                        <div className="text-phosphor-dim">RETURN</div>
                        <div className="text-phosphor font-bold tabular-nums text-right">
                          {(riskAdjusted.playerReturn * 100).toFixed(2)}%
                        </div>
                        <div className="text-phosphor-mid font-bold tabular-nums text-right">
                          {(riskAdjusted.machineReturn * 100).toFixed(2)}%
                        </div>

                        <div className="text-phosphor-dim">SHARPE</div>
                        <div className="text-phosphor font-bold tabular-nums text-right">
                          {fmtSharpe(riskAdjusted.playerSharpe)}
                        </div>
                        <div className="text-phosphor-mid font-bold tabular-nums text-right">
                          {fmtSharpe(riskAdjusted.machineSharpe)}
                        </div>
                      </div>
                      <div className="text-phosphor-dim/70 text-xs leading-snug mt-3 border-t border-phosphor/10 pt-2">
                        SHARPE IS RETURN PER UNIT OF RISK TAKEN. PER-CHECKPOINT,
                        RISK-FREE RATE 0, NOT ANNUALISED. THIS IS A RUN
                        STATISTIC, NOT A REFI BENCHMARK FIGURE.
                      </div>
                    </div>

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
                    <div className="space-y-2 mb-6" ref={measureDecisionRegion}>
                      {branches.map((branch, i) => {
                        const affordable = canAffordAction(run, branch.actionCode, cp);
                        const selected = stance === branch.actionCode;
                        const cost = turnoverCostFor(branch.actionCode, cp);
                        return (
                          <PullToCommit
                            key={branch.actionCode}
                            branch={branch}
                            index={i}
                            affordable={affordable}
                            turnoverCost={cost}
                            checkpointSequence={run.currentCheckpoint}
                            selected={selected}
                            reducedMotion={reducedMotion}
                            muted={audioMuted}
                            deviceClass={deviceClass}
                            regionBounds={regionBounds}
                            previousConviction={previousConviction}
                            onCommit={conviction => submitDecision({ action: branch.actionCode, conviction })}
                            onOpenFocusedControls={() => openFocusedControls(branch)}
                          />
                        );
                      })}
                    </div>

                    {/* ── 2. Conviction ── */}
                    {/* The control spans 50 to 95 at every checkpoint. During
                        CP1 to CP4 a governor caps the value at 75; the span
                        itself never moves, so the scale the player learns here
                        is the scale they keep. */}
                    <div className={stance ? '' : 'opacity-40 pointer-events-none'}>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-phosphor-dim text-xs tracking-widest">2 · CONVICTION</span>
                        <span className="text-phosphor text-lg font-bold tabular-nums">{conviction}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => adjustConviction(conviction - CONVICTION_KEY_STEP_COARSE)}
                          aria-label="LOWER CONVICTION BY FIVE"
                          className="w-8 h-8 border border-phosphor/25 text-phosphor-dim hover:text-phosphor hover:border-phosphor/50 transition-colors"
                        >
                          −
                        </button>

                        <div className="flex-1 relative">
                          <input
                            type="range"
                            min={span.min}
                            max={span.max}
                            step={CONVICTION_KEY_STEP}
                            value={conviction}
                            onChange={e => adjustConviction(Number(e.target.value))}
                            ref={convictionInputRef}
                            aria-label="CONVICTION"
                            aria-valuemin={governor.min}
                            aria-valuemax={governor.max}
                            aria-valuenow={conviction}
                            className="w-full accent-phosphor relative z-10"
                          />
                          {/* Detent ticks. Landmarks at 70, 85 and 95 are heavier:
                              the same three the hand learns from the pull. */}
                          <div className="flex justify-between px-0.5 mt-0.5" aria-hidden="true">
                            {Array.from(
                              { length: (span.max - span.min) / CONVICTION_KEY_STEP_COARSE + 1 },
                              (_, i) => span.min + i * CONVICTION_KEY_STEP_COARSE,
                            ).map(v => (
                              <span
                                key={v}
                                className={`w-px ${
                                  isLandmark(v) ? 'h-2 bg-phosphor/70'
                                    : isDetent(v) ? 'h-1 bg-phosphor/25'
                                    : 'h-1 bg-transparent'
                                } ${governed && v > governor.max ? 'opacity-25' : ''}`}
                              />
                            ))}
                          </div>
                          {/* The governor: a visible limiter over the part of the
                              span this checkpoint cannot reach. */}
                          {governed && (
                            <div
                              className="absolute top-0 h-1.5 bg-risk-red/20 border-l border-risk-red/50 pointer-events-none"
                              style={{
                                left: `${((governor.max - span.min) / (span.max - span.min)) * 100}%`,
                                right: 0,
                              }}
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <button
                          onClick={() => adjustConviction(conviction + CONVICTION_KEY_STEP_COARSE)}
                          aria-label="RAISE CONVICTION BY FIVE"
                          className="w-8 h-8 border border-phosphor/25 text-phosphor-dim hover:text-phosphor hover:border-phosphor/50 transition-colors"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex justify-between text-phosphor-dim text-xs mt-1">
                        <span>{span.min}</span>
                        <span>{span.max}</span>
                      </div>

                      <div className="text-phosphor-dim text-xs tracking-widest mt-1 mb-1">
                        {governed ? GOVERNOR_CAPTION : 'ARROWS ADJUST BY 1 · SHIFT OR PAGE KEYS BY 5'}
                      </div>
                      <div className="mb-6" />
                    </div>

                    {/* ── Commit ── */}
                    {commitConfirm ? (
                      <div className="border border-phosphor/40 bg-phosphor/5 p-4 animate-boot-fade">
                        <div className="text-phosphor-dim text-xs tracking-widest mb-2">CONFIRM DECISION</div>
                        <div className="text-phosphor text-sm font-bold mb-1">
                          {selectedBranch ? stanceTitle(selectedBranch) : stance}
                        </div>
                        <div className="text-phosphor-mid text-xs mb-1">
                          CONVICTION {conviction}
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
                        {stance ? 'REVIEW & COMMIT ▶ [ENTER]' : 'SELECT A STANCE TO CONTINUE'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Thesis quick-pick: after the commit, before the reveal ── */}
          {thesisPrompt && lastDecision && selectedCommittedBranch && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 animate-boot-fade">
              <div className="text-phosphor text-xs tracking-widest mb-1">
                {stanceTitle(selectedCommittedBranch)} · CONVICTION {confidenceToConviction(lastDecision.confidence ?? 0)}
              </div>
              <div className="text-phosphor-dim text-xs tracking-widest mb-5">
                COMMITTED. THIS CANNOT BE CHANGED.
              </div>

              <div className="text-phosphor text-2xl font-bold tracking-widest mb-5">WHY?</div>

              <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                {thesisOptionsFor(selectedCommittedBranch).map((t, i) => (
                  <button
                    key={t.code}
                    onClick={() => pickThesis(t.code)}
                    className="px-4 py-2.5 text-xs tracking-widest border border-phosphor/30 text-phosphor-mid hover:border-phosphor hover:text-phosphor hover:bg-phosphor/10 transition-colors"
                  >
                    <span className="text-phosphor-dim/60 mr-2">[{i + 1}]</span>
                    {t.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => pickThesis(THESIS_TIMEOUT_CODE)}
                className="mt-5 text-phosphor-dim text-xs tracking-widest hover:text-phosphor-mid transition-colors"
              >
                SKIP →
              </button>

              {/* The auto-skip is disclosed, never sprung. Text carries the
                  state as well as the bar, so the meter is not the only
                  channel (§62). */}
              <div className="mt-4 w-56" aria-live="polite">
                <div className="text-phosphor-dim/70 text-xs tracking-widest text-center mb-1.5">
                  RECORDS AS THESIS UNSTATED IN {thesisSecondsLeft}s
                </div>
                <div
                  className="h-0.5 bg-phosphor/10"
                  role="meter"
                  aria-label="TIME LEFT TO STATE A THESIS"
                  aria-valuenow={thesisSecondsLeft}
                  aria-valuemin={0}
                  aria-valuemax={Math.ceil(THESIS_TIMEOUT_MS / 1000)}
                >
                  <div
                    className="h-full bg-phosphor/40 transition-[width] duration-300 ease-linear"
                    style={{
                      width: `${(thesisSecondsLeft / Math.ceil(THESIS_TIMEOUT_MS / 1000)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Resolve / Compare / Learn ── */}
          {!thesisPrompt && (phase === 'RESOLVING' || phase === 'COMPARING' || phase === 'LEARNING') && lastCheckpointScore && verdict && (
            <div className="flex-1 overflow-y-auto p-6">
              {/* The race. Five beats: lock, resolve, flip, score, verdict.
                  Replaces the instant text result: the payoff of a trading
                  game is watching the market answer the call you locked. */}
              {phase === 'RESOLVING' && revealDelay === 0 ? (
                <div className="mb-5">
                  <ResolutionRace
                    playerReturn={racePlayerReturn}
                    machineReturn={raceMachineReturn}
                    volatilityDelta={cp.portfolioEffect.volatilityDelta}
                    correlationLevel={cp.portfolioEffect.correlationLevel}
                    seed={raceSeed}
                    checkpointSequence={run.currentCheckpoint}
                    playerAction={lastDecision?.actionCode ?? ''}
                    machineAction={cp.machineDecision.actionCode}
                    machineReason={cp.machineDecision.policyReason}
                    wire={(cp.eventFeed ?? []).map(e => e.text)}
                    conviction={
                      lastDecision?.confidence !== undefined
                        ? confidenceToConviction(lastDecision.confidence)
                        : CONVICTION_DEFAULT
                    }
                    score={lastCheckpointScore}
                    verdict={verdict}
                    par={cp.machinePar}
                    reducedMotion={reducedMotion}
                    onComplete={() => setRevealDelay(1)}
                  />
                </div>
              ) : (
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
              )}

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

                {/* The verdict. One headline, and a nudge only where the
                    result went the player's way. The sign of what is said
                    always matches the sign of the score. */}
                <div
                  className={`text-sm font-bold tracking-wide mb-1 ${
                    verdict.sign === 'UNDER_PAR' ? 'text-risk-red'
                      : verdict.sign === 'AT_PAR' ? 'text-phosphor-mid'
                      : 'text-paper-green'
                  }`}
                >
                  {verdictStamp(verdict.sign, verdict.margin)}
                </div>
                <div className="text-phosphor-mid text-xs leading-relaxed">
                  {verdict.headline}
                </div>
                {verdict.nudge && (
                  <div className="text-phosphor-dim text-xs leading-relaxed mt-2 border-l border-phosphor/20 pl-2">
                    {verdict.nudge}
                  </div>
                )}

                {earnedProcessCredit && (
                  <div className="text-paper-green text-xs tracking-wide mt-2">
                    PROCESS: CONSULTED RISK BEFORE A REGIME CALL. +
                  </div>
                )}

                <button
                  onClick={() => setShowBreakdown(v => !v)}
                  aria-expanded={showBreakdown}
                  className="mt-3 text-phosphor-dim text-xs tracking-widest hover:text-phosphor transition-colors"
                >
                  {showBreakdown ? 'HIDE BREAKDOWN' : 'HOW THIS WAS SCORED'}
                </button>

                {showBreakdown && (
                  <div className="mt-3 border-t border-phosphor/15 pt-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-3">
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
                    <div className="text-phosphor-dim text-xs tracking-widest mb-1">PROCESS NOTE</div>
                    <div className="text-phosphor-mid text-xs leading-relaxed">{cp.teachingPoint}</div>
                    {cp.isHoldValid && lastDecision?.actionCode === 'HOLD' && cp.holdTeaching && (
                      <div className="mt-2 text-paper-green text-xs">✓ {cp.holdTeaching}</div>
                    )}
                  </div>
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
        {/* ── Right: ambient context ──
             Desktop only, and it stays that way. Rank, decision log and machine
             evolution are context, not inputs to this checkpoint, and Addendum
             B holds the pre-commit surface at two elements. Small screens reach
             all of it through the hub rather than carrying it beside the
             decision. */}
        <div className="hidden lg:flex w-52 flex-shrink-0 border-l border-phosphor/10 flex-col">
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
        <div data-spotlight="cp-actions" className="border-t border-phosphor/15 px-4 py-2.5 flex items-center gap-4 bg-terminal-deep/40 flex-shrink-0">
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
        </div>
      )}

      {/* §56 five-question spine — always answers "what do I do / why am I here" */}
      <FiveQuestionSpine
        answers={{
          happening: `${cp.crisisDay} · ${cp.phase.replace(/_/g, ' ')}`,
          info: 'SIGNAL · PORTFOLIO · RISK',
          canDo: 'STANCE · CONVICTION · COMMIT',
          onCommit: 'THESIS → MARKET RESOLVES · MACHINE COMPARES',
          vsMachine: `YOU ${run.playerScore} · MCH ${run.machineScore}`,
        }}
      />

      {/* First-run guided spotlight on Checkpoint 1 — points at the signal,
          then the moves, so the player is never dropped in without direction. */}
      {(() => {
        const coachActive = !coachDone && run.currentCheckpoint === 1 &&
          (run.phase === 'SIGNAL' || run.phase === 'INVESTIGATING');
        if (!coachActive) return null;
        const cs = COACH_STEPS[coachStep];
        return (
          <Spotlight
            targetSelector={cs.sel}
            watch={[coachStep, activePanel]}
            title={cs.title}
            body={cs.body}
            hint={cs.hint}
            step={{ current: coachStep + 1, total: COACH_STEPS.length }}
            nextLabel={coachStep === COACH_STEPS.length - 1 ? 'GOT IT: LET ME PLAY ▶' : 'NEXT →'}
            onNext={() => { if (coachStep < COACH_STEPS.length - 1) setCoachStep(s => s + 1); else finishCoach(); }}
            onBack={coachStep > 0 ? () => setCoachStep(s => Math.max(0, s - 1)) : undefined}
            onSkip={finishCoach}
            reducedMotion={reducedMotion}
          />
        );
      })()}
    </div>
  );
}
