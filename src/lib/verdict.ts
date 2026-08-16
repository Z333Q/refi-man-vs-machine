import type { BehavioralFlag, CheckpointScore } from './gameTypes';

// ─── Verdict grammar ──────────────────────────────────────────────────────────
// One unambiguous result per checkpoint.
//
// The bug this exists to kill: the checkpoint result rendered an authored
// PROCESS NOTE directly under a computed score, so a player could beat par,
// earn XP, and be told in the same breath that the call was a mistake. The
// note was per checkpoint, not per outcome, so it read as a correction no
// matter what happened.
//
// The law, and the only rule that matters here:
//
//   THE EMOTIONAL SIGN OF THE PRESENTATION ALWAYS MATCHES THE SIGN OF THE
//   SCORE.
//
// Line 1 states the verdict and the single dominant cause, always.
// Line 2 is a forward-looking nudge, phrased as cost, and appears only when
// the verdict is not negative. A losing checkpoint is never given a second
// criticism, and a winning checkpoint is never contradicted.
//
// Everything else (sub-metrics, the authored teaching note) lives one tap
// deeper, where it explains rather than argues.

export type VerdictSign = 'BEAT_PAR' | 'AT_PAR' | 'UNDER_PAR';

export type ScoreComponentCode =
  | 'RAER'
  | 'DRAWDOWN'
  | 'DOWNSIDE'
  | 'REGIME'
  | 'TURNOVER'
  | 'CONSISTENCY';

export interface Verdict {
  sign: VerdictSign;
  /** Signed margin against par. Stated plainly, never dramatized. */
  margin: number;
  /** Line 1. Always present. */
  headline: string;
  /** Line 2. Null unless the verdict is non-negative and a habit is forming. */
  nudge: string | null;
  /** The component that moved the score most, and the reason line 1 gives. */
  dominant: ScoreComponentCode;
}

// The neutral score. `recoveryScore` is authored as a flat 65, so it is both
// the engine's own idea of "nothing happened" and the correct baseline to
// measure a component's contribution against.
export const NEUTRAL = 65;

/**
 * Component weights. These MUST mirror scoreCheckpoint's totalScore formula
 * (§29.1), because a driver derived from different weights would explain a
 * number the player is not looking at.
 *
 * `recoveryScore` is omitted deliberately: it is a constant 65, so its
 * deviation from neutral is always zero and it can never be a driver.
 * `positionSizingScore` is omitted because scoreCheckpoint computes it but
 * does not include it in totalScore, so it moves nothing the verdict explains.
 */
const COMPONENTS: {
  code: ScoreComponentCode;
  weight: number;
  read: (s: CheckpointScore) => number;
  win: string;
  loss: string;
}[] = [
  {
    code: 'RAER', weight: 0.25, read: s => s.raerScore,
    win: 'your risk adjusted return carried the checkpoint',
    loss: 'your risk adjusted return trailed par',
  },
  {
    code: 'DRAWDOWN', weight: 0.20, read: s => s.drawdownScore,
    win: 'you took less drawdown than the budget allowed',
    loss: 'drawdown ran deeper than the budget allows',
  },
  {
    code: 'DOWNSIDE', weight: 0.10, read: s => s.downsideScore,
    win: 'you captured less of the fall than the market handed out',
    loss: 'you took more of the fall than you had to',
  },
  {
    code: 'REGIME', weight: 0.15, read: s => s.regimeAdaptScore,
    win: 'you read the change in regime',
    loss: 'the regime changed and the stance did not',
  },
  {
    code: 'TURNOVER', weight: 0.10, read: s => s.turnoverScore,
    win: 'you spent no turnover you did not need',
    loss: 'turnover went out without edge coming back',
  },
  {
    code: 'CONSISTENCY', weight: 0.10, read: s => s.consistencyScore,
    win: 'your conviction matched your read',
    loss: 'your conviction and your read disagreed',
  },
];

