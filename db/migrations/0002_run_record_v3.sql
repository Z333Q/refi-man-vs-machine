-- 0002: Run Record v3.
--
-- The client's Run Record grew three run-level facts and four per-decision
-- facts (src/lib/runRecord.ts, RUN_RECORD_VERSION 3): which opponent policy
-- the run faced, the compiled machine that rode along with its running
-- score, and at each checkpoint the opponent's stated reason plus the
-- deployed machine's own call. A replay that lacks them faces a different
-- opponent, so they are stored, not dropped.
--
-- Additive only. Every column has the value a v2 run truthfully carries: it
-- faced the authored opponent (the only kind that existed) and nothing rode
-- along, so AUTHORED and null are facts, not placeholders.

ALTER TABLE arena_runs
  ADD COLUMN IF NOT EXISTS opponent_policy jsonb NOT NULL DEFAULT '{"kind":"AUTHORED"}'::jsonb,
  ADD COLUMN IF NOT EXISTS deployed        jsonb,
  ADD COLUMN IF NOT EXISTS deployed_score  numeric(6,2);

ALTER TABLE checkpoint_decisions
  ADD COLUMN IF NOT EXISTS machine_reason       text,
  ADD COLUMN IF NOT EXISTS deployed_action_code text,
  ADD COLUMN IF NOT EXISTS deployed_reason      text,
  ADD COLUMN IF NOT EXISTS deployed_conviction  numeric(6,3);
