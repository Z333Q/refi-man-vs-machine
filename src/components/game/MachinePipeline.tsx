import { useEffect, useState } from 'react';

interface Stage {
  id: string;
  label: string;
  sublabel: string;
}

// Stages mirror the actual ReFi RF/RL documented process:
// Universe → Fundamental Filter → Liquidity Filter → RF/RL per asset →
// Hourly Regime Classification → Portfolio Construction → Action
const STAGES: Stage[] = [
  { id: 'UNIVERSE',  label: 'UNIVERSE',  sublabel: 'U.S. LISTED EQUITIES' },
  { id: 'FUND',      label: 'FUND',      sublabel: 'FUNDAMENTAL FILTER' },
  { id: 'LIQ',       label: 'LIQ',       sublabel: 'LIQUIDITY FILTER' },
  { id: 'RF/RL',     label: 'RF/RL',     sublabel: 'PER-ASSET REGIME' },
  { id: 'PORTFOLIO', label: 'PORTFOLIO', sublabel: 'CROSS-SECTIONAL BUILD' },
  { id: 'ACTION',    label: 'ACTION',    sublabel: 'EMIT DECISION' },
];

interface Props {
  /** 0 = idle, 1-6 = stage illuminated, 6 = complete */
  activeStage?: number;
  animate?: boolean;
  /** If true, runs full animation sequence automatically */
  autoPlay?: boolean;
  autoPlayDurationMs?: number;
  reducedMotion?: boolean;
  onComplete?: () => void;
  compact?: boolean;
}

export default function MachinePipeline({
  activeStage = 0,
  animate = true,
  autoPlay = false,
  autoPlayDurationMs = 1800,
  reducedMotion = false,
  onComplete,
  compact = false,
}: Props) {
  const [lit, setLit] = useState<number>(reducedMotion && autoPlay ? STAGES.length : activeStage);

  useEffect(() => {
    if (!autoPlay) {
      setLit(activeStage);
      return;
    }

    if (reducedMotion) {
      setLit(STAGES.length);
      onComplete?.();
      return;
    }

    const stageDelay = autoPlayDurationMs / STAGES.length;
    let current = 0;

    const tick = () => {
      current += 1;
      setLit(current);
      if (current < STAGES.length) {
        timeoutId = setTimeout(tick, stageDelay);
      } else {
        onComplete?.();
      }
    };

    let timeoutId = setTimeout(tick, stageDelay * 0.5);
    return () => clearTimeout(timeoutId);
  }, [autoPlay, autoPlayDurationMs, activeStage, reducedMotion, onComplete]);

  if (compact) {
    return <CompactPipeline lit={lit} />;
  }

  return (
    <div className="font-mono select-none">
      <div className="text-phosphor-dim text-xs tracking-widest mb-3">
        MACHINE PROCESS
      </div>

      <div className="flex items-stretch gap-0">
        {STAGES.map((stage, idx) => {
          const stageNum = idx + 1;
          const isLit = stageNum <= lit;
          const isActive = stageNum === lit;
          const isDone = stageNum < lit;

          return (
            <div key={stage.id} className="flex items-stretch">
              {/* Stage block */}
              <div
                className="flex flex-col items-center"
                style={{ minWidth: compact ? 48 : 56 }}
              >
                {/* Stage box */}
                <div
                  className="relative px-2 py-1.5 border transition-all duration-300"
                  style={{
                    borderColor: isLit
                      ? isActive
                        ? 'rgba(121,255,215,0.8)'
                        : 'rgba(12,212,160,0.5)'
                      : 'rgba(12,212,160,0.12)',
                    background: isLit
                      ? isActive
                        ? 'rgba(121,255,215,0.08)'
                        : 'rgba(12,212,160,0.05)'
                      : 'transparent',
                    boxShadow: isActive && !reducedMotion
                      ? '0 0 8px rgba(121,255,215,0.2), 0 0 20px rgba(12,212,160,0.08)'
                      : 'none',
                  }}
                >
                  {/* Active pulse indicator */}
                  {isActive && !reducedMotion && (
                    <div
                      className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                      style={{
                        background: '#79FFD7',
                        animation: 'constellationPulse 1s ease-in-out infinite',
                      }}
                    />
                  )}

                  <div
                    className="text-xs font-bold tracking-widest"
                    style={{
                      color: isLit
                        ? isActive
                          ? '#79FFD7'
                          : '#0CD4A0'
                        : '#27634E',
                      transition: reducedMotion ? 'none' : 'color 300ms ease',
                    }}
                  >
                    {stage.label}
                  </div>

                  <div
                    className="text-xs mt-0.5 leading-none"
                    style={{
                      color: isLit
                        ? 'rgba(12,212,160,0.55)'
                        : 'rgba(12,212,160,0.15)',
                      fontSize: '9px',
                      letterSpacing: '0.04em',
                      transition: reducedMotion ? 'none' : 'color 300ms ease',
                    }}
                  >
                    {stage.sublabel}
                  </div>

                  {/* Done checkmark */}
                  {isDone && (
                    <div
                      className="absolute bottom-0.5 right-1 text-phosphor-dim"
                      style={{ fontSize: '8px' }}
                    >
                      ✓
                    </div>
                  )}
                </div>
              </div>

              {/* Connector arrow (not after last) */}
              {idx < STAGES.length - 1 && (
                <div className="flex items-center px-0.5">
                  <svg width="14" height="10" viewBox="0 0 14 10">
                    <line
                      x1="0"
                      y1="5"
                      x2="10"
                      y2="5"
                      stroke={
                        stageNum < lit
                          ? 'rgba(12,212,160,0.5)'
                          : 'rgba(12,212,160,0.12)'
                      }
                      strokeWidth="1"
                      strokeDasharray="3 2"
                      style={
                        stageNum < lit && !reducedMotion
                          ? { animation: 'pipelineFlow 800ms linear infinite' }
                          : undefined
                      }
                    />
                    <polygon
                      points="10,2 14,5 10,8"
                      fill={
                        stageNum < lit
                          ? 'rgba(12,212,160,0.45)'
                          : 'rgba(12,212,160,0.1)'
                      }
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage counter */}
      <div className="mt-2 text-phosphor-dim tracking-widest" style={{ fontSize: '9px' }}>
        {lit === 0
          ? 'STANDBY'
          : lit >= STAGES.length
            ? 'DECISION EMITTED'
            : `PROCESSING — ${STAGES[lit - 1]?.label}`}
      </div>
    </div>
  );
}

function CompactPipeline({ lit }: { lit: number }) {
  return (
    <div className="flex items-center gap-1 font-mono" style={{ fontSize: '9px' }}>
      {STAGES.map((stage, idx) => {
        const stageNum = idx + 1;
        const isLit = stageNum <= lit;
        return (
          <div key={stage.id} className="flex items-center gap-1">
            <span
              style={{
                color: isLit ? '#0CD4A0' : '#27634E',
                letterSpacing: '0.06em',
              }}
            >
              {stage.label}
            </span>
            {idx < STAGES.length - 1 && (
              <span style={{ color: isLit ? 'rgba(12,212,160,0.4)' : 'rgba(12,212,160,0.1)' }}>
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
