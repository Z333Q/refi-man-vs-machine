// ─── Handle policy ────────────────────────────────────────────────────────────
//
// The rules a name must satisfy before it can be reserved, in application code
// rather than in a migration, because this list changes without a deploy and a
// reserved-name CHECK constraint would make every addition a schema change
// (REFI_ALPHA_GROWTH_ARCHITECTURE.md §7.1).
//
// The database still owns the shape of a handle: the same regex is a CHECK on
// both public_player_profiles and player_handle_history, so a policy bug here
// cannot store a malformed name. What this file adds is the part a constraint
// cannot express — that some well-formed names are not available to whoever
// asks first.

import { HttpError } from './contract.js';

/** The shape law, mirrored from 0003 so a rejection explains itself early. */
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/;

/**
 * Names and prefixes that are not first-come-first-served.
 *
 * Two kinds. Operational words a player must never be able to impersonate
 * (support, security, admin), and product surfaces whose meaning would be
 * hijacked by a profile answering at that name (season, leaderboard, paper).
 */
const RESERVED = new Set([
  'refi', 'refitrading', 'refi_alpha', 'refialpha',
  'admin', 'administrator', 'support', 'help', 'security', 'compliance',
  'moderator', 'staff', 'official', 'system', 'root', 'api', 'www',
  'play', 'season', 'challenge', 'leaderboard',
  'machine', 'alpha', 'paper', 'managed', 'signal',
]);

/**
 * Brand impersonation, checked on the separator-stripped form.
 *
 * refi_support, r-e-f-i-support and refisupport are the same claim to a
 * reader, and a set membership test catches none of them. So the comparison
 * is made on the letters alone: anything that reads as ReFi plus an
 * operational word, or as ReFi plus nothing, belongs to us.
 */
const BRAND = ['refi', 'reffi', 'refitrading'];
const OPERATIONAL = [
  'support', 'help', 'admin', 'team', 'staff', 'official', 'security',
  'compliance', 'moderator', 'mod', 'alpha', 'trading', 'hq', 'bot',
  'service', 'billing', 'legal',
];

/** Letters and digits only: separators are decoration, not identity. */
function skeleton(handle: string): string {
  return handle.replace(/[^a-z0-9]/g, '');
}

export type HandleRejection =
  | 'HANDLE_MALFORMED'
  | 'HANDLE_RESERVED';

export class HandleError extends HttpError {
  constructor(public readonly reason: HandleRejection, message: string) {
    super(422, message);
  }
}

/**
 * Canonicalise then validate.
 *
 * Input is human: people type spaces and capitals. Storage is canonical, and
 * lowercase storage is what makes case-insensitive uniqueness fall out of an
 * ordinary unique index rather than a second normalised column that can
 * disagree with the first.
 */
export function canonicalHandle(input: unknown): string {
  if (typeof input !== 'string') {
    throw new HandleError('HANDLE_MALFORMED', 'handle must be a string');
  }
  const handle = input.trim().toLowerCase();

  if (!HANDLE_PATTERN.test(handle)) {
    throw new HandleError(
      'HANDLE_MALFORMED',
      'handle must be 3 to 20 characters of a-z, 0-9 and underscore, starting and ending alphanumeric',
    );
  }
  if (isReserved(handle)) {
    throw new HandleError('HANDLE_RESERVED', 'that handle is reserved');
  }
  return handle;
}

/** Whether a well-formed handle is withheld by policy. */
export function isReserved(handle: string): boolean {
  if (RESERVED.has(handle)) return true;

  const bare = skeleton(handle);
  if (RESERVED.has(bare)) return true;

  for (const brand of BRAND) {
    if (bare === brand) return true;
    // Anywhere in the name, not only at the front: support_refi reads as ours
    // exactly as much as refi_support does, and a prefix-only rule catches one
    // and waves through the other.
    if (!bare.includes(brand)) continue;
    const rest = bare.split(brand).join('');
    if (rest === '') return true;
    if (OPERATIONAL.some(word => rest === word || rest.startsWith(word) || rest.endsWith(word))) {
      return true;
    }
  }
  return false;
}
