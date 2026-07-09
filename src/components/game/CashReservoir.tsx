import { useEffect, useRef, useState } from 'react';

interface FlowTarget {
  symbol: string;
  direction: 'IN' | 'OUT'; // IN = cash → equity, OUT = equity → cash
}

interface Props {
  cashWeight: number;        // 0-1
  prevCashWeight?: number;   // if set, animates from prev to current
  flowTargets?: FlowTarget[];
  reducedMotion?: boolean;
  animDurationMs?: number;
  label?: string;
}

const FILL_CHAR = '█';
const EMPTY_CHAR = '░';
const BAR_WIDTH = 20;

function buildBar(pct: number): string {
  const filled = Math.round(pct * BAR_WIDTH);
  return FILL_CHAR.repeat(filled) + EMPTY_CHAR.repeat(BAR_WIDTH - filled);
}

export default function CashReservoir({
  cashWeight,
  prevCashWeight,
  flowTargets = [],
  reducedMotion = false,
  animDurationMs = 600,
  label = 'CASH RESERVE',
}: Props) {
  const [displayWeight, setDisplayWeight] = useState(
    reducedMotion ? cashWeight : (prevCashWeight ?? cashWeight),
  );
  const [showFlow, setShowFlow] = useState(false);
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const from = prevCashWeight ?? cashWeight;
  const to = cashWeight;
  const hasChange = Math.abs(to - from) > 0.005;

  useEffect(() => {
    if (reducedMotion || !hasChange) {
      setDisplayWeight(to);
      return;
    }

    startRef.current = performance.now();
    setShowFlow(true);

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / animDurationMs);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplayWeight(from + (to - from) * ease);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayWeight(to);
        setShowFlow(false);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameRef.current);
      setShowFlow(false);
    };
  }, [cashWeight, from, to, hasChange, reducedMotion, animDurationMs]);

  const pct = Math.max(0, Math.min(1, displayWeight));
  const pctPrev = Math.max(0, Math.min(1, from));
  const isRaising = to > from;

  return (
    <div className="font-mono select-none">
      {/* Label */}
      <div className="text-phosphor-dim text-xs tracking-widest mb-1.5">{label}</div>

      {/* Bar */}
      <div
        className="text-sm leading-none"
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.02em',
          color: pct > 0.5 ? '#0CD4A0' : pct > 0.25 ? 'rgba(12,212,160,0.7)' : 'rgba(12,212,160,0.4)',
        }}
      >
        {buildBar(pct)}
      </div>

      {/* Percentage label */}
      <div className="flex items-center gap-3 mt-1">
        <span className="text-phosphor text-sm font-bold tabular-nums">
          {Math.round(pct * 100)}%
        </span>
        {hasChange && (
          <span
            className={`text-xs tabular-nums transition-opacity duration-300 ${
              showFlow ? 'opacity-100' : 'opacity-0'
            } ${isRaising ? 'text-phosphor-mid' : 'text-alert-amber'}`}
          >
            {isRaising ? '▲' : '▼'} {Math.abs(Math.round((to - from) * 100))}%
          </span>
        )}
      </div>

      {/* Flow animation: equity nodes → cash or cash → equity nodes */}
      {showFlow && flowTargets.length > 0 && (
        <div className="mt-3 space-y-1">
          {flowTargets.slice(0, 5).map((ft, i) => (
            <div
              key={ft.symbol}
              className="flex items-center gap-2 text-xs"
              style={{
                opacity: 0,
                animation: `fadeIn 200ms ease ${i * 60}ms forwards`,
              }}
            >
              {ft.direction === 'OUT' ? (
                <>
                  <span className="text-phosphor font-bold w-10">{ft.symbol}</span>
                  <span className="text-phosphor-dim flex-1 tracking-widest" style={{ fontSize: '9px' }}>
                    ──────────────────→
                  </span>
                  <span className="text-phosphor-mid">CASH</span>
                </>
              ) : (
                <>
                  <span className="text-phosphor-mid">CASH</span>
                  <span className="text-phosphor-dim flex-1 tracking-widest" style={{ fontSize: '9px' }}>
                    →──────────────────
                  </span>
                  <span className="text-phosphor font-bold w-10 text-right">{ft.symbol}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reduced-motion delta */}
      {reducedMotion && hasChange && (
        <div className={`text-xs mt-1 ${isRaising ? 'text-phosphor-mid' : 'text-alert-amber'}`}>
          {isRaising ? '▲' : '▼'} {Math.round(pctPrev * 100)}% → {Math.round(to * 100)}%
        </div>
      )}

      {/* Context hint */}
      {pct > 0.35 && (
        <div className="text-phosphor-dim text-xs mt-2 leading-snug" style={{ fontSize: '9px' }}>
          LATENT EQUITY CAPACITY
        </div>
      )}
    </div>
  );
}
