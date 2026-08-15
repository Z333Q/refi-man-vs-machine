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
const STANDARD: Omit<PullGeometry, 'deviceClass'> = {
  deadZone: 28,
  knee: 150,
  fullDraw: 195,
  kneeConviction: 85,
};

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
 * The pull is direction-agnostic, so every direction in the working arc has to
 * be able to reach full draw. If the finger runs out of screen first, the
 * reachable conviction silently caps below the maximum in that direction,
 * which breaks the geometry contract invisibly and by direction. The working
 * arc is the lower half plane (down, left, right), because the affordance
 * coaxes the thumb downward and upward pulls are never required.
 *
 * Conservative: the smallest distance to a boundary across that arc.
 */
export function clearanceAt(origin: { x: number; y: number }, region: Region): number {
  return Math.max(0, Math.min(origin.x, region.width - origin.x, region.height - origin.y));
}

export function hasClearance(
  origin: { x: number; y: number },
  region: Region,
  geometry: PullGeometry,
): boolean {
  return clearanceAt(origin, region) >= geometry.fullDraw;
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
  // The most forgiving placement is the horizontal centre, high in the region.
  const bestCase = clearanceAt({ x: region.width / 2, y: standard.deadZone }, region);
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
