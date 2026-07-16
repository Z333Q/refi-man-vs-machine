import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;             // e.g. "POSITION WEIGHT"
  proposedValue: number;     // 0-1 e.g. 0.094
  limitValue: number;        // 0-1 e.g. 0.08
  unit?: string;             // e.g. "%"
  formatFn?: (v: number) => string;
  reducedMotion?: boolean;
  onBlocked?: () => void;
}

function defaultFormat(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export default function GuardrailBarrier({
  label,
  proposedValue,
  limitValue,
  // Unit is part of the props contract for future callers that want a
  // suffix on the tick label; the current formatFn owns rendering.
  unit: _unit = '%',
  formatFn = defaultFormat,
  reducedMotion = false,
  onBlocked,
}: Props) {
  const isBreaching = proposedValue > limitValue;
  const [animValue, setAnimValue] = useState(reducedMotion ? proposedValue : 0);
  const [blocked, setBlocked] = useState(false);
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const blockedFired = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      setAnimValue(proposedValue);
      if (isBreaching && !blockedFired.current) {
        blockedFired.current = true;
        setBlocked(true);
        onBlocked?.();
      }
      return;
    }

    blockedFired.current = false;
    setBlocked(false);
    startRef.current = performance.now();
    const target = proposedValue;
    // Animate over 800ms; if breaching, stop hard at limitValue then show block
    const durationMs = 800;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const v = target * ease;

      if (isBreaching && v >= limitValue && !blockedFired.current) {
        // Hit the barrier
        setAnimValue(limitValue);
        blockedFired.current = true;
        setTimeout(() => {
          setBlocked(true);
          onBlocked?.();
        }, 120);
        return; // stop the animation
      }

      setAnimValue(v);
      if (t < 1 && !(isBreaching && blockedFired.current)) {
        frameRef.current = requestAnimationFrame(tick);
      } else if (!isBreaching) {
        setAnimValue(target);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposedValue, limitValue, isBreaching, reducedMotion]);

  // Scale: max is either 1.2x proposed or 1.1x limit
  const scale = Math.max(proposedValue, limitValue) * 1.25;
  const limitPct = (limitValue / scale) * 100;
  const animPct = Math.min((animValue / scale) * 100, limitPct);

  return (
    <div className="font-mono select-none">
      {/* Label */}
      <div className="text-phosphor-dim text-xs tracking-widest mb-2">{label}</div>

      {/* Bar with guardrail marker */}
      <div className="relative h-5 bg-phosphor/5 border border-phosphor/15" style={{ minWidth: 180 }}>
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 transition-none"
          style={{
            width: `${animPct}%`,
            background: blocked
              ? 'rgba(217,76,76,0.35)'
              : isBreaching && animValue >= limitValue
                ? 'rgba(217,76,76,0.25)'
                : 'rgba(12,212,160,0.2)',
            transition: reducedMotion ? 'none' : 'background 300ms ease',
          }}
        />

        {/* Guardrail line */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${limitPct}%`,
            width: 2,
            background: blocked ? '#D94C4C' : 'rgba(214,166,71,0.8)',
            boxShadow: blocked
              ? '0 0 6px rgba(217,76,76,0.5)'
              : '0 0 4px rgba(214,166,71,0.3)',
          }}
        />
      </div>

      {/* Value labels */}
      <div className="flex items-start justify-between mt-1.5 text-xs">
        <div>
          <div className="text-phosphor-dim" style={{ fontSize: '9px' }}>PROPOSED</div>
          <div className={`font-bold ${isBreaching ? 'text-risk-red' : 'text-phosphor'}`}>
            {formatFn(animValue)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-phosphor-dim" style={{ fontSize: '9px' }}>LIMIT</div>
          <div className="font-bold text-alert-amber">{formatFn(limitValue)}</div>
        </div>
      </div>

      {/* Block message */}
      <div
        className="mt-2 border border-risk-red/40 bg-risk-red/8 px-3 py-1.5 text-xs text-risk-red tracking-widest transition-opacity duration-300"
        style={{ opacity: blocked ? 1 : 0 }}
      >
        ACTION BLOCKED — {label.toUpperCase()} LIMIT
      </div>

      {/* Reduced-motion text */}
      {reducedMotion && isBreaching && (
        <div className="text-risk-red text-xs mt-1 tracking-widest">
          GUARDRAIL BREACH: {formatFn(proposedValue)} &gt; {formatFn(limitValue)}
        </div>
      )}
    </div>
  );
}
