import type { CSSProperties } from 'react';

// ─── ASCII plates ─────────────────────────────────────────────────────────────
//
// §32.1 asks for a classified market terminal from 1987, and §34 is explicit
// that animation and illustration exist to explain state rather than to
// decorate: every visual should say THE MARKET CHANGED, THE PORTFOLIO CHANGED,
// RISK CHANGED, THE MACHINE RESPONDED, or THE PLAYER MACHINE EVOLVED.
//
// These are the plates §41, §42, §47 and §48 describe and the game did not
// have. Each is built from the run's own numbers rather than drawn once and
// hardcoded, so a plate cannot show a portfolio the player does not hold —
// which is the failure the autopsy already had and is worth not repeating in
// pictures.
//
// All of them are text. §63 prefers ASCII and static plates over canvas, and
// text scales, reflows, copies, and reads to a screen reader in a way a canvas
// does not. Every plate is also given a text summary for §62.

const BLOCK = '█';
const LIGHT = '░';

/** A bar of `filled` blocks out of `width`, padded with light shade. */
function bar(fraction: number, width: number): string {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)));
  return BLOCK.repeat(filled) + LIGHT.repeat(width - filled);
}

interface PlateProps {
  /** Overrides the muted default where a plate should carry emphasis. */
  color?: string;
  className?: string;
}

function Plate({ children, color, className }: PlateProps & { children: string }) {
  const style: CSSProperties = color ? { color } : {};
  return (
    <pre className={`ascii-art ${className ?? ''}`} style={style} aria-hidden="true">
      {children}
    </pre>
  );
}

// ─── §41 Inflation compression ────────────────────────────────────────────────

export interface CompressionRow {
  symbol: string;
  /** Multiple before the rate move, and after. Only the ratio is used. */
  before: number;
  after: number;
}

/**
 * "SAME COMPANY. DIFFERENT DISCOUNT RATE."
 *
 * §41 asks for compression as the metaphor: the same names, the same order,
 * visibly shorter. Showing both states stacked is the whole argument — a single
 * "after" chart would just look like a small portfolio.
 */
export function InflationCompression({ rows, className }: { rows: CompressionRow[]; className?: string }) {
  const width = 18;
  const peak = Math.max(...rows.map(r => r.before), 1);

  const before = rows.map(r => `${r.symbol.padEnd(5)}${bar(r.before / peak, width)}`).join('\n');
  const after = rows.map(r => `${r.symbol.padEnd(5)}${bar(r.after / peak, width)}`).join('\n');

  const shrink = rows.map(r => Math.round((1 - r.after / r.before) * 100));
  const worst = rows[shrink.indexOf(Math.max(...shrink))];

  return (
    <div className={className}>
      <Plate>{`${before}\n\n   INFLATION PRESSURE ${'>'.repeat(12)}\n\n${after}`}</Plate>
      {/* §62: the plate is decorative to assistive tech, so the reading is
          carried in text rather than only in the picture. */}
      <div className="font-mono text-xs text-phosphor-dim mt-2 leading-snug">
        SAME COMPANIES, SAME ORDER, SHORTER BARS. LARGEST COMPRESSION:{' '}
        {worst?.symbol} AT {Math.max(...shrink)}%. NOTHING ABOUT THE BUSINESSES
        CHANGED; THE RATE THEIR EARNINGS ARE DISCOUNTED AT DID.
      </div>
    </div>
  );
}

// ─── §42 Banking contagion ────────────────────────────────────────────────────

export interface LiquidityNode {
  symbol: string;
  /** 0-1. Drives the node's liquidity bar. */
  liquidity: number;
}

/**
 * §42's contagion graph: the cluster drawn as one shape, with liquidity bars
 * beneath it.
 *
 * The edges are the point. Six boxes in a row would read as six positions; a
 * connected graph reads as one, which is what §24 is trying to teach.
 */
export function BankingContagion({
  nodes, correlation, className,
}: { nodes: LiquidityNode[]; correlation: number; className?: string }) {
  const spreading = correlation >= 0.85;
  const edge = spreading ? '═' : '─';
  const vert = spreading ? '║' : '│';

  const graph = [
    '              JPM',
    `             /   \\`,
    '            /     \\',
    `          BAC${edge.repeat(5)}C`,
    `           ${vert}       ${vert}`,
    `           ${vert}       ${vert}`,
    `          WFC${edge.repeat(5)}GS`,
  ].join('\n');

  const bars = nodes
    .map(n => `${n.symbol.padEnd(5)}${bar(n.liquidity, 8)}`)
    .join('\n');

  const clusters = correlation >= 0.9 ? 1 : correlation >= 0.7 ? 2 : nodes.length;

  return (
    <div className={className}>
      <Plate color={spreading ? '#D94C4C' : undefined}>{`${graph}\n\n${bars}`}</Plate>
      <div className="font-mono text-xs mt-2 leading-snug">
        <span className={spreading ? 'text-risk-red' : 'text-phosphor-dim'}>
          {spreading ? 'CONTAGION PATHS DETECTED. ' : ''}
        </span>
        <span className="text-phosphor-dim">
          CORRELATION {correlation.toFixed(2)}. {nodes.length} TICKERS,{' '}
          {clusters} EFFECTIVE RISK CLUSTER{clusters === 1 ? '' : 'S'}.
        </span>
      </div>
    </div>
  );
}

