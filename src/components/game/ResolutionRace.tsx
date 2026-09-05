import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CheckpointScore } from '../../lib/gameTypes';
import { synthesizeTapePath } from '../../lib/tapePath';
import { verdictStamp, type Verdict, type ScoreComponentCode } from '../../lib/verdict';
import { convictionMultiplier } from '../../lib/scoringEngine';

// ─── The resolution race ──────────────────────────────────────────────────────
// The beat the game is named after: you locked your call, now the tape decides.
//
// Before this, committing produced a number and six metric bars instantly. The
// entire emotional payload of "I made a call and the market answered" was
// skipped. This performs it, in five beats, and the ordering is the whole
// design: the machine's card is face down while the market moves, so for a
// couple of seconds two open hands are racing and neither is settled.
//
// What this is NOT, deliberately (rule 16, and §61A of the spec):
//   - No near-miss staging. A one point loss is presented exactly like a
//     fifteen point loss. The margin is stated as fact and never dramatized.
//   - No jackpot framing, no variable payout, no reel spin on the numbers.
//   - No sound or animation that differs by outcome. The staging is identical
//     whether the player won or lost; only the words and the numbers differ.
//
// §58: both curves are SIMULATION output and are labelled as such throughout.
// They are not a price history for any named security, and the renderer never
// draws per-ticker paths.

type Beat = 'LOCK' | 'RACE' | 'SCORE' | 'LINE' | 'DONE';

interface Props {
  /** Authored cumulative return for the stance the player committed. */
  playerReturn: number;
  /** Authored cumulative return for the machine's stance. */
  machineReturn: number;
  volatilityDelta: number;
  correlationLevel: number;
  /** Stable per-checkpoint seed. Same checkpoint, same race, every replay. */
  seed: number;
  checkpointSequence: number;

  playerAction: string;
  machineAction: string;
  machineReason: string;
  /** Headlines from the checkpoint, ticked across during the race. */
  wire: string[];

  /** The conviction committed with the stance, 50 to 95. Shapes the throw. */
  conviction: number;

  score: CheckpointScore;
  verdict: Verdict;
  par: number;

  reducedMotion: boolean;
  onComplete: () => void;
}

const BEAT_MS: Record<Exclude<Beat, 'DONE'>, number> = {
  LOCK: 500,
  RACE: 3600,
  SCORE: 1500,
  LINE: 800,
};

/** The machine's card turns partway through the race, not at the end of it. */
const FLIP_AT = 0.55;

/**
 * How the curve leaves the gate.
 *
 * The pull gesture is a draw: the further you haul the stance card, the higher
 * the conviction. Release used to end the motion, and a chart then appeared
 * from a standing start, so the draw and the flight read as two separate
 * screens rather than one throw. This is the continuity: the harder the draw,
 * the harder the line leaves.
 *
 * Only the pacing responds. The curve still arrives at exactly the authored
 * return, on the same 3.6s beat, because the market did not move further
 * because the player felt more strongly about it. Conviction changes what the
 * checkpoint is worth, not what happened (§58).
 *
 * At CONVICTION_MIN the exponent is ~0.78 (a gentle lob), at the resting
 * default it is ~1.0 (linear, unchanged from before this existed), and at
 * CONVICTION_MAX ~1.36 (a hard snap out that settles into the tape).
 */
export function launchEase(t: number, conviction: number): number {
  const drawn = Math.max(0, Math.min(1, (conviction - 50) / 45));
  const exponent = 0.78 + drawn * 0.58;
  return Math.pow(Math.max(0, Math.min(1, t)), 1 / exponent);
}

const METRIC_LABEL: Record<ScoreComponentCode, string> = {
  RAER: 'RAER',
  DRAWDOWN: 'DRAWDOWN',
  DOWNSIDE: 'DOWNSIDE',
  REGIME: 'REGIME',
  TURNOVER: 'TURNOVER',
  CONSISTENCY: 'CONSISTENCY',
};

