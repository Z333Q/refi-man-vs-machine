import ActionZone, { SecondaryAction } from '../components/ui/ActionZone';
import { useGame } from '../context/GameContext';
import { TERMINAL_MODULES, MACHINE_LADDER, getRankLabel, getXpToNextRank } from '../lib/progressionEngine';
import { getArchetypeLabel } from '../lib/scoringEngine';

interface Props {
  onStartRun: () => void;
  onDailyTape: () => void;
  onMachineLadder: () => void;
  onBack: () => void;
}

const DIMENSION_LABELS: Record<string, string> = {
  STOCK_SELECTION: 'STOCK SELECTION',
  POSITION_SIZING: 'POSITION SIZING',
  LOSS_CONTROL: 'LOSS CONTROL',
  REENTRY_DISCIPLINE: 'RE-ENTRY DISCIPLINE',
  TURNOVER_DISCIPLINE: 'TURNOVER DISCIPLINE',
  REGIME_ADAPTATION: 'REGIME ADAPTATION',
  RULE_ADHERENCE: 'RULE ADHERENCE',
  ACTION_BIAS_SCORE: 'ACTION BIAS',
  CONCENTRATION_CONTROL: 'CONCENTRATION CTRL',
  DECISION_CONSISTENCY: 'CONSISTENCY',
};