// ─── §47 Signal lag ───────────────────────────────────────────────────────────

export interface LagRow {
  label: string;
  /** Retained edge at this lag, 0-1. */
  retained: number;
}

/**
 * §47: the machine edge is not only what it decides, timing matters.
 *
 * Deliberately takes its rows from the caller. §47 also says to use
 * benchmark-specific values only from a versioned source record, so this
 * component must never carry numbers of its own.
 */
export function SignalLag({
  rows, illustrative = false, className,
}: { rows: LagRow[]; illustrative?: boolean; className?: string }) {
  const plate = rows
    .map(r => `${r.label.padEnd(5)}${bar(r.retained, 20)}`)
    .join('\n');

  const worst = rows[rows.length - 1];
  return (
    <div className={className}>
      <Plate>{`SIGNAL GENERATED\n\n${plate}`}</Plate>
      <div className="font-mono text-xs text-phosphor-dim mt-2 leading-snug">
        {illustrative ? (
          <>
            EDGE RETAINED BY DELAY, SHAPE ONLY — NO SCALE IS CLAIMED. MOST OF
            THE MEASURED EDGE IS GONE BY {worst?.label}. THE MACHINE EDGE IS NOT
            ONLY WHAT IT DECIDES.
          </>
        ) : (
          <>
            EDGE RETAINED BY DELAY. AT {worst?.label} ONLY{' '}
            {Math.round((worst?.retained ?? 0) * 100)}% REMAINS. THE MACHINE
            EDGE IS NOT ONLY WHAT IT DECIDES.
          </>
        )}
      </div>
    </div>
  );
}

// ─── §48 TACO plates ──────────────────────────────────────────────────────────

/**
 * §48's supply-chain graph: a tariff is an input cost before it is a narrative,
 * and the chain is what makes that concrete.
 */
export function SupplyChain({ sectors, className }: { sectors: string[]; className?: string }) {
  const chain = [
    '  TARIFF',
    '    │',
    '    ▼',
    '  INPUT COST',
    '    │',
    '    ▼',
    '  MARGIN RISK',
    '    │',
    '    ▼',
    '  EARNINGS REVISION',
    '    │',
    '    ▼',
    '  EQUITY PRICE',
  ].join('\n');

  return (
    <div className={className}>
      <Plate>{chain}</Plate>
      <div className="font-mono text-xs text-phosphor-dim mt-2 leading-snug">
        EXPOSED: {sectors.join(' · ')}. THE PATH FROM POLICY TO PRICE RUNS
        THROUGH MARGIN, NOT THROUGH SENTIMENT.
      </div>
    </div>
  );
}

/**
 * §48's reflexivity plate.
 *
 * The cycle is drawn closed on purpose: the player's expected response is part
 * of the state it is responding to, and a linear diagram would lose exactly
 * that.
 */
export function Reflexivity({ className }: { className?: string }) {
  const plate = [
    '        POLICY',
    '       ↙      ↖',
    '  MARKET ←── EXPECTATION',
  ].join('\n');

  return (
    <div className={className}>
      <Plate color="#D6A647">{plate}</Plate>
      <div className="font-mono text-xs text-phosphor-dim mt-2 leading-snug">
        EXPECTED RESPONSE IS NOW PART OF THE MARKET STATE.
      </div>
    </div>
  );
}

// ─── Run-wide plates ──────────────────────────────────────────────────────────

/**
 * A run's score history as a sparkline against par.
 *
 * The autopsy reports totals; this shows the shape, which is where a run's
 * story actually lives: a steady run and a run that collapsed once average the
 * same and are not the same run.
 */
export function ScoreTrace({
  scores, pars, className,
}: { scores: number[]; pars: number[]; className?: string }) {
  if (scores.length === 0) return null;

  const ramp = ' .:-=+*#%@';
  const trace = scores
    .map(s => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor((s / 100) * ramp.length)))])
    .join('');
  const parTrace = pars
    .map(p => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor((p / 100) * ramp.length)))])
    .join('');

  const beat = scores.filter((s, i) => s >= (pars[i] ?? 0)).length;

  return (
    <div className={className}>
      <Plate>{`YOU  ${trace}\nPAR  ${parTrace}`}</Plate>
      <div className="font-mono text-xs text-phosphor-dim mt-2 leading-snug">
        {beat} OF {scores.length} CHECKPOINTS AT OR ABOVE PAR. DENSER GLYPHS ARE
        HIGHER SCORES.
      </div>
    </div>
  );
}

