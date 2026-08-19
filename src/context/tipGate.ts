// ─── Tip gate ─────────────────────────────────────────────────────────────────
//
// §11: "Never show tips during: market advancement; machine action
// computation; score computation; final result animation."
//
// The rule was written into TipContext and then not enforced. `gameState` was
// initialised to IDLE with no setter, so the check guarding it was unreachable
// and a tip could open over any moment of the loop. It did: the CHECK THE
// EFFECT tip renders on top of the post-commit WHY? prompt, which is the worst
// case, because that prompt is a timed input still counting down underneath
// the thing covering it.
//
// Kept here, free of React, so the policy is a value that can be asserted
// rather than a branch buried in a provider.

export type TipGameState =
  | 'IDLE'
  | 'DECISION_REQUIRED'
  // The commit confirmation is open and awaiting a yes or no.
  | 'COMMIT_CONFIRM'
  | 'THESIS_PROMPT'
  | 'MARKET_ADVANCING'
  | 'MACHINE_REVEAL'
  | 'RESULT_COMPUTING'
  | 'COMPLETE';

/**
 * States where a tip must not open.
 *
 * MARKET_ADVANCING is the resolution race: market advancement, machine
 * computation and score computation all happen behind that one animation, so
 * one blocked state covers three of §11's four cases. THESIS_PROMPT is the
 * fourth thing worth protecting, a timed question the player has to be able to
 * see and answer.
 *
 * MACHINE_REVEAL and RESULT_COMPUTING are deliberately open. The engine leaves
 * a run in RESOLVING for the entire resolve-and-score stretch (COMPARING and
 * LEARNING are declared in RunPhase but never assigned), so gating on the phase
 * would suppress FIRST_RUN_08_MACHINE_REVEAL and FIRST_RUN_09_SCORE for good —
 * the exact opposite of what §11 wants, since those tips are written to land on
 * the result once it is sitting there readable.
 */
/*
 * COMMIT_CONFIRM joins them for the same reason THESIS_PROMPT is here. The
 * confirmation is a question the player has been asked and must answer, and a
 * tip opening over it covers the answer with something the player did not ask
 * for. A module unlock lands exactly here — the unlock fires on the commit that
 * earned it — so without this the reward for progressing was a blocking tip
 * dropped on top of the dialog that produced it.
 */
export const BLOCKED_TIP_STATES: readonly TipGameState[] = [
  'MARKET_ADVANCING',
  'THESIS_PROMPT',
  'COMMIT_CONFIRM',
];

/** Whether a tip may open right now. */
export function isTipGateOpen(state: TipGameState): boolean {
  return !BLOCKED_TIP_STATES.includes(state);
}