const VERDICT_LABEL: Record<VerdictSign, string> = {
  BEAT_PAR: 'BEAT PAR',
  AT_PAR: 'LEVEL WITH PAR',
  UNDER_PAR: 'UNDER PAR',
};

export function verdictSign(delta: number): VerdictSign {
  if (delta > 0) return 'BEAT_PAR';
  if (delta < 0) return 'UNDER_PAR';
  return 'AT_PAR';
}

/**
 * The component that moved the score furthest from neutral, in the direction
 * the verdict went.
 *
 * On a win we name what carried it; on a loss we name what cost it. Ties break
 * by the fixed COMPONENTS order so the same score always yields the same
 * sentence (§65: a replayed seed reproduces the words too, not just the
 * numbers).
 */
export function dominantComponent(score: CheckpointScore, sign: VerdictSign): ScoreComponentCode {
  const wantPositive = sign !== 'UNDER_PAR';
  let best = COMPONENTS[0];
  let bestValue = -Infinity;

  for (const c of COMPONENTS) {
    const contribution = c.weight * (c.read(score) - NEUTRAL);
    // On a win, the largest positive contribution. On a loss, the largest
    // negative one, which is the same search with the sign flipped.
    const ranked = wantPositive ? contribution : -contribution;
    if (ranked > bestValue) {
      bestValue = ranked;
      best = c;
    }
  }
  return best.code;
}

function causeFor(code: ScoreComponentCode, sign: VerdictSign): string {
  const c = COMPONENTS.find(x => x.code === code) ?? COMPONENTS[0];
  return sign === 'UNDER_PAR' ? c.loss : c.win;
}

/**
 * The forward-looking nudge, or null.
 *
 * Only ever attached to a non-negative verdict: a losing checkpoint already
 * carries its correction in line 1 and does not get a second one. Phrased as a
 * cost the player is paying, never as a judgment of the call they just made,
 * so it cannot contradict the headline above it.
 */
export function nudgeFor(
  sign: VerdictSign,
  score: CheckpointScore,
  flags: BehavioralFlag[],
): string | null {
  if (sign === 'UNDER_PAR') return null;

  // A pace the turnover budget cannot sustain for a full run, even though this
  // checkpoint went well.
  if (score.turnoverScore < 55) {
    return 'Turnover is running ahead of the budget. The stances left later cost the same as the ones spent now.';
  }
  // Winning while acting on reflex is the habit worth naming early, because it
  // is the one that stops working when the regime does.
  if (flags.includes('ACTION_BIAS')) {
    return 'That worked, and it was a reflex. The next checkpoint will not reward the same speed.';
  }
  // Conviction well out of step with the read, on a checkpoint that still went
  // the player's way.
  if (score.consistencyScore < 50) {
    return 'The call landed, the conviction behind it did not match. Calibration is scored across the run.';
  }
  return null;
}

/** Assemble the whole verdict. Pure: same score in, same sentences out. */
export function deriveVerdict(score: CheckpointScore, flags: BehavioralFlag[] = []): Verdict {
  const sign = verdictSign(score.delta);
  const dominant = dominantComponent(score, sign);
  const margin = score.delta;

  const marginText =
    sign === 'AT_PAR' ? 'Level with par' :
    sign === 'BEAT_PAR' ? `Beat par by ${margin}` :
    `Under par by ${Math.abs(margin)}`;

  return {
    sign,
    margin,
    headline: `${marginText}. ${capitalize(causeFor(dominant, sign))}.`,
    nudge: nudgeFor(sign, score, flags),
    dominant,
  };
}

/** The stamp text, kept separate so the screen can render it large. */
export function verdictStamp(sign: VerdictSign, margin: number): string {
  if (sign === 'AT_PAR') return VERDICT_LABEL.AT_PAR;
  const signed = margin > 0 ? `+${margin}` : `${margin}`;
  return `${VERDICT_LABEL[sign]} ${signed}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
