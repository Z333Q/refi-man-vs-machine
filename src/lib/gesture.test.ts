import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionCode, RunState } from './gameTypes';
import {
  geometryFor, classifyDevice, clearanceAt, hasClearance, radialDistance,
  convictionForDistance, distanceForConviction, gainAt, rubberBand, COMPACT_SCALE,
  gripDisposition, MIN_ENGAGEMENT_MS, type RegionBounds,
} from './gestureGeometry';
import { getCheckpoint } from './covidArena';
import { OneEuroFilter, MedianOf3, PullFilter, DEFAULT_ONE_EURO } from './oneEuroFilter';
import {
  gestureReducer, runGesture,
  type GestureEffect, type GestureEvent, type GestureConfig,
} from './gestureMachine';
import {
  CONVICTION_MIN, CONVICTION_MAX, CONVICTION_DEFAULT, clampConviction, convictionToConfidence,
} from './decisionContract';
import {
  createInitialRun, commitPendingDecision, commitDecisionCommand, canAffordAction,
  type DecisionCommand,
} from './runEngine';

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
  assert.equal(convictionForDistance(STD.knee, STD), 75);
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
  // Amendment 2 geometry. Points of distance per point of conviction: per
  // five-point detent that is 17.4 pt in the working range and 20.0 pt above
  // the knee. The working-range gradient is deliberately preserved from the
  // pre-amendment curve (3.486), so calibration learned below the knee
  // survives the amendment.
  const working = gainAt(80, STD);
  const highDraw = gainAt(160, STD);
  assert.ok(Math.abs(working - 3.48) < 1e-9, `working gain ${working}`);
  assert.ok(Math.abs(working * 5 - 17.4) < 1e-9);
  assert.ok(Math.abs(highDraw - 4.0) < 1e-9);
  assert.ok(Math.abs(highDraw * 5 - 20.0) < 1e-9);
  assert.ok(highDraw / working > 1.14 && highDraw / working < 1.16);
});

test('EFFORT RAMP: a point above the knee always costs more travel than one below', () => {
  // The invariant Amendment 2 nearly broke, asserted directly against the
  // constants rather than inferred from a worked example. Moving
  // kneeConviction without moving the knee distance inverts this, and the
  // inversion is invisible in every other test in this file.
  for (const g of [geometryFor('STANDARD'), geometryFor('COMPACT')]) {
    const below = (g.knee - g.deadZone) / (g.kneeConviction - CONVICTION_MIN);
    const above = (g.fullDraw - g.knee) / (CONVICTION_MAX - g.kneeConviction);
    assert.ok(
      above > below,
      `${g.deviceClass}: ${above.toFixed(3)} pt/point above the knee must exceed ${below.toFixed(3)} below it`,
    );
  }
});

test('the resting default is reachable and is not a landmark', () => {
  // 70 was demoted by Amendment 2 but is still where the control rests, so it
  // has to remain an ordinary, committable value on the scale.
  const d = distanceForConviction(CONVICTION_DEFAULT, STD);
  assert.ok(d > STD.deadZone && d < STD.knee, `default sits at ${d} pt`);
  assert.equal(Math.round(convictionForDistance(d, STD) as number), CONVICTION_DEFAULT);
});

