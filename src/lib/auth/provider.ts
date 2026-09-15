// ─── Identity provider seam (browser side) ────────────────────────────────────
//
// The game needs exactly one thing from an identity provider: a credential the
// API can verify. This is that seam, kept provider-neutral for the same reason
// the schema is — the column stores a provider name, not a vendor's shape.
//
// The selected provider is Stytch, and it is not wired here. The repository
// carries no Stytch application configuration, and the honest options were to
// invent a development bypass or to leave the surface disabled until real
// configuration exists. A bearer token that means "trust me" is one
// environment variable from production, so: disabled, loudly, with the claim
// CTA hidden rather than offered and then failing.
//
// When configuration arrives, `beginAuthentication` is the only function that
// needs a body, and nothing below it changes: the API verifies the credential
// with the issuer, maps it to app_users.id, and the game never learns who the
// issuer was.

export type AuthAvailability =
  | { kind: 'READY'; provider: string }
  | { kind: 'NOT_CONFIGURED' };

/**
 * Whether a player can be offered a claim at all.
 *
 * Reads build configuration only. A public identifier (a Stytch public token)
 * is not a secret and may be inlined; a project secret never can be, and lives
 * only in the API's environment.
 */
export function authAvailability(): AuthAvailability {
  const publicToken = import.meta.env.VITE_AUTH_PUBLIC_TOKEN as string | undefined;
  const provider = import.meta.env.VITE_AUTH_PROVIDER as string | undefined;
  if (publicToken && provider) return { kind: 'READY', provider };
  return { kind: 'NOT_CONFIGURED' };
}

export class AuthUnavailable extends Error {
  constructor() {
    super('identity provider is not configured for this build');
    this.name = 'AuthUnavailable';
  }
}

/**
 * Start an authentication and resolve to a credential the API can verify.
 *
 * Unimplemented until the provider is configured, and throwing rather than
 * returning a fake: a stub that resolved to something would make the claim
 * flow look finished and fail at the only step that matters.
 */
export function beginAuthentication(): Promise<string> {
  return Promise.reject(new AuthUnavailable());
}
