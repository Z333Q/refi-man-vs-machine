-- Canonical §58 objects (G0, §4.1 of the USA Build Integration Spec).
--
-- The prior RLS rewrite (20260716140000) hardened the Bolt-era prototype
-- tables. This migration adds the §58 canonical objects that did not yet
-- exist, so the data model matches CLAUDE.md §58 from G0:
--
--   alpha_players, alpha_sessions, alpha_handoffs, arenas,
--   arena_checkpoints, machine_benchmarks, player_machine_versions,
--   game_events
--
-- Prototype survivors already present and hardened by the RLS rewrite
-- (arena_runs, user_tip_states, player_profiles, alpha_profile_dimensions,
-- checkpoint_decisions, module_unlocks, daily_tape_submissions,
-- machine_ladder_progress, guidance_settings, securities, arena_universes)
-- are left as-is; §4.1 treats prototype data as disposable and defers the
-- arena_runs determinism columns (seed, versions) to G3 (§4.3).
--
-- RLS posture (§3.1):
--   player-owned  → owner_id uuid NOT NULL DEFAULT auth.uid() + own-row
--                   policies (alpha_players, player_machine_versions)
--   reference     → SELECT-only to authenticated; writes via service role
--                   (arenas, arena_checkpoints, machine_benchmarks)
--   identity/system → RLS on, no anon/authenticated policies; service role
--                   only (alpha_sessions, alpha_handoffs). alpha_handoffs
--                   holds token_hash and must never be client-readable.
--   audit sink    → game_events: append-only, INSERT allowed to anon +
--                   authenticated, NO select/update/delete (reads via
--                   service role). See the game_events note below.
--
-- ID-type reconciliation (§56 vs §58): the §56 event envelope uses string
-- ids (e.g. arena_id 'arena_covid_v1', session_id 'ses_...', event_id
-- 'evt_...'), while §58 types some columns as uuid. game_events is
-- populated NOW by the running prototype, whose identifiers are those
-- strings — so its id-reference columns are `text` to hold the §56
-- envelope verbatim (§4.2 mandates that envelope). The other new tables
-- are provisioned for the G2+ identity layer and are not yet written by
-- the app, so they keep §58's uuid keys.

BEGIN;

-- ─── alpha_players (player-owned) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alpha_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  formal_user_id uuid NULL,
  email_hash text NULL,
  handle text NULL,
  status text NOT NULL DEFAULT 'anonymous',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alpha_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.alpha_players FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own_insert" ON public.alpha_players FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own_update" ON public.alpha_players FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ─── alpha_sessions (identity/system, service role only) ─────────────────────
CREATE TABLE IF NOT EXISTS public.alpha_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alpha_player_id uuid NULL REFERENCES public.alpha_players(id) ON DELETE CASCADE,
  anonymous_progress_id uuid NOT NULL,
  device_id_hash text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alpha_sessions ENABLE ROW LEVEL SECURITY;
-- No policies: reads/writes go through service-role tooling only.

-- ─── alpha_handoffs (identity/system, service role only; holds token_hash) ───
CREATE TABLE IF NOT EXISTS public.alpha_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alpha_player_id uuid NOT NULL REFERENCES public.alpha_players(id) ON DELETE CASCADE,
  progress_snapshot_id uuid NOT NULL,
  destination text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  formal_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alpha_handoffs ENABLE ROW LEVEL SECURITY;
-- No policies: the AlphaHandoffToken flow (§2.2/§2.3) is service-role only.

-- ─── arenas (reference/content) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arenas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  version integer NOT NULL,
  difficulty integer NOT NULL,
  minimum_rank text NULL,
  status text NOT NULL,
  critical_drawdown numeric(8,6),
  max_position_weight numeric(8,6),
  max_sector_weight numeric(8,6),
  checkpoint_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON public.arenas FOR SELECT TO authenticated USING (true);

-- ─── arena_checkpoints (reference/content) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arena_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid REFERENCES public.arenas(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  simulation_start timestamptz NOT NULL,
  simulation_end timestamptz NOT NULL,
  event_packet_id uuid NOT NULL,
  decision_required boolean NOT NULL,
  adaptation_window integer NULL,
  UNIQUE(arena_id, sequence)
);
ALTER TABLE public.arena_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON public.arena_checkpoints FOR SELECT TO authenticated USING (true);

