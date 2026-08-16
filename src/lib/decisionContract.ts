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

// The permanent span. Every integer in it is a real, committable value.
// Addendum C section 4: the distance-to-conviction mapping never changes, not
// per checkpoint, not per arena, not per session, not by experiment. The pull
// gesture (PR 2B) reads these same bounds, so the hand's calibration and the
// slider's calibration are one scale.
export const CONVICTION_MIN = 50;
export const CONVICTION_MAX = 95;
export const CONVICTION_DEFAULT = 70;

// Value resolution. Addendum C section C.2: conviction is integer 50 through
// 95 and is never snapped, because the calibration score needs the resolution
// to be worth playing for. 72, 73 and 74 are all real values.
export const CONVICTION_STEP = 1;

// Detents are tactile and visual landmarks only. They draw ticks and (in the
// gesture) fire haptics; they do not quantize the value.
export const CONVICTION_DETENT = 5;

// The landmarks the hand learns. Addendum C Amendment 2 reduced these to two:
// the gate into the high-draw range, and the hard stop.
//
// 70 was demoted to an ordinary detent. It remains CONVICTION_DEFAULT, the
// value the control rests at, but a heavy tick five points below the gate
// competes with the gate for the thumb's attention, and the gate is the
// landmark that matters. 85 lost its double-tick for the same reason; it is now
// an ordinary detent inside the high-draw range.
export const CONVICTION_LANDMARKS = [75, 95] as const;

export function isDetent(conviction: number): boolean {
  return conviction % CONVICTION_DETENT === 0;
}

export function isLandmark(conviction: number): boolean {
  return (CONVICTION_LANDMARKS as readonly number[]).includes(conviction);
}

// ─── The governor ─────────────────────────────────────────────────────────────

// CP1 to CP4 cap exposure while the player learns. Addendum C section 2.2 and
// C.1: this is a governor on the value the permanent mapping produces, never a
// remap of the mapping itself. A remap would mean the same physical pull
// silently changes meaning at CP5, betraying the player's calibration exactly
// when the stakes rise. The slider therefore always spans 50 to 95; during the
// governed checkpoints it simply cannot be driven past 75.
//
// Note the governor raises the floor as well as capping the ceiling. That is
// intended: a governed checkpoint commits somewhere in 60 to 75.
export const GOVERNOR_BOUNDS = { min: 60, max: 75 } as const;
export const GOVERNOR_LIFTS_AT_CHECKPOINT = 5;
export const GOVERNOR_CAPTION = 'LIMITED TO 75. FULL RANGE OPENS AT CP5.';

/** The permanent span the control renders, identical at every checkpoint. */
export function convictionSpan(): { min: number; max: number } {
  return { min: CONVICTION_MIN, max: CONVICTION_MAX };
}

export function isGovernorActive(checkpointSequence: number): boolean {
  return checkpointSequence < GOVERNOR_LIFTS_AT_CHECKPOINT;
}

/** The bounds the committed value is clamped into at this checkpoint. */
export function convictionGovernor(checkpointSequence: number): { min: number; max: number } {
  return isGovernorActive(checkpointSequence)
    ? { ...GOVERNOR_BOUNDS }
    : { min: CONVICTION_MIN, max: CONVICTION_MAX };
}

/** Apply the governor to a value the permanent mapping produced. */
export function clampConviction(value: number, checkpointSequence: number): number {
  const { min, max } = convictionGovernor(checkpointSequence);
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

// ─── Thesis offered after commit ──────────────────────────────────────────────

// Two to three theses per stance, so the post-commit question is one tap and
// not a survey. Content may author `thesisOptions` per branch; this is the
// default set until the copy pass (Addendum B section B3) does.
const THESIS_BY_ACTION: Record<ActionCode, ThesisCode[]> = {
  HOLD:             ['THESIS_UNCHANGED', 'LIQUIDITY_PRESERVATION', 'VALUATION'],
  REDUCE:           ['DETERIORATING_FUNDAMENTALS', 'VOLATILITY_CONTROL', 'PANIC_REDUCTION'],
  ROTATE_DEFENSIVE: ['REGIME_CHANGE', 'VOLATILITY_CONTROL', 'DIVERSIFICATION'],
  ROTATE_RISK:      ['REGIME_CHANGE', 'MOMENTUM', 'VALUATION'],
  RAISE_CASH:       ['LIQUIDITY_PRESERVATION', 'VOLATILITY_CONTROL', 'PANIC_REDUCTION'],
  ADD_RISK:         ['VALUATION', 'MOMENTUM', 'CONTRARIAN'],
  STAGED_BUY:       ['VALUATION', 'POLICY_RESPONSE', 'CONTRARIAN'],
  STAGED_SELL:      ['VOLATILITY_CONTROL', 'DIVERSIFICATION', 'DETERIORATING_FUNDAMENTALS'],
};

/** The thesis chips shown after committing this stance. */
export function thesisOptionsFor(branch: ActionBranch): { code: ThesisCode; label: string }[] {
  const codes = branch.thesisOptions ?? THESIS_BY_ACTION[branch.actionCode];
  return codes.map(code => ({ code, label: thesisLabel(code) }));
}

/** Recorded when the player commits and lets the thesis prompt time out. */
export const THESIS_TIMEOUT_MS = 5000;
export const THESIS_TIMEOUT_CODE: ThesisCode = 'THESIS_UNSTATED';

// ─── Desktop and tablet input parity ──────────────────────────────────────────

// The pull gesture (Addendum C) is the signature input and is at its best on a
// tablet, where the thumb has a comfortable arc and the draw distances were
// derived. Desktop gets the same pointer drag, but the primary desktop input
// is the keyboard, and integer conviction resolution (C.2) makes a plain
// arrow-per-point traverse 45 keystrokes wide. So the keyboard gets the same
// three-speed control the hand gets from detents:
//
//   arrows              1 point    fine calibration
//   shift + arrows      5 points   detent to detent, the tick rhythm
//   PageUp / PageDown   5 points   same, for keyboards without a comfortable shift reach
//   Home / End          jump to the governed minimum or maximum
//
// This keeps the keyboard path exactly as expressive as the drag, which is
// invariant 7: the gesture is never the only door.
export const CONVICTION_KEY_STEP = CONVICTION_STEP;
export const CONVICTION_KEY_STEP_COARSE = CONVICTION_DETENT;
