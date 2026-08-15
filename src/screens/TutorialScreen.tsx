import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Spotlight } from '../components/onboarding/Spotlight';
import { FiveQuestionSpine } from '../components/onboarding/FiveQuestionSpine';
import type { ActionBranch, ActionCode, ThesisCode } from '../lib/gameTypes';
import {
  stanceTitle, stanceLine, thesisOptionsFor, thesisLabel,
  convictionSpan, convictionGovernor, clampConviction,
  isDetent, isLandmark,
  CONVICTION_DEFAULT, CONVICTION_KEY_STEP, CONVICTION_KEY_STEP_COARSE,
  GOVERNOR_CAPTION, THESIS_TIMEOUT_CODE,
} from '../lib/decisionContract';

interface Props {
  onComplete: () => void;
}

// The tutorial mirrors the live decision surface exactly: read, inspect, then
// one portfolio-level decision. There is no order ticket and no draft panel,
// because the game has neither. The player never trades an individual position.
type Panel = 'SIGNAL' | 'PORTFOLIO' | 'RISK' | 'DECIDE';

type TutorialStep =
  | 'WELCOME'
  | 'READ'
  | 'INSPECT'
  | 'REVIEW_RISK'
  | 'STANCE'
  | 'CONVICTION'
  | 'COMMIT'
  | 'THESIS'
  | 'MACHINE';

interface Step {
  id: TutorialStep;
  title: string;
  instruction: string;
  detail: string;
  action: string;
  keyHint?: string;
  /** Panel auto-opened when this step begins, so the spotlight target is visible. */
  panel: Panel;
  /** CSS selector for the element the spotlight highlights; null = centered callout. */
  spotlight: string | null;
}

const STEPS: Step[] = [
  {
    id: 'WELCOME',
    title: 'WELCOME TO REFI ALPHA',
    instruction: 'You manage a U.S. equity portfolio through crisis.',
    detail: 'You do not trade individual positions. You set a stance for the whole portfolio: one decision per checkpoint. The machine decides too, and you are compared on process. This walkthrough highlights each control as we go.',
    action: 'BEGIN TUTORIAL',
    panel: 'SIGNAL',
    spotlight: null,
  },
  {
    id: 'READ',
    title: 'LESSON 1 · READ THE SIGNAL',
    instruction: 'A market signal tells you what changed. It does not tell you what to do.',
    detail: 'The signal gives you the catalyst and the numbers that moved. Reading it is your information edge. Deciding what it means is your job, and the signal will not do it for you.',
    action: 'I HAVE READ THE SIGNAL',
    keyHint: 'PRESS ENTER WHEN READY',
    panel: 'SIGNAL',
    spotlight: '[data-spotlight="signal"]',
  },
  {
    id: 'INSPECT',
    title: 'LESSON 2 · INSPECT YOUR PORTFOLIO',
    instruction: 'Inspect what you own before deciding.',
    detail: 'Positions are evidence here, not order tickets. You cannot buy or sell a single name. You read weight, sector and profit or loss to understand your exposure, then make one decision for the portfolio.',
    action: 'I CAN SEE MY POSITIONS',
    keyHint: 'POSITIONS ARE READ ONLY',
    panel: 'PORTFOLIO',
    spotlight: '[data-spotlight="portfolio"]',
  },
  {
    id: 'REVIEW_RISK',
    title: 'LESSON 3 · REVIEW YOUR RISK',
    instruction: 'Check drawdown, concentration, cash and turnover.',
    detail: 'Risk can change what good process looks like. Turnover is finite: every trade spends from a fixed budget that does not refill. What the panel shows may change your read, or confirm it.',
    action: 'I HAVE REVIEWED MY RISK',
    keyHint: 'THIS IS YOUR RISK PANEL',
    panel: 'RISK',
    spotlight: '[data-spotlight="risk"]',
  },
  {
    id: 'STANCE',
    title: 'LESSON 4 · CHOOSE YOUR STANCE',
    instruction: 'Choose the portfolio stance that matches your read.',
    detail: 'HOLD is a real, scored decision. Every trade uses finite turnover. Trading more is never rewarded. Pick one stance: this is the whole decision, not a basket of orders.',
    action: 'I HAVE CHOSEN A STANCE',
    keyHint: 'SELECT ONE STANCE',
    panel: 'DECIDE',
    spotlight: '[data-spotlight="stances"]',
  },
  {
    id: 'CONVICTION',
    title: 'LESSON 5 · SET YOUR CONVICTION',
    instruction: 'Set how strongly you believe the call.',
    detail: 'The scale is always 50 to 95. During CP1 to CP4 the value is governed to 60 to 75 while you learn. The scale itself never changes, so the calibration you build here is the calibration you keep.',
    action: 'I UNDERSTAND CONVICTION',
    keyHint: 'ARROWS ADJUST BY 1 · SHIFT OR PAGE KEYS BY 5',
    panel: 'DECIDE',
    spotlight: '[data-spotlight="conviction"]',
  },
  {
    id: 'COMMIT',
    title: 'LESSON 6 · COMMIT YOUR DECISION',
    instruction: 'Review the stance and conviction together.',
    detail: 'Once committed, the decision cannot be changed. The market resolves against the call you locked. Read the confirmation before you commit.',
    action: 'I UNDERSTAND HOW TO COMMIT',
    keyHint: 'ENTER TO COMMIT · ESC TO REVISE',
    panel: 'DECIDE',
    spotlight: '[data-spotlight="commit"]',
  },
  {
    id: 'THESIS',
    title: 'LESSON 7 · STATE YOUR THESIS',
    instruction: 'The decision is already committed. Now answer why.',
    detail: 'Your thesis explains the call; it does not change it. Asking after the commit keeps the record honest: you account for the instinct you already exposed instead of searching for a defensible reason first. Skipping is allowed and is recorded as unstated.',
    action: 'I UNDERSTAND THE THESIS PROMPT',
    keyHint: 'ONE TAP · OR SKIP',
    panel: 'DECIDE',
    spotlight: '[data-spotlight="thesis"]',
  },
  {
    id: 'MACHINE',
    title: 'LESSON 8 · COMPARE TO THE MACHINE',
    instruction: 'The machine reveals its call and reasoning after yours is locked.',
    detail: 'You are scored on process quality, not on matching it. Par is the machine score to beat at that checkpoint. The machine never sees the future. Neither do you.',
    action: 'I UNDERSTAND MACHINE COMPARISON',
    panel: 'DECIDE',
    spotlight: '[data-spotlight="machine"]',
  },
];

