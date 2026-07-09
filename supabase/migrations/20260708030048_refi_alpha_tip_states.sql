/*
# User Tip States — ReFi Alpha Contextual Overlay System

## Purpose
Persists the state of every contextual tip overlay for each player session.
This enables the progressive tip system: tips are shown once, can be snoozed,
and are never repeated once completed or dismissed.

## New Tables

### user_tip_states
Tracks which tips have been seen, dismissed, completed, or snoozed per session.

Columns:
- id (uuid, pk) — row identifier
- session_id (text, not null) — player's localStorage session identifier (same as refi_session_id)
- tip_code (text, not null) — identifier for the tip (e.g. "FIRST_RUN_01_OBJECTIVE")
- tip_state (text, not null) — one of: UNSEEN, SHOWN, SNOOZED, DISMISSED, COMPLETED
- guidance_mode (text) — player's guidance preference: FULL, STANDARD, MINIMAL, OFF
- first_shown_at (timestamptz) — when the tip was first displayed
- last_shown_at (timestamptz) — most recent display
- completed_at (timestamptz) — when the player completed/dismissed it
- show_count (int, default 0) — how many times shown (for max_show_count enforcement)

Unique constraint on (session_id, tip_code) — one state row per tip per session.

### guidance_settings
Stores per-session guidance mode preference.

Columns:
- session_id (text, pk) — player session
- guidance_mode (text, not null, default 'FULL') — FULL | STANDARD | MINIMAL | OFF
- arenas_completed (int, default 0) — used to prompt guidance mode downgrade after 2 arenas
- updated_at (timestamptz)

## Security
- RLS enabled on both tables.
- Policies scoped to anon + authenticated (no sign-in required).
- Data is keyed by session_id — players can only read/write rows matching their session.
  Since this is a no-auth app, the data is session-scoped by convention (not enforced at DB level),
  using USING (true) for the anon client.

## Notes
1. session_id is a client-generated random string stored in localStorage.
2. All reads/writes come from the anon Supabase key — policies must include anon role.
3. The tip system uses localStorage as a fast read cache and Supabase as durable storage.
4. show_count is used to limit re-showing snoozed tips (max_show_count per tip definition).
*/

CREATE TABLE IF NOT EXISTS user_tip_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  tip_code text NOT NULL,
  tip_state text NOT NULL DEFAULT 'SHOWN',
  first_shown_at timestamptz DEFAULT now(),
  last_shown_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  show_count integer NOT NULL DEFAULT 1,
  CONSTRAINT user_tip_states_unique UNIQUE (session_id, tip_code),
  CONSTRAINT user_tip_states_state_check CHECK (tip_state IN ('UNSEEN', 'SHOWN', 'SNOOZED', 'DISMISSED', 'COMPLETED'))
);

CREATE INDEX IF NOT EXISTS idx_user_tip_states_session ON user_tip_states (session_id);
CREATE INDEX IF NOT EXISTS idx_user_tip_states_session_code ON user_tip_states (session_id, tip_code);

ALTER TABLE user_tip_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tip_states" ON user_tip_states;
CREATE POLICY "anon_select_tip_states" ON user_tip_states
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tip_states" ON user_tip_states;
CREATE POLICY "anon_insert_tip_states" ON user_tip_states
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tip_states" ON user_tip_states;
CREATE POLICY "anon_update_tip_states" ON user_tip_states
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tip_states" ON user_tip_states;
CREATE POLICY "anon_delete_tip_states" ON user_tip_states
  FOR DELETE TO anon, authenticated USING (true);

-- Guidance settings table
CREATE TABLE IF NOT EXISTS guidance_settings (
  session_id text PRIMARY KEY,
  guidance_mode text NOT NULL DEFAULT 'FULL',
  arenas_completed integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT guidance_mode_check CHECK (guidance_mode IN ('FULL', 'STANDARD', 'MINIMAL', 'OFF'))
);

ALTER TABLE guidance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_guidance" ON guidance_settings;
CREATE POLICY "anon_select_guidance" ON guidance_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_guidance" ON guidance_settings;
CREATE POLICY "anon_insert_guidance" ON guidance_settings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_guidance" ON guidance_settings;
CREATE POLICY "anon_update_guidance" ON guidance_settings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_guidance" ON guidance_settings;
CREATE POLICY "anon_delete_guidance" ON guidance_settings
  FOR DELETE TO anon, authenticated USING (true);
