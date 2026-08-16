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
| Working range | 28 to 115 pt | Conviction 50 to 75, linear, detent every 5 (roughly 17.4 pt per step). AMENDED 2. |
| High-draw range | 115 to 195 pt | Conviction 75 to 95, expanded spacing (roughly 20 pt per step). AMENDED 2. |
| Full draw | 195 pt | Conviction 95. Hard stop. |

The expanded spacing at the top is a safety property expressed as physics: 95 requires a full deliberate thumb extension (about 52 mm), so maximum conviction is something a player does on purpose, never something they drift into. Detents above the knee cost more distance per point, which means overconfidence is physically more work, exactly as it should be.

**The effort-ramp invariant, stated so it cannot be lost again:**

```text
(fullDraw - knee) / (CONVICTION_MAX - kneeConviction)
  MUST EXCEED
(knee - deadZone) / (kneeConviction - CONVICTION_MIN)
```

In words: a point of conviction above the knee must cost more travel than a
point below it. This is the whole reason the high-draw range exists, and it is
not implied by any single constant. Moving `kneeConviction` alone inverts it,
because the high zone then carries more conviction points across the same
distance. A unit test asserts this inequality directly against the constants
file, so the curve cannot silently invert again.

Under the amended geometry: 87 pt over 25 points below the knee is 3.48 pt per
point; 80 pt over 20 points above it is 4.0 pt per point. The invariant holds,
and the working-range gradient is preserved to three decimal places against the
original 122 pt over 35 points, so calibration learned below the knee survives
the amendment untouched.

On small screens (viewport height 667 pt or less) all distances scale by 0.85. This scale is a device-class constant fixed at first launch. It never varies by checkpoint, arena, screen, or session, for the reason in §4.

### 2.2 The clamp is a governor, not a remap (CORRECTION to Addendum B §B1)

> **SUPERSEDED by Amendment 1 (Part 3).** The governor is removed: the full 50
> to 95 range is available from the first conviction input. The section is kept
> because its reasoning still governs. The distinction it draws, between a
> governor on a permanent mapping and a remap of that mapping, remains binding
> on any future clamp, and its argument is why Amendment 2 moves the knee
> distance rather than compressing the range.


Addendum B said the CP1 to CP4 conviction clamp "compresses the pull range accordingly." That is wrong and this section replaces it. If 60 to 75 filled the full draw distance during the tutorial checkpoints, then at CP5 the identical physical pull would suddenly mean 95, betraying the player's learned calibration at exactly the moment stakes rise. Instead, the global distance-to-conviction mapping is permanent from the first touch. During CP1 to CP4 the meter simply arms at 60 and stops at 75: pulling past the 75 detent hits a visible governor (a limiter block on the meter, a distinct dull thunk haptic unlike any detent tick, the band compresses instead of stretching). The caption reads `LIMITED TO 75. FULL RANGE OPENS AT CP5.` The player is learning the true geometry from checkpoint one while their exposure is capped. When the clamp lifts, nothing about the physics changes; the governor is removed and the road they could already feel keeps going.

### 2.3 Value truth and the jitter filter

The committed conviction is the value displayed at the instant of touch-up, sampled from the input event stream, never from the last rendered frame. A dropped frame on a slow device must not cost the player five points.

To stop a sweaty-thumb micro-twitch in the final frames from moving 75 to 70, the live value is a rolling median of the last three pointer samples within a 50 ms window. Critically, this filter runs on the display pipeline, not just the commit pipeline: the number the player watches and the number that commits are the same filtered stream, always. The perceived lag (about 25 ms) is imperceptible; a mismatch between the shown number and the committed number would be unforgivable. Law: what you see at release is what you get, with zero exceptions.

## 3. The animation, frame by frame

**Touch-down (GRIP).** Within one frame (16 ms), the touched card lifts: scale 1.00 to 1.03, shadow deepens, the other cards dim to 40% opacity and desaturate. No haptic yet; grip is free and reversible.

**Crossing the arm point.** The background dims a further 20%. The conviction meter materializes above the card (never below, never where a finger or palm can occlude it): a horizontal arc with the numeral in large tabular figures at its center, tick marks at every detent, landmark ticks visually heavier at 75 and 95 (AMENDED 2). Haptic: one medium arm-tick, unmistakably different from the detent ticks that follow.

**During the pull.** A band renders from the card's near edge to the finger point: a slightly curved taut elastic, 3 px wide and dim mint at conviction 50, thickening to 6 px and reaching full brand mint intensity by 85. From 85 upward the band gains a fine high-frequency shimmer (a strained material, not a warning; it stays mint, never amber, because high conviction is not an error). The card itself strains toward the finger: it tilts up to 4 degrees along the pull vector and grows tension striations on its surface, two lines at 60, four at 75, six at 85 and above. Every detent crossing fires a light haptic tick within 10 ms of the crossing; 75 fires a double-tick announcing the high-draw zone; 95 fires the double-tick plus the hard-stop resistance (AMENDED 2). The numeral counts through every value; it never skips.

