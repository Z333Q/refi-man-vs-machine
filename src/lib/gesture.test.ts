import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionCode } from './gameTypes';
import {
  geometryFor, classifyDevice, clearanceAt, hasClearance, radialDistance,
  convictionForDistance, distanceForConviction, gainAt, rubberBand, COMPACT_SCALE,
} from './gestureGeometry';
import { OneEuroFilter, MedianOf3, PullFilter, DEFAULT_ONE_EURO } from './oneEuroFilter';
import {
  gestureReducer, runGesture,
  type GestureEffect, type GestureEvent, type GestureConfig,
} from './gestureMachine';
import {
  CONVICTION_MIN, CONVICTION_MAX, clampConviction, convictionToConfidence,
} from './decisionContract';
import { createInitialRun, commitPendingDecision } from './runEngine';

const STD = geometryFor('STANDARD');
const openConfig: GestureConfig = { geometry: STD, checkpointSequence: 9 };
const governedConfig: GestureConfig = { geometry: STD, checkpointSequence: 1 };

function effectsOf(effects: GestureEffect[], type: GestureEffect['type']) {
  return effects.filter(e => e.type === type);
}

// ─── Geometry: the scaled radial mapping ──────────────────────────────────────

test('conviction is undefined inside the dead zone and exactly the minimum at the arm point', () => {
  assert.equal(convictionForDistance(0, STD), null);
  assert.equal(convictionForDistance(27.9, STD), null);
  assert.equal(convictionForDistance(STD.deadZone, STD), CONVICTION_MIN);
});

test('the mapping is continuous, so there is no jump at the arm point', () => {
  // The remap of the surviving range is what buys this. A plain radial dead
  // zone would step from nothing straight to the dead-zone magnitude.
  const justInside = convictionForDistance(STD.deadZone - 0.001, STD);
  const atEdge = convictionForDistance(STD.deadZone, STD);
  const justOutside = convictionForDistance(STD.deadZone + 0.001, STD);
  assert.equal(justInside, null);
  assert.equal(atEdge, CONVICTION_MIN);
  assert.ok((justOutside as number) - CONVICTION_MIN < 0.01);
});

test('the knee and the hard stop land on their authored convictions', () => {
  assert.equal(convictionForDistance(STD.knee, STD), 85);
  assert.equal(convictionForDistance(STD.fullDraw, STD), CONVICTION_MAX);
});

test('the mapping is monotonic and never exceeds the hard stop', () => {
  let previous = -Infinity;
  for (let d = STD.deadZone; d <= STD.fullDraw + 200; d += 0.5) {
    const v = convictionForDistance(d, STD) as number;
    assert.ok(v >= previous, `not monotonic at ${d}`);
    assert.ok(v <= CONVICTION_MAX, `exceeded max at ${d}`);
    previous = v;
  }
  // Past full draw the value is pinned: the band compresses, the number does not.
  assert.equal(convictionForDistance(400, STD), CONVICTION_MAX);
});

test('distance and conviction round-trip through the knee', () => {
  for (const v of [50, 60, 70, 72, 85, 88, 95]) {
    const d = distanceForConviction(v, STD);
    assert.ok(Math.abs((convictionForDistance(d, STD) as number) - v) < 1e-9, `${v}`);
  }
});

test('the high-draw range trades reach for resolution', () => {
  // Points of distance per point of conviction. Per five-point detent that is
  // 17.43 pt in the working range and 22.50 pt above the knee.
  const working = gainAt(100, STD);
  const highDraw = gainAt(170, STD);
  assert.ok(Math.abs(working - 3.4857143) < 1e-6, `working gain ${working}`);
  assert.ok(Math.abs(working * 5 - 17.428571) < 1e-5);
  assert.ok(Math.abs(highDraw - 4.5) < 1e-9);
  assert.ok(Math.abs(highDraw * 5 - 22.5) < 1e-9);
  // 29% more distance per conviction point above the knee, which is finer
  // control, not a harder target. See docs/g1-gesture-research.md section 4.
  assert.ok(highDraw / working > 1.28 && highDraw / working < 1.30);
});

