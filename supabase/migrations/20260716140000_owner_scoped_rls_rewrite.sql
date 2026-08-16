-- Owner-scoped RLS rewrite (G0, §3.1 of the USA Build Integration Spec).
--
-- Baseline problem: every player table in the Bolt-era migrations was
-- created with `TO anon, authenticated USING (true) WITH CHECK (true)`.
-- That policy shape lets the shipped anon key read and write every
-- player's rows. This migration replaces those policies with owner-
-- scoped RLS keyed to `auth.uid()` and locks reference tables to
-- SELECT-only for authenticated users.
--
-- Ordering note: this migration assumes the tables were created by the
-- prior three Bolt-era migrations. If the new ReFi-owned Supabase
-- project consolidates those into a single founding migration (per
-- spec §3.0), the permissive policies should never be created in the
-- first place and this rewrite becomes unnecessary. This file exists
-- so the prototype instance can be hardened without a clean rebuild.
--
-- Data note: prototype data is disposable per §4.1. Orphan rows that
-- exist before this migration runs are backfilled to a fixed quarantine
-- owner (`00000000-0000-0000-0000-000000badd1e`) so the CASCADE FKs
-- attach cleanly. That user does not authenticate; its rows are
-- effectively read-locked and can be dropped by service-role tooling.

BEGIN;

-- ─── Quarantine owner ────────────────────────────────────────────────────────
-- A stable, sentinel UUID for orphan prototype rows. Not a real auth user;
-- NOTE: the final group is exactly 12 hex digits (6 zeros + badd1e). An
-- earlier revision carried 13 and was rejected by Postgres with 22P02
-- invalid input syntax for type uuid, which aborted this whole migration:
-- the handler below only catches insufficient_privilege, so a malformed
-- literal is fatal rather than skipped. Validated by
-- supabase/migrations.test.ts.
-- Postgres FKs still resolve if we insert into auth.users with a fixed id
-- (schema privileges permitting). If your instance doesn't allow direct
-- inserts into auth.users, run this block via a service-role migration
-- runner (e.g. `supabase db reset`) rather than as an anon-scoped call.

DO $$
BEGIN
  INSERT INTO auth.users (id, aud, role, email, created_at, updated_at, confirmation_sent_at)
  VALUES (
    '00000000-0000-0000-0000-000000badd1e',
    'authenticated',
    'authenticated',
    'prototype-quarantine@refi.trading',
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN insufficient_privilege THEN
  -- Managed instance won't let us write auth.users; assume the runner is
  -- doing this via service-role and the quarantine user was seeded there.
  RAISE NOTICE 'auth.users insert skipped (insufficient privilege) — seed quarantine user via service-role tooling';
END $$;

-- ─── Helper: add owner_id + rewrite policies for a player-owned table ────────
-- Idempotent. Adds owner_id with NOT NULL DEFAULT auth.uid() + FK CASCADE,
-- drops every existing policy on the table, and creates own-row policies
-- for SELECT / INSERT / UPDATE. Runs are immutable history — no DELETE
-- policy — corrections are appended, not overwritten.

CREATE OR REPLACE FUNCTION _refi_rewrite_player_table(tbl regclass) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  pol record;
  tbl_name text := split_part(tbl::text, '.', -1);
BEGIN
  -- 1. Add owner_id if missing.
  EXECUTE format(
    'ALTER TABLE %s ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE',
    tbl
  );

  -- 2. Backfill orphan rows to the quarantine owner. NULL owner_ids
  --    can only exist if the column was just added or a prior write
  --    bypassed the default.
  EXECUTE format(
    'UPDATE %s SET owner_id = %L WHERE owner_id IS NULL',
    tbl, '00000000-0000-0000-0000-000000badd1e'
  );

  -- 3. Now enforce NOT NULL and the default. Default is auth.uid() so
  --    every new row is owner-stamped by the session's real principal.
  EXECUTE format('ALTER TABLE %s ALTER COLUMN owner_id SET NOT NULL', tbl);
  EXECUTE format('ALTER TABLE %s ALTER COLUMN owner_id SET DEFAULT auth.uid()', tbl);

  -- 4. Drop every existing policy on the table so the world-writable
  --    ones can't slip through.
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl_name
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol.policyname, tbl);
  END LOOP;

  -- 5. Ensure RLS is on.
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);

  -- 6. Own-row policies (authenticated only; anon has no access to
  --    player-owned tables in the post-rewrite world).
  EXECUTE format(
    'CREATE POLICY "own_select" ON %s FOR SELECT TO authenticated USING (owner_id = auth.uid())',
    tbl
  );
  EXECUTE format(
    'CREATE POLICY "own_insert" ON %s FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())',
    tbl
  );
  EXECUTE format(
    'CREATE POLICY "own_update" ON %s FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())',
    tbl
  );
END $$;

-- ─── Player-owned tables ─────────────────────────────────────────────────────
-- Every table where a row represents one player's private state.

SELECT _refi_rewrite_player_table('public.player_profiles');
SELECT _refi_rewrite_player_table('public.alpha_profile_dimensions');
SELECT _refi_rewrite_player_table('public.arena_runs');
SELECT _refi_rewrite_player_table('public.checkpoint_decisions');
SELECT _refi_rewrite_player_table('public.module_unlocks');
SELECT _refi_rewrite_player_table('public.daily_tape_submissions');
SELECT _refi_rewrite_player_table('public.machine_ladder_progress');
SELECT _refi_rewrite_player_table('public.user_tip_states');
SELECT _refi_rewrite_player_table('public.guidance_settings');

DROP FUNCTION _refi_rewrite_player_table(regclass);

-- ─── Reference tables ────────────────────────────────────────────────────────
-- Content authored by ReFi via service-role migrations; readable by any
-- authenticated user. Anon has no direct access; leaderboard reads must
-- go through a service-role Edge Function per §3.1 of the spec.

DO $$
DECLARE
  ref_tbl text;
  pol record;
BEGIN
  FOREACH ref_tbl IN ARRAY ARRAY['securities', 'arena_universes'] LOOP
    -- Drop any existing anon-permissive policies.
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = ref_tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, ref_tbl);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', ref_tbl);
    EXECUTE format(
      'CREATE POLICY "authenticated_read" ON public.%I FOR SELECT TO authenticated USING (true)',
      ref_tbl
    );
    -- No INSERT / UPDATE / DELETE policies. Writes require service role,
    -- which bypasses RLS by design.
  END LOOP;
END $$;

-- ─── Verification ────────────────────────────────────────────────────────────
-- Fail the migration if any player-owned table is still reachable by anon.
-- This is a belt-and-suspenders check; the drop-and-rewrite above should
-- have taken care of it, but a stray migration authored against this
-- database in the future would trip this.

DO $$
DECLARE
  leak_count int;
BEGIN
  SELECT count(*) INTO leak_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'player_profiles', 'alpha_profile_dimensions', 'arena_runs',
      'checkpoint_decisions', 'module_unlocks', 'daily_tape_submissions',
      'machine_ladder_progress', 'user_tip_states', 'guidance_settings'
    )
    AND ('anon' = ANY(roles) OR 'public' = ANY(roles));

  IF leak_count > 0 THEN
    RAISE EXCEPTION 'RLS rewrite verification failed: % anon-reachable policies remain on player-owned tables', leak_count;
  END IF;
END $$;

COMMIT;
