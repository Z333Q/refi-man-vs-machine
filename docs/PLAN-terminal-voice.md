# Plan: Terminal Voice + Weight Graphics (4 days, 2026-08-24 → 27)

**Branch:** `worktree-terminal-voice` off origin/main (b650466).
**Design source of truth:** https://claude.ai/code/artifact/2947b7a0-cc41-4e33-a9ef-0359ce4d61b9
("The Terminal Speaks" — owner-approved 2026-08-24).

## Direction (settled with owner)

The game's personality is the terminal itself. At consequence beats a window
"takes the floor" like a retro dialog box:

- box wakes in chunky steps (`steps(5)`, 240ms);
- a **thin zigzag outline** (1.4px stroke, SVG mask, no fills) ticks around it
  at cursor cadence — `steps(1)`, one tooth per beat;
- text arrives teletype (~9ms/char, ~140ms at line breaks);
- then the border settles to a hairline.
- **One cursor on screen, ever** — blinking at the end of what the player
  should be reading (the active speech, else the decision point).
- **Moods** = colour + tick rate only. CALM phosphor 1s (boot, score, tape) ·
  MEASURED amber 1.5s (the machine, speaks as "I") · ALERT amber .5s
  (guardrail) · SOMBER dim 2s (autopsy). Red is never a mood (§32.2).
- Rejected by owner, do not reintroduce: scope waveform, solid teeth, corner
  ornaments, glow, Bloomberg density pass.

## Fit with what main already ships (surveyed 2026-08-24)

- `tapePath.ts` + `ResolutionRace` = the "tape draws itself" idea. SHIPPED.
- `verdict.ts` = the checkpoint's one-line lesson with sign-matching law.
  SHIPPED — it becomes the *content source* for the score moment's speech.
- `CashReservoir` exists but is only reachable via `VisualEventLayer`.
- `machinePet.ts` (4-posture pup) ships in the Builder. Untouched by this work.
- Addendum B law: ≤15 words required reading before first commit; comprehension
  from the gesture, never instructions. → Windows speak ONLY at consequence
  beats (reveal, score, autopsy, boot, guardrail block), never in the decision
  path, and lines stay ≤2 beats.
- CI gates apply to new copy: **no em dash in player-facing strings**
  (em-dash-gate), label-gate, viewport-gate.

## Day 1 (Sun 24) — the voice substrate

- `src/lib/terminalVoice.ts` — pure floor logic: single speaker, queue,
  beat-gating (cannot speak during SIMULATING / SCORING / reveal-pending).
  No Date / Math.random / setTimeout in this module; a source-reading test
  enforces it (same pattern as `machinePet.test.ts`).
- `src/components/ui/TalkingWindow.tsx` — chrome, wake steps, zigzag mask
  border, teletype, mood classes; CSS into `index.css`. Reduced motion:
  full text instantly, border static.
- One-cursor manager: single `.cur` app-wide, owned by the active speaker.
- Floor shared with the tip system (never a tip and a speech at once, §11).
- Wire moment #1: **machine reveal** speaks as "I" (measured), replacing the
  random-noise decrypt in `MachineReveal.tsx` with the approved teletype.
- Exit: reveal talks in dev; `npm test` green incl. new tests; gates pass.

## Day 2 (Mon 25) — weight graphics

- `WeightBlocks` — positions as `█` block rows (weight-proportional), draft
  ghost blocks `▒`, stepped one-block-per-tick transitions. Replaces the
  percentage column in the CoreLoop portfolio panel.
- Mount `CashReservoir` permanently in the portfolio panel; drafts preview,
  commits move blocks between positions and the tank.
- Property tests: blocks sum exactly to bar width; weights + cash = 100%;
  ghost preview never exceeds buying power.
- Exit: portfolio readable with zero percentages on the panel.

## Day 3 (Tue 26) — the remaining moments

- BOOT (calm) in BootScreen; CHECKPOINT SCORE speaks `verdict.ts` lines
  (calm); GUARDRAIL block (alert) via the VisualEventLayer trigger; AUTOPSY
  verdict (somber); DAILY TAPE next-day reveal (brisk).
- Every line cites run-record data (a number or a fired rule, §57). No
  hardcoded flavour that cannot cite.
- One-voice audit: tips, speeches, spotlights never overlap.
- Exit: a full COVID run plays with all moments speaking in turn.

## Day 4 (Wed 27) — audit, verify, ship

- §62 pass (reduced motion everywhere, keyboard, focus, never colour-alone).
- Perf sanity on the zigzag masks + teletype; no layout thrash.
- `npm run ci-gates` + `npm test` + `npm run typecheck` + build + e2e.
- Sweep for stray blink/typewriter one-offs competing with the substrate.
- PR with screenshots; update this doc's status.

## Out of bounds

machinePet changes · Bloomberg density / command line / numbered menus ·
constellation changes · engine or scoring changes · new arenas · sound ·
the scope waveform (rejected).
