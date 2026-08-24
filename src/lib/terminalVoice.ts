import type { TipGameState } from '../context/tipGate';

// ─── The terminal voice ───────────────────────────────────────────────────────
//
// The game's character is the terminal itself. At consequence beats a window
// takes the floor like a retro dialog box: it wakes in chunky steps, a thin
// zigzag outline ticks around it at cursor cadence while it speaks, the text
// arrives as teletype, and then the border settles back to a hairline.
// Design record: docs/PLAN-terminal-voice.md.
//
// This module is the POLICY — moods, gating, registers. It is deliberately
// React-free and clock-free (terminalVoice.test.ts asserts the source never
// reads a clock or an RNG): WHAT may be said and WHEN is game law; the typing
// rhythm is presentation and lives in TalkingWindow.
//
// The register rules (§33), enforced by review rather than code:
//   - short declaratives, numbers first, verdict second; no exclamation marks;
//   - the machine's window says I; the house never talks about itself;
//   - every line traces to the run record: a rule that fired, a number that
//     printed (§57). If it cannot cite, it does not speak;
//   - a HOLD is respected silence (§8, §16): when nothing fired, nothing talks.

/**
 * Moods are colour and tick-rate ONLY (owner ruling, 2026-08-24): same thin
 * zigzag, different temperament. Red is not a mood — it stays reserved for
 * critical risk failure (§32.2).
 */
export type VoiceMood = 'CALM' | 'MEASURED' | 'ALERT' | 'SOMBER' | 'BRISK';

/** The moments allowed to speak, each with its fixed register. */
export type VoiceMomentCode =
  | 'BOOT'
  | 'MACHINE_REVEAL'
  | 'CHECKPOINT_VERDICT'
  | 'GUARDRAIL_BLOCK'
  | 'AUTOPSY_VERDICT'
  | 'DAILY_TAPE_REVEAL';

export const MOMENT_MOOD: Record<VoiceMomentCode, VoiceMood> = {
  BOOT: 'CALM',
  MACHINE_REVEAL: 'MEASURED',
  CHECKPOINT_VERDICT: 'CALM',
  GUARDRAIL_BLOCK: 'ALERT',
  AUTOPSY_VERDICT: 'SOMBER',
  DAILY_TAPE_REVEAL: 'BRISK',
};

/** CSS hook per mood; the classes live in index.css. */
export const MOOD_CLASS: Record<VoiceMood, string> = {
  CALM: 'twin-calm',
  MEASURED: 'twin-measured',
  ALERT: 'twin-alert',
  SOMBER: 'twin-somber',
  BRISK: 'twin-brisk',
};

/**
 * Whether a speech may open in the given loop state.
 *
 * Stricter than the tip gate on purpose: a tip is the player's own guidance
 * and may land on a readable result, but a speech is the game addressing the
 * player, so it also stays out of the timed prompts. It speaks at beats,
 * never during work (§11) and never over a question the player must answer.
 */
export function speechGateOpen(state: TipGameState): boolean {
  return (
    state !== 'MARKET_ADVANCING' &&
    state !== 'THESIS_PROMPT' &&
    state !== 'COMMIT_CONFIRM'
  );
}

/** Accessible one-line description of a speech, for the window's aria-label. */
export function describeSpeech(title: string, lines: string[]): string {
  return `${title}: ${lines.join(' ')}`;
}