test('reaching the hard stop costs 92% more travel than reaching the knee', () => {
  // This is the true safety property. The addendum's claim that expanded
  // spacing makes the maximum harder to hit does not survive Fitts's law: the
  // wider targets almost exactly cancel the extra distance, and a hard stop is
  // a target of unbounded width. Travel cost is what actually holds.
  // Amendment 2 strengthened this: the knee moved closer, so the hard stop is
  // now 92% further than the knee rather than 37%.
  const toKnee = STD.knee - STD.deadZone;
  const toStop = STD.fullDraw - STD.deadZone;
  assert.ok(Math.abs(toStop / toKnee - 1.9195) < 1e-3, `ratio ${toStop / toKnee}`);
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
  assert.equal(convictionForDistance(compact.knee, compact), 75);
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
// Default release clears MIN_ENGAGEMENT_MS. Tests that mean to exercise the
// flick guard pass an explicit early timestamp.
function release(timestamp = 600): GestureEvent {
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
  assert.deepEqual(landmarks, [75, 95]);
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
        { type: 'RELEASE', pointerId: 1, timestamp: 600 },
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

// ─── The command boundary ─────────────────────────────────────────────────────
// The test above proves the two doors agree once pending run state has been
// constructed by hand. These prove they agree at the seam the application
// actually commits through, so the guarantee covers the wiring and not just the
// arithmetic.

test('gesture and slider commands commit to identical run state', () => {
  // Deliberately spans the cases where the two doors could diverge: the CP1
  // governed range, a free stance, a stance that spends turnover, and the open
  // conviction range once the governor lifts at CP5.
  const script: DecisionCommand[] = [
    { action: 'HOLD', conviction: 70 },              // CP1, governed
    { action: 'REDUCE', conviction: 95 },            // CP2, governed, non-zero turnover
    { action: 'HOLD', conviction: 50 },              // CP3, governed at the floor
    { action: 'ROTATE_DEFENSIVE', conviction: 62 },  // CP4, last governed checkpoint
    { action: 'RAISE_CASH', conviction: 88 },        // CP5, open range, non-zero turnover
    { action: 'HOLD', conviction: 95 },              // CP6, open range at the ceiling
  ];

  // Door 1: the slider and keyboard build the command from pending UI state.
  let viaSlider = createInitialRun();
  for (const command of script) {
    const outcome = commitDecisionCommand(viaSlider, command);
    assert.ok(outcome, 'the slider command must commit');
    viaSlider = outcome.run;
  }

  // Door 2: the pull emits its conviction from the state machine, and that
  // value becomes the command. Nothing else about the path differs.
  let viaGesture = createInitialRun();
  for (const command of script) {
    const config: GestureConfig = { geometry: STD, checkpointSequence: viaGesture.currentCheckpoint };
    const distance = distanceForConviction(command.conviction, STD);
    const { effects } = runGesture(
      [
        { type: 'GRIP_START', pointerId: 1, actionCode: command.action, affordable: true, timestamp: 0 },
        { type: 'MOVE', pointerId: 1, distance, timestamp: 50 },
        { type: 'RELEASE', pointerId: 1, timestamp: 600 },
      ],
      config,
    );
    const commit = effects.find(e => e.type === 'COMMIT');
    assert.ok(commit && commit.type === 'COMMIT', 'the pull must commit');

    const outcome = commitDecisionCommand(viaGesture, {
      action: command.action,
      conviction: commit.conviction,
    });
    assert.ok(outcome, 'the gesture command must commit');
    viaGesture = outcome.run;
  }

  assert.deepEqual(viaGesture, viaSlider);
  assert.equal(JSON.stringify(viaGesture), JSON.stringify(viaSlider));
});

test('the command clamps conviction with the checkpoint governor, whichever door sent it', () => {
  // A door that forgot to clamp would commit 95 at CP1. The engine refuses.
  const run = createInitialRun();
  const outcome = commitDecisionCommand(run, { action: 'HOLD', conviction: 95 });
  assert.ok(outcome);
  assert.equal(outcome.run.decisions[0].confidence, convictionToConfidence(75));

  const floored = commitDecisionCommand(run, { action: 'HOLD', conviction: 50 });
  assert.ok(floored);
  assert.equal(floored.run.decisions[0].confidence, convictionToConfidence(60));
});

test('an unauthored stance is rejected and records no decision', () => {
  // The command is now the authoritative commit boundary, so the engine, not
  // the screen, decides what is committable. A stance this checkpoint does not
  // author has no branch: no authored flags, no alpha impact, no turnover
  // price. Committing it would score against numbers nobody wrote.
  const run = createInitialRun();
  const cp = getCheckpoint(run.currentCheckpoint);
  assert.ok(cp);
  const offered = cp.availableActions.map(a => a.actionCode);
  const unauthored = (['STAGED_BUY', 'STAGED_SELL', 'ADD_RISK', 'ROTATE_RISK'] as ActionCode[])
    .find(a => !offered.includes(a));
  assert.ok(unauthored, 'this checkpoint must leave some stance unauthored');

  const before = JSON.stringify(run);
  assert.equal(commitDecisionCommand(run, { action: unauthored, conviction: 70 }), null);
  // Rejection is total: no decision recorded, and the input run is untouched.
  assert.equal(run.decisions.length, 0);
  assert.equal(JSON.stringify(run), before);
});

test('an authored but unaffordable stance is rejected and records no decision', () => {
  const run = createInitialRun();
  const cp = getCheckpoint(run.currentCheckpoint);
  assert.ok(cp);
  const priced = cp.availableActions.find(a => a.actionCode !== 'HOLD');
  assert.ok(priced, 'this checkpoint must author a stance that costs turnover');

  // Drain the budget so the authored stance is no longer payable.
  const broke: RunState = {
    ...run,
    portfolio: { ...run.portfolio, turnoverUsed: run.turnoverBudget },
  };
  assert.equal(canAffordAction(broke, priced.actionCode, cp), false);

  const before = JSON.stringify(broke);
  assert.equal(commitDecisionCommand(broke, { action: priced.actionCode, conviction: 70 }), null);
  assert.equal(broke.decisions.length, 0);
  assert.equal(JSON.stringify(broke), before);

  // HOLD is free, so it stays committable on an exhausted budget.
  const held = commitDecisionCommand(broke, { action: 'HOLD', conviction: 70 });
  assert.ok(held, 'HOLD must remain affordable');
  assert.equal(held.run.decisions[0].actionCode, 'HOLD');
});

// ─── Clearance decides before the gesture owns the pointer ────────────────────

test('a grip without full clearance is sent to the precise controls, not into a pull', () => {
  // The failure this prevents: the player starts pulling, and the geometry
  // caps conviction below the maximum in the direction they chose, which they
  // can only discover once the movement is already underway.
  const bounds: RegionBounds = { left: 0, top: 0, width: 600, height: 800 };

  // Comfortably inside: a full draw fits in every working direction.
  assert.equal(gripDisposition({ x: 300, y: 300 }, bounds, STD, true), 'PULL');

  // Hard against the bottom edge: down cannot reach the hard stop.
  assert.equal(gripDisposition({ x: 300, y: 790 }, bounds, STD, true), 'PRECISE_CONTROLS');

  // Hard against the left edge: left cannot reach the hard stop.
  assert.equal(gripDisposition({ x: 4, y: 300 }, bounds, STD, true), 'PRECISE_CONTROLS');
});

test('clearance is measured in region space, so an offset region behaves identically', () => {
  // The bug this pins: mixing a viewport-space pointer with region-space
  // dimensions. On an offset region that reads as far more clearance than
  // exists, and the same grip would disagree with itself depending only on
  // where the panel happens to sit on screen.
  const atOrigin: RegionBounds = { left: 0, top: 0, width: 600, height: 500 };
  const offset: RegionBounds = { left: 240, top: 120, width: 600, height: 500 };

  // The same local grip point, expressed in each region's client coordinates.
  const localGrips = [
    { x: 300, y: 100 },  // roomy
    { x: 300, y: 495 },  // against the bottom edge
    { x: 2, y: 100 },    // against the left edge
    { x: 598, y: 100 },  // against the right edge
  ];

  for (const local of localGrips) {
    const a = gripDisposition(
      { x: local.x + atOrigin.left, y: local.y + atOrigin.top }, atOrigin, STD, true,
    );
    const b = gripDisposition(
      { x: local.x + offset.left, y: local.y + offset.top }, offset, STD, true,
    );
    assert.equal(a, b, `local grip ${local.x},${local.y} must not depend on region offset`);
  }

  // And concretely, the worked example: 300,100 in A is 540,220 in B.
  assert.equal(gripDisposition({ x: 300, y: 100 }, atOrigin, STD, true), 'PULL');
  assert.equal(gripDisposition({ x: 540, y: 220 }, offset, STD, true), 'PULL');

  // Feeding B's region-local point as if it were client space is the mistake,
  // and it must produce a different answer: that is why the API takes bounds.
  assert.notEqual(
    gripDisposition({ x: 300, y: 100 }, offset, STD, true),
    gripDisposition({ x: 540, y: 220 }, offset, STD, true),
  );
});

test('an unaffordable stance is UNAVAILABLE, never merely a fallback', () => {
  // Invariant 10 at the helper level: a stance priced out by the budget must
  // not reach a committable focused state, so it is a distinct disposition
  // rather than sharing the precise-controls door.
  const roomy: RegionBounds = { left: 0, top: 0, width: 1200, height: 1200 };
  const cramped: RegionBounds = { left: 0, top: 0, width: 100, height: 100 };

  assert.equal(gripDisposition({ x: 600, y: 400 }, roomy, STD, false), 'UNAVAILABLE');
  assert.equal(gripDisposition({ x: 50, y: 50 }, cramped, STD, false), 'UNAVAILABLE');

  // Affordability is checked first: clearance never upgrades or downgrades it.
  assert.equal(gripDisposition({ x: 600, y: 400 }, roomy, STD, true), 'PULL');
  assert.equal(gripDisposition({ x: 50, y: 50 }, cramped, STD, true), 'PRECISE_CONTROLS');
});


// ─── The engagement floor (Addendum C Amendment 2) ────────────────────────────

test('a release faster than the engagement floor never commits', () => {
  // The gesture has no confirm dialog, so this floor is what stops a flick
  // becoming an irreversible decision. Acceptance asks for 100 attempts out of
  // 100; the machine is deterministic, so sweeping the whole sub-threshold
  // range proves it more completely than repetition would.
  for (let t = 0; t < MIN_ENGAGEMENT_MS; t += 5) {
    const { effects } = runGesture(
      [grip(), move(STD.fullDraw, Math.min(t, 1)), release(t)],
      openConfig,
    );
    assert.equal(
      effects.some(e => e.type === 'COMMIT'), false,
      `released at ${t}ms and committed`,
    );
    const cancel = effects.find(e => e.type === 'CANCEL');
    assert.ok(cancel && cancel.type === 'CANCEL' && cancel.reason === 'FLICK', `at ${t}ms`);
  }
});

test('a release at or past the engagement floor commits normally', () => {
  for (const t of [MIN_ENGAGEMENT_MS, MIN_ENGAGEMENT_MS + 1, 900, 5000]) {
    const { effects } = runGesture([grip(), move(STD.knee, 10), release(t)], openConfig);
    const commit = effects.find(e => e.type === 'COMMIT');
    assert.ok(commit && commit.type === 'COMMIT', `released at ${t}ms and did not commit`);
    assert.equal(commit.conviction, 75);
  }
});

test('a flick reports itself, so the floor can be tuned from data not opinion', () => {
  const { effects } = runGesture([grip(), move(STD.fullDraw, 1), release(120)], openConfig);
  const tel = effects.find(e => e.type === 'TELEMETRY' && e.event === 'gesture.cancelled');
  assert.ok(tel && tel.type === 'TELEMETRY');
  assert.equal(tel.payload.reason, 'FLICK');
  assert.equal(tel.payload.elapsedMs, 120);
  // The conviction the flick would have committed is recorded, which is what
  // tells us whether the floor is catching accidents or eating real decisions.
  assert.equal(tel.payload.conviction, 95);
});

test('the flick guard does not fire on a slow pull that never armed', () => {
  // A dead-zone release is timidity, not a flick, and keeps its own path to
  // the precise controls however fast it happened.
  const { effects } = runGesture([grip(), move(10, 5), release(50)], openConfig);
  assert.equal(effects.some(e => e.type === 'COMMIT'), false);
  assert.equal(effects.some(e => e.type === 'OPEN_FOCUSED_CONTROLS'), true);
  assert.equal(effects.some(e => e.type === 'CANCEL' && e.reason === 'FLICK'), false);
});
