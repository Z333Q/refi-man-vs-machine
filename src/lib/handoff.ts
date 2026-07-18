// Client side of the AlphaHandoffToken flow (§4.4, §2.2/§2.3).
//
// The token is a signed ES256 JWT minted by the `alpha-handoff` Supabase
// Edge Function (the browser cannot hold the signing key). The client sends
// the player's game progress, gets back the opaque JWT, and hands off to
// the investor shell's same-origin claim page — the shell's alpha-claim API
// rejects cross-origin POSTs, so the redirect target is a shell page that
// forwards the token to the API.
//
// The token carries only game metadata approved for import (§4.4) — never
// suitability or advisory data. Progress is best-effort from the current
// prototype; empty/false/0/null are all valid per the shell schema.

import { supabase } from './supabase';
import { emitEvent, getFunnelAttribution } from './events';
import { ensureAlphaPlayer } from './alphaIdentity';

export type HandoffDestination = 'ELIGIBILITY' | 'PAPER' | 'SIGNAL_INFO' | 'MANAGED_INFO';

export interface HandoffProgress {
  completedArenas: string[];
  machineBuilderUnlocked: boolean;
  machineVersionCount: number;
  machineBeatRate: number | null;
}

// Request a signed handoff token from the signer function. Emits
// conversion.refi_handoff_started. Returns the JWT, or null if the signer
// is unavailable (e.g. not yet deployed) so callers can degrade gracefully.
export async function requestHandoffToken(
  destination: HandoffDestination,
  progress: HandoffProgress,
): Promise<string | null> {
  const alphaPlayerId = ensureAlphaPlayer();
  const attribution = getFunnelAttribution();

  emitEvent('conversion.refi_handoff_started', { destination }, { alphaPlayerId });

  try {
    const { data, error } = await supabase.functions.invoke('alpha-handoff', {
      body: {
        alphaPlayerId,
        destination,
        campaignSource: attribution.campaign ?? attribution.ref,
        ...progress,
      },
    });
    if (error || !data?.token) {
      console.debug('alpha-handoff signer unavailable:', error?.message ?? 'no token');
      return null;
    }
    return data.token as string;
  } catch (err) {
    console.debug('alpha-handoff invoke threw', err);
    return null;
  }
}

const productBase = (): string =>
  import.meta.env.VITE_REFI_PRODUCT_URL ?? 'https://refi.trading';

// Same-origin shell page that forwards the token to the alpha-claim API.
export function handoffClaimUrl(token: string): string {
  return `${productBase()}/us/alpha-claim?token=${encodeURIComponent(token)}`;
}

// Fallback when no signed token is available: send the player to the
// waitlist intake so the game-led path still never traps them (§4.1).
export function handoffFallbackUrl(): string {
  return `${productBase()}/us/alpha-signup`;
}
