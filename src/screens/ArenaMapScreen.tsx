import { useMemo, useState } from 'react';
import type { ArenaId } from '../lib/gameTypes';
import { allArenas } from '../lib/arenas';
import { listRunRecords } from '../lib/runRecord';

interface Props {
  onSelectArena: (arena: ArenaId) => void;
  onBack: () => void;
}

type NodeState = 'locked' | 'available' | 'active' | 'passed' | 'machine-beaten';

interface ArenaNode {
  id: ArenaId;
  code: string;
  label: string;
  state: NodeState;
  difficulty: number;
  passPct: string | null;
  machine: string;
  decisions: number;
  riskLimit: string;
  lesson: string;
  window: string;
  icon: string;
}

/**
 * The map is built from the arena registry, not from a hand-written list.
 *
 * It used to be a fixture: labels, decision counts and risk limits typed in
 * beside the real content and free to disagree with it. Three of the four
 * regimes it advertised did not exist at all, and the one that did was
 * described as 22 decisions while the engine ran 14. Reading the registry means
 * the map cannot claim an arena the game cannot run.
 */
function useArenaNodes(): ArenaNode[] {
  return useMemo(() => {
    const records = listRunRecords();
    const arenas = allArenas();

    return arenas.map((a, i) => {
      const runs = records.filter(r => r.arenaId === a.id && r.completedAt !== null);
      const beaten = runs.some(r => r.result === 'MACHINE_BEATEN');
      const passed = runs.some(r => r.result === 'PASSED' || r.result === 'MACHINE_BEATEN');

      // Progression: the first arena is always open, and each later one opens
      // once the previous has been finished. Unlocks are earned from the run
      // record, so they survive a refresh like everything else.
      const prev = arenas[i - 1];
      const prevDone = !prev || records.some(
        r => r.arenaId === prev.id && r.completedAt !== null,
      );

      const state: NodeState =
        beaten ? 'machine-beaten'
          : passed ? 'passed'
            : prevDone ? (runs.length > 0 ? 'active' : 'available')
              : 'locked';

      return {
        id: a.id,
        code: String(a.order).padStart(2, '0'),
        label: a.name,
        state,
        difficulty: a.difficulty,
        passPct: null,
        machine: 'REFI RULES MACHINE',
        decisions: a.checkpoints.length,
        riskLimit: `${Math.round(a.criticalDrawdown * 100)}% DD`,
        lesson: a.lesson.toUpperCase(),
        window: a.window,
        icon: ARENA_ICON[a.id] ?? '///',
      };
    });
  }, []);
}

const ARENA_ICON: Record<string, string> = {
  covid_black_swan: '~~~',
  recovery_trap: '/^\\',
  inflation_shift: '$$$',
  banking_stress: '|||',
  taco_protocol: '>>>',
};

const SIDE_ARENAS = [
  { code: '06', label: 'MAN VS MACHINE', state: 'locked' as NodeState },
  { code: '07', label: 'BASKET WRITER', state: 'locked' as NodeState },
  { code: '08', label: 'POLICY WRITER', state: 'locked' as NodeState },
];

const NODE_SYMBOL: Record<NodeState, string> = {
  locked: '○',
  available: '◌',
  active: '●',
  passed: '✓',
  'machine-beaten': '★',
};

const NODE_CLASS: Record<NodeState, string> = {
  locked: 'node-locked',
  available: 'node-available',
  active: 'node-active',
  passed: 'node-passed',
  'machine-beaten': 'node-machine-beaten',
};

function DifficultyBar({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className="w-2 h-2"
          style={{ background: i < level ? '#0CD4A0' : '#08110D', border: '1px solid rgba(12,212,160,0.2)' }}
        />
      ))}
    </div>
  );
}

