// ─── Authentication credential (browser side) ─────────────────────────────────
//
// Where the verified credential lives while a claimed player is playing, and
// deliberately the shortest file that can do the job.
//
// In memory only. Not localStorage, not sessionStorage, not a cookie this code
// sets. A bearer credential in localStorage is readable by any script that
// ever gets injected into the page and survives long after the person left the
// machine; the game has no need to keep one across reloads, because it stores
// what the credential resolved to (an account, server-side) rather than the
// credential itself.
//
// The game never inspects the token. It attaches it, and the API verifies it
// with the issuer. Nothing here knows or cares which provider issued it: that
// is the same provider-neutrality the database has.

let credential: string | null = null;
const listeners = new Set<() => void>();

/** Hold a verified credential for this page. */
export function setCredential(token: string): void {
  credential = token;
  for (const notify of listeners) notify();
}

/** Forget it. Sign-out, expiry, or a request the API refused. */
export function clearCredential(): void {
  credential = null;
  for (const notify of listeners) notify();
}

export function getCredential(): string | null {
  return credential;
}

export function isAuthenticated(): boolean {
  return credential !== null;
}

/** Subscribe to credential changes, so UI can follow sign-in without polling. */
export function onCredentialChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
