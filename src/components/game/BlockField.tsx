import { useMemo } from 'react';
import {
  layoutBlocks, sectorHue, type BlockInput,
} from '../../lib/blockField';

// ─── Block field ──────────────────────────────────────────────────────────────
// The portfolio as area. Size means exposure, hue means sector, and cash is
// drawn hollow so dry powder reads as capacity rather than as another holding.
//
// Two sanctioned homes, per Addendum B B4 and the founder ruling on 04b:
//
//   reveal side   the resolved portfolio after a commit, where the player
//                 watches the picture change because the world moved
//   PORTFOLIO tab once the BLOCK_FIELD module is earned, with the aim preview
//
// It is never rendered on the pre-commit decision surface. That surface holds
// two elements, the stance cards and the conviction control, and a test pins it
// there.

interface Props {
  blocks: BlockInput[];
  /** Ghost outlines of a previous layout, drawn to show what moved. */
  previous?: BlockInput[] | null;
  height?: number;
  reducedMotion?: boolean;
  /** Caption under the field. Kept to one short line. */
  caption?: string;
}

const W = 600;

export default function BlockField({
  blocks, previous = null, height = 200, reducedMotion = false, caption,
}: Props) {
  const rects = useMemo(() => layoutBlocks(blocks, W, height), [blocks, height]);
  const ghosts = useMemo(
    () => (previous ? layoutBlocks(previous, W, height) : []),
    [previous, height],
  );

  if (rects.length === 0) return null;

  // A block only earns a label if its box can hold one without clipping.
  const labelled = (w: number, h: number) => w >= 34 && h >= 16;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label={
          'Portfolio by weight. ' +
          rects.map(r => `${r.key} ${Math.round(r.weight * 100)} percent`).join(', ') + '.'
        }
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
          // PnL rides on the edge only. Fill brightness stays constant so a
          // crash day does not turn the field into a flashing mood board.
          const edge = r.isCash ? '#27634E' : r.pnl > 0.001 ? '#B8FFD9' : r.pnl < -0.001 ? '#D94C4C' : '#0A8F68';
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
              {labelled(r.w, r.h) && (
                <text
                  x={r.x + 6} y={r.y + 15}
                  fill={r.isCash ? '#27634E' : '#D8EEE5'}
                  fontSize="11"
                  fontFamily="ui-monospace, monospace"
                >
                  {r.key}
                </text>
              )}
              {labelled(r.w, r.h) && r.h >= 30 && (
                <text
                  x={r.x + 6} y={r.y + 28}
                  fill="#27634E"
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                >
                  {Math.round(r.weight * 100)}%
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