const STEP_INDEX = STEPS.reduce<Record<TutorialStep, number>>((acc, s, i) => {
  acc[s.id] = i;
  return acc;
}, {} as Record<TutorialStep, number>);

// Mock portfolio, shown for inspection only. These rows are not interactive:
// there is no per position action anywhere in the game.
const MOCK_POSITIONS = [
  { symbol: 'MSFT', weight: 0.10, sector: 'TECHNOLOGY', pnl: +2.1 },
  { symbol: 'AAPL', weight: 0.10, sector: 'TECHNOLOGY', pnl: +1.4 },
  { symbol: 'JPM',  weight: 0.10, sector: 'FINANCIALS',  pnl: -0.8 },
  { symbol: 'DAL',  weight: 0.08, sector: 'AIRLINES',    pnl: -4.2 },
  { symbol: 'MAR',  weight: 0.08, sector: 'HOTELS',      pnl: -3.1 },
  { symbol: 'XOM',  weight: 0.08, sector: 'ENERGY',      pnl: -1.9 },
  { symbol: 'JNJ',  weight: 0.08, sector: 'HEALTHCARE',  pnl: +0.6 },
  { symbol: 'PG',   weight: 0.08, sector: 'CONS. STAPLES', pnl: +0.9 },
  { symbol: 'CAT',  weight: 0.08, sector: 'INDUSTRIALS', pnl: -2.3 },
  { symbol: 'HD',   weight: 0.07, sector: 'CONS. DISC',  pnl: +0.4 },
];

