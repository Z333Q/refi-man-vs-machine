import type {
  ProfileSnapshot, TipRecord, DailyTapeSubmission, RemoteResult,
} from './types';
import type { EventEnvelope } from '../eventBuffer';
import type { RunRecord } from '../runRecord';
import type { MachineVersionRecord } from '../machineVersions';

// ─── ReFi API persistence ─────────────────────────────────────────────────────
//
// The remote half of the store: a ReFi-owned service that fronts PostgreSQL,
// wherever that PostgreSQL happens to run.
//
// The contract is stated here, client-first, so the service has something
// concrete to implement and the browser has something to fall back from. It
// carries the session id in a header rather than the URL: an identifier in a
// query string ends up in logs, referrers and share links. The header is
// continuity, not authentication — it says which progress stream this is,
// and proves nothing about who is asking. Authorization belongs to the
// service, which resolves the principal and scopes the query.
//
// Every read here answers with a RemoteResult rather than a bare null. The
// distinction it preserves — "the server holds nothing" versus "the server
// could not be asked" — is what lets the composed store treat an outage as
// an outage instead of as an empty account.

/** The remote store with its honest result types, before adaptation to the port. */
export interface RefiRemote {
  loadProfile(sessionId: string): Promise<RemoteResult<ProfileSnapshot>>;
  saveProfile(sessionId: string, profile: ProfileSnapshot): Promise<RemoteResult<null>>;
  saveTipState(sessionId: string, record: TipRecord): Promise<RemoteResult<null>>;
  saveGuidanceMode(sessionId: string, mode: string): Promise<RemoteResult<null>>;
  loadDailyTape(sessionId: string, tapeDate: string): Promise<RemoteResult<DailyTapeSubmission>>;
  saveDailyTape(sessionId: string, submission: DailyTapeSubmission): Promise<RemoteResult<null>>;
  loadRunRecords(sessionId: string): Promise<RemoteResult<RunRecord[]>>;
  saveRunRecord(sessionId: string, record: RunRecord): Promise<RemoteResult<null>>;
  loadMachineVersions(sessionId: string): Promise<RemoteResult<MachineVersionRecord[]>>;
  saveMachineVersion(sessionId: string, record: MachineVersionRecord): Promise<RemoteResult<null>>;
  deliverEvent(envelope: EventEnvelope): Promise<boolean>;
}

export function makeRefiRemote(baseUrl: string): RefiRemote {
  const root = baseUrl.replace(/\/+$/, '');

  async function call<T>(
    path: string,
    sessionId: string,
    init?: RequestInit,
  ): Promise<RemoteResult<T>> {
    let res: Response;
    try {
      res = await fetch(`${root}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'x-alpha-session': sessionId,
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      // Offline, blocked, DNS, timeout. The one thing this is not is an
      // empty account.
      return { kind: 'NETWORK_ERROR' };
    }
    if (res.status === 404) return { kind: 'NOT_FOUND' };
    if (!res.ok) return { kind: 'HTTP_ERROR', status: res.status };
    if (res.status === 204) return { kind: 'VALUE', value: null as T };
    try {
      return { kind: 'VALUE', value: (await res.json()) as T };
    } catch {
      return { kind: 'INVALID' };
    }
  }

  return {
    async loadProfile(sessionId) {
      return call<ProfileSnapshot>('/v1/progress', sessionId);
    },

    async saveProfile(sessionId, profile) {
      return call<null>('/v1/progress', sessionId, {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
    },

    async saveTipState(sessionId, record) {
      return call<null>('/v1/tips', sessionId, {
        method: 'POST',
        body: JSON.stringify(record),
      });
    },

    async saveGuidanceMode(sessionId, mode) {
      return call<null>('/v1/guidance', sessionId, {
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
      return call<null>('/v1/daily-tape', sessionId, {
        method: 'POST',
        body: JSON.stringify(submission),
      });
    },

    async loadRunRecords(sessionId) {
      return call<RunRecord[]>('/v1/runs', sessionId);
    },

    async saveRunRecord(sessionId, record) {
      return call<null>(`/v1/runs/${encodeURIComponent(record.runId)}`, sessionId, {
        method: 'PUT',
        body: JSON.stringify(record),
      });
    },

    async loadMachineVersions(sessionId) {
      return call<MachineVersionRecord[]>('/v1/machine-versions', sessionId);
    },

    async saveMachineVersion(sessionId, record) {
      return call<null>(
        `/v1/machine-versions/${encodeURIComponent(record.machineName)}/${record.version}`,
        sessionId,
        { method: 'PUT', body: JSON.stringify(record) },
      );
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
