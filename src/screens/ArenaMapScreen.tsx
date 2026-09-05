import ActionZone from '../components/ui/ActionZone';
import { useMemo, useState } from 'react';
import type { ArenaId } from '../lib/gameTypes';
import { allArenas } from '../lib/arenas';
import { listRunRecords } from '../lib/runRecord';
import { nextArenaOpen } from '../lib/progressionLaw';

interface Props {
  onSelectArena: (arena: ArenaId) => void;
  onBack: () => void;
}

// Three states a player can act on: LOCKED (cannot enter), NEXT (can enter),
// DONE (completed, win or lose). Machine-beaten is a mark on DONE, not a
// fourth state (owner ruling 2026-09-05). The legend that explained six
// symbols is gone; three self-evident symbols do not need one.
type NodeState = 'locked' | 'next' | 'done';

interface ArenaNode {
  id: ArenaId;
  code: string;
  label: string;
  state: NodeState;
  beaten: boolean;
  difficulty: number;
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

      // Progression law (owner ruling 2026-08-25): arenas chain on
      // completion, win or lose. Derived through progressionLaw so the map
      // and every other surface read the same rule.
      const prev = arenas[i - 1];
      const prevDone = nextArenaOpen(records, prev ? prev.id : null);

      const state: NodeState = passed ? 'done' : prevDone ? 'next' : 'locked';

      return {
        id: a.id,
        code: String(a.order).padStart(2, '0'),
        label: a.name,
        state,
        beaten,
        difficulty: a.difficulty,
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
  next: '●',
  done: '✓',
};

const NODE_CLASS: Record<NodeState, string> = {
  locked: 'node-locked',
  next: 'node-active',
  done: 'node-passed',
};

const NODE_LABEL: Record<NodeState, string> = {
  locked: 'LOCKED',
  next: 'NEXT',
  done: 'DONE',
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
  const isSelectable = selected.state === 'next';

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

      {/* Two columns from md up; stacked and scrolling as one below it. At
          phone width the side-by-side layout crushed the arena list into a
          150pt column that clipped every name. */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        {/* Left: Network map */}
        <div className="md:flex-1 p-6 md:p-8 md:overflow-y-auto">
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
                      arena.state === 'next' ? 'text-phosphor-hot terminal-glow' :
                      arena.state === 'done' ? 'text-phosphor' :
                      'text-phosphor-dim'
                    }`}>
                      {arena.label}
                    </div>
                  </div>
                  {/* Steady, not blinking: motion marks the action, never the
                      state. Machine-beaten rides on DONE as a mark. */}
                  <div className={`font-mono text-xs ${arena.state === 'locked' ? 'text-phosphor-dim' : 'text-phosphor'}`}>
                    {arena.beaten && <span className="node-machine-beaten mr-2">★ MACHINE BEATEN</span>}
                    {NODE_LABEL[arena.state]}
                  </div>
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

        </div>

        {/* Right: the selected arena, in the order a player reads it before
            committing: what and when, what it teaches, how long, the loss
            limit, who they face. Then the door. PLAYER PASS · CALIBRATING is
            gone: a status with no decision consequence is noise. */}
        <div className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-phosphor/20 p-6 flex flex-col gap-4 md:overflow-y-auto">
          <div>
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-2 flex justify-between">
              <span>[{selected.code}] SELECTED</span>
              <span className={NODE_CLASS[selected.state]}>
                {selected.beaten ? '★ ' : ''}{NODE_LABEL[selected.state]}
              </span>
            </div>
            <div className="font-mono text-xl text-phosphor-hot terminal-glow tracking-wide">
              {selected.label}
            </div>
            <div className="font-mono text-xs text-phosphor-dim mt-1 tracking-widest">{selected.window}</div>
          </div>

          <div className="terminal-panel-deep p-4">
            <div className="font-mono text-xs text-phosphor-dim mb-2">WHAT THIS ARENA TEACHES</div>
            <div className="font-mono text-xs text-phosphor leading-5">{selected.lesson}</div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-2 border-b border-phosphor/10">
              <span className="text-phosphor-dim">DECISIONS</span>
              <span className="text-phosphor">{selected.decisions}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-phosphor/10">
              <span className="text-phosphor-dim">CRITICAL LOSS LIMIT</span>
              <span className="text-phosphor">{selected.riskLimit}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-phosphor/10">
              <span className="text-phosphor-dim">MACHINE</span>
              <span className="text-phosphor">{selected.machine}</span>
            </div>
            <div className="flex justify-between items-start py-2 border-b border-phosphor/10">
              <span className="text-phosphor-dim">DIFFICULTY</span>
              <DifficultyBar level={selected.difficulty} />
            </div>
          </div>

        </div>
      </div>

      {/* No function-key strip. F1/F7/F8/F9 were printed here for screens
          nothing bound them to; a visible shortcut either works or is not
          shown (owner ruling 2026-09-05). The map's one door is the ActionZone. */}

      {/* The arena you select is the decision; entering it is the commit. This
          generalises the ad-hoc sticky block the screen carried (#26): the
          primary action now occupies the same territory as every other screen,
          and the locked state stays visible instead of hiding the way forward. */}
      <ActionZone
        note={`SELECTED: ${selected.code} ${selected.label}`}
        primary={{
          label: isSelectable ? 'ENTER ARENA' : 'LOCKED',
          onClick: () => onSelectArena(selected.id),
          disabled: !isSelectable,
          disabledHint: 'FINISH THE PREVIOUS ARENA TO UNLOCK THIS ONE',
          keyHint: '[ENTER]',
        }}
      />
    </div>
  );
}
