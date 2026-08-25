-- ─── ReFi Alpha founding schema ──────────────────────────────────────────────
--
-- Provider-neutral PostgreSQL. Nothing here names an identity vendor, an
-- auth schema, or a hosting product, and nothing should: the point of this
-- file is that the database can move between Cloud SQL, another managed
-- PostgreSQL, or a local one, without the application noticing.
--
-- It replaces the prior migrations rather than amending them. Those depended
-- on a vendor's auth schema in three ways that do not travel: foreign keys
-- into auth.users, column defaults calling auth.uid(), and policies granted to
-- the vendor's anon and authenticated roles. The prototype data they guarded
-- is disposable, and in practice empty: every write the browser could make was
-- rejected by those policies, because the game has never authenticated anyone.
--
-- ── Identity is three concepts, not one ──
--
--   app_users        the person. Owns nothing about how they logged in.
--   user_identities  each way they can log in. One user, many providers.
--   game_sessions    a browser playing the game, with or without an account.
--
-- Collapsing these into one table with `external_subject` and
-- `identity_provider` columns would assume a single external identity per
-- user, and that assumption breaks the first time somebody signs in with
-- Google having previously used email, or an enterprise tenant arrives with
-- SAML. Splitting them costs one join and removes a migration.
--
-- ── Anonymous play is the default, not a degraded mode ──
--
-- A game_session exists before any account does and owns progress on its own.
-- Linking is an explicit act that sets user_id and linked_at; nothing is
-- copied and nothing is thrown away. A player can finish the entire game
-- without ever creating an account, which is the conversion design (§4.1), not
-- an accident of implementation.
--
-- ── Authorization lives in the API ──
--
-- There are no row-level policies here. The service resolves the principal
-- from a verified token, maps it to app_users.id, and scopes every query. RLS
-- itself is ordinary PostgreSQL and remains available as defence in depth
-- later, but it would key on a ReFi-owned session variable set by the API, not
-- on a vendor function. Adding it now would only re-import the coupling this
-- file exists to remove.

BEGIN;

-- ─── Identity ────────────────────────────────────────────────────────────────

CREATE TABLE app_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_status_check
    CHECK (status IN ('active', 'suspended', 'closed'))
);

COMMENT ON TABLE app_users IS
  'A person. Knows nothing about how they authenticate; see user_identities.';

-- One row per way a user can sign in. A user with Google, email and an
-- enterprise SSO tenant has three rows and one app_users id.
--
-- `provider` is an opaque string owned by the application ("google",
-- "password", "microsoft", a SAML tenant id). It is deliberately not an enum:
-- adding a provider must not require a migration.
CREATE TABLE user_identities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  -- The provider's own stable id for this person. Never an email: emails
  -- change hands, subjects do not.
  subject         text NOT NULL,
  email           text,
  email_verified  boolean,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz,
  CONSTRAINT user_identities_provider_subject_unique UNIQUE (provider, subject)
);

CREATE INDEX user_identities_user_idx ON user_identities (user_id);

-- A browser playing the game. The id is the anonymous continuity token the
-- client generates and sends as x-alpha-session.
--
-- Security note, because the name invites the wrong assumption: this is
-- continuity, not authentication. It is generated client-side, it is not a
-- secret, and it proves nothing about who is holding it. It may scope
-- anonymous progress. It must never authorize anything that matters once an
-- account exists: those operations resolve the principal from a verified token
-- and use user_id.
CREATE TABLE game_sessions (
  id            text PRIMARY KEY,
  user_id       uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  -- When this session was attached to an account. Null while the player has
  -- not signed up, which is a supported end state.
  --
  -- It is deliberately not cleared when the account goes away: linked_at is
  -- the historical fact that a link happened, and user_id is the current
  -- owner. The pair (null user, non-null linked_at) is meaningful, and it is
  -- exactly what the ON DELETE SET NULL above produces when an account is
  -- closed. An earlier revision required the two to be null together, which
  -- made closing an account impossible: the cascade nulled user_id, the check
  -- rejected the row, and the DELETE failed. Caught by db/schema.test.ts.
  linked_at     timestamptz,
  CONSTRAINT game_sessions_link_records_when
    CHECK (user_id IS NULL OR linked_at IS NOT NULL)
);

