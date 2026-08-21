import type { CheckpointScore } from './gameTypes';
import { SCORE_WEIGHTS, convictionMultiplier } from './scoringEngine';

// ─── Checkpoint analysis ──────────────────────────────────────────────────────
//
// The checkpoint result is the game's teaching moment. A player who reaches it
// has just made a decision under uncertainty and wants to know one thing: why
// that decision scored what it scored.
//
// The screen used to answer with a verdict and six bare numbers, which is a
// scoreboard rather than an explanation. Nothing said what the numbers measure,
// what they are weighted at, which of them moved the total, or what conviction
// did to it. The player could read that they lost by six points and still have
// no idea which behaviour cost them.
//
// So the score is decomposed here, from the same weights the engine scores
// with. Every number on the screen is derived, never authored: the attribution
// re-runs the engine's own arithmetic, and a test asserts the reconstruction
// matches. If the two ever drift the suite fails rather than the screen lying.

export type ComponentKey =
  | 'raerScore' | 'drawdownScore' | 'downsideScore' | 'recoveryScore'
  | 'regimeAdaptScore' | 'turnoverScore' | 'consistencyScore';

export interface ComponentDoc {
  key: ComponentKey;
  label: string;
  /** What the number is, in one line. */
  measures: string;
  /** Why a portfolio process cares, in one line. */
  matters: string;
  /** What a player does about a low score here. */
  improve: string;
}

/**
 * §29.1's seven components, in the order the spec lists them.
 *
 * The copy is deliberately concrete. "Turnover discipline" means nothing to a
 * first-time player; "trading costs money and each trade must earn it back"
 * does.
 */
export const SCORE_COMPONENTS: ComponentDoc[] = [
  {
    key: 'raerScore',
    label: 'RISK-ADJUSTED EXCESS RETURN',
    measures: 'Your return against the machine’s, divided by how far apart the two paths ran.',
    matters: 'Beating a benchmark by taking more risk is not skill. This asks what the return cost in risk.',
    improve: 'Look for stances that change the outcome without widening the range of outcomes.',
  },
  {
    key: 'drawdownScore',
    label: 'DRAWDOWN CONTROL',
    measures: 'How deep the portfolio fell below its high water mark, against the risk budget.',
    matters: 'A drawdown is the loss you have to recover before you make anything. Deep ones compound against you.',
    improve: 'Cut exposure while the loss is small. The cheapest drawdown to control is the one that has not happened.',
  },
  {
    key: 'downsideScore',
    label: 'DOWNSIDE CAPTURE',
    measures: 'How much of the market’s fall your portfolio actually took.',
    matters: 'Capturing less of the downside is worth more than capturing more of the upside, because losses compound harder.',
    improve: 'Defensive stances score here even when they look timid on the way up.',
  },
  {
    key: 'recoveryScore',
    label: 'RECOVERY EFFICIENCY',
    measures: 'How quickly exposure was restored once conditions improved.',
    matters: 'Protecting capital is half a process. A portfolio that never re-enters never recovers.',
    improve: 'Decide in advance what evidence returns you to risk, and act on it when it arrives.',
  },
  {
    key: 'regimeAdaptScore',
    label: 'REGIME ADAPTATION',
    measures: 'Whether your stance matched what the signal actually said about the regime.',
    matters: 'The same move is correct in one regime and wrong in the next. Reading the change is the skill.',
    improve: 'Read the signal before the portfolio. Ask what changed, not what you already believe.',
  },
  {
    key: 'turnoverScore',
    label: 'TURNOVER DISCIPLINE',
    measures: 'How much of the run’s finite turnover budget this decision spent.',
    matters: 'Trading costs money and budget. Each trade has to earn back both, and most do not.',
    improve: 'Hold is a scored decision. Spend turnover on the checkpoints that change the thesis.',
  },
  {
    key: 'consistencyScore',
    label: 'DECISION CONSISTENCY',
    measures: 'Whether this decision agrees with the thesis and the conviction you stated.',
    matters: 'A process you abandon under pressure is not a process. This is what separates one from a series of guesses.',
    improve: 'State what would change your mind, then only change it when that happens.',
  },
];

export interface AttributionRow extends ComponentDoc {
  /** The component's own 0 to 100 score. */
  score: number;
  /** Its §29.1 weight. */
  weight: number;
  /** Weighted points it contributed to the process score. */
  points: number;
  /** Points it would have contributed at the machine's par score. */
  parPoints: number;
  /** Points above or below par. This is where the gap actually came from. */
  vsPar: number;
}

export interface CheckpointAttribution {
  rows: AttributionRow[];
  /** The weighted sum, before conviction scales it. */
  processScore: number;
  /** The machine's par for this checkpoint. */
  machinePar: number;
  /** What conviction multiplied the distance from par by. */
  multiplier: number;
  /** The engine's final score, for reconciliation. */
  totalScore: number;
  delta: number;
  /** The component that helped most, and the one that cost most. */
  strongest: AttributionRow;
  weakest: AttributionRow;
}

/**
 * Rebuild the checkpoint score from its parts.
 *
 * `confidence` is the 0 to 1 confidence the decision was committed at, the same
 * value the engine scaled by.
 */
export function attributeCheckpoint(
  score: CheckpointScore,
  confidence: number,
): CheckpointAttribution {
  const machinePar = score.machineScore;

  const rows: AttributionRow[] = SCORE_COMPONENTS.map(doc => {
    const value = score[doc.key];
    const weight = SCORE_WEIGHTS[doc.key];
    const points = value * weight;
    const parPoints = machinePar * weight;
    return {
      ...doc,
      score: value,
      weight,
      points,
      parPoints,
      vsPar: points - parPoints,
    };
  });

  const processScore = rows.reduce((sum, r) => sum + r.points, 0);
  const multiplier = convictionMultiplier(confidence);

  // Ranked by weighted distance from par, so a heavily weighted near miss can
  // outrank a lightly weighted disaster. That is the honest ordering: it is
  // what actually moved the score.
  const ranked = [...rows].sort((a, b) => b.vsPar - a.vsPar);

  return {
    rows,
    processScore,
    machinePar,
    multiplier,
    totalScore: score.totalScore,
    delta: score.delta,
    strongest: ranked[0],
    weakest: ranked[ranked.length - 1],
  };
}

/**
 * What conviction did to this checkpoint, in one line of plain arithmetic.
 *
 * Conviction is the one mechanic whose effect is invisible in the result: it
 * scales the distance from par, so the same stance at 50 and at 95 produces
 * different scores from identical process. Showing the multiplication is the
 * only way the lesson lands.
 */
export function convictionEffect(a: CheckpointAttribution): {
  distanceFromPar: number;
  scaledDistance: number;
  amplified: boolean;
  costOrGain: number;
} {
  const distanceFromPar = a.processScore - a.machinePar;
  const scaledDistance = distanceFromPar * a.multiplier;
  return {
    distanceFromPar,
    scaledDistance,
    amplified: a.multiplier > 1,
    costOrGain: scaledDistance - distanceFromPar,
  };
}
