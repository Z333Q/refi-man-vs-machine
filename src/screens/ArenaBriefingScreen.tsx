import ActionZone, { SecondaryAction } from '../components/ui/ActionZone';
import type { ArenaId } from '../lib/gameTypes';
import ArenaEmblem from '../components/game/ArenaEmblem';
import { getArena, getTotalCheckpoints } from '../lib/arenas';

// The briefing describes the arena the player is about to enter.
//
// It used to describe COVID unconditionally: the title, the risk limit, the
// window and the ASCII plate were all typed in. Once the map could select a
// regime, that meant walking into Recovery through a COVID briefing, with a
// -20% limit printed over an arena that ends at -15%. A briefing that states
// the wrong risk budget is worse than no briefing.

interface Props {
  arenaId?: ArenaId;
  onStart: () => void;
  onViewMachineCard: () => void;
  onBack: () => void;
}

export default function ArenaBriefingScreen({
  arenaId = 'covid_black_swan', onStart, onViewMachineCard, onBack,
}: Props) {
  const arena = getArena(arenaId);
  // Was hardcoded to 22, which is COVID's count. Every other arena is shorter,
  // so the briefing promised decision points that do not exist.
  const checkpointCount = getTotalCheckpoints(arenaId);
  const name = arena?.name ?? 'ARENA';
  // Split on the last space so a two-word regime stacks the way the plate was
  // designed for, and a one-word regime simply does not stack.
  const cut = name.lastIndexOf(' ');
  const nameTop = cut > 0 ? name.slice(0, cut) : name;
  const nameBottom = cut > 0 ? name.slice(cut + 1) : '';

  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">
          REFI ALPHA // ARENA BRIEFING
        </div>
        <button onClick={onBack} className="font-mono text-xs text-phosphor-dim hover:text-phosphor transition-colors">
          [ESC] BACK
        </button>
      </div>

      <div className="flex-1 flex items-start justify-center px-8 py-12">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Briefing */}
          <div className="space-y-6">
            <div>
              <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-2">
                ARENA {String(arena?.order ?? 1).padStart(2, '0')}
              </div>
              <h1 className="font-mono text-3xl font-bold text-phosphor-hot terminal-glow-strong tracking-wide">
                {nameTop}{nameBottom && <><br />{nameBottom}</>}
              </h1>
              <div className="font-mono text-xs text-phosphor-dim mt-2">{arena?.window}</div>
            </div>

            <div className="terminal-panel p-4 space-y-2">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2 mb-3">
                OBJECTIVE
              </div>
              <div className="font-mono text-sm text-phosphor leading-6">
                {arena?.lesson ?? 'SURVIVE THE SHOCK.'}
              </div>
              <div className="font-mono text-sm text-phosphor leading-6">BEAT THE MACHINE.</div>
            </div>

            <div className="space-y-0 font-mono text-xs">
              {[
                { label: 'STARTING CAPITAL', value: '$100,000' },
                { label: 'MAX POSITION SIZE', value: '15%' },
                { label: 'MAX SECTOR EXPOSURE', value: '35%' },
                {
                  label: 'CRITICAL DRAWDOWN',
                  value: `${Math.round((arena?.criticalDrawdown ?? -0.2) * 100)}%`,
                  danger: true,
                },
                { label: 'CHECKPOINTS', value: String(arena?.checkpoints.length ?? 0) },
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

            {/* Arena emblem. Every arena used to draw the same blob
                with its name stamped inside it, so five different regimes
                arrived looking identical; the emblem is a picture of what the
                arena is about. */}
            <div className="terminal-panel-deep p-4">
              <ArenaEmblem arenaId={arenaId} />
              <div className="font-mono text-xs text-phosphor-dim text-center mt-2 tracking-widest">
                {arena?.window}
              </div>
            </div>

            <div className="terminal-panel p-4 space-y-2">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-2">CHECKPOINTS</div>
              <div className="flex items-center gap-1">
                {Array.from({ length: checkpointCount }, (_, i) => (
                  <div
                    key={i}
                    className="w-2 h-4"
                    style={{ background: 'rgba(12,212,160,0.15)', border: '1px solid rgba(12,212,160,0.2)' }}
                  />
                ))}
              </div>
              <div className="font-mono text-xs text-phosphor-dim">{checkpointCount} DECISION POINTS</div>
            </div>

          </div>
        </div>
      </div>

      <div className="border-t border-phosphor/20 px-6 py-2 font-mono text-xs text-phosphor-dim">
        <span className="nav-key">M</span> MACHINE CARD &nbsp;
        <span className="nav-key">ESC</span> ARENA MAP &nbsp;
        <span className="nav-key">ENTER</span> START RUN
      </div>

      <ActionZone
        note={`${checkpointCount} DECISIONS · DATES HIDDEN · NO RESTART ONCE COMMITTED`}
        primary={{ label: 'START RUN', onClick: onStart, keyHint: '[ENTER]' }}
        secondaryRight={<SecondaryAction label="View machine card" onClick={onViewMachineCard} />}
      />
    </div>
  );
}