CREATE INDEX game_sessions_user_idx ON game_sessions (user_id);

-- ─── Player progress ─────────────────────────────────────────────────────────
--
-- Keyed to the session, which reaches the account through game_sessions when
-- there is one. That ordering is what lets a player play first and decide
-- later.

CREATE TABLE player_profiles (
  session_id       text PRIMARY KEY REFERENCES game_sessions(id) ON DELETE CASCADE,
  handle           text,
  alpha_xp         integer NOT NULL DEFAULT 0,
  rank_code        text NOT NULL DEFAULT 'INITIATE',
  machine_beats    integer NOT NULL DEFAULT 0,
  machine_attempts integer NOT NULL DEFAULT 0,
  current_streak   integer NOT NULL DEFAULT 0,
  best_streak      integer NOT NULL DEFAULT 0,
  archetype        text,
  decision_streak  integer NOT NULL DEFAULT 0,
  last_active_date date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE alpha_profile_dimensions (
  session_id     text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  dimension_code text NOT NULL,
  score          numeric(5,2) NOT NULL DEFAULT 50,
  sample_size    integer NOT NULL DEFAULT 0,
  last_updated   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, dimension_code)
);

CREATE TABLE module_unlocks (
  session_id   text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  module_code  text NOT NULL,
  unlocked_at  timestamptz NOT NULL DEFAULT now(),
  xp_at_unlock integer,
  PRIMARY KEY (session_id, module_code)
);

CREATE TABLE machine_ladder_progress (
  session_id     text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  machine_id     text NOT NULL,
  wins           integer NOT NULL DEFAULT 0,
  losses         integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'LOCKED',
  last_played_at timestamptz,
  PRIMARY KEY (session_id, machine_id),
  CONSTRAINT machine_ladder_status_check
    CHECK (status IN ('LOCKED', 'ACTIVE', 'DEFEATED'))
);

CREATE TABLE user_tip_states (
  session_id     text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  tip_code       text NOT NULL,
  tip_state      text NOT NULL DEFAULT 'SHOWN',
  first_shown_at timestamptz DEFAULT now(),
  last_shown_at  timestamptz DEFAULT now(),
  completed_at   timestamptz,
  show_count     integer NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, tip_code),
  CONSTRAINT user_tip_states_state_check
    CHECK (tip_state IN ('UNSEEN', 'SHOWN', 'SNOOZED', 'DISMISSED', 'COMPLETED'))
);

CREATE TABLE guidance_settings (
  session_id       text PRIMARY KEY REFERENCES game_sessions(id) ON DELETE CASCADE,
  guidance_mode    text NOT NULL DEFAULT 'FULL',
  arenas_completed integer NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guidance_mode_check
    CHECK (guidance_mode IN ('FULL', 'STANDARD', 'MINIMAL', 'OFF'))
);

CREATE TABLE daily_tape_submissions (
  session_id         text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  tape_date          date NOT NULL,
  tape_id            text NOT NULL,
  action_code        text NOT NULL,
  submitted_at       timestamptz NOT NULL DEFAULT now(),
  score_revealed     boolean NOT NULL DEFAULT false,
  player_score       numeric(6,2),
  machine_score      numeric(6,2),
  crowd_distribution jsonb,
  -- One decision per tape per session: the daily tape is one call a day (§6.3).
  PRIMARY KEY (session_id, tape_date)
);

-- ─── Runs and decisions ──────────────────────────────────────────────────────

