import { useState } from 'react';
import ActionZone from '../components/ui/ActionZone';

interface Props {
  onSelectArena: (arena: string) => void;
  onBack: () => void;
}

type NodeState = 'locked' | 'available' | 'active' | 'passed' | 'machine-beaten';

interface ArenaNode {
  id: string;
  code: string;
  label: string;
  state: NodeState;
  difficulty: number;
  passPct: string | null;
  machine: string;
  decisions: number;
  riskLimit: string;
  lesson: string;
  icon: string;
}

const ARENAS: ArenaNode[] = [
  {
    id: 'tutorial',
    code: '00',
    label: 'TUTORIAL',
    state: 'passed',
    difficulty: 3,
    passPct: '84.2',
    machine: 'REFI RULES v1.0',
    decisions: 3,
    riskLimit: '-15% DD',
    lesson: 'DECISIONS HAVE CONSEQUENCES.',
    icon: '/\\',
  },
  {
    id: 'covid',
    code: '01',
    label: 'COVID BLACK SWAN',
    state: 'active',
    difficulty: 7,
    passPct: '18.4',
    machine: 'REFI CRISIS v1.4',
    decisions: 22,
    riskLimit: '-20% DD',
    lesson: 'PANIC IS NOT A RISK MODEL.',
    icon: '~~~',
  },
  {
    id: 'recovery',
    code: '02',
    label: 'RECOVERY TRAP',
    state: 'locked',
    difficulty: 6,
    passPct: null,
    machine: 'REFI CRISIS v1.4',
    decisions: 18,
    riskLimit: '-18% DD',
    lesson: 'RECOVERY IS NOT UNIFORM.',
    icon: '/^\\',
  },
  {
    id: 'inflation',
    code: '03',
    label: 'INFLATION SHIFT',
    state: 'locked',
    difficulty: 7,
    passPct: null,
    machine: 'REFI ALPHA v2.1',
    decisions: 20,
    riskLimit: '-18% DD',
    lesson: 'REGIME CHANGE ARRIVES SLOWLY THEN ALL AT ONCE.',
    icon: '$$$',
  },
  {
    id: 'banking',
    code: '04',
    label: 'BANKING STRESS',
    state: 'locked',
    difficulty: 8,
    passPct: null,
    machine: 'REFI ENSEMBLE v1.0',
    decisions: 16,
    riskLimit: '-15% DD',
    lesson: 'CONTAGION IS NON-LINEAR.',
    icon: '|||',
  },
];

const SIDE_ARENAS = [
  { code: '05', label: 'MAN VS MACHINE', state: 'locked' as NodeState },
  { code: '06', label: 'BASKET WRITER', state: 'locked' as NodeState },
  { code: '07', label: 'POLICY WRITER', state: 'locked' as NodeState },
  { code: '08', label: 'BLIND GAUNTLET', state: 'locked' as NodeState },
  { code: '09', label: 'TACO PROTOCOL', state: 'locked' as NodeState },
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
  const [selected, setSelected] = useState<ArenaNode>(ARENAS[1]);
  const isSelectable = selected.state === 'active' || selected.state === 'available';

  return (
    <div className="terminal-screen screen-fit flex flex-col">
      {/* Header */}
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between pr-16 sm:pr-6">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">
          REFI ALPHA // HISTORICAL REGIME NETWORK
        </div>
        <button onClick={onBack} className="font-mono text-xs text-phosphor-dim hover:text-phosphor transition-colors">
          [ESC] BACK
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Network map */}
        <div className="hidden md:block flex-1 p-8 overflow-y-auto">
          <div className="max-w-lg space-y-0">
            {/* Main linear chain */}
            {ARENAS.map((arena, i) => (
              <div key={arena.id}>
                <div
                  className={`flex items-center gap-4 py-3 cursor-pointer group transition-all duration-150 ${
                    selected.id === arena.id ? 'opacity-100' : 'opacity-70 hover:opacity-90'
                  }`}
                  onClick={() => arena.state !== 'locked' && setSelected(arena)}
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
                  {arena.state === 'active' && (
                    <div className="font-mono text-xs text-phosphor animate-[cursorBlink_1s_steps(1,end)_infinite]">
                      ACTIVE
                    </div>
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
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
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
        <div className="flex-1 md:flex-none w-full md:w-80 lg:w-96 md:border-l border-phosphor/20 p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto">
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

        </div>
      </div>

      {/* The arena selection above is the decision; entering it is the commit.
          Locked arenas keep the button in place and say why. */}
      <ActionZone
        note={`SELECTED: ${selected.code} ${selected.label}`}
        primary={{
          label: isSelectable ? 'ENTER ARENA' : 'LOCKED',
          onClick: () => onSelectArena(selected.id),
          disabled: !isSelectable,
          disabledHint: 'CLEAR THE PRECEDING ARENA TO UNLOCK',
          keyHint: '[ENTER]',
        }}
      />
    </div>
  );
}
