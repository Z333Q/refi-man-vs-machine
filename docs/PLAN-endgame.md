# Endgame sprint: the connective tissue

Owner audit, 2026-09-06: the late game exists but is not connected. Builder,
stress test, gauntlet, TACO's five rounds, the ladder and the arenas are all
real. What is missing is the wiring that makes them one progression. No new
arenas. No new panels or routes where an existing surface can carry the fact.

Two rulings taken as accepted when the owner said "proceed with your plan":

1. **Policy Writer is removed from the progression**, not built. TACO Round 5's
   KEEP / MODIFY / SUSPEND rule actions carry the "write policy" idea.
2. **The deployed machine plays alongside the player.** ReFi Rules stays the
   opponent. The player's compiled machine rides along in every run, decides
   every checkpoint from the same information cutoff, and is scored on the
   same rubric, so the run answers "what would my rules have done here" at
   every reveal and "did my machine beat me" at the end.

## Law

- Fair Match (spec 26.5): the deployed machine and every policy-driven
  opponent see only the current checkpoint, act in the long/cash action set,
  pay the same turnover costs, and are scored by `scoreCheckpoint`.
- Deterministic: shadow agents are pure functions of config, checkpoint and
  their own portfolio. A record replays byte-for-byte.
- Honest labels: a rules machine is GAME_RULES_ENGINE. Exhibition rungs get
  no rules-engine runtime, because a rules engine standing in for RF/RL would
  be the fabricated benchmark spec 26.1 forbids.
- One home per rule: unlock arithmetic lives in `progressionLaw.ts`.

## Steps

1. **Deploy the compiled machine.** Compile is deploy: the latest compiled
   version rides along in the next run. `RunState.deployed` +
   `deployedAgent` (its own portfolio and running score). Each decision
   records the machine's action, reason and conviction. Reveal shows YOUR
   MACHINE's call under the opponent's. Run complete and the autopsy compare
   three scores. Run record v3 carries it; replays reproduce it.
2. **Ladder policies.** `MachineBenchmark` rungs resolve to an
   `OpponentPolicy`: AUTHORED (ReFi Rules, the authored content), HOLD (S&P
   500 passive: buy and hold, now playable as spec 28's Level 0). Exhibition
   rungs stay unplayable by design. Current opponent is the highest rung
   reached, so beating Rules does not demote the Hub to the index.
3. **Real TACO gate.** `tacoUnlocked` derives from run records (four regimes
   complete), machine versions (one compiled), the basket store (one locked)
   and the gauntlet store (one run). The unlock screen renders the real
   status of each and refuses entry until all hold. The map applies the same
   gate to arena 05 and routes through the unlock screen. Locking a basket
   returns to the profile.
4. **Persist the basket.** `basket.ts` store with hash and lock time. The
   universe is U.S. equities only (spec 2.1): ETFs, bonds and gold are gone.
   The profile shows the locked basket. Limitation stated in code: the policy
   engine acts on authored checkpoint effects, not per-symbol prices, so the
   basket is a prerequisite artifact and a record, not yet an input to the
   machine's decisions.
5. **Finale.** `gameCompleted` (TACO finished). The Alpha Profile becomes the
   conclusion: completion banner, per-regime results (you, machine, your
   machine), machine beat rate, and the spec 4.6 primary handoff as the
   primary action. The Hub already reads EVERY REGIME COMPLETE.
6. **Policy Writer** references removed: map side branch, module strip,
   terminal modules, module code.