**Release at or beyond the arm point (COMMIT).** The commit registers at the touch-up event itself, zero delay; everything after is theater and never blocks game state. The band snaps back into the card with a spring (mass 1, stiffness 400, damping 28, roughly 200 ms with a single 4% overshoot). One crisp impact haptic, medium at conviction below 90, heavy at 90 and above. The released energy visibly goes somewhere: a single pulse of light travels from the card up into the run's progress bar, reading as your decision entering the tape. At 120 ms into the snapback, the thesis chips (Addendum B §B2) fade in beneath the settling card, so the "why" question arrives while the release still resonates. The reveal pipeline is already loading behind all of this.

**Release inside the dead zone (soft tap).** No commit. The card settles (spring back to scale 1.00, 150 ms), the dim lifts, and the focused state opens: the same card enlarged, a conventional 50-to-95 slider, and a COMMIT button. This is the single most important graceful-degradation choice in the design: a timid or uncertain pull is never punished and never commits; it lands the player in the precise, accessible version of the exact same decision. The hesitant player and the assistive-tech player arrive at the same screen by design.

**Drag back and settle (CANCEL).** Returning the finger inside the dead zone while still touching disarms: soft haptic, meter fades to a dash, dim lifts, band slackens and retracts. Release then does nothing. Re-grip is instant; there is no cooldown, because exploring the pull with no consequence is how the gesture teaches itself.

**Reduced motion.** No springs, no overshoot, no strain striations, no traveling pulse. The card gains a static highlight border on grip, the meter appears and fills without easing, commit is an instant state change. Haptic detents remain; they are not motion. Every timing above collapses to immediate.

## 4. Finger muscle memory

The gesture is designed to be learned by the hand, not the eyes, and everything in this section exists to protect that learning.

**The geometry contract.** Distance-to-conviction mapping, dead-zone radius, detent spacing, and landmark positions never change. Not per checkpoint, not per arena, not per session, not by A/B test. This is the same contract an FPS player has with mouse sensitivity: calibration lives in the cerebellum, and changing the mapping even once destroys trust in the hand permanently. The CP1 to CP4 governor (§2.2) exists precisely so the tutorial does not violate this contract. Any future experiment that wants to touch these constants is vetoed by this paragraph.

**Landmarks the thumb learns.** AMENDED 2. Two detents are physically distinct: 75 (the double-tick gate into the high-draw zone and the point where spacing widens) and 95 (the hard stop). 70 is demoted to a normal detent tick: it remains the resting default value, but it is no longer a landmark, because a heavy tick five points below the gate would compete with the gate for the thumb's attention. 85 loses its double-tick for the same reason; it is now an ordinary detent inside the high-draw range. Within a session players stop reading the numeral and start counting ticks past landmarks: two ticks past the double-tick is 85. That is the intended end state, and it is why the numeral never skips values and detents never mistime; the rhythm is the interface.

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

## C.8 Desktop and tablet input parity

The pull is at its best on a tablet: the thumb has a comfortable arc, and the draw distances in §2.1 were derived for exactly that hand. Desktop gets the same pointer drag, but the primary desktop input is the keyboard, and integer conviction resolution (C.2) makes a plain arrow-per-point traverse 45 keystrokes wide. So the keyboard gets the same three speeds the hand gets from detents:

| Input | Change | Purpose |
|---|---|---|
| Arrows | 1 point | fine calibration |
| Shift + arrows | 5 points | detent to detent, the tick rhythm |
| PageUp / PageDown | 5 points | same, for keyboards without a comfortable shift reach |
| Home / End | jump to bounds | the governed minimum or maximum |

This keeps the keyboard exactly as expressive as the drag, which is invariant 7: the gesture is never the only door. The stance cards keep `1..4`, the thesis chips take `1..3`, `Enter` commits, and `Escape` backs out.

The three-speed model is also why detents are landmarks rather than quantization (C.2). Shift-arrow lands on them; a plain arrow walks between them; both are real.

---

# Addendum C, Part 3: Amendments

Amendments are recorded, never silent. Each states what it supersedes, what it
changes, what stays frozen, and the reasoning, so a later reader can tell an
intentional change from a regression. Two of the amendments below alter
constants that §4 and §5 invariant 3 previously vetoed outright; that veto is
narrowed by Amendment 2 rather than ignored.

## Amendment 1: the conviction governor is removed

