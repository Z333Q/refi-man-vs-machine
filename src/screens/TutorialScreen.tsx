import { useState } from 'react';
import { useGame } from '../context/GameContext';

interface Props {
  onComplete: () => void;
}

type TutorialStep =
  | 'WELCOME'
  | 'READ'
  | 'INSPECT'
  | 'REDUCE'
  | 'BUY'
  | 'REVIEW_RISK'
  | 'COMMIT'
  | 'MACHINE'
  | 'HOLD'
  | 'COMPLETE';

interface Step {
  id: TutorialStep;
  title: string;
  instruction: string;
  detail: string;
  action: string;
  highlight?: string;
  keyHint?: string;
}

const STEPS: Step[] = [
  {
    id: 'WELCOME',
    title: 'WELCOME TO REFI ALPHA',
    instruction: 'You manage a U.S. equity portfolio through crisis.',
    detail: 'Each checkpoint presents a real market signal. You decide how to respond. The machine responds too. One of you is right.',
    action: 'BEGIN TUTORIAL',
  },
  {
    id: 'READ',
    title: 'LESSON 1 · READ THE SIGNAL',
    instruction: 'A market signal arrives. Read it carefully before acting.',
    detail: 'The signal panel on the left tells you what is happening in the market. Take 30 seconds to read it. The date, the catalyst, the key numbers. This is your information advantage.',
    action: 'I HAVE READ THE SIGNAL',
    highlight: 'SIGNAL PANEL',
    keyHint: 'PRESS ENTER WHEN READY',
  },
  {
    id: 'INSPECT',
    title: 'LESSON 2 · INSPECT YOUR PORTFOLIO',
    instruction: 'Open the portfolio panel to see your current positions.',
    detail: 'Press P or click PORTFOLIO. You hold 10 U.S. stocks. Each has a weight, a P&L, and a risk contribution. Know what you own before you trade.',
    action: 'I CAN SEE MY POSITIONS',
    highlight: 'PORTFOLIO PANEL [P]',
    keyHint: 'PRESS P OR CLICK PORTFOLIO',
  },
  {
    id: 'REDUCE',
    title: 'LESSON 3 · REDUCE A POSITION',
    instruction: 'Click a position to open the order ticket. Reduce DAL by $2,000.',
    detail: 'REDUCE means you sell part of a position — not all of it. You are not panicking. You are managing size when the risk has changed. Click DAL → select REDUCE → enter $2,000 → ADD TO DRAFT.',
    action: 'I HAVE DRAFTED A REDUCE ORDER',
    highlight: 'ORDER TICKET',
    keyHint: 'CLICK ANY POSITION TO OPEN ORDER TICKET',
  },
  {
    id: 'BUY',
    title: 'LESSON 4 · BUY A POSITION',
    instruction: 'Open the order ticket and ADD to an existing position.',
    detail: 'ADD means you increase a position you already hold. When your conviction is high and the price is right, you size up — not just hold. Click any position → select ADD → enter an amount → ADD TO DRAFT.',
    action: 'I HAVE DRAFTED AN ADD ORDER',
    highlight: 'ORDER TICKET',
    keyHint: 'CLICK A POSITION → SELECT ADD',
  },
  {
    id: 'REVIEW_RISK',
    title: 'LESSON 5 · REVIEW YOUR RISK',
    instruction: 'Open the risk panel before committing any decision.',
    detail: 'Press R or click RISK. You will see sector concentration, portfolio drawdown, and turnover used. Never commit a decision without checking if you are breaching your limits. The machine always checks risk first.',
    action: 'I HAVE REVIEWED MY RISK',
    highlight: 'RISK PANEL [R]',
    keyHint: 'PRESS R OR CLICK RISK',
  },
  {
    id: 'COMMIT',
    title: 'LESSON 6 · COMMIT YOUR DECISION',
    instruction: 'Review your draft, then press COMMIT.',
    detail: 'Your decision draft shows all pending orders. Once you commit, the checkpoint resolves and the market moves. You cannot undo a commit. Read the draft carefully, then press COMMIT or ENTER.',
    action: 'I UNDERSTAND HOW TO COMMIT',
    highlight: 'DECISION DRAFT',
    keyHint: 'ENTER TO COMMIT · ESC TO CANCEL',
  },
  {
    id: 'MACHINE',
    title: 'LESSON 7 · COMPARE TO THE MACHINE',
    instruction: 'After committing, you see what the machine did.',
    detail: 'The machine discloses its action and its reasoning. This is the audit. You can agree with it, disagree with it, or learn from it. The score is calculated from process quality — not whether you matched the machine.',
    action: 'I UNDERSTAND MACHINE COMPARISON',
    highlight: 'MACHINE DECISION',
  },
  {
    id: 'HOLD',
    title: 'LESSON 8 · HOLD IS A DECISION',
    instruction: 'Sometimes the right answer is to do nothing.',
    detail: 'HOLD is not inaction. It is a decision that your thesis is unchanged and the signal does not warrant a trade. You must select a reason: THESIS UNCHANGED, INSUFFICIENT INFORMATION, AWAIT CONFIRMATION, VALUATION SUPPORT, or POLICY FLOOR. HOLD earns full process credit when it is correct.',
    action: 'I UNDERSTAND HOW TO HOLD',
    highlight: 'HOLD DECISION',
    keyHint: 'PRESS H OR CLICK HOLD',
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

export default function TutorialScreen({ onComplete }: Props) {
  const { earnXp } = useGame();
  const [stepIdx, setStepIdx] = useState(0);
  const [activePanel, setActivePanel] = useState<'SIGNAL' | 'PORTFOLIO' | 'RISK' | 'DRAFT'>('SIGNAL');
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [orderAction, setOrderAction] = useState<'ADD' | 'REDUCE' | 'EXIT' | null>(null);
  const [draftOrders, setDraftOrders] = useState<{ symbol: string; action: string; amount: number }[]>([]);
  const [holdReason, setHoldReason] = useState<string | null>(null);

  const step = STEPS[stepIdx];
  const progress = stepIdx / (STEPS.length - 1);

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

  const isCompleteStep = step.id === 'COMPLETE';

  return (
    <div className="min-h-screen bg-terminal-black font-mono flex flex-col">

      {/* Top bar */}
      <div className="border-b border-phosphor/15 bg-terminal-black px-6 py-3 flex items-center justify-between">
        <div>
          <span className="text-phosphor-dim text-xs tracking-widest">TUTORIAL</span>
          <span className="text-phosphor-dim text-xs ml-3">·</span>
          <span className="text-phosphor text-xs ml-3 tracking-widest">{step.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-phosphor-dim text-xs">
            STEP {stepIdx + 1} / {STEPS.length}
          </div>
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
        <div
          className="h-full bg-phosphor transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left: mock terminal */}
        <div className="flex-1 border-r border-phosphor/15 flex flex-col">

          {/* Panel tabs */}
          <div className="flex border-b border-phosphor/15">
            {(['SIGNAL', 'PORTFOLIO', 'RISK', 'DRAFT'] as const).map(p => (
              <button
                key={p}
                onClick={() => setActivePanel(p)}
                className={`px-4 py-2 text-xs tracking-widest border-r border-phosphor/10 transition-colors ${
                  activePanel === p
                    ? 'text-phosphor bg-phosphor/8'
                    : 'text-phosphor-dim hover:text-phosphor-mid'
                } ${
                  (step.highlight === 'PORTFOLIO PANEL [P]' && p === 'PORTFOLIO') ||
                  (step.highlight === 'RISK PANEL [R]' && p === 'RISK') ||
                  (step.highlight === 'DECISION DRAFT' && p === 'DRAFT') ||
                  (step.highlight === 'SIGNAL PANEL' && p === 'SIGNAL')
                    ? 'border border-phosphor/40 bg-phosphor/5'
                    : ''
                }`}
              >
                {p}
                {step.highlight?.includes(p) && (
                  <span className="ml-1 text-alert-amber text-xs">←</span>
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-5">

            {activePanel === 'SIGNAL' && (
              <div>
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
              <div>
                <div className="flex justify-between text-xs text-phosphor-dim mb-3 tracking-widest">
                  <span>POSITION</span>
                  <span>WEIGHT · PNL</span>
                </div>
                <div className="space-y-1.5">
                  {MOCK_POSITIONS.map(pos => (
                    <button
                      key={pos.symbol}
                      onClick={() => {
                        if (step.id === 'REDUCE' || step.id === 'BUY') {
                          setSelectedPosition(pos.symbol);
                        }
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
                    <div className="text-phosphor-dim text-xs tracking-widest mb-3">
                      ORDER TICKET · {selectedPosition}
                    </div>
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
              <div className="space-y-4">
                <div className="terminal-panel p-4">
                  <div className="text-phosphor-dim text-xs tracking-widest mb-3">RISK METRICS</div>
                  <div className="space-y-3">
                    {[
                      { label: 'DRAWDOWN', value: '-2.3%', warn: false },
                      { label: 'VOLATILITY', value: '16.0%', warn: false },
                      { label: 'TURNOVER USED', value: '4%', warn: false },
                      { label: 'CASH WEIGHT', value: '15%', warn: false },
                    ].map(m => (
                      <div key={m.label} className="flex justify-between text-xs">
                        <span className="text-phosphor-dim">{m.label}</span>
                        <span className={m.warn ? 'text-alert-amber' : 'text-phosphor'}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="terminal-panel p-4">
                  <div className="text-phosphor-dim text-xs tracking-widest mb-3">SECTOR LIMITS</div>
                  <div className="space-y-2 text-xs">
                    {[
                      { sector: 'TECHNOLOGY', pct: 20, limit: 30, over: false },
                      { sector: 'AIRLINES', pct: 8, limit: 10, over: false },
                      { sector: 'HOTELS', pct: 8, limit: 10, over: false },
                    ].map(s => (
                      <div key={s.sector}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-phosphor-dim">{s.sector}</span>
                          <span className={s.over ? 'text-alert-amber' : 'text-phosphor'}>
                            {s.pct}% / {s.limit}%
                          </span>
                        </div>
                        <div className="h-1 bg-phosphor/10">
                          <div
                            className={`h-full ${s.over ? 'bg-alert-amber' : 'bg-phosphor/40'}`}
                            style={{ width: `${(s.pct / s.limit) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activePanel === 'DRAFT' && (
              <div>
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
                <div className="mt-4 border-t border-phosphor/15 pt-4">
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

                {(draftOrders.length > 0 || holdReason) && (
                  <button className="cmd-button-primary w-full py-3 text-xs tracking-widest mt-4">
                    COMMIT DECISION ▶ (TUTORIAL ONLY)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Machine comparison (shown in MACHINE step) */}
          {step.id === 'MACHINE' && (
            <div className="border-t border-phosphor/15 p-4 bg-phosphor/3">
              <div className="text-phosphor-dim text-xs tracking-widest mb-2">MACHINE DECISION · REFI RULES</div>
              <div className="flex gap-6 text-xs mb-2">
                <div>
                  <span className="text-phosphor-dim">ACTION: </span>
                  <span className="text-phosphor font-bold">REDUCE</span>
                </div>
                <div>
                  <span className="text-phosphor-dim">TARGET: </span>
                  <span className="text-phosphor">DAL, MAR</span>
                </div>
              </div>
              <div className="text-phosphor-dim text-xs leading-snug border-l border-phosphor/20 pl-2">
                "Revenue impact is confirmed for travel sector. WHO emergency = confirmed demand destruction.
                Policy: reduce any position with confirmed revenue impairment &gt;3% at WHO alert level."
              </div>
            </div>
          )}
        </div>

        {/* Right: tutorial instruction panel */}
        <div className="w-80 flex flex-col border-l border-phosphor/15">

          {/* Instruction */}
          <div className="flex-1 p-6 overflow-y-auto">

            {/* Step number */}
            <div className="flex items-center gap-2 mb-4">
              {STEPS.map((s, i) => (
                <div
                  key={s.id}
                  className={`w-2 h-2 transition-colors ${
                    i < stepIdx ? 'bg-paper-green' :
                    i === stepIdx ? 'bg-phosphor' :
                    'bg-phosphor/15'
                  }`}
                />
              ))}
            </div>

            <div className="text-phosphor-dim text-xs tracking-widest mb-1">
              LESSON {stepIdx + 1} OF {STEPS.length}
            </div>
            <div className="text-phosphor text-sm font-bold mb-4 leading-snug">
              {step.instruction}
            </div>
            <div className="text-phosphor-mid text-xs leading-relaxed mb-5">
              {step.detail}
            </div>

            {step.keyHint && (
              <div className="border border-phosphor/20 px-3 py-2 text-phosphor-dim text-xs tracking-widest mb-4 text-center">
                {step.keyHint}
              </div>
            )}

            {step.highlight && (
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 bg-alert-amber" />
                <span className="text-alert-amber text-xs tracking-widest">{step.highlight} HIGHLIGHTED</span>
              </div>
            )}

            {/* Hold step: show reason selection */}
            {step.id === 'HOLD' && (
              <div className="mb-4 space-y-1.5">
                <div className="text-phosphor-dim text-xs tracking-widest mb-2">5 HOLD REASONS</div>
                {HOLD_REASONS.map(r => (
                  <div key={r} className="flex items-center gap-2 text-xs text-phosphor-dim">
                    <div className="w-1 h-1 bg-phosphor/40" />
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="p-4 border-t border-phosphor/15">
            <button
              onClick={advance}
              className="cmd-button-primary w-full py-3 text-xs tracking-widest"
            >
              {stepIdx === STEPS.length - 1 ? 'ENTER THE ARENA ▶' : step.action + ' →'}
            </button>

            {stepIdx > 0 && (
              <button
                onClick={() => setStepIdx(s => Math.max(0, s - 1))}
                className="w-full text-center text-phosphor-dim text-xs mt-2 hover:text-phosphor transition-colors tracking-widest"
              >
                ← BACK
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: 5 questions bar */}
      <div className="border-t border-phosphor/10 px-6 py-2.5 flex gap-8 text-xs overflow-x-auto scrollbar-hide">
        {[
          { q: 'WHAT IS HAPPENING?', a: 'WHO PHEIC · JAN 30, 2020' },
          { q: 'WHAT INFO DO I HAVE?', a: 'TRAVEL DEMAND SIGNALS · PORTFOLIO PANEL' },
          { q: 'WHAT CAN I DO?', a: 'REDUCE · ADD · EXIT · HOLD' },
          { q: 'WHAT HAPPENS WHEN I COMMIT?', a: 'MARKET RESOLVES · MACHINE COMPARES' },
          { q: 'HOW AM I DOING VS MACHINE?', a: 'SCORE SHOWN AFTER COMMIT' },
        ].map(({ q, a }) => (
          <div key={q} className="flex-shrink-0">
            <div className="text-phosphor-dim tracking-widest">{q}</div>
            <div className="text-phosphor mt-0.5">{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
