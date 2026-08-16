import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionBranch } from '../../lib/gameTypes';
import { stanceLine, stanceTitle, convictionGovernor, isLandmark } from '../../lib/decisionContract';
import {
  geometryFor, radialDistance, rubberBand,
  gripDisposition, type DeviceClass, type PullGeometry, type RegionBounds,
} from '../../lib/gestureGeometry';
import { PullFilter } from '../../lib/oneEuroFilter';
import {
  gestureReducer, initialGestureContext,
  type GestureContext, type GestureEffect, type GestureEvent,
} from '../../lib/gestureMachine';
import {
  reportFeedback, unlockAudio, type FeedbackKind, type FeedbackPreferences,
} from '../../lib/gestureFeedback';
import { emitEvent } from '../../lib/events';

// ─── Pull to commit ───────────────────────────────────────────────────────────
// The pointer surface. All the physics lives in gestureGeometry and all the
// rules live in gestureMachine; this file only translates pointer events into
// machine events and machine effects into pixels.
//
// The gesture is the signature input, never the only one. Every card is also a
// button that opens the focused controls, which is the keyboard and
// assistive-technology path and the destination of a timid release.

interface Props {
  branch: ActionBranch;
  index: number;
  affordable: boolean;
  turnoverCost: number;
  checkpointSequence: number;
  selected: boolean;
  reducedMotion: boolean;
  muted: boolean;
  /** Decided once per run from the usable decision region (Addendum C C.3). */
  deviceClass: DeviceClass;
  /** The usable decision region in client coordinates, or null before measure. */
  regionBounds: RegionBounds | null;
  onCommit: (conviction: number) => void;
  onOpenFocusedControls: () => void;
  /** Conviction committed at the previous checkpoint, drawn as a faint marker. */
  previousConviction?: number | null;
}