**Supersedes:** §2.2 and C.1 (conviction governed to 60 to 75 through CP1 to
CP4, full range at CP5).

**Change:** the full conviction range, 50 to 95, is available from the first
conviction input. Under the compressed first-run experience that is CP2.

**Compensating controls:**

1. The CP2 introduction tip states the mechanism as consequence, not warning:
   `CONVICTION SCALES THE SCORE BOTH WAYS. WRONG AT 95 COSTS DOUBLE.`
2. Conviction-derived profile dimensions (calibration, position sizing) are
   tagged `PROVISIONAL` until 12 scored decisions, and the profile displays the
   tag. Early miscalibration informs the player without permanently staining
   the dataset the archetype is built from.
3. Telemetry guard. Monitor first-run abandonment between CP2 and CP5, and the
   conviction distribution of first-arena players. Rollback trigger: if
   abandonment in that window rises more than 20% relative over 14 days, or if
   median first-arena conviction exceeds 85, the governor question reopens with
   data.

**Rationale:** the calibration lesson is consequence, not constraint. The
compressed first-run experience moved the governed window on top of the entire
first session, so the governor would now cover 100% of the make-or-break
minutes with reduced agency, which inverts its original purpose as a warm-up
inside a longer onboarding. The shipped tutorial copy also already promises
that "the scale itself never changes, so the calibration you build here is the
calibration you keep." Removing the governor makes that sentence true.

## Amendment 2: the knee moves to 75

**Supersedes:** the §2.1 mapping constant `kneeConviction = 85` and the landmark
detent at 70. Also formally withdraws the viewport-relative track geometry
proposed in the Verb specification (track length as 38% of viewport height with
a 260 to 420 px clamp); see the geometry ruling below.

**Unchanged, and re-frozen:** the radial mapping; the dead zone at 28 pt; full
draw at 195 pt; the STANDARD and COMPACT device classes at 0.85 scale; the
detent cadence of every 5 points.

**Changed:**

1. `kneeConviction`: 85 becomes 75.
2. `knee` distance: 150 pt becomes 115 pt. **This is not optional and does not
   travel separately from change 1.** Moving the conviction alone would leave
   20 conviction points to cross the same 45 pt of high-draw travel, making a
   point at the top cost 2.25 pt against 4.88 pt in the working range. That
   inverts the effort-ramp invariant in §2.1: reaching 95 would become easier
   than it is today, which is the precise opposite of this amendment's purpose.
   Easing cannot rescue it, because a curve redistributes effort within a zone
   and cannot change the zone's total travel.

   115 pt is not a round number chosen for tidiness. It is the distance at which
   the working-range gradient is preserved: 87 pt over 25 points is 3.48 pt per
   point against the original 122 pt over 35 points at 3.486. Calibration the
   hand already learned below 75 is therefore untouched, while 75 becomes the
   point where spacing widens and the top stays more expensive at 4.0 pt per
   point.
3. Landmark detents: 70, 85, 95 becomes 75 and 95 only. 70 is demoted to a
   normal detent and remains the resting default value; 85 loses its double-tick
   and becomes an ordinary detent inside the high-draw range. Two landmarks
   rather than three, because a heavy tick five points below the gate competes
   with the gate for the thumb's attention.
4. `tMin = 350 ms`, the minimum engagement before a release may commit, enters
   the same constants file with its own tests.
5. The effort-ramp invariant of §2.1 is asserted by a unit test against the
   constants file. The defect above was caught by reading the specification's
   own worked numbers, which is not a control that scales; the test is.

**Rationale:** 75 is the semantic boundary this game already shipped and taught.
The governor capped learning play at 75, and the band vocabulary ends FIRM at
75 and begins HEAVY at 76. The shipped curve makes 76 to 85 linear and cheap,
which contradicts Amendment 1's compensating logic that effort replaces
restriction above the normal range, and it mis-aims Amendment 1's rollback
trigger, which watches median conviction against 85, the exact region the
shipped curve makes effortless. Moving the knee aligns the hand, the label, and
the scoring exposure on where normal ends.

**Shipping condition (integrity, not preference):** Amendment 2's curve change
does not ship until the events sink is live and recording. Both rollback
triggers, Amendment 1's and this one, read from telemetry, and the governor's
removal was justified partly on those guards. A safety mechanism that cannot
fire is not a safety mechanism, so shipping the curve while the sink is down
would silently convert a guarded change into an unguarded one.

Note the asymmetry, because it decides merge order elsewhere: the sink blocks
the curve, not the grammar. The verdict grammar's invariant is enforced by
tests rather than telemetry, so it may ship while the sink is down. Any future
change whose stated guard is a metric inherits this condition; any change whose
guard is a test does not.

