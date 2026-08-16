// ─── Tape path synthesis ──────────────────────────────────────────────────────
// The two equity curves the resolution race draws, derived from the scalars the
// checkpoint already authors. There is no daily price series in the content, so
// the roll cannot replay real intra-checkpoint prices; it renders the shape of a
// result whose endpoints are authored.
//
// What this is, precisely, because §58 turns on it: these are SIMULATION
// curves, not historical market data. They are the labelled portfolio
// simulation the game already computes, drawn over time instead of jumped to.
// Nothing here fabricates a price for a named security, and the renderer must
// never present these as a ticker's real intraday path.
//
// Three properties this module guarantees, each pinned by a test:
//
//   1. Endpoints are exact. The last value equals the authored return by
//      construction, not by approximation, so the drama can never disagree with
//      the score that follows it.
//   2. Replay is bit-identical. Same seed and checkpoint, same race, forever
//      (§65). That is why nothing below calls a transcendental.
//   3. Volatility changes the texture, never the outcome. A checkpoint can look
//      as violent as it truly was without moving a single scored number.

/** One synthesized race: cumulative return per step for both sides. */
export interface TapePath {
  /** steps + 1 values. First is exactly 0, last is exactly the authored return. */
  player: number[];
  machine: number[];
}

export interface TapePathInput {
  runSeed: number;
  checkpointSequence: number;
  /** Authored cumulative return for the player's stance at this checkpoint. */
  playerReturn: number;
  /** Authored cumulative return for the machine's stance. */
  machineReturn: number;
  /** Authored volatility delta. Scales wiggle amplitude only. */
  volatilityDelta: number;
  /** Authored cross-asset correlation, 0 to 1. Shapes how the lines travel. */
  correlationLevel: number;
  /** Samples drawn between the endpoints. Default 24 reads as a day per tick. */
  steps?: number;
}

export const DEFAULT_STEPS = 24;

// Baseline step volatility before the checkpoint's own delta is added. Chosen
// so a quiet checkpoint still breathes and a violent one still resolves inside
// the frame. Feel constant: tune freely, it cannot move a scored value.
export const BASE_STEP_VOL = 0.004;

// ─── Deterministic integer PRNG ───────────────────────────────────────────────
//
// xorshift32. State is a uint32 held through integer ops only, so the sequence
// is identical on every engine. Uniforms come from dividing an exact integer by
// an exact power of two, which IEEE 754 requires to be exact.
//
// Deliberately NOT Box-Muller. Math.log, Math.cos, Math.exp and friends are
// implementation-defined in ECMAScript: engines may return different last bits
// for the same input, which would make "same seed, same race" false across
// browsers and break the §65 promise the labelled simulation stands on.
// Math.sqrt is safe (IEEE 754 requires correct rounding) and is the only root
// used here.

const UINT32 = 4294967296;

export function hashSeed(runSeed: number, checkpointSequence: number): number {
  // Integer avalanche. Math.imul keeps every step in 32-bit space.
  let h = (runSeed | 0) ^ Math.imul(checkpointSequence | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  // xorshift32 cannot start from zero: it would emit zeros forever.
  return h === 0 ? 0x9e3779b9 : h;
}

/** A pure generator: returns the next state alongside its uniform in [0, 1). */
export function nextState(state: number): { state: number; uniform: number } {
  let x = state >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;  x >>>= 0;
  return { state: x, uniform: x / UINT32 };
}

/**
 * A standard-normal-ish shock from twelve uniforms (Irwin-Hall).
 *
 * The sum of twelve uniforms has mean 6 and variance 1, so subtracting 6 gives
 * unit variance directly with no scaling constant and, more importantly, no
 * transcendental. The tails are bounded at ±6, which for a visual path is a
 * feature: the race never draws a spike that the endpoint cannot absorb.
 */
export function nextGaussian(state: number): { state: number; value: number } {
  let s = state;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const step = nextState(s);
    s = step.state;
    sum += step.uniform;
  }
  return { state: s, value: sum - 6 };
}

// ─── The bridge ───────────────────────────────────────────────────────────────

/**
 * Turn a shock series into a walk that starts at exactly 0 and ends at exactly
 * `target`.
 *
 * The correction subtracts the walk's own terminal value scaled by progress and
 * adds the target back the same way. At i = n the two `w[n]` terms cancel to
 * exactly zero in floating point (x - x is exact for any finite x), leaving the
 * target untouched. At i = 0 both correction terms are multiplied by zero. So
 * both endpoints are exact by construction rather than by tolerance.
 */
export function bridge(shocks: number[], target: number): number[] {
  const n = shocks.length;
  const walk: number[] = new Array(n + 1);
  walk[0] = 0;
  for (let i = 0; i < n; i++) walk[i + 1] = walk[i] + shocks[i];

  const terminal = walk[n];
  const out: number[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const progress = i / n;
    out[i] = walk[i] - progress * terminal + progress * target;
  }
  // Belt and braces: state the contract in the data, not only in the comment.
  out[0] = 0;
  out[n] = target;
  return out;
}

// ─── Correlation ──────────────────────────────────────────────────────────────

/**
 * Mix an independent shock into a shared one at the authored correlation.
 *
 * `correlationLevel` is already in the checkpoint data and, until now, no
 * presentation used it. It is exactly the parameter that gives the race its
 * meaning: at high correlation both lines fall together and the gap decides the
 * verdict, which reads as "we both took the hit, who took it better". At low
 * correlation the paths diverge, which reads as "we made different calls and
 * the market chose between them". The story each checkpoint tells is already
 * encoded; the renderer only has to listen.
 *
 * The edges are exact, not approached: at 1 the machine's shock IS the
 * player's, at 0 it is purely independent.
 */
export function mixShock(shared: number, independent: number, rho: number): number {
  const r = rho <= 0 ? 0 : rho >= 1 ? 1 : rho;
  if (r === 1) return shared;
  if (r === 0) return independent;
  return r * shared + Math.sqrt(1 - r * r) * independent;
}

// ─── Public entry ─────────────────────────────────────────────────────────────

export function synthesizeTapePath(input: TapePathInput): TapePath {
  const {
    runSeed, checkpointSequence, playerReturn, machineReturn,
    volatilityDelta, correlationLevel, steps = DEFAULT_STEPS,
  } = input;

  const n = Math.max(1, Math.floor(steps));
  // Volatility scales the wiggle only. Both series are pinned to their authored
  // endpoints afterwards, so no value of this can change a result.
  const sigma = BASE_STEP_VOL + Math.abs(volatilityDelta) * 0.5;

  let state = hashSeed(runSeed, checkpointSequence);
  const playerShocks: number[] = new Array(n);
  const machineShocks: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    // Draw both shocks from one stream, shared first, so the sequence is fixed
    // regardless of the correlation the checkpoint happens to author.
    const a = nextGaussian(state);
    state = a.state;
    const b = nextGaussian(state);
    state = b.state;

    playerShocks[i] = a.value * sigma;
    machineShocks[i] = mixShock(a.value, b.value, correlationLevel) * sigma;
  }

  return {
    player: bridge(playerShocks, playerReturn),
    machine: bridge(machineShocks, machineReturn),
  };
}
