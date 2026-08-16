import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CheckpointScore } from '../../lib/gameTypes';
import { synthesizeTapePath } from '../../lib/tapePath';
import { verdictStamp, type Verdict, type ScoreComponentCode } from '../../lib/verdict';

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
  playerAction, machineAction, machineReason, wire,
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
  const shown = reducedMotion ? n : Math.max(2, Math.ceil(progress * n));

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

  const flipped = reducedMotion ? beat !== 'LOCK' : progress >= FLIP_AT || beat === 'SCORE' || beat === 'LINE';
  const showScore = beat === 'SCORE' || beat === 'LINE';
  const showLine = beat === 'LINE';
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const liveWire = wire.length ? wire[Math.min(wire.length - 1, Math.floor(progress * wire.length))] : '';

  const verdictColor =
    verdict.sign === 'UNDER_PAR' ? 'text-risk-red'
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
            <span className="text-phosphor-dim text-xs tracking-widest tabular-nums">PAR {par}</span>
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
