import type { FunnelAttribution } from './events';

export type IntendedDestination =
  | 'ELIGIBILITY'
  | 'PAPER'
  | 'SIGNAL_INFO'
  | 'MANAGED_INFO';

/** The public marketing site, when no override is configured for the build. */
export const DEFAULT_SITE_URL = 'https://refi.trading';

/**
 * Where a link-mode exit sends the player.
 *
 * Marketing attribution only: source, medium, campaign, and the destination
 * the player asked for. No player id, no session id, no progress.
 *
 * §59 wants the funnel joined up without sensitive values riding in a query
 * string, and the whole reason §4.4 mints an opaque token server-side is that
 * identifiers do not belong in a URL. A fallback that quietly undid that would
 * be worse than the dead button it replaces, so this builder names every
 * parameter it emits and ignores everything else attribution happens to hold.
 *
 * It lives apart from handoff.ts deliberately: that module reads the build
 * environment at import time, which makes it unloadable outside a bundler.
 * The part with rules worth testing should not need a browser to run.
 */
export function marketingHandoffUrl(
  intendedDestination: IntendedDestination,
  attribution: FunnelAttribution = {},
  siteUrl: string = DEFAULT_SITE_URL,
): string {
  const url = new URL(siteUrl);
  url.searchParams.set('utm_source', attribution.source ?? 'alpha_game');
  url.searchParams.set('utm_medium', attribution.medium ?? 'game');
  if (attribution.campaign) url.searchParams.set('utm_campaign', attribution.campaign);
  url.searchParams.set('intent', intendedDestination.toLowerCase());
  return url.toString();
}
