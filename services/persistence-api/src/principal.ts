// ─── Verified principal ───────────────────────────────────────────────────────
//
// The one place a vendor's idea of "who this is" becomes ReFi's.
//
// Everything below this file consumes VerifiedPrincipal: provider, subject,
// and optionally an email the provider itself vouches for. No store function,
// no domain function and no SQL knows that the provider happens to be Stytch
// today, which is the same reason the founding schema has no auth vendor in
// it: identity moves, and a database that names its provider moves with it.
//
// The security rule this file exists to enforce, stated once: a principal is
// something the server verified with the issuer, never something the client
// said. A request body carrying provider, subject, email or email_verified is
// a request body, and is ignored.

import { HttpError } from './contract.js';

export interface VerifiedPrincipal {
  /** Opaque, application-owned: 'stytch' today, whatever tomorrow. */
  provider: string;
  /** The provider's stable id for this person. Never an email. */
  subject: string;
  email?: string;
  emailVerified?: boolean;
}

/**
 * Turn a credential into a principal, or refuse.
 *
 * Returns null when there is no credential at all (an anonymous request,
 * which most requests are). Throws 401 when a credential is present and is
 * not good: silence and rejection are different answers and the routes treat
 * them differently.
 */
export interface PrincipalVerifier {
  verify(authorization: string | undefined): Promise<VerifiedPrincipal | null>;
}

export const STYTCH_PROVIDER = 'stytch';

function bearer(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

/**
 * Stytch session verification, over HTTPS.
 *
 * Deliberately not the Stytch SDK. The adapter needs exactly one call, the
 * dependency would be visible to every future audit of this service, and a
 * fetch against a documented endpoint is easier to reason about than a
 * package that can change what it does in a minor version. If the call surface
 * grows, this is the file that changes.
 *
 * The token is a Stytch session token or JWT held by the browser. It is sent
 * as a bearer credential and never stored by the game: the game stores the
 * app_users.id it resolves to, and nothing else.
 */
export function makeStytchVerifier(config: {
  projectId: string;
  secret: string;
  baseUrl?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
}): PrincipalVerifier {
  const base = (config.baseUrl ?? 'https://api.stytch.com').replace(/\/+$/, '');
  const doFetch = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 5_000;
  const auth = 'Basic ' + Buffer.from(`${config.projectId}:${config.secret}`).toString('base64');

  return {
    async verify(authorization) {
      const token = bearer(authorization);
      if (!token) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => { controller.abort(); }, timeoutMs);
      let res: Response;
      try {
        res = await doFetch(`${base}/v1/sessions/authenticate`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', authorization: auth },
          // Either form is accepted by the issuer; sending both lets the
          // browser hold whichever Stytch gave it.
          body: JSON.stringify({ session_token: token, session_jwt: token }),
        });
      } catch {
        // The issuer could not be asked. That is not "this credential is
        // fine", and it is not "this credential is forged" either: refusing
        // is the only answer that cannot authorise the wrong person.
        throw new HttpError(503, 'identity_provider_unavailable');
      } finally {
        clearTimeout(timer);
      }

      if (res.status === 401 || res.status === 404) throw new HttpError(401, 'invalid_credential');
      if (!res.ok) throw new HttpError(503, 'identity_provider_unavailable');

      const body = (await res.json()) as {
        user_id?: string;
        user?: { emails?: { email?: string; verified?: boolean }[] };
      };
      if (!body.user_id) throw new HttpError(401, 'invalid_credential');

      // Email is taken only from the verified response, and only when the
      // issuer says it is verified. An unverified address is a claim, not a
      // fact, and storing it as one is how account takeover by email starts.
      const primary = body.user?.emails?.find(e => e.verified) ?? body.user?.emails?.[0];
      const principal: VerifiedPrincipal = {
        provider: STYTCH_PROVIDER,
        subject: body.user_id,
      };
      // Assigned only when present: with exactOptionalPropertyTypes an
      // explicit undefined is a different thing from an absent field, and the
      // absent one is what "the provider told us nothing" means.
      if (primary?.email !== undefined) principal.email = primary.email;
      if (primary?.verified !== undefined) principal.emailVerified = primary.verified;
      return principal;
    },
  };
}

/**
 * The verifier used when no identity provider is configured.
 *
 * It refuses every credential rather than accepting any, and the claim routes
 * answer 503 instead of pretending to work. There is deliberately no
 * development bypass: a bearer token that means "trust me" is one environment
 * variable away from production, and that is exactly the kind of switch that
 * ships by accident.
 */
export const unconfiguredVerifier: PrincipalVerifier = {
  async verify(authorization) {
    if (!bearer(authorization)) return null;
    throw new HttpError(503, 'identity_provider_not_configured');
  },
};

/** The verifier this process should use, from its environment. */
export function verifierFromEnv(env: NodeJS.ProcessEnv = process.env): PrincipalVerifier {
  const projectId = env['STYTCH_PROJECT_ID'];
  const secret = env['STYTCH_SECRET'];
  if (!projectId || !secret) return unconfiguredVerifier;
  return makeStytchVerifier({
    projectId, secret,
    baseUrl: env['STYTCH_BASE_URL'],
  });
}
