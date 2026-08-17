// ─── Run analysis ─────────────────────────────────────────────────────────────
// The autopsy's findings, derived from what the player actually did.
//
// §15 requires the game to detect behavioural patterns and name them back. The
// engine already flags them per decision; nothing read those flags across a
// whole run, so the autopsy shipped with a hand-written list of findings that
// described a run nobody played.
//
// Every function here is pure and total: given a record it returns what that
// record supports and says so when it supports nothing. A finding that cannot
// be evidenced is not shown — an autopsy that invents a weakness is worse than
// one that admits the run was too short to judge.

import type { BehavioralFlag } from './gameTypes';
import type { RecordedDecision, RunRecord } from './runRecord';
import { actionReturnMultiplier } from './runEngine';
import { getCheckpoint } from './covidArena';

// ─── Per-checkpoint returns ───────────────────────────────────────────────────

export interface CheckpointOutcome {
  sequence: number;
  decision: RecordedDecision;
  /** The checkpoint's authored headline, for the timeline. */
  signalTitle: string;
  crisisDay: string;
  playerReturn: number;
  machineReturn: number;
}

export function outcomes(record: RunRecord): CheckpointOutcome[] {
  const out: CheckpointOutcome[] = [];
  for (const d of record.decisions) {
    const cp = getCheckpoint(d.checkpointSequence);
    if (!cp) continue;
    const bias = cp.portfolioEffect.returnBias;
    out.push({
      sequence: d.checkpointSequence,
      decision: d,
      signalTitle: cp.signalTitle,
      crisisDay: cp.crisisDay,
      playerReturn: bias * actionReturnMultiplier(d.actionCode),
      machineReturn: bias * actionReturnMultiplier(d.machineActionCode),
    });
  }
  return out;
}

// ─── Best and worst decision ──────────────────────────────────────────────────

/**
 * The decisions that moved the score most, in each direction.
 *
 * Ranked by score contribution relative to the run's own mean rather than by
 * raw return: the game scores process, and a lucky checkpoint is not the best
 * decision. Null when the run is too short for "best" and "worst" to be
 * different decisions.
 */
export function bestAndWorst(record: RunRecord): {
  best: CheckpointOutcome | null;
  worst: CheckpointOutcome | null;
} {
  const all = outcomes(record);
  if (all.length < 2) return { best: null, worst: null };

  const sorted = [...all].sort(
    (a, b) => a.decision.scoreContribution - b.decision.scoreContribution,
  );
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  if (best.sequence === worst.sequence) return { best: null, worst: null };
  return { best, worst };
}

// ─── Behavioural flags ────────────────────────────────────────────────────────

export interface FlagTally {
  flag: BehavioralFlag;
  count: number;
  checkpoints: number[];
  tone: 'positive' | 'caution' | 'severe';
}

/**
 * Which flags the engine raised, how often, and where.
 *
 * Tone is a property of the flag, not of the count: GOOD_PROCESS is never a
 * warning however often it fires, and THESIS_CONTRADICTION is never merely a
 * caution. §62 forbids colour as the only carrier, so callers must render the
 * count and the checkpoints too.
 */
const FLAG_TONE: Record<BehavioralFlag, FlagTally['tone']> = {
  GOOD_PROCESS: 'positive',
  PATIENCE_POSITIVE: 'positive',
  ADAPTATION_EVENT: 'positive',
  EARLY_REGIME_SENSITIVITY: 'positive',
  CONTRARIAN_EARLY: 'caution',
  ACTION_BIAS: 'caution',
  ANCHORING: 'caution',
  RECENCY_BIAS: 'caution',
  CASH_DRAG: 'caution',
  CHASING: 'caution',
  REENTRY_DELAY: 'caution',
  HIGH_CONVICTION_ACTION: 'caution',
  PANIC_REDUCTION_LARGE: 'severe',
  CONFIDENCE_SIZE_MISMATCH: 'severe',
  THESIS_CONTRADICTION: 'severe',
  OVERCONFIDENCE: 'severe',
};

export function flagTallies(record: RunRecord): FlagTally[] {
  const byFlag = new Map<BehavioralFlag, number[]>();
  for (const d of record.decisions) {
    for (const f of d.behavioralFlags) {
      const at = byFlag.get(f) ?? [];
      at.push(d.checkpointSequence);
      byFlag.set(f, at);
    }
  }
  return [...byFlag.entries()]
    .map(([flag, checkpoints]) => ({
      flag,
      count: checkpoints.length,
      checkpoints,
      tone: FLAG_TONE[flag] ?? 'caution',
    }))
    .sort((a, b) => b.count - a.count || a.flag.localeCompare(b.flag));
}

// ─── Score attribution ────────────────────────────────────────────────────────

/**
 * How much the run's good and poor decisions each moved the score, measured
 * against the machine's par at the same checkpoint. Par is the honest baseline:
 * "above average for this run" would flatter a bad run and punish a good one.
 */
export function scoreAttribution(record: RunRecord): {
  added: number;
  removed: number;
  aboveParCount: number;
  belowParCount: number;
} {
  let added = 0;
  let removed = 0;
  let aboveParCount = 0;
  let belowParCount = 0;

  for (const d of record.decisions) {
    const cp = getCheckpoint(d.checkpointSequence);
    if (!cp) continue;
    const delta = d.scoreContribution - cp.machinePar;
    if (delta >= 0) {
      added += delta;
      aboveParCount += 1;
    } else {
      removed += -delta;
      belowParCount += 1;
    }
  }

  return {
    added: Math.round(added * 10) / 10,
    removed: Math.round(removed * 10) / 10,
    aboveParCount,
    belowParCount,
  };
}

// ─── Headline ─────────────────────────────────────────────────────────────────

/**
 * The one-line reading of the run.
 *
 * Deliberately narrow. It states which side won and on what basis, and it
 * declines to diagnose when the run is too short to support a diagnosis. §33's
 * voice: dry, precise, never flattering, never insulting.
 */
export function headline(record: RunRecord): { verdict: string; detail: string } {
  const n = record.decisions.length;
  if (n === 0) {
    return {
      verdict: 'NO DECISIONS COMMITTED.',
      detail: 'This run has nothing to review yet.',
    };
  }

  if (record.criticalFailure) {
    return {
      verdict: 'RISK BUDGET BREACHED.',
      detail: record.criticalFailureCheckpoint !== null
        ? `Drawdown crossed the arena limit at checkpoint ${record.criticalFailureCheckpoint}. Everything after it was played in observation.`
        : 'Drawdown crossed the arena limit. The run continued in observation.',
    };
  }

  const gap = record.playerScore - record.machineScore;
  if (gap > 0) {
    return {
      verdict: 'YOU BEAT THE MACHINE.',
      detail: `${gap} points across ${n} decision${n === 1 ? '' : 's'}. Once is possible. The next regime is a different question.`,
    };
  }
  if (gap === 0) {
    return {
      verdict: 'LEVEL WITH THE MACHINE.',
      detail: `${n} decision${n === 1 ? '' : 's'}, no gap either way.`,
    };
  }
  return {
    verdict: 'THE MACHINE LED BY ' + -gap + '.',
    detail: 'Its process held across every checkpoint. Find where yours did not.',
  };
}
