# G1 Rework Spec: Addendum B (Accessibility Layer)

**Companion to:** `docs/g1-rework-spec.md` and `docs/g1-rework-spec-addendum-a.md`.
**Precedence:** This addendum supersedes Addendum A Section D (commit-flow state machine) and amends the base spec's PR2. Everything else in the base spec and Addendum A stands unchanged, including the correctness table, turnover economy, calibration math, par curve, and all CI gates. This is an interaction and language layer over an unchanged game.

## The standard every screen must pass

A first-time player on a phone commits their first decision within 20 seconds of first tap, having been required to read no more than 15 words, and can explain the core verb to a friend in one sentence. This is an acceptance criterion for PR2, verified in a moderated test, not an aspiration.

Design law extension: difficulty comes from the market, never from the interface, and **comprehension comes from the gesture, never from instructions.**

---

## B1. Pull-to-commit (replaces the card, thesis, slider, confirm chain)

The single verb: tap a stance card, pull, release.

**States:**

```
READ         signal visible, affordable stance cards rendered
GRIP         finger down on a card; card lifts, others dim
PULL         drag away from rest; conviction meter fills 50 to 95
             with the drag distance; card visually strains
             (scale + tension line); haptic tick at each step of 5
RELEASE      commit fires at the meter's current value
CANCEL       drag back below the grip threshold, or release
             within it: no commit, card settles back
RESOLVE      existing pipeline reveal (machine line vs your line)
THESIS       post-release quick-pick, see B2
LEARN        score card, then NEXT SIGNAL (immediate)
```

**Mechanics:**
- Conviction maps linearly from minimum pull distance (50) to full stretch (95), step 5. CP1 to CP4 clamp to [60, 75] per Addendum A; the pull range compresses accordingly and the meter shows the narrower band.
- Minimum pull to commit corresponds to conviction 50 (60 while clamped); a tap without pull never commits.
- The meter renders numerically and as fill during PULL, so the felt tension and the recorded number are always the same fact.
- An unaffordable card (turnover, per Addendum A E2) renders flat, cost shown, and does not enter GRIP.
- Disabled and reduced-motion path: any card can instead be activated to a focused state where a plain slider plus a COMMIT button appears (the pre-B flow, minus the separate confirm). This is also the keyboard path: 1..4 focus a card, arrows set conviction, Enter commits. Pointer-drag is an enhancement, never the only path; this is the a11y requirement, not a fallback afterthought.
- Desktop pointer users get the same drag; the slider path is always one keystroke away.
- No confirm step in either path. The pull distance is the confirmation; a deliberate stretch is not an accidental tap. Escape or drag-back cancels.

**Why thesis moved:** asking "why" before the commitment invites post-hoc rationalization of a choice not yet made; asking immediately after release, before the reveal, captures the actual reason at the moment of maximum honesty and removes a reading step from the critical path.

## B2. Thesis quick-pick (post-release, pre-reveal)

Immediately on RELEASE, one line: `WHY?` plus the 2 to 3 authored thesis options for the chosen stance as single-tap chips, plain language (B3 register). One tap, then the reveal runs. A 5-second no-tap timeout records `THESIS_UNSTATED` (new ThesisCode) rather than blocking the reveal; unstated theses feed the Alpha Profile as their own signal (decisiveness without articulated reasoning is itself a behavioral dimension). Fix the HOLD_REASONS label/code mismatch here as originally ordered in PR2 item 3.

## B3. Plain-language register (content copy pass, own PR, founder sign-off)

Two registers exist for every checkpoint. The plain register is what renders by default; the terminal register (existing authored copy: tickers, VIX, wire feed) renders inside earned modules (B4).

Rules for the plain register:
- Signal headline: 15 words maximum, no tickers, no acronyms, present tense. CP1: `January 2020. A strange virus is in the news. Your $100,000 is fully invested.`
- Stance card plain labels: verb-first, everyday English, 6 words maximum. CP1: `Do nothing` / `Sell the travel stocks` / `Move some money to cash` / `Switch to safer stocks`. The authored `shortLabel`/`label` become the terminal-register sublabels, revealed once NEWSWIRE is online.
- Jargon is loot: the first time a term would appear (VIX, drawdown, circuit breaker, QE), it unlocks as a one-line glossary chip the player can tap, and thereafter renders in terminal register. Never define in a modal that blocks play.
- Numbers the player must feel stay as money, not percentages, until the RISK module is online: `You're down $8,400` before `Drawdown -8.4%`.
- This pass covers all 14 checkpoints in both registers and is a content PR (call it PR2.5-copy) requiring Zeshan's review before merge; it is brand voice.

## B4. The earned terminal (new PR2.5, between PR2 and PR3)

The interface is the progression system. First run starts nearly empty: plain headline, price chart, stance cards, budget meter. Panels come online as authored unlocks with the existing `module_unlocks` plumbing:

| Unlock moment | Module | What appears |
|---|---|---|
| Complete CP2 | NEWSWIRE | wire feed panel + terminal-register sublabels |
| Complete Background Noise phase | MARKET DATA | tickers/VIX table |
| First GOOD_PROCESS flag | RISK CONSOLE | risk panel + percent register |
| Existing XP unlocks | CORRELATION MATRIX, REGIME SCANNER, STAGED EXECUTION | as currently authored |

Unlock presentation: one line, `MODULE ONLINE: NEWSWIRE`, panel powers on with a boot flicker (reduced-motion: instant with the same line). Investigation-pays scoring (base spec PR2 item 5) applies only once the relevant module is online. Second and later runs start with all previously earned modules online; the terminal is earned once per player, not per run.

## B5. Machine voice, failure lines, and the next-level pull

- After each reveal where the player's delta is strongly negative, the machine gets exactly one deadpan line, authored per checkpoint (never generated), 10 words maximum, dry, never cruel, no exclamation marks. Register example, CP9 panic-sell: `You sold. I held. Volatility is not information.` These lines are content, live in the checkpoint rows, and are part of the PR2.5-copy founder review.
- Every LEARN screen ends with the tease: `NEXT: {authored one-line hook}` over a darkened date chip. CP4's hook: `NEXT: the fastest crash in history.` Authored per checkpoint in the same copy pass.
- ArenaMapScreen is repurposed as the between-phase interstitial: fourteen nodes, six phase groupings, cleared nodes lit, current node pulsing. Shown at phase boundaries only, skippable with one tap.

## B6. Scope and sequencing

- PR2 (amended): pull-to-commit + slider/keyboard parity path + thesis quick-pick + HOLD_REASONS fix + investigation plumbing. The state machine above replaces Addendum A Section D. Acceptance: the 20-second standard, plus all existing PR2 criteria.
- PR2.5-copy: dual-register content pass, machine failure lines, next-level hooks. Founder sign-off gate.
- PR2.5-terminal: earned-module gating of panels. Small; rides the existing unlock plumbing.
- PR3 through PR5: unchanged.
- Fixture scripts (Addendum A, Section F) are unchanged; conviction values in fixtures map to pull distances one-to-one, and the F2 affordability assertions now also assert the unaffordable card never enters GRIP.
