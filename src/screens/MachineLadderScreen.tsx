import { useGame } from '../context/GameContext';
import { MACHINE_LADDER } from '../lib/progressionEngine';
import type { BenchmarkSnapshot } from '../lib/gameTypes';

interface Props {
  onChallenge: (machineId: string) => void;
  onBack: () => void;
}

const STATUS_COLORS = {
  LOCKED: 'border-phosphor/12 opacity-45',
  ACTIVE: 'border-phosphor/40',
  DEFEATED: 'border-paper-green/30',
};

const STATUS_LABEL = {
  LOCKED: 'LOCKED',
  ACTIVE: 'AVAILABLE',
  DEFEATED: 'DEFEATED',
};

function fmtPct(v: number, decimals = 2): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

function fmtNum(v: number, decimals = 2): string {
  return v.toFixed(decimals);
}

function SnapshotStats({ snapshot }: { snapshot: BenchmarkSnapshot }) {
  const s = snapshot.stats;
  const rows: { label: string; value: string; warn?: boolean }[] = [
    { label: 'CAGR', value: fmtPct(s.cagr) },
    { label: 'SHARPE', value: fmtNum(s.sharpe) },
    { label: 'MAX DD', value: fmtPct(s.maxDrawdown), warn: true },
    { label: 'VOL', value: fmtPct(s.volatility) },
  ];
  if (s.sortino !== undefined) rows.push({ label: 'SORTINO', value: fmtNum(s.sortino) });
  if (s.alphaAnnualized !== undefined) rows.push({ label: 'ALPHA', value: fmtPct(s.alphaAnnualized) });
  if (s.betaVsSpy !== undefined) rows.push({ label: 'BETA', value: fmtNum(s.betaVsSpy, 2) });

  return (
    <div className="mt-3 border-t border-phosphor/10 pt-3">
      <div className="text-phosphor-dim text-xs tracking-widest mb-2" style={{ fontSize: '9px' }}>
        OOS STATS · {snapshot.period.firstTradingDay} → {snapshot.period.lastTradingDay} · {snapshot.period.businessDays} DAYS
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {rows.map(r => (
          <div key={r.label} className="text-xs">
            <span className="text-phosphor-dim">{r.label} </span>
            <span className={r.warn && parseFloat(r.value) < 0 ? 'text-risk-red' : 'text-phosphor'}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5" style={{ fontSize: '9px', color: 'rgba(12,212,160,0.35)', letterSpacing: '0.05em' }}>
        SOURCE: {snapshot.sourceType.replace(/_/g, ' ')} · ID: {snapshot.benchmarkId}
      </div>
    </div>
  );
}

export default function MachineLadderScreen({ onChallenge, onBack }: Props) {
  const { state } = useGame();
  const { profile } = state;

  const nextXpTarget = MACHINE_LADDER.find(m =>
    profile.machineLadder[m.id]?.status === 'LOCKED',
  )?.xpRequired ?? null;

  const totalAttempts = profile.machineAttempts;
  const totalBeats = profile.machineBeats;
  const winRate = totalAttempts > 0 ? Math.round((totalBeats / totalAttempts) * 100) : 0;

  return (
    <div className="min-h-screen bg-terminal-black terminal-screen font-mono">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="text-phosphor-dim text-xs tracking-widest mb-1">MACHINE LADDER</div>
            <div className="text-phosphor text-xl font-bold">THE OPPOSITION</div>
            <div className="text-phosphor-mid text-xs mt-1 leading-relaxed max-w-lg">
              Each machine has a known training cutoff and a disclosed risk policy.
              FAIR MATCH machines use the same constraints as you.
              EXHIBITION machines have different capability models — flagged explicitly.
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-phosphor-dim text-xs hover:text-phosphor transition-colors tracking-widest flex-shrink-0"
          >
            ← BACK
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'MACHINES BEATEN', value: String(totalBeats) },
            { label: 'TOTAL ATTEMPTS', value: String(totalAttempts) },
            { label: 'WIN RATE', value: `${winRate}%` },
            { label: 'ALPHA XP', value: String(profile.alphaXp) },
          ].map(({ label, value }) => (
            <div key={label} className="terminal-panel p-4">
              <div className="text-phosphor-dim text-xs tracking-widest mb-1">{label}</div>
              <div className="text-phosphor text-2xl font-bold">{value}</div>
            </div>
          ))}
        </div>

        {/* OOS note */}
        <div className="border border-alert-amber/20 bg-alert-amber/5 px-4 py-2.5 text-alert-amber text-xs leading-relaxed mb-6 tracking-wide">
          <span className="font-bold">OOS INTEGRITY NOTE:</span> The ReFi RF/RL benchmark OOS period begins 2023-04-18.
          COVID, Recovery, Inflation, and Banking Stress arenas pre-date this window.
          Those arenas use game rules engine benchmarks — not the production OOS data.
          This distinction is deliberate and documented.
        </div>

        {/* Ladder — top rank first */}
        <div className="space-y-3">
          {[...MACHINE_LADDER].reverse().map((machine, revIdx) => {
            const ladderEntry = profile.machineLadder[machine.id];
            const status = ladderEntry?.status ?? 'LOCKED';
            const wins = ladderEntry?.wins ?? 0;
            const losses = ladderEntry?.losses ?? 0;
            const rank = MACHINE_LADDER.length - revIdx;
            const isActive = status === 'ACTIVE';
            const isDefeated = status === 'DEFEATED';
            const isLocked = status === 'LOCKED';
            const isTaco = machine.id === 'taco_protocol';
            const isExhibition = machine.contestType === 'EXHIBITION';

            return (
              <div
                key={machine.id}
                className={`border p-5 transition-all duration-200 ${STATUS_COLORS[status]} ${
                  isTaco && isActive ? 'border-alert-amber/50 bg-alert-amber/5' : ''
                }`}
                style={{ background: isLocked ? 'transparent' : 'rgba(12,212,160,0.02)' }}
              >
                <div className="flex items-start gap-5">
                  {/* Rank badge */}
                  <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center border text-sm font-bold ${
                    isDefeated ? 'border-paper-green/40 text-paper-green' :
                    isActive ? 'border-phosphor/40 text-phosphor' :
                    'border-phosphor/15 text-phosphor-dim'
                  }`}>
                    {rank}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-sm font-bold tracking-wide ${
                        isDefeated ? 'text-paper-green' :
                        isActive ? 'text-phosphor' :
                        'text-phosphor-dim'
                      }`}>{machine.label}</span>

                      <span className={`text-xs tracking-widest px-2 py-0.5 border ${
                        isDefeated ? 'border-paper-green/30 text-paper-green bg-paper-green/10' :
                        isActive ? 'border-phosphor/30 text-phosphor-mid bg-phosphor/5' :
                        'border-phosphor/10 text-phosphor-dim'
                      }`}>{STATUS_LABEL[status]}</span>

                      {isExhibition && (
                        <span className="text-xs tracking-widest px-2 py-0.5 border border-alert-amber/30 text-alert-amber bg-alert-amber/5">
                          EXHIBITION
                        </span>
                      )}
                      {!isExhibition && (
                        <span className="text-xs tracking-widest px-2 py-0.5 border border-phosphor/15 text-phosphor-dim">
                          FAIR MATCH
                        </span>
                      )}

                      {isTaco && isActive && (
                        <span className="text-xs text-alert-amber tracking-widest animate-pulse">FINAL BOSS</span>
                      )}
                    </div>

                    <div className="text-phosphor-dim text-xs mb-1.5 tracking-widest">{machine.subtitle}</div>
                    <div className="text-phosphor-mid text-xs leading-snug mb-2">{machine.description}</div>

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-phosphor-dim">CUTOFF: </span>
                        <span className="text-phosphor">{machine.trainingCutoff}</span>
                      </div>
                      <div>
                        <span className="text-phosphor-dim">POLICY: </span>
                        <span className="text-phosphor">{machine.riskPolicy.slice(0, 40)}{machine.riskPolicy.length > 40 ? '…' : ''}</span>
                      </div>
                      <div>
                        <span className="text-phosphor-dim">AUDIT: </span>
                        <span className="text-phosphor-dim font-bold">{machine.auditId}</span>
                      </div>
                    </div>

                    {/* Real benchmark stats */}
                    {machine.snapshot && (isActive || isDefeated) && (
                      <SnapshotStats snapshot={machine.snapshot} />
                    )}

                    {isLocked && (
                      <div className="mt-2 text-phosphor-dim text-xs">
                        REQUIRES {machine.xpRequired} ALPHA XP
                        {nextXpTarget === machine.xpRequired && (
                          <span className="text-alert-amber ml-2">
                            · {machine.xpRequired - profile.alphaXp} XP AWAY
                          </span>
                        )}
                      </div>
                    )}

                    {machine.message && (isActive || isDefeated) && (
                      <div className="mt-2 text-phosphor-dim text-xs border-l-2 border-phosphor/20 pl-2">
                        {machine.message}
                      </div>
                    )}
                  </div>

                  {/* Right: record + action */}
                  <div className="flex-shrink-0 text-right min-w-[90px]">
                    {(wins > 0 || losses > 0) && (
                      <div className="mb-3">
                        <div className="text-phosphor-dim text-xs tracking-widest mb-1">RECORD</div>
                        <div className="text-paper-green font-bold text-sm">{wins}W</div>
                        <div className="text-risk-red font-bold text-sm">{losses}L</div>
                      </div>
                    )}
                    {isDefeated && (
                      <div className="text-paper-green text-xs tracking-widest">✓ DEFEATED</div>
                    )}
                    {isActive && (
                      <button
                        onClick={() => onChallenge(machine.id)}
                        className={`cmd-button text-xs px-4 py-2 tracking-widest ${
                          isTaco
                            ? 'border-alert-amber text-alert-amber bg-alert-amber/10 hover:bg-alert-amber/20'
                            : 'cmd-button-primary'
                        }`}
                      >
                        {isTaco ? 'CHALLENGE ▶' : 'CHALLENGE ▶'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Exhibition note */}
        <div className="mt-6 border border-phosphor/10 p-4 text-xs text-phosphor-dim leading-relaxed space-y-2">
          <div className="text-phosphor tracking-widest mb-2">CONTEST TYPE DEFINITIONS</div>
          <div>
            <span className="text-phosphor-mid">FAIR MATCH</span> — Same universe. Long-only rule. Same capital. Same transaction costs. Same decision windows. Same risk limits. Arena advancement is determined by fair match results.
          </div>
          <div>
            <span className="text-alert-amber">EXHIBITION</span> — The ReFi RF/RL benchmarks use directional regime exposure (+1 long / -1 short). This is a fundamentally different capability model. Exhibition results are for learning, not arena advancement. The screen explicitly states the capability difference.
          </div>
          <div className="pt-1 text-phosphor-dim/60">
            ALL TRAINING CUTOFFS ARE DOCUMENTED. AUDIT IDs ARE YOUR PROOF. NO BLACK BOX.
          </div>
        </div>
      </div>
    </div>
  );
}