test('reaching the hard stop costs 37% more travel than reaching the knee', () => {
  // This is the true safety property. The addendum's claim that expanded
  // spacing makes the maximum harder to hit does not survive Fitts's law: the
  // wider targets almost exactly cancel the extra distance, and a hard stop is
  // a target of unbounded width. Travel cost is what actually holds.
  const toKnee = STD.knee - STD.deadZone;
  const toStop = STD.fullDraw - STD.deadZone;
  assert.ok(Math.abs(toStop / toKnee - 1.3689) < 1e-3);
});

test('direction carries no meaning, only distance', () => {
  const origin = { x: 200, y: 300 };
  const r = 100;
  const values = new Set<number>();
  for (let deg = 0; deg < 360; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    const point = { x: origin.x + r * Math.cos(rad), y: origin.y + r * Math.sin(rad) };
    assert.ok(Math.abs(radialDistance(origin, point) - r) < 1e-9);
    values.add(Math.round((convictionForDistance(r, STD) as number) * 1e6));
  }
  assert.equal(values.size, 1, 'the same distance must mean the same conviction in every direction');
});

// ─── Device class and clearance ───────────────────────────────────────────────

test('compact scales every distance by one constant', () => {
  const compact = geometryFor('COMPACT');
  assert.equal(compact.fullDraw, STD.fullDraw * COMPACT_SCALE);
  assert.equal(compact.knee, STD.knee * COMPACT_SCALE);
  assert.equal(compact.deadZone, STD.deadZone * COMPACT_SCALE);
  // The endpoints still mean the same convictions: the road is shorter, not
  // differently marked.
  assert.equal(convictionForDistance(compact.deadZone, compact), CONVICTION_MIN);
  assert.equal(convictionForDistance(compact.knee, compact), 85);
  assert.equal(convictionForDistance(compact.fullDraw, compact), CONVICTION_MAX);
});

test('a roomy region classifies standard and a cramped one compact', () => {
  assert.equal(classifyDevice({ width: 820, height: 1180 }), 'STANDARD'); // tablet
  assert.equal(classifyDevice({ width: 393, height: 852 }), 'STANDARD');  // modern phone
  assert.equal(classifyDevice({ width: 320, height: 480 }), 'COMPACT');   // small phone
  assert.equal(classifyDevice({ width: 393, height: 200 }), 'COMPACT');   // short webview
});

test('clearance is the worst direction in the working arc, not the best', () => {
  const region = { width: 400, height: 800 };
  assert.equal(clearanceAt({ x: 200, y: 100 }, region), 200);
  // Near the left edge the leftward pull is what runs out first.
  assert.equal(clearanceAt({ x: 30, y: 100 }, region), 30);
  // Near the bottom the downward pull runs out first.
  assert.equal(clearanceAt({ x: 200, y: 780 }, region), 20);
});

test('a card without full clearance is a geometry violation, and detectable', () => {
  const region = { width: 400, height: 800 };
  assert.equal(hasClearance({ x: 200, y: 100 }, region, STD), true);
  assert.equal(hasClearance({ x: 30, y: 100 }, region, STD), false);
  assert.equal(hasClearance({ x: 200, y: 700 }, region, STD), false);
  // Compact needs less room, which is the point of the class.
  assert.equal(hasClearance({ x: 170, y: 100 }, region, geometryFor('COMPACT')), true);
});

// ─── Rubber band past the stop ────────────────────────────────────────────────

test('overshoot past the hard stop compresses and never runs out', () => {
  const d = 200;
  assert.equal(rubberBand(0, d), 0);
  const small = rubberBand(20, d);
  const large = rubberBand(200, d);
  assert.ok(small > 0 && small < 20, 'resistance from the first point');
  assert.ok(large < 200, 'always gives less than it is pulled');
  assert.ok(large < d, 'asymptotically bounded by the dimension');
  // Monotonic and decelerating: each extra point of pull gives less.
  assert.ok(rubberBand(40, d) - rubberBand(20, d) < rubberBand(20, d) - rubberBand(0, d));
});

// ─── Filtering ────────────────────────────────────────────────────────────────

test('the median rejects a single teleporting sample', () => {
  const m = new MedianOf3();
  m.push(100); m.push(101);
  assert.equal(m.push(9999), 101, 'an outlier must not survive');
  assert.equal(m.push(102), 102);
});

