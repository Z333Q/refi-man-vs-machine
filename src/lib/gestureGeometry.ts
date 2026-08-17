import { CONVICTION_MAX, CONVICTION_MIN } from './decisionContract';

// ─── Pull geometry ────────────────────────────────────────────────────────────
// The distance-to-conviction mapping, and nothing else. Pure, frame-free and
// pointer-free, so the physics can be tested without a browser and the same
// numbers can be asserted against the slider path.
//
// This is a scaled radial dead zone, the technique analog sticks use, made
// piecewise with a knee near the top of the range. See
// docs/g1-gesture-research.md section 1. The remap of the surviving range back
// onto the full output is what makes conviction rise continuously from exactly
// CONVICTION_MIN at the arm point instead of jumping.

export type DeviceClass = 'STANDARD' | 'COMPACT';

export interface PullGeometry {
  deviceClass: DeviceClass;
  /** Radial distance below which the pull is not armed. */
  deadZone: number;
  /** Radial distance where the gain changes and the high-draw range starts. */
  knee: number;
  /** Radial distance at the hard stop. */
  fullDraw: number;
  /** Conviction at the knee. Below it the working range, above the high draw. */
  kneeConviction: number;
}

// Standard geometry, in CSS points. Addendum C section 2.1.
//
// Note on units: 195 pt is about 32 mm on a current phone (roughly 154 pt per
// inch of logical density), not the 52 mm the addendum annotates. The distances
// are correct and the annotation is not; see research section 3.
// Addendum C Amendment 2. The knee moved to conviction 75, and the knee
// DISTANCE moved with it. Those two changes do not travel separately: leaving
// the knee at 150 pt while the conviction moved to 75 would put 20 conviction
// points across 45 pt of high-draw travel, making a point at the top cost
// 2.25 pt against 4.88 pt in the working range. Reaching 95 would become
// easier than it was, inverting the safety property in section 2.1.
//
// 115 pt is the distance that preserves the working-range gradient: 87 pt over
// 25 points is 3.48 pt per point, against the original 122 pt over 35 points
// at 3.486. Calibration the hand learned below 75 survives untouched, and the
// high-draw range stays more expensive at 4.0 pt per point.
//
// THE EFFORT-RAMP INVARIANT, asserted by test in gesture.test.ts:
//
//   (fullDraw - knee) / (CONVICTION_MAX - kneeConviction)
//     MUST EXCEED
//   (knee - deadZone) / (kneeConviction - CONVICTION_MIN)
//
// A point above the knee must cost more travel than a point below it. No
// single constant implies this; changing one of them alone can invert it.
const STANDARD: Omit<PullGeometry, 'deviceClass'> = {
  deadZone: 28,
  knee: 115,
  fullDraw: 195,
  kneeConviction: 75,
};

// The drawing stretches; the meaning must not. The mapping above is in physical
// points and is never expressed as a fraction of the viewport: identical thumb
// travel has to mean identical conviction on every device, or the promise that
// "the calibration you build here is the calibration you keep" is false. The
// track graphic may size itself freely; these numbers may not.

/**
 * Minimum engagement in the pull before a release is allowed to commit.
 *
 * Addendum C Amendment 2. The gesture has no confirm dialog: the pull is the
 * confirmation, and deliberateness comes from the dead zone plus this floor
 * rather than from a second tap. A release faster than this is a flick, and a
 * flick must never commit a decision that cannot be undone.
 */
export const MIN_ENGAGEMENT_MS = 350;

// Addendum C section C.3. One scale, two classes, decided once per run.
export const COMPACT_SCALE = 0.85;

export function geometryFor(deviceClass: DeviceClass): PullGeometry {
  if (deviceClass === 'STANDARD') return { deviceClass, ...STANDARD };
  return {
    deviceClass,
    deadZone: STANDARD.deadZone * COMPACT_SCALE,
    knee: STANDARD.knee * COMPACT_SCALE,
    fullDraw: STANDARD.fullDraw * COMPACT_SCALE,
    kneeConviction: STANDARD.kneeConviction,
  };
}

// ─── Device classification ────────────────────────────────────────────────────

export interface Region {
  width: number;
  height: number;
}

