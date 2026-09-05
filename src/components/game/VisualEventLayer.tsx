import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { GameVisualEvent, GameVisualEventType } from '../../lib/gameTypes';
import { VISUAL_PRIORITY } from '../../lib/gameTypes';
import CorrelationCollapse from './CorrelationCollapse';
import MachineCompile from './MachineCompile';
import CashReservoir from './CashReservoir';

// ─── Context ─────────────────────────────────────────────────────────────────

interface VisualEventContextValue {
  emit: (event: Omit<GameVisualEvent, 'id' | 'createdAt'>) => void;
}

const VisualEventContext = createContext<VisualEventContextValue>({
  emit: () => {},
});

export function useVisualEvents(): VisualEventContextValue {
  return useContext(VisualEventContext);
}

// ─── Renderer — maps event type to component ─────────────────────────────────

interface RendererProps {
  event: GameVisualEvent;
  reducedMotion: boolean;
  onDone: () => void;
}

function EventRenderer({ event, reducedMotion, onDone }: RendererProps) {
  const p = event.payload;

  switch (event.type) {
    case 'CORRELATION_COLLAPSE':
      return (
        <div className="p-5 max-w-sm">
          <div className="text-phosphor-dim text-xs tracking-widest mb-3">CORRELATION EVENT</div>
          <CorrelationCollapse
            correlation={typeof p.correlationAfter === 'number' ? p.correlationAfter : 0.8}
            correlationBefore={typeof p.correlationBefore === 'number' ? p.correlationBefore : 0.3}
            correlationAfter={typeof p.correlationAfter === 'number' ? p.correlationAfter : 0.8}
            clustersBefore={typeof p.riskClustersBefore === 'number' ? p.riskClustersBefore : 5}
            clustersAfter={typeof p.riskClustersAfter === 'number' ? p.riskClustersAfter : 2}
            reducedMotion={reducedMotion}
            autoPlay
            autoPlayDurationMs={event.durationMs}
            width={280}
            height={180}
            equities={(p.symbols as Array<{ symbol: string; sector: string }>) ?? undefined}
            onComplete={onDone}
          />
        </div>
      );

    case 'MACHINE_VERSION_COMPILED':
      return (
        <div className="p-5 max-w-sm">
          <MachineCompile
            machineName={typeof p.machineName === 'string' ? p.machineName : 'PLAYER MACHINE'}
            version={typeof p.version === 'string' ? p.version : 'v0.1'}
            reducedMotion={reducedMotion}
            checkIntervalMs={Math.round(event.durationMs / 12)}
            onComplete={onDone}
          />
        </div>
      );

    case 'CASH_RAISED':
    case 'CAPITAL_DEPLOYED': {
      const isRaising = event.type === 'CASH_RAISED';
      return (
        <div className="p-5 max-w-xs">
          <CashReservoir
            cashWeight={typeof p.cashAfter === 'number' ? p.cashAfter : 0.35}
            prevCashWeight={typeof p.cashBefore === 'number' ? p.cashBefore : undefined}
            reducedMotion={reducedMotion}
            label={isRaising ? 'CASH RAISED' : 'CAPITAL DEPLOYED'}
            animDurationMs={600}
          />
          <button
            onClick={onDone}
            className="mt-4 text-xs text-phosphor-dim hover:text-phosphor transition-colors tracking-widest"
          >
            [CONTINUE]
          </button>
        </div>
      );
    }

    case 'DRAWDOWN_WARNING':
      return (
        <div className="p-5 max-w-xs">
          <div className="text-alert-amber text-xs tracking-widest mb-2 font-bold">DRAWDOWN WARNING</div>
          <div className="text-2xl font-bold text-alert-amber tabular-nums mb-2">
            {typeof p.drawdown === 'number' ? `${(p.drawdown * 100).toFixed(1)}%` : '—'}
          </div>
          <div className="text-phosphor-dim text-xs leading-snug mb-4">
            {typeof p.message === 'string' ? p.message : 'PORTFOLIO DRAWDOWN EXCEEDS THRESHOLD.'}
          </div>
          <button onClick={onDone} className="text-xs text-phosphor-dim hover:text-phosphor transition-colors tracking-widest">
            [ACKNOWLEDGE]
          </button>
        </div>
      );

    case 'REGIME_SHIFT':
      return (
        <div className="p-5 max-w-xs">
          <div className="text-alert-amber text-xs tracking-widest mb-2">REGIME CHANGE</div>
          <div className="text-phosphor font-bold text-lg tracking-widest mb-1">
            {typeof p.regime === 'string' ? p.regime : 'TRANSITION'}
          </div>
          <div className="text-phosphor-dim text-xs leading-snug mb-4">
            {typeof p.description === 'string' ? p.description : 'Economic regime has shifted. Reassess portfolio exposure.'}
          </div>
          <button onClick={onDone} className="text-xs text-phosphor-dim hover:text-phosphor transition-colors tracking-widest">
            [CONTINUE]
          </button>
        </div>
      );

    default:
      // Generic event card for unhandled types
      return (
        <div className="p-5 max-w-xs">
          <div className="text-phosphor-dim text-xs tracking-widest mb-2">
            {event.type.replace(/_/g, ' ')}
          </div>
          {typeof p.message === 'string' && (
            <div className="text-phosphor-mid text-xs leading-snug mb-3">{p.message}</div>
          )}
          <button onClick={onDone} className="text-xs text-phosphor-dim hover:text-phosphor transition-colors tracking-widest">
            [CONTINUE]
          </button>
        </div>
      );
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ProviderProps {
  children: React.ReactNode;
  reducedMotion?: boolean;
}

export function VisualEventProvider({ children, reducedMotion = false }: ProviderProps) {
  const [queue, setQueue] = useState<GameVisualEvent[]>([]);
  const [active, setActive] = useState<GameVisualEvent | null>(null);
  const idCounterRef = useRef(0);

  const emit = useCallback((event: Omit<GameVisualEvent, 'id' | 'createdAt'>) => {
    const fullEvent: GameVisualEvent = {
      ...event,
      id: `vis_${Date.now()}_${++idCounterRef.current}`,
      createdAt: new Date().toISOString(),
    };
    setQueue(q => {
      // Insert sorted by priority descending
      const updated = [...q, fullEvent];
      updated.sort(
        (a, b) =>
          (VISUAL_PRIORITY[b.type] ?? 30) - (VISUAL_PRIORITY[a.type] ?? 30),
      );
      return updated;
    });
  }, []);

  // Promote from queue to active when nothing is running
  useEffect(() => {
    if (active !== null) return;
    if (queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActive(next);
  }, [active, queue]);

  const handleDone = useCallback(() => {
    setActive(null);
  }, []);

  // Auto-dismiss non-blocking events after their durationMs
  useEffect(() => {
    if (!active || active.blocking) return;
    const t = setTimeout(handleDone, active.durationMs + 300);
    return () => clearTimeout(t);
  }, [active, handleDone]);

  return (
    <VisualEventContext.Provider value={{ emit }}>
      {children}

      {/* Overlay panel */}
      {active && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(5,8,6,0.72)' }}
          onClick={!active.blocking ? handleDone : undefined}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="border border-phosphor/30 bg-terminal-deep relative"
            style={{
              minWidth: 280,
              animation: 'fadeIn 150ms ease forwards',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Priority badge */}
            <div
              className="absolute top-0 right-0 px-2 py-0.5 text-phosphor-dim bg-terminal-panel"
              style={{ fontSize: '8px', letterSpacing: '0.08em' }}
            >
              P{VISUAL_PRIORITY[active.type] ?? 30}
            </div>

            <EventRenderer
              event={active}
              reducedMotion={reducedMotion}
              onDone={handleDone}
            />

            {/* Queue indicator */}
            {queue.length > 0 && (
              <div
                className="border-t border-phosphor/10 px-5 py-2 text-phosphor-dim text-xs"
                style={{ fontSize: '9px' }}
              >
                {queue.length} EVENT{queue.length !== 1 ? 'S' : ''} QUEUED
              </div>
            )}
          </div>
        </div>
      )}
    </VisualEventContext.Provider>
  );
}

// ─── Registry ─────────────────────────────────────────────────────────────────
// Maps event types to default durations and blocking flags.

export const visualRegistry: Record<
  GameVisualEventType,
  { durationMs: number; blocking: boolean }
> = {
  MARKET_SHOCK:             { durationMs: 1200, blocking: false },
  CORRELATION_COLLAPSE:     { durationMs: 2200, blocking: false },
  VOLATILITY_SPIKE:         { durationMs: 1000, blocking: false },
  DRAWDOWN_WARNING:         { durationMs: 0,    blocking: true  },
  RISK_LIMIT_BREACH:        { durationMs: 0,    blocking: true  },
  SECTOR_ROTATION:          { durationMs: 1400, blocking: false },
  CASH_RAISED:              { durationMs: 0,    blocking: true  },
  CAPITAL_DEPLOYED:         { durationMs: 0,    blocking: true  },
  MACHINE_ACTION_REVEAL:    { durationMs: 700,  blocking: true  },
  MACHINE_ADVANTAGE:        { durationMs: 1500, blocking: false },
  HUMAN_ADVANTAGE:          { durationMs: 1500, blocking: false },
  REGIME_SHIFT:             { durationMs: 0,    blocking: true  },
  POLICY_SHOCK:             { durationMs: 0,    blocking: true  },
  POLICY_REVERSAL:          { durationMs: 0,    blocking: true  },
  PATTERN_FAILURE:          { durationMs: 0,    blocking: true  },
  BANK_CONTAGION:           { durationMs: 2000, blocking: false },
  INFLATION_PRESSURE:       { durationMs: 1800, blocking: false },
  SUPPLY_CHAIN_STRESS:      { durationMs: 2000, blocking: false },
  MACHINE_MODULE_INSTALLED: { durationMs: 1200, blocking: false },
  MACHINE_VERSION_COMPILED: { durationMs: 2400, blocking: true  },
  ARENA_UNLOCKED:           { durationMs: 0,    blocking: true  },
  BOSS_UNLOCKED:            { durationMs: 3500, blocking: true  },
  AUTOPSY_REPLAY:           { durationMs: 0,    blocking: true  },
};
