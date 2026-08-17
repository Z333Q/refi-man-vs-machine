import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  gripDisposition, classifyDevice, geometryFor, clearanceAt, seatingClearanceAt,
  clearanceByDirection, type Region,
} from './gestureGeometry';

// ─── The pull has to be reachable where it is the natural input ──────────────
// The pull is a touch gesture, so the phone is the platform where it is the
// primary interaction. It was unreachable there: because clearance demanded
// room in every direction at once, a region had to be twice the full draw wide
// before one pullable point existed, and the pullable area on a 390pt phone
// was a 22pt slit down the middle, narrower than a fingertip. 96.2% of grips
// fell through to the slider.
//
// Desktop carries ~900pt of width so it always passed, which is why nothing
// caught this. These tests measure the phone directly.

/** The stance card list on a 390pt viewport, inside px-4 panel padding. */
const PHONE: Region = { width: 354, height: 376 };
/** The narrowest viewport the game claims to support. */
const NARROW_PHONE: Region = { width: 328, height: 360 };
const DESKTOP: Region = { width: 900, height: 600 };

function pullFraction(region: Region): number {
  const geometry = geometryFor(classifyDevice(region));
  const bounds = { left: 0, top: 0, width: region.width, height: region.height };
  let pull = 0, total = 0;
  for (let x = 0; x <= region.width; x += 2) {
    for (let y = 0; y <= region.height; y += 2) {
      total += 1;
      if (gripDisposition({ x, y }, bounds, geometry, true) === 'PULL') pull += 1;
    }
  }
  return pull / total;
}

test('a phone-sized region is overwhelmingly pullable', () => {
  // The regression this file exists for. Before the fix this was 0.038.
  assert.ok(pullFraction(PHONE) > 0.9, `only ${(pullFraction(PHONE) * 100).toFixed(1)}% pullable`);
  assert.ok(pullFraction(NARROW_PHONE) > 0.9, 'narrow phone is not pullable');
});

test('the pullable area is wider than a fingertip', () => {
  // The real failure was not the percentage, it was that the pullable strip was
  // 22pt across. A target has to be hittable without aiming.
  const FINGERTIP_PT = 44; // the conventional minimum touch target
  const geometry = geometryFor(classifyDevice(PHONE));
  const bounds = { left: 0, top: 0, ...PHONE };
  const y = geometry.deadZone + 10;
  const xs: number[] = [];
  for (let x = 0; x <= PHONE.width; x += 1) {
    if (gripDisposition({ x, y }, bounds, geometry, true) === 'PULL') xs.push(x);
  }
  assert.ok(xs.length >= FINGERTIP_PT, `pullable strip is only ${xs.length}pt wide`);
});

test('one way out is enough', () => {
  // The predicate asks whether the finger has room in SOME direction, not in
  // every direction at once. A grip hard against the left edge has no room to
  // the left and plenty to the right, and must still be able to pull.
  const geometry = geometryFor('COMPACT');
  const bounds = { left: 0, top: 0, ...PHONE };
  for (const x of [0, 2, PHONE.width - 2, PHONE.width]) {
    assert.equal(
      gripDisposition({ x, y: geometry.deadZone }, bounds, geometry, true),
      'PULL',
      `edge grip at x=${x} cannot pull`,
    );
  }
});

test('clearance reports the best direction, seating reports the worst', () => {
  // These are two different questions and conflating them is what broke the
  // phone. Availability wants the best case; sizing wants the worst.
  const origin = { x: 10, y: 10 };
  const c = clearanceByDirection(origin, PHONE);
  assert.equal(clearanceAt(origin, PHONE), Math.max(c.left, c.right, c.down));
  assert.equal(seatingClearanceAt(origin, PHONE), Math.min(c.left, c.right, c.down));
  assert.ok(clearanceAt(origin, PHONE) > seatingClearanceAt(origin, PHONE));
});

test('sizing still shrinks the draw on a phone', () => {
  // Correcting availability must not lengthen the thumb travel. If sizing used
  // the same best-case measure, a phone would classify STANDARD and the draw
  // would grow from 165.8pt to 195pt on the smallest screens.
  assert.equal(classifyDevice(PHONE), 'COMPACT');
  assert.equal(classifyDevice(NARROW_PHONE), 'COMPACT');
  assert.equal(classifyDevice(DESKTOP), 'STANDARD');
  assert.ok(geometryFor('COMPACT').fullDraw < geometryFor('STANDARD').fullDraw);
});

test('desktop behaviour is unchanged', () => {
  assert.equal(pullFraction(DESKTOP), 1);
  assert.equal(classifyDevice(DESKTOP), 'STANDARD');
});

test('an unaffordable stance still refuses the pull', () => {
  const geometry = geometryFor('COMPACT');
  const bounds = { left: 0, top: 0, ...PHONE };
  assert.equal(
    gripDisposition({ x: PHONE.width / 2, y: geometry.deadZone }, bounds, geometry, false),
    'UNAVAILABLE',
  );
});