export default function ArenaMapScreen({ onSelectArena, onBack }: Props) {
  const ARENAS = useArenaNodes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Default to the furthest arena the player can actually enter, so the map
  // opens on their progress rather than always on the first regime.
  const selected =
    ARENAS.find(a => a.id === selectedId)
    ?? [...ARENAS].reverse().find(a => a.state !== 'locked')
    ?? ARENAS[0];
  const setSelected = (a: ArenaNode) => setSelectedId(a.id);

  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">
          REFI ALPHA // HISTORICAL REGIME NETWORK
        </div>
        <button onClick={onBack} className="font-mono text-xs text-phosphor-dim hover:text-phosphor transition-colors">
          [ESC] BACK
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Network map */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-lg space-y-0">
            {/* Main linear chain */}
            {ARENAS.map((arena, i) => (
              <div key={arena.id}>
                <div
                  className={`flex items-center gap-4 py-3 cursor-pointer group transition-all duration-150 ${
                    selected.id === arena.id ? 'opacity-100' : 'opacity-70 hover:opacity-90'
                  }`}
                  // A locked arena is selectable, only not enterable. The
                  // guard used to be on selection, which made clicking a locked
                  // regime do nothing at all and left the panel's own [ LOCKED ]
                  // branch unreachable. A player looking at the progression
                  // should be able to read what is ahead of them.
                  onClick={() => setSelected(arena)}
                >
                  <div className={`font-mono text-lg w-6 flex-shrink-0 ${NODE_CLASS[arena.state]}`}>
                    {NODE_SYMBOL[arena.state]}
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`font-mono text-xs text-phosphor-dim w-6`}>[{arena.code}]</div>
                    <div className={`font-mono text-sm tracking-wider ${
                      arena.state === 'active' ? 'text-phosphor-hot terminal-glow' :
                      arena.state === 'passed' ? 'text-phosphor' :
                      arena.state === 'locked' ? 'text-phosphor-dim' :
                      'text-phosphor-mid'
                    }`}>
                      {arena.label}
                    </div>
                  </div>
                  {/* Steady, not blinking. A blink is the strongest attention
                      signal on a screen, and it was pointing at a status label
                      rather than at the control the player is meant to press:
                      the eye went to the one thing that is not clickable.
                      Motion marks the action, never the state. */}
                  {arena.state === 'active' && (
                    <div className="font-mono text-xs text-phosphor">ACTIVE</div>
                  )}
                  {arena.state === 'locked' && (
                    <div className="font-mono text-xs text-phosphor-dim">LOCKED</div>
                  )}
                  {arena.state === 'passed' && (
                    <div className="font-mono text-xs text-phosphor">PASSED</div>
                  )}
                </div>

                {i < ARENAS.length - 1 && (
                  <div className="ml-3 pl-3 border-l border-phosphor/20 py-0.5">
                    <div className="font-mono text-phosphor-dim" style={{ fontSize: '10px' }}>│</div>
                  </div>
                )}

                {/* Side branch after banking stress */}
                {arena.code === '04' && (
                  <div className="ml-3 pl-3 border-l border-phosphor/20 pb-1">
                    <div className="font-mono text-phosphor-dim" style={{ fontSize: '10px' }}>├────────►</div>
                    <div className="flex flex-col gap-0 ml-6 mt-1">
                      {SIDE_ARENAS.map(side => (
                        <div key={side.code} className="flex items-center gap-3 py-1.5">
                          <div className={`font-mono text-sm w-4 node-locked`}>○</div>
                          <div className="font-mono text-xs text-phosphor-dim">[{side.code}]</div>
                          <div className="font-mono text-xs text-phosphor-dim">{side.label}</div>
                          {side.code === '09' && (
                            <div className="font-mono text-xs text-phosphor-dim border border-phosphor/20 px-1 ml-1">FINAL BOSS</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-12 terminal-panel p-4">
            <div className="font-mono text-xs text-phosphor-dim mb-3 tracking-widest">NODE STATES</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
              {[
                { sym: '○', label: 'LOCKED', cls: 'node-locked' },
                { sym: '◌', label: 'AVAILABLE', cls: 'node-available' },
                { sym: '●', label: 'ACTIVE', cls: 'node-active' },
                { sym: '✓', label: 'PASSED', cls: 'node-passed' },
                { sym: '★', label: 'MACHINE BEATEN', cls: 'node-machine-beaten' },
                { sym: '◆', label: 'PERFECT RISK', cls: 'text-paper-green' },
              ].map(item => (
                <div key={item.sym} className="flex items-center gap-2">
                  <span className={`${item.cls} text-base`}>{item.sym}</span>
                  <span className="text-phosphor-dim">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Arena detail */}
        <div className="w-80 lg:w-96 border-l border-phosphor/20 p-6 flex flex-col gap-4 overflow-y-auto">
          <div>
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-2">
              [{selected.code}] SELECTED
            </div>
            <div className="font-mono text-xl text-phosphor-hot terminal-glow tracking-wide">
              {selected.label}
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-2 border-b border-phosphor/10">
              <span className="text-phosphor-dim">STATUS</span>
              <span className={NODE_CLASS[selected.state as NodeState]}>{selected.state.toUpperCase().replace('-', ' ')}</span>
            </div>
            <div className="flex justify-between items-start py-2 border-b border-phosphor/10">
              <span className="text-phosphor-dim">DIFFICULTY</span>
              <DifficultyBar level={selected.difficulty} />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-phosphor/10">
              <span className="text-phosphor-dim">PLAYER PASS</span>
              <span className="text-phosphor">
                {selected.passPct ? `${selected.passPct}%` : 'CALIBRATING'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-phosphor/10">
              <span className="text-phosphor-dim">MACHINE</span>
              <span className="text-phosphor">{selected.machine}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-phosphor/10">
              <span className="text-phosphor-dim">DECISIONS</span>
              <span className="text-phosphor">{selected.decisions}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-phosphor/10">
              <span className="text-phosphor-dim">RISK LIMIT</span>
              <span className="text-phosphor">{selected.riskLimit}</span>
            </div>
          </div>

          <div className="terminal-panel-deep p-4">
            <div className="font-mono text-xs text-phosphor-dim mb-2">LESSON</div>
            <div className="font-mono text-xs text-phosphor leading-5">{selected.lesson}</div>
          </div>

          {/* Sticky to the bottom of this scrolling column. It previously sat
              after the briefing content inside an overflow-y-auto panel, so on
              a short viewport the primary action was below the scroll fold and
              had to be hunted for. */}
          <div className="mt-auto sticky bottom-0 -mx-6 -mb-6 px-6 pt-3 pb-24 bg-terminal-black border-t border-phosphor/15 space-y-2">
            {selected.state === 'active' || selected.state === 'available' ? (
              <button
                onClick={() => onSelectArena(selected.id)}
                className="cmd-button cmd-button-primary w-full tracking-widest"
              >
                [ ENTER ARENA ]
              </button>
            ) : (
              <div className="space-y-1">
                <button
                  disabled
                  className="cmd-button w-full tracking-widest opacity-40 cursor-not-allowed"
                >
                  [ LOCKED ]
                </button>
                <div className="font-mono text-xs text-phosphor-dim text-center leading-snug">
                  FINISH THE PREVIOUS ARENA TO UNLOCK THIS ONE.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="border-t border-phosphor/20 px-6 py-2 flex items-center gap-6">
        <span className="font-mono text-xs text-phosphor-dim">
          <span className="nav-key">F1</span> ARENAS &nbsp;
          <span className="nav-key">F7</span> PROFILE &nbsp;
          <span className="nav-key">F8</span> RECORDS &nbsp;
          <span className="nav-key">F9</span> LEADERBOARD
        </span>
      </div>
    </div>
  );
}
