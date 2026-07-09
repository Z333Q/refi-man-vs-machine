interface Props {
  onClose: () => void;
}

const SECTIONS = [
  {
    title: 'THE GAME',
    items: [
      'You manage a U.S. equity portfolio through a historical crisis.',
      'Each checkpoint presents a real market signal. You decide how to respond.',
      'The machine responds too. One of you is right. Process quality is scored.',
      'You win by out-scoring the machine across all checkpoints.',
    ],
  },
  {
    title: 'YOUR 6 ACTIONS',
    items: [
      'BUY / ADD — Increase a position. Use when conviction is high and risk is priced in.',
      'REDUCE — Sell part of a position. Use when risk has changed, not when price has moved.',
      'EXIT — Close a position entirely. Use when the thesis is broken.',
      'HOLD — Do nothing. Requires a reason. Earns full credit when it is the correct call.',
      'ROTATE DEFENSIVE — Reduce cyclicals, add defensives.',
      'ROTATE RISK — Reduce defensives, add growth or cyclicals.',
    ],
  },
  {
    title: 'HOW TO MAKE A DECISION',
    items: [
      '1. READ the signal (SIGNAL tab or left panel).',
      '2. INSPECT your portfolio (press P or click PORTFOLIO tab).',
      '3. Click a position to open the order ticket.',
      '4. Select ADD, REDUCE, or EXIT. Set an amount. Click ADD TO DRAFT.',
      '5. Or HOLD — select a reason from the 5 options.',
      '6. Check RISK panel before committing.',
      '7. Go to DRAFT tab and click REVIEW & COMMIT.',
      '8. Confirm the commit — this cannot be undone.',
    ],
  },
  {
    title: 'HOLD REASONS',
    items: [
      'THESIS UNCHANGED — Signal does not change your view of the company.',
      'INSUFFICIENT INFORMATION — One data point is not enough to act.',
      'AWAIT CONFIRMATION — Wait for follow-through before sizing.',
      'VALUATION SUPPORT — Price already reflects the risk.',
      'POLICY FLOOR — Central bank or government backstop limits downside.',
    ],
  },
  {
    title: 'KEYBOARD SHORTCUTS',
    items: [
      'P — Open Portfolio panel (order ticket)',
      'R — Open Risk panel',
      'S — Open Signal panel',
      'D — Open Draft panel',
      'H — Go to Hold decision',
      'ENTER — Confirm commit (when in confirm state)',
      'ESC — Cancel order / close overlay',
      '? or F10 — Open this help screen',
    ],
  },
  {
    title: 'SCORING',
    items: [
      'RAER — Risk-adjusted excess return vs machine.',
      'DRAWDOWN CONTROL — How well you limited portfolio drawdown.',
      'DOWNSIDE CAPTURE — Did you avoid the worst of the market move?',
      'REGIME ADAPTATION — Did you recognize and react to regime shifts?',
      'TURNOVER DISCIPLINE — Did you avoid unnecessary trading?',
      'CONSISTENCY — Are your decisions coherent over time?',
    ],
  },
  {
    title: 'WIN CONDITIONS',
    items: [
      'PASS — Complete all checkpoints without hitting critical failure.',
      'MACHINE BEATEN — Your total score exceeds the machine\'s.',
      'OBSERVATION MODE — Drawdown exceeds -20%. Run continues but cannot pass.',
      'Your process quality is tracked across all runs in your Alpha Profile.',
    ],
  },
  {
    title: 'PROGRESSION',
    items: [
      'Alpha XP earned on every decision, daily tape, and machine challenge.',
      'Rank up from INITIATE → ANALYST → ASSOCIATE → PM → SENIOR PM → CIO.',
      'Terminal modules unlock as you earn XP — DRAWDOWN MAP at 100, STAGED EXECUTION at 200.',
      'Machine Ladder: 7 opponents from S&P 500 passive to TACO Protocol final boss.',
      'Beat 3 machines + 500 XP to unlock Machine Audit.',
    ],
  },
  {
    title: 'DAILY TAPE',
    items: [
      'A new market scenario is available every day.',
      'Select the correct action for full XP (25). Match the machine for partial XP (15).',
      'One submission per day. Results reveal at close.',
      'Yesterday\'s result and explanation are shown before today\'s tape.',
    ],
  },
  {
    title: 'MACHINE LADDER',
    items: [
      'Each machine has a training cutoff and a disclosed risk policy.',
      'You know exactly what you are competing against — no black box.',
      'Challenge available machines from the Machine Ladder screen.',
      'Win record is tracked per machine.',
    ],
  },
];

export default function HelpScreen({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-terminal-black/95 font-mono flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-phosphor/15 flex-shrink-0">
        <div>
          <div className="text-phosphor-dim text-xs tracking-widest mb-0.5">REFI ALPHA</div>
          <div className="text-phosphor text-lg font-bold">PLAYER REFERENCE</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-phosphor-dim text-xs tracking-widest">F10 OR ? TO TOGGLE</div>
          <button
            onClick={onClose}
            className="text-phosphor-dim text-xs hover:text-phosphor transition-colors tracking-widest border border-phosphor/20 px-3 py-1.5 hover:border-phosphor/40"
          >
            CLOSE [ESC]
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="columns-2 gap-8 space-y-0">
            {SECTIONS.map(section => (
              <div key={section.title} className="break-inside-avoid mb-6">
                <div className="text-phosphor-dim text-xs tracking-widest mb-3 border-b border-phosphor/10 pb-2">
                  {section.title}
                </div>
                <div className="space-y-1.5">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex gap-2 text-xs text-phosphor-mid leading-snug">
                      <span className="text-phosphor-dim flex-shrink-0 mt-px">·</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-phosphor/10 px-6 py-3 flex-shrink-0">
        <div className="flex gap-8 text-xs text-phosphor-dim overflow-x-auto scrollbar-hide">
          {[
            'P — PORTFOLIO',
            'R — RISK',
            'S — SIGNAL',
            'D — DRAFT',
            'H — HOLD',
            'ENTER — COMMIT',
            'ESC — CANCEL',
            '? — HELP',
          ].map(k => (
            <span key={k} className="flex-shrink-0">{k}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
