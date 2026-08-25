import type { PersistencePort } from './types';
import { localStore } from './localStore';
import { makeRefiRemote, type RefiRemote } from './refiApi';
import { makeMirroredStore, wireMirrors, hydrateFromRemote } from './mirroredStore';
import { legacyEventSink } from './legacyEventSink';
import { getSessionId } from '../identity';

// ─── Choosing a store ─────────────────────────────────────────────────────────
//
// One decision, made once, at the edge of the application. Everything above
// this line talks to the port.
//
// VITE_API_URL set    local storage stays authoritative and synchronous; the
//                     ReFi API mirrors it, fills gaps, and takes telemetry.
//                     An unreachable API costs the mirror, never the game.
// unset               progress is local, and telemetry goes to the legacy
//                     sink while one is still configured.
//
// The legacy sink is the last vendor-specific code in the browser and the only
// remote write that has ever succeeded. It is deliberately isolated in one
// file so it can be deleted in a single commit once /v1/events exists.

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

const remote: RefiRemote | null = API_URL ? makeRefiRemote(API_URL) : null;

function choose(): PersistencePort {
  if (remote) return makeMirroredStore(remote);
  return {
    ...localStore,
    // Local progress, legacy telemetry: the only combination that loses
    // nothing that currently works.
    deliverEvent: legacyEventSink.deliverEvent,
  };
}

export const persistence: PersistencePort = choose();

/**
 * Start the background half of persistence: announce future run and machine
 * writes to the mirror, and adopt anything the mirror holds that this device
 * does not. Call once, after the app is interactive. With no API configured
 * this is a no-op. Nothing gameplay-visible waits on it: resume, the Bronze
 * gate and the builder read the synchronous local stores immediately.
 */
export function startPersistenceSync(): void {
  if (!remote) return;
  wireMirrors(remote, getSessionId);
  void hydrateFromRemote(remote, getSessionId());
}

export type {
  PersistencePort, ProfileSnapshot, TipRecord, DailyTapeSubmission, RemoteResult,
} from './types';
export { syncConflicts, type SyncConflict } from './mirroredStore';