CREATE TABLE arena_runs (
  -- The client mints the run id (run_<24 hex>) when the run begins, and the Run
  -- Record, telemetry envelope, and this row all carry the same string. A
  -- server-side uuid default would mint a second identity for the same run.
  id                 text PRIMARY KEY,
  session_id         text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  arena_id           text NOT NULL,
  machine_id         text NOT NULL,
  state              text NOT NULL DEFAULT 'ACTIVE',
  mode               text NOT NULL DEFAULT 'STANDARD',
  current_checkpoint integer NOT NULL DEFAULT 0,
  total_checkpoints  integer NOT NULL,
  portfolio_value    numeric(18,4) NOT NULL,
  cash_weight        numeric(8,6) NOT NULL,
  drawdown           numeric(8,6) NOT NULL DEFAULT 0,
  -- No default: zero volatility is a real claim, not a neutral missing value.
  -- Even the canonical starting portfolio is non-zero here, so a writer that
  -- omits volatility must fail rather than silently manufacture an audit fact.
  volatility         numeric(8,6) NOT NULL,
  turnover_used      numeric(8,6) NOT NULL DEFAULT 0,
  player_score       numeric(6,2),
  machine_score      numeric(6,2),
  result             text,
  critical_failure   boolean NOT NULL DEFAULT false,
  -- Which checkpoint breached the risk budget; null when the run never failed.
  critical_failure_checkpoint integer,
  behavioral_flags   jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- The determinism anchor: a run replays from its seed (§65).
  seed               bigint NOT NULL,
  started_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  -- When this mirror row last changed. Ordering and audit metadata only:
  -- conflict resolution is local-authoritative, never a timestamp comparison.
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX arena_runs_session_idx ON arena_runs (session_id, started_at DESC);

CREATE TABLE checkpoint_decisions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                 text NOT NULL REFERENCES arena_runs(id) ON DELETE CASCADE,
  checkpoint_sequence    integer NOT NULL,
  action_code            text NOT NULL,
  thesis_code            text,
  confidence             numeric(4,3),
  invalidation_condition text,
  orders                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  portfolio_snapshot     jsonb NOT NULL DEFAULT '{}'::jsonb,
  modules_consulted      text[] NOT NULL DEFAULT '{}',
  decision_quality       text,
  score_contribution     numeric(6,2),
  machine_action_code    text,
  machine_reasoning      text[],
  behavioral_flags       text[] NOT NULL DEFAULT '{}',
  turnover_cost          numeric(8,6),
  -- Wall-clock commit time, stamped by the client when the player commits.
  -- Null for decisions recorded before commit times were captured; a server
  -- default would fabricate a commit time the player never made.
  committed_at           timestamptz,
  -- The session is reachable through the run; storing it again would be a
  -- second source of truth for the same fact.
  CONSTRAINT checkpoint_decisions_unique UNIQUE (run_id, checkpoint_sequence)
);

CREATE TABLE player_machine_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  machine_name       text NOT NULL,
  version            integer NOT NULL,
  configuration_json jsonb NOT NULL,
  build_hash         text NOT NULL,
  locked_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_machine_versions_unique UNIQUE (session_id, machine_name, version)
);

-- ─── Handoff into the investor product ───────────────────────────────────────
--
-- The token is opaque and single-use; only its hash is stored, so a leaked
-- table does not yield usable tokens (§4.4).

CREATE TABLE handoffs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES app_users(id) ON DELETE SET NULL,
  destination    text NOT NULL,
  token_hash     text NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  consumed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT handoffs_destination_check
    CHECK (destination IN ('ELIGIBILITY', 'PAPER', 'SIGNAL_INFO', 'MANAGED_INFO'))
);

CREATE INDEX handoffs_session_idx ON handoffs (session_id, created_at DESC);

-- ─── Reference data ──────────────────────────────────────────────────────────
--
-- Authored content, identical for every player. Written by deploy tooling,
-- read by everyone.

