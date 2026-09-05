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

## Done (branch fix/ux-review-core-loop-hierarchy, 2026-09-05)

Prompted by an external UX review of game.refi.trading. Owner rulings that
day: glosses not renames; the 61A freeze holds (no preflight screen, no new
explanation panel); the thesis data model and timeout are untouched; dead key
hints are removed, not wired.

- Routing reads "has the player ever committed a decision"
  (src/lib/playerEntry.ts), never the tutorial flag. Hub START RUN goes to the
  map.
- Arena Map F1/F7/F8/F9 and Briefing M removed: nothing was bound to them.
- Spine shows the one question for the current phase.
- Second Portfolio / Risk / Help bar under the run workspace removed; the CP1
  coach's second step points at the ActionZone.
- Run top bar: ABORT, CP counter, YOU vs MACHINE, portfolio return, ? HELP.
  Arena name, arc rail, Sharpe and build stamp stay on their own surfaces.
- Red audit complete: 53 uses down to the critical drawdown breach,
  observation mode, run failure reason, a stress leg that did not survive and
  the briefing's CRITICAL DRAWDOWN row. Drawdown colour is relative to the
  arena's limit. Machine sells, guardrail blocks, weak dimensions, budget
  state and every loss are amber or plain.
- Glosses at first exposure: STANCE · YOUR MOVE, CONVICTION · HOW STRONGLY
  YOU BELIEVE IT, TURNOVER · TRADING BUDGET USED, PAR · MACHINE TARGET,
  DRAWDOWN · LOSS FROM PEAK.
- HOW THIS WAS SCORED is SEE WHY; the causal note leads the decomposition.
- Stance card prints PULL TO COMMIT; first two checkpoints also print
  TAP = SET PRECISELY · PULL = QUICK COMMIT.
- Thesis prompt copy and meter read as the market arriving, not a form
  expiring. Same fifteen seconds, same THESIS_UNSTATED.
- Hub is a launch surface: NEXT CHALLENGE with the current opponent, the
  START door, rank and XP on one line. Dimensions and the session record live
  on the Alpha Profile only (whose MACHINE BEAT RATE block was a typed fixture
  and now reads the profile). Ladder summary and module inventory removed;
  a module is acknowledged only as it unlocks. Builder is one line when locked.
- Arena Map: LOCKED / NEXT / DONE, machine-beaten as a mark on DONE. Legend
  and PLAYER PASS · CALIBRATING removed. Inspector in reading order. Columns
  stack below md.

## Next, in order

1. SHARPE gloss in the RISK panel (the other five are done).
2. Complete the numbered sequence: `1 STANCE / 2 CONVICTION / 3 COMMIT`.
3. Keyboard hints: about 20 visible at once. Keep them on tabs and the
   ActionZone; drop the per-card and per-slider hint text into the Help
   screen.
4. CP1 coach re-runs on the first checkpoint of every arena.
5. Briefing screen: CRITICAL DRAWDOWN, MAX SECTOR EXPOSURE, LEVERAGE,
   SHORT SELLING, TRAINING CUTOFF each get a gloss.