// A synthetic practice signal. Deliberately NOT one of the 14 COVID
// checkpoints: teaching against real content would hand the player a scored
// checkpoint (and its authored machine decision) before they reach it. The
// conditions here are mixed on purpose, so the lesson is how to decide rather
// than which answer is correct.
const PRACTICE_SIGNAL = {
  banner: 'PRACTICE SIGNAL · NOT SCORED',
  title: 'MIXED CONDITIONS: BREADTH NARROWS WHILE INDEX HOLDS',
  body: 'Index level is roughly unchanged on the week, but fewer names are carrying it. Defensive sectors are firming, cyclicals are softening, and credit conditions are steady. Nothing here confirms a regime change, and nothing rules one out. This scenario is invented for practice and is not part of any arena.',
  signals: [
    { label: 'INDEX', value: '-0.3%', direction: 'down' as const },
    { label: 'BREADTH', value: '41%', direction: 'down' as const },
    { label: 'VOL', value: '17.2', direction: 'up' as const },
    { label: 'CREDIT', value: 'STABLE', direction: 'up' as const },
  ],
};

// Practice stances. Real ActionCode values rendered through the real helpers,
// so the tutorial cannot drift from the live card grammar. The branchEffect
// values are inert and exist only to satisfy ActionBranch: these branches are
// never passed to the run engine, scoring, or any real RunState.
const PRACTICE_STANCES: ActionBranch[] = [
  {
    actionCode: 'HOLD',
    shortLabel: 'HOLD',
    label: 'HOLD: the portfolio is already positioned for what you can actually see',
    turnoverCost: 0,
    branchEffect: { flagsAdd: [], alphaImpact: {} },
  },
  {
    actionCode: 'REDUCE',
    shortLabel: 'REDUCE',
    label: 'REDUCE: trim exposure where the risk has changed, without exiting the thesis',
    turnoverCost: 0.04,
    branchEffect: { flagsAdd: [], alphaImpact: {} },
  },
  {
    actionCode: 'RAISE_CASH',
    shortLabel: 'RAISE CASH',
    label: 'RAISE CASH: move capital out of equities and take on the re-entry decision',
    turnoverCost: 0.06,
    branchEffect: { flagsAdd: [], alphaImpact: {} },
  },
  {
    actionCode: 'ROTATE_DEFENSIVE',
    shortLabel: 'ROTATE DEFENSIVE',
    label: 'ROTATE DEFENSIVE: shift weight from cyclicals into defensives at equal exposure',
    turnoverCost: 0.05,
    branchEffect: { flagsAdd: [], alphaImpact: {} },
  },
];

// The practice machine call. Invented alongside the practice signal, and framed
// as one process among several rather than the correct answer.
const PRACTICE_MACHINE = {
  action: 'ROTATE DEFENSIVE',
  reason: 'Breadth is narrowing while the index holds, so the same exposure is being carried by fewer names. Policy: reduce concentration risk before it is expressed as drawdown, at equal total exposure.',
};

const SPINE_ANSWERS = {
  happening: 'PRACTICE SIGNAL · NOT SCORED',
  info: 'SIGNAL · PORTFOLIO · RISK',
  canDo: 'STANCE · CONVICTION · COMMIT',
  onCommit: 'THESIS → MARKET RESOLVES · MACHINE COMPARES',
  vsMachine: 'SCORE SHOWN AFTER COMMIT',
};

// The tutorial teaches the checkpoint the player meets first, so it shows the
// CP1 governor rather than the open range.
const PRACTICE_CHECKPOINT = 1;

