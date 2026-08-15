import type { ActionBranch, ActionCode, ModuleCode, ThesisCode } from './gameTypes';

// ─── The three-input decision contract ────────────────────────────────────────
// A committed decision is exactly three things: one authored stance, one
// thesis, one conviction. There is no stock-level order ticket in the core
// loop. The control surface is identical at CP1 and CP14; what changes across
// the run is that the right answer stops being visible.

// ─── Thesis ───────────────────────────────────────────────────────────────────

/**
 * Every thesis, labelled to match what its code actually means.
 *
 * The prototype's hold-reason list was miswired: LIQUIDITY_PRESERVATION
 * displayed as "INSUFFICIENT INFORMATION", CONTRARIAN as "VALUATION SUPPORT",
 * VALUATION as "AWAIT CONFIRMATION". That silently corrupted the decision
 * record, since thesis consistency is scored across checkpoints and the
 * autopsy reads these codes back. Labels and codes now agree.
 */
export const THESIS_OPTIONS: { code: ThesisCode; label: string }[] = [
  { code: 'THESIS_UNCHANGED',           label: 'THESIS UNCHANGED' },
  { code: 'DETERIORATING_FUNDAMENTALS', label: 'FUNDAMENTALS DETERIORATING' },
  { code: 'REGIME_CHANGE',              label: 'REGIME CHANGE' },
  { code: 'VOLATILITY_CONTROL',         label: 'VOLATILITY CONTROL' },
  { code: 'LIQUIDITY_PRESERVATION',     label: 'LIQUIDITY PRESERVATION' },
  { code: 'DIVERSIFICATION',            label: 'CONCENTRATION REDUCTION' },
  { code: 'VALUATION',                  label: 'VALUATION SUPPORT' },
  { code: 'POLICY_RESPONSE',            label: 'POLICY RESPONSE' },
  { code: 'MOMENTUM',                   label: 'MOMENTUM' },
  { code: 'CONTRARIAN',                 label: 'CONTRARIAN' },
  { code: 'PANIC_REDUCTION',            label: 'LOSS AVERSION' },
];

export function thesisLabel(code: ThesisCode | null | undefined): string {
  if (!code) return 'NO THESIS';
  return THESIS_OPTIONS.find(t => t.code === code)?.label ?? code.replace(/_/g, ' ');
}

// ─── Conviction ───────────────────────────────────────────────────────────────

export const CONVICTION_DEFAULT = 70;
export const CONVICTION_STEP = 5;

// The full range opens at CP5. Early checkpoints clamp it, because a player
// who has not yet seen a regime turn has no basis for a 95. This narrows the
// input, never the interface: the slider is in the same place, doing the same
// thing, at every checkpoint.
export const CONVICTION_CLAMPED_RANGE = { min: 60, max: 75 } as const;
export const CONVICTION_FULL_RANGE = { min: 50, max: 95 } as const;
export const CONVICTION_UNLOCK_CHECKPOINT = 5;

export function convictionRange(checkpointSequence: number): { min: number; max: number } {
  return checkpointSequence < CONVICTION_UNLOCK_CHECKPOINT
    ? { ...CONVICTION_CLAMPED_RANGE }
    : { ...CONVICTION_FULL_RANGE };
}

export function isConvictionClamped(checkpointSequence: number): boolean {
  return checkpointSequence < CONVICTION_UNLOCK_CHECKPOINT;
}

/** Snap a conviction value into the range this checkpoint exposes. */
export function clampConviction(value: number, checkpointSequence: number): number {
  const { min, max } = convictionRange(checkpointSequence);
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Slider units (50 to 95) to the 0..1 confidence the scoring engine reads. */
export function convictionToConfidence(conviction: number): number {
  return conviction / 100;
}

export function confidenceToConviction(confidence: number): number {
  return Math.round(confidence * 100);
}

// ─── Stance cards ─────────────────────────────────────────────────────────────

// Fallback description per action code, used only when a branch label carries
// no ": " separated description.
const STANCE_FALLBACK: Record<ActionCode, string> = {
  HOLD:             'make no portfolio change at this checkpoint',
  REDUCE:           'cut exposure where the risk has changed',
  ROTATE_DEFENSIVE: 'move exposure from cyclicals into defensives',
  ROTATE_RISK:      'move exposure from defensives into cyclicals',
  RAISE_CASH:       'move capital out of equities into cash',
  ADD_RISK:         'increase equity exposure',
  STAGED_BUY:       'deploy capital across several checkpoints',
  STAGED_SELL:      'reduce exposure across several checkpoints',
};

/**
 * The one line of checkpoint-specific language a stance card shows under its
 * name: the descriptive half of the branch label, which content writes as
 * "SHORT NAME: description".
 *
 * There is deliberately no per-branch override field. Card copy comes from the
 * authored label so there is exactly one place to edit it, and the separator is
 * a colon because em dashes are barred from player-facing copy (Addendum A
 * Section G, enforced by scripts/em-dash-gate.mjs).
 */
export function stanceLine(branch: ActionBranch): string {
  const at = branch.label.indexOf(': ');
  const described = at === -1 ? '' : branch.label.slice(at + 2).trim();
  return described || STANCE_FALLBACK[branch.actionCode];
}

/** The card's heading. Short, and always the branch's own name for the move. */
export function stanceTitle(branch: ActionBranch): string {
  return branch.shortLabel;
}

// ─── Investigation ────────────────────────────────────────────────────────────

// Which module each investigation panel records against. Both are
// always-unlocked modules and both name what the panel actually renders, so
// the decision record stays readable in the autopsy.
//
// TODO(addendum-b): these panels become real gated modules under the earned
// terminal (RISK CONSOLE is already in the B4 unlock table), so the module
// taxonomy decision belongs to that PR, not here. See
// docs/g1-rework-spec-addendum-b.md section B4.
export const PANEL_MODULE: Record<'PORTFOLIO' | 'RISK', ModuleCode> = {
  PORTFOLIO: 'PORTFOLIO_SUMMARY',
  RISK: 'SECTOR_EXPOSURE',
};

/**
 * Investigation pays. Consulting risk before a regime call is the process the
 * game is trying to teach, so it earns the flag that credits it.
 */
export function consultedRisk(modules: ModuleCode[]): boolean {
  return modules.includes(PANEL_MODULE.RISK);
}
