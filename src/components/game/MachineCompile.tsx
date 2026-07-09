import { useEffect, useRef, useState } from 'react';

interface CompileCheck {
  label: string;
  detail?: string;
}

const DEFAULT_CHECKS: CompileCheck[] = [
  { label: 'UNIVERSE', detail: 'U.S. LISTED EQUITIES' },
  { label: 'ELIGIBILITY FILTER', detail: 'FUNDAMENTAL + LIQUIDITY' },
  { label: 'SIGNAL LOGIC', detail: 'REGIME CLASSIFIER' },
  { label: 'PORTFOLIO CONSTRUCTION', detail: 'CROSS-SECTIONAL WEIGHT' },
  { label: 'POSITION LIMIT', detail: 'MAX 10% SINGLE NAME' },
  { label: 'SECTOR LIMIT', detail: 'MAX 25% SECTOR' },
  { label: 'CORRELATION GUARD', detail: 'ρ < 0.85 REQUIRED' },
  { label: 'REBALANCE RULE', detail: 'DRIFT THRESHOLD' },
  { label: 'PAUSE LOGIC', detail: 'DRAWDOWN GATE' },
  { label: 'RE-ENTRY LOGIC', detail: 'STAGED DEPLOYMENT' },
];

function buildHash(version: string): string {
  // Deterministic-looking hash from version string
  let h = 0;
  for (const c of version) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  const hex = Math.abs(h).toString(16).toUpperCase().padStart(8, '0');
  return `${hex.slice(0, 4)}:${hex.slice(4, 8)}:${(h >>> 16).toString(16).toUpperCase().padStart(4, '0')}`;
}

interface Props {
  machineName?: string;
  version?: string;
  checks?: CompileCheck[];
  /** ms per check line */
  checkIntervalMs?: number;
  reducedMotion?: boolean;
  onComplete?: () => void;
}

export default function MachineCompile({
  machineName = 'PLAYER MACHINE',
  version = 'v0.1',
  checks = DEFAULT_CHECKS,
  checkIntervalMs = 180,
  reducedMotion = false,
  onComplete,
}: Props) {
  const [revealed, setRevealed] = useState<number>(reducedMotion ? checks.length : 0);
  const [done, setDone] = useState(reducedMotion);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (reducedMotion) {
      onComplete?.();
      return;
    }

    let count = 0;
    const tick = () => {
      count += 1;
      setRevealed(count);
      if (count < checks.length) {
        timerRef.current = setTimeout(tick, checkIntervalMs);
      } else {
        timerRef.current = setTimeout(() => {
          setDone(true);
          onComplete?.();
        }, 400);
      }
    };
    timerRef.current = setTimeout(tick, 200);
    return () => clearTimeout(timerRef.current);
  }, [checks.length, checkIntervalMs, reducedMotion, onComplete]);

  const hash = buildHash(`${machineName}-${version}`);
  const dotPad = (label: string, total = 30) =>
    label + '.'.repeat(Math.max(1, total - label.length));

  return (
    <div
      className="font-mono select-none"
      aria-live="polite"
      aria-label={`Compiling ${machineName} ${version}`}
    >
      {/* Header */}
      <div className="text-phosphor text-sm font-bold tracking-widest mb-4">
        COMPILING {machineName} {version}
      </div>

      {/* Check lines */}
      <div className="space-y-0.5 mb-4">
        {checks.map((check, i) => {
          const isVisible = i < revealed;
          const isActive = i === revealed - 1 && !done;
          return (
            <div
              key={check.label}
              className="flex items-center text-xs transition-opacity duration-150"
              style={{ opacity: isVisible ? 1 : 0 }}
            >
              <span
                className="flex-1"
                style={{
                  color: isActive ? 'rgba(12,212,160,0.6)' : 'rgba(12,212,160,0.35)',
                  letterSpacing: '0.04em',
                }}
              >
                {dotPad(check.label)}
              </span>
              <span
                className={`ml-2 font-bold tracking-widest ${
                  isActive ? 'text-phosphor animate-pulse' : 'text-paper-green'
                }`}
              >
                {isActive ? '...' : 'PASS'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Build hash + status */}
      <div
        className="border-t border-phosphor/15 pt-3 space-y-1.5 transition-opacity duration-500"
        style={{ opacity: done ? 1 : 0 }}
      >
        <div className="text-phosphor-dim text-xs tracking-widest">BUILD HASH</div>
        <div className="text-phosphor text-sm font-bold tracking-widest">{hash}</div>

        <div className="mt-2">
          <div className="text-phosphor-dim text-xs tracking-widest mb-1">STATUS</div>
          <div
            className="text-paper-green font-bold tracking-widest text-sm"
            style={{
              animation: done ? 'constellationPulse 1.2s ease-in-out 3' : undefined,
            }}
          >
            READY FOR STRESS TEST
          </div>
        </div>
      </div>
    </div>
  );
}
