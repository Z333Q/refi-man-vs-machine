// ─── Claimed identity (browser side) ──────────────────────────────────────────
//
// What this device knows about the player's claimed profile: their handle and
// the account it belongs to. Not a credential, and not an authority — the
// server decides who somebody is on every request. This is a cache so the
// interface can say "@z333q" without a round trip.
//
// It is deliberately separate from alphaIdentity.ts, which mints a local
// alp_... id for legacy telemetry continuity. That id is not an account and
// never was: it authorises nothing, it is not known to any server, and after
// this PR nothing in the interface calls it "saved". One concept of an
// account, and it is this one.

import { getCredential } from './auth/credential';
import { getSessionId } from './identity';

const CLAIMED_KEY = 'refi_claimed_profile';

export interface ClaimedProfile {
  userId: string;
  handle: string;
  displayName: string | null;
}

export type ClaimOutcome =
  | { kind: 'CLAIMED'; profile: ClaimedProfile }
  /** The account already had a profile; its existing name is unchanged. */
  | { kind: 'ALREADY_CLAIMED'; profile: ClaimedProfile; requestedOther: boolean }
  | { kind: 'HANDLE_UNAVAILABLE' }
  | { kind: 'HANDLE_REJECTED'; message: string }
  | { kind: 'NOT_AUTHENTICATED' }
  | { kind: 'UNAVAILABLE' };

export function claimedProfile(): ClaimedProfile | null {
  try {
    const raw = localStorage.getItem(CLAIMED_KEY);
    return raw ? (JSON.parse(raw) as ClaimedProfile) : null;
  } catch {
    return null;
  }
}

function remember(profile: ClaimedProfile): void {
  try {
    localStorage.setItem(CLAIMED_KEY, JSON.stringify(profile));
  } catch {
    // The account exists on the server either way; this is only a label.
  }
}

/**
 * Claim a handle for the authenticated player.
 *
 * One call, one server transaction. The response decides the outcome: this
 * function never infers success from a request having been sent, because the
 * whole point of the claim is that the account is real afterwards.
 */
export async function claimProfile(
  apiUrl: string,
  handle: string,
  displayName?: string,
): Promise<ClaimOutcome> {
  if (!getCredential()) return { kind: 'NOT_AUTHENTICATED' };

  let res: Response;
  try {
    res = await fetch(`${apiUrl.replace(/\/+$/, '')}/v1/identity/claim`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-alpha-session': getSessionId(),
        authorization: `Bearer ${getCredential() ?? ''}`,
      },
      body: JSON.stringify({ handle, ...(displayName ? { displayName } : {}) }),
    });
  } catch {
    return { kind: 'UNAVAILABLE' };
  }

  if (res.status === 401) return { kind: 'NOT_AUTHENTICATED' };
  if (res.status === 409) return { kind: 'HANDLE_UNAVAILABLE' };
  if (res.status === 422) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { kind: 'HANDLE_REJECTED', message: body.error ?? 'that handle cannot be used' };
  }
  if (!res.ok) return { kind: 'UNAVAILABLE' };

  const body = (await res.json()) as {
    outcome: string;
    userId: string;
    profile: { handle: string; displayName: string | null };
  };
  const profile: ClaimedProfile = {
    userId: body.userId,
    handle: body.profile.handle,
    displayName: body.profile.displayName,
  };
  remember(profile);

  if (body.outcome === 'CLAIMED') return { kind: 'CLAIMED', profile };
  return {
    kind: 'ALREADY_CLAIMED',
    profile,
    requestedOther: body.outcome === 'ALREADY_CLAIMED_OTHER_HANDLE',
  };
}
