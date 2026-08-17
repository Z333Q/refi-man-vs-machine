import type { ModuleCode } from '../../lib/gameTypes';

interface ModuleDef {
  code: ModuleCode;
  label: string;
  tier: number;
  unlockHint: string;
}

const MODULE_DEFS: ModuleDef[] = [
  { code: 'PRICE_RETURN',      label: 'PRICE RETURN',      tier: 0, unlockHint: 'BASE' },
  { code: 'PORTFOLIO_SUMMARY', label: 'PORTFOLIO SUMMARY', tier: 0, unlockHint: 'BASE' },
  { code: 'SECTOR_EXPOSURE',   label: 'SECTOR EXPOSURE',   tier: 0, unlockHint: 'BASE' },
  { code: 'NEWS_FEED',         label: 'NEWS FEED',         tier: 0, unlockHint: 'BASE' },
  { code: 'CORRELATION_MATRIX',label: 'CORRELATION MATRIX',tier: 1, unlockHint: 'COVID PH.2' },
  { code: 'DRAWDOWN_MAP',      label: 'DRAWDOWN MAP',      tier: 1, unlockHint: '1ST CRISIS' },
  { code: 'REGIME_SCANNER',    label: 'REGIME SCANNER',    tier: 2, unlockHint: 'RECOVERY' },
  { code: 'STAGED_EXECUTION',  label: 'STAGED EXECUTION',  tier: 2, unlockHint: '200 XP' },
  { code: 'BASKET_WRITER',     label: 'BASKET WRITER',     tier: 3, unlockHint: 'PROGRESSION' },
  { code: 'POLICY_WRITER',     label: 'POLICY WRITER',     tier: 3, unlockHint: 'BASKET' },
  { code: 'MACHINE_AUDIT',     label: 'MACHINE AUDIT',     tier: 4, unlockHint: 'LATE GAME' },
];

const TIER_LABELS = ['CORE', 'ANALYSIS', 'EXECUTION', 'BUILDER', 'AUDIT'];

interface Props {
  activeModules: ModuleCode[];
  justUnlocked?: ModuleCode | null;
  compact?: boolean;
}

export default function MachineEvolution({ activeModules, justUnlocked, compact = false }: Props) {
  const activeSet = new Set(activeModules);

  if (compact) {
    // The rack is 8px squares, which is fine as an at-a-glance density read and
    // useless as an unlock notification: the player is told a module arrived
    // and has no way to see which. The header carries the count and the newest
    // module's name so the unlock has somewhere to land.
    const newest = justUnlocked
      ? MODULE_DEFS.find(m => m.code === justUnlocked)
      : undefined;

    return (
      <div className="font-mono">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-phosphor-dim text-xs tracking-widest">MODULES</span>
          <span className="text-phosphor-dim text-xs tabular-nums">
            {activeModules.length}/{MODULE_DEFS.length}
          </span>
        </div>
        {newest && (
          <div className="text-paper-green text-xs tracking-widest mb-2 leading-snug">
            ▲ {newest.label}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {MODULE_DEFS.map(m => {
            const installed = activeSet.has(m.code);
            const isNew = justUnlocked === m.code;
            return (
              <div
                key={m.code}
                title={installed ? m.label : `${m.label} — unlock: ${m.unlockHint}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 1,
                  background: installed
                    ? isNew ? '#79FFD7' : '#0CD4A0'
                    : 'rgba(12,212,160,0.08)',
                  border: `1px solid ${installed ? (isNew ? '#79FFD7' : 'rgba(12,212,160,0.5)') : 'rgba(12,212,160,0.15)'}`,
                  animation: isNew ? 'constellationPulse 1s ease-in-out 3' : undefined,
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const tiers = [0, 1, 2, 3, 4];

  return (
    <div className="font-mono select-none">
      <div className="text-phosphor-dim text-xs tracking-widest mb-3">MACHINE EVOLUTION</div>

      <div className="space-y-3">
        {tiers.map(tier => {
          const tierModules = MODULE_DEFS.filter(m => m.tier === tier);
          const installedCount = tierModules.filter(m => activeSet.has(m.code)).length;

          return (
            <div key={tier}>
              {/* Tier label */}
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-xs tracking-widest"
                  style={{
                    color: installedCount > 0 ? 'rgba(12,212,160,0.5)' : 'rgba(12,212,160,0.2)',
                    fontSize: '9px',
                  }}
                >
                  T{tier} · {TIER_LABELS[tier]}
                </span>
                <div
                  className="flex-1 h-px"
                  style={{
                    background: installedCount > 0
                      ? 'rgba(12,212,160,0.15)'
                      : 'rgba(12,212,160,0.06)',
                  }}
                />
                <span style={{ fontSize: '9px', color: 'rgba(12,212,160,0.3)' }}>
                  {installedCount}/{tierModules.length}
                </span>
              </div>

              {/* Modules in this tier */}
              <div className="flex flex-wrap gap-1.5 ml-2">
                {tierModules.map(m => {
                  const installed = activeSet.has(m.code);
                  const isNew = justUnlocked === m.code;

                  return (
                    <div
                      key={m.code}
                      className="flex items-center gap-1.5 px-2 py-0.5 border"
                      style={{
                        borderColor: installed
                          ? isNew ? '#79FFD7' : 'rgba(12,212,160,0.4)'
                          : 'rgba(12,212,160,0.1)',
                        background: installed
                          ? isNew ? 'rgba(121,255,215,0.08)' : 'rgba(12,212,160,0.05)'
                          : 'transparent',
                        animation: isNew ? 'constellationPulse 0.8s ease-in-out 4' : undefined,
                      }}
                    >
                      {/* Installed indicator */}
                      <span
                        style={{
                          fontSize: '8px',
                          color: installed
                            ? isNew ? '#79FFD7' : '#0CD4A0'
                            : '#27634E',
                        }}
                      >
                        {installed ? '●' : '○'}
                      </span>

                      {/* Label */}
                      <span
                        style={{
                          fontSize: '9px',
                          letterSpacing: '0.06em',
                          color: installed
                            ? isNew ? '#79FFD7' : 'rgba(12,212,160,0.8)'
                            : 'rgba(12,212,160,0.25)',
                        }}
                      >
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall progress bar */}
      <div className="mt-3">
        <div className="flex justify-between mb-1">
          <span className="text-phosphor-dim" style={{ fontSize: '9px', letterSpacing: '0.06em' }}>
            MACHINE COMPLETENESS
          </span>
          <span className="text-phosphor-dim" style={{ fontSize: '9px' }}>
            {activeModules.length}/{MODULE_DEFS.length}
          </span>
        </div>
        <div className="h-0.5 bg-phosphor/10">
          <div
            className="h-full bg-phosphor/40 transition-all duration-700"
            style={{ width: `${(activeModules.length / MODULE_DEFS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
