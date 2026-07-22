import { jwtVerify, createRemoteJWKSet } from 'jose';

/**
 * Verify a Firebase Auth ID token and return the trustworthy identity.
 *
 * Firebase ID tokens are RS256, signed by Google. We verify the signature
 * against Google's published keys and pin iss/aud to the project, so the
 * resulting `uid` cannot be forged by a client — unlike the game's legacy
 * localStorage session_id. This is what lets the handoff `sub` be a real user.
 *
 * The key input is injectable: production uses Google's remote JWKS; tests pass
 * a local public key. No firebase-admin dependency (jose does the verify).
 */
const GOOGLE_SECURETOKEN_JWKS = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
);

export interface VerifiedIdentity {
  uid: string;
  email?: string;
}

export interface VerifyOptions {
  projectId: string;
  /** jose key input (JWKS resolver or a public key). Defaults to Google's JWKS. */
  key?: Parameters<typeof jwtVerify>[1];
}

let defaultJwks: Parameters<typeof jwtVerify>[1] | undefined;

export async function verifyFirebaseIdToken(
  token: string,
  opts: VerifyOptions,
): Promise<VerifiedIdentity> {
  const key = opts.key ?? (defaultJwks ??= createRemoteJWKSet(GOOGLE_SECURETOKEN_JWKS));
  const { payload } = await jwtVerify(token, key, {
    issuer: `https://securetoken.google.com/${opts.projectId}`,
    audience: opts.projectId,
    algorithms: ['RS256'],
  });
  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  if (!uid) throw new Error('firebase id token missing sub (uid)');
  const email = typeof payload['email'] === 'string' ? payload['email'] : undefined;
  return email ? { uid, email } : { uid };
}
