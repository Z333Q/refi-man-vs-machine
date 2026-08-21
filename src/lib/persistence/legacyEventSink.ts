import { createClient } from '@supabase/supabase-js';
import type { EventEnvelope } from '../eventBuffer';

// ─── Legacy telemetry sink ────────────────────────────────────────────────────
//
// The last vendor-specific code in the browser, quarantined in one file.
//
// Of everything the browser used to write remotely, this is the only call that
// succeeds: game_events accepts anonymous inserts, while every player-state
// write is rejected by owner-scoped policies the game cannot satisfy because it
// never authenticates. Removing this today would throw away the one working
// integration and gain nothing, so it stays until /v1/events exists.
//
// It is isolated rather than merged into the port implementations so that step
// is a single deletion: drop this file, drop the dependency, drop the two
// VITE_SUPABASE_* variables. The coupling gate
// (scripts/vendor-coupling-gate.mjs) allows the vendor import here and nowhere
// else, so the surface cannot grow back while it waits.

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const client = URL_ && KEY ? createClient(URL_, KEY) : null;

export const legacyEventSink = {
  configured: client !== null,

  async deliverEvent(envelope: EventEnvelope): Promise<boolean> {
    if (!client) return false;
    try {
      const { error } = await client.from('game_events').insert(envelope);
      if (error) {
        console.debug('game_events insert failed', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.debug('game_events insert threw', err);
      return false;
    }
  },
};
