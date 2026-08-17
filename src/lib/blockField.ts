// ─── Block field layout ───────────────────────────────────────────────────────
// The portfolio as area: one block per position, area proportional to weight,
// cash rendered as its own block so dry powder is visible rather than implied.
//
// Where this is allowed to appear is a ruling, not a preference. Addendum B B4
// keeps it off the pre-commit decision surface: it renders on the reveal side
// (Verb spec 3.5), where the player watches their picture change for two
// reasons in sequence, first because they acted and then because the world did,
// and inside the PORTFOLIO tab once the module is earned. The aim preview lives
// there too, after the unlock, never before the first pull.
//
// Layout is pure and deterministic so the packing can be tested without a DOM
// and so a replayed run draws an identical field.

export interface BlockInput {
  /** Stable identity. Ticker, or CASH. */
  key: string;
  /** Portfolio weight, 0 to 1. Zero-weight items are dropped. */
  weight: number;
  /** Sector, used for grouping and hue. Cash carries its own. */
  sector: string;
  /** Current profit or loss, drawn on the block edge only. */
  pnl?: number;
  /** Cash is drawn hollow and always sorts last. */
  isCash?: boolean;
}

export interface BlockRect {
  key: string;
  sector: string;
  pnl: number;
  isCash: boolean;
  weight: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rows the field packs into. Three reads as a field rather than a bar chart. */
export const DEFAULT_ROWS = 3;

/**
 * Stable ordering: grouped by sector, cash always last.
 *
 * Order is deliberately not by weight. Blocks must not reshuffle between
 * checkpoints, because the player's spatial memory of "my tech corner" is the
 * only thing that makes a change in the picture legible as a change rather than
 * as a new picture. Sorting by size would rearrange the field every time a
 * position moved.
 */
export function orderBlocks(items: BlockInput[]): BlockInput[] {
  const live = items.filter(i => i.weight > 0);
  const sectors: string[] = [];
  for (const i of live) if (!i.isCash && !sectors.includes(i.sector)) sectors.push(i.sector);

  const positions = live
    .filter(i => !i.isCash)
    .sort((a, b) => {
      const s = sectors.indexOf(a.sector) - sectors.indexOf(b.sector);
      return s !== 0 ? s : a.key.localeCompare(b.key);
    });

  return [...positions, ...live.filter(i => i.isCash)];
}

/**
 * Pack ordered blocks into rows, each row's height proportional to the weight
 * it carries and each block's width proportional to its share of that row.
 *
 * Row packing rather than a squarified treemap on purpose: squarify optimises
 * aspect ratio at the cost of stable position, and stability is the property
 * this field exists to provide. Every block keeps its neighbours.
 */
export function layoutBlocks(
  items: BlockInput[],
  width: number,
  height: number,
  rows: number = DEFAULT_ROWS,
): BlockRect[] {
  const ordered = orderBlocks(items);
  if (ordered.length === 0 || width <= 0 || height <= 0) return [];

  const rowCount = Math.max(1, Math.min(rows, ordered.length));
  const total = ordered.reduce((sum, i) => sum + i.weight, 0);
  if (total <= 0) return [];

  // Fill rows by cumulative weight so each row carries a similar share.
  const perRow = total / rowCount;
  const buckets: BlockInput[][] = Array.from({ length: rowCount }, () => []);
  let bucket = 0;
  let carried = 0;
  for (const item of ordered) {
    // Never leave a trailing row empty: the last items go where they must.
    const remainingRows = rowCount - bucket;
    const remainingItems = ordered.length - ordered.indexOf(item);
    if (carried >= perRow && bucket < rowCount - 1 && remainingItems > remainingRows - 1) {
      bucket += 1;
      carried = 0;
    }
    buckets[bucket].push(item);
    carried += item.weight;
  }

  const used = buckets.filter(b => b.length > 0);
  const usedTotal = used.map(b => b.reduce((s, i) => s + i.weight, 0));
  const usedSum = usedTotal.reduce((a, b) => a + b, 0);

  const out: BlockRect[] = [];
  let y = 0;
  used.forEach((row, ri) => {
    // Last row absorbs rounding so the field always fills its bounds exactly.
    const h = ri === used.length - 1 ? height - y : (usedTotal[ri] / usedSum) * height;
    const rowWeight = usedTotal[ri];
    let x = 0;
    row.forEach((item, ci) => {
      const w = ci === row.length - 1 ? width - x : (item.weight / rowWeight) * width;
      out.push({
        key: item.key,
        sector: item.sector,
        pnl: item.pnl ?? 0,
        isCash: Boolean(item.isCash),
        weight: item.weight,
        x, y, w, h,
      });
      x += w;
    });
    y += h;
  });

  return out;
}

// ─── Sector hue ───────────────────────────────────────────────────────────────

/**
 * Hue per sector, inside the phosphor palette so the field reads as
 * instrumentation rather than as a chart. Brightness is NOT used for profit and
 * loss: a field that brightened and dimmed with PnL would become a flashing
 * mood board on a crash day, which is exactly the checkpoint where the player
 * most needs to read it. PnL rides on the block edge instead.
 */
const SECTOR_HUES: Record<string, string> = {
  TECHNOLOGY: '#0CD4A0',
  FINANCIALS: '#0A8F68',
  AIRLINES: '#79FFD7',
  HOTELS: '#5BC9A8',
  ENERGY: '#27634E',
  HEALTHCARE: '#B8FFD9',
  'CONSUMER STAPLES': '#8FD9BE',
  INDUSTRIALS: '#3E9C7C',
  'CONSUMER DISCRETIONARY': '#6FBFA0',
};

export function sectorHue(sector: string, isCash = false): string {
  if (isCash) return 'transparent';
  return SECTOR_HUES[sector] ?? '#27634E';
}

/** Build the field's inputs from a portfolio, cash included as its own block. */
export function blocksFromPortfolio(
  positions: { symbol: string; weight: number; sector: string; pnl: number }[],
  cashWeight: number,
): BlockInput[] {
  return [
    ...positions.map(p => ({ key: p.symbol, weight: p.weight, sector: p.sector, pnl: p.pnl })),
    { key: 'CASH', weight: cashWeight, sector: 'CASH', pnl: 0, isCash: true },
  ];
}

/**
 * The field a stance would produce, allocation only.
 *
 * Deliberately does NOT apply the market return. A preview answers "what does
 * this stance do to my picture", and folding in what the market is about to do
 * would both leak the outcome and make the preview a forecast. The cash delta
 * comes from the engine so the preview and the commit cannot disagree.
 *
 * Equity weights scale down (or up) proportionally to fund the cash change, so
 * relative exposure is preserved and the block that grows is cash itself.
 */
export function previewStanceBlocks(
  blocks: BlockInput[],
  cashDelta: number,
): BlockInput[] {
  if (cashDelta === 0) return blocks;

  const cash = blocks.find(b => b.isCash);
  const equities = blocks.filter(b => !b.isCash);
  const equityWeight = equities.reduce((s, b) => s + b.weight, 0);
  if (equityWeight <= 0 || !cash) return blocks;

  const nextCash = Math.max(0.02, Math.min(0.9, cash.weight + cashDelta));
  const applied = nextCash - cash.weight;
  const scale = Math.max(0, (equityWeight - applied) / equityWeight);

  return [
    ...equities.map(b => ({ ...b, weight: b.weight * scale })),
    { ...cash, weight: nextCash },
  ];
}
