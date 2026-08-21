import type {
  PersistencePort, ProfileSnapshot, DailyTapeSubmission,
} from './types';
import type { EventEnvelope } from '../eventBuffer';

// ─── ReFi API persistence ─────────────────────────────────────────────────────
//
// The store the game is moving to: a ReFi-owned service that fronts PostgreSQL,
// wherever that PostgreSQL happens to run.
//
// The contract is stated here, client-first, so the service has something
// concrete to implement and the browser has something to fall back from. It
// carries the session id in a header rather than the URL: an identifier in a
// query string ends up in logs, referrers and share links.
//
// Authorization belongs to the service. The browser sends what it has; the API
// resolves the principal and scopes the query. That is the arrangement that
// lets identity move between providers without touching a screen.

export function makeRefiApi(baseUrl: string): PersistencePort {
  const root = baseUrl.replace(/\/+$/, '');

  async function call<T>(
    path: string,
    sessionId: string,
    init?: RequestInit,
  ): Promise<T | null> {
    try {
      const res = await fetch(`${root}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'x-alpha-session': sessionId,
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) return null;
      if (res.status === 204) return null;
      return (await res.json()) as T;
    } catch {
      // Offline, blocked, or the service is down. Persistence is best-effort
      // from the browser's side; the local store is what the player sees.
      return null;
    }
  }

  return {
    kind: 'REFI_API',

    async loadProfile(sessionId) {
      return call<ProfileSnapshot>('/v1/progress', sessionId);
    },

    async saveProfile(sessionId, profile) {
      await call('/v1/progress', sessionId, {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
    },

    async saveTipState(sessionId, record) {
      await call('/v1/tips', sessionId, {
        method: 'POST',
        body: JSON.stringify(record),
      });
    },

    async saveGuidanceMode(sessionId, mode) {
      await call('/v1/guidance', sessionId, {
        method: 'PUT',
        body: JSON.stringify({ mode }),
      });
    },

    async loadDailyTape(sessionId, tapeDate) {
      return call<DailyTapeSubmission>(
        `/v1/daily-tape/${encodeURIComponent(tapeDate)}`,
        sessionId,
      );
    },

    async saveDailyTape(sessionId, submission) {
      await call('/v1/daily-tape', sessionId, {
        method: 'POST',
        body: JSON.stringify(submission),
      });
    },

    async deliverEvent(envelope: EventEnvelope) {
      try {
        const res = await fetch(`${root}/v1/events`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(envelope),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
