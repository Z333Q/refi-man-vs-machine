// ─── Claimed identity ─────────────────────────────────────────────────────────
//
// Merge point 1 (REFI_ALPHA_GROWTH_ARCHITECTURE.md §2.1): an anonymous browser
// session becomes a person with a name that is theirs.
//
// The chain is fixed and there is exactly one of it:
//
//   verified principal → user_identities(provider, subject) → app_users.id
//     → public_player_profiles → game_sessions.user_id
//
// Two things this deliberately does not do.
//
// It does not copy anything. A claim links the session; the runs, machines,
// tips and touches that session already owns stay exactly where they are and
// reach the account through game_sessions.user_id. A migration job that
// "moves progress onto the account" would create a second copy of every fact
// and a second thing to keep in sync, and the schema was shaped to avoid it.
//
// It does not know who Stytch is. It consumes a VerifiedPrincipal, and the
// provider is a string in a column. That is the same reason the founding
// schema has no auth vendor in it.

import type { Pool, PoolClient } from 'pg';
import { HttpError } from './contract.js';
import { inTransaction } from './store.js';
import type { VerifiedPrincipal } from './principal.js';

/** PostgreSQL unique violation. The database is the final authority on races. */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null &&
    (err as { code?: string }).code === UNIQUE_VIOLATION;
}

export interface PublicProfile {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  visibility: 'public' | 'private';
  createdAt: string;
}

export interface ClaimResult {
  outcome: 'CLAIMED' | 'ALREADY_CLAIMED' | 'ALREADY_CLAIMED_OTHER_HANDLE';
  userId: string;
  profile: PublicProfile;
  sessionLinked: boolean;
}

/** How long a handle must be held before it can be changed (§7.1). */
export const RENAME_COOLDOWN_DAYS = 30;

// ─── Identity resolution ──────────────────────────────────────────────────────

/**
 * The app_user behind a verified principal, created on first sight.
 *
 * The unique constraint on (provider, subject) is what makes an identity
 * stable: two concurrent first requests from the same person race here, one
 * insert loses, and the loser re-reads the winner's row rather than creating a
 * second account for one human. Email is never part of this lookup — people
 * change email addresses, and an account that follows the address follows
 * whoever holds it next.
 */
async function resolveUser(c: PoolClient, principal: VerifiedPrincipal): Promise<string> {
  const existing = await findUser(c, principal);
  if (existing) {
    await c.query(
      `UPDATE user_identities SET last_seen_at = now(),
              email = COALESCE($3, email),
              email_verified = COALESCE($4, email_verified)
        WHERE provider = $1 AND subject = $2`,
      [principal.provider, principal.subject, principal.email ?? null,
       principal.emailVerified ?? null],
    );
    return existing;
  }

  const { rows: created } = await c.query<{ id: string }>(
    `INSERT INTO app_users DEFAULT VALUES RETURNING id`);
  const user = created[0];
  if (!user) throw new HttpError(500, 'user_not_created');

  // A savepoint, because losing this race is expected rather than
  // exceptional: two tabs signing in at once is ordinary. Without one, the
  // failed INSERT aborts the whole transaction and every statement after it
  // fails with "current transaction is aborted", so the recovery below could
  // never run and one person's second tab would 500.
  await c.query('SAVEPOINT claim_identity');
  try {
    await c.query(
      `INSERT INTO user_identities (user_id, provider, subject, email, email_verified)
       VALUES ($1,$2,$3,$4,$5)`,
      [user.id, principal.provider, principal.subject,
       principal.email ?? null, principal.emailVerified ?? null],
    );
    await c.query('RELEASE SAVEPOINT claim_identity');
    return user.id;
  } catch (err) {
    await c.query('ROLLBACK TO SAVEPOINT claim_identity');
    if (!isUniqueViolation(err)) throw err;
    // Somebody else created it between our read and our write. Their row is
    // the identity; ours is an orphan app_user that never owned anything.
    const winner = await findUser(c, principal);
    if (!winner) throw err;
    await c.query(`DELETE FROM app_users WHERE id = $1`, [user.id]);
    return winner;
  }
}

async function findUser(
  c: PoolClient | Pool, principal: VerifiedPrincipal,
): Promise<string | null> {
  const { rows } = await c.query<{ user_id: string }>(
    `SELECT user_id FROM user_identities WHERE provider = $1 AND subject = $2`,
    [principal.provider, principal.subject],
  );
  return rows[0]?.user_id ?? null;
}

/** The app_user behind a principal, without creating one. */
export async function userForPrincipal(
  pool: Pool, principal: VerifiedPrincipal,
): Promise<string | null> {
  return findUser(pool, principal);
}

// ─── Session linking ──────────────────────────────────────────────────────────

/**
 * Bind one browser session to one account.
 *
 * Idempotent for its owner, and impossible for anybody else: a session already
 * linked to somebody cannot be re-pointed. Without that rule a second player
 * who learned a session id could attach it to their own account and inherit a
 * stranger's history, and session ids are not secrets.
 */
