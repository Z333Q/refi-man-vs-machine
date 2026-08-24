import { useMemo } from 'react';
import { layoutBlocks, sectorHue, type BlockInput } from '../../lib/blockField';

// ─── Block field ──────────────────────────────────────────────────────────────
// The portfolio as area. Size means allocation, hue means sector, and cash is
// drawn hollow so dry powder reads as capacity rather than as another holding.
//
// Two sanctioned homes (2026-08-25 #30 salvage ruling):
//
//   reveal side     the resolved portfolio after a commit, with the pre-commit
//                   field ghosted beneath it
//   PORTFOLIO panel once the BLOCK_FIELD module is earned, with the stance
//                   preview
//
// It never renders on the pre-commit DECIDE surface; the e2e suite pins that.
//
// PnL is never colour-alone (Sec 62): the edge colour is reinforcement, the
// signed number prints on any block with room for it, and the SVG label reads
// symbol, sector, allocation and PnL for every block.

interface Props {
  blocks: BlockInput[];
  /** Ghost outlines of a previous allocation, drawn to show what moved. */
  previous?: BlockInput[] | null;
  height?: number;
  reducedMotion?: boolean;
  /** Caption under the field. Kept to one short line. */
  caption?: string;
}

const W = 600;

function pnlText(pnl: number): string {
  return `${pnl >= 0 ? '+' : ''}${(pnl * 100).toFixed(1)}%`;
}

export default function BlockField({
  blocks, previous = null, height = 200, reducedMotion = false, caption,
}: Props) {
  const rects = useMemo(() => layoutBlocks(blocks, W, height), [blocks, height]);
  const ghosts = useMemo(
    () => (previous ? layoutBlocks(previous, W, height) : []),
    [previous, height],
  );

  if (rects.length === 0) return null;

  const label = rects
    .map(r => r.isCash
      ? `CASH ${Math.round(r.weight * 100)} percent`
      : `${r.key}, ${r.sector}, ${Math.round(r.weight * 100)} percent, PnL ${pnlText(r.pnl)}`)
    .join('; ');

  return (
    <div data-testid="block-field">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Portfolio allocation. ${label}.`}
      >
        {/* Ghosts first, so the current field reads on top of where it was. */}
        {ghosts.map(g => (
          <rect
            key={`ghost-${g.key}`}
            x={g.x} y={g.y} width={g.w} height={g.h}
            fill="none" stroke="#27634E" strokeWidth="1" strokeDasharray="2 3" opacity="0.5"
          />
        ))}

        {rects.map(r => {
          const hue = sectorHue(r.sector, r.isCash);
          // Edge carries PnL as reinforcement only; the printed number is the
          // accessible channel. Fill brightness stays constant so a crash day
          // does not turn the field into a flashing mood board.
          const edge = r.isCash ? '#27634E' : r.pnl > 0.001 ? '#B8FFD9' : r.pnl < -0.001 ? '#D94C4C' : '#0A8F68';
          const roomForTicker = r.w >= 34 && r.h >= 16;
          const roomForWeight = roomForTicker && r.h >= 30;
          const roomForPnl = roomForWeight && r.h >= 44 && !r.isCash;
          return (
            <g key={r.key}>
              <rect
                x={r.x + 1} y={r.y + 1}
                width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)}
                fill={r.isCash ? 'none' : hue}
                fillOpacity={r.isCash ? 0 : 0.22}
                stroke={edge}
                strokeWidth={r.isCash ? 1 : 1.5}
                strokeDasharray={r.isCash ? '3 3' : undefined}
                style={reducedMotion ? undefined : { transition: 'all 240ms ease-out' }}
              />
              {roomForTicker && (
                <text x={r.x + 6} y={r.y + 15} fill={r.isCash ? '#27634E' : '#D8EEE5'} fontSize="11" fontFamily="ui-monospace, monospace">
                  {r.key}
                </text>
              )}
              {roomForWeight && (
                <text x={r.x + 6} y={r.y + 28} fill="#27634E" fontSize="10" fontFamily="ui-monospace, monospace">
                  {Math.round(r.weight * 100)}%
                </text>
              )}
              {roomForPnl && (
                <text x={r.x + 6} y={r.y + 41} fill={edge} fontSize="10" fontFamily="ui-monospace, monospace">
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
    </div>
  );
}
