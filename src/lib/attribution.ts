// ─── Attribution parsing ──────────────────────────────────────────────────────
//
// How a session arrived, decided by rules rather than by whatever the browser
// happened to hand us.
//
// This file is deliberately pure. Everything it needs arrives as an argument:
// the URL, the referrer, the moment. The browser plumbing lives in events.ts.
// The split exists because the interesting part is the policy, and policy that
// can only run inside a page is policy that gets tested by clicking around.
//
// Two concepts, and confusing them is the classic way an acquisition funnel
// stops meaning anything (§7.4):
//
//   FIRST       how this browser session first arrived. Permanent. Never
//               overwritten, because the question it answers is historical.
//   MEANINGFUL  the most recent acquisition context that explains the current
//               visit. There may be several over a session's life.
//
// A meaningful touch is a LANDING fact, not a gameplay fact. Starting an
// arena, committing a decision, or coming back tomorrow are product events;
// they say nothing about acquisition, and counting them here would make the
// channel report describe engagement instead of arrivals.

/** The acquisition fields 0003 can store, plus the ones it cannot store yet. */
export interface AttributionFacts {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** ?ref= or ?aid=, the marketing shell's campaign id. */
  ref?: string;
  /** Sanitised: origin and path only. */
  referrer?: string;
  landingPath?: string;
  // ── Recognised, carried in typed context, not yet columns ──
  //
  // These are ruled growth-link inputs, and inventing columns for them here
  // would take ownership of migrations that belong to later PRs. `challenge`
  // becomes a real foreign key in 0004 (PR F); creator and referral code
  // resolve through growth_campaigns when the features that mint them exist.
  creator?: string;
  challenge?: string;
  referralCode?: string;
}

export interface ParsedAttribution {
  facts: AttributionFacts;
  /**
   * Whether this arrival names an acquisition source explicitly.
   *
   * An external referrer alone does not qualify. It is recorded as context on
   * a first touch, because it is the only thing we know about an unlabelled
   * arrival, but it never manufactures a meaningful touch: otherwise every
   * inbound link, every search result and every social preview would register
   * as a fresh campaign and the meaningful series would be mostly noise.
   */
  attributable: boolean;
}

/**
 * Referrer, reduced to what source analysis actually needs.
 *
 * Query and fragment are dropped, not trimmed: a referring URL is written by
 * somebody else, and its query string is where session ids, search terms,
 * email addresses and worse live. Origin and path answer "which surface sent
 * them" without carrying any of that into our database.
 */
export function sanitizeReferrer(referrer: string | null | undefined): string | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path}`;
  } catch {
    // Not a URL. Recording the raw string would be recording an unknown.
    return undefined;
  }
}

function param(params: URLSearchParams, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = params.get(name);
    if (value !== null && value.trim() !== '') return value.trim();
  }
  return undefined;
}

export interface AttributionInput {
  /** The full landing URL, absolute. */
  url: string;
  /** document.referrer, or whatever stands in for it. */
  referrer?: string | null;
  /** The moment, supplied rather than read: this file owns no clock. */
  occurredAt: string;
}

export function parseAttribution(input: AttributionInput): ParsedAttribution {
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    return { facts: {}, attributable: false };
  }
  const q = url.searchParams;
  const sameOrigin = (() => {
    const ref = input.referrer ? sanitizeReferrer(input.referrer) : undefined;
    return ref ? ref.startsWith(url.origin) : false;
  })();

  const facts: AttributionFacts = {
    source: param(q, 'utm_source'),
    medium: param(q, 'utm_medium'),
    campaign: param(q, 'utm_campaign'),
    content: param(q, 'utm_content'),
    term: param(q, 'utm_term'),
    ref: param(q, 'ref', 'aid'),
    creator: param(q, 'creator'),
    challenge: param(q, 'challenge_id'),
    referralCode: param(q, 'referral_code'),
    // An internal navigation is not an arrival from anywhere.
    referrer: sameOrigin ? undefined : sanitizeReferrer(input.referrer),
    landingPath: url.pathname,
  };

  for (const key of Object.keys(facts) as (keyof AttributionFacts)[]) {
    if (facts[key] === undefined) delete facts[key];
  }

  const attributable = Boolean(
    facts.source || facts.medium || facts.campaign || facts.content || facts.term ||
    facts.ref || facts.creator || facts.challenge || facts.referralCode,
  );

  return { facts, attributable };
}

/** The wire shape of one stored touch. Mirrors what 0003 can hold, and no more. */
export interface AcquisitionTouch {
  kind: 'first' | 'meaningful';
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string;
  landingPath?: string;
  occurredAt: string;
}

/**
 * The storable half of a parsed arrival.
 *
 * `ref`, `creator`, `challenge` and `referralCode` are deliberately absent:
 * the schema has no honest home for them yet, and a made-up column would be a
 * migration this PR does not own. They stay in event context until the PR that
 * owns their storage arrives (`challenge_id` in 0004, PR F).
 */
export function toTouch(
  kind: 'first' | 'meaningful',
  parsed: ParsedAttribution,
  occurredAt: string,
): AcquisitionTouch {
  const { source, medium, campaign, content, term, referrer, landingPath } = parsed.facts;
  return {
    kind, source, medium, campaign, content, term, referrer, landingPath, occurredAt,
  };
}

/**
 * Whether a newly parsed arrival is a meaningful touch given what we last saw.
 *
 * Requires an explicit acquisition source, and requires it to differ from the
 * last meaningful context: reloading a campaign link is the same arrival, not
 * a second one.
 */
export function isNewMeaningfulTouch(
  parsed: ParsedAttribution,
  lastMeaningfulKey: string | null,
): boolean {
  if (!parsed.attributable) return false;
  return meaningfulKey(parsed) !== lastMeaningfulKey;
}

/** A stable identity for one acquisition context, used to suppress repeats. */
export function meaningfulKey(parsed: ParsedAttribution): string {
  const f = parsed.facts;
  return [
    f.source, f.medium, f.campaign, f.content, f.term,
    f.ref, f.creator, f.challenge, f.referralCode,
  ].map(v => v ?? '').join('|');
}
