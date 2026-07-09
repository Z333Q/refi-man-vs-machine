import { useEffect, useRef, useState } from 'react';

interface Props {
  action: string;
  reasoning?: string;
  machineName?: string;
  durationMs?: number;
  reducedMotion?: boolean;
  onComplete?: () => void;
}

const NOISE_CHARS = '%X#9Q&>!@$?~^*=+|/\\';

function randomNoise(len: number): string {
  return Array.from({ length: len }, () =>
    NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)],
  ).join('');
}

export default function MachineReveal({
  action,
  reasoning,
  machineName = 'MACHINE',
  durationMs = 650,
  reducedMotion = false,
  onComplete,
}: Props) {
  const [displayAction, setDisplayAction] = useState(() =>
    reducedMotion ? action : randomNoise(action.length),
  );
  const [displayReasoning, setDisplayReasoning] = useState(() =>
    reasoning
      ? reducedMotion
        ? reasoning
        : randomNoise(reasoning.length)
      : '',
  );
  const [phase, setPhase] = useState<'decrypting' | 'done'>(
    reducedMotion ? 'done' : 'decrypting',
  );
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (reducedMotion) {
      onComplete?.();
      return;
    }

    startRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(1, elapsed / durationMs);

      // Reveal characters left-to-right as progress advances
      const actionRevealCount = Math.floor(progress * action.length);
      const actionDisplay =
        action.slice(0, actionRevealCount) +
        randomNoise(action.length - actionRevealCount);
      setDisplayAction(actionDisplay);

      if (reasoning) {
        // Reasoning starts revealing at 40% progress
        const reasonProgress = Math.max(0, (progress - 0.4) / 0.6);
        const reasonRevealCount = Math.floor(reasonProgress * reasoning.length);
        const reasonDisplay =
          reasoning.slice(0, reasonRevealCount) +
          randomNoise(reasoning.length - reasonRevealCount);
        setDisplayReasoning(reasonDisplay);
      }

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayAction(action);
        if (reasoning) setDisplayReasoning(reasoning);
        setPhase('done');
        onComplete?.();
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [action, reasoning, durationMs, reducedMotion, onComplete]);

  const isDone = phase === 'done';

  // Determine action color
  const actionColorClass =
    action.startsWith('HOLD') || action.startsWith('WAIT')
      ? 'text-alert-amber'
      : action.includes('REDUCE') || action.includes('EXIT') || action.includes('SELL')
        ? 'text-risk-red'
        : 'text-phosphor-hot';

  return (
    <div className="font-mono select-none">
      {/* Machine label */}
      <div className="text-phosphor-dim text-xs tracking-widest mb-2 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-phosphor-mid" />
        {machineName} DECISION
      </div>

      {/* Action line */}
      <div className="relative">
        <div
          className={`text-sm tracking-widest font-bold transition-colors duration-300 ${
            isDone ? actionColorClass : 'text-phosphor-dim'
          }`}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.12em',
          }}
        >
          {displayAction}
        </div>

        {/* Scan line effect during decryption */}
        {!isDone && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(12,212,160,0.06) 50%, transparent 100%)',
              animation: 'scanMove 0.4s linear infinite',
            }}
          />
        )}
      </div>

      {/* Reasoning line */}
      {reasoning && (
        <div
          className={`mt-1.5 text-xs leading-snug transition-opacity duration-500 ${
            isDone ? 'opacity-80' : 'opacity-40'
          }`}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            color: isDone ? 'rgba(12,212,160,0.7)' : 'rgba(12,212,160,0.4)',
          }}
        >
          {displayReasoning}
        </div>
      )}

      {/* Done indicator */}
      {isDone && (
        <div
          className="mt-2 text-xs text-phosphor-dim tracking-widest"
          style={{ animation: 'fadeIn 300ms ease forwards' }}
        >
          ▶ COMMITTED
        </div>
      )}
    </div>
  );
}