test('the one euro filter smooths a stationary noisy signal', () => {
  const f = new OneEuroFilter(DEFAULT_ONE_EURO);
  // A resting thumb: constant position, small alternating jitter.
  let t = 0;
  const raw: number[] = [];
  const filtered: number[] = [];
  for (let i = 0; i < 120; i++) {
    t += 1 / 120;
    const value = 100 + (i % 2 === 0 ? 1.5 : -1.5);
    raw.push(value);
    filtered.push(f.filter(value, t));
  }
  const spread = (xs: number[]) => Math.max(...xs.slice(20)) - Math.min(...xs.slice(20));
  assert.ok(spread(filtered) < spread(raw) / 4, 'jitter should be well reduced when slow');
});

test('the one euro filter still tracks a fast move', () => {
  const f = new OneEuroFilter(DEFAULT_ONE_EURO);
  let t = 0;
  let out = 0;
  for (let i = 0; i < 60; i++) {
    t += 1 / 120;
    out = f.filter(i * 5, t); // 600 points per second
  }
  // Lag is bounded: the filter should be close behind, not stuck at the start.
  assert.ok(out > 59 * 5 - 40, `too much lag: ${out}`);
});

test('the filter pipeline is deterministic for a given sample stream', () => {
  const run = () => {
    const p = new PullFilter();
    let t = 0;
    const out: number[] = [];
    for (const v of [0, 10, 40, 9999, 80, 120, 121, 119, 120]) {
      t += 1 / 120;
      out.push(p.filter(v, t));
    }
    return out;
  };
  assert.deepEqual(run(), run());
});

// ─── The state machine: Addendum C section 5 invariants ───────────────────────

function grip(affordable = true): GestureEvent {
  return { type: 'GRIP_START', pointerId: 1, actionCode: 'REDUCE' as ActionCode, affordable, timestamp: 0 };
}
function move(distance: number, timestamp = 100): GestureEvent {
  return { type: 'MOVE', pointerId: 1, distance, timestamp };
}
function release(timestamp = 200): GestureEvent {
  return { type: 'RELEASE', pointerId: 1, timestamp };
}

test('invariant 1: only a clean release commits', () => {
  const interruptions: GestureEvent[] = [
    { type: 'POINTER_CANCEL', pointerId: 1 },
    { type: 'CAPTURE_LOST', pointerId: 1 },
    { type: 'VISIBILITY_CHANGE' },
    { type: 'ORIENTATION_CHANGE' },
  ];
  for (const interruption of interruptions) {
    const { effects } = runGesture([grip(), move(160), interruption, release()], openConfig);
    assert.equal(effectsOf(effects, 'COMMIT').length, 0, `${interruption.type} must not commit`);
    assert.equal(effectsOf(effects, 'CANCEL').length, 1);
  }
});

test('invariant 1: every interruption reports its own reason', () => {
  const cases: [GestureEvent, string][] = [
    [{ type: 'POINTER_CANCEL', pointerId: 1 }, 'POINTER_CANCEL'],
    [{ type: 'CAPTURE_LOST', pointerId: 1 }, 'CAPTURE_LOST'],
    [{ type: 'VISIBILITY_CHANGE' }, 'VISIBILITY_CHANGE'],
    [{ type: 'ORIENTATION_CHANGE' }, 'ORIENTATION_CHANGE'],
  ];
  for (const [event, reason] of cases) {
    const { effects } = runGesture([grip(), move(160), event], openConfig);
    const cancel = effectsOf(effects, 'CANCEL')[0];
    assert.equal(cancel.type === 'CANCEL' && cancel.reason, reason);
    // Telemetry can tell exploration from defect, which is the whole point.
    const telemetry = effects.find(e => e.type === 'TELEMETRY' && e.event === 'gesture.cancelled');
    assert.ok(telemetry && telemetry.type === 'TELEMETRY');
    assert.equal((telemetry.payload as { reason: string }).reason, reason);
  }
});

test('invariant 5: arming is announced exactly once', () => {
  const { effects } = runGesture([grip(), move(60), move(90), move(120)], openConfig);
  assert.equal(effectsOf(effects, 'ARM').length, 1);
});

test('invariant 6: a release that never armed opens the controls and never commits', () => {
  const { effects } = runGesture([grip(), move(10), release()], openConfig);
  assert.equal(effectsOf(effects, 'COMMIT').length, 0);
  const opened = effectsOf(effects, 'OPEN_FOCUSED_CONTROLS')[0];
  assert.ok(opened && opened.type === 'OPEN_FOCUSED_CONTROLS');
  assert.equal(opened.actionCode, 'REDUCE');
});