// ─── Arena emblems ────────────────────────────────────────────────────────────

/**
 * One emblem per arena.
 *
 * The briefing used to draw the same rounded blob for every arena with the name
 * stamped in the middle, which told the player nothing: five different regimes
 * arrived looking identical. Each emblem here is a picture of the thing the
 * arena is actually about, so the briefing screen carries information before a
 * word of it is read.
 */
export const ARENA_EMBLEMS: Record<string, string> = {
  // A cliff. One vertical drop, no warning above it.
  covid_black_swan: `
   ▁▁▁▁▁▁▁▁
  ▟████████▙
  █████████▛▀▚▖
  ▀▀▀▀▀▀▀▀▘   ▝▚▖
               ▝▚▄▄▄▄▄▄▄
                ░░░░░░░░`,

  // A staircase up, with the gap the player is standing in.
  recovery_trap: `
              ▗▄▄▄
           ▗▄▄▟███
        ▗▄▄▟██████
     ▗▄▄▟█████████
  ░░░│  ▲ YOU ARE HERE
  ░░░│`,

  // Compression: the same column, squeezed.
  inflation_shift: `
  █████████████████
  ███████████▙▖
  ████████▙▖
     ▶▶▶ RATES ▶▶▶
  ████████
  ██████
  █████`,

  // The cluster that looks like six things and behaves like one.
  banking_stress: `
        ● JPM
       ╱     ╲
   BAC ●─────● C
      │╲     ╱│
      │ ╲   ╱ │
   WFC ●─────● GS`,

  // The policy loop that will not resolve.
  taco_protocol: `
      ┌──────────┐
      │  POLICY  │
      └──┬────▲──┘
         ▼    │
     MARKET ──┘
    EXPECTATION`,
};

export function ArenaEmblem({ arenaId, className }: { arenaId: string; className?: string }) {
  const art = ARENA_EMBLEMS[arenaId];
  if (!art) return null;
  return (
    <pre className={`ascii-art text-center ${className ?? ''}`} aria-hidden="true">
      {art}
    </pre>
  );
}

// ─── §48 TACO portrait ────────────────────────────────────────────────────────

/**
 * The final boss portrait.
 *
 * §48 is specific about the treatment: neutral, monochrome, no slogans, no
 * flag, no caricature body. The humour is meant to come from the market term
 * and the mechanic, not from the picture. This is an abstract dithered mask,
 * and it stays that way.
 */
const TACO_PORTRAIT = `
                   ........:::::::::::::::........
              ....::::::////////////////::::::....
           ...:::://////++++++++++++++//////::::...
         ..:::////++++++==============++++++////:::..
       ..::///++++====----------------====++++///::..
      .::///+++===----::::::::::::::::----===+++///::.
     .:://+++==---:::................:::---==+++//::.
     :://++==--::......            ......::--==++//::
     ://++==--:....                    .....:--==++//:
     //++==--:...     TACO PROTOCOL      ...:--==++//
     \\++==--:...                          ...:--==++/
     |\\+=---:...    ___   ___   ___    ....:---=+//|
      |\\+==--...  _|   | |   | |   |_  ...:--=+//|
      |/++==-:.  | |   | |   | |   | | .:.-==++/|
      //++==--:   |_|___| |___| |___|   :--==++//
     ://++==---:.                    ..:---==++//:
    .://+++===----:::..............:::----===+++//::.
   ..::////++++=======-----------======++++////:::..
    ...:::://////++++++++++++++++++++//////::::...
        ....::::::::///////////////////::::....
              ..........::::::::::..........
`;

/**
 * §48's reveal progression: a partial silhouette in round 1, filling out to
 * the full portrait by the final round.
 *
 * The reveal is tied to run progress rather than to a timer, so it means
 * something: the boss resolves as the player works through the policy episode,
 * and a player who stops early never sees the whole face.
 */
export function TacoPortrait({
  round, totalRounds, className,
}: { round: number; totalRounds: number; className?: string }) {
  const lines = TACO_PORTRAIT.split('\n').filter(Boolean);
  // Round 1 shows roughly the top third, the final round shows all of it.
  const fraction = totalRounds > 0 ? Math.min(1, round / totalRounds) : 1;
  const shown = Math.max(3, Math.ceil(lines.length * (0.3 + 0.7 * fraction)));

  return (
    <div className={className}>
      <pre
        className="font-mono text-phosphor-dim"
        style={{ fontSize: '7px', lineHeight: '1.0', letterSpacing: '-0.04em', whiteSpace: 'pre' }}
        aria-hidden="true"
      >
        {lines.slice(0, shown).join('\n')}
      </pre>
      <div className="font-mono text-xs text-phosphor-dim mt-2 tracking-widest">
        ROUND {round} OF {totalRounds}
      </div>
    </div>
  );
}
