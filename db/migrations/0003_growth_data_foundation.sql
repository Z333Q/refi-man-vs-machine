-- 0003: Growth data foundation.
--
-- The durable primitives the growth layer needs before any growth feature
-- exists: a public identity that survives its session, a handle reservation
-- that survives its owner, session-scoped attribution, sticky experiment
-- assignment, and an outbox for work that must not be lost. Nothing here is
-- read by a screen yet, which is the point: the measurement substrate lands
-- before the things it measures, so nothing has to be backfilled from
-- memory later.
--
-- Migration ownership (REFI_ALPHA_GROWTH_ARCHITECTURE.md §7). This file owns
-- exactly what PR B owns. It creates no table a later PR owns, and it holds
-- no foreign key to a table a later migration creates:
--
--   growth_campaigns.season_id     ADDED IN 0005 (ALTER), not here
--   acquisition_touches.challenge_id  ADDED IN 0004 (ALTER), not here
--
-- Authorization is unchanged and stays in the API (db/README.md): no
-- row-level policies, no vendor auth schema, no auth.uid(). The service
-- resolves a verified principal, maps it to app_users.id, and scopes every
-- query. RLS remains available later as defence in depth, keyed to a
-- ReFi-owned session variable, never to a vendor function.
--
-- Additive and re-runnable, like 0002: applying the whole directory to a
-- database at any earlier step is safe.

BEGIN;

-- ─── Public identity ─────────────────────────────────────────────────────────
--
-- player_profiles (keyed by session_id, 0001) remains the anonymous
-- progression record. This is the durable social identity, keyed to the
-- person. The two coexist: at claim time the pre-claim placeholder handle is
-- copied, not moved, because the session record must keep meaning on its own.
--
-- Handle law (§7.1): 3 to 20 characters, stored lowercase, a-z 0-9 and
-- underscore, first and last character alphanumeric. The regex is the whole
-- law in one place: it fixes the length (1 + 1..18 + 1), forbids uppercase,
-- and so makes case-insensitive uniqueness follow from ordinary uniqueness
-- rather than from a second normalised column that could disagree with this
-- one.
--
-- Reserved names are deliberately not a CHECK. The list is policy that
-- changes without a deploy, let alone a migration, and it belongs to the API
-- (PR E).
--
-- The reservation table comes first because the profile depends on it. That
-- ordering is the invariant: a name is reserved permanently, and only then
-- can somebody be seen to hold it.

-- Every handle a person has ever held, and the reason this table is separate
-- from the profile: a retired handle is never reassigned, during or after the
-- account's life (§7.1). So the handle is the primary key and it is permanent,
-- while user_id is nullable and merely records who holds it now.
--
-- ON DELETE SET NULL rather than CASCADE is the whole mechanism. Deleting an
-- account empties the row without releasing the name, which is what lets the
-- route layer answer a dead /@handle with a neutral unavailable response
-- instead of handing the name to whoever asks next.
--
-- released_at is null while the handle is current. The rename that closes one
-- row and opens the next happens in a single transaction, in the API (PR E);
-- this file only makes that shape storable.
CREATE TABLE IF NOT EXISTS player_handle_history (
  handle       text PRIMARY KEY,
  user_id      uuid REFERENCES app_users(id) ON DELETE SET NULL,
  held_from    timestamptz NOT NULL DEFAULT now(),
  released_at  timestamptz,
  CONSTRAINT player_handle_history_handle_check
    CHECK (handle ~ '^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$'),
  -- Redundant as uniqueness, since handle is already the primary key. It
  -- exists to be a foreign-key target: the profile references the holder of
  -- a reservation, not merely the existence of one. See the key below.
  CONSTRAINT player_handle_history_holder_unique UNIQUE (user_id, handle)
);

COMMENT ON TABLE player_handle_history IS
  'Permanent handle reservations. The handle row outlives the account (user_id becomes NULL) so a retired handle is never reassigned.';

-- Every handle a live account holds, and the row the ON DELETE SET NULL has
-- to find. Without it, deleting an app_user scans this table once per
-- referencing constraint.
CREATE INDEX IF NOT EXISTS player_handle_history_user_idx
  ON player_handle_history (user_id);

