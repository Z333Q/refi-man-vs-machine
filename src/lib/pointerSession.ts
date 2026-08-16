import type { ActionCode } from './gameTypes';
import { radialDistance } from './gestureGeometry';
import { PullFilter } from './oneEuroFilter';
import type { GestureEvent } from './gestureMachine';

// ─── Pointer to gesture events ────────────────────────────────────────────────
// The translation layer between raw pointer samples and the state machine:
// origin capture, coalesced-sample consumption, the jitter filter, and the
// timestamp that decides the engagement floor.
//
// This lived inside PullToCommit's event handlers, which made it the one part
// of the gesture no test could reach without a DOM. Addendum C §6 asks for a
// pointer-path replay proving the gesture and the slider produce identical run
// state, and a defect in exactly this layer (a dropped coalesced batch, a
// filter reset missed between pulls, a timestamp read from the wrong clock)
// would leave every machine-level test green.
//
// It is extracted rather than duplicated on purpose: the component drives this
// module, so the replay test exercises the shipping path instead of a parallel
// re-implementation that could drift from it silently.

/** The fields this layer needs from a PointerEvent. Synthesizable in a test. */
export interface PointerSample {
  pointerId: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
}

export class PullSession {
  private origin: { x: number; y: number } | null = null;
  private filter = new PullFilter();
  private raw = 0;

  /** Radial distance of the last sample, unfiltered. For band rendering only. */
  get rawDistance(): number {
    return this.raw;
  }

  get engaged(): boolean {
    return this.origin !== null;
  }

  /** The grip origin, for drawing the band from the card toward the finger. */
  get gripOrigin(): { x: number; y: number } | null {
    return this.origin;
  }

  /**
   * Begin a pull. Resets the filter, because carrying jitter state across two
   * separate gestures would let the tail of one pull bend the head of the next.
   */
  down(sample: PointerSample, actionCode: ActionCode, affordable: boolean): GestureEvent {
    this.origin = { x: sample.clientX, y: sample.clientY };
    this.filter.reset();
    this.raw = 0;
    return {
      type: 'GRIP_START',
      pointerId: sample.pointerId,
      actionCode,
      affordable,
      timestamp: sample.timeStamp,
    };
  }

  /**
   * Consume a move, including any samples the browser coalesced into it.
   *
   * Touch sampling commonly runs at double the refresh rate, so the coalesced
   * batch is real data: feeding only the dispatched event to the filter throws
   * half the signal away and makes the filtered value lag the finger.
   *
   * Returns null when there is no active pull, so a stray move cannot
   * manufacture a machine event.
   */
  move(samples: PointerSample[], dispatched: PointerSample): GestureEvent | null {
    const origin = this.origin;
    if (!origin) return null;

    const batch = samples.length > 0 ? samples : [dispatched];
    let filtered = 0;
    let last = batch[batch.length - 1];

    for (const sample of batch) {
      last = sample;
      filtered = this.filter.filter(
        radialDistance(origin, { x: sample.clientX, y: sample.clientY }),
        // The filter works in seconds; pointer timestamps arrive in ms.
        sample.timeStamp / 1000,
      );
    }

    this.raw = radialDistance(origin, { x: last.clientX, y: last.clientY });

    return {
      type: 'MOVE',
      pointerId: dispatched.pointerId,
      distance: filtered,
      timestamp: dispatched.timeStamp,
    };
  }

  /**
   * End the pull. The timestamp carried here is what the engagement floor
   * measures against, and it comes from the input event rather than a render
   * clock, so a slow frame cannot turn a deliberate pull into a flick.
   */
  up(sample: PointerSample): GestureEvent {
    this.origin = null;
    this.raw = 0;
    return { type: 'RELEASE', pointerId: sample.pointerId, timestamp: sample.timeStamp };
  }

  cancel(sample: PointerSample): GestureEvent {
    this.origin = null;
    this.raw = 0;
    return { type: 'POINTER_CANCEL', pointerId: sample.pointerId };
  }
}