CREATE TABLE arenas (
  code                text PRIMARY KEY,
  name                text NOT NULL,
  version             integer NOT NULL DEFAULT 1,
  difficulty          integer NOT NULL,
  minimum_rank        text,
  status              text NOT NULL DEFAULT 'ACTIVE',
  critical_drawdown   numeric(8,6),
  max_position_weight numeric(8,6),
  max_sector_weight   numeric(8,6),
  checkpoint_count    integer NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE arena_checkpoints (
  arena_code       text NOT NULL REFERENCES arenas(code) ON DELETE CASCADE,
  sequence         integer NOT NULL,
  simulation_start timestamptz NOT NULL,
  simulation_end   timestamptz NOT NULL,
  event_packet_id  text NOT NULL,
  decision_required boolean NOT NULL DEFAULT true,
  adaptation_window integer,
  PRIMARY KEY (arena_code, sequence)
);

-- Benchmark claims are rendered from versioned records, never hard-coded in
-- UI copy (§26.1, §27).
CREATE TABLE machine_benchmarks (
  benchmark_id       text PRIMARY KEY,
  display_name       text NOT NULL,
  source_type        text NOT NULL,
  generated_at       timestamptz NOT NULL,
  source_run_id      text,
  universe_type      text NOT NULL,
  symbol_count       integer NOT NULL,
  symbols_hash       text NOT NULL,
  first_trading_day  date NOT NULL,
  last_trading_day   date NOT NULL,
  business_days      integer NOT NULL,
  long_allowed       boolean NOT NULL,
  short_allowed      boolean NOT NULL,
  cash_allowed       boolean NOT NULL,
  model_version      text NOT NULL,
  selector_version   text,
  cost_model_version text NOT NULL,
  stats_json         jsonb NOT NULL,
  CONSTRAINT machine_benchmarks_source_check
    CHECK (source_type IN (
      'ANALYZE_API', 'RESEARCH_PAPER', 'HISTORICAL_WALK_FORWARD', 'GAME_RULES_ENGINE'
    ))
);

-- U.S.-listed common equities only (§2.1). The check is the scope rule made
-- structural rather than left to reviewers.
CREATE TABLE securities (
  symbol       text PRIMARY KEY,
  name         text NOT NULL,
  sector       text,
  industry     text,
  asset_class  text NOT NULL DEFAULT 'US_EQUITY',
  listed_from  date,
  listed_until date,
  CONSTRAINT securities_us_equity_only CHECK (asset_class = 'US_EQUITY')
);

CREATE TABLE arena_universes (
  arena_code text NOT NULL REFERENCES arenas(code) ON DELETE CASCADE,
  symbol     text NOT NULL REFERENCES securities(symbol) ON DELETE CASCADE,
  PRIMARY KEY (arena_code, symbol)
);

-- ─── Telemetry ───────────────────────────────────────────────────────────────
--
-- Append-only sink for the §51 envelope. Id columns are text because the
-- envelope's ids are strings and rewriting them into uuids at the boundary
-- would lose the value the client actually sent.
--
-- No foreign keys: an event may arrive before the row it mentions, or after
-- that row is deleted, and telemetry that can reject a write is telemetry that
-- loses data at exactly the moment it is most interesting. Game analytics stay
-- a separate taxonomy from formal investor records (§52).
CREATE TABLE game_events (
  event_id             text PRIMARY KEY,
  event_type           text NOT NULL,
  event_version        integer NOT NULL,
  occurred_at          timestamptz NOT NULL,
  alpha_player_id      text,
  formal_user_id       text,
  session_id           text,
  arena_id             text,
  run_id               text,
  checkpoint_id        text,
  simulation_timestamp timestamptz,
  correlation_id       text,
  causation_id         text,
  payload              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX game_events_type_time_idx ON game_events (event_type, occurred_at DESC);
CREATE INDEX game_events_session_idx ON game_events (session_id, occurred_at DESC);

COMMIT;
