# Pull-to-Commit: Prior Art and the Math Behind It

**Purpose:** Ground Addendum C's gesture in the established techniques it is reinventing, verify its numbers, and surface what the spec has not yet accounted for. Research input to PR 2B, not a specification. Where this document disagrees with Addendum C, the disagreement is flagged for a ruling rather than assumed.

---

## 1. The gesture already has a name: scaled radial dead zone

Addendum C's mapping is, mathematically, the **scaled radial dead zone** every console shooter uses on its analog sticks. This is worth knowing because the technique is thoroughly worked out, and the failure modes are documented.

The canonical implementation:

```
magnitude = |input|
if magnitude < deadzone: return 0
normalized = input / magnitude
output = normalized * (magnitude - deadzone) / (1 - deadzone)
```

The remap `(m - dz) / (1 - dz)` is the whole trick. A plain radial dead zone returns the raw magnitude once past the threshold, so the output jumps discontinuously from 0 to `dz` at the boundary. The scaled version rescales the surviving range back to a full 0..1, so output rises continuously from 0 at the edge. Addendum C gets this right by construction: conviction is 50 exactly at the 28 pt arm point, with no jump.

Our version is that formula with two changes: it is piecewise (a knee at 150 pt), and it maps to 50..95 instead of 0..1.

```
              ⎧ undefined (dead zone, opens focused controls)     d < 28
conviction(d) ⎨ 50 + 35 · (d - 28)  / (150 - 28)             28 ≤ d ≤ 150
              ⎩ 85 + 10 · (d - 150) / (195 - 150)           150 < d ≤ 195
```

**Why radial and not axial.** Per-axis dead zones produce a square dead region, which is measurably worse: escaping diagonally requires crossing more distance than escaping orthogonally, so the control has a direction bias the user feels but cannot name. Addendum C's direction-agnostic radial choice avoids this, and is the right call for the stated reason (thumb direction varies by grip) and a second one it does not mention (a square dead zone would make the arm point itself direction-dependent).

**Angry Birds is the same clamp.** The standard slingshot implementation normalizes the drag vector and multiplies by a maximum distance, which is exactly our hard stop at 195 pt. The precedent is nearly universal in drag-and-release games: Angry Birds, Monster Strike (drag-and-flick, direction plus distance), 8 Ball Pool's power drag.

**Where the big titles differ from us, deliberately.** 8 Ball Pool separates the two degrees of freedom: aim is one drag, power is a separate bar. Golf Clash goes further and splits power from a timing-based accuracy meter, with an `accuracy` club stat that sets the tolerance of the landing area. Both do this because they have two independent quantities to set. **We have one** (conviction), with the stance chosen by which card is gripped. That is a genuine simplification, not a shortcut, and it is why our gesture can carry all three meanings at once where theirs cannot.

**The commitment-gesture precedent is separate and also well established.** Slide-to-unlock, Amazon's "Swipe to place your order", and Home Assistant's slide-to-confirm all exist because a gesture requiring sustained deliberate travel cannot be triggered by an accidental tap. Baymard's work on accidental taps recommends exactly this substitution. Addendum C's invariants 5 and 6 are this pattern; the novelty is that we also read a *value* off the distance rather than only a yes.

