import { useEffect, useMemo, useState } from 'react';
import { allocationChanges, displayPct, layoutBlocks, type BlockInput } from '../../lib/blockField';
import BlockFieldLadder from './BlockFieldLadder';

// ─── Block field ──────────────────────────────────────────────────────────────
// The portfolio as area on a desktop, as a ladder on a phone. One model,
// two presentations (2026-08-31 mobile UX ruling): blocksFromPortfolio stays
// the single derivation, and this component only chooses how to draw it.
//
//   >= sm   the treemap. Size means allocation. Every holding is the same
//           quiet fill (2026-09-05 owner ruling: nine sector tints with no
//           legend read as blocks rendering wrong, not as information; the
//           sector is in the accessible label). Cash is drawn hollow so dry
//           powder reads as capacity rather than as another holding. A dashed
//           ghost marks where a block was before the stance, and only for
//           blocks whose printed allocation actually moved: a ghost on every
//           block over a one-pixel layout drift read as a double-exposure.
//   <  sm   BlockFieldLadder. At phone width the treemap collapsed into ten
//           outlined rectangles that read as disabled form fields; the ladder
//           keeps every holding visible, stable, and legible instead.
//
// Two sanctioned homes (2026-08-25 #30 salvage ruling):
//
//   reveal side     the resolved portfolio after a commit, with the pre-commit
//                   field beneath/marked
//   PORTFOLIO panel once the BLOCK_FIELD module is earned, with the stance
//                   preview
//
// It never renders on the pre-commit DECIDE surface; the e2e suite pins that.
//
// PnL is never colour-alone (§62): on the treemap the signed number prints on
// any block with room for it, and the SVG label reads symbol, sector,
// allocation and PnL for every block. Block edges do NOT carry PnL; a field
// of red outlines read as an alarm, not as information. On the ladder PnL
// lives in the per-row disclosure after resolution.

interface Props {
  blocks: BlockInput[];
  /** The allocation before the stance: treemap ghosts, ladder markers. */
  previous?: BlockInput[] | null;
  height?: number;
  reducedMotion?: boolean;
  /** Caption under the treemap. Kept to one short line. Desktop only. */
  caption?: string;
  /**
   * Post-resolution surface: enables the ladder's per-row disclosure, the
   * change summary, and the MARKET RESULT line. Never set pre-commit.
   */
  resolved?: boolean;
  /** Portfolio-level move this checkpoint produced, for MARKET RESULT. */
  marketMove?: number | null;
}

const W = 600;

/**
 * True below Tailwind's `sm` (640px). A media query rather than a CSS-hidden
 * pair: the phone DOM genuinely contains no treemap, so nothing off-screen
 * competes for the accessibility tree or the layout.
 */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

function pnlText(pnl: number): string {
  return `${pnl >= 0 ? '+' : ''}${(pnl * 100).toFixed(1)}%`;
}

/** How many changed rows print before the summary defers to the ladder. */
const CHANGE_SUMMARY_CAP = 6;

/**
 * The consequence of the stance in plain terms: only the rows whose printed
 * percent moved. The causal link the field alone was missing — I chose X,
 * therefore my portfolio moved like Y.
 */
