# G1 Rework Spec: Addendum C (Pull-to-Commit Interaction Specification)

**Companion to:** `docs/g1-rework-spec.md`, Addendum A, Addendum B.
**Precedence:** Refines Addendum B §B1 and supersedes it on one point, marked CORRECTION below. Everything else in B stands.
**Scope:** The complete physical, visual, haptic, and failure behavior of the commit gesture. This document is written to be implemented without further interaction-design decisions.

---

## 1. What the gesture is, in one paragraph

The player's decision is a draw and a release. Touch a stance card, pull away from it, and a band of tension stretches between the card and the finger while a conviction number climbs. The further the draw, the bigger the bet. Release commits at the number showing. A timid release near the card commits nothing and opens the precise controls instead. The gesture carries all three meanings at once: which call (the card), how sure (the distance), and the moment of no return (the release). Nothing else on the screen is required reading.

## 2. The physics

### 2.1 Geometry and mapping

All distances are radial from the grip origin (the touch-down point on the card), direction-agnostic. Direction carries no meaning; only distance does. This is deliberate: left thumbs, right thumbs, landscape grips, and lap-held tablets all pull in different directions, and none of them should be wrong. The visual affordance (the band anchors on the card, the meter sits above it) will naturally coax most players downward into the thumb's comfortable arc, but the system never requires it.

| Zone | Radial distance | Meaning |
|---|---|---|
| Dead zone | 0 to 28 pt | Not armed. Release here is a tap, not a commit. |
| Arm point | 28 pt | Conviction 50. Haptic arm-tick. Screen dims 20%. Meter appears. |
| Working range | 28 to 150 pt | Conviction 50 to 85, linear, detent every 5 (roughly 17.4 pt per step). |
| High-draw range | 150 to 195 pt | Conviction 85 to 95, expanded spacing (roughly 22.5 pt per step). |
| Full draw | 195 pt | Conviction 95. Hard stop. |

The expanded spacing at the top is a safety property expressed as physics: 95 requires a full deliberate thumb extension (about 52 mm), so maximum conviction is something a player does on purpose, never something they drift into. The last two detents cost more distance per point, which means overconfidence is physically more work, exactly as it should be.

On small screens (viewport height 667 pt or less) all distances scale by 0.85. This scale is a device-class constant fixed at first launch. It never varies by checkpoint, arena, screen, or session, for the reason in §4.

### 2.2 The clamp is a governor, not a remap (CORRECTION to Addendum B §B1)

Addendum B said the CP1 to CP4 conviction clamp "compresses the pull range accordingly." That is wrong and this section replaces it. If 60 to 75 filled the full draw distance during the tutorial checkpoints, then at CP5 the identical physical pull would suddenly mean 95, betraying the player's learned calibration at exactly the moment stakes rise. Instead, the global distance-to-conviction mapping is permanent from the first touch. During CP1 to CP4 the meter simply arms at 60 and stops at 75: pulling past the 75 detent hits a visible governor (a limiter block on the meter, a distinct dull thunk haptic unlike any detent tick, the band compresses instead of stretching). The caption reads `LIMITED TO 75. FULL RANGE OPENS AT CP5.` The player is learning the true geometry from checkpoint one while their exposure is capped. When the clamp lifts, nothing about the physics changes; the governor is removed and the road they could already feel keeps going.

### 2.3 Value truth and the jitter filter

The committed conviction is the value displayed at the instant of touch-up, sampled from the input event stream, never from the last rendered frame. A dropped frame on a slow device must not cost the player five points.

To stop a sweaty-thumb micro-twitch in the final frames from moving 75 to 70, the live value is a rolling median of the last three pointer samples within a 50 ms window. Critically, this filter runs on the display pipeline, not just the commit pipeline: the number the player watches and the number that commits are the same filtered stream, always. The perceived lag (about 25 ms) is imperceptible; a mismatch between the shown number and the committed number would be unforgivable. Law: what you see at release is what you get, with zero exceptions.

## 3. The animation, frame by frame

**Touch-down (GRIP).** Within one frame (16 ms), the touched card lifts: scale 1.00 to 1.03, shadow deepens, the other cards dim to 40% opacity and desaturate. No haptic yet; grip is free and reversible.

**Crossing the arm point.** The background dims a further 20%. The conviction meter materializes above the card (never below, never where a finger or palm can occlude it): a horizontal arc with the numeral in large tabular figures at its center, tick marks at every detent, landmark ticks visually heavier at 70, 85, and 95. Haptic: one medium arm-tick, unmistakably different from the detent ticks that follow.

**During the pull.** A band renders from the card's near edge to the finger point: a slightly curved taut elastic, 3 px wide and dim mint at conviction 50, thickening to 6 px and reaching full brand mint intensity by 85. From 85 upward the band gains a fine high-frequency shimmer (a strained material, not a warning; it stays mint, never amber, because high conviction is not an error). The card itself strains toward the finger: it tilts up to 4 degrees along the pull vector and grows tension striations on its surface, two lines at 60, four at 75, six at 85 and above. Every detent crossing fires a light haptic tick within 10 ms of the crossing; 85 fires a double-tick announcing the high-draw zone; 95 fires the double-tick plus the hard-stop resistance. The numeral counts through every value; it never skips.

