import type { CheckpointScore } from '../../lib/gameTypes';
import { attributeCheckpoint, convictionEffect } from '../../lib/checkpointAnalysis';

// ─── Checkpoint analysis ──────────────────────────────────────────────────────
//
// The player who reads this screen is the player who wants to get better. They
// have just committed a decision under uncertainty and been told they scored 66
// against the machine's 74. The only useful next sentence is why.
//
// So this shows the arithmetic rather than a verdict: what each of §29.1's
// seven components scored, what it is weighted at, how many points that put on
// the board, and how far that was from the machine's par. Then what conviction
// did to the distance, which is the one mechanic whose effect is otherwise
// invisible. Then, for the two components that moved the score most, what they
// measure and what to do about them.
//
// Every number is derived from the same engine that produced the score, and a
// unit test asserts the reconstruction matches. Nothing here is authored copy
// pretending to be analysis.

function signed(n: number, digits = 1): string {
  const v = n.toFixed(digits);
  return n > 0 ? `+${v}` : v;
}

/** A component's own score, as a text bar. Never colour alone (§62). */
function ScoreBar({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(10, Math.round(value / 10)));
  return (
    <span className="text-phosphor-dim tabular-nums" aria-hidden="true">
      {'█'.repeat(filled)}{'░'.repeat(10 - filled)}
    </span>
  );
}

export default function CheckpointAnalysis({
  score,
  confidence,
}: {
  score: CheckpointScore;
  /** The 0 to 1 confidence the decision was committed at. */
  confidence: number;
}) {
  const a = attributeCheckpoint(score, confidence);
  const conviction = convictionEffect(a);
  const convictionPoints = Math.round(confidence * 100);

  return (
    <div className="border border-phosphor/15 bg-terminal-deep/40 p-4 space-y-4">
      <div className="text-phosphor-dim text-xs tracking-widest">
        HOW THIS SCORE WAS BUILT
      </div>

      {/* The table scrolls rather than reflows: these are aligned figures and
          a stacked card layout destroys the comparison they exist to make. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-xs">
          <thead>
            <tr className="text-phosphor-dim/70 tracking-widest">
              <th scope="col" className="text-left font-normal py-1">COMPONENT</th>
              <th scope="col" className="text-right font-normal py-1">SCORE</th>
              <th scope="col" className="text-right font-normal py-1 hidden sm:table-cell">WEIGHT</th>
              <th scope="col" className="text-right font-normal py-1">POINTS</th>
              <th scope="col" className="text-right font-normal py-1">VS PAR</th>
            </tr>
          </thead>
          <tbody>
            {a.rows.map(row => (
              <tr key={row.key} className="border-t border-phosphor/10 align-top">
                <th scope="row" className="text-left font-normal py-1.5 pr-3 text-phosphor-mid">
                  <div>{row.label}</div>
                  <div className="mt-0.5"><ScoreBar value={row.score} /></div>
                </th>
                {/* The engine returns some components unrounded (drawdown
                    control arrives as 57.00000000000001), so the display
                    rounds. The weighted points below use the exact value. */}
                <td className="text-right py-1.5 text-phosphor tabular-nums">{Math.round(row.score)}</td>
                <td className="text-right py-1.5 text-phosphor-dim tabular-nums hidden sm:table-cell">
                  {(row.weight * 100).toFixed(0)}%
                </td>
                <td className="text-right py-1.5 text-phosphor tabular-nums">{row.points.toFixed(1)}</td>
                <td className={`text-right py-1.5 tabular-nums ${
                  row.vsPar >= 0 ? 'text-paper-green' : 'text-risk-red'
                }`}>
                  {signed(row.vsPar)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-phosphor/25">
              <th scope="row" className="text-left font-normal py-2 text-phosphor-dim tracking-widest">
                PROCESS SCORE
              </th>
              <td />
              <td className="hidden sm:table-cell" />
              <td className="text-right py-2 text-phosphor font-bold tabular-nums">
                {a.processScore.toFixed(1)}
              </td>
              <td className={`text-right py-2 tabular-nums ${
                conviction.distanceFromPar >= 0 ? 'text-paper-green' : 'text-risk-red'
              }`}>
                {signed(conviction.distanceFromPar)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Conviction. The engine scales the distance from par by it, so the same
          process scores differently at 50 and at 95. Stated as arithmetic
          because that is the only form of it a player can act on. */}
      <div className="border-t border-phosphor/10 pt-3 space-y-1">
        <div className="text-phosphor-dim text-xs tracking-widest">WHAT CONVICTION DID</div>
        <div className="text-phosphor-mid text-xs leading-relaxed">
          You committed at conviction {convictionPoints}, which multiplies the distance from
          par by {a.multiplier.toFixed(2)}. Your process landed {signed(conviction.distanceFromPar)} from
          the machine's par of {a.machinePar}, so the checkpoint scored
          {' '}{signed(conviction.scaledDistance)} from it instead: {a.totalScore} against {a.machinePar}.
        </div>
        <div className="text-phosphor-dim text-xs leading-relaxed">
          {conviction.amplified
            ? `Conviction above the default is a bet on your own judgment. It ${
                conviction.distanceFromPar >= 0 ? 'paid' : 'cost'
              } ${Math.abs(conviction.costOrGain).toFixed(1)} points here.`
            : 'Conviction at or below the default keeps the checkpoint close to par, whichever way the process went.'}
        </div>
      </div>

      {/* The two components that actually moved the score, with what they mean
          and what to do about them. */}
      <div className="border-t border-phosphor/10 pt-3 space-y-3">
        <div className="text-phosphor-dim text-xs tracking-widest">WHERE THE SCORE CAME FROM</div>

        <div className="space-y-1">
          <div className="text-paper-green text-xs tracking-wide">
            STRONGEST · {a.strongest.label} · {signed(a.strongest.vsPar)} POINTS
          </div>
          <div className="text-phosphor-mid text-xs leading-relaxed">{a.strongest.measures}</div>
          <div className="text-phosphor-dim text-xs leading-relaxed">{a.strongest.matters}</div>
        </div>

        <div className="space-y-1">
          <div className="text-risk-red text-xs tracking-wide">
            WEAKEST · {a.weakest.label} · {signed(a.weakest.vsPar)} POINTS
          </div>
          <div className="text-phosphor-mid text-xs leading-relaxed">{a.weakest.measures}</div>
          <div className="text-phosphor-dim text-xs leading-relaxed">{a.weakest.matters}</div>
          <div className="text-phosphor text-xs leading-relaxed">▸ {a.weakest.improve}</div>
        </div>
      </div>

      {/* Everything else, for the player who wants the whole model. Closed by
          default: the two drivers above are the lesson, this is the reference. */}
      <details className="border-t border-phosphor/10 pt-3 group">
        <summary className="text-phosphor-dim text-xs tracking-widest cursor-pointer hover:text-phosphor focus-visible:outline focus-visible:outline-1 focus-visible:outline-phosphor">
          WHAT EACH COMPONENT MEASURES
        </summary>
        <div className="mt-3 space-y-3">
          {a.rows.map(row => (
            <div key={row.key} className="space-y-0.5">
              <div className="text-phosphor text-xs tracking-wide">
                {row.label} · {(row.weight * 100).toFixed(0)}% OF THE SCORE
              </div>
              <div className="text-phosphor-mid text-xs leading-relaxed">{row.measures}</div>
              <div className="text-phosphor-dim text-xs leading-relaxed">{row.matters}</div>
              <div className="text-phosphor-dim text-xs leading-relaxed">▸ {row.improve}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