export default function ResolutionRace({
  playerReturn, machineReturn, volatilityDelta, correlationLevel, seed, checkpointSequence,
  playerAction, machineAction, machineReason, wire, conviction,
  score, verdict, par, reducedMotion, onComplete,
}: Props) {
  const [beat, setBeat] = useState<Beat>('LOCK');
  // 0 to 1 across the race. Drives the curve draw and the card flip together,
  // so the flip lands at the same point in the story every time.
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const path = useMemo(
    () => synthesizeTapePath({
      runSeed: seed,
      checkpointSequence,
      playerReturn,
      machineReturn,
      volatilityDelta,
      correlationLevel,
    }),
    [seed, checkpointSequence, playerReturn, machineReturn, volatilityDelta, correlationLevel],
  );

  // Metric order with the dominant driver last, so the bar that explains the
  // result is the one still filling when the verdict lands.
  const metrics = useMemo(() => {
    const all: { code: ScoreComponentCode; value: number }[] = [
      { code: 'RAER', value: score.raerScore },
      { code: 'DRAWDOWN', value: score.drawdownScore },
      { code: 'DOWNSIDE', value: score.downsideScore },
      { code: 'REGIME', value: score.regimeAdaptScore },
      { code: 'TURNOVER', value: score.turnoverScore },
      { code: 'CONSISTENCY', value: score.consistencyScore },
    ];
    return [
      ...all.filter(m => m.code !== verdict.dominant),
      ...all.filter(m => m.code === verdict.dominant),
    ];
  }, [score, verdict.dominant]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  }, [onComplete]);

  const advance = useCallback(() => {
    setBeat(b =>
      b === 'LOCK' ? 'RACE' : b === 'RACE' ? 'SCORE' : b === 'SCORE' ? 'LINE' : 'DONE');
  }, []);

  // Reduced motion keeps the five beats and their order, because the sequence
  // IS the design; only the autoplay and the tweening go. The player advances
  // each beat themselves and the curves render complete (§62).
  useEffect(() => {
    if (reducedMotion) {
      setProgress(1);
      return;
    }
    if (beat === 'DONE') { finish(); return; }

    const ms = BEAT_MS[beat];
    const timer = window.setTimeout(advance, ms);

    if (beat !== 'RACE') return () => window.clearTimeout(timer);

    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / BEAT_MS.RACE);
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      window.clearTimeout(timer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [beat, reducedMotion, advance, finish]);

  useEffect(() => {
    if (reducedMotion && beat === 'DONE') finish();
  }, [reducedMotion, beat, finish]);

  // ─── Geometry ───────────────────────────────────────────────────────────────

  const W = 640, H = 180, PAD = 8;
  const n = path.player.length;
  // The throw. Reduced motion renders complete, so the easing never applies.
  const thrown = reducedMotion ? 1 : launchEase(progress, conviction);
  const shown = reducedMotion ? n : Math.max(2, Math.ceil(thrown * n));

  const bounds = useMemo(() => {
    const all = [...path.player, ...path.machine, 0];
    const lo = Math.min(...all), hi = Math.max(...all);
    const span = Math.max(1e-6, hi - lo);
    return { lo, hi, span };
  }, [path]);

  const toPoints = (series: number[]) => series.slice(0, shown).map((v, i) => {
    const x = PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - bounds.lo) / bounds.span) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // The reachable range at the committed conviction, in score space.
  //
  // The engine scales the checkpoint's distance from par by the conviction
  // multiplier, so the widest honest claim about a maximal stance is par plus
  // or minus the multiplier applied to the largest process gap. Drawn against a
  // fixed half-width so par sits at the centre and the band grows outward from
  // it: the geometry of the strip is the multiplier, made visible.
  const stakes = useMemo(() => {
    const multiplier = convictionMultiplier(conviction / 100);
    const HALF = 50; // the strip spans par +/- 50 points, clipped to 0..100
    const reach = Math.min(HALF, HALF * (multiplier / 2));
    const floor = Math.max(0, Math.round(par - reach));
    const ceiling = Math.min(100, Math.round(par + reach));
    const toPct = (v: number) => 50 + ((v - par) / HALF) * 50;
    return {
      multiplier,
      floor,
      ceiling,
      leftPct: Math.max(0, toPct(floor)),
      widthPct: Math.min(100, toPct(ceiling)) - Math.max(0, toPct(floor)),
      landedPct: Math.max(0, Math.min(100, toPct(score.totalScore))),
    };
  }, [conviction, par, score.totalScore]);

  const flipped = reducedMotion ? beat !== 'LOCK' : progress >= FLIP_AT || beat === 'SCORE' || beat === 'LINE';
  const showScore = beat === 'SCORE' || beat === 'LINE';
  const showLine = beat === 'LINE';
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const liveWire = wire.length ? wire[Math.min(wire.length - 1, Math.floor(progress * wire.length))] : '';

  const verdictColor =
    verdict.sign === 'UNDER_PAR' ? 'text-alert-amber'
      : verdict.sign === 'AT_PAR' ? 'text-phosphor-mid'
      : 'text-paper-green';

  return (
    <div className="border border-phosphor/20 bg-terminal-deep/50 p-4">

      {/* Beat 1: both cards on the table, the machine's face down. */}
      <div className="flex items-stretch gap-3 mb-3">
        <div className="flex-1 border border-phosphor/30 bg-phosphor/5 p-3">
          <div className="text-phosphor-dim text-xs tracking-widest mb-1">YOUR CALL</div>
          <div className="text-phosphor text-sm font-bold tracking-wide">{playerAction}</div>
          <div className="text-phosphor-dim text-xs tracking-widest mt-1">LOCKED</div>
        </div>
        <div className={`flex-1 border p-3 transition-colors duration-300 ${
          flipped ? 'border-alert-amber/40 bg-alert-amber/5' : 'border-phosphor/15 bg-terminal-black'
        }`}>
          <div className="text-phosphor-dim text-xs tracking-widest mb-1">MACHINE</div>
          {flipped ? (
            <>
              <div className="text-alert-amber text-sm font-bold tracking-wide">{machineAction}</div>
              <div className="text-phosphor-dim text-xs leading-snug mt-1">{machineReason}</div>
            </>
          ) : (
            <div className="text-phosphor-dim text-sm tracking-widest">
              CRISIS-R1 HAS COMMITTED
            </div>
          )}
        </div>
      </div>

      {/* Beat 2: the race. Two labelled simulation curves, never candles. */}
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-phosphor-dim text-xs tracking-widest">
            {reducedMotion ? 'MARKET RESOLVED' : 'MARKET RESOLVING'}
          </span>
          {/* §58: never let a simulation read as historical market data. */}
          <span className="text-phosphor-dim/70 text-xs tracking-widest border border-phosphor/20 px-1.5">
            SIMULATION
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
             aria-label={`Portfolio simulation. Your result ${pct(playerReturn)}, machine ${pct(machineReturn)}.`}>
          <line x1={PAD} y1={H - PAD - ((0 - bounds.lo) / bounds.span) * (H - PAD * 2)}
                x2={W - PAD} y2={H - PAD - ((0 - bounds.lo) / bounds.span) * (H - PAD * 2)}
                stroke="currentColor" className="text-phosphor/15" strokeWidth="1" strokeDasharray="3 4" />
          <polyline points={toPoints(path.machine)} fill="none" strokeWidth="1.5"
                    stroke="currentColor" className="text-alert-amber/70" />
          <polyline points={toPoints(path.player)} fill="none" strokeWidth="2"
                    stroke="currentColor" className="text-phosphor" />
        </svg>

        <div className="flex items-center justify-between text-xs tabular-nums mt-1">
          <span className="text-phosphor">
            YOU {pct(path.player[Math.max(0, shown - 1)])}
          </span>
          {!reducedMotion && liveWire && (
            <span className="text-phosphor-dim truncate px-3 max-w-[50%]">{liveWire}</span>
          )}
          <span className="text-alert-amber/80">
            MCH {pct(path.machine[Math.max(0, shown - 1)])}
          </span>
        </div>
      </div>

      {/* Beat 3: the score assembles, dominant driver last. */}
      {showScore && (
        <div className="mt-4 pt-3 border-t border-phosphor/15">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-phosphor-dim text-xs tracking-widest">CHECKPOINT SCORE</span>
            <span className="text-phosphor-dim text-xs tracking-widest tabular-nums">PAR {par} <span className="text-phosphor-dim/60">· MACHINE TARGET</span></span>
          </div>

          {/* What the draw bought.
              The market did not move further because the player pulled harder,
              so the curve above cannot widen with conviction without lying.
              What conviction genuinely changed is how far this checkpoint could
              land from par, and that is a statement about the player's own
              input, not about the tape. It is drawn here, in score space, where
              the axis actually means what the band is measuring.
              Both directions are shown at equal weight: a wide band is not a
              promise, it is exposure. */}
          <div className="mb-3">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-phosphor-dim text-xs tracking-widest">
                AT CONVICTION {Math.round(conviction)}
              </span>
              <span className="text-phosphor-dim text-xs tracking-widest tabular-nums">
                {stakes.multiplier.toFixed(1)}x FROM PAR
              </span>
            </div>
            <div
              className="relative h-6 border border-phosphor/15 bg-terminal-black"
              role="img"
              aria-label={
                `At conviction ${Math.round(conviction)} this checkpoint could land `
                + `between ${stakes.floor} and ${stakes.ceiling}, against par ${par}. `
                + `Scored ${score.totalScore}.`
              }
            >
              {/* The reachable band, symmetric around par. */}
              <div
                className="absolute inset-y-0 bg-phosphor/10 border-x border-phosphor/25"
                style={{ left: `${stakes.leftPct}%`, width: `${stakes.widthPct}%` }}
              />
              {/* Par, always at the same place, so the band visibly breathes
                  around a fixed point as conviction changes. */}
              <div className="absolute inset-y-0 w-px bg-phosphor/45" style={{ left: '50%' }} />
              {/* Where it actually landed. */}
              <div
                className={`absolute inset-y-0 w-0.5 ${
                  score.totalScore >= par ? 'bg-phosphor' : 'bg-alert-amber'
                }`}
                style={{
                  left: `${stakes.landedPct}%`,
                  transition: reducedMotion ? 'none' : 'left 420ms ease-out 200ms',
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-phosphor-dim/70 text-xs tabular-nums">
              <span>{stakes.floor}</span>
              <span className="text-phosphor-dim">PAR {par}</span>
              <span>{stakes.ceiling}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {metrics.map((m, i) => {
              const dominant = m.code === verdict.dominant;
              return (
                <div key={m.code} className="flex items-center gap-2">
                  <span className={`text-xs w-24 flex-shrink-0 ${dominant ? 'text-phosphor' : 'text-phosphor-dim'}`}>
                    {METRIC_LABEL[m.code]}
                  </span>
                  <div className="flex-1 h-1.5 bg-phosphor/10 overflow-hidden">
                    <div
                      className={`h-full ${dominant ? 'bg-phosphor' : 'bg-phosphor/35'}`}
                      style={{
                        width: `${Math.max(0, Math.min(100, m.value))}%`,
                        transition: reducedMotion ? 'none' : `width 320ms ease-out ${i * 110}ms`,
                      }}
                    />
                  </div>
                  <span className={`text-xs tabular-nums w-8 text-right ${dominant ? 'text-phosphor' : 'text-phosphor-dim'}`}>
                    {m.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Beat 4: one verdict. The margin is stated, never staged. */}
      {showLine && (
        <div className="mt-4 pt-3 border-t border-phosphor/15">
          <div className={`text-sm font-bold tracking-wide ${verdictColor}`}>
            {verdictStamp(verdict.sign, verdict.margin)}
          </div>
          <div className="text-phosphor-mid text-xs leading-relaxed mt-1">{verdict.headline}</div>
          {verdict.nudge && (
            <div className="text-phosphor-dim text-xs leading-relaxed mt-2 border-l border-phosphor/20 pl-2">
              {verdict.nudge}
            </div>
          )}
        </div>
      )}

      {/* Advance. Reduced motion drives every beat by hand; otherwise this is
          the skip, available from the first beat and never required. */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={beat === 'LINE' ? finish : advance}
          className="text-phosphor-dim text-xs tracking-widest hover:text-phosphor transition-colors"
        >
          {reducedMotion
            ? (beat === 'LINE' ? 'CONTINUE →' : 'ADVANCE →')
            : (beat === 'LINE' ? 'CONTINUE →' : 'SKIP →')}
        </button>
      </div>
    </div>
  );
}
