import { useEffect, useMemo, useRef, useState } from 'react';

interface Equity {
  symbol: string;
  sector: string;
}

interface Props {
  /** 0-1 correlation level — drives the collapse animation */
  correlation: number;
  /** Equities involved */
  equities?: Equity[];
  correlationBefore?: number;
  correlationAfter?: number;
  clustersBefore?: number;
  clustersAfter?: number;
  reducedMotion?: boolean;
  width?: number;
  height?: number;
  /** When true, auto-animates from correlationBefore to correlationAfter */
  autoPlay?: boolean;
  autoPlayDurationMs?: number;
  onComplete?: () => void;
}

const DEFAULT_EQUITIES: Equity[] = [
  { symbol: 'AAPL', sector: 'TECH' },
  { symbol: 'MSFT', sector: 'TECH' },
  { symbol: 'DAL', sector: 'TRAVEL' },
  { symbol: 'MAR', sector: 'TRAVEL' },
  { symbol: 'BA', sector: 'INDUSTRIAL' },
  { symbol: 'JPM', sector: 'FINANCE' },
  { symbol: 'BAC', sector: 'FINANCE' },
  { symbol: 'JNJ', sector: 'HEALTH' },
  { symbol: 'PG', sector: 'STAPLES' },
  { symbol: 'XOM', sector: 'ENERGY' },
];

function phosphorAt(alpha: number): string {
  return `rgba(12,212,160,${alpha.toFixed(2)})`;
}

function lerpXY(
  ax: number, ay: number,
  bx: number, by: number,
  t: number,
): { x: number; y: number } {
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
}

// Spread positions around an ellipse
function spreadLayout(
  count: number,
  cx: number, cy: number,
  rx: number, ry: number,
  seed = 0,
): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((i + seed) / count) * 2 * Math.PI - Math.PI / 2;
    const jitterX = ((i * 37 + 13) % 11 - 5) * 0.6;
    const jitterY = ((i * 53 + 7) % 11 - 5) * 0.6;
    return {
      x: cx + rx * Math.cos(angle) + jitterX,
      y: cy + ry * Math.sin(angle) + jitterY,
    };
  });
}

// Collapsed positions: nodes migrate toward sector cluster centroids
function clusterLayout(
  equities: Equity[],
  cx: number, cy: number,
): { x: number; y: number }[] {
  const sectors = [...new Set(equities.map(e => e.sector))];
  const clusterCount = Math.max(2, Math.min(3, sectors.length));

  // Cluster centroids — compress into 2-3 groups
  const centroids: Record<string, { x: number; y: number }> = {};
  sectors.slice(0, clusterCount).forEach((s, i) => {
    const angle = (i / clusterCount) * 2 * Math.PI - Math.PI / 2;
    centroids[s] = {
      x: cx + 55 * Math.cos(angle),
      y: cy + 40 * Math.sin(angle),
    };
  });
  // Sectors beyond clusterCount collapse into cluster 0
  const fallbackSector = sectors[0];

  return equities.map((eq, i) => {
    const centroid = centroids[eq.sector] ?? centroids[fallbackSector];
    // Small spread within each cluster
    const spread = 12;
    const subAngle = (i / equities.length) * 2 * Math.PI;
    return {
      x: centroid.x + spread * Math.cos(subAngle) * 0.4,
      y: centroid.y + spread * Math.sin(subAngle) * 0.4,
    };
  });
}

