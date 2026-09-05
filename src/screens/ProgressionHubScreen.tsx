import { useMemo } from 'react';
import ActionZone, { SecondaryAction } from '../components/ui/ActionZone';
import { useGame } from '../context/GameContext';
import { TERMINAL_MODULES, getRankLabel, getXpToNextRank, currentOpponent } from '../lib/progressionEngine';
import { allArenas } from '../lib/arenas';
import { listRunRecords } from '../lib/runRecord';
import { arenaCompleted, builderUnlocked, nextArenaOpen, BUILDER_UNLOCK_REQUIREMENT } from '../lib/progressionLaw';

interface Props {
  onStartRun: () => void;
  onDailyTape: () => void;
  onMachineLadder: () => void;
  onMachineBuilder: () => void;
  onBack: () => void;
}

// The Hub answers one question first: what should I do next? (owner ruling
// 2026-09-05). It used to open on seven panels of profile analytics, the
// full ladder and the module inventory, and the answer sat under all of them.
// What was removed lives where it already lived: the ten decision dimensions
// and the session record are on the Alpha Profile, the ladder has its own
// screen, and a module is acknowledged here only in the moment it unlocks.
// No panel or route was added.

export default function ProgressionHubScreen({ onStartRun, onDailyTape, onMachineLadder, onMachineBuilder, onBack }: Props) {
  const { state } = useGame();
  const { profile, moduleJustUnlocked } = state;

  const records = useMemo(() => listRunRecords(), []);

  // Builder gate (owner ruling 2026-08-25): visible from the start so the
  // progression is legible, unlocked by Bronze. Locked, it is one line that
  // states its requirement; it does not get a playable challenge's weight.
  const builderOpen = useMemo(() => builderUnlocked(records), [records]);

  // The next arena, by the same law the map uses: the first regime not yet
  // completed whose predecessor is.
  const nextArena = useMemo(() => {
    const arenas = allArenas();
    return arenas.find((a, i) => {
      const prev = arenas[i - 1];
      return !arenaCompleted(records, a.id) && nextArenaOpen(records, prev ? prev.id : null);
    }) ?? null;
  }, [records]);

  const rankLabel = getRankLabel(profile.rankCode);
  const xpProgress = getXpToNextRank(profile.alphaXp);
  const xpPct = xpProgress
    ? Math.round(((profile.alphaXp - xpProgress.current) / (xpProgress.next - xpProgress.current)) * 100)
    : 100;

  // The opponent shown is one the player can actually face: playable and
  // ACTIVE, else playable and DEFEATED (the rematch). Never a rung whose
  // runtime does not exist, however ACTIVE its status is.
  const currentMachineOpponent = currentOpponent(profile.machineLadder);

  const justUnlocked = moduleJustUnlocked
    ? TERMINAL_MODULES.find(m => m.code === moduleJustUnlocked) ?? null
    : null;

  return (
    <div className="min-h-screen bg-terminal-black terminal-screen font-mono flex flex-col">
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

        {/* Header: who, and rank + XP on one line. */}
        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0">
            <div className="text-phosphor-dim text-xs tracking-widest mb-1">ALPHA PROFILE</div>
            <div className="text-phosphor text-xl font-bold truncate">
              {profile.handle ?? profile.sessionId.slice(0, 12).toUpperCase()}
            </div>
            <div className="text-phosphor-mid text-xs mt-1 tracking-widest tabular-nums">
              {rankLabel} · {profile.alphaXp} XP
              {xpProgress && (
                <span className="text-phosphor-dim"> · {xpProgress.next - profile.alphaXp} TO {xpProgress.label}</span>
              )}
            </div>
            {xpProgress && (
              <div className="h-1 bg-phosphor/15 w-48 mt-2" role="meter" aria-label="PROGRESS TO NEXT RANK"
                   aria-valuenow={Math.min(100, xpPct)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-phosphor transition-all duration-700" style={{ width: `${Math.min(100, xpPct)}%` }} />
              </div>
            )}
          </div>
          <button
            onClick={onBack}
            className="text-phosphor-dim text-xs hover:text-phosphor transition-colors tracking-widest flex-shrink-0"
          >
            ← BACK
          </button>
        </div>

        <div className="space-y-4">

          {/* Next challenge: the arena and the opponent, together. */}
          <div className="terminal-panel-deep p-5">
            <div className="flex justify-between items-baseline mb-3">
              <div className="text-phosphor-dim text-xs tracking-widest">NEXT CHALLENGE</div>
              {nextArena && (
                <div className="text-phosphor-dim text-xs tabular-nums">
                  {nextArena.checkpoints.length} DECISIONS · {nextArena.window}
                </div>
              )}
            </div>
            {nextArena ? (
              <div className="text-phosphor-hot text-lg font-bold tracking-wide terminal-glow">{nextArena.name}</div>
            ) : (
              <div className="text-phosphor text-lg font-bold tracking-wide">EVERY REGIME COMPLETE</div>
            )}
            {nextArena && (
              <div className="text-phosphor-dim text-xs mt-1 leading-relaxed">{nextArena.lesson.toUpperCase()}</div>
            )}

            {currentMachineOpponent && (
              <div className="mt-4 pt-3 border-t border-phosphor/15">
                <div className="text-phosphor-dim text-xs tracking-widest mb-1">CURRENT OPPONENT</div>
                <div className="text-phosphor text-sm font-bold">{currentMachineOpponent.label}</div>
                <div className="text-phosphor-dim text-xs mt-0.5">{currentMachineOpponent.subtitle}</div>
                <div className="text-phosphor-dim text-xs italic border-l border-phosphor/15 pl-2 mt-2">
                  "{currentMachineOpponent.message}"
                </div>
              </div>
            )}
          </div>

          {/* A module is acknowledged in the moment it unlocks, then it is a
              tab in the run, not an inventory on the Hub. */}
          {justUnlocked && (
            <div className="terminal-panel p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-phosphor-dim text-xs tracking-widest">MODULE UNLOCKED</div>
                <div className="text-paper-green text-sm font-bold mt-0.5">[{justUnlocked.key}] {justUnlocked.label}</div>
              </div>
              <div className="text-phosphor-dim text-xs">OPENS AS A PANEL IN YOUR NEXT RUN</div>
            </div>
          )}

          {/* Machine Builder: the central progression system (Sec 17), so its
              door lives here. Open, it is a door. Locked, it is one line. */}
          {builderOpen ? (
            <div className="terminal-panel p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="text-phosphor-dim text-xs tracking-widest">MACHINE BUILDER</div>
                <span className="text-xs text-phosphor">◉ UNLOCKED</span>
              </div>
              <div className="text-phosphor-dim text-xs mb-3">
                YOU HAVE SEEN THE GAP. NOW BUILD THE PROCESS.
              </div>
              <button
                onClick={onMachineBuilder}
                className="w-full border border-phosphor/40 text-phosphor text-xs font-mono tracking-widest py-2.5 hover:bg-phosphor/10 transition-colors"
              >
                OPEN MACHINE BUILDER →
              </button>
            </div>
          ) : (
            <div className="border border-phosphor/10 px-4 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
              <span className="text-phosphor-dim tracking-widest">MACHINE BUILDER</span>
              <span className="text-phosphor-dim">○ LOCKED</span>
              <span className="text-alert-amber">{BUILDER_UNLOCK_REQUIREMENT}</span>
            </div>
          )}
        </div>
      </div>

      <ActionZone
        note={nextArena ? `NEXT: ${nextArena.name}` : currentMachineOpponent ? `NEXT OPPONENT: ${currentMachineOpponent.label}` : undefined}
        primary={{ label: 'START ARENA RUN', onClick: onStartRun, keyHint: '[ENTER]' }}
        secondaryLeft={<SecondaryAction label="Daily tape" onClick={onDailyTape} />}
        secondaryRight={<SecondaryAction label="Machine ladder" onClick={onMachineLadder} />}
      />
    </div>
  );
}
