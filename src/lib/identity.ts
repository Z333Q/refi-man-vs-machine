// ─── Anonymous session identity ───────────────────────────────────────────────
//
// The id a player carries before they have an account. It is generated in the
// browser, stored locally, and means nothing to any server that has not been
// told about it.
//
// It lives here rather than beside a database client because identity is a
// domain concern, not a vendor one. Whatever ends up owning accounts (Identity
// Platform, Firebase, something internal) resolves to an application user; the
// session id is what stitches a player's local progress to that account when
// they finally have one.

const SESSION_KEY = 'refi_session_id';

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'ses_' + crypto.randomUUID().replace(/-/g, '').substring(0, 20);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