async function linkSessionTo(
  c: PoolClient, sessionId: string, userId: string,
): Promise<boolean> {
  await c.query(
    `INSERT INTO game_sessions (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [sessionId]);
  const { rows } = await c.query<{ user_id: string | null }>(
    `SELECT user_id FROM game_sessions WHERE id = $1 FOR UPDATE`, [sessionId]);
  const owner = rows[0]?.user_id ?? null;

  if (owner !== null && owner !== userId) {
    throw new HttpError(403, 'session_owned_by_another_user');
  }
  if (owner === userId) return false;

  await c.query(
    `UPDATE game_sessions SET user_id = $1, linked_at = now() WHERE id = $2`,
    [userId, sessionId]);
  return true;
}

export async function linkSession(
  pool: Pool, principal: VerifiedPrincipal, sessionId: string,
): Promise<{ userId: string; linked: boolean }> {
  return inTransaction(pool, async c => {
    const userId = await resolveUser(c, principal);
    const linked = await linkSessionTo(c, sessionId, userId);
    return { userId, linked };
  });
}

// ─── Claim ────────────────────────────────────────────────────────────────────

async function profileOf(c: PoolClient | Pool, userId: string): Promise<PublicProfile | null> {
  const { rows } = await c.query(
    `SELECT handle, display_name, avatar_url, bio, visibility, created_at
       FROM public_player_profiles WHERE user_id = $1`, [userId]);
  const row = rows[0];
  if (!row) return null;
  return {
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    visibility: row.visibility,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Reserve a handle for this user, permanently.
 *
 * Reservation comes first and the profile second, because the foreign key
 * runs that way: a profile cannot wear a name nobody reserved (0003). The
 * reservation survives the account, so "taken" here includes names whose owner
 * is long gone, and a tombstoned row (user_id IS NULL) is unavailable to
 * everyone forever.
 */
async function reserveHandle(c: PoolClient, handle: string, userId: string): Promise<void> {
  const { rows } = await c.query<{ user_id: string | null; released_at: string | null }>(
    `SELECT user_id, released_at FROM player_handle_history WHERE handle = $1 FOR UPDATE`,
    [handle]);
  const held = rows[0];

  if (!held) {
    await c.query('SAVEPOINT reserve_handle');
    try {
      await c.query(
        `INSERT INTO player_handle_history (handle, user_id) VALUES ($1, $2)`,
        [handle, userId]);
      await c.query('RELEASE SAVEPOINT reserve_handle');
      return;
    } catch (err) {
      // Lost the race by a hair: somebody reserved it between the lock miss
      // and the insert. The database decided, and it decided against us.
      await c.query('ROLLBACK TO SAVEPOINT reserve_handle');
      if (isUniqueViolation(err)) throw new HttpError(409, 'HANDLE_UNAVAILABLE');
      throw err;
    }
  }

  // Held by this same person and released: reactivating their own old name is
  // allowed, and is an explicit act rather than a side effect of the profile
  // foreign key being satisfiable.
  if (held.user_id === userId && held.released_at !== null) {
    await c.query(
      `UPDATE player_handle_history
          SET released_at = NULL, held_from = now()
        WHERE handle = $1`, [handle]);
    return;
  }
  throw new HttpError(409, 'HANDLE_UNAVAILABLE');
}

export async function claimIdentity(
  pool: Pool,
  principal: VerifiedPrincipal,
  sessionId: string,
  request: { handle: string; displayName?: string | undefined },
): Promise<ClaimResult> {
  return inTransaction(pool, async c => {
    const userId = await resolveUser(c, principal);
    const sessionLinked = await linkSessionTo(c, sessionId, userId);

    const existing = await profileOf(c, userId);
    if (existing) {
      // Never a silent rename. A second claim from a browser that did not know
      // the account already had a name must not take the name away from it;
      // renaming has its own route, its own cooldown and its own audit trail.
      return {
        outcome: existing.handle === request.handle
          ? 'ALREADY_CLAIMED' as const
          : 'ALREADY_CLAIMED_OTHER_HANDLE' as const,
        userId, profile: existing, sessionLinked,
      };
    }

    await reserveHandle(c, request.handle, userId);
    await c.query('SAVEPOINT create_profile');
    try {
      await c.query(
        `INSERT INTO public_player_profiles (user_id, handle, display_name)
         VALUES ($1, $2, $3)`,
        [userId, request.handle, request.displayName ?? null]);
      await c.query('RELEASE SAVEPOINT create_profile');
    } catch (err) {
      await c.query('ROLLBACK TO SAVEPOINT create_profile');
      if (isUniqueViolation(err)) throw new HttpError(409, 'HANDLE_UNAVAILABLE');
      throw err;
    }

    const profile = await profileOf(c, userId);
    if (!profile) throw new HttpError(500, 'profile_not_stored');
    return { outcome: 'CLAIMED' as const, userId, profile, sessionLinked };
  });
}

// ─── Reading identity ─────────────────────────────────────────────────────────

export interface MyIdentity {
  userId: string;
  profile: PublicProfile | null;
  /** Handles this account has held, current first. Its own history only. */
  handles: { handle: string; heldFrom: string; releasedAt: string | null }[];
}

export async function identityOf(
  pool: Pool, principal: VerifiedPrincipal,
): Promise<MyIdentity | null> {
  const userId = await findUser(pool, principal);
  if (!userId) return null;
  const profile = await profileOf(pool, userId);
  const { rows } = await pool.query(
    `SELECT handle, held_from, released_at FROM player_handle_history
      WHERE user_id = $1 ORDER BY released_at NULLS FIRST, held_from DESC`, [userId]);
  return {
    userId,
    profile,
    handles: rows.map(r => ({
      handle: r.handle,
      heldFrom: new Date(r.held_from).toISOString(),
      releasedAt: r.released_at === null ? null : new Date(r.released_at).toISOString(),
    })),
  };
}

export type ProfileLookup =
  | { kind: 'PROFILE'; profile: PublicProfile }
  /** The handle moved; this is where its owner lives now. */
  | { kind: 'MOVED'; currentHandle: string }
  /** Reserved forever by an account that no longer exists. */
  | { kind: 'RETIRED' }
  | { kind: 'UNKNOWN' };

/**
 * A public profile by handle.
 *
 * Four answers, and the difference between them is the point. A private
 * profile and a name nobody has ever taken both read as nothing here, because
 * a lookup that distinguished them would make visibility a way to prove an
 * account exists. A retired name says so instead of looking available, and a
 * renamed one points at where its owner went.
 */
export async function publicProfile(pool: Pool, handle: string): Promise<ProfileLookup> {
  const { rows } = await pool.query(
    `SELECT handle, display_name, avatar_url, bio, visibility, created_at
       FROM public_player_profiles WHERE handle = $1`, [handle]);
  const row = rows[0];
  if (row) {
    if (row.visibility === 'private') return { kind: 'UNKNOWN' };
    return {
      kind: 'PROFILE',
      profile: {
        handle: row.handle,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        bio: row.bio,
        visibility: row.visibility,
        createdAt: new Date(row.created_at).toISOString(),
      },
    };
  }

  const { rows: history } = await pool.query<{ user_id: string | null }>(
    `SELECT user_id FROM player_handle_history WHERE handle = $1`, [handle]);
  const held = history[0];
  if (!held) return { kind: 'UNKNOWN' };
  if (held.user_id === null) return { kind: 'RETIRED' };

  const current = await profileOf(pool, held.user_id);
  if (!current || current.visibility === 'private') return { kind: 'UNKNOWN' };
  return { kind: 'MOVED', currentHandle: current.handle };
}

// ─── Rename ───────────────────────────────────────────────────────────────────

export interface ProfilePatch {
  handle?: string | undefined;
  displayName?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  bio?: string | null | undefined;
  visibility?: 'public' | 'private' | undefined;
}

/**
 * Update the caller's own profile, renaming if asked.
 *
 * The rename order is the law in §7.1 and it is not interchangeable: lock,
 * check the cooldown, release the old reservation, take the new one, then move
 * the profile. Reversing the last two would leave a profile pointing at a name
 * it does not hold, which the foreign key would refuse anyway; doing it
 * outside one transaction would leave a person with no name at all if the
 * process died between the two writes.
 */
export async function patchOwnProfile(
  pool: Pool, userId: string, patch: ProfilePatch,
): Promise<PublicProfile> {
  return inTransaction(pool, async c => {
    const { rows } = await c.query<{ handle: string }>(
      `SELECT handle FROM public_player_profiles WHERE user_id = $1 FOR UPDATE`, [userId]);
    const current = rows[0];
    if (!current) throw new HttpError(404, 'no_profile');

    if (patch.handle !== undefined && patch.handle !== current.handle) {
      const { rows: held } = await c.query<{ held_from: string }>(
        `SELECT held_from FROM player_handle_history
          WHERE handle = $1 AND user_id = $2 FOR UPDATE`, [current.handle, userId]);
      const since = held[0];
      if (since) {
        const days = (Date.now() - new Date(since.held_from).getTime()) / 86_400_000;
        if (days < RENAME_COOLDOWN_DAYS) {
          throw new HttpError(429, 'RENAME_TOO_SOON');
        }
      }

      await c.query(
        `UPDATE player_handle_history SET released_at = now()
          WHERE handle = $1 AND user_id = $2`, [current.handle, userId]);
      await reserveHandle(c, patch.handle, userId);
      await c.query(
        `UPDATE public_player_profiles SET handle = $1, updated_at = now() WHERE user_id = $2`,
        [patch.handle, userId]);
    }

    const sets: string[] = [];
    const values: unknown[] = [userId];
    for (const [column, value] of [
      ['display_name', patch.displayName], ['avatar_url', patch.avatarUrl],
      ['bio', patch.bio], ['visibility', patch.visibility],
    ] as const) {
      if (value === undefined) continue;
      values.push(value);
      sets.push(`${column} = $${String(values.length)}`);
    }
    if (sets.length > 0) {
      await c.query(
        `UPDATE public_player_profiles SET ${sets.join(', ')}, updated_at = now()
          WHERE user_id = $1`, values);
    }

    const updated = await profileOf(c, userId);
    if (!updated) throw new HttpError(500, 'profile_not_stored');
    return updated;
  });
}