export default function PullToCommit({
  branch, index, affordable, turnoverCost, checkpointSequence, selected,
  reducedMotion, muted, deviceClass, regionBounds,
  onCommit, onOpenFocusedControls, previousConviction,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<GestureContext>(initialGestureContext());
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const filterRef = useRef(new PullFilter());
  const rawDistanceRef = useRef(0);

  const [conviction, setConviction] = useState<number | null>(null);
  const [pullVector, setPullVector] = useState<{ x: number; y: number } | null>(null);
  const [flash, setFlash] = useState<FeedbackKind | null>(null);
  const [clearanceWarning, setClearanceWarning] = useState(false);

  const geometry: PullGeometry = useMemo(() => geometryFor(deviceClass), [deviceClass]);
  const governor = convictionGovernor(checkpointSequence);
  const preferences: FeedbackPreferences = useMemo(
    () => ({ muted, reducedMotion }),
    [muted, reducedMotion],
  );

  const tick = useCallback((kind: FeedbackKind) => {
    reportFeedback(kind, preferences, {
      onVisual: k => {
        setFlash(k);
        window.setTimeout(() => setFlash(null), 90);
      },
    });
  }, [preferences]);

  const applyEffects = useCallback((effects: GestureEffect[]) => {
    for (const effect of effects) {
      switch (effect.type) {
        case 'ARM': tick('ARM'); break;
        case 'DETENT': tick(effect.landmark ? 'LANDMARK' : 'DETENT'); break;
        case 'GOVERNOR_BLOCKED': tick('GOVERNOR'); break;
        case 'HARD_STOP': tick('HARD_STOP'); break;
        case 'COMMIT':
          tick(effect.conviction >= 90 ? 'COMMIT_HEAVY' : 'COMMIT');
          onCommit(effect.conviction);
          break;
        case 'OPEN_FOCUSED_CONTROLS':
          onOpenFocusedControls();
          break;
        case 'CANCEL':
          setConviction(null);
          setPullVector(null);
          break;
        case 'TELEMETRY':
          emitEvent(effect.event, effect.payload);
          break;
      }
    }
  }, [tick, onCommit, onOpenFocusedControls]);

  const dispatch = useCallback((event: GestureEvent) => {
    const result = gestureReducer(contextRef.current, event, { geometry, checkpointSequence });
    contextRef.current = result.context;
    applyEffects(result.effects);
    setConviction(result.context.conviction);
  }, [geometry, checkpointSequence, applyEffects]);

  // ─── Pointer plumbing ───────────────────────────────────────────────────────

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // The grip is a real user gesture, which is exactly what unlocking audio
    // requires, and audio is the tick channel that survives iOS.
    unlockAudio();

    if (contextRef.current.state === 'GRIP' || contextRef.current.state === 'PULL') {
      dispatch({ type: 'SECOND_POINTER', pointerId: e.pointerId });
      return;
    }

    // Clearance is decided before the gesture owns anything. A grip that cannot
    // reach the hard stop in every working direction would cap conviction below
    // the maximum by direction, and the player would only discover it halfway
    // down a pull they had already committed to. So it never becomes a pull:
    // no GRIP, no pointer capture, no reachable COMMIT. The stance goes to the
    // precise controls instead, which can express any value.
    // An unaffordable stance is not committable by any door, so it never grips
    // and never reaches the precise controls either. The card keeps explaining
    // itself; that is the whole interaction.
    if (!affordable) return;

    // Before the region has been measured there is no verified geometry, and a
    // viewport guess is exactly the thing C.3 rules out. Take the safe door.
    if (!regionBounds) {
      onOpenFocusedControls();
      return;
    }

    // The clearance call takes the client point and the region bounds together,
    // so the viewport-to-region conversion happens in one place that cannot be
    // called with mismatched coordinate spaces.
    const disposition = gripDisposition(
      { x: e.clientX, y: e.clientY },
      regionBounds,
      geometry,
      affordable,
    );

    if (disposition === 'UNAVAILABLE') return;
    if (disposition === 'PRECISE_CONTROLS') {
      setClearanceWarning(true);
      onOpenFocusedControls();
      return;
    }

    originRef.current = { x: e.clientX, y: e.clientY };
    filterRef.current.reset();
    rawDistanceRef.current = 0;

    // Pointer capture keeps the gesture alive once the finger leaves the card,
    // and turns a screen-edge exit into a clean cancel rather than a lost
    // pointer.
    try { cardRef.current?.setPointerCapture(e.pointerId); } catch { /* older engines */ }

    dispatch({
      type: 'GRIP_START',
      pointerId: e.pointerId,
      actionCode: branch.actionCode,
      affordable,
      timestamp: e.timeStamp,
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const origin = originRef.current;
    if (!origin) return;
    if (contextRef.current.state !== 'GRIP' && contextRef.current.state !== 'PULL') return;

    // Touch sampling commonly runs at double the refresh rate, so the samples
    // the browser merged into this event are real data. Consuming only the
    // dispatched event throws half of them away.
    const native = e.nativeEvent;
    const samples = typeof native.getCoalescedEvents === 'function'
      ? native.getCoalescedEvents()
      : [native];

    let filtered = 0;
    let last = { x: e.clientX, y: e.clientY };
    for (const sample of samples.length ? samples : [native]) {
      const point = { x: sample.clientX, y: sample.clientY };
      last = point;
      filtered = filterRef.current.filter(
        radialDistance(origin, point),
        sample.timeStamp / 1000,
      );
    }

    rawDistanceRef.current = radialDistance(origin, last);
    setPullVector({ x: last.x - origin.x, y: last.y - origin.y });
    dispatch({ type: 'MOVE', pointerId: e.pointerId, distance: filtered, timestamp: e.timeStamp });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dispatch({ type: 'RELEASE', pointerId: e.pointerId, timestamp: e.timeStamp });
    originRef.current = null;
    setPullVector(null);
    setClearanceWarning(false);
    try { cardRef.current?.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    dispatch({ type: 'POINTER_CANCEL', pointerId: e.pointerId });
    originRef.current = null;
    setPullVector(null);
    setClearanceWarning(false);
  };

  // Interruptions that never reach the element. A player must never return to
  // the app and find a decision they did not release.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: 'VISIBILITY_CHANGE' });
    };
    const onOrientation = () => dispatch({ type: 'ORIENTATION_CHANGE' });
    const onLostCapture = (e: Event) =>
      dispatch({ type: 'CAPTURE_LOST', pointerId: (e as PointerEvent).pointerId });

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('orientationchange', onOrientation);
    const card = cardRef.current;
    card?.addEventListener('lostpointercapture', onLostCapture);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('orientationchange', onOrientation);
      card?.removeEventListener('lostpointercapture', onLostCapture);
    };
  }, [dispatch]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const armed = conviction !== null;
  const strain = armed ? Math.min(1, (conviction - governor.min) / Math.max(1, governor.max - governor.min)) : 0;
  const striations = !armed ? 0 : conviction >= 85 ? 6 : conviction >= 75 ? 4 : 2;

  // Past the hard stop the band compresses instead of stretching.
  const rawPull = rawDistanceRef.current;
  const overshoot = Math.max(0, rawPull - geometry.fullDraw);
  const bandLength = armed
    ? Math.min(rawPull, geometry.fullDraw) + rubberBand(overshoot, geometry.fullDraw)
    : 0;
  const bandAngle = pullVector ? Math.atan2(pullVector.y, pullVector.x) : 0;

  return (
    <div className="relative">
      {/* The meter renders above the grip origin, never under the finger. */}
      {armed && (
        <div
          className="absolute left-0 right-0 -top-16 flex flex-col items-center pointer-events-none z-20"
          aria-hidden="true"
        >
          <div className={`text-4xl font-bold tabular-nums ${
            flash === 'LANDMARK' ? 'text-phosphor-hot' :
            flash === 'GOVERNOR' ? 'text-risk-red' : 'text-phosphor'
          }`}>
            {conviction}
          </div>
          <div className="flex items-end gap-0.5 mt-1">
            {Array.from({ length: 10 }, (_, i) => 50 + i * 5).map(v => (
              <span
                key={v}
                className={`w-px ${isLandmark(v) ? 'h-3' : 'h-2'} ${
                  v > governor.max ? 'bg-risk-red/30'
                    : v <= (conviction ?? 0) ? 'bg-phosphor' : 'bg-phosphor/20'
                }`}
              />
            ))}
          </div>
          {previousConviction != null && (
            <div className="text-phosphor-dim text-xs tracking-widest mt-1">
              LAST {previousConviction}
            </div>
          )}
        </div>
      )}

      {/* The band, drawn from the card toward the finger. */}
      {armed && pullVector && !reducedMotion && (
        <div
          className="absolute left-1/2 top-1/2 origin-left pointer-events-none z-10"
          style={{
            width: `${bandLength}px`,
            height: `${3 + strain * 3}px`,
            transform: `rotate(${bandAngle}rad)`,
            background: 'currentColor',
            color: strain > 0.85 ? '#79FFD7' : '#0CD4A0',
            opacity: 0.35 + strain * 0.5,
          }}
        />
      )}

      <div
        ref={cardRef}
        role="button"
        tabIndex={affordable ? 0 : -1}
        aria-disabled={!affordable}
        aria-label={`${stanceTitle(branch)}. ${stanceLine(branch)}. TURNOVER COST ${(turnoverCost * 100).toFixed(0)} PERCENT.`}
        onPointerDown={affordable ? onPointerDown : undefined}
        onPointerMove={affordable ? onPointerMove : undefined}
        onPointerUp={affordable ? onPointerUp : undefined}
        onPointerCancel={affordable ? onPointerCancel : undefined}
        onKeyDown={e => {
          if (!affordable) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenFocusedControls();
          }
        }}
        // Without this the browser claims the drag as a scroll and fires
        // pointercancel. It is the most common cause of drag gestures failing
        // on mobile web.
        style={{
          touchAction: 'none',
          transform: reducedMotion || !armed ? undefined : `scale(1.03) rotate(${strain * 4}deg)`,
        }}
        className={`w-full text-left p-3 border select-none transition-colors ${
          selected ? 'border-phosphor bg-phosphor/10'
            : affordable ? 'border-phosphor/20 hover:border-phosphor/45'
            : 'border-phosphor/10 opacity-40 cursor-not-allowed'
        } ${armed && !reducedMotion ? 'shadow-lg' : ''} ${
          armed && reducedMotion ? 'border-phosphor' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-phosphor-dim/60 text-xs">[{index + 1}]</span>
            <span className="text-sm font-bold tracking-wide text-phosphor-mid">
              {stanceTitle(branch)}
            </span>
          </div>
          <span className={`text-xs tabular-nums ${affordable ? 'text-phosphor-dim' : 'text-risk-red'}`}>
            {turnoverCost === 0 ? 'FREE' : `${(turnoverCost * 100).toFixed(0)}% TURNOVER`}
          </span>
        </div>
        <div className="text-phosphor-dim text-xs leading-snug mt-1 pl-7">
          {stanceLine(branch)}
        </div>

        {/* Strain striations: two at 60, four at 75, six at 85 and above. */}
        {armed && !reducedMotion && (
          <div className="flex gap-1 mt-2 pl-7" aria-hidden="true">
            {Array.from({ length: striations }, (_, i) => (
              <span key={i} className="h-px w-4 bg-phosphor/50" />
            ))}
          </div>
        )}

        {!affordable && (
          <div className="text-risk-red text-xs tracking-widest mt-1 pl-7">
            NOT ENOUGH TURNOVER BUDGET REMAINING.
          </div>
        )}
        {clearanceWarning && (
          <div className="text-alert-amber text-xs tracking-widest mt-1 pl-7">
            USE THE PRECISE CONTROLS HERE.
          </div>
        )}
      </div>
    </div>
  );
}
