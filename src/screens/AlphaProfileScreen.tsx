import ActionZone from '../components/ui/ActionZone';
import ClaimHandoffButton from '../components/ClaimHandoffButton';
import { useGame } from '../context/GameContext';
import type { DimensionCode } from '../lib/gameTypes';
import { isDimensionProvisional, PROVISIONAL_UNTIL_DECISIONS } from '../lib/decisionContract';

interface Props {
  onBasketWriter: () => void;
  onBack: () => void;
}

// The dimensions this screen reports, in reading order. Scores come from the
// player's own profile: this screen previously rendered a fixed mock array, so
// every player saw the same seven numbers from the specification's example.
// The profile is the one surface that argues from the player's own behaviour,
// and it cannot do that with someone else's data.
const DIMENSION_ROWS: { code: DimensionCode; label: string }[] = [
  { code: 'STOCK_SELECTION', label: 'STOCK SELECTION' },
  { code: 'POSITION_SIZING', label: 'POSITION SIZING' },
  { code: 'LOSS_CONTROL', label: 'LOSS CONTROL' },
  { code: 'REENTRY_DISCIPLINE', label: 'RE-ENTRY DISCIPLINE' },
  { code: 'TURNOVER_DISCIPLINE', label: 'TURNOVER DISCIPLINE' },
  { code: 'REGIME_ADAPTATION', label: 'REGIME ADAPTATION' },
  { code: 'RULE_ADHERENCE', label: 'RULE ADHERENCE' },
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
  const { state } = useGame();

  // Read the player's own dimensions. sampleSize already rides on each one, so
  // the provisional rule needs no schema change.
  const rows = DIMENSION_ROWS.map(r => {
    const d = state.profile.dimensions[r.code] ?? { score: 50, sampleSize: 0 };
    return {
      ...r,
      score: Math.round(d.score),
      sampleSize: d.sampleSize,
      provisional: isDimensionProvisional(r.code, d.sampleSize),
    };
  });

  // A dimension nobody has evidence for is not a strength or a gap. Provisional
  // conviction dimensions are also held back: Amendment 1 removed the governor,
  // so a first-decision 95 must be allowed to be wrong without that verdict
  // hardening into an identity the player did not earn.
  const reportable = rows.filter(r => r.sampleSize > 0 && !r.provisional);
  const strengths = reportable.filter(r => r.score >= 70);
  const gaps = reportable.filter(r => r.score < 55);
  const anyProvisional = rows.some(r => r.provisional);

  // The pattern is read off the player's own extremes rather than authored.
  // A claim about someone's behaviour has to come from their behaviour, or it
  // is just copy wearing a data costume.
  const best = [...reportable].sort((a, b) => b.score - a.score)[0];
  const worst = [...reportable].sort((a, b) => a.score - b.score)[0];
  const pattern: string[] = [];
  if (best && best.score >= 70) pattern.push(`YOUR STRONGEST DIMENSION IS ${best.label}.`);
  if (worst && worst.score < 55 && worst.code !== best?.code) {
    pattern.push(`${worst.label} IS COSTING YOU MORE THAN YOUR CALLS ARE.`);
  }

  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between">
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
                {rows.map(item => (
                  <div key={item.code} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-phosphor-mid">{item.label}</span>
                      {item.provisional && (
                        <span className="font-mono text-xs text-alert-amber border border-alert-amber/40 px-1.5 tracking-widest">
                          PROVISIONAL
                        </span>
                      )}
                      {item.sampleSize === 0 && !item.provisional && (
                        <span className="font-mono text-xs text-phosphor-dim tracking-widest">NO DATA YET</span>
                      )}
                    </div>
                    <BarScore score={item.score} />
                  </div>
                ))}
              </div>
              {anyProvisional && (
                <div className="font-mono text-xs text-phosphor-dim leading-5 border-t border-phosphor/10 pt-3">
                  PROVISIONAL: CONVICTION SCORES SETTLE AFTER {PROVISIONAL_UNTIL_DECISIONS} DECISIONS.
                  EARLY CALIBRATION IS EXPECTED TO BE WRONG.
                </div>
              )}
            </div>

            {/* Right panel */}
            <div className="space-y-4">
              <div className="terminal-panel p-5 space-y-4">
                <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                  PATTERN DETECTED
                </div>
                <div className="space-y-3 font-mono text-sm text-phosphor leading-7">
                  {pattern.length === 0 ? (
                    <div className="text-phosphor-dim">
                      COMMIT MORE DECISIONS AND A PATTERN WILL APPEAR HERE.
                    </div>
                  ) : pattern.map(line => <div key={line}>{line}</div>)}
                </div>
              </div>

              <div className="terminal-panel p-5 space-y-4">
                <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                  STRENGTHS
                </div>
                <div className="space-y-2 font-mono text-xs">
                  {strengths.length === 0 ? (
                    <div className="text-phosphor-dim">NOT ENOUGH DECISIONS YET.</div>
                  ) : strengths.map(d => (
                    <div key={d.code} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-phosphor flex-shrink-0" />
                      <span className="text-phosphor">{d.label}</span>
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
                  {gaps.length === 0 ? (
                    <div className="text-phosphor-dim">NOT ENOUGH DECISIONS YET.</div>
                  ) : gaps.map(d => (
                    <div key={d.code} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-risk-red flex-shrink-0" />
                      <span className="negative-value">{d.label}</span>
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
              in-game behavioral scores stay in the game: only your arena and
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
