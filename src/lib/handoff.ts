import { getSessionId } from './supabase';
import { getFirebaseIdToken } from './firebase';

export type IntendedDestination =
  | 'ELIGIBILITY'
  | 'PAPER'
  | 'SIGNAL_INFO'
  | 'MANAGED_INFO';

// Cloud Run mint-handoff service URL (set in the game's build env).
const HANDOFF_URL = import.meta.env.VITE_HANDOFF_URL as string | undefined;

/**
 * Mint an AlphaHandoffToken via the mint-handoff service and hand the player
 * off to the investor shell. The token is single-use and short-lived; the
 * shell verifies it and binds the player's progress. The shell URL comes back
 * from the service so the redirect target lives in one place (server-side).
 */
export async function claimHandoff(
  intendedDestination: IntendedDestination = 'ELIGIBILITY',
): Promise<void> {
  if (!HANDOFF_URL) {
    throw new Error('VITE_HANDOFF_URL is not configured');
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  // Attach the verified Firebase identity when available, so the shell binds a
  // real uid rather than the session id. No-ops if Firebase isn't configured.
  const idToken = await getFirebaseIdToken();
  if (idToken) headers['authorization'] = `Bearer ${idToken}`;

  const res = await fetch(`${HANDOFF_URL.replace(/\/+$/, '')}/mint-handoff`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId: getSessionId(),
      intendedDestination,
    }),
  });
  if (!res.ok) {
    throw new Error(`handoff mint failed (${res.status})`);
  }
  const data = (await res.json()) as { redirectUrl?: string };
  if (!data.redirectUrl) {
    throw new Error('handoff response missing redirectUrl');
  }
  window.location.assign(data.redirectUrl);
}
