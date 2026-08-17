// ─── 1 euro filter ────────────────────────────────────────────────────────────
// Casiez, Roussel and Vogel, CHI 2012. A first-order low pass filter whose
// cutoff adapts to the speed of the signal: heavy smoothing when slow, light
// when fast.
//
// This is the right filter for the pull specifically. At the instant that
// matters most, the release, the finger is usually near-stationary, so the
// speed term collapses, the cutoff drops to its minimum and the number is at
// its steadiest exactly when it is about to be committed. During the fast pull
// the cutoff rises and the meter tracks without lag. A fixed window cannot do
// both. See docs/g1-gesture-research.md section 5.
//
//   x̂ᵢ  = α·xᵢ + (1 - α)·x̂ᵢ₋₁
//   α   = 1 / (1 + τ/Tₑ)          τ = 1/(2π·f_c)
//   f_c = f_cmin + β·|x̂̇ᵢ|

export interface OneEuroConfig {
  /** Minimum cutoff, Hz. Lower reduces jitter when the finger is slow. */
  minCutoff: number;
  /** Speed coefficient. Higher reduces lag when the finger is fast. */
  beta: number;
  /** Cutoff for the derivative estimate, Hz. */
  derivativeCutoff: number;
}

// Starting points to tune from, per the authors' procedure: set beta to zero,
// lower minCutoff until slow jitter is acceptable, then raise beta until lag
// is acceptable. Distances here are in CSS points and time in seconds.
export const DEFAULT_ONE_EURO: OneEuroConfig = {
  minCutoff: 1.0,
  beta: 0.007,
  derivativeCutoff: 1.0,
};

function smoothingFactor(samplePeriod: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / samplePeriod);
}

function exponentialSmoothing(alpha: number, value: number, previous: number): number {
  return alpha * value + (1 - alpha) * previous;
}

export class OneEuroFilter {
  private readonly config: OneEuroConfig;
  private lastValue: number | null = null;
  private lastFiltered = 0;
  private lastDerivative = 0;
  private lastTimestamp = 0;

  constructor(config: OneEuroConfig = DEFAULT_ONE_EURO) {
    this.config = { ...config };
  }

  reset(): void {
    this.lastValue = null;
    this.lastFiltered = 0;
    this.lastDerivative = 0;
    this.lastTimestamp = 0;
  }

  /**
   * @param value      raw sample
   * @param timestamp  seconds, monotonic
   */
  filter(value: number, timestamp: number): number {
    if (this.lastValue === null) {
      this.lastValue = value;
      this.lastFiltered = value;
      this.lastDerivative = 0;
      this.lastTimestamp = timestamp;
      return value;
    }

    // Real elapsed time, not an assumed frame budget: pointer samples arrive
    // at the touch sampling rate, which is commonly double the refresh rate
    // and irregular under load.
    const samplePeriod = Math.max(1e-6, timestamp - this.lastTimestamp);

    const rawDerivative = (value - this.lastFiltered) / samplePeriod;
    const derivative = exponentialSmoothing(
      smoothingFactor(samplePeriod, this.config.derivativeCutoff),
      rawDerivative,
      this.lastDerivative,
    );

    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(derivative);
    const filtered = exponentialSmoothing(
      smoothingFactor(samplePeriod, cutoff),
      value,
      this.lastFiltered,
    );

    this.lastValue = value;
    this.lastFiltered = filtered;
    this.lastDerivative = derivative;
    this.lastTimestamp = timestamp;
    return filtered;
  }
}

// ─── Impulse pre-filter ───────────────────────────────────────────────────────

/**
 * Median of the last three samples.
 *
 * A median rejects a single teleporting or dropped sample outright, which
 * exponential smoothing only smears. It does almost nothing about continuous
 * jitter, which is why it feeds the 1 euro filter rather than replacing it:
 * the two solve different problems and compose.
 */
export class MedianOf3 {
  private readonly window: number[] = [];

  reset(): void {
    this.window.length = 0;
  }

  push(value: number): number {
    this.window.push(value);
    if (this.window.length > 3) this.window.shift();
    if (this.window.length < 3) return value;
    const [a, b, c] = this.window;
    return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
  }
}

/** The pipeline the gesture reads: impulse rejection, then jitter smoothing. */
/**
 * Distance below which a held finger is treated as having arrived.
 *
 * A one-euro filter approaches its input asymptotically and never reaches it:
 * a finger held on the arm point settles at 27.95 pt against a 28 pt target and
 * stays there. That residue is far below anything a finger, a screen or a
 * person can express, but it is not below the thresholds the gesture compares
 * against, so it made the bottom of the scale unreachable by a clean draw.
 *
 * Snapping to the input inside this band makes a held pull settle exactly where
 * the finger stopped, at every value, not only at the floor. It is a
 * correctness fix rather than a feel tweak: without it the committed value can
 * differ from the value the finger is expressing by an amount that rounds to a
 * whole conviction point near a boundary.
 */
// 0.5 pt is roughly 0.08 mm of thumb travel and about one seventh of a single
// conviction point in the working range, so snapping here cannot move a
// committed integer.
export const SETTLE_EPSILON_PT = 0.5;

export class PullFilter {
  private readonly median = new MedianOf3();
  private readonly smooth: OneEuroFilter;
  private last = 0;

  constructor(config: OneEuroConfig = DEFAULT_ONE_EURO) {
    this.smooth = new OneEuroFilter(config);
  }

  reset(): void {
    this.median.reset();
    this.smooth.reset();
    this.last = 0;
  }

  filter(value: number, timestamp: number): number {
    const target = this.median.push(value);
    const smoothed = this.smooth.filter(target, timestamp);
    // Arrived, for any purpose a hand can distinguish.
    this.last = Math.abs(target - smoothed) < SETTLE_EPSILON_PT ? target : smoothed;
    return this.last;
  }
}
