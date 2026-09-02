# Guidance sweep: one focal point per turn

Owner ruling, 2026-09-01: the run screen "feels like a game for geniuses,
not the 85%". The red and mint outlines on every block were the visible
symptom. The cause is broader: several competing primaries, red used for
any number that is not up, jargon with no gloss, and nothing that recedes
while the player decides.

Test for every change in this sweep: could someone who has never traded
tell, without Help, where to look and what to press next?

## Law

1. One forward door per phase. The ActionZone is the only primary; tabs and
   keys are equivalents, never second primaries.
2. Red is critical risk failure only (CLAUDE.md 32.2). Ordinary loss is amber
   or plain text with a sign. Never an outline.
3. Inactive regions recede (opacity-40) while the decision surface is open.
4. Result panels land in order: verdict first, context after.
5. No new panels or controls (61A interface freeze). Every fix is a removal,
   a relabel, a colour change, or a sequencing change.

## Done (branch fix/block-field-quiet-edges)

- Block field edges uniform; PnL is a printed number only.
- Single DECIDE door: in-panel button and bar `[D] DECIDE` removed; ActionZone
  reads DECIDE on the signal, PICK A STANCE ABOVE with no stance, then
  REVIEW & COMMIT.
- Stance cards are the brightest element in their pane.
- UNDER PAR verdict is amber, not red.
- Rails dim while DECIDE is open.
- Block field, YOUR CALL / machine reveal, reasoning and XP fade in 350ms
  after the score card (no delay under reduced motion).

## Next, in order

1. Red audit: 54 `risk-red` uses in src, roughly 50 for ordinary loss or
   budget state (score behind, negative return, Sharpe, drawdown under 10%,
   turnover meter, position PnL, run loss, signal direction). Convert to
   amber or plain text; keep red for the critical drawdown breach and the
   run failure banner only.
2. Copy glosses, not renames: STANCE, CONVICTION, TURNOVER, PAR, SHARPE,
   DRAWDOWN get a one-line plain gloss where they first appear on a surface
   (e.g. `TURNOVER · MOVES LEFT THIS RUN`). Vocabulary stays so records,
   tests and the spec keep one language.
3. Five-question spine collapses to the one question for the current phase.
4. Complete the numbered sequence: `1 STANCE / 2 CONVICTION / 3 COMMIT`.
5. Keyboard hints: about 20 visible at once. Keep them on tabs and the
   ActionZone; drop the per-card and per-slider hint text into the Help
   screen.
6. CP1 coach re-runs on the first checkpoint of every arena, with a third
   step pointing at the ActionZone.
7. Briefing screen: CRITICAL DRAWDOWN, MAX SECTOR EXPOSURE, LEVERAGE,
   SHORT SELLING, TRAINING CUTOFF each get a gloss.
8. Top bar: nine items. Decide which three a novice needs during a turn
   (checkpoint counter, you vs machine, help) and demote the rest.
