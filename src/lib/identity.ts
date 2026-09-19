// ─── Anonymous session identity ───────────────────────────────────────────────
//
// The id a player carries before they have an account. It is generated in the
// browser, stored locally where storage allows, and means nothing to any
// server that has not been told about it.
//
// It lives here rather than beside a database client because identity is a
// domain concern, not a vendor one. Whatever owns accounts resolves to an
// application user; the session id is what stitches a player's local progress
// to that account when they finally have one.
//
// It is continuity, not authentication, and that does not change once accounts
// exist. It is generated client-side, it is not a secret, and it says which
// stream of progress a request is about — never who is allowed to touch it.
// Authorization is a verified credential, separately (PR E).
//
// Storage may be unavailable, and that must not end the session. Private
// windows, blocked site data and quota exhaustion all make localStorage throw
// on read or write, and this function is called by nearly everything: an
// exception here used to take the page down before any of it ran. A player in
// a private window gets an in-memory id instead, stable for the life of the
// page, which is exactly what continuity means on a device that refuses to
// remember anything.

const SESSION_KEY = 'refi_session_id';

/** The id in use when storage will not hold one. Per page, by construction. */
let inMemory: string | null = null;

function mintSessionId(): string {
  return 'ses_' + crypto.randomUUID().replace(/-/g, '').substring(0, 20);
}

function readStored(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    // No storage object, or an accessor that throws. Either way: nothing
    // remembered, and not a reason to fail.
    return null;
  }
}

function persist(id: string): boolean {
  try {
    localStorage.setItem(SESSION_KEY, id);
    return true;
  } catch {
    return false;
  }
}

export function getSessionId(): string {
  const stored = readStored();
  if (stored) return stored;

  // A page that could not store its id keeps answering with the same one,
  // rather than minting a fresh session per call and scattering one visit
  // across a dozen unrelated sessions.
  if (inMemory) return inMemory;

  const id = mintSessionId();
  if (!persist(id)) inMemory = id;
  return id;
}

/** True when this page is carrying an id storage refused to keep. */
export function sessionIsEphemeral(): boolean {
  return inMemory !== null && readStored() === null;
}

/** Test seam: forget the in-memory fallback. Not used by the application. */
export function resetEphemeralSession(): void {
  inMemory = null;
}
