import ActionZone from '../components/ui/ActionZone';
import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Spotlight } from '../components/onboarding/Spotlight';
import { FiveQuestionSpine } from '../components/onboarding/FiveQuestionSpine';

interface Props {
  onComplete: () => void;
}

type Panel = 'SIGNAL' | 'PORTFOLIO' | 'RISK' | 'DRAFT';

type TutorialStep =
  | 'WELCOME'
  | 'READ'
  | 'INSPECT'
  | 'REDUCE'
  | 'BUY'
  | 'REVIEW_RISK'
  | 'COMMIT'
  | 'MACHINE'
  | 'HOLD';

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
    detail: 'Each checkpoint shows a real market signal. You decide how to respond; the machine responds too. First, learn the controls — this walkthrough highlights each one as we go.',
    action: 'BEGIN TUTORIAL',
    panel: 'SIGNAL',
    spotlight: null,
  },
  {
    id: 'READ',
    title: 'LESSON 1 · READ THE SIGNAL',
    instruction: 'A market signal arrives. Read it before acting.',
    detail: 'The signal tells you what changed — the date, the catalyst, the key numbers. It does not tell you what to do. This is your information advantage.',
    action: 'I HAVE READ THE SIGNAL',
    keyHint: 'PRESS ENTER WHEN READY',
    panel: 'SIGNAL',
    spotlight: '[data-spotlight="signal"]',
  },
  {
    id: 'INSPECT',
    title: 'LESSON 2 · INSPECT YOUR PORTFOLIO',
    instruction: 'See what you own before you trade.',
    detail: 'You hold 10 U.S. stocks. Each has a weight, a profit/loss, and a sector. Know your exposures before the market moves against them.',
    action: 'I CAN SEE MY POSITIONS',
    keyHint: 'THESE ARE YOUR POSITIONS',
    panel: 'PORTFOLIO',
    spotlight: '[data-spotlight="portfolio"]',
  },
  {
    id: 'REDUCE',
    title: 'LESSON 3 · REDUCE A POSITION',
    instruction: 'Click DAL, choose REDUCE, then ADD TO DRAFT.',
    detail: 'REDUCE sells part of a position — not all of it. You are not panicking; you are managing size when the risk has changed.',
    action: 'I HAVE DRAFTED A REDUCE ORDER',
    keyHint: 'CLICK DAL → REDUCE → ADD TO DRAFT',
    panel: 'PORTFOLIO',
    spotlight: '[data-spotlight="portfolio"]',
  },
  {
    id: 'BUY',
    title: 'LESSON 4 · ADD TO A POSITION',
    instruction: 'Click a position, choose ADD, then ADD TO DRAFT.',
    detail: 'ADD increases a position you already hold. When conviction is high and the price is right, you size up — not just hold.',
    action: 'I HAVE DRAFTED AN ADD ORDER',
    keyHint: 'CLICK A POSITION → ADD → ADD TO DRAFT',
    panel: 'PORTFOLIO',
    spotlight: '[data-spotlight="portfolio"]',
  },
  {
    id: 'REVIEW_RISK',
    title: 'LESSON 5 · REVIEW YOUR RISK',
    instruction: 'Check risk before committing anything.',
    detail: 'Sector concentration, drawdown, and turnover live here. Never commit without checking your limits — the machine always checks risk first.',
    action: 'I HAVE REVIEWED MY RISK',
    keyHint: 'THIS IS YOUR RISK PANEL',
    panel: 'RISK',
    spotlight: '[data-spotlight="risk"]',
  },
  {
    id: 'COMMIT',
    title: 'LESSON 6 · COMMIT YOUR DECISION',
    instruction: 'Your draft holds every pending order.',
    detail: 'Once you commit, the checkpoint resolves and the market moves. A commit cannot be undone — read the draft carefully first.',
    action: 'I UNDERSTAND HOW TO COMMIT',
    keyHint: 'ENTER TO COMMIT · ESC TO CANCEL',
    panel: 'DRAFT',
    spotlight: '[data-spotlight="draft"]',
  },
  {
    id: 'MACHINE',
    title: 'LESSON 7 · COMPARE TO THE MACHINE',
    instruction: 'After you commit, the machine reveals its move.',
    detail: 'It discloses its action and reasoning — the audit. Your score comes from process quality, not from matching the machine. The machine never sees the future; neither do you.',
    action: 'I UNDERSTAND MACHINE COMPARISON',
    panel: 'DRAFT',
    spotlight: '[data-spotlight="machine"]',
  },
  {
    id: 'HOLD',
    title: 'LESSON 8 · HOLD IS A DECISION',
    instruction: 'Sometimes the right answer is to do nothing.',
    detail: 'HOLD is not inaction — it is a scored decision that your thesis is unchanged. Pick a reason. A good HOLD beats a bad trade, and trading more is never rewarded.',
    action: 'I UNDERSTAND HOW TO HOLD',
    keyHint: 'SELECT A HOLD REASON',
    panel: 'DRAFT',
    spotlight: '[data-spotlight="hold"]',
  },
];

