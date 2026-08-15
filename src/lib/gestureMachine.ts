import type { ActionCode } from './gameTypes';
import { clampConviction, isDetent, isLandmark, CONVICTION_MAX } from './decisionContract';
import { convictionForDistance, type PullGeometry } from './gestureGeometry';

// ─── Pull state machine ───────────────────────────────────────────────────────
// Pure. Events in, state and effects out. No DOM, no timers, no rendering, so
// every invariant in Addendum C section 5 can be asserted directly rather than
// inferred from a browser.
//
// The one law that governs the whole file: only a clean release from an armed
// pull commits. Everything else settles the card and commits nothing.

export type GestureState =
  | 'READ'      // nothing gripped
  | 'GRIP'      // finger down, inside the dead zone, not armed
  | 'PULL'      // armed, past the dead zone
  | 'SETTLED';  // terminal for this gesture: committed, cancelled or released

export type CancelReason =
  | 'RETURNED_TO_DEAD_ZONE'
  | 'POINTER_CANCEL'
  | 'CAPTURE_LOST'
  | 'VISIBILITY_CHANGE'
  | 'ORIENTATION_CHANGE'
  | 'SECOND_POINTER_IGNORED'
  | 'UNAFFORDABLE';

export type GestureEvent =
  | { type: 'GRIP_START'; pointerId: number; actionCode: ActionCode; affordable: boolean; timestamp: number }
  | { type: 'MOVE'; pointerId: number; distance: number; timestamp: number }
  | { type: 'RELEASE'; pointerId: number; timestamp: number }
  | { type: 'POINTER_CANCEL'; pointerId: number }
  | { type: 'CAPTURE_LOST'; pointerId: number }
  | { type: 'VISIBILITY_CHANGE' }
  | { type: 'ORIENTATION_CHANGE' }
  | { type: 'SECOND_POINTER'; pointerId: number };

export type GestureEffect =
  /** Crossed the arm point: dim, show the meter, one distinct arm tick. */
  | { type: 'ARM' }
  /** Crossed a detent. Landmarks (70, 85, 95) get a heavier report. */
  | { type: 'DETENT'; conviction: number; landmark: boolean }
  /** Pulled past the governor cap. Distinct from any detent. */
  | { type: 'GOVERNOR_BLOCKED'; conviction: number }
  /** Reached the hard stop. */
  | { type: 'HARD_STOP' }
  /** A clean release from an armed pull. This is the only committing effect. */
  | { type: 'COMMIT'; conviction: number }
  /** Released without ever arming: open the precise controls, never commit. */
  | { type: 'OPEN_FOCUSED_CONTROLS'; actionCode: ActionCode }
  /** Settled without committing. */
  | { type: 'CANCEL'; reason: CancelReason }
  | { type: 'TELEMETRY'; event: GestureTelemetryEvent; payload: Record<string, unknown> };

export type GestureTelemetryEvent =
  | 'gesture.started'
  | 'gesture.armed'
  | 'gesture.cancelled'
  | 'gesture.dead_zone_released'
  | 'gesture.committed'
  | 'gesture.focused_controls_opened';

export interface GestureContext {
  state: GestureState;
  pointerId: number | null;
  actionCode: ActionCode | null;
  /** Governor-clamped conviction under the finger right now. */
  conviction: number | null;
  /** Whether the pull has ever armed during this gesture. */
  hasArmed: boolean;
  /** Last detent reported, so a detent fires once per crossing. */
  lastDetent: number | null;
  /** Whether the governor block has already been reported at the cap. */
  governorReported: boolean;
  hardStopReported: boolean;
  startedAt: number | null;
}

export function initialGestureContext(): GestureContext {
  return {
    state: 'READ',
    pointerId: null,
    actionCode: null,
    conviction: null,
    hasArmed: false,
    lastDetent: null,
    governorReported: false,
    hardStopReported: false,
    startedAt: null,
  };
}

export interface GestureConfig {
  geometry: PullGeometry;
  /** Checkpoint sequence, for the conviction governor. */
  checkpointSequence: number;
}

export interface GestureResult {
  context: GestureContext;
  effects: GestureEffect[];
}

