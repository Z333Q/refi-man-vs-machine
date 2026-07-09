/*
# ReFi Alpha Game Schema

## Overview
Complete persistence layer for the ReFi Alpha historical market game.
Supports anonymous play (via session_id) and authenticated users.
All tables use anon+authenticated RLS so the game works without login.

## New Tables

### player_profiles
Stores per-user progression: Alpha XP, rank, machine beat rate, archetype.
Keyed by either user_id (authenticated) or session_id (anonymous).

### alpha_profile_dimensions
Individual behavioral dimension scores (stock selection, position sizing, etc.)
Built from decision history across all runs.

### arena_runs
Each attempt at a historical arena. Tracks state, scores, critical failures.
Links to player via session_id or user_id.

### checkpoint_decisions
Every committed decision within a run: action, thesis, confidence, orders.
The raw material for autopsy and alpha profile computation.

### module_unlocks
Which terminal analytical modules a player has earned.
Modules unlock based on arena completion and XP thresholds.

### daily_tape_submissions
Player answers to the Daily Market Tape puzzle.
Stores submission for next-day reveal comparison.

### machine_ladder_progress
Tracks which machines the player has faced and their win/loss record.

## Security
All tables: RLS enabled.
All policies: TO anon, authenticated (game works without login).
No user_id ownership checks — this is a shared/anonymous game state pattern.
session_id in localStorage is the player identity for anonymous runs.
*/

-- Player profiles: core progression state
CREATE TABLE IF NOT EXISTS player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handle text,
  alpha_xp integer NOT NULL DEFAULT 0,
  rank_code text NOT NULL DEFAULT 'INITIATE',
  machine_beats integer NOT NULL DEFAULT 0,
  machine_attempts integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  archetype text,
  decision_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_player_profiles" ON player_profiles;
CREATE POLICY "anon_select_player_profiles" ON player_profiles FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_player_profiles" ON player_profiles;
CREATE POLICY "anon_insert_player_profiles" ON player_profiles FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_player_profiles" ON player_profiles;
CREATE POLICY "anon_update_player_profiles" ON player_profiles FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- Alpha profile dimensions: per-dimension behavioral scores
CREATE TABLE IF NOT EXISTS alpha_profile_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  dimension_code text NOT NULL,
  score numeric(5,2) NOT NULL DEFAULT 50,
  sample_size integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, dimension_code)
);

ALTER TABLE alpha_profile_dimensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_alpha_dims" ON alpha_profile_dimensions;
CREATE POLICY "anon_select_alpha_dims" ON alpha_profile_dimensions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_alpha_dims" ON alpha_profile_dimensions;
CREATE POLICY "anon_insert_alpha_dims" ON alpha_profile_dimensions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_alpha_dims" ON alpha_profile_dimensions;
CREATE POLICY "anon_update_alpha_dims" ON alpha_profile_dimensions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- Arena runs: each game session attempt
CREATE TABLE IF NOT EXISTS arena_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  arena_id text NOT NULL DEFAULT 'covid_black_swan',
  machine_id text NOT NULL DEFAULT 'refi_rules',
  state text NOT NULL DEFAULT 'ACTIVE',
  mode text NOT NULL DEFAULT 'STANDARD',
  current_checkpoint integer NOT NULL DEFAULT 0,
  total_checkpoints integer NOT NULL DEFAULT 22,
  portfolio_value numeric(18,4) NOT NULL DEFAULT 100000,
  cash_weight numeric(8,6) NOT NULL DEFAULT 0.20,
  drawdown numeric(8,6) NOT NULL DEFAULT 0,
  turnover_used numeric(8,6) NOT NULL DEFAULT 0,
  player_score numeric(6,2),
  machine_score numeric(6,2),
  result text,
  critical_failure boolean NOT NULL DEFAULT false,
  behavioral_flags jsonb NOT NULL DEFAULT '[]',
  seed bigint NOT NULL DEFAULT extract(epoch from now()),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE arena_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_arena_runs" ON arena_runs;