// Mock portfolio for the tutorial display
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

const HOLD_REASONS = [
  'THESIS UNCHANGED',
  'INSUFFICIENT INFORMATION',
  'AWAIT CONFIRMATION',
  'VALUATION SUPPORT',
  'POLICY FLOOR',
];

const MOCK_SIGNAL = {
  title: 'WHO DECLARES PUBLIC HEALTH EMERGENCY OF INTERNATIONAL CONCERN',
  date: 'JAN 30, 2020',
  body: 'The World Health Organization has declared the Wuhan coronavirus outbreak a Public Health Emergency of International Concern — the highest alert level. International travel restrictions are beginning. Airlines and hotels are pricing in a demand shock.',
  signals: [
    { label: 'VIX', value: '18.8', direction: 'up' as const },
    { label: 'S&P 500', value: '-1.8%', direction: 'down' as const },
    { label: 'DAL', value: '-6.4%', direction: 'down' as const },
    { label: 'MAR', value: '-5.1%', direction: 'down' as const },
  ],
};

const SPINE_ANSWERS = {
  happening: 'WHO PHEIC · JAN 30, 2020',
  info: 'TRAVEL DEMAND SIGNALS · PORTFOLIO',
  canDo: 'REDUCE · ADD · EXIT · HOLD',
  onCommit: 'MARKET RESOLVES · MACHINE COMPARES',
  vsMachine: 'SCORE SHOWN AFTER COMMIT',
};

