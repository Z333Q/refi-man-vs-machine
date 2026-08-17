# Work Order: feat/verified-identity cleanup

**Status:** DRAFT FOR FOUNDER REVIEW. Nothing in this document has been
executed, and no identity change will be made without sign-off.

**Slot:** between step 04d (medals) and step 06 (Daily Tape).

**Why it needs a work order rather than a task:** identity decides which
database the four player-owned tables can live in, whether the game and the
investor product share an auth boundary, and what a handoff token binds to.
Getting it wrong is expensive in a way that a UI change is not.

---

## 1. What exists today

| Item | State |
|---|---|
| PR #5 `feat/alpha-identity` | Open, head `613bdc6`, never merged |
| Branch `feat/verified-identity` | Local only, never pushed, sits at `783a869` |
| Worktree `worktree-verified-identity-rebase` | Locked worktree at `b9dea83`, tracks `origin/feat/alpha-identity-rebased` |
| Archived cherry-pick | `/tmp/refi-pre-cleanup-*` holds the aborted `613bdc6` cherry-pick, conflict stages for `services/handoff/src/server.ts`, and an older `runEngine.ts` |
| `src/lib/firebase.ts` | Exists on the identity branches, not on `main` |

The aborted cherry-pick was archived and reverted during the recovery work.
`613bdc6` is PR #5's head and is safely on `origin/feat/alpha-identity`, so
nothing was lost.

## 2. The decision this work order exists to force

The four player-owned tables (`player_profiles`,
`alpha_profile_dimensions`, `daily_tape_submissions`, `user_tip_states`) write
direct from the browser under Supabase RLS keyed to `auth.uid()`. They cannot
move to Neon without an identity provider, because `auth.uid()` and
`auth.users` are Supabase's `auth` schema and Neon has none.

`game_events` is already portable: append-only, no owner, no RLS dependency.

So the fork is:

**Option A. Firebase Auth as the identity provider.**
Player state moves to Neon behind Neon's JWT authorization, or behind the
handoff service. One identity system across game and product. Highest effort,
matches the GCP destination, and PR #5 is already most of the groundwork.

**Option B. Supabase keeps player state permanently.**
Neon owns telemetry only. Lowest effort, two data planes forever, and the
`auth.uid()` model stays as the game's identity.

**Option C. Anonymous-only game identity.**
No auth in the game at all. Player state is device-local, the handoff token is
the only thing that crosses into the product, and §4.4's `alpha_player_id`
binds at the product boundary rather than in the game. Cheapest, and arguably
the most faithful reading of §4.3 stage 1, which says an anonymous player
should not be pushed into formal onboarding to save a game.

Recommendation, for the founder to accept or reject: **C for the game, with A
at the product boundary.** §4.4 already says progress-save should be "a
lightweight, reversible lead identity" and explicitly warns against building a
second identity system that cannot reconcile. Option C keeps the game free of
an auth system it does not need, and leaves the binding where the spec already
puts it.

## 3. Cleanup tasks, once the decision is made

1. Resolve PR #5: merge, close, or rebase onto current `main`. It has been open
   across the entire recovery and is now far behind.
2. Delete the local `feat/verified-identity` branch, or push it if the work is
   wanted. It has never been pushed and exists only on this machine.
3. Release the locked `worktree-verified-identity-rebase` worktree.
4. Decide whether `src/lib/firebase.ts` lands on `main`.
5. Re-home or discard the archived cherry-pick material once PR #5 is resolved.
6. Record the outcome as an amendment if it changes §4.4.

## 4. Explicitly out of scope until signed off

- Any change to `services/handoff` signing or token binding.
- Any migration of the four player-owned tables.
- Any change to the RLS model.
- Merging, closing or rebasing PR #5.
