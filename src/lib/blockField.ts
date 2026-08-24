import type { ActionCode } from './gameTypes';
import { nextCashWeight } from './runEngine';

// ─── Block field ──────────────────────────────────────────────────────────────
// The portfolio as area: one block per position, area proportional to
// allocation, cash as its own hollow block so dry powder reads as capacity
// rather than as absence.
//
// Salvaged from historical PR #30 as prior art, rebuilt 2026-08-25 against
// current main. Two of that branch's claims did not survive its own tests and
// are corrected here:
//
//   1. TRUTH. The engine moves cashWeight without renormalizing position
//      weights, so raw weights plus cash can sum past 1 (the COVID book after
//      RAISE_CASH reads 110%). This module therefore owns ONE canonical
//      visualization law: equities are rescaled to exactly (1 - cashWeight),
//      preserving relative exposure, and the blocks always sum to exactly 1.
//      The stance preview reads the SAME cash authority the engine commits
//      with (nextCashWeight), so the preview cannot disagree with the commit.
//
//   2. STABILITY. Row membership used to follow cumulative weight, so a
//      position that grew could push its neighbours into another row: array
//      order was stable, visual position was not. Rows are now assigned by
//      contiguous COUNT over the stable ordering, which depends only on
//      membership, never on weight. Weights change a block's size; they can
//      never move it to a different row.
//
// Where this appears is a ruling, not a preference: the reveal side, and the
// PORTFOLIO panel once the module is earned. Never the pre-commit DECIDE
// surface.

export interface BlockInput {
  /** Stable identity. Ticker, or CASH. */
  key: string;
  /** Normalized allocation, 0..1. All blocks sum to exactly 1. */
  weight: number;
  /** Sector, used for grouping and hue. Cash carries its own. */
  sector: string;
  /** Current profit or loss, shown on the edge and printed when room allows. */
  pnl: number;
  /** Cash is drawn hollow and always sorts last. */
  isCash: boolean;
}

export interface BlockRect extends BlockInput {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Which row the block was assigned to; pinned by the stability tests. */
  row: number;
}

/** Rows the field packs into. Three reads as a field rather than a bar chart. */
export const DEFAULT_ROWS = 3;

interface PositionView {
  symbol: string;
  weight: number;
  sector: string;
  pnl: number;
}

/**
 * The canonical visualization adapter: portfolio state in, an allocation that
 * sums to exactly 1 out.
 *
 * The engine's position weights are treated as RELATIVE equity weights and
 * rescaled to fill (1 - cashWeight); cash is exactly cashWeight. Relative
 * equity exposure is preserved.
 */
export function blocksFromPortfolio(
  positions: readonly PositionView[],
  cashWeight: number,
): BlockInput[] {
  const cash = Math.max(0, Math.min(1, cashWeight));
  const equitySpace = 1 - cash;
  const rawTotal = positions.reduce((s, p) => s + p.weight, 0);

  const equities: BlockInput[] = rawTotal > 0
    ? positions
        .filter(p => p.weight > 0)
        .map(p => ({
          key: p.symbol,
          weight: (p.weight / rawTotal) * equitySpace,
          sector: p.sector,
          pnl: p.pnl,
          isCash: false,
        }))
    : [];

  return [
    ...equities,
    { key: 'CASH', weight: cash, sector: 'CASH', pnl: 0, isCash: true },
  ];
}

/**
 * The field a stance would produce: allocation only, never the market.
 *
 * A preview answers "what does this stance do to my picture". It must not
 * apply checkpoint returns, because that would both leak the outcome and make
 * the preview a forecast. The cash weight comes from the engine's own
 * nextCashWeight, the same function simulatePortfolioAdvance commits with, so
 * the previewed cash and the committed cash are one value by construction.
 */
export function previewStanceBlocks(
  positions: readonly PositionView[],
  currentCashWeight: number,
  action: ActionCode,
): BlockInput[] {
  return blocksFromPortfolio(positions, nextCashWeight(currentCashWeight, action));
}

/**
 * Stable ordering: grouped by sector in first-seen order, alphabetical inside
 * a sector, cash always last.
 *
 * Deliberately not by weight: the player's spatial memory of "my tech corner"
 * is what makes a change in the picture legible as a change rather than as a
 * new picture.
 */
export function orderBlocks(items: readonly BlockInput[]): BlockInput[] {
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
 * Row assignment from identity, not weight: the ordered items are split into
 * contiguous groups by COUNT. Only membership changes can move a block.
 */
function assignRows(count: number, rows: number): number[] {
  const rowCount = Math.max(1, Math.min(rows, count));
  const base = Math.floor(count / rowCount);
  const extra = count % rowCount;
  const out: number[] = [];
  let row = 0;
  let inRow = 0;
  for (let i = 0; i < count; i++) {
    out.push(row);
    inRow += 1;
    const rowSize = base + (row < extra ? 1 : 0);
    if (inRow >= rowSize && row < rowCount - 1) {
      row += 1;
      inRow = 0;
    }
  }
  return out;
}

/**
 * Pack ordered blocks into rows: row height proportional to the weight the
 * row carries, block width proportional to its share of that row. Area is
 * therefore exactly weight/total of the field, to floating point.
 */
export function layoutBlocks(
  items: readonly BlockInput[],
  width: number,
  height: number,
  rows: number = DEFAULT_ROWS,
): BlockRect[] {
  const ordered = orderBlocks(items);
  if (ordered.length === 0 || width <= 0 || height <= 0) return [];

  const total = ordered.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return [];

  const rowOf = assignRows(ordered.length, rows);
  const rowCount = rowOf[rowOf.length - 1] + 1;
  const rowWeights = Array.from({ length: rowCount }, () => 0);
  ordered.forEach((item, i) => { rowWeights[rowOf[i]] += item.weight; });

  const out: BlockRect[] = [];
  let y = 0;
  let index = 0;
  for (let r = 0; r < rowCount; r++) {
    const h = (rowWeights[r] / total) * height;
    let x = 0;
    while (index < ordered.length && rowOf[index] === r) {
      const item = ordered[index];
      const w = rowWeights[r] > 0 ? (item.weight / rowWeights[r]) * width : 0;
      out.push({ ...item, x, y, w, h, row: r });
      x += w;
      index += 1;
    }
    y += h;
  }
  return out;
}

// ─── Sector hue ───────────────────────────────────────────────────────────────
//
// Hues stay inside the phosphor palette so the field reads as instrumentation.
// Brightness is NOT used for profit and loss: a field that brightened and
// dimmed with PnL would become a flashing mood board on a crash day, exactly
// the checkpoint where the player most needs to read it. PnL rides the block
// edge and, where the block has room, is printed as a signed number.

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