**Release at or beyond the arm point (COMMIT).** The commit registers at the touch-up event itself, zero delay; everything after is theater and never blocks game state. The band snaps back into the card with a spring (mass 1, stiffness 400, damping 28, roughly 200 ms with a single 4% overshoot). One crisp impact haptic, medium at conviction below 90, heavy at 90 and above. The released energy visibly goes somewhere: a single pulse of light travels from the card up into the run's progress bar, reading as your decision entering the tape. At 120 ms into the snapback, the thesis chips (Addendum B §B2) fade in beneath the settling card, so the "why" question arrives while the release still resonates. The reveal pipeline is already loading behind all of this.

**Release inside the dead zone (soft tap).** No commit. The card settles (spring back to scale 1.00, 150 ms), the dim lifts, and the focused state opens: the same card enlarged, a conventional 50-to-95 slider, and a COMMIT button. This is the single most important graceful-degradation choice in the design: a timid or uncertain pull is never punished and never commits; it lands the player in the precise, accessible version of the exact same decision. The hesitant player and the assistive-tech player arrive at the same screen by design.

**Drag back and settle (CANCEL).** Returning the finger inside the dead zone while still touching disarms: soft haptic, meter fades to a dash, dim lifts, band slackens and retracts. Release then does nothing. Re-grip is instant; there is no cooldown, because exploring the pull with no consequence is how the gesture teaches itself.

**Reduced motion.** No springs, no overshoot, no strain striations, no traveling pulse. The card gains a static highlight border on grip, the meter appears and fills without easing, commit is an instant state change. Haptic detents remain; they are not motion. Every timing above collapses to immediate.

## 4. Finger muscle memory

The gesture is designed to be learned by the hand, not the eyes, and everything in this section exists to protect that learning.

**The geometry contract.** Distance-to-conviction mapping, dead-zone radius, detent spacing, and landmark positions never change. Not per checkpoint, not per arena, not per session, not by A/B test. This is the same contract an FPS player has with mouse sensitivity: calibration lives in the cerebellum, and changing the mapping even once destroys trust in the hand permanently. The CP1 to CP4 governor (§2.2) exists precisely so the tutorial does not violate this contract. Any future experiment that wants to touch these constants is vetoed by this paragraph.

**Landmarks the thumb learns.** Three detents are physically distinct: 70 (the rest reference, a heavier tick, where the old default lived), 85 (the double-tick gate into the high-draw zone and the point where spacing widens), and 95 (the hard stop). Within a session players stop reading the numeral and start counting ticks past landmarks: three ticks past the heavy one is 85. That is the intended end state, and it is why the numeral never skips values and detents never mistime; the rhythm is the interface.

**Closing the calibration loop.** After release, a faint ghost tick remains on the meter at the committed value through the reveal, so the player's eye pairs that pull with that number with that outcome while all three are on screen together. On the next grip, a dim marker shows where the previous pull ended. Over a run this builds an internal scale: the hand starts to know what 80 feels like, and since the calibration score (Addendum A §C) rewards exactly that knowledge, the motor learning and the game's grading converge on the same skill. The gesture is not decoration on the calibration mechanic; it is the calibration mechanic made physical.

**First contact.** No instructional text. The CP1 coach shows a ghost hand performing one pull on the first card, meter filling, 2.5-second loop, and dismisses forever at the player's first grip. Show a hand, not a paragraph.

## 5. How it must not fail the user: the ten invariants

1. **Only a clean touch-up commits.** `touchcancel`, pointer capture loss, screen-edge exit, device rotation, app backgrounding, incoming-call interruption: all of these settle the card and commit nothing. A player must never return to the app to discover a decision they did not release.
2. **Display and commit are one pipeline.** The filtered value shown is the value committed, sampled from input events at touch-up, never from render state.
3. **Geometry is permanent.** See §4. Clamps are governors on the same road, never remaps of it.
4. **The number is never under the finger.** Meter and numeral render above the grip origin at all times, repositioning if the grip is near the top edge, so occlusion is impossible by construction.
5. **Arming is unmistakable.** Dead zone plus dim plus arm-tick plus meter appearance means no player can be armed without knowing it, and no release can surprise.
6. **Timidity is never punished.** A dead-zone release opens the focused controls; it never commits, never errors, never scolds.
7. **The gesture is never the only door.** The focused state (slider plus button), full keyboard operation (1 to 4 focus, arrows adjust, Enter commits, Escape backs out), and screen-reader semantics (card announces stance, plain description, and turnover cost; slider announces value; commit announces stance and conviction together) deliver identical outcomes. Pointer drag is the signature, not the requirement.
8. **Latency honesty.** Commit registers at touch-up. Animation is celebration, never a gate; the reveal must not wait for the spring.
9. **Touch ownership is absolute.** The first touch owns the gesture; simultaneous second touches are ignored entirely, and the decision surface sets `touch-action: none` with the layout law that the stance region never scrolls, so no pull is ever misread as a scroll and no scroll ever becomes a pull.
10. **An unaffordable card cannot be gripped.** Cards priced out by the turnover budget (Addendum A §E2) render flat with their cost and give a null-response soft haptic on touch, entering neither GRIP nor the focused state for commit purposes; tapping one opens only its explanation.