export default function CorrelationCollapse({
  correlation,
  equities = DEFAULT_EQUITIES,
  correlationBefore = 0.18,
  correlationAfter = 0.82,
  clustersBefore = 5,
  clustersAfter = 2,
  reducedMotion = false,
  width = 320,
  height = 220,
  autoPlay = false,
  autoPlayDurationMs = 2200,
  onComplete,
}: Props) {
  const cx = width / 2;
  const cy = height / 2;

  const [animCorr, setAnimCorr] = useState(
    reducedMotion ? correlationAfter : (autoPlay ? correlationBefore : correlation),
  );
  const [phase, setPhase] = useState<'spreading' | 'collapsing' | 'done'>(
    reducedMotion ? 'done' : 'spreading',
  );
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!autoPlay || reducedMotion) {
      setAnimCorr(reducedMotion ? correlationAfter : correlation);
      if (reducedMotion) { setPhase('done'); onComplete?.(); }
      return;
    }
    startRef.current = performance.now();
    setPhase('collapsing');

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / autoPlayDurationMs);
      // Ease-in-out curve
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setAnimCorr(correlationBefore + (correlationAfter - correlationBefore) * ease);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setAnimCorr(correlationAfter);
        setPhase('done');
        onComplete?.();
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [autoPlay, correlationBefore, correlationAfter, autoPlayDurationMs, reducedMotion, correlation, onComplete]);

  // Effective correlation for layout interpolation
  const effectiveCorr = autoPlay ? animCorr : correlation;
  const t = Math.max(0, Math.min(1, (effectiveCorr - 0.2) / 0.6)); // 0 at corr=0.2, 1 at corr=0.8

  const spreadPos = useMemo(
    () => spreadLayout(equities.length, cx, cy, cx * 0.7, cy * 0.7),
    [equities.length, cx, cy],
  );
  const collapsePos = useMemo(
    () => clusterLayout(equities, cx, cy),
    [equities, cx, cy],
  );

  // Interpolate node positions
  const nodePos = equities.map((_, i) => {
    const s = spreadPos[i];
    const c = collapsePos[i];
    return lerpXY(s.x, s.y, c.x, c.y, t);
  });

  // Edge strength: higher when correlation is high
  const edges: { i: number; j: number; strength: number }[] = [];
  for (let i = 0; i < equities.length; i++) {
    for (let j = i + 1; j < equities.length; j++) {
      const sameSector = equities[i].sector === equities[j].sector;
      const base = effectiveCorr * 0.6;
      const s = Math.min(1, base + (sameSector ? 0.3 : 0));
      if (s > 0.2) edges.push({ i, j, strength: s });
    }
  }

  // Cluster count readout: interpolate between before/after
  const displayClusters = Math.round(
    clustersBefore + (clustersAfter - clustersBefore) * t,
  );

  if (reducedMotion) {
    return (
      <div className="font-mono text-xs space-y-1.5 p-3 border border-phosphor/15">
        <div className="text-phosphor-dim tracking-widest">CORRELATION CHANGED</div>
        <div className="text-phosphor">
          {correlationBefore.toFixed(2)} → {correlationAfter.toFixed(2)}
        </div>
        <div className="text-phosphor-dim tracking-widest mt-2">RISK CLUSTERS</div>
        <div className="text-phosphor">{clustersBefore} → {clustersAfter}</div>
        <div className="text-alert-amber text-xs mt-2 tracking-wide">
          MORE TICKERS ≠ MORE DIVERSIFICATION
        </div>
      </div>
    );
  }

  return (
    <div className="select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ overflow: 'visible' }}
        aria-label="Correlation collapse — nodes moving toward risk clusters as correlation rises"
      >
        {/* Edges */}
        {edges.map(({ i, j, strength }) => {
          const a = nodePos[i];
          const b = nodePos[j];
          const opacity = Math.min(0.75, strength * 0.9);
          return (
            <line
              key={`e-${i}-${j}`}
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              stroke={phosphorAt(opacity * 0.8)}
              strokeWidth={0.5 + strength * 2}
              strokeDasharray={strength < 0.5 ? '2 4' : undefined}
            />
          );
        })}

        {/* Nodes */}
        {equities.map((eq, i) => {
          const { x, y } = nodePos[i];
          const r = 5 + t * 2;
          return (
            <g key={eq.symbol}>
              <circle
                cx={x} cy={y} r={r + 3}
                fill="none"
                stroke={phosphorAt(0.08 + t * 0.12)}
                strokeWidth={1}
              />
              <circle
                cx={x} cy={y} r={r}
                fill={phosphorAt(0.08 + t * 0.12)}
                stroke={phosphorAt(0.5 + t * 0.4)}
                strokeWidth={1}
              />
              <text
                x={x} y={y + r + 9}
                textAnchor="middle"
                fontSize="6"
                fill={phosphorAt(0.7)}
                fontFamily="JetBrains Mono, monospace"
              >
                {eq.symbol}
              </text>
            </g>
          );
        })}

        {/* Cluster zone labels — fade in as collapse progresses */}
        {t > 0.5 && (() => {
          const sectors = [...new Set(equities.map(e => e.sector))];
          const clusterCount = Math.max(2, Math.min(3, sectors.length));
          return sectors.slice(0, clusterCount).map((s, i) => {
            const angle = (i / clusterCount) * 2 * Math.PI - Math.PI / 2;
            const lx = cx + 80 * Math.cos(angle);
            const ly = cy + 60 * Math.sin(angle);
            const labelAlpha = (t - 0.5) * 2;
            return (
              <text
                key={s}
                x={lx} y={ly - 18}
                textAnchor="middle"
                fontSize="7"
                fill={`rgba(217,166,71,${labelAlpha.toFixed(2)})`}
                fontFamily="JetBrains Mono, monospace"
                letterSpacing="0.08em"
              >
                {s} RISK
              </text>
            );
          });
        })()}
      </svg>

      {/* Readout below SVG */}
      <div className="font-mono text-xs mt-2 space-y-1">
        <div className="flex justify-between text-phosphor-dim">
          <span>CORRELATION</span>
          <span className={effectiveCorr > 0.65 ? 'text-alert-amber' : 'text-phosphor'}>
            {effectiveCorr.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-phosphor-dim">
          <span>RISK CLUSTERS</span>
          <span className={displayClusters < 3 ? 'text-alert-amber' : 'text-phosphor'}>
            {displayClusters}
          </span>
        </div>
        {phase === 'done' && (
          <div className="text-alert-amber text-xs tracking-wide pt-1">
            MORE TICKERS ≠ MORE DIVERSIFICATION
          </div>
        )}
      </div>
    </div>
  );
}
