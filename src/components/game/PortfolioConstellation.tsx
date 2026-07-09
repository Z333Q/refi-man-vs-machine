import { useMemo } from 'react';
import type { PortfolioPosition } from '../../lib/gameTypes';

interface Props {
  positions: PortfolioPosition[];
  correlationIndex: number;
  drawdown: number;
  highlightSymbol?: string | null;
  onSelectSymbol?: (symbol: string) => void;
  width?: number;
  height?: number;
  reducedMotion?: boolean;
}

// Arrange nodes in a balanced ellipse layout
function computeLayout(
  positions: PortfolioPosition[],
  w: number,
  h: number,
): { x: number; y: number }[] {
  const count = positions.length;
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.38;
  const ry = h * 0.38;

  return positions.map((_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    };
  });
}

// Derive correlation strength between two positions from sector similarity
function edgeStrength(a: PortfolioPosition, b: PortfolioPosition, globalCorr: number): number {
  const sameSector = a.sector === b.sector ? 0.6 : 0;
  const base = globalCorr * 0.5;
  return Math.min(1, base + sameSector);
}

// Map weight to node radius (min 6, max 18)
function weightToRadius(w: number): number {
  return 6 + w * 80;
}

// Map risk contribution to brightness level 0-1
function riskToBrightness(r: number): number {
  return Math.min(1, r * 5);
}

// phosphor color at given brightness
function phosphorColor(brightness: number, alpha = 1): string {
  const r = Math.round(12 + brightness * 109);
  const g = Math.round(212 + brightness * 43);
  const b = Math.round(160 + brightness * 55);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function PortfolioConstellation({
  positions,
  correlationIndex,
  drawdown,
  highlightSymbol,
  onSelectSymbol,
  width = 320,
  height = 240,
  reducedMotion = false,
}: Props) {
  const layout = useMemo(
    () => computeLayout(positions, width, height),
    [positions, width, height],
  );

  // Build edges between sufficiently correlated positions
  const edges = useMemo(() => {
    const result: { i: number; j: number; strength: number }[] = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const s = edgeStrength(positions[i], positions[j], correlationIndex);
        if (s > 0.25) result.push({ i, j, strength: s });
      }
    }
    return result;
  }, [positions, correlationIndex]);

  const stress = Math.abs(drawdown); // 0-1+ used for pulse intensity

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-label="Portfolio constellation — positions as nodes, lines show correlation"
      style={{ overflow: 'visible' }}
    >
      {/* Background grid dots */}
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => (
          <circle
            key={`grid-${row}-${col}`}
            cx={(col + 0.5) * (width / 8)}
            cy={(row + 0.5) * (height / 5)}
            r={0.8}
            fill="rgba(12,212,160,0.08)"
          />
        )),
      )}

      {/* Correlation edges */}
      {edges.map(({ i, j, strength }) => {
        const a = layout[i];
        const b = layout[j];
        const opacity = Math.min(0.7, strength * 0.85);
        const strokeW = 0.5 + strength * 1.5;
        const isDashed = strength < 0.45;
        return (
          <line
            key={`edge-${i}-${j}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={phosphorColor(strength, opacity)}
            strokeWidth={strokeW}
            strokeDasharray={isDashed ? '3 4' : undefined}
            style={
              !reducedMotion
                ? { transition: 'all 800ms ease' }
                : undefined
            }
          />
        );
      })}

      {/* Position nodes */}
      {positions.map((pos, i) => {
        const { x, y } = layout[i];
        const r = weightToRadius(pos.weight);
        const brightness = riskToBrightness(pos.riskContrib);
        const isHighlighted = highlightSymbol === pos.symbol;
        const nodeColor = phosphorColor(brightness);
        const pnlSign = pos.pnl >= 0;

        return (
          <g
            key={pos.symbol}
            style={{ cursor: onSelectSymbol ? 'pointer' : 'default' }}
            onClick={() => onSelectSymbol?.(pos.symbol)}
          >
            {/* Outer ring — risk contribution indicator */}
            <circle
              cx={x}
              cy={y}
              r={r + 3}
              fill="none"
              stroke={phosphorColor(brightness, 0.18)}
              strokeWidth={1}
              style={
                !reducedMotion && stress > 0.05
                  ? { animation: `constellationPulse ${1.4 + i * 0.1}s ease-in-out infinite` }
                  : undefined
              }
            />

            {/* Main node */}
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={
                isHighlighted
                  ? phosphorColor(brightness, 0.35)
                  : phosphorColor(brightness, 0.12)
              }
              stroke={isHighlighted ? '#79FFD7' : nodeColor}
              strokeWidth={isHighlighted ? 1.5 : 1}
              style={!reducedMotion ? { transition: 'all 400ms ease' } : undefined}
            />

            {/* P&L tick mark — small line above node */}
            <line
              x1={x}
              y1={y - r - 1}
              x2={x}
              y2={y - r - 4}
              stroke={pnlSign ? 'rgba(184,255,217,0.7)' : 'rgba(217,76,76,0.7)'}
              strokeWidth={1.5}
            />

            {/* Symbol label */}
            <text
              x={x}
              y={y + r + 10}
              textAnchor="middle"
              fontSize="7"
              fill={isHighlighted ? '#79FFD7' : phosphorColor(brightness * 0.7 + 0.3, 0.9)}
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="0.05em"
              style={!reducedMotion ? { transition: 'fill 300ms ease' } : undefined}
            >
              {pos.symbol}
            </text>

            {/* Weight label inside node */}
            <text
              x={x}
              y={y + 2.5}
              textAnchor="middle"
              fontSize="6"
              fill={phosphorColor(1, 0.8)}
              fontFamily="JetBrains Mono, monospace"
            >
              {Math.round(pos.weight * 100)}%
            </text>
          </g>
        );
      })}

      {/* Correlation index readout */}
      <text
        x={width - 4}
        y={height - 4}
        textAnchor="end"
        fontSize="7"
        fill="rgba(12,212,160,0.45)"
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="0.05em"
      >
        CORR {correlationIndex.toFixed(2)}
      </text>

      {/* Stress warning pulse ring at center when drawdown severe */}
      {stress > 0.08 && (
        <circle
          cx={width / 2}
          cy={height / 2}
          r={width * 0.42}
          fill="none"
          stroke={`rgba(217,76,76,${Math.min(0.35, stress * 0.5)})`}
          strokeWidth={1}
          strokeDasharray="4 6"
          style={!reducedMotion ? { animation: 'constellationPulse 2s ease-in-out infinite' } : undefined}
        />
      )}
    </svg>
  );
}