## 6. Instrumentation and acceptance

Emit per-gesture telemetry: grip count, cancels, dead-zone releases, edge and interruption cancels, time from checkpoint start to commit, and the conviction distribution per checkpoint. Acceptance for the PR that ships this: the 20-second first-commit standard (Addendum B) holds in a moderated test; accidental-commit reports are zero across the test cohort; the cancel rate sits in a healthy 5 to 15% band (players exploring the draw without frustration); and a scripted Playwright pointer test replays fixture F1's conviction sequence through the gesture path and produces byte-identical run state to the same sequence through the slider path, proving the two doors are one room.

---

# Addendum C, Part 2: Implementation rulings

These refine the body above and are binding. Where they touch a section, they win.

## C.1 The governor clamps the value; it never moves a detent

The distance-to-conviction mapping is global and permanent. The checkpoint governor is a clamp applied to the value that mapping produces, never an adjustment to where detents sit.

```ts
globalGeometry(distance) -> 50..95     // permanent, never varies

checkpointGovernor:
  CP1-4 => clamp(globalValue, 60, 75)
  CP5+  => globalValue
```

"The meter arms at 60" in §2.2 describes what the player sees at the 28 pt arm point during CP1 to CP4, which is the clamped value. It does not mean the 60 detent moves to 28 pt. Moving a detent would violate §4's geometry contract. Note that the governor therefore raises the minimum committed conviction as well as capping the maximum, which is intended.

## C.2 Conviction is integer, 50 through 95, and is never snapped

Every integer in 50..95 is a valid committed value. 72, 73 and 74 are all real. Detents at multiples of 5 are tactile and visual landmarks only: they fire haptics and draw ticks, and they do not quantize the value.

This is what gives the calibration score (Addendum A §C) enough resolution to be worth playing for. The §3 line "the numeral counts through every value; it never skips" is the display consequence of the same rule.

## C.3 Device class is decided once, from usable gesture space

Two classes only, classified once at run start from the usable decision-region geometry rather than raw viewport height, because browser chrome, safe areas, landscape tablets and embedded webviews all distort raw height.

```text
STANDARD_GEOMETRY   195 pt full draw
COMPACT_GEOMETRY    165.75 pt full draw   (195 * 0.85)

Classification happens once at run start.
It never changes during a run.
```

## C.4 Telemetry separates exploration from defect

A 10% cancel rate from players exploring the draw is healthy. A 10% cancel rate from pointer capture loss is a bug. The events must be able to tell those apart.

```ts
gesture.started
gesture.armed
gesture.cancelled
gesture.dead_zone_released
gesture.committed
gesture.focused_controls_opened
```

`gesture.cancelled` carries a reason:

```ts
RETURNED_TO_DEAD_ZONE
POINTER_CANCEL
CAPTURE_LOST
VISIBILITY_CHANGE
ORIENTATION_CHANGE
SECOND_POINTER_IGNORED
UNAFFORDABLE
```

## C.5 Stance and conviction are immutable at touch-up

**The stance and conviction become immutable at touch-up. Thesis selection explains the committed decision and cannot alter stance or conviction.**

This protects the behavioral measurement model. Thesis is asked after the commitment precisely so the player is explaining an instinct already exposed, rather than searching for a defensible explanation before choosing. A thesis screen that could revise the stance would collapse that distinction and the Alpha Profile signal with it.

## C.6 PR structure: the decision model is testable without the gesture

This work splits in two. The gesture is an input mechanism into an unchanged contract (invariant 7), so the contract ships and is tested first.

**PR 2A: decision contract.** Stance cards, thesis model, conviction state, scoring integration, the CP1 to CP4 governor, turnover affordability, slider fallback, keyboard parity, deterministic equivalence tests.

**PR 2B: pull interaction.** Pointer state machine, radial physics, jitter filter, haptics, band animation, reduced motion, interruption handling, gesture telemetry, Playwright gesture fixtures.

If 2A works through keyboard and slider first, 2B is replaceable presentation infrastructure rather than business logic.

## C.7 Status against what has shipped

PR 2 (`feat/g1-decision-contract`) shipped most of 2A before this addendum existed. Outstanding 2A deltas:

- **Conviction step.** Shipped with `CONVICTION_STEP = 5` and a step-5 slider. C.2 requires integer resolution: step 1, with landmarks at multiples of 5.
- **Governor vs range.** Shipped clamping the slider's own min/max to 60..75 for CP1 to CP4, which is the remap C §2.2 corrects. The slider must span 50..95 permanently with a visible limiter at 75, and the caption becomes `LIMITED TO 75. FULL RANGE OPENS AT CP5.`
- **Thesis order.** Shipped as thesis-before-commit. B §B2 and C.5 move it after touch-up, with `THESIS_UNSTATED` on a 5-second timeout.
- **Immutability.** Needs an explicit engine guarantee that a committed stance and conviction cannot be revised by the thesis step.
