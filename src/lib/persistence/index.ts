import type { PersistencePort } from './types';
import { localStore } from './localStore';
import { makeRefiApi } from './refiApi';
import { legacyEventSink } from './legacyEventSink';

// ─── Choosing a store ─────────────────────────────────────────────────────────
//
// One decision, made once, at the edge of the application. Everything above
// this line talks to the port.
//
// VITE_API_URL set    the ReFi API owns persistence and telemetry.
// unset               progress is local, and telemetry goes to the legacy
//                     sink while one is still configured.
//
// The legacy sink is the last vendor-specific code in the browser and the only
// remote write that has ever succeeded. It is deliberately isolated in one
// file so it can be deleted in a single commit once /v1/events exists.

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

function choose(): PersistencePort {
  if (API_URL) return makeRefiApi(API_URL);
  return {
    ...localStore,
    // Local progress, legacy telemetry: the only combination that loses
    // nothing that currently works.
    deliverEvent: legacyEventSink.deliverEvent,
  };
}

export const persistence: PersistencePort = choose();
export type { PersistencePort, ProfileSnapshot, TipRecord, DailyTapeSubmission } from './types';