Sources: [thumbstick dead zones, with formulas](https://minimuino.github.io/thumbstick-deadzones/), [Doing Thumbstick Dead Zones Right](https://www.gamedeveloper.com/business/doing-thumbstick-dead-zones-right), [Angry Birds slingshot](https://angrybirds.fandom.com/wiki/Slingshot), [8 Ball Pool controls](https://support.miniclip.com/hc/en-us/articles/35451942766865-Basic-Controls-Improving-your-skills-8-Ball-Pool), [Monster Strike](https://en.wikipedia.org/wiki/Monster_Strike), [Golf Clash accuracy](https://west-games.com/golf-clash-accuracy/), [Baymard on accidental taps](https://baymard.com/blog/handling-accidental-taps-on-touch-devices), [slide-to-confirm](https://www.arjunkalburgi.com/writing/creating-a-swipe-to-confirm-component/).

---

## 2. The spring numbers are exactly right, and here is why

Addendum C §3 specifies mass 1, stiffness 400, damping 28, and predicts "roughly 200 ms with a single 4% overshoot." That checks out precisely, and the values are not arbitrary: they are the textbook precision-motion target.

Second-order system:

```
ω_n = √(k/m)          natural frequency
ζ   = c / (2√(km))    damping ratio
```

Substituting:

```
ω_n = √(400/1)        = 20 rad/s   (3.18 Hz)
ζ   = 28 / (2 · 20)   = 0.70
```

Peak overshoot for an underdamped step response:

```
OS = exp(-πζ / √(1 - ζ²))
   = exp(-π · 0.7 / √0.51)
   = exp(-2.1991 / 0.71414)
   = exp(-3.0794)
   = 0.0460                        → 4.60%
```

Time to that first peak:

```
t_p = π / (ω_n √(1 - ζ²))
    = π / (20 · 0.71414)
    = 220 ms
```

Two percent settling time:

```
t_s ≈ 4 / (ζ ω_n) = 4 / 14 = 286 ms
```

So: one overshoot of 4.6%, peaking at 220 ms, settled by ~290 ms. The spec's "roughly 200 ms, single 4% overshoot" is accurate to the peak rather than to full settle, which is the honest way to describe what the eye reads.

ζ = 0.7 is not a coincidence. It is the standard target in precision motion control precisely because it gives about 5% overshoot with fast settling while staying robust to modelling error. The spec landed on the classical answer.

**One implication the spec does not draw:** at ζ = 0.7 the motion is visibly *springy*. If playtest says the snapback feels loose, the parameter to move is ζ toward 0.82 (about 1% overshoot, still fast), which means damping 33 at the same stiffness. Going to ζ = 1.0 (damping 40) removes overshoot entirely and will read as dead.

Sources: [second-order response](https://people-ece.vse.gmu.edu/~gbeale/ece_421/second_order_04.html), [damping ratio calculator and ζ = 0.7 rationale](https://www.firgelliauto.com/blogs/engineering-calculators/damping-ratio-calculator).

---

## 3. Finding: the unit annotation in §2.1 is wrong by about 1.6x

Addendum C claims 195 pt full draw is "about 52 mm" of thumb extension. It is not.

On iOS, a point is a logical pixel at 1x density. On a current iPhone (2556 x 1179 physical, 852 x 393 logical, ~461 ppi) the logical density is ~153.8 pt per inch, so:

```
1 pt  = 25.4 / 153.8      = 0.165 mm
195 pt = 195 × 0.165      = 32.2 mm
165.75 pt (compact)       = 27.4 mm
```

52 mm would be about 315 pt. The distances and the millimetre gloss disagree.

**Which one is right?** 32 mm is the better number and the annotation should change, not the geometry. Reasons:

- 195 pt is 23% of a 852 pt screen height. A 315 pt draw would be 37%, which on a card placed mid-screen runs out of screen before it runs out of thumb.
- Thumb-reach research (Hoober's 1,333 observations; ~75% of use is thumb-driven, ~49% one-handed) puts the comfortable arc at roughly the lower two-thirds of the display, with the "ow" zone starting where the thumb must extend past its natural sweep. A 32 mm draw stays inside the easy arc from most starting points; 52 mm does not.
- §2.1's own goal is that full draw be "a full deliberate thumb extension." At 32 mm that is a firm, deliberate movement without being a grip shift, which is what we want: deliberate, not painful.

**Recommended ruling:** keep 195 pt and 165.75 pt, correct the annotation to ~32 mm and ~27 mm.

Sources: [thumb zone research summary](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/), [Hoober, designing for large screens](https://www.lukew.com/ff/entry.asp?1927=).

---

## 4. Finding: Fitts's law says the expanded top range does not make 95 harder

This one matters, because §2.1 states a safety property that the math does not support as written.

Fitts's law, Shannon form:

```
MT = a + b · log₂(A / W + 1)
```

where A is movement amplitude and W is target width. The log term is the index of difficulty (ID) in bits.

Our two ranges give:

```
detent spacing, working range   = (150 - 28) / (35/5)  = 122 / 7  = 17.43 pt
detent spacing, high-draw range = (195 - 150) / (10/5) = 45 / 2   = 22.50 pt
```

Both match the spec's "roughly 17.4" and "roughly 22.5". Now the difficulty of acquiring the top of each range, measured from the arm point:

```
reach 85:  A = 150 - 28 = 122 pt,  W = 17.43 pt
           ID = log₂(122/17.43 + 1) = log₂(8.00) = 3.00 bits

reach 95:  A = 195 - 28 = 167 pt,  W = 22.50 pt
           ID = log₂(167/22.50 + 1) = log₂(8.42) = 3.07 bits
```

**The indices are effectively identical.** Widening the targets by 29% almost exactly cancels the 37% extra distance. Under Fitts, reaching 95 is no harder than reaching 85.

And it is worse than that for the stated intent: **95 sits against a hard stop, which is a target of infinite width.** You do not have to land on it, you press until the wall stops you. In Fitts terms a wall-backed target has effectively unbounded W, so ID collapses. 95 is the single *easiest* value in the range to select precisely. So is 50, at the arm point, though that edge is softer because releasing below it cancels instead.

What is actually true, and what the spec should claim instead:

- Reaching 95 costs **37% more travel** than reaching 85. That is a real cost in time and effort, and it is the honest version of "overconfidence is physically more work."
- The expanded spacing does not gate 95. What it does is give **finer resolution in 86..94**, so a player who wants 88 can hold 88. That is a genuine benefit and it serves calibration scoring directly.

**Prediction for telemetry:** the conviction distribution will spike at 95, and secondarily at 50 (or 60 while governed), because the boundaries are the only values obtainable with zero precision. Watch for it. If the spike is large enough to distort calibration scoring, the lever is not spacing but a small resistance zone before the wall: the last ~10 pt requiring a brief dwell or a stiffer distance-per-point, so the wall must be pushed into rather than drifted into.

Sources: [Fitts's law, NN/g](https://www.nngroup.com/articles/fitts-law/), [index of difficulty and effective width](https://pmc.ncbi.nlm.nih.gov/articles/PMC3203862/), [speed-accuracy tradeoff](https://www.sciencedirect.com/science/article/abs/pii/S1071581904001028).

---

## 5. Finding: median-of-3 is the wrong filter, and there is a standard right one

Addendum C §2.3 specifies a rolling median of the last three pointer samples within a 50 ms window. Median filters are excellent at exactly one thing: rejecting isolated impulse outliers, such as a single bad touch sample. They do very little about continuous low-amplitude jitter, which is what a resting thumb actually produces.

The established solution for this exact problem is the **1€ filter** (Casiez, Roussel, Vogel, CHI 2012), designed for noisy input in interactive systems and built around the same tradeoff Addendum C is worried about.

```
exponential smoothing:   x̂ᵢ = α·xᵢ + (1 - α)·x̂ᵢ₋₁

smoothing factor:        α  = 1 / (1 + τ/Tₑ)
                         τ  = 1 / (2π·f_c)
                         Tₑ = tᵢ - tᵢ₋₁              (actual sample interval)

adaptive cutoff:         f_c = f_cmin + β·|x̂̇ᵢ|

derivative:              ẋᵢ  = (xᵢ - x̂ᵢ₋₁) / Tₑ,  smoothed at a fixed cutoff (default 1 Hz)
```

Two parameters, both with a plain meaning: lower `f_cmin` reduces jitter when slow, higher `β` reduces lag when fast.

**Why this is the right filter for our gesture specifically.** At the moment that matters most, the release, the finger is typically near-stationary. The 1€ filter's speed term goes to zero there, the cutoff drops to `f_cmin`, and smoothing is at its heaviest, so the number is at its most stable exactly when it is about to be committed. During the fast pull the speed term raises the cutoff and the meter tracks the finger without lag. That is precisely the behavior §2.3 asks for, achieved by design rather than by a fixed window.

The published comparison is that 1€ achieves less lag than competing filters at a matched amount of jitter reduction.

**Recommendation:** median-of-3 as a pre-filter for dropped or teleporting samples, then 1€ for jitter. They solve different problems and compose. Starting parameters to tune from: `f_cmin` = 1.0 Hz, `β` = 0.007 with the derivative in points per second, adjusted in playtest, per the authors' recommended procedure (set β to 0, lower `f_cmin` until slow jitter is acceptable, then raise β until lag is acceptable).

**Keep §2.3's actual law regardless of filter choice.** "What you see at release is what you get" is the important part, and it survives any filter as long as display and commit read the same stream. That law is not negotiable and no filter change touches it.

Sources: [1€ filter paper (PDF)](https://direction.bordeaux.inria.fr/~roussel/publications/2012-CHI-one-euro-filter.pdf), [ACM entry](https://dl.acm.org/doi/10.1145/2207676.2208639), [worked explanation of the math](https://jaantollander.com/post/noise-filtering-using-one-euro-filter/), [reference implementations](https://github.com/casiez/OneEuroFilter).

---

## 6. Finding: on iOS Safari there are no haptics, and this breaks a spec promise

This is the most consequential result of the research, and it lands on the platform the design is explicitly optimized for.

- `navigator.vibrate()` is supported on Chrome, Edge, Opera, Samsung Internet and Android Browser. It is **not supported on Safari or Safari on iOS**, and Firefox dropped it from 129. Global support is around 77%, and the missing quarter is the entire Apple mobile platform.
- The known workaround exploited a side effect of the `<input type="checkbox" switch>` element added in Safari 17.4, which triggered the system haptic engine. It worked from iOS 17.4 through 26.4. **Apple patched it in iOS 26.5.**

Addendum C leans on haptics structurally, not decoratively:

- §3 arm-tick, per-detent ticks within 10 ms, double-tick at 85, hard-stop resistance at 95, dull thunk at the governor, impact on release.
- §4's muscle-memory argument depends on it: "players stop reading the numeral and start counting ticks past landmarks ... the rhythm is the interface."
- The reduced-motion path explicitly promises "haptic detents remain; they are not motion."

**On iPad and iPhone Safari, none of that exists.** The reduced-motion path in particular degrades to a control with no feedback channel at all: no motion by preference, no haptics by platform.

**Recommended ruling: the detent rhythm needs a platform-independent carrier, and haptics become the enhancement rather than the substrate.**

1. **Audio tick as the primary carrier.** A very short, quiet click through Web Audio works on every target including iOS. It needs an AudioContext unlocked by a user gesture, and the grip that starts the pull is exactly that gesture, so unlock on `pointerdown` of the first grip of a run. Web Audio scheduling latency is on the order of 10 to 20 ms, which is the same order as the spec's 10 ms haptic target. Respect a mute control and the OS silent switch; never make audio load-bearing on its own.
2. **Visual tick as the always-on carrier.** A one-frame flash on the crossed tick plus the numeral change. This is the only channel that survives muting, deafness, and reduced motion together, so the landmark structure (70, 85, 95 heavier) must be legible visually first.
3. **Haptics where available**, through `navigator.vibrate` on Android with short durations, feature-detected. Do not ship the checkbox hack: it is patched, it is a side effect rather than an API, and it will read as a bug when it stops working.
4. **Amend §4's claim.** "The rhythm is the interface" has to hold visually and audibly, or the muscle-memory story does not survive contact with iOS. Worth a founder decision on whether the audio tick is acceptable brand-wise, since a terminal aesthetic and a click are actually a natural fit.

Apple's own guidance is relevant here even though we cannot call their API: match feedback to the significance of the information, and provide feedback through multiple channels so more people can receive it. Multi-channel is the correct design independent of the platform gap.

Sources: [Vibration API browser support](https://www.testmuai.com/learning-hub/vibration-api-browser-support/), [iOS haptics workaround and the 26.5 patch](https://medium.com/@posaune0423/i-open-sourced-an-oss-library-for-arbitrary-haptic-feedback-in-ios-safari-5b8ca74a5f05), [Apple HIG on feedback](https://developers.apple.com/design/human-interface-guidelines/patterns/feedback/).

---

## 7. Finding: a direction-agnostic radial pull needs guaranteed clearance, which the spec does not require

If distance is measured radially and direction carries no meaning, then every direction must be able to reach 195 pt. On a 393 pt wide phone, a card centred horizontally has about 196 pt to either side: barely enough, and not enough at all for a card near an edge or for an upward pull from a card near the top.

If the finger runs out of screen before it runs out of range, the reachable conviction silently caps below 95 in that direction. That is a violation of the geometry contract in §4, and the worst kind, because it is invisible and direction-dependent.

**Recommended layout law for PR 2B:** the stance region must guarantee at least `fullDraw` of clearance within the downward and lateral arc from every card's grip origin, or the card must reposition before GRIP so that it does. Verify per device class at run start, alongside the C.3 classification which is already specified to happen once per run.

Related: pointer capture is what keeps the gesture alive once the finger leaves the card, and it is also what turns a screen-edge exit into a clean cancel rather than a lost pointer. The three platform pieces PR 2B needs:

- `setPointerCapture(pointerId)` on `pointerdown`, so all subsequent events retarget to the card no matter where the finger goes.
- `touch-action: none` on the decision surface, without which the browser claims the drag as a scroll and fires `pointercancel`. Invariant 9 already says this; it is also the single most common cause of drag gestures failing on mobile web.
- `getCoalescedEvents()` on each `pointermove`, which returns the samples the browser merged into that event. Touch sampling commonly runs at 120 Hz against a 60 Hz display, and on ProMotion hardware higher, so a naive per-frame read discards half the samples or more. The filter should consume the coalesced stream, not the dispatched event, and the release value should come from the last coalesced sample before `pointerup`.

Sources: [Pointer Events spec](https://www.w3.org/TR/pointerevents3/), [MDN PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent), [pointer capture and touch-action in practice](https://javascript.info/pointer-events), [touch sampling vs refresh rate](https://beebom.com/difference-between-screen-refresh-rate-touch-sampling-rate/).

---

## 8. Summary of recommendations

| # | Finding | Recommendation | Owner |
|---|---|---|---|
| 1 | Mapping is a scaled radial dead zone | Adopt the standard formula and name it in code | PR 2B |
| 2 | Spring ζ = 0.7, 4.6% overshoot, 220 ms peak | Ship as specified; ζ = 0.82 if playtest says loose | PR 2B |
| 3 | 195 pt is ~32 mm, not 52 mm | Correct the annotation, keep the geometry | Spec fix |
| 4 | Expanded spacing does not gate 95; the wall makes it the easiest value | Reword the safety claim as travel cost; watch for a 95 spike in telemetry | Ruling |
| 5 | Median-of-3 does not address jitter | 1€ filter, median-of-3 as impulse pre-filter | PR 2B |
| 6 | No haptics on iOS Safari at all | Audio plus visual as the carrier, haptics as enhancement | **Ruling needed** |
| 7 | Radial pull needs guaranteed clearance in every direction | Layout law plus per-device verification at run start | PR 2B |

Items 3, 4 and 6 are spec changes and need a decision before PR 2B starts. Item 6 is the one that changes what the game feels like on the device the design is aimed at.

## 9. What is still open

- **Conviction distribution shape.** Everything above predicts a spike at the boundaries. Until a playtest produces a histogram, the calibration scoring in Addendum A §C is being tuned against an assumed distribution.
- **Audio as brand.** If the tick becomes a real feedback channel rather than a garnish, its sound is a brand decision, not an engineering one.
- **Desktop drag distances.** 195 pt was derived for a thumb. A mouse drag has different ergonomics entirely, and C.8's keyboard three-speed model may simply be the better desktop answer, with the drag present but not promoted. Worth a decision before 2B builds a desktop drag nobody uses.
