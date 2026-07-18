// AlphaHandoffToken — the one-way bridge from the game into formal ReFi
// onboarding (§4.4, §1.1). The token is opaque: only its id travels in the
// URL, never sensitive profile fields. The formal product exchanges the id
// server-side (the investor shell's `alpha-claim` seam) and binds
// alpha_player_id → formal user_id, preserving game progress.
//
// This module builds and records the token client-side and emits the
// conversion funnel event. It deliberately does NOT auto-redirect — the
// caller decides when to leave, so top-of-funnel traffic is never leaked
// away accidentally. Persisting the token row is service-role work (§3.2);
// the anon best-effort insert no-ops until then.

import { supabase } from './supabase';
import { emitEvent, getFunnelAttribution } from './events';
import { ensureAlphaPlayer } from './alphaIdentity';

export type HandoffDestination = 'ELIGIBILITY' | 'PAPER' | 'SIGNAL_INFO' | 'MANAGED_INFO';

export interface AlphaHandoffToken {
  handoffId: string;
  alphaPlayerId: string;
  expiresAt: string;
  progressSnapshotId: string;
  campaignSource?: string;
  intendedDestination: HandoffDestination;
}

const HANDOFF_TTL_MS = 15 * 60 * 1000; // 15-minute opaque, expiring token

function mkId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

// Build a handoff token for the intended destination, emit
// `conversion.refi_handoff_started`, and best-effort persist the row.
// `nowMs` is injectable for deterministic tests; defaults to wall clock.
export function buildHandoffToken(
  destination: HandoffDestination,
  nowMs: number = Date.now(),
): AlphaHandoffToken {
  const alphaPlayerId = ensureAlphaPlayer();
  const attribution = getFunnelAttribution();
  const token: AlphaHandoffToken = {
    handoffId: mkId('hof'),
    alphaPlayerId,
    expiresAt: new Date(nowMs + HANDOFF_TTL_MS).toISOString(),
    progressSnapshotId: mkId('snap'),
    campaignSource: attribution.campaign ?? attribution.ref,
    intendedDestination: destination,
  };

  emitEvent(
    'conversion.refi_handoff_started',
    { destination, handoffId: token.handoffId },
    { alphaPlayerId },
  );

  void supabase
    .from('alpha_handoffs')
    .insert({
      destination,
      token_hash: token.handoffId, // hashed server-side in the real flow
      expires_at: token.expiresAt,
      progress_snapshot_id: token.progressSnapshotId,
    })
    .then(({ error }) => {
      if (error) console.debug('alpha_handoffs insert is service-role only:', error.message);
    });

  return token;
}

// The opaque redirect URL into the formal product. Carries only the handoff
// id — never profile fields (§4.4). Product base is configurable.
export function handoffRedirectUrl(token: AlphaHandoffToken): string {
  const base = import.meta.env.VITE_REFI_PRODUCT_URL ?? 'https://refi.trading';
  return `${base}/alpha-claim?handoff=${encodeURIComponent(token.handoffId)}`;
}
