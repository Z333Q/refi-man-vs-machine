import ActionZone, { SecondaryAction } from '../components/ui/ActionZone';

interface Props {
  onStart: () => void;
  onViewMachineCard: () => void;
  onBack: () => void;
}

export default function ArenaBriefingScreen({ onStart, onViewMachineCard, onBack }: Props) {
  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between pr-16 sm:pr-6">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">
          REFI ALPHA // ARENA BRIEFING
        </div>
        <button onClick={onBack} className="font-mono text-xs text-phosphor-dim hover:text-phosphor transition-colors">
          [ESC] BACK
        </button>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:px-8 sm:py-12">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Left: Briefing */}
          <div className="space-y-6">
            <div>
              <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-2">ARENA 01</div>
              <h1 className="font-mono text-3xl font-bold text-phosphor-hot terminal-glow-strong tracking-wide">
                COVID<br />BLACK SWAN
              </h1>
            </div>

            <div className="terminal-panel p-4 space-y-2">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2 mb-3">
                OBJECTIVE
              </div>
              <div className="font-mono text-sm text-phosphor leading-6">SURVIVE THE SHOCK.</div>
              <div className="font-mono text-sm text-phosphor leading-6">BEAT THE MACHINE.</div>
            </div>

            <div className="space-y-0 font-mono text-xs">
              {[
                { label: 'STARTING CAPITAL', value: '$100,000' },
                { label: 'MAX POSITION SIZE', value: '15%' },
                { label: 'MAX SECTOR EXPOSURE', value: '35%' },
                { label: 'CRITICAL DRAWDOWN', value: '-20%', danger: true },
                { label: 'LEVERAGE', value: 'DISABLED', muted: true },
                { label: 'SHORT SELLING', value: 'DISABLED', muted: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-2.5 border-b border-phosphor/10">
                  <span className="text-phosphor-dim">{row.label}</span>
                  <span className={row.danger ? 'negative-value' : row.muted ? 'text-phosphor-dim' : 'text-phosphor'}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="terminal-panel p-4 space-y-2">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2 mb-3">
                PASS CONDITION
              </div>
              <div className="font-mono text-xs text-phosphor-mid leading-5">REFI SCORE &gt; MACHINE SCORE</div>
              <div className="font-mono text-xs text-phosphor-mid leading-5">NO CRITICAL RISK FAILURE</div>
            </div>
          </div>

          {/* Right: Opponent + actions */}
          <div className="space-y-6">
            <div className="terminal-panel p-5 space-y-4">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                OPPONENT
              </div>
              <div className="font-mono text-lg text-phosphor-hot terminal-glow">
                REFI CRISIS MACHINE v1.4
              </div>

              <div className="space-y-0 font-mono text-xs">
                {[
                  { label: 'TYPE', value: 'SYSTEMATIC RISK-AWARE BENCHMARK' },
                  { label: 'MODEL FAMILY', value: 'REGIME + PORTFOLIO POLICY' },
                  { label: 'TRAINING CUTOFF', value: '2019-12-31', warning: true },
                  { label: 'ARENA DATA ACCESS', value: 'TIMESTAMP AND EARLIER ONLY' },
                  { label: 'FUTURE DATA', value: 'BLOCKED', warning: true },
                  { label: 'TRANSACTION COSTS', value: 'ENABLED' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-2.5 border-b border-phosphor/10">
                    <span className="text-phosphor-dim">{row.label}</span>
                    <span className={row.warning ? 'warning-value' : 'text-phosphor'}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="font-mono text-xs text-phosphor-dim pt-1">
                AUDIT ID: RFA-MCH-CRISIS-014
              </div>
            </div>

            {/* ASCII arena icon */}
            <div className="terminal-panel-deep p-4">
              <pre className="ascii-art text-phosphor-dim text-center" style={{ fontSize: '9px', lineHeight: '1.1' }}>
{`       ___
   ___/   \\___
  /           \\
 |  BLACK SWAN |
  \\           /
   \\___   ___/
       \\_/
  COVID-19 SHOCK
 FEB - MAR 2020`}
              </pre>
            </div>

            <div className="terminal-panel p-4 space-y-2">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-2">CHECKPOINTS</div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 22 }, (_, i) => (
                  <div
                    key={i}
                    className="w-2 h-4"
                    style={{ background: 'rgba(12,212,160,0.15)', border: '1px solid rgba(12,212,160,0.2)' }}
                  />
                ))}
              </div>
              <div className="font-mono text-xs text-phosphor-dim">22 DECISION POINTS</div>
            </div>

          </div>
        </div>
      </div>

      <ActionZone
        note="22 DECISIONS. DATES HIDDEN. NO RESTART ONCE COMMITTED."
        primary={{ label: 'START RUN', onClick: onStart, keyHint: '[ENTER]' }}
        secondaryRight={<SecondaryAction label="View machine card" onClick={onViewMachineCard} />}
      />
    </div>
  );
}
