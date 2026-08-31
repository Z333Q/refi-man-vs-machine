import { useMemo, useState } from 'react';
import { displayPct, orderBlocks, type BlockInput } from '../../lib/blockField';

// ─── Allocation ladder ───────────────────────────────────────────────────────
// The phone-width Block Field. The treemap earns its keep on a desktop, where
// area has room to mean something; at 393pt it collapsed into ten outlined
// rectangles that read as disabled form fields (the 2026-08-31 real-device
// screenshot is the anti-reference). On a phone the same truth is a ladder:
// one stable row per holding, a bar for the current allocation, a thin marker
// for where it was before the stance.
//
// Laws carried over from the treemap, not reinvented:
//   - rows come from orderBlocks, the same stable ordering the treemap packs
//     with, so a ticker keeps its place from checkpoint to checkpoint;
//   - cash is structurally different: separated, hollow, never an eleventh
//     stock;
//   - PnL is never colour-alone and never in the primary scan path here —
//     after resolution each row discloses before/current/PnL on tap, and the
//     disclosure is informational only (§62: keyboard accessible, so the rows
//     are buttons).
//
// Bars share one scale — the largest weight on the field, before or current —
// so lengths are directly comparable within the checkpoint. The printed
// percent stays the authority; the bar supports pattern recognition.

interface Props {
  blocks: BlockInput[];
  /** The allocation before the stance; drawn as a marker on each row. */
  previous?: BlockInput[] | null;
  /** Post-resolution: rows disclose before/current/PnL on tap. */
  resolved?: boolean;
  reducedMotion?: boolean;
}

function pnlText(pnl: number): string {
  return `${pnl >= 0 ? '+' : ''}${(pnl * 100).toFixed(1)}%`;
}

export default function BlockFieldLadder({
  blocks, previous = null, resolved = false, reducedMotion = false,
}: Props) {
  const [open, setOpen] = useState<string | null>(null);

  const ordered = useMemo(() => orderBlocks(blocks), [blocks]);
  const beforeByKey = useMemo(
    () => new Map((previous ?? []).map(b => [b.key, b.weight])),
    [previous],
  );

  // One scale for the whole field, including the before markers, so nothing
  // overflows its track and every length is comparable to every other.
  const scaleMax = useMemo(() => {
    let max = 0;
    for (const b of ordered) max = Math.max(max, b.weight, beforeByKey.get(b.key) ?? 0);
    return max > 0 ? max : 1;
  }, [ordered, beforeByKey]);

  if (ordered.length === 0) return null;

  const positions = ordered.filter(b => !b.isCash);
  const cash = ordered.find(b => b.isCash);
  const hasMarkers = previous !== null && previous.length > 0;

  const row = (b: BlockInput) => {
    const beforeWeight = beforeByKey.get(b.key);
    const pct = displayPct(b.weight);
    const beforePct = beforeWeight !== undefined ? displayPct(beforeWeight) : null;
    const markerAt = beforeWeight !== undefined ? (beforeWeight / scaleMax) * 100 : null;
    const isOpen = resolved && open === b.key;

    const label = [
      b.isCash ? `Cash, unallocated capital, ${pct} percent` : `${b.key}, current allocation ${pct} percent`,
      beforePct !== null && beforePct !== pct ? `before stance ${beforePct} percent` : null,
      resolved && !b.isCash
        ? `market result ${b.pnl >= 0 ? 'positive' : 'negative'} ${Math.abs(b.pnl * 100).toFixed(1)} percent`
        : null,
    ].filter(Boolean).join(', ');

    const body = (
      <>
        <div className="flex items-baseline justify-between">
          <span className={`text-sm font-bold tracking-wide ${b.isCash ? 'text-phosphor-mid' : 'text-phosphor'}`}>
            {b.isCash ? 'CASH' : b.key}
          </span>
          {b.isCash && (
            <span className="text-[11px] text-phosphor-dim tracking-widest mr-auto ml-3">UNALLOCATED</span>
          )}
          <span className="text-sm text-terminal-white tabular-nums">{pct}%</span>
        </div>
        <div
          className={`relative h-2.5 mt-1 bg-terminal-deep border ${b.isCash ? 'border-phosphor-mid/50 border-dashed' : 'border-phosphor/15'}`}
          aria-hidden="true"
        >
          {/* Full-width fill scaled on transform, not width, so the 240ms
              settle after a stance never causes layout work. */}
          <div
            className={`h-full w-full origin-left ${b.isCash ? 'border-r-2 border-phosphor-mid/70' : 'bg-phosphor-mid/40 border-r-2 border-phosphor'}`}
            style={{
              transform: `scaleX(${Math.min(1, b.weight / scaleMax)})`,
              transition: reducedMotion ? undefined : 'transform 240ms ease-out',
            }}
          />
          {markerAt !== null && (
            <div
              data-testid="ladder-marker"
              className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-paper-green"
              style={{ left: `calc(${Math.min(100, markerAt)}% - 1px)` }}
            />
          )}
        </div>
        {isOpen && !b.isCash && (
          <div className="mt-1.5 text-xs tabular-nums flex flex-wrap gap-x-4 gap-y-0.5" data-testid="ladder-detail">
            <span className="text-phosphor-mid">BEFORE {beforePct ?? pct}%</span>
            <span className="text-phosphor-mid">CURRENT {pct}%</span>
            <span className={b.pnl >= 0 ? 'text-paper-green' : 'text-risk-red'}>PNL {pnlText(b.pnl)}</span>
          </div>
        )}
      </>
    );

    // After resolution each position row is a disclosure button; before it,
    // and for cash, a plain row. The tap is informational only: nothing here
    // touches the run, the pending decision, or the record.
    return resolved && !b.isCash ? (
      <button
        key={b.key}
        type="button"
        aria-expanded={isOpen}
        aria-label={label}
        onClick={() => setOpen(isOpen ? null : b.key)}
        className="block w-full text-left py-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-phosphor"
        data-testid="ladder-row"
      >
        {body}
      </button>
    ) : (
      <div key={b.key} className="py-1" role="img" aria-label={label} data-testid="ladder-row">
        {body}
      </div>
    );
  };

  return (
    <div data-testid="block-field-ladder">
      <div className="flex gap-4 text-[11px] tracking-widest text-phosphor-mid mb-1.5">
        <span>BAR = NOW</span>
        {hasMarkers && <span>MARKER = BEFORE YOUR STANCE</span>}
      </div>
      <div>{positions.map(row)}</div>
      {cash && <div className="mt-2 pt-2 border-t border-phosphor/15">{row(cash)}</div>}
    </div>
  );
}