**Telemetry addendum:** alongside Amendment 1's trigger, log the share of
commits landing in the 76 to 95 band per checkpoint index. If the eased zone
overcorrects and first-arena players cluster below a median of 65, the knee
position reopens with data. The easing coefficients are declared tunable feel
work; the knee-at-75 semantic is the amendment.

## Geometry ruling: the mapping is physical, the drawing is not

The distance-to-conviction mapping lives in physical points, 28 / 150 / 195 with
the device-class scale as shipped. The track graphic may size itself to the
viewport.

Identical thumb travel must mean identical conviction on every device, or the
sentence "the calibration you build here is the calibration you keep" is false,
and that sentence is now doing double duty as the recorded justification for
Amendment 1. A specification that breaks its own governing sentence loses.

> The drawing stretches; the meaning must not.

That line is repeated as a comment above the geometry block in the constants
file, so the next person who reaches for a viewport unit meets it before they
type.

## Amendment 3: the constellation moves to consequence time

**Supersedes:** the mount point implied by §36 and §37 of the main
specification, where the Portfolio Constellation renders on the decision
surface.

**Change:** signature status is affirmed, not revoked; only the trigger and the
stage move.

1. **Decision time:** the constellation relocates into the Risk drawer,
   inspectable on demand beside the risk metrics it contextualizes.
2. **Consequence time:** on checkpoints where `correlationLevel >= 0.6`, it
   renders behind the equity race during the resolution roll, playing §37's
   Correlation Collapse as the market actually expresses it.

**Rationale:** the block field owns the decision surface, and a treemap cannot
render correlation. Deleting the only correlation surface in the same release
where the Resolution Engine starts using `correlationLevel` for race texture
would be incoherent. Correlation Collapse is a stronger signature visual when
it fires at the moment of highest attention, triggered by the data, than as
ambient decoration on a screen where the player is trying to decide. It also
becomes more honest: the collapse now happens inside the SIMULATION-labelled
roll, synchronised to the correlated shocks the path synthesiser generates from
the same scalar.

## Amendment 4: the five questions are a requirement, not a component

**Supersedes:** §56 of the main specification, as previously implemented by the
persistent FiveQuestionSpine strip.

**Change:** the rule is restated from an implementation to a requirement. A
first-session player must be able to answer the five questions from the active
screen without opening Help. How the screen answers them is free.

**Verification:** the lorem-ipsum protocol. After three checkpoints with all
prose scrambled, the tester answers the five questions verbally. Pass requires
at least four of five correct, and "what happens when I commit?" must be among
the correct answers, because it is the hardest to carry pictorially and the one
the strip existed for. If any question fails in two consecutive playtest rounds,
a minimal single-line fallback for that question returns to the surface, one
line rather than the five-cell strip, and it is exempt from the word budget as a
fixed label.

**Recorded risk:** before the first commit, "what happens when I commit?" is
answered only by the CP1 demonstration and the face-down machine card. If
testers miss it, the remediation order is: strengthen the demonstration, then
the card's first appearance, and only then add a text fallback.

## Working practice: a ruling ships with its test twin

Two of the verdict grammar's tests are rulings converted into executable law:
one sweeps every margin from -20 to +20 and asserts a loss never carries a
nudge and a win never carries a criticism; the other asserts a one point loss
is staged identically to a fifteen point loss, which is the rule 16 near-miss
boundary expressed as an assertion rather than a paragraph.

This is the house pattern. Every future ruling lands with its test twin
wherever one is expressible, because a ruling that lives only in prose is a
ruling that gets reverted in good faith by someone who never read the prose.

The Verb specification's acceptance item 8, that no sound, animation or haptic
differs between an eventual win and an eventual loss at the moment of release,
is explicitly in scope for this treatment when the Resolution Engine PR lands.


## Amendment 5: the pointer-path replay is a merge gate

**Clarifies:** §6's acceptance criterion, which was written as a goal and has so
far been treated as outstanding work rather than as a gate.

The equivalence tests shipped with the gesture mount prove that the gesture and
the slider agree at the command boundary. That is a real guarantee and it is not
the one §6 asks for: it exercises the state machine, not the translation from
pointer samples into machine events, which is where coalesced events, the jitter
filter and touch-up sampling live. A defect in that translation would leave the
existing tests green.

**The gate:** no PR that changes gesture behaviour merges without a pointer-path
replay of fixture F1 producing byte-identical run state to the same conviction
sequence driven through the slider path.

**Acceptable minimum:** synthetic PointerEvent-shaped samples driven through the
existing node test runner. A real browser fixture is better and remains the
long-term target, but it is not a precondition, and its absence has been used
for long enough as a reason to defer the check entirely.