/**
 * Guaranteed pull clearance from a grip origin.
 *
 * Clearance from a grip point, per direction in the working arc.
 *
 * The working arc is the lower half plane (down, left, right), because the
 * affordance coaxes the thumb downward and upward pulls are never required.
 *
 * This used to return the SMALLEST of the three, on the reasoning that a
 * direction-agnostic pull must be able to reach full draw whichever way the
 * finger goes. The reasoning holds; the predicate built on it did not. Needing
 * room to the left AND the right simultaneously means the region has to be at
 * least twice the full draw wide before a single pullable point exists:
 *
 *     2 x COMPACT full draw = 331.5pt
 *
 * A 390pt phone offers a 354pt stance region. It clears that bound by 22pt, so
 * the pullable area on a phone was a 22pt vertical slit down the middle of the
 * region, narrower than a fingertip. Measured across the region, 96.2% of grip
 * points resolved to PRECISE_CONTROLS. The pull was not hard to find on a
 * phone; it was unreachable, and had been since it was built. Desktop carries
 * roughly 900pt of width, so it always passed there and nothing showed.
 *
 * The correct question is whether the finger has room in SOME direction, not
 * in every direction at once. A pull needs one way out, not three.
 */
export function clearanceByDirection(
  origin: { x: number; y: number },
  region: Region,
): { left: number; right: number; down: number } {
  return {
    left: Math.max(0, origin.x),
    right: Math.max(0, region.width - origin.x),
    down: Math.max(0, region.height - origin.y),
  };
}

/** The most room available in any single direction of the working arc. */
export function clearanceAt(origin: { x: number; y: number }, region: Region): number {
  const c = clearanceByDirection(origin, region);
  return Math.max(c.left, c.right, c.down);
}

/**
 * The old all-directions measure, kept for sizing rather than availability.
 *
 * These are two different questions and conflating them is what broke the
 * phone. "Can this grip pull at all" needs one way out. "How large should the
 * geometry be here" is an ergonomic question about a cramped space, and the
 * conservative answer is the right one: a region that is tight in any direction
 * should shrink the draw, not lengthen it.
 *
 * Without this split, correcting availability also flips a phone from COMPACT
 * to STANDARD, growing the required thumb travel from 165.8pt to 195pt on the
 * smallest screens, which is the opposite of what the compact class is for.
 */
export function seatingClearanceAt(origin: { x: number; y: number }, region: Region): number {
  const c = clearanceByDirection(origin, region);
  return Math.max(0, Math.min(c.left, c.right, c.down));
}

export function hasClearance(
  origin: { x: number; y: number },
  region: Region,
  geometry: PullGeometry,
): boolean {
  return clearanceAt(origin, region) >= geometry.fullDraw;
}

/**
 * The decision region in client coordinates.
 *
 * Carrying the offset alongside the size is what makes the clearance call
 * impossible to get wrong: a caller holding only width and height is one step
 * away from measuring a viewport-space pointer against region-space bounds,
 * which reads as plenty of clearance on an offset region and none at the top
 * left. The conversion belongs here, once.
 */
export interface RegionBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * What a grip at this point is allowed to become.
 *
 * Warning at grip time and letting the pull start anyway is the wrong shape:
 * the player discovers halfway down that the geometry cannot reach full draw,
 * having already committed the movement. The decision is therefore made before
 * the gesture owns the pointer.
 *
 *   affordable + clearance      PULL               the gesture may run
 *   affordable + no clearance   PRECISE_CONTROLS   hand the stance to the slider
 *   unaffordable                UNAVAILABLE        not committable by any door
 *
 * UNAVAILABLE is deliberately distinct from PRECISE_CONTROLS. A stance priced
 * out by the turnover budget must not become pending, must not take focus and
 * must not commit, so routing it to the precise controls would smuggle it into
 * a committable state through the fallback. The card may still explain itself;
 * that is all.
 */
export type GripDisposition = 'PULL' | 'PRECISE_CONTROLS' | 'UNAVAILABLE';