-- One current handle per living account. The profile's UNIQUE handle already
-- makes two people unable to hold the same name; this makes one person unable
-- to hold two names at once, so a rename that forgets to close the old row
-- fails in the same transaction that opened the new one rather than leaving
-- two live reservations behind.
CREATE UNIQUE INDEX IF NOT EXISTS player_handle_history_one_current_idx
  ON player_handle_history (user_id)
  WHERE released_at IS NULL AND user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public_player_profiles (
  user_id       uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  -- UNIQUE keeps two people off one name. The foreign key below keeps one
  -- person off a name nobody reserved.
  handle        text NOT NULL UNIQUE,
  -- Separate from the handle and Unicode-capable on purpose: the handle is an
  -- address, the display name is a name. It is not unique, and its policy
  -- (length, normalisation, impersonation) is API-side for the same reason
  -- the reserved list is.
  display_name  text,
  avatar_url    text,
  bio           text,
  -- 'friends' is absent until a friend or crew relationship exists and the
  -- API can enforce it. Shipping an authorization state with no authorization
  -- semantics would be a promise the server cannot keep.
  visibility    text NOT NULL DEFAULT 'public',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_player_profiles_handle_check
    CHECK (handle ~ '^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$'),
  CONSTRAINT public_player_profiles_visibility_check
    CHECK (visibility IN ('public', 'private')),
  -- The invariant, not a convenience, and it is deliberately on the pair
  -- rather than on the handle alone.
  --
  -- Without any key here the two tables agree only for as long as the
  -- application remembers to write both, and the failure is silent and
  -- delayed: a claim that skipped the reservation looks perfectly healthy
  -- until the account is deleted, at which point the profile cascades away,
  -- no reservation was ever written, and a name somebody held for years is
  -- free again.
  --
  -- A key on the handle alone would close that and leave a second door open.
  -- After an account is deleted its reservation survives with user_id NULL,
  -- so the row still exists, and a key that only asked "is this handle
  -- reserved" would let the next person wear a retired name without ever
  -- holding it. Referencing (user_id, handle) asks the question that
  -- matters: is this handle reserved BY THIS PERSON. An emptied reservation
  -- matches nobody, which is exactly what retired means.
  --
  -- No ON DELETE action on purpose: a reservation cannot be deleted while a
  -- live profile still uses it. Account deletion does not need one, because
  -- app_users empties the reservation rather than removing it, and the
  -- profile has already cascaded away by the time this key is rechecked at
  -- the end of the statement.
  CONSTRAINT public_player_profiles_handle_reserved_fkey
    FOREIGN KEY (user_id, handle)
    REFERENCES player_handle_history (user_id, handle)
);

COMMENT ON TABLE public_player_profiles IS
  'Durable public identity for a claimed player. Cascades with the user; the handle reservation in player_handle_history does not.';

-- The claim and the rename both run reservation first, profile second, in one
-- transaction (PR E). The foreign key makes that ordering mandatory rather
-- than remembered.

-- ─── Attribution and campaigns ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS growth_campaigns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text NOT NULL UNIQUE,
  kind           text NOT NULL,
  -- SET NULL, not the default NO ACTION: a creator can close their account,
  -- and the campaign that ran is still a fact about how players arrived. The
  -- default would make deleting that account fail instead, which contradicts
  -- the deletion path §7.1 requires to work.
  creator_id     uuid REFERENCES app_users(id) ON DELETE SET NULL,
  arena_id       text,
  creator_score  numeric(6,2),
  -- season_id is ADDED IN 0005 (ALTER). seasons does not exist yet and a
  -- forward reference here would make this migration unappliable.
  starts_at      timestamptz,
  ends_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_campaigns_kind_check
    CHECK (kind IN ('creator', 'partner', 'paid', 'organic', 'internal'))
);

-- Campaigns are looked up by the slug that appears in a link, one row at a
-- time, on the landing path. UNIQUE already indexes it; noted here so nobody
-- adds a second index for the same access path.

