import ActionZone from '../components/ui/ActionZone';
import { useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { latestFinishedRun, latestUnfinishedRun, projectRun, type RunRecord } from '../lib/runRecord';
import {
  bestAndWorst, flagTallies, headline, outcomes, scoreAttribution,
} from '../lib/runAnalysis';
import { runRiskAdjusted } from '../lib/runEngine';
import { getQualityColor } from '../lib/scoringEngine';
import { getCheckpoint } from '../lib/arenas';
import { ScoreTrace } from '../components/game/AsciiPlates';

// The autopsy reads the Run Record (§57), never a fixture.
//
// Before this it rendered a hardcoded seven-row timeline, hardcoded best and
// worst decisions and hardcoded behavioural flags, so a player who had just
// committed fourteen real decisions was shown a run nobody played. §6.2 makes
// this screen the hinge of the session loop and §15 requires the patterns named
// here to be detected ones, which means they have to come from the record.
//
// Where the record cannot support a finding, the screen says so rather than
// filling the space. An autopsy that invents a weakness is worse than one that
// admits the run was too short to judge.

interface Props {
  onContinue: () => void;
}

type Tab = 'timeline' | 'analysis' | 'comparison' | 'profile';

const FLAG_TONE_CLASS = {
  positive: { text: 'text-phosphor', border: 'border-phosphor', mark: '+' },
  caution: { text: 'warning-value', border: 'border-alert-amber', mark: '!' },
  // Severe is a behavioural flag, not a risk failure: it reads amber with a
  // stronger mark. Red is reserved for the critical drawdown breach.
  severe: { text: 'warning-value', border: 'border-alert-amber', mark: '!!' },
} as const;

/** A return, where the sign is the point. */
function pct(n: number, digits = 2): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(digits)}%`;
}

/**
 * A magnitude, where a sign would be noise. Turnover is spend and drawdown is
 * depth; neither is a gain, and "+0.0%" for a run that has not drawn down at
 * all reads as a positive result rather than an absent one.
 */
function pctPlain(n: number, digits = 1): string {
  return `${Math.abs(n * 100).toFixed(digits)}%`;
}

export default function AutopsyScreen({ onContinue }: Props) {
  const { state } = useGame();
  const [tab, setTab] = useState<Tab>('timeline');

  // The run in hand wins over the store: mid-run the live state is fresher than
  // the last write. Falling back to a stored run lets the screen be opened long
  // after the run ended, which is the case the store exists for.
  const record: RunRecord | null = useMemo(() => {
    const live = state.run;
    if (live?.id && live.decisions.length > 0) {
      return projectRun(live, new Date().toISOString());
    }
    return latestFinishedRun() ?? latestUnfinishedRun();
  }, [state.run]);

  // No run to review is a real state, not an error, and must not be papered
  // over with a plausible-looking one.
  if (!record || record.decisions.length === 0) {
    return (
      <div className="terminal-screen min-h-screen flex flex-col">
        <div className="border-b border-phosphor/20 px-6 py-3 font-mono text-xs text-phosphor-mid tracking-widest">
          REFI ALPHA // POST-RUN AUTOPSY
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="font-mono text-sm text-phosphor tracking-widest">NO RUN TO REVIEW</div>
          <div className="font-mono text-xs text-phosphor-dim leading-6 max-w-md">
            The autopsy reads your decision record. Commit a checkpoint and it
            will have something to say.
          </div>
          <button onClick={onContinue} className="cmd-button tracking-widest mt-2">
            [ BACK ]
          </button>
        </div>
      </div>
    );
  }

  const rows = outcomes(record);
  const { best, worst } = bestAndWorst(record);
  const flags = flagTallies(record);
  const attribution = scoreAttribution(record);
  const verdict = headline(record);
  const risk = runRiskAdjusted(record.decisions, record.arenaId);

  const committed = record.decisions.length;
  const playerTrades = record.decisions.filter(d => d.actionCode !== 'HOLD').length;
  const machineTrades = record.decisions.filter(d => d.machineActionCode !== 'HOLD').length;

  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      <div className="border-b border-phosphor/20 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest whitespace-nowrap">
          REFI ALPHA // AUTOPSY
        </div>
        <div className="font-mono text-xs text-phosphor-dim truncate">
          <span className="hidden sm:inline">{record.arenaId.replace(/_/g, ' ').toUpperCase()} // </span>
          RUN {record.runId.slice(-8).toUpperCase()}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-phosphor/20 px-2 sm:px-6 flex gap-0 overflow-x-auto scrollbar-hide">
        {[
          { id: 'timeline' as Tab, label: 'TIMELINE' },
          { id: 'analysis' as Tab, label: 'DECISIONS' },
          { id: 'comparison' as Tab, label: 'VS MACHINE' },
          { id: 'profile' as Tab, label: 'ALPHA PROFILE' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`font-mono text-xs px-3 sm:px-4 py-3 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              tab === t.id
                ? 'border-phosphor text-phosphor'
                : 'border-transparent text-phosphor-dim hover:text-phosphor-mid'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">

        {tab === 'timeline' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest">
              DECISION TIMELINE · {committed} COMMITTED OF {record.totalCheckpoints}
            </div>
            <div className="space-y-1">
              {rows.map(r => {
                const par = getCheckpoint(record.arenaId, r.sequence)?.machinePar ?? 0;
                const vsPar = r.decision.scoreContribution - par;
                return (
                  <div
                    key={r.sequence}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-b border-phosphor/10"
                  >
                    <div className="font-mono text-xs text-phosphor-dim w-10 flex-shrink-0">
                      CP{String(r.sequence).padStart(2, '0')}
                    </div>
                    <div className="font-mono text-xs text-phosphor w-32 flex-shrink-0">
                      {r.decision.actionCode}
                    </div>
                    <div className="font-mono text-xs text-phosphor-dim flex-1 min-w-0 truncate hidden md:block">
                      {r.signalTitle}
                    </div>
                    <div
                      className="font-mono text-xs w-20 text-right flex-shrink-0"
                      style={{ color: getQualityColor(r.decision.quality) }}
                    >
                      {r.decision.quality}
                    </div>
                    <div className={`font-mono text-xs w-16 text-right tabular-nums flex-shrink-0 ${
                      r.playerReturn >= 0 ? 'positive-value' : 'text-phosphor'
                    }`}>
                      {pct(r.playerReturn)}
                    </div>
                    <div className="w-24 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 progress-bar-track h-2">
                          <div
                            className="progress-bar-fill h-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, r.decision.scoreContribution))}%`,
                              background: getQualityColor(r.decision.quality),
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs text-phosphor-dim tabular-nums w-6 text-right">
                          {r.decision.scoreContribution}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`font-mono text-xs w-16 text-right tabular-nums flex-shrink-0 ${
                        vsPar >= 0 ? 'positive-value' : 'text-phosphor'
                      }`}
                      title="VERSUS THE MACHINE'S PAR FOR THIS CHECKPOINT"
                    >
                      {vsPar >= 0 ? '+' : ''}{vsPar} PAR
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'analysis' && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {best && worst ? (
              <>
                <DecisionCard
                  title="BEST DECISION"
                  titleClass="text-phosphor"
                  sequence={best.sequence}
                  action={best.decision.actionCode}
                  thesis={best.decision.thesisCode}
                  signal={best.signalTitle}
                  score={best.decision.scoreContribution}
                  quality={best.decision.quality}
                  scoreClass="text-phosphor border-phosphor/40"
                />
                <DecisionCard
                  title="WORST DECISION"
                  titleClass="text-phosphor-dim"
                  sequence={worst.sequence}
                  action={worst.decision.actionCode}
                  thesis={worst.decision.thesisCode}
                  signal={worst.signalTitle}
                  score={worst.decision.scoreContribution}
                  quality={worst.decision.quality}
                  scoreClass="warning-value border-alert-amber/40"
                />
              </>
            ) : (
              <div className="terminal-panel p-5 md:col-span-2 font-mono text-xs text-phosphor-dim leading-6">
                A BEST AND A WORST NEED TWO DECISIONS THAT DIFFER. THIS RUN HAS
                {' '}{committed}. KEEP PLAYING.
              </div>
            )}

            <div className="terminal-panel p-5 md:col-span-2 space-y-3">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2">
                BEHAVIOURAL FLAGS DETECTED
              </div>
              {flags.length === 0 ? (
                <div className="font-mono text-xs text-phosphor-dim leading-6">
                  NO PATTERNS RAISED ACROSS {committed} DECISION{committed === 1 ? '' : 'S'}.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {flags.map(f => {
                    const tone = FLAG_TONE_CLASS[f.tone];
                    return (
                      <div key={f.flag} className={`terminal-panel-deep p-3 space-y-1 border-l-2 ${tone.border}`}>
                        <div className={`font-mono text-xs ${tone.text} break-words`}>
                          {tone.mark} {f.flag}
                        </div>
                        <div className="font-mono text-xs text-phosphor-dim">
                          ×{f.count} · CP {f.checkpoints.map(c => String(c).padStart(2, '0')).join(', ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'comparison' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="terminal-panel p-4 space-y-3">
                <div className="text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2">YOU</div>
                <div className="space-y-2">
                  <Row label="RETURN" value={pct(risk.playerReturn)} />
                  <Row label="SHARPE" value={risk.playerSharpe === null ? '--' : risk.playerSharpe.toFixed(2)} emphasis />
                  <Row label="MAX DD" value={pctPlain(record.drawdown)} />
                  <Row label="TURNOVER" value={pctPlain(record.turnoverUsed)} />
                  <Row label="TRADE COUNT" value={String(playerTrades)} />
                  <Row label="REFI SCORE" value={String(record.playerScore)} />
                </div>
              </div>
              <div className="terminal-panel p-4 space-y-3">
                <div className="text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2">MACHINE</div>
                <div className="space-y-2">
                  <Row label="RETURN" value={pct(risk.machineReturn)} />
                  <Row label="SHARPE" value={risk.machineSharpe === null ? '--' : risk.machineSharpe.toFixed(2)} emphasis />
                  {/* The machine's portfolio is not simulated: it acts, and the
                      run scores the action. Inventing a drawdown for it would
                      be a fabricated benchmark figure (§26.1). */}
                  <Row label="MAX DD" value="NOT SIMULATED" />
                  <Row label="TURNOVER" value="NOT SIMULATED" />
                  <Row label="TRADE COUNT" value={String(machineTrades)} />
                  <Row label="REFI SCORE" value={String(record.machineScore)} />
                </div>
              </div>
            </div>

            <div className="terminal-panel p-5 space-y-4">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                COMPARATIVE ANALYSIS
              </div>
              <div className="space-y-3 font-mono text-sm text-phosphor leading-7">
                <div>{verdict.verdict}</div>
                <div className="text-phosphor-mid text-xs leading-6">{verdict.detail}</div>
                <div className="text-phosphor-mid text-xs leading-6">
                  {attribution.aboveParCount} decision{attribution.aboveParCount === 1 ? '' : 's'} beat
                  the machine&apos;s par, adding {attribution.added} points.
                  <br />
                  {attribution.belowParCount} fell short, removing {attribution.removed}.
                </div>
              </div>
              {/* The run's shape, not just its total. A steady run and a run
                  that collapsed once can average the same and are not the same
                  run — the totals above cannot show that and this can. */}
              <div className="border-t border-phosphor/20 pt-4">
                <ScoreTrace
                  scores={rows.map(r => r.decision.scoreContribution)}
                  pars={rows.map(r => getCheckpoint(record.arenaId, r.sequence)?.machinePar ?? 0)}
                />
              </div>
              <div className="border-t border-phosphor/20 pt-4 font-mono text-xs text-phosphor-dim leading-5">
                SIMULATION RESULT BASED ON PLAYER DECISIONS, OVER HISTORICAL
                MARKET DATA. NOT LIVE CLIENT PERFORMANCE.
              </div>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="terminal-panel p-5 space-y-4">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                ALPHA PROFILE · {state.profile.rankCode.replace(/_/g, ' ')} · {state.profile.alphaXp} XP
              </div>
              <div className="space-y-3">
                {Object.entries(state.profile.dimensions).map(([dim, d]) => (
                  <div key={dim} className="space-y-1">
                    <div className="flex items-center justify-between font-mono text-xs gap-3">
                      <span className="text-phosphor-dim truncate">{dim.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-phosphor-dim tabular-nums">n={d.sampleSize}</span>
                        <span className="text-phosphor w-8 text-right tabular-nums">
                          {d.sampleSize === 0 ? '--' : Math.round(d.score)}
                        </span>
                      </div>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${d.sampleSize === 0 ? 0 : d.score}%`,
                          background: d.score >= 70 ? '#0CD4A0' : d.score >= 50 ? '#D6A647' : '#D94C4C',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="font-mono text-xs text-phosphor-dim leading-6 border-t border-phosphor/20 pt-3">
                A DIMENSION WITH NO SAMPLES IS UNSCORED, NOT ZERO. THIS IS AN
                EDUCATIONAL PROFILE, NOT A FORMAL INVESTMENT PROFILE.
              </div>
            </div>
          </div>
        )}
      </div>

      <ActionZone
        note="REFI IS BUILT AROUND THIS GAP: GOOD THESIS, CONSISTENT EXECUTION."
        primary={{ label: 'CONTINUE', onClick: onContinue, keyHint: '[ENTER]' }}
      />
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={emphasis ? 'text-phosphor' : 'text-phosphor-dim'}>{label}</span>
      <span className={`tabular-nums text-right ${emphasis ? 'text-phosphor-hot font-bold' : 'text-phosphor'}`}>
        {value}
      </span>
    </div>
  );
}

function DecisionCard(props: {
  title: string;
  titleClass: string;
  sequence: number;
  action: string;
  thesis: string | null;
  signal: string;
  score: number;
  quality: string;
  scoreClass: string;
}) {
  return (
    <div className="terminal-panel p-5 space-y-4">
      <div className={`font-mono text-xs tracking-widest border-b border-phosphor/20 pb-2 ${props.titleClass}`}>
        {props.title}
      </div>
      <div className="space-y-2">
        <div className="font-mono text-sm text-phosphor-hot">
          CHECKPOINT {String(props.sequence).padStart(2, '0')}
        </div>
        <div className="font-mono text-xs text-phosphor-mid">
          {props.action}
          {props.thesis ? ` · ${props.thesis.replace(/_/g, ' ')}` : ' · THESIS UNSTATED'}
        </div>
        <div className="font-mono text-xs text-phosphor-dim leading-5">{props.signal}</div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="font-mono text-xs text-phosphor-dim">SCORE</div>
        <div className={`font-mono text-xs border px-2 py-0.5 tabular-nums ${props.scoreClass}`}>
          {props.score} · {props.quality}
        </div>
      </div>
    </div>
  );
}