export default function TutorialScreen({ onComplete }: Props) {
  const { earnXp } = useGame();
  const [stepIdx, setStepIdx] = useState(0);
  const [activePanel, setActivePanel] = useState<Panel>('SIGNAL');
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [orderAction, setOrderAction] = useState<'ADD' | 'REDUCE' | 'EXIT' | null>(null);
  const [draftOrders, setDraftOrders] = useState<{ symbol: string; action: string; amount: number }[]>([]);
  const [holdReason, setHoldReason] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const step = STEPS[stepIdx];
  const progress = stepIdx / (STEPS.length - 1);

  // Reduced-motion preference for the spotlight ring (§62).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Each step auto-opens the panel it teaches, so the spotlight has a target.
  useEffect(() => {
    setActivePanel(STEPS[stepIdx].panel);
  }, [stepIdx]);

  const advance = () => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(s => s + 1);
    } else {
      earnXp(50);
      onComplete();
    }
  };

  const addToDraft = () => {
    if (!selectedPosition || !orderAction) return;
    setDraftOrders(d => [...d, { symbol: selectedPosition, action: orderAction, amount: 2000 }]);
    setSelectedPosition(null);
    setOrderAction(null);
  };

  return (
    <div className="screen-fit bg-terminal-black font-mono flex flex-col">

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

        {/* Panel tabs */}
        <div className="flex border-b border-phosphor/15">
          {(['SIGNAL', 'PORTFOLIO', 'RISK', 'DRAFT'] as const).map(p => (
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
                <div className="text-phosphor-dim text-xs tracking-widest mb-1">{MOCK_SIGNAL.date}</div>
                <div className="text-phosphor text-lg font-bold mb-3 leading-snug">{MOCK_SIGNAL.title}</div>
                <div className="text-phosphor-mid text-xs leading-relaxed mb-5">{MOCK_SIGNAL.body}</div>
                <div className="grid grid-cols-4 gap-3">
                  {MOCK_SIGNAL.signals.map(sig => (
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
                    <button
                      key={pos.symbol}
                      onClick={() => {
                        if (step.id === 'REDUCE' || step.id === 'BUY') setSelectedPosition(pos.symbol);
                      }}
                      className={`w-full flex items-center justify-between text-xs p-2.5 border transition-all ${
                        selectedPosition === pos.symbol
                          ? 'border-phosphor bg-phosphor/10 text-phosphor'
                          : (step.id === 'REDUCE' || step.id === 'BUY')
                          ? 'border-phosphor/20 hover:border-phosphor/40 text-phosphor-mid cursor-pointer'
                          : 'border-phosphor/10 text-phosphor-mid cursor-default'
                      }`}
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
                    </button>
                  ))}
                </div>

                {/* Order ticket */}
                {selectedPosition && (
                  <div className="mt-4 border border-phosphor/30 bg-phosphor/5 p-4">
                    <div className="text-phosphor-dim text-xs tracking-widest mb-3">ORDER TICKET · {selectedPosition}</div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {(['ADD', 'REDUCE', 'EXIT'] as const).map(ac => (
                        <button
                          key={ac}
                          onClick={() => setOrderAction(ac)}
                          className={`py-2 text-xs tracking-wide border transition-colors ${
                            orderAction === ac
                              ? 'border-phosphor bg-phosphor/15 text-phosphor'
                              : 'border-phosphor/20 text-phosphor-dim hover:border-phosphor/40 hover:text-phosphor'
                          }`}
                        >
                          {ac}
                        </button>
                      ))}
                    </div>
                    {orderAction && (
                      <div className="text-phosphor-dim text-xs mb-3">
                        AMOUNT: <span className="text-phosphor">$2,000</span>
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
                      ADD TO DRAFT
                    </button>
                  </div>
                )}
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
                  <div className="text-phosphor-dim text-xs tracking-widest mb-3">SECTOR LIMITS</div>
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
              </div>
            )}

            {activePanel === 'DRAFT' && (
              <div data-spotlight="draft">
                <div className="text-phosphor-dim text-xs tracking-widest mb-3">DECISION DRAFT</div>
                {draftOrders.length === 0 ? (
                  <div className="text-phosphor-dim text-xs border border-phosphor/10 p-4 text-center">
                    NO ORDERS DRAFTED YET.
                    <br />
                    <span className="text-phosphor-dim/60">GO TO PORTFOLIO AND BUILD YOUR DRAFT.</span>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {draftOrders.map((o, i) => (
                      <div key={i} className="flex justify-between text-xs border border-phosphor/20 p-3">
                        <div>
                          <span className="text-phosphor font-bold">{o.symbol}</span>
                          <span className="text-phosphor-dim ml-2">{o.action}</span>
                        </div>
                        <span className="text-phosphor">${o.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hold decision */}
                <div data-spotlight="hold" className="mt-4 border-t border-phosphor/15 pt-4">
                  <div className="text-phosphor-dim text-xs tracking-widest mb-3">OR HOLD — SELECT REASON</div>
                  <div className="space-y-1.5">
                    {HOLD_REASONS.map(r => (
                      <button
                        key={r}
                        onClick={() => setHoldReason(r)}
                        className={`w-full text-left text-xs py-2 px-3 border transition-colors ${
                          holdReason === r
                            ? 'border-phosphor bg-phosphor/10 text-phosphor'
                            : 'border-phosphor/15 text-phosphor-dim hover:border-phosphor/30 hover:text-phosphor-mid'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* The tutorial teaches the control before it is used (§11): the
            commit action sits in the same territory it will occupy in a real
            run, disabled until there is something to commit. */}
        <ActionZone
          variant="inline"
          note="TUTORIAL · NO CAPITAL AT RISK"
          primary={{
            label: 'COMMIT DECISION',
            onClick: advance,
            disabled: draftOrders.length === 0 && !holdReason,
            disabledHint: 'DRAFT AN ORDER OR SELECT A HOLD REASON',
            keyHint: '[ENTER]',
            bindEnter: false, // the spotlight coach owns ENTER during the tutorial
          }}
        />

        {/* Machine comparison (shown in MACHINE step) */}
        {step.id === 'MACHINE' && (
          <div data-spotlight="machine" className="border-t border-phosphor/15 p-4 bg-phosphor/3">
            <div className="max-w-3xl mx-auto">
              <div className="text-phosphor-dim text-xs tracking-widest mb-2">MACHINE DECISION · REFI RULES</div>
              <div className="flex gap-6 text-xs mb-2">
                <div><span className="text-phosphor-dim">ACTION: </span><span className="text-phosphor font-bold">REDUCE</span></div>
                <div><span className="text-phosphor-dim">TARGET: </span><span className="text-phosphor">DAL, MAR</span></div>
              </div>
              <div className="text-phosphor-dim text-xs leading-snug border-l border-phosphor/20 pl-2">
                "Revenue impact is confirmed for travel sector. WHO emergency = confirmed demand destruction.
                Policy: reduce any position with confirmed revenue impairment &gt;3% at WHO alert level."
              </div>
            </div>
          </div>
        )}
      </div>

      {/* §56 five-question spine — always answers "why am I here / what do I do" */}
      <FiveQuestionSpine answers={SPINE_ANSWERS} />

      {/* Spotlight overlay: dims everything but the element this step teaches. */}
      <Spotlight
        targetSelector={step.spotlight}
        watch={[stepIdx, activePanel, selectedPosition, draftOrders.length]}
        title={step.instruction}
        body={step.detail}
        hint={step.keyHint}
        step={{ current: stepIdx + 1, total: STEPS.length }}
        nextLabel={stepIdx === STEPS.length - 1 ? 'ENTER THE ARENA ▶' : `${step.action} →`}
        onNext={advance}
        onBack={stepIdx > 0 ? () => setStepIdx(s => Math.max(0, s - 1)) : undefined}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