export function gripDisposition(
  clientPoint: { x: number; y: number },
  bounds: RegionBounds,
  geometry: PullGeometry,
  affordable: boolean,
): GripDisposition {
  if (!affordable) return 'UNAVAILABLE';
  const localOrigin = { x: clientPoint.x - bounds.left, y: clientPoint.y - bounds.top };
  const region: Region = { width: bounds.width, height: bounds.height };
  return hasClearance(localOrigin, region, geometry) ? 'PULL' : 'PRECISE_CONTROLS';
}

/**
 * Pick the device class once, from the usable decision region rather than raw
 * viewport height. Browser chrome, safe areas, landscape tablets and embedded
 * webviews all distort raw height, and the classification has to reflect the
 * space the gesture actually gets (Addendum C section C.3).
 *
 * A region that cannot seat a standard full draw with its dead zone to spare
 * anywhere along its width falls back to compact.
 */
export function classifyDevice(region: Region): DeviceClass {
  const standard = geometryFor('STANDARD');
  // The most forgiving placement is the horizontal centre, high in the region:
  // it maximises the downward run while keeping both lateral options open.
  // Sizing uses the conservative measure on purpose; see seatingClearanceAt.
  const bestCase = seatingClearanceAt({ x: region.width / 2, y: standard.deadZone }, region);
  return bestCase >= standard.fullDraw ? 'STANDARD' : 'COMPACT';
}

// ─── Distance to conviction ───────────────────────────────────────────────────

/** Radial distance between two points. Direction carries no meaning. */
export function radialDistance(
  origin: { x: number; y: number },
  point: { x: number; y: number },
): number {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return Math.hypot(dx, dy);
}

/**
 * The permanent mapping. Returns null inside the dead zone, where there is no
 * conviction because there is no armed pull.
 *
 * Piecewise linear with a knee: the working range trades distance for reach,
 * the high-draw range trades it for resolution. Values are not rounded here so
 * the caller can round once, at the same place the committed value is taken.
 */
export function convictionForDistance(distance: number, geometry: PullGeometry): number | null {
  const { deadZone, knee, fullDraw, kneeConviction } = geometry;
  if (distance < deadZone) return null;

  if (distance <= knee) {
    // Scaled radial remap: the surviving range maps onto CONVICTION_MIN..knee.
    const t = (distance - deadZone) / (knee - deadZone);
    return CONVICTION_MIN + t * (kneeConviction - CONVICTION_MIN);
  }

  // Hard stop. Past full draw the value does not grow; the band compresses.
  const clamped = Math.min(distance, fullDraw);
  const t = (clamped - knee) / (fullDraw - knee);
  return kneeConviction + t * (CONVICTION_MAX - kneeConviction);
}

/** The inverse, for drawing the meter, the ghost tick and the previous marker. */
export function distanceForConviction(conviction: number, geometry: PullGeometry): number {
  const { deadZone, knee, fullDraw, kneeConviction } = geometry;
  const v = Math.max(CONVICTION_MIN, Math.min(CONVICTION_MAX, conviction));

  if (v <= kneeConviction) {
    const t = (v - CONVICTION_MIN) / (kneeConviction - CONVICTION_MIN);
    return deadZone + t * (knee - deadZone);
  }
  const t = (v - kneeConviction) / (CONVICTION_MAX - kneeConviction);
  return knee + t * (fullDraw - knee);
}

/** Distance per conviction point in each range. Lower gain is finer control. */
export function gainAt(distance: number, geometry: PullGeometry): number {
  const { knee, fullDraw, kneeConviction } = geometry;
  return distance <= knee
    ? (knee - geometry.deadZone) / (kneeConviction - CONVICTION_MIN)
    : (fullDraw - knee) / (CONVICTION_MAX - kneeConviction);
}

/**
 * How far past the hard stop the finger has gone, rendered as compression
 * rather than stretch. Apple's rubber band curve: resistance grows so the band
 * never runs out, and the further you pull the less it gives.
 *
 *   b = (1 - 1/((x·c/d) + 1))·d      with c = 0.55
 */
export function rubberBand(overshoot: number, dimension: number, c = 0.55): number {
  if (overshoot <= 0 || dimension <= 0) return 0;
  return (1 - 1 / ((overshoot * c) / dimension + 1)) * dimension;
}
