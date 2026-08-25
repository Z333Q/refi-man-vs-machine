import ActionZone from '../components/ui/ActionZone';
import ClaimHandoffButton from '../components/ClaimHandoffButton';

interface Props {
  onBasketWriter: () => void;
  onBack: () => void;
}

const DIMENSIONS = [
  { dim: 'STOCK SELECTION', score: 81 },
  { dim: 'POSITION SIZING', score: 43 },
  { dim: 'LOSS CONTROL', score: 76 },
  { dim: 'RE-ENTRY DISCIPLINE', score: 38 },
  { dim: 'TURNOVER DISCIPLINE', score: 54 },
  { dim: 'REGIME ADAPTATION', score: 84 },
  { dim: 'RULE ADHERENCE', score: 47 },
];

function BarScore({ score }: { score: number }) {
  const filled = Math.round(score / 10);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="w-3 h-3"
            style={{
              background: i < filled ? (score >= 70 ? '#0CD4A0' : score >= 50 ? '#D6A647' : '#D94C4C') : '#08110D',
              border: '1px solid rgba(12,212,160,0.15)',
            }}
          />
        ))}
      </div>
      <span className="font-mono text-xs text-phosphor-mid w-6">{score}</span>
    </div>
  );
}

export default function AlphaProfileScreen({ onBasketWriter, onBack }: Props) {
  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between pr-16 sm:pr-6">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">
          REFI ALPHA // ALPHA PROFILE
        </div>
        <button onClick={onBack} className="font-mono text-xs text-phosphor-dim hover:text-phosphor">
          [ESC] BACK
        </button>
      </div>

      <div className="flex-1 flex items-start justify-center px-8 py-10">
        <div className="max-w-3xl w-full space-y-6">
          <div>
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-2">BASED ON 47 DECISIONS</div>
            <h1 className="font-mono text-3xl font-bold text-phosphor-hot terminal-glow-strong">ALPHA PROFILE</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dimension scores */}
            <div className="terminal-panel p-5 space-y-4">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                DIMENSION SCORES
              </div>
              <div className="space-y-4">
                {DIMENSIONS.map(item => (
                  <div key={item.dim} className="space-y-1.5">
                    <div className="font-mono text-xs text-phosphor-mid">{item.dim}</div>
                    <BarScore score={item.score} />
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div className="space-y-4">
              <div className="terminal-panel p-5 space-y-4">
                <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                  PATTERN DETECTED
                </div>
                <div className="space-y-3 font-mono text-sm text-phosphor leading-7">
                  <div>YOU IDENTIFY REGIME CHANGE WELL.</div>
                  <div>YOU OVERSIZE HIGH-CONVICTION DECISIONS.</div>
                </div>
              </div>

              <div className="terminal-panel p-5 space-y-4">
                <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                  STRENGTHS
                </div>
                <div className="space-y-2 font-mono text-xs">
                  {DIMENSIONS.filter(d => d.score >= 70).map(d => (
                    <div key={d.dim} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-phosphor flex-shrink-0" />
                      <span className="text-phosphor">{d.dim}</span>
                      <span className="text-phosphor-dim ml-auto">{d.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="terminal-panel p-5 space-y-4">
                <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                  SYSTEMATIC GAPS
                </div>
                <div className="space-y-2 font-mono text-xs">
                  {DIMENSIONS.filter(d => d.score < 55).map(d => (
                    <div key={d.dim} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-risk-red flex-shrink-0" />
                      <span className="negative-value">{d.dim}</span>
                      <span className="text-phosphor-dim ml-auto">{d.score}</span>
                    </div>
                  ))}
                </div>
                <div className="font-mono text-xs text-phosphor-dim leading-5 border-t border-phosphor/10 pt-3">
                  RULES REDUCE THE IMPACT OF SYSTEMATIC GAPS.
                </div>
              </div>

              <div className="terminal-panel-deep p-4 space-y-3">
                <div className="font-mono text-sm text-phosphor leading-6">
                  BUILD A BASKET AROUND YOUR STRENGTHS.
                </div>
                <div className="font-mono text-sm text-phosphor leading-6">
                  WRITE RULES AROUND YOUR WEAKNESSES.
                </div>
              </div>
            </div>
          </div>

          {/* Machine comparison */}
          <div className="terminal-panel p-5 space-y-4">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
              MACHINE BEAT RATE
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              {[
                { label: 'TOTAL ARENAS', value: '3' },
                { label: 'MACHINE BEATEN', value: '1' },
                { label: 'BEAT RATE', value: '33.3%' },
                { label: 'BEST STREAK', value: '1' },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold text-phosphor-hot terminal-glow mb-1">{stat.value}</div>
                  <div className="text-phosphor-dim text-xs">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="font-mono text-xs text-phosphor-dim text-center mt-2">
              ONE WIN IS NOT CONSISTENCY. THREE DISTINCT REGIMES IS.
            </div>
          </div>

          {/* Handoff to the investor product */}
          <div className="terminal-panel p-5 space-y-3">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
              TAKE YOUR ALPHA TO THE REAL PRODUCT
            </div>
            <div className="font-mono text-xs text-phosphor-mid leading-6">
              Carry your progress into ReFi and continue to eligibility. Your
              in-game behavioral scores stay in the game — only your arena and
              machine milestones travel.
            </div>
            <ClaimHandoffButton destination="ELIGIBILITY" />
          </div>
        </div>
      </div>

      <ActionZone
        note="BUILD A BASKET AROUND YOUR STRENGTHS. WRITE RULES AROUND YOUR WEAKNESSES."
        primary={{ label: 'BASKET WRITER', onClick: onBasketWriter, keyHint: '[ENTER]' }}
      />
    </div>
  );
}