export default function TutorialScreen({ onComplete }: Props) {
  const { earnXp } = useGame();
  const [stepIdx, setStepIdx] = useState(0);
  const [activePanel, setActivePanel] = useState<Panel>('SIGNAL');
  const [stance, setStance] = useState<ActionCode | null>(null);
  const [conviction, setConviction] = useState(CONVICTION_DEFAULT);
  const [committed, setCommitted] = useState(false);
  const [thesis, setThesis] = useState<ThesisCode | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Shown when the player tries to advance past a lesson that still needs a
  // real interaction. The tutorial teaches the decision act, so it never makes
  // any part of that decision on the player's behalf.
  const [gateMessage, setGateMessage] = useState<string | null>(null);

  const step = STEPS[stepIdx];
  const progress = stepIdx / (STEPS.length - 1);

  const span = convictionSpan();
  const governor = convictionGovernor(PRACTICE_CHECKPOINT);
  const governed = governor.max < span.max;
  const selectedBranch = PRACTICE_STANCES.find(b => b.actionCode === stance) ?? null;

  // Reduced-motion preference for the spotlight ring (§62).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Each step auto-opens the panel it teaches, so the spotlight has a target.
  // Nothing here selects, commits, or answers anything: those states are only
  // ever produced by the player operating the real control.
  useEffect(() => {
    const current = STEPS[stepIdx];
    setActivePanel(current.panel);
    setGateMessage(null);

    // Stepping back before the commit unwinds the local practice decision, so
    // the commit lesson is always entered from an uncommitted state. The thesis
    // belongs to that commit and is released with it. A selected stance is kept:
    // it stays the player's choice until they pick a different card.
    if (STEP_INDEX[current.id] < STEP_INDEX.THESIS) {
      setCommitted(false);
      setThesis(null);
    }
  }, [stepIdx]);

  // Conviction is clamped by the same governor the live control uses, so a
  // value learned here cannot be one the real checkpoint would refuse.
  const adjustConviction = (next: number) => {
    setConviction(clampConviction(next, PRACTICE_CHECKPOINT));
  };

  const selectStance = (code: ActionCode) => {
    setStance(code);
    setGateMessage(null);
  };

  // The only path to a committed practice decision. Advancing the walkthrough
  // cannot reach this, which is the point: the commit has to be an act.
  const commitPractice = () => {
    if (!stance) return;
    setCommitted(true);
    setGateMessage(null);
    setStepIdx(s => s + 1);
  };

  const answerThesis = (code: ThesisCode) => {
    setThesis(code);
    setGateMessage(null);
  };

  // What each gated lesson still needs before the walkthrough may move on.
  const blockedReason = (): string | null => {
    switch (step.id) {
      case 'STANCE':
        return stance ? null : 'CHOOSE ONE PORTFOLIO STANCE TO CONTINUE.';
      case 'COMMIT':
        return committed ? null : 'COMMIT THE PRACTICE DECISION TO CONTINUE.';
      case 'THESIS':
        return thesis ? null : 'CHOOSE A THESIS OR SKIP TO CONTINUE.';
      default:
        return null;
    }
  };

  const advance = () => {
    const blocked = blockedReason();
    if (blocked) {
      // Hold position and say why. Never select, commit, answer, or touch
      // conviction on the player's behalf.
      setGateMessage(blocked);
      return;
    }
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(s => s + 1);
    } else {
      earnXp(50);
      onComplete();
    }
  };

  const nextLabel = () => {
    if (stepIdx === STEPS.length - 1) return 'ENTER THE ARENA ▶';
    if (step.id === 'STANCE') return stance ? 'STANCE SET →' : 'CHOOSE A STANCE TO CONTINUE';
    if (step.id === 'COMMIT') return committed ? 'COMMITTED →' : 'COMMIT THE PRACTICE DECISION';
    if (step.id === 'THESIS') return thesis ? 'THESIS RECORDED →' : 'CHOOSE A THESIS OR SKIP';
    return `${step.action} →`;
  };

  return (
    <div className="min-h-screen bg-terminal-black font-mono flex flex-col">

      {/* Top bar */}
      <div className="border-b border-phosphor/15 bg-terminal-black px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-phosphor-dim text-xs tracking-widest flex-shrink-0">TUTORIAL</span>
          <span className="text-phosphor-dim text-xs flex-shrink-0">·</span>
          <span className="text-phosphor text-xs tracking-widest truncate">{step.title}</span>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-phosphor-dim text-xs">STEP {stepIdx + 1} / {STEPS.length}</div>
          <button
            onClick={() => { earnXp(0); onComplete(); }}
            className="text-phosphor-dim text-xs hover:text-phosphor transition-colors tracking-widest"
          >
            SKIP TUTORIAL →
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-phosphor/10">
        <div className="h-full bg-phosphor transition-all duration-500" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Full-width mock terminal (the spotlight directs attention; no side rail) */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Panel tabs: the same four the live loop uses */}
        <div className="flex border-b border-phosphor/15">
          {(['SIGNAL', 'PORTFOLIO', 'RISK', 'DECIDE'] as const).map(p => (
            <button
              key={p}
              onClick={() => setActivePanel(p)}
              className={`px-4 py-2 text-xs tracking-widest border-r border-phosphor/10 transition-colors ${
                activePanel === p ? 'text-phosphor bg-phosphor/8' : 'text-phosphor-dim hover:text-phosphor-mid'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-3xl mx-auto">

            {activePanel === 'SIGNAL' && (
              <div data-spotlight="signal">
                <div className="inline-block border border-alert-amber/40 text-alert-amber text-xs tracking-widest px-2 py-0.5 mb-3">
                  {PRACTICE_SIGNAL.banner}
                </div>
                <div className="text-phosphor text-lg font-bold mb-3 leading-snug">{PRACTICE_SIGNAL.title}</div>
                <div className="text-phosphor-mid text-xs leading-relaxed mb-5">{PRACTICE_SIGNAL.body}</div>
                <div className="grid grid-cols-4 gap-3">
                  {PRACTICE_SIGNAL.signals.map(sig => (
                    <div key={sig.label} className="border border-phosphor/15 p-3 text-center">
                      <div className="text-phosphor-dim text-xs mb-1">{sig.label}</div>
                      <div className={`text-sm font-bold ${sig.direction === 'down' ? 'text-risk-red' : 'text-paper-green'}`}>
                        {sig.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePanel === 'PORTFOLIO' && (
              <div data-spotlight="portfolio">
                <div className="flex justify-between text-xs text-phosphor-dim mb-3 tracking-widest">
                  <span>POSITION</span>
                  <span>WEIGHT · PNL</span>
                </div>
                <div className="space-y-1.5">
                  {MOCK_POSITIONS.map(pos => (
                    <div
                      key={pos.symbol}
                      className="w-full flex items-center justify-between text-xs p-2.5 border border-phosphor/10 text-phosphor-mid"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-phosphor w-10">{pos.symbol}</span>
                        <span className="text-phosphor-dim">{pos.sector}</span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span>{Math.round(pos.weight * 100)}%</span>
                        <span className={pos.pnl >= 0 ? 'text-paper-green' : 'text-risk-red'}>
                          {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-phosphor-dim text-xs leading-snug mt-4 border-l border-phosphor/20 pl-3">
                  These rows are evidence, not controls. You decide for the whole portfolio at once.
                </div>
              </div>
            )}

            {activePanel === 'RISK' && (
              <div data-spotlight="risk" className="space-y-4">
                <div className="terminal-panel p-4">
                  <div className="text-phosphor-dim text-xs tracking-widest mb-3">RISK METRICS</div>
                  <div className="space-y-3">
                    {[
                      { label: 'DRAWDOWN', value: '-2.3%' },
                      { label: 'VOLATILITY', value: '16.0%' },
                      { label: 'TURNOVER USED', value: '4%' },
                      { label: 'TURNOVER REMAINING', value: '26%' },
                      { label: 'CASH WEIGHT', value: '15%' },
                    ].map(m => (
                      <div key={m.label} className="flex justify-between text-xs">
                        <span className="text-phosphor-dim">{m.label}</span>
                        <span className="text-phosphor">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="terminal-panel p-4">
                  <div className="text-phosphor-dim text-xs tracking-widest mb-3">CONCENTRATION</div>
                  <div className="space-y-2 text-xs">
                    {[
                      { sector: 'TECHNOLOGY', pct: 20, limit: 30 },
                      { sector: 'AIRLINES', pct: 8, limit: 10 },
                      { sector: 'HOTELS', pct: 8, limit: 10 },
                    ].map(s => (
                      <div key={s.sector}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-phosphor-dim">{s.sector}</span>
                          <span className="text-phosphor">{s.pct}% / {s.limit}%</span>
                        </div>
                        <div className="h-1 bg-phosphor/10">
                          <div className="h-full bg-phosphor/40" style={{ width: `${(s.pct / s.limit) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-phosphor-dim text-xs leading-snug border-l border-phosphor/20 pl-3">
                  Turnover is finite and does not refill. Spending it is part of the decision.
                </div>
              </div>
            )}

            {activePanel === 'DECIDE' && (
              <div className="space-y-6">

                {/* ── 1. Stance ── */}
                <div data-spotlight="stances">
                  <div className="text-phosphor-dim text-xs tracking-widest mb-2">1 · STANCE</div>
                  {gateMessage && step.id === 'STANCE' && (
                    <div
                      role="alert"
                      className="border border-alert-amber/50 text-alert-amber text-xs tracking-widest p-2.5 mb-2"
                    >
                      {gateMessage}
                    </div>
                  )}
                  <div className="space-y-2">
                    {PRACTICE_STANCES.map((branch, i) => {
                      const selected = stance === branch.actionCode;
                      const cost = branch.turnoverCost;
                      return (
                        <button
                          key={branch.actionCode}
                          onClick={() => !committed && selectStance(branch.actionCode)}
                          disabled={committed}
                          aria-pressed={selected}
                          className={`w-full text-left p-3 border transition-colors ${
                            selected
                              ? 'border-phosphor bg-phosphor/10'
                              : committed
                                ? 'border-phosphor/10 opacity-40 cursor-not-allowed'
                                : 'border-phosphor/20 hover:border-phosphor/45 hover:bg-phosphor/5'
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
                            <span className="text-xs tabular-nums text-phosphor-dim">
                              {cost === 0 ? 'FREE' : `${(cost * 100).toFixed(0)}% TURNOVER`}
                            </span>
                          </div>
                          <div className="text-phosphor-dim text-xs leading-snug mt-1 pl-7">
                            {stanceLine(branch)}
                          </div>
                          {branch.actionCode === 'HOLD' && (
                            <div className="text-phosphor-dim text-xs leading-snug mt-1 pl-7">
                              A real, scored decision. Costs zero turnover. A good HOLD beats an unnecessary trade.
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── 2. Conviction ── */}
                {/* The control spans 50 to 95 at every checkpoint. During CP1 to
                    CP4 a governor caps the committed value at 75; the span
                    itself never moves, so the scale learned here is the scale
                    the player keeps. */}
                <div
                  data-spotlight="conviction"
                  className={stance && !committed ? '' : 'opacity-40 pointer-events-none'}
                >
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
                        aria-label="CONVICTION"
                        aria-valuemin={governor.min}
                        aria-valuemax={governor.max}
                        aria-valuenow={conviction}
                        className="w-full accent-phosphor relative z-10"
                      />
                      {/* Detent ticks. Landmarks at 70, 85 and 95 are heavier. */}
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

                  <div className="text-phosphor-dim text-xs tracking-widest mt-1">
                    {governed ? GOVERNOR_CAPTION : 'ARROWS ADJUST BY 1 · SHIFT OR PAGE KEYS BY 5'}
                  </div>
                </div>

                {/* ── Commit ── */}
                {!committed && (
                  <div data-spotlight="commit">
                    <div className="border border-phosphor/40 bg-phosphor/5 p-4">
                      <div className="text-phosphor-dim text-xs tracking-widest mb-2">CONFIRM DECISION</div>
                      {gateMessage && step.id === 'COMMIT' && (
                        <div
                          role="alert"
                          className="border border-alert-amber/50 text-alert-amber text-xs tracking-widest p-2.5 mb-3"
                        >
                          {gateMessage}
                        </div>
                      )}
                      <div className="text-phosphor text-sm font-bold mb-1">
                        {selectedBranch ? stanceTitle(selectedBranch) : 'SELECT A STANCE'}
                      </div>
                      <div className="text-phosphor-mid text-xs mb-1">
                        CONVICTION {conviction}
                      </div>
                      <div className="text-phosphor-dim text-xs mb-4">
                        TURNOVER COST {selectedBranch ? (selectedBranch.turnoverCost * 100).toFixed(0) : 0}%. THIS CANNOT BE UNDONE. THE MARKET WILL RESOLVE.
                      </div>
                      <button
                        onClick={commitPractice}
                        disabled={!stance}
                        className={`w-full py-2.5 text-xs tracking-widest border transition-colors ${
                          stance
                            ? 'border-phosphor text-phosphor hover:bg-phosphor/15'
                            : 'border-phosphor/10 text-phosphor-dim cursor-not-allowed'
                        }`}
                      >
                        {stance ? 'COMMIT ▶ (TUTORIAL ONLY)' : 'SELECT A STANCE TO CONTINUE'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Thesis: after the commit, before the reveal ── */}
                {committed && selectedBranch && (
                  <div data-spotlight="thesis" className="border border-phosphor/25 p-4">
                    <div className="text-phosphor text-xs tracking-widest mb-1">
                      {stanceTitle(selectedBranch)} · CONVICTION {conviction}
                    </div>
                    <div className="text-phosphor-dim text-xs tracking-widest mb-4">
                      COMMITTED. THIS CANNOT BE CHANGED.
                    </div>

                    <div className="text-phosphor text-xl font-bold tracking-widest mb-4">WHY?</div>

                    {gateMessage && step.id === 'THESIS' && (
                      <div
                        role="alert"
                        className="border border-alert-amber/50 text-alert-amber text-xs tracking-widest p-2.5 mb-3"
                      >
                        {gateMessage}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {thesisOptionsFor(selectedBranch).map((t, i) => (
                        <button
                          key={t.code}
                          onClick={() => answerThesis(t.code)}
                          className={`px-4 py-2.5 text-xs tracking-widest border transition-colors ${
                            thesis === t.code
                              ? 'border-phosphor bg-phosphor/10 text-phosphor'
                              : 'border-phosphor/30 text-phosphor-mid hover:border-phosphor hover:text-phosphor hover:bg-phosphor/10'
                          }`}
                        >
                          <span className="text-phosphor-dim/60 mr-2">[{i + 1}]</span>
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* An explicit choice not to state a thesis. In the live
                        game THESIS_UNSTATED means a decision was committed
                        without an articulated reason, so it has to come from
                        this control, never from walking the tutorial forward. */}
                    <button
                      onClick={() => answerThesis(THESIS_TIMEOUT_CODE)}
                      className="mt-4 text-phosphor-dim text-xs tracking-widest hover:text-phosphor-mid transition-colors"
                    >
                      SKIP →
                    </button>

                    {thesis && (
                      <div className="text-phosphor-dim text-xs mt-4 border-t border-phosphor/15 pt-3">
                        RECORDED: <span className="text-phosphor">{thesisLabel(thesis)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Machine comparison (shown in MACHINE step) */}
        {step.id === 'MACHINE' && (
          <div data-spotlight="machine" className="border-t border-phosphor/15 p-4 bg-phosphor/3">
            <div className="max-w-3xl mx-auto">
              <div className="text-phosphor-dim text-xs tracking-widest mb-2">
                MACHINE DECISION · PRACTICE · NOT SCORED
              </div>
              <div className="flex gap-6 text-xs mb-2">
                <div><span className="text-phosphor-dim">STANCE: </span><span className="text-phosphor font-bold">{PRACTICE_MACHINE.action}</span></div>
                <div><span className="text-phosphor-dim">YOUR CALL: </span><span className="text-phosphor">{selectedBranch ? stanceTitle(selectedBranch) : 'NONE'}</span></div>
              </div>
              <div className="text-phosphor-dim text-xs leading-snug border-l border-phosphor/20 pl-2 mb-2">
                {PRACTICE_MACHINE.reason}
              </div>
              <div className="text-phosphor-dim text-xs leading-snug">
                Matching the machine is not the goal and is not the score. In a real checkpoint you are measured against par on process quality.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* §56 five-question spine: always answers "why am I here / what do I do" */}
      <FiveQuestionSpine answers={SPINE_ANSWERS} />

      {/* Spotlight overlay: dims everything but the element this step teaches. */}
      <Spotlight
        targetSelector={step.spotlight}
        watch={[stepIdx, activePanel, stance, conviction, committed, thesis, gateMessage]}
        title={step.instruction}
        body={step.detail}
        hint={step.keyHint}
        step={{ current: stepIdx + 1, total: STEPS.length }}
        nextLabel={nextLabel()}
        onNext={advance}
        onBack={stepIdx > 0 ? () => setStepIdx(s => Math.max(0, s - 1)) : undefined}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