function settle(context: GestureContext, reason: CancelReason): GestureResult {
  return {
    context: { ...initialGestureContext(), state: 'SETTLED' },
    effects: [
      { type: 'CANCEL', reason },
      { type: 'TELEMETRY', event: 'gesture.cancelled', payload: { reason, actionCode: context.actionCode } },
    ],
  };
}

export function gestureReducer(
  context: GestureContext,
  event: GestureEvent,
  config: GestureConfig,
): GestureResult {
  const { geometry, checkpointSequence } = config;

  switch (event.type) {
    case 'GRIP_START': {
      if (context.state === 'GRIP' || context.state === 'PULL') {
        // Touch ownership is absolute: the first touch owns the gesture.
        return {
          context,
          effects: [{
            type: 'TELEMETRY',
            event: 'gesture.cancelled',
            payload: { reason: 'SECOND_POINTER_IGNORED' satisfies CancelReason },
          }],
        };
      }
      if (!event.affordable) {
        // A card priced out by the turnover budget never enters GRIP. Tapping
        // it opens only its explanation.
        return {
          context: initialGestureContext(),
          effects: [
            { type: 'CANCEL', reason: 'UNAFFORDABLE' },
            {
              type: 'TELEMETRY',
              event: 'gesture.cancelled',
              payload: { reason: 'UNAFFORDABLE' satisfies CancelReason, actionCode: event.actionCode },
            },
          ],
        };
      }
      return {
        context: {
          ...initialGestureContext(),
          state: 'GRIP',
          pointerId: event.pointerId,
          actionCode: event.actionCode,
          startedAt: event.timestamp,
        },
        effects: [{
          type: 'TELEMETRY',
          event: 'gesture.started',
          payload: { actionCode: event.actionCode, deviceClass: geometry.deviceClass },
        }],
      };
    }

    case 'MOVE': {
      if (context.state !== 'GRIP' && context.state !== 'PULL') return { context, effects: [] };
      if (event.pointerId !== context.pointerId) return { context, effects: [] };

      const raw = convictionForDistance(event.distance, geometry);
      const effects: GestureEffect[] = [];

      // Back inside the dead zone: disarm. Re-gripping costs nothing, because
      // exploring the pull without consequence is how the gesture teaches
      // itself. A release from here does nothing at all.
      if (raw === null) {
        if (context.state === 'PULL') {
          effects.push(
            { type: 'CANCEL', reason: 'RETURNED_TO_DEAD_ZONE' },
            {
              type: 'TELEMETRY',
              event: 'gesture.cancelled',
              payload: { reason: 'RETURNED_TO_DEAD_ZONE' satisfies CancelReason },
            },
          );
        }
        return {
          context: {
            ...context,
            state: 'GRIP',
            conviction: null,
            lastDetent: null,
            governorReported: false,
            hardStopReported: false,
          },
          effects,
        };
      }

      const governed = clampConviction(raw, checkpointSequence);
      const arming = context.state === 'GRIP';
      if (arming) {
        effects.push({ type: 'ARM' });
        effects.push({
          type: 'TELEMETRY',
          event: 'gesture.armed',
          payload: { actionCode: context.actionCode, conviction: governed },
        });
      }

      // The governor is a limiter on the value, never a remap of the mapping.
      // Pulling past the cap reports once, distinctly, and does not tick.
      const cappedByGovernor = Math.round(raw) > governed;
      let governorReported = context.governorReported;
      if (cappedByGovernor && !context.governorReported) {
        effects.push({ type: 'GOVERNOR_BLOCKED', conviction: governed });
        governorReported = true;
      } else if (!cappedByGovernor) {
        governorReported = false;
      }

      let hardStopReported = context.hardStopReported;
      if (!cappedByGovernor && governed >= CONVICTION_MAX && !context.hardStopReported) {
        effects.push({ type: 'HARD_STOP' });
        hardStopReported = true;
      } else if (governed < CONVICTION_MAX) {
        hardStopReported = false;
      }

      // Detents are landmarks on the way, reported once per crossing. They do
      // not quantize the value: the conviction carried is the governed one.
      let lastDetent = context.lastDetent;
      if (!cappedByGovernor && isDetent(governed) && governed !== context.lastDetent) {
        effects.push({ type: 'DETENT', conviction: governed, landmark: isLandmark(governed) });
        lastDetent = governed;
      } else if (!isDetent(governed)) {
        lastDetent = context.lastDetent;
      }

      return {
        context: {
          ...context,
          state: 'PULL',
          conviction: governed,
          hasArmed: context.hasArmed || arming,
          lastDetent,
          governorReported,
          hardStopReported,
        },
        effects,
      };
    }

    case 'RELEASE': {
      if (event.pointerId !== context.pointerId) return { context, effects: [] };

      // Armed release: the only path that commits, and it commits at the value
      // showing, with no delay and nothing to wait for.
      if (context.state === 'PULL' && context.conviction !== null) {
        const conviction = context.conviction;
        return {
          context: { ...initialGestureContext(), state: 'SETTLED' },
          effects: [
            { type: 'COMMIT', conviction },
            {
              type: 'TELEMETRY',
              event: 'gesture.committed',
              payload: {
                actionCode: context.actionCode,
                conviction,
                elapsedMs: context.startedAt === null ? null : event.timestamp - context.startedAt,
              },
            },
          ],
        };
      }

      if (context.state === 'GRIP') {
        // Timidity is never punished. A release that never armed opens the
        // precise controls; a release after disarming does nothing, because
        // the player already withdrew from this pull deliberately.
        if (context.hasArmed) {
          return {
            context: { ...initialGestureContext(), state: 'SETTLED' },
            effects: [{
              type: 'TELEMETRY',
              event: 'gesture.dead_zone_released',
              payload: { actionCode: context.actionCode, afterDisarm: true },
            }],
          };
        }
        const actionCode = context.actionCode;
        return {
          context: { ...initialGestureContext(), state: 'SETTLED' },
          effects: actionCode
            ? [
                { type: 'OPEN_FOCUSED_CONTROLS', actionCode },
                {
                  type: 'TELEMETRY',
                  event: 'gesture.dead_zone_released',
                  payload: { actionCode, afterDisarm: false },
                },
                {
                  type: 'TELEMETRY',
                  event: 'gesture.focused_controls_opened',
                  payload: { actionCode, via: 'DEAD_ZONE_RELEASE' },
                },
              ]
            : [],
        };
      }

      return { context, effects: [] };
    }

    case 'POINTER_CANCEL':
      if (context.state === 'READ' || context.state === 'SETTLED') return { context, effects: [] };
      if (event.pointerId !== context.pointerId) return { context, effects: [] };
      return settle(context, 'POINTER_CANCEL');

    case 'CAPTURE_LOST':
      if (context.state === 'READ' || context.state === 'SETTLED') return { context, effects: [] };
      if (event.pointerId !== context.pointerId) return { context, effects: [] };
      return settle(context, 'CAPTURE_LOST');

    case 'VISIBILITY_CHANGE':
      if (context.state === 'READ' || context.state === 'SETTLED') return { context, effects: [] };
      return settle(context, 'VISIBILITY_CHANGE');

    case 'ORIENTATION_CHANGE':
      if (context.state === 'READ' || context.state === 'SETTLED') return { context, effects: [] };
      return settle(context, 'ORIENTATION_CHANGE');

    case 'SECOND_POINTER':
      // Ignored entirely: the gesture continues undisturbed.
      return {
        context,
        effects: [{
          type: 'TELEMETRY',
          event: 'gesture.cancelled',
          payload: { reason: 'SECOND_POINTER_IGNORED' satisfies CancelReason, ignored: true },
        }],
      };

    default:
      return { context, effects: [] };
  }
}

/** Convenience: run a whole event sequence and collect every effect. */
export function runGesture(
  events: GestureEvent[],
  config: GestureConfig,
  start: GestureContext = initialGestureContext(),
): { context: GestureContext; effects: GestureEffect[] } {
  let context = start;
  const effects: GestureEffect[] = [];
  for (const event of events) {
    const result = gestureReducer(context, event, config);
    context = result.context;
    effects.push(...result.effects);
  }
  return { context, effects };
}