function ChangeSummary({ previous, current }: { previous: BlockInput[]; current: BlockInput[] }) {
  const changes = useMemo(() => allocationChanges(previous, current), [previous, current]);
  return (
    <div className="mt-3 pt-2 border-t border-phosphor/10" data-testid="block-field-changes">
      {changes.length === 0 ? (
        <div className="text-xs tracking-widest text-phosphor-mid">
          YOUR STANCE DID NOT CHANGE ALLOCATION
        </div>
      ) : (
        <>
          <div className="text-xs tracking-widest text-phosphor-mid mb-1">YOUR STANCE CHANGED</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {changes.slice(0, CHANGE_SUMMARY_CAP).map(c => (
              <div key={c.key} className="flex justify-between text-xs tabular-nums" data-testid="change-row">
                <span className={c.isCash ? 'text-phosphor-mid' : 'text-phosphor'}>{c.isCash ? 'CASH' : c.key}</span>
                <span className="text-terminal-white">{c.beforePct}% → {c.afterPct}%</span>
              </div>
            ))}
          </div>
          {changes.length > CHANGE_SUMMARY_CAP && (
            <div className="text-[11px] text-phosphor-dim tracking-widest mt-1">
              +{changes.length - CHANGE_SUMMARY_CAP} MORE CHANGED
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The desktop presentation: the incumbent treemap, unchanged. */
function BlockFieldTreemap({
  blocks, previous, height, reducedMotion, caption,
}: {
  blocks: BlockInput[];
  previous: BlockInput[] | null;
  height: number;
  reducedMotion: boolean;
  caption?: string;
}) {
  const rects = useMemo(() => layoutBlocks(blocks, W, height), [blocks, height]);
  // Ghosts only where the number the player reads moved (same precision as
  // the change summary), plus any block that no longer exists.
  const ghosts = useMemo(() => {
    if (!previous) return [];
    const now = new Map(blocks.map(b => [b.key, b]));
    return layoutBlocks(previous, W, height).filter(g => {
      const cur = now.get(g.key);
      return !cur || displayPct(cur.weight) !== displayPct(g.weight);
    });
  }, [previous, blocks, height]);

  if (rects.length === 0) return null;

  const label = rects
    .map(r => r.isCash
      ? `CASH ${Math.round(r.weight * 100)} percent`
      : `${r.key}, ${r.sector}, ${Math.round(r.weight * 100)} percent, PnL ${pnlText(r.pnl)}`)
    .join('; ');

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full select-none"
        style={{ userSelect: 'none' }}
        role="img"
        aria-label={`Portfolio allocation. ${label}.`}
        data-testid="block-field-treemap"
      >
        {/* Ghosts first, so the current field reads on top of where it was. */}
        {ghosts.map(g => (
          <rect
            key={`ghost-${g.key}`}
            x={g.x} y={g.y} width={g.w} height={g.h}
            fill="none" stroke="#79FFD7" strokeWidth="1" strokeDasharray="3 3" opacity="0.55"
          />
        ))}

        {rects.map(r => {
          // Fill and edge are quiet and uniform across every holding. PnL
          // lives only in the printed signed number (2026-09-01 owner ruling:
          // a red or mint outline on every block turned a down day into a
          // wall of alarm). Red stays reserved for critical risk failure
          // (§32.2). Dashes are reserved for the ghosts, so cash is hollow
          // with a solid dim edge.
          const edge = r.isCash ? '#27634E' : '#0A8F68';
          const pnlColor = '#D8EEE5';
          const roomForTicker = r.w >= 34 && r.h >= 16;
          const roomForWeight = roomForTicker && r.h >= 30;
          const roomForPnl = roomForWeight && r.h >= 44 && !r.isCash;
          return (
            <g key={r.key}>
              <rect
                x={r.x + 1} y={r.y + 1}
                width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)}
                fill={r.isCash ? 'none' : '#0A8F68'}
                fillOpacity={r.isCash ? 0 : 0.16}
                stroke={edge}
                strokeWidth={1}
                strokeOpacity={r.isCash ? 0.9 : 0.55}
                style={reducedMotion ? undefined : { transition: 'all 240ms ease-out' }}
              />
              {roomForTicker && (
                <text x={r.x + 6} y={r.y + 15} fill={r.isCash ? '#27634E' : '#D8EEE5'} fontSize="11" fontFamily="ui-monospace, monospace">
                  {r.key}
                </text>
              )}
              {roomForWeight && (
                <text x={r.x + 6} y={r.y + 28} fill="#0CD4A0" fontSize="10" fontFamily="ui-monospace, monospace">
                  {Math.round(r.weight * 100)}%
                </text>
              )}
              {roomForPnl && (
                <text x={r.x + 6} y={r.y + 41} fill={pnlColor} fontSize="10" fontFamily="ui-monospace, monospace">
                  {pnlText(r.pnl)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {caption && (
        <div className="text-phosphor-dim text-xs tracking-widest mt-1">{caption}</div>
      )}
    </>
  );
}

export default function BlockField({
  blocks, previous = null, height = 200, reducedMotion = false, caption,
  resolved = false, marketMove = null,
}: Props) {
  const narrow = useIsNarrow();

  if (blocks.length === 0) return null;

  return (
    <div data-testid="block-field">
      {narrow ? (
        <BlockFieldLadder
          blocks={blocks}
          previous={previous}
          resolved={resolved}
          reducedMotion={reducedMotion}
        />
      ) : (
        <BlockFieldTreemap
          blocks={blocks}
          previous={previous}
          height={height}
          reducedMotion={reducedMotion}
          caption={caption}
        />
      )}

      {/* Allocation and the market are different channels; after resolution
          they get different sections instead of one paragraph. */}
      {resolved && marketMove !== null && (
        <div className="mt-2 flex items-baseline gap-3" data-testid="block-field-market">
          <span className="text-xs tracking-widest text-phosphor-mid">MARKET RESULT</span>
          <span className={`text-sm tabular-nums font-bold ${marketMove >= 0 ? 'text-paper-green' : 'text-phosphor'}`}>
            {pnlText(marketMove)}
          </span>
          <span className="text-[11px] text-phosphor-dim tracking-widest">PORTFOLIO MOVE</span>
        </div>
      )}

      {resolved && previous && previous.length > 0 && (
        <ChangeSummary previous={previous} current={blocks} />
      )}
    </div>
  );
}