CREATE POLICY "anon_select_arena_runs" ON arena_runs FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_arena_runs" ON arena_runs;
CREATE POLICY "anon_insert_arena_runs" ON arena_runs FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_arena_runs" ON arena_runs;
CREATE POLICY "anon_update_arena_runs" ON arena_runs FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- Checkpoint decisions: every committed decision
CREATE TABLE IF NOT EXISTS checkpoint_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES arena_runs(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  checkpoint_sequence integer NOT NULL,
  action_code text NOT NULL,
  thesis_code text,
  confidence numeric(4,3),
  invalidation_condition text,
  orders jsonb NOT NULL DEFAULT '[]',
  portfolio_snapshot jsonb NOT NULL DEFAULT '{}',
  modules_consulted text[] NOT NULL DEFAULT '{}',
  decision_quality text,
  score_contribution numeric(6,2),
  machine_action_code text,
  machine_reasoning text[],
  behavioral_flags text[] NOT NULL DEFAULT '{}',
  committed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, checkpoint_sequence)
);

ALTER TABLE checkpoint_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_checkpoint_decisions" ON checkpoint_decisions;
CREATE POLICY "anon_select_checkpoint_decisions" ON checkpoint_decisions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_checkpoint_decisions" ON checkpoint_decisions;
CREATE POLICY "anon_insert_checkpoint_decisions" ON checkpoint_decisions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_checkpoint_decisions" ON checkpoint_decisions;
CREATE POLICY "anon_update_checkpoint_decisions" ON checkpoint_decisions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- Module unlocks: which analytical tools the player has earned
CREATE TABLE IF NOT EXISTS module_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  module_code text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  xp_at_unlock integer,
  UNIQUE(session_id, module_code)
);

ALTER TABLE module_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_module_unlocks" ON module_unlocks;
CREATE POLICY "anon_select_module_unlocks" ON module_unlocks FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_module_unlocks" ON module_unlocks;
CREATE POLICY "anon_insert_module_unlocks" ON module_unlocks FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- Daily tape submissions
CREATE TABLE IF NOT EXISTS daily_tape_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  tape_date date NOT NULL,
  tape_id text NOT NULL,
  action_code text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  score_revealed boolean NOT NULL DEFAULT false,
  player_score numeric(6,2),
  machine_score numeric(6,2),
  crowd_distribution jsonb,
  UNIQUE(session_id, tape_date)
);

ALTER TABLE daily_tape_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_daily_tape" ON daily_tape_submissions;
CREATE POLICY "anon_select_daily_tape" ON daily_tape_submissions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_daily_tape" ON daily_tape_submissions;
CREATE POLICY "anon_insert_daily_tape" ON daily_tape_submissions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_daily_tape" ON daily_tape_submissions;
CREATE POLICY "anon_update_daily_tape" ON daily_tape_submissions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- Machine ladder progress
CREATE TABLE IF NOT EXISTS machine_ladder_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  machine_id text NOT NULL,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'LOCKED',
  last_played_at timestamptz,
  UNIQUE(session_id, machine_id)
);

ALTER TABLE machine_ladder_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_machine_ladder" ON machine_ladder_progress;
CREATE POLICY "anon_select_machine_ladder" ON machine_ladder_progress FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_machine_ladder" ON machine_ladder_progress;
CREATE POLICY "anon_insert_machine_ladder" ON machine_ladder_progress FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_machine_ladder" ON machine_ladder_progress;
CREATE POLICY "anon_update_machine_ladder" ON machine_ladder_progress FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arena_runs_session ON arena_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_decisions_run ON checkpoint_decisions(run_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_decisions_session ON checkpoint_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_alpha_dims_session ON alpha_profile_dimensions(session_id);
CREATE INDEX IF NOT EXISTS idx_daily_tape_date ON daily_tape_submissions(tape_date);
CREATE INDEX IF NOT EXISTS idx_module_unlocks_session ON module_unlocks(session_id);
