// ─── Growth telemetry facade ──────────────────────────────────────────────────
//
// One typed door into the event stream.
//
// emitEvent takes a type and Record<string, unknown>, which is the right shape
// for a transport and the wrong shape for feature code: every call site is free
// to invent a payload, and two screens describing the same moment with
// different keys is a funnel that cannot be summed. This adds the missing half
// — a payload type per event — without replacing the transport underneath it.
//
// What it deliberately does not do:
//
//   It does not rename events. onboarding.attract_viewed is the landing view
//   and has been since the first release; giving it a prettier name would
//   orphan every row already written under the old one and prove nothing.
//   Names change when their meaning is wrong, not when a document lists a
//   different word.
//
//   It does not emit anything twice. No event is mirrored under an alias.
//
//   It does not emit facts that do not exist yet. profile.claimed,
//   challenge.created, ranked.* and projection.received are described in the
//   architecture and are absent here on purpose: their features are not built,
//   and telemetry for an unreachable code path is a metric that reads zero for
//   a reason nobody can find later.
//
// Everything emitted here uses envelope version 2, which carries experiment
// assignments explicitly (§11).

import { emitEvent, type GameEventType } from './events';

/**
 * Experiment assignments for the current session.
 *
 * There are no experiments yet: 0003 can store assignments and this envelope
 * can carry them, but nothing assigns one. It returns an empty map rather than
 * being omitted, because "this emitter looked and found none" is a fact worth
 * recording and is distinguishable in the database from a v1 emitter that
 * never looked. Experiment assignment itself is a later PR.
 */
export function experimentAssignments(): Record<string, string> {
  return {};
}

/** Acquisition context an event may carry, never any formal-product data. */
export interface AttributionContext {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  ref?: string;
  creator?: string;
  challenge?: string;
  referralCode?: string;
  referrer?: string;
  landingPath?: string;
}

/**
 * The payload each growth event carries.
 *
 * Only events the product can honestly emit today appear here.
 */
export interface GrowthEventPayloads {
  // ── Landing and acquisition ──
  /** The attract screen was seen. This is the landing view, under the name it
   *  has always been emitted with. */
  'onboarding.attract_viewed': { entry: string; attribution: AttributionContext };
  /** The player crossed from the attract loop into the game. */
  'onboarding.entered': { from: string; attribution: AttributionContext };
  /** An arrival that named its acquisition source. New in this PR. */
  'campaign.attributed': {
    touchKind: 'first' | 'meaningful';
    attribution: AttributionContext;
    persisted: boolean;
  };

  // ── Session ──
  'session.started': { sessionId: string };
  'session.resumed': { arenaId: string; checkpoint: number; decisions: number };

  // ── Activation ──
  'arena.started': {
    arenaId: string; machineId: string; opponentPolicy: string;
    deployedMachineId: string | null; deployedBuildHash: string | null;
  };
  'checkpoint.loaded': { sequence: number; phase?: string; crisisDay?: string };
  'decision.committed': {
    actionCode: string; thesisCode: string | null; confidence: number | null;
    machineActionCode: string; modulesConsulted: string[]; behavioralFlags: string[];
  };
  'score.checkpoint.computed': {
    scoreContribution: number; quality: string; playerScore: number; machineScore: number;
  };

  // ── Outcome ──
  'arena.passed': ArenaOutcome;
  'arena.failed': ArenaOutcome;
  'arena.machine_beaten': ArenaOutcome;
  'score.run.computed': {
    result: string; playerScore: number; machineScore: number;
    deployedScore: number | null; checkpointsCompleted: number;
  };

  // ── Conversion (existing surfaces only) ──
  'conversion.paper_cta_viewed': { surface: string };
  'conversion.paper_started': { surface: string };
  'conversion.refi_handoff_started': { surface: string; destination: string; mode: string };
}

/** Shared by the three mutually exclusive run outcomes. */
export interface ArenaOutcome {
  result: string;
  playerScore: number;
  machineScore: number;
  criticalFailure: boolean;
}

export type GrowthEventType = keyof GrowthEventPayloads;

export interface TrackOptions {
  arenaId?: string | null;
  runId?: string | null;
  checkpointId?: string | null;
  simulationTimestamp?: string | null;
  correlationId?: string | null;
  alphaPlayerId?: string | null;
}

/**
 * Record one growth event.
 *
 * Fire and forget by construction: the returned promise resolves once the
 * envelope has been handed to the buffer or the sink, and it never rejects.
 * Telemetry that can throw into a click handler is telemetry that can end a
 * run, and the player must never pay for our measurement.
 */
export function track<K extends GrowthEventType>(
  event: K,
  payload: GrowthEventPayloads[K],
  options: TrackOptions = {},
): Promise<void> {
  return emitEvent(event as GameEventType, payload as Record<string, unknown>, {
    ...options,
    version: 2,
    experimentAssignments: experimentAssignments(),
  }).catch(() => {
    // emitEvent already swallows delivery failure; this is the last guard
    // against an unexpected throw reaching a caller that is mid-gameplay.
  });
}
