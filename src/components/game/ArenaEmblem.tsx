/**
 * Arena emblems, as vector rather than text.
 *
 * These were ASCII first. §32.1's terminal aesthetic makes that tempting, but
 * §34 and §63 both say plainly what the tool should be: SVG for node and
 * network visuals, a real chart for a series, ASCII kept for the large dithered
 * portraits where the texture IS the point. A price path drawn in ▁▂▃▄▅▆▇█ has
 * eight levels of vertical resolution and, at emblem size in a monospace grid,
 * renders as a smear. The same path in SVG is exact at any size, inherits the
 * phosphor palette through currentColor, and costs nothing extra to serve
 * because it is inline markup rather than a fetched asset.
 *
 * Each emblem is a picture of what its arena actually did. A player who reads
 * charts — the audience for this game — should recognise the regime before
 * reading a word of the briefing.
 */

const PHOSPHOR = 'currentColor';

interface EmblemProps {
  className?: string;
}

function Frame({
  children, label, className,
}: { children: React.ReactNode; label: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 220 72"
      className={`w-full h-auto text-phosphor ${className ?? ''}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      {children}
    </svg>
  );
}

/** Shared type treatment for the small labels inside an emblem. */
const LABEL = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 7,
  letterSpacing: 0.5,
} as const;

/** 2020: record highs, a near-vertical drop, then a recovery that ends higher. */
export function CovidEmblem({ className }: EmblemProps) {
  const path =
    'M6,26 L28,24 L44,25 L56,21 L64,23 L72,34 L80,46 L92,58 ' +
    'L100,53 L112,49 L124,43 L136,39 L148,33 L160,29 L176,22 L196,16 L214,13';
  return (
    <Frame label="Price path: flat at record highs, a 34 percent drop in 23 days, then a recovery ending above where it started." className={className}>
      {/* The pre-crash level, so the recovery visibly clears it. */}
      <line x1="6" y1="24" x2="214" y2="24" stroke={PHOSPHOR} strokeWidth="0.5" strokeDasharray="2 3" opacity="0.35" />
      <path d={path} fill="none" stroke={PHOSPHOR} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="92" cy="58" r="2.5" fill="#D94C4C" />
      <text x="98" y="68" fill="#D94C4C" style={LABEL}>−34% / 23 DAYS</text>
      <text x="6" y="16" fill={PHOSPHOR} style={LABEL} opacity="0.55">ATH</text>
    </Frame>
  );
}

/** The market recovers along the top; the player's capital sits flat beneath it. */
export function RecoveryEmblem({ className }: EmblemProps) {
  return (
    <Frame label="The market climbs steadily while 45 percent of the portfolio stays in idle cash." className={className}>
      <path
        d="M6,52 L34,48 L58,44 L82,38 L106,34 L130,28 L154,24 L178,18 L214,12"
        fill="none" stroke={PHOSPHOR} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
      />
      <text x="6" y="10" fill={PHOSPHOR} style={LABEL} opacity="0.7">MARKET</text>
      {/* Cash: flat, and going nowhere, which is the trap. */}
      <line x1="6" y1="62" x2="214" y2="62" stroke={PHOSPHOR} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
      <text x="6" y="58" fill={PHOSPHOR} style={LABEL} opacity="0.5">CASH 45% IDLE</text>
    </Frame>
  );
}

/** Same company, different discount rate. */
export function InflationEmblem({ className }: EmblemProps) {
  return (
    <Frame label="A multiple compressing from 22 times to 15 times as rates rise, with no change in the business." className={className}>
      <text x="6" y="17" fill={PHOSPHOR} style={LABEL} opacity="0.7">22x</text>
      <rect x="30" y="10" width="184" height="9" fill={PHOSPHOR} opacity="0.85" />

      <text x="30" y="42" fill="#D6A647" style={LABEL}>▶▶▶  RATES</text>

      <text x="6" y="61" fill={PHOSPHOR} style={LABEL} opacity="0.7">15x</text>
      <rect x="30" y="54" width="125" height="9" fill={PHOSPHOR} opacity="0.5" />
      {/* The distance the bar lost, left visible rather than simply absent. */}
      <rect x="155" y="54" width="59" height="9" fill="none" stroke={PHOSPHOR} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
    </Frame>
  );
}

/** Six tickers wired into one shape. The edges are the lesson. */
export function BankingEmblem({ className }: EmblemProps) {
  const nodes: [string, number, number][] = [
    ['JPM', 60, 16], ['BAC', 110, 16], ['C', 160, 16],
    ['WFC', 60, 50], ['GS', 110, 50], ['MS', 160, 50],
  ];
  const edges: [number, number, number, number][] = [
    [60, 16, 110, 16], [110, 16, 160, 16],
    [60, 50, 110, 50], [110, 50, 160, 50],
    [60, 16, 60, 50], [110, 16, 110, 50], [160, 16, 160, 50],
    [60, 16, 110, 50], [110, 16, 160, 50],
  ];
  return (
    <Frame label="Six bank tickers drawn as one densely connected cluster: six names, one risk." className={className}>
      {edges.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D94C4C" strokeWidth="0.75" opacity="0.55" />
      ))}
      {nodes.map(([sym, x, y]) => (
        <g key={sym}>
          <circle cx={x} cy={y} r="3.5" fill={PHOSPHOR} />
          <text x={x} y={y - 6} fill={PHOSPHOR} style={LABEL} textAnchor="middle">{sym}</text>
        </g>
      ))}
      <text x="110" y="68" fill="#D94C4C" style={LABEL} textAnchor="middle">6 NAMES · 1 RISK CLUSTER</text>
    </Frame>
  );
}

/** The loop that will not resolve. */
export function TacoEmblem({ className }: EmblemProps) {
  return (
    <Frame label="A closed loop: policy drives the market, the market sets expectations, and expectations feed back into policy." className={className}>
      <defs>
        <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="#D6A647" />
        </marker>
      </defs>
      <text x="110" y="16" fill={PHOSPHOR} style={LABEL} textAnchor="middle">POLICY</text>
      <text x="182" y="56" fill={PHOSPHOR} style={LABEL} textAnchor="middle">MARKET</text>
      <text x="38" y="56" fill={PHOSPHOR} style={LABEL} textAnchor="middle">EXPECTATION</text>

      <path d="M126,18 L170,44" fill="none" stroke="#D6A647" strokeWidth="1" markerEnd="url(#arrow)" />
      <path d="M158,54 L74,54" fill="none" stroke="#D6A647" strokeWidth="1" markerEnd="url(#arrow)" />
      <path d="M38,46 L94,20" fill="none" stroke="#D6A647" strokeWidth="1" markerEnd="url(#arrow)" />
    </Frame>
  );
}

const EMBLEMS: Record<string, (p: EmblemProps) => React.ReactElement> = {
  covid_black_swan: CovidEmblem,
  recovery_trap: RecoveryEmblem,
  inflation_shift: InflationEmblem,
  banking_stress: BankingEmblem,
  taco_protocol: TacoEmblem,
};

export default function ArenaEmblem({ arenaId, className }: { arenaId: string; className?: string }) {
  const Emblem = EMBLEMS[arenaId];
  if (!Emblem) return null;
  return <Emblem className={className} />;
}