-- ─── machine_benchmarks (reference/content) ──────────────────────────────────
-- Benchmark provenance lives here (§5.1); UI reads numerals from these
-- rows, never from hard-coded copy (CLAUDE.md rule 14 / §3.4 gate 2).
CREATE TABLE IF NOT EXISTS public.machine_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_id text UNIQUE NOT NULL,
  display_name text NOT NULL,
  source_type text NOT NULL,
  generated_at timestamptz NOT NULL,
  source_run_id text NULL,
  universe_type text NOT NULL,
  symbol_count integer NOT NULL,
  symbols_hash text NOT NULL,
  first_trading_day date NOT NULL,
  last_trading_day date NOT NULL,
  business_days integer NOT NULL,
  long_allowed boolean NOT NULL,
  short_allowed boolean NOT NULL,
  cash_allowed boolean NOT NULL,
  model_version text NOT NULL,
  selector_version text NULL,
  cost_model_version text NOT NULL,
  stats_json jsonb NOT NULL
);
ALTER TABLE public.machine_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON public.machine_benchmarks FOR SELECT TO authenticated USING (true);

-- ─── player_machine_versions (player-owned) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.player_machine_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  alpha_player_id uuid REFERENCES public.alpha_players(id) ON DELETE CASCADE,
  machine_name text NOT NULL,
  version integer NOT NULL,
  configuration_json jsonb NOT NULL,
  build_hash text NOT NULL,
  locked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(alpha_player_id, machine_name, version)
);
ALTER TABLE public.player_machine_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.player_machine_versions FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own_insert" ON public.player_machine_versions FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own_update" ON public.player_machine_versions FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ─── game_events (append-only audit sink, §56 envelope) ──────────────────────
-- Id-reference columns are text to hold the §56 envelope's string ids
-- verbatim (see the ID-type reconciliation note above). No owner_id: this
-- is a system audit log, not player-owned state (§58 defines no owner_id
-- here). Analytics reads are service-role only, keeping game analytics
-- separate from formal investor records (§57).
CREATE TABLE IF NOT EXISTS public.game_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  event_version integer NOT NULL,
  occurred_at timestamptz NOT NULL,
  alpha_player_id text NULL,
  formal_user_id text NULL,
  session_id text NULL,
  arena_id text NULL,
  run_id text NULL,
  checkpoint_id text NULL,
  simulation_timestamp timestamptz NULL,
  correlation_id text NULL,
  causation_id text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

-- Append-only: anyone (anon during the pre-auth prototype, authenticated
-- after G2 magic-link auth) may INSERT an event; nobody may SELECT, UPDATE
-- or DELETE via the client. The envelope must emit from G0 (§4.2), and the
-- prototype runs unauthenticated, so anon INSERT is required now.
--
-- G2 tightening: once magic-link auth lands, drop the anon INSERT policy so
-- only authenticated principals can write, and add owner-scoped read for a
-- player's own events if a client-side history view is ever needed.
CREATE POLICY "events_append_only" ON public.game_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS game_events_type_idx        ON public.game_events (event_type);
CREATE INDEX IF NOT EXISTS game_events_occurred_at_idx ON public.game_events (occurred_at);
CREATE INDEX IF NOT EXISTS game_events_run_idx         ON public.game_events (run_id);
CREATE INDEX IF NOT EXISTS game_events_session_idx     ON public.game_events (session_id);
CREATE INDEX IF NOT EXISTS game_events_correlation_idx ON public.game_events (correlation_id);

-- ─── Verification ────────────────────────────────────────────────────────────
-- Player-owned canonical tables must not be anon-reachable, and identity
-- tables (alpha_sessions, alpha_handoffs) must expose no client policy at
-- all. Fail the migration otherwise.
DO $$
DECLARE
  leak_count int;
BEGIN
  SELECT count(*) INTO leak_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('alpha_players', 'player_machine_versions')
    AND ('anon' = ANY(roles) OR 'public' = ANY(roles));
  IF leak_count > 0 THEN
    RAISE EXCEPTION 'canonical_objects: % anon-reachable policies on player-owned tables', leak_count;
  END IF;

  SELECT count(*) INTO leak_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('alpha_sessions', 'alpha_handoffs');
  IF leak_count > 0 THEN
    RAISE EXCEPTION 'canonical_objects: % client policies on service-role-only identity tables', leak_count;
  END IF;
END $$;

COMMIT;