CREATE INDEX IF NOT EXISTS growth_campaigns_creator_idx
  ON growth_campaigns (creator_id);

-- How a session arrived, and what later made it matter. Keyed by session and
-- never copied to the user: attribution resolves through game_sessions.user_id
-- like everything else, so claiming an identity cannot rewrite the history of
-- how the player got here (§7.4).
CREATE TABLE IF NOT EXISTS acquisition_touches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  source        text,
  medium        text,
  campaign      text,
  content       text,
  term          text,
  referrer      text,
  landing_path  text,
  -- No ON DELETE action on purpose: a campaign that has been credited with
  -- arrivals cannot be deleted out from under them. Campaigns end, they do
  -- not disappear.
  campaign_id   uuid REFERENCES growth_campaigns(id),
  -- challenge_id is ADDED IN 0004 (ALTER). challenges does not exist yet.
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acquisition_touches_kind_check
    CHECK (kind IN ('first', 'meaningful'))
);

-- First touch wins, and the database says so. The client already refuses to
-- overwrite a capture; this makes a second writer, a retry, or a later
-- service unable to manufacture a second origin story for one session.
-- Meaningful touches stay unconstrained: there can be many.
CREATE UNIQUE INDEX IF NOT EXISTS acquisition_touches_one_first_idx
  ON acquisition_touches (session_id)
  WHERE kind = 'first';

CREATE INDEX IF NOT EXISTS acquisition_touches_session_idx
  ON acquisition_touches (session_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS acquisition_touches_campaign_idx
  ON acquisition_touches (campaign_id, occurred_at DESC);

-- ─── Experiments ─────────────────────────────────────────────────────────────
--
-- Sticky to the session and resolving to the person through the session link,
-- so claiming an identity never moves a player between variants mid-test
-- (§13). The primary key is the stickiness: a second assignment for the same
-- experiment is a conflict, not an update.
CREATE TABLE IF NOT EXISTS experiment_assignments (
  session_id     text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  experiment_id  text NOT NULL,
  variant        text NOT NULL,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, experiment_id)
);

-- ─── Outbox ──────────────────────────────────────────────────────────────────
--
-- Durable async work: a row is written in the same transaction as the fact it
-- describes, and a worker forwards it afterwards. No worker ships in this PR;
-- the table exists so that when one does, the events it should have forwarded
-- are already there rather than lost to a process that was not running.
CREATE TABLE IF NOT EXISTS outbox_events (
  id            bigserial PRIMARY KEY,
  topic         text NOT NULL,
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

-- The only query a worker makes: the oldest unprocessed rows, in order. A
-- partial index holds the backlog alone, so the scan stays the size of the
-- work outstanding rather than the size of everything ever forwarded.
CREATE INDEX IF NOT EXISTS outbox_events_pending_idx
  ON outbox_events (id)
  WHERE processed_at IS NULL;

-- ─── Telemetry contract ──────────────────────────────────────────────────────
--
-- The §51 envelope grows one field: which experiment variants the player was
-- in when the event happened (§11). Without it an experiment can be measured
-- only by re-joining assignments as they stand today, which is a different
-- question from what the player was actually shown.
--
-- Nullable with no default, deliberately. NULL means the emitter did not
-- report assignments; '{}' means it reported none. Defaulting would rewrite
-- every event emitted before PR D into a claim nobody made.
--
-- Still no foreign keys, still append-only: an event may arrive before the
-- row it names or after that row is gone, and a sink that can reject a write
-- loses data exactly when it is most interesting.
ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS experiment_assignments jsonb;

-- The ruled contract is a mapping of experiment id to variant. jsonb accepts
-- any JSON value, so without this an array, a number or a bare string is a
-- legal envelope, and the writer that produced it would be found by whoever
-- later tried to read the column as a map.
ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_experiment_assignments_object;
ALTER TABLE game_events
  ADD CONSTRAINT game_events_experiment_assignments_object
  CHECK (experiment_assignments IS NULL
         OR jsonb_typeof(experiment_assignments) = 'object');

COMMIT;