test('a deliberate drag back to the dead zone disarms, and releasing then does nothing', () => {
  const { effects } = runGesture([grip(), move(160), move(5), release()], openConfig);
  assert.equal(effectsOf(effects, 'COMMIT').length, 0, 'must not commit');
  assert.equal(effectsOf(effects, 'OPEN_FOCUSED_CONTROLS').length, 0, 'withdrawal is not timidity');
  const cancel = effectsOf(effects, 'CANCEL')[0];
  assert.equal(cancel.type === 'CANCEL' && cancel.reason, 'RETURNED_TO_DEAD_ZONE');
});

test('re-arming after a disarm costs nothing', () => {
  const { context, effects } = runGesture([grip(), move(160), move(5), move(160), release()], openConfig);
  assert.equal(effectsOf(effects, 'COMMIT').length, 1, 'exploring must not lock the player out');
  assert.equal(context.state, 'SETTLED');
});

test('invariant 9: a second pointer is ignored and does not disturb the gesture', () => {
  const { effects } = runGesture(
    [grip(), move(160), { type: 'SECOND_POINTER', pointerId: 2 }, release()],
    openConfig,
  );
  assert.equal(effectsOf(effects, 'COMMIT').length, 1);
  assert.equal(effectsOf(effects, 'CANCEL').length, 0);
});

test('invariant 9: events from another pointer are ignored outright', () => {
  const { effects } = runGesture(
    [grip(), move(160), { type: 'RELEASE', pointerId: 99, timestamp: 150 }, release()],
    openConfig,
  );
  assert.equal(effectsOf(effects, 'COMMIT').length, 1);
});

test('invariant 10: an unaffordable card never enters grip', () => {
  const { context, effects } = runGesture([grip(false), move(160), release()], openConfig);
  assert.equal(effectsOf(effects, 'COMMIT').length, 0);
  assert.equal(effectsOf(effects, 'ARM').length, 0);
  assert.equal(effectsOf(effects, 'OPEN_FOCUSED_CONTROLS').length, 0);
  const cancel = effectsOf(effects, 'CANCEL')[0];
  assert.equal(cancel.type === 'CANCEL' && cancel.reason, 'UNAFFORDABLE');
  assert.equal(context.state, 'READ');
});

test('detents report once per crossing, with landmarks marked', () => {
  const distances = [];
  for (let d = 28; d <= 195; d += 1) distances.push(d);
  const { effects } = runGesture(
    [grip(), ...distances.map(d => move(d))],
    openConfig,
  );
  const detents = effectsOf(effects, 'DETENT');
  const values = detents.map(e => (e.type === 'DETENT' ? e.conviction : 0));
  // Every multiple of 5 from 50 to 95, once each.
  assert.deepEqual(values, [50, 55, 60, 65, 70, 75, 80, 85, 90, 95]);
  const landmarks = detents.filter(e => e.type === 'DETENT' && e.landmark)
    .map(e => (e.type === 'DETENT' ? e.conviction : 0));
  assert.deepEqual(landmarks, [70, 85, 95]);
});

test('the hard stop reports once, however far past it the finger goes', () => {
  const { effects } = runGesture([grip(), move(195), move(260), move(400)], openConfig);
  assert.equal(effectsOf(effects, 'HARD_STOP').length, 1);
});

test('the governor blocks distinctly and never ticks past its cap', () => {
  const distances = [];
  for (let d = 28; d <= 195; d += 1) distances.push(d);
  const { effects } = runGesture([grip(), ...distances.map(d => move(d))], governedConfig);

  const detents = effectsOf(effects, 'DETENT').map(e => (e.type === 'DETENT' ? e.conviction : 0));
  assert.deepEqual(detents, [60, 65, 70, 75], 'no detent above the cap');

  const blocked = effectsOf(effects, 'GOVERNOR_BLOCKED');
  assert.equal(blocked.length, 1, 'the limiter reports once');
  assert.equal(blocked[0].type === 'GOVERNOR_BLOCKED' && blocked[0].conviction, 75);
  assert.equal(effectsOf(effects, 'HARD_STOP').length, 0, 'the governor is hit before the wall');
});

