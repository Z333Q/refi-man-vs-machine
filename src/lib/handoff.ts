import { getSessionId } from './supabase';
import { getFunnelAttribution } from './events';
import {
  marketingHandoffUrl, DEFAULT_SITE_URL, type IntendedDestination,
} from './handoffUrl';

export { marketingHandoffUrl, type IntendedDestination };

// Cloud Run mint-handoff service URL (set in the game's build env).
const HANDOFF_URL = import.meta.env.VITE_HANDOFF_URL as string | undefined;

// The public marketing site, used only when the mint service is not
// configured for this build.
const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? DEFAULT_SITE_URL;

/**
 * How this build hands a player over.
 *
 * MINTED  the mint service is configured: an opaque, single-use token carries
 *         the player's progress into the shell and binds it there (§4.4).
 * LINK    it is not: the exit is an ordinary marketing link, which cannot
 *         preserve progress or bind identity. The screens say so rather than
 *         promising something the build cannot do.
 *
 * The fallback exists because the alternative was worse. With no service URL
 * the exit threw on click, so the one control that carries a player out of the
 * game was dead in production and said nothing about why. A link is a smaller
 * promise, honestly labelled, and it upgrades itself the moment the service
 * URL is set.
 */
export const HANDOFF_MODE: 'MINTED' | 'LINK' = HANDOFF_URL ? 'MINTED' : 'LINK';

/**
 * Hand the player over to the formal product.
 *
 * In MINTED mode the token is single-use and short-lived; the shell verifies
 * it and binds the player's progress, and the redirect target comes back from
 * the service so it lives in one place, server-side.
 *
 * In LINK mode this is a plain navigation to the marketing site.
 */
export async function claimHandoff(
  intendedDestination: IntendedDestination = 'ELIGIBILITY',
): Promise<void> {
  if (!HANDOFF_URL) {
    window.location.assign(
      marketingHandoffUrl(intendedDestination, getFunnelAttribution(), SITE_URL),
    );
    return;
  }
  const res = await fetch(`${HANDOFF_URL.replace(/\/+$/, '')}/mint-handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