function ScoreBar({ score, sampleSize }: { score: number; sampleSize: number }) {
  const filled = Math.round(score / 10);
  const isEmpty = sampleSize === 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2 transition-colors ${
              isEmpty ? 'bg-phosphor/10' :
              i < filled ? 'bg-phosphor' : 'bg-phosphor/15'
            }`}
          />
        ))}
      </div>
      <span className={`text-xs tabular-nums ${isEmpty ? 'text-phosphor-dim' : 'text-phosphor'}`}>
        {isEmpty ? '--' : score}
      </span>
    </div>
  );
}

export default function ProgressionHubScreen({ onStartRun, onDailyTape, onMachineLadder, onBack }: Props) {
  const { state } = useGame();
  const { profile } = state;

  const rankLabel = getRankLabel(profile.rankCode);
  const xpProgress = getXpToNextRank(profile.alphaXp);
  const xpPct = xpProgress
    ? Math.round(((profile.alphaXp - (xpProgress.current)) / (xpProgress.next - (xpProgress.current))) * 100)
    : 100;

  const unlockedCount = TERMINAL_MODULES.filter(
    m => m.alwaysAvailable || profile.unlockedModules.includes(m.code)
  ).length;

  const currentMachineOpponent = MACHINE_LADDER.find(m =>
    profile.machineLadder[m.id]?.status === 'ACTIVE'
  );

  const archetypeLabel = getArchetypeLabel(profile.archetype);

  return (
    <div className="min-h-screen bg-terminal-black terminal-screen font-mono flex flex-col">
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pr-16 sm:pr-0">
          <div>
            <div className="text-phosphor-dim text-xs tracking-widest mb-1">ALPHA PROFILE</div>
            <div className="text-phosphor text-xl font-bold">
              {profile.handle ?? profile.sessionId.slice(0, 12).toUpperCase()}
            </div>
            <div className="text-phosphor-mid text-xs mt-1 tracking-widest">{rankLabel}</div>
          </div>
          <button
            onClick={onBack}
            className="text-phosphor-dim text-xs hover:text-phosphor transition-colors tracking-widest flex-shrink-0"
          >
            ← BACK
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column */}
          <div className="col-span-2 space-y-5">

            {/* XP + Rank */}
            <div className="terminal-panel p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-phosphor-dim text-xs tracking-widest mb-1">ALPHA XP</div>
                  <div className="text-phosphor text-3xl font-bold">{profile.alphaXp}</div>
                </div>
                <div className="text-right">
                  <div className="text-phosphor-dim text-xs tracking-widest mb-1">RANK</div>
                  <div className="text-phosphor text-sm font-bold">{rankLabel}</div>
                  {xpProgress && (
                    <div className="text-phosphor-dim text-xs mt-0.5">
                      → {xpProgress.label} at {xpProgress.next} XP
                    </div>
                  )}
                </div>
              </div>

              {xpProgress && (
                <div>
                  <div className="h-1.5 bg-phosphor/15 w-full">
                    <div
                      className="h-full bg-phosphor transition-all duration-700"
                      style={{ width: `${Math.min(100, xpPct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-phosphor-dim mt-1">
                    <span>{profile.alphaXp} XP</span>
                    <span>{xpProgress.next} XP</span>
                  </div>
                </div>
              )}
            </div>

            {/* Alpha dimensions */}
            <div className="terminal-panel p-5">
              <div className="flex justify-between items-center mb-4">
                <div className="text-phosphor-dim text-xs tracking-widest">DECISION DIMENSIONS</div>
                <div className="text-phosphor-dim text-xs">{archetypeLabel}</div>
              </div>

              <div className="space-y-3">
                {Object.entries(profile.dimensions).map(([code, { score, sampleSize }]) => (
                  <div key={code} className="flex items-center justify-between gap-4">
                    <div className="text-phosphor-dim text-xs w-40 flex-shrink-0">
                      {DIMENSION_LABELS[code] ?? code}
                    </div>
                    <ScoreBar score={score} sampleSize={sampleSize} />
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-phosphor/10 pt-3 text-phosphor-dim text-xs">
                DIMENSIONS UPDATE AS YOU MAKE DECISIONS.
                {Object.values(profile.dimensions).every(d => d.sampleSize === 0) && (
                  <span className="text-alert-amber ml-1">START A RUN TO SEE YOUR PROFILE.</span>
                )}
              </div>
            </div>

            {/* Machine ladder summary */}
            <div className="terminal-panel p-5">
              <div className="flex justify-between items-center mb-4">
                <div className="text-phosphor-dim text-xs tracking-widest">MACHINE LADDER</div>
                <button
                  onClick={onMachineLadder}
                  className="text-phosphor-dim text-xs hover:text-phosphor transition-colors"
                >
                  VIEW ALL →
                </button>
              </div>

              <div className="space-y-2">
                {MACHINE_LADDER.map(m => {
                  const entry = profile.machineLadder[m.id];
                  const status = entry?.status ?? 'LOCKED';
                  return (
                    <div key={m.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={
                          status === 'DEFEATED' ? 'text-paper-green' :
                          status === 'ACTIVE' ? 'text-phosphor' :
                          'text-phosphor-dim'
                        }>
                          {status === 'DEFEATED' ? '✓' : status === 'ACTIVE' ? '◉' : '○'}
                        </span>
                        <span className={
                          status === 'DEFEATED' ? 'text-paper-green' :
                          status === 'ACTIVE' ? 'text-phosphor' :
                          'text-phosphor-dim'
                        }>{m.label}</span>
                      </div>
                      <div className="text-phosphor-dim">
                        {status === 'LOCKED' ? `${m.xpRequired} XP` :
                         status === 'DEFEATED' ? `${entry?.wins}W ${entry?.losses}L` :
                         'ACTIVE'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">

            {/* Current opponent */}
            {currentMachineOpponent && (
              <div className="terminal-panel-deep p-4">
                <div className="text-phosphor-dim text-xs tracking-widest mb-2">CURRENT OPPONENT</div>
                <div className="text-phosphor text-sm font-bold">{currentMachineOpponent.label}</div>
                <div className="text-phosphor-dim text-xs mt-1 mb-3">{currentMachineOpponent.subtitle}</div>
                <div className="text-phosphor-dim text-xs italic border-l border-phosphor/15 pl-2">
                  "{currentMachineOpponent.message}"
                </div>
              </div>
            )}

            {/* Terminal modules */}
            <div className="terminal-panel p-4">
              <div className="text-phosphor-dim text-xs tracking-widest mb-3">
                TERMINAL MODULES · {unlockedCount}/{TERMINAL_MODULES.length}
              </div>
              <div className="space-y-2">
                {TERMINAL_MODULES.map(m => {
                  const unlocked = m.alwaysAvailable || profile.unlockedModules.includes(m.code);
                  return (
                    <div key={m.code} className={`flex items-center justify-between text-xs ${
                      unlocked ? '' : 'opacity-40'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={unlocked ? 'text-paper-green' : 'text-phosphor-dim'}>
                          {unlocked ? '●' : '○'}
                        </span>
                        <span className={unlocked ? 'text-phosphor' : 'text-phosphor-dim'}>
                          [{m.key}] {m.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Session stats */}
            <div className="terminal-panel p-4">
              <div className="text-phosphor-dim text-xs tracking-widest mb-3">SESSION STATS</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-phosphor-dim">ARCHETYPE</span>
                  <span className="text-phosphor">{archetypeLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-phosphor-dim">BEST STREAK</span>
                  <span className="text-phosphor">{profile.bestStreak}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-phosphor-dim">MACHINES BEATEN</span>
                  <span className={profile.machineBeats > 0 ? 'text-paper-green' : 'text-phosphor-dim'}>
                    {profile.machineBeats}
                  </span>
                </div>
                {profile.lastActiveDate && (
                  <div className="flex justify-between">
                    <span className="text-phosphor-dim">LAST ACTIVE</span>
                    <span className="text-phosphor-dim">{profile.lastActiveDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ActionZone
        note={currentMachineOpponent ? `NEXT OPPONENT: ${currentMachineOpponent.label}` : undefined}
        primary={{ label: 'START ARENA RUN', onClick: onStartRun, keyHint: '[ENTER]' }}
        secondaryLeft={<SecondaryAction label="Daily tape" onClick={onDailyTape} />}
        secondaryRight={<SecondaryAction label="Machine ladder" onClick={onMachineLadder} />}
      />
    </div>
  );
}