test('the governor caps the value without moving the geometry', () => {
  // The identical physical pull is the identical distance on both sides of the
  // lift. Only the value it is allowed to report changes.
  const distance = 195;
  const raw = convictionForDistance(distance, STD) as number;
  assert.equal(Math.round(raw), 95);
  assert.equal(clampConviction(raw, 1), 75);
  assert.equal(clampConviction(raw, 5), 95);
});

test('a committed gesture reports the value that was showing', () => {
  const { effects } = runGesture([grip(), move(100), move(140), release()], openConfig);
  const committed = effectsOf(effects, 'COMMIT')[0];
  const expected = clampConviction(convictionForDistance(140, STD) as number, 9);
  assert.equal(committed.type === 'COMMIT' && committed.conviction, expected);
});

test('gesture telemetry covers the whole lifecycle', () => {
  const { effects } = runGesture([grip(), move(160), release()], openConfig);
  const events = effects.filter(e => e.type === 'TELEMETRY').map(e => (e.type === 'TELEMETRY' ? e.event : ''));
  assert.deepEqual(events, ['gesture.started', 'gesture.armed', 'gesture.committed']);
});

test('a fresh gesture starts from a clean context', () => {
  const first = runGesture([grip(), move(160), release()], openConfig);
  const second = gestureReducer(first.context, grip(), openConfig);
  assert.equal(second.context.hasArmed, false);
  assert.equal(second.context.conviction, null);
  assert.equal(second.context.lastDetent, null);
});

// ─── Two doors, one room ──────────────────────────────────────────────────────

test('the gesture path and the slider path produce identical run state', () => {
  // Addendum C section 6's acceptance criterion, at the level that matters:
  // both inputs feed the same contract, so the same conviction sequence must
  // produce byte-identical run state whichever door it came through.
  const script: { action: ActionCode; conviction: number }[] = [
    { action: 'HOLD', conviction: 70 },
    { action: 'REDUCE', conviction: 65 },
    { action: 'HOLD', conviction: 60 },
    { action: 'ROTATE_DEFENSIVE', conviction: 75 },
    { action: 'RAISE_CASH', conviction: 88 },
    { action: 'HOLD', conviction: 72 },
  ];

  // Door 1: the slider sets conviction directly.
  let viaSlider = createInitialRun();
  for (const step of script) {
    viaSlider = {
      ...viaSlider,
      pendingAction: step.action,
      pendingConfidence: convictionToConfidence(step.conviction),
    };
    const outcome = commitPendingDecision(viaSlider);
    assert.ok(outcome);
    viaSlider = outcome.run;
  }

  // Door 2: a pull is dragged to the distance that means that conviction, and
  // released. The committed value comes out of the state machine.
  let viaGesture = createInitialRun();
  for (const step of script) {
    const geometry = STD;
    const config: GestureConfig = { geometry, checkpointSequence: viaGesture.currentCheckpoint };
    const distance = distanceForConviction(step.conviction, geometry);
    const { effects } = runGesture(
      [
        { type: 'GRIP_START', pointerId: 1, actionCode: step.action, affordable: true, timestamp: 0 },
        { type: 'MOVE', pointerId: 1, distance, timestamp: 50 },
        { type: 'RELEASE', pointerId: 1, timestamp: 120 },
      ],
      config,
    );
    const commit = effects.find(e => e.type === 'COMMIT');
    assert.ok(commit && commit.type === 'COMMIT', 'the pull must commit');

    viaGesture = {
      ...viaGesture,
      pendingAction: step.action,
      pendingConfidence: convictionToConfidence(commit.conviction),
    };
    const outcome = commitPendingDecision(viaGesture);
    assert.ok(outcome);
    viaGesture = outcome.run;
  }

  assert.deepEqual(viaGesture, viaSlider);
  assert.equal(JSON.stringify(viaGesture), JSON.stringify(viaSlider));
});

test('the governor applies identically through both doors', () => {
  // At CP1 a full-draw pull and a slider driven to 95 must both record 75.
  const config: GestureConfig = { geometry: STD, checkpointSequence: 1 };
  const { effects } = runGesture([grip(), move(STD.fullDraw), release()], config);
  const commit = effects.find(e => e.type === 'COMMIT');
  assert.ok(commit && commit.type === 'COMMIT');
  assert.equal(commit.conviction, 75);
  assert.equal(clampConviction(CONVICTION_MAX, 1), 75);
});
