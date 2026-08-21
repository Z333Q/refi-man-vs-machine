import ActionZone from '../components/ui/ActionZone';
import { useState, useEffect } from 'react';
import { getTodaysTape, getYesterdaysTape, scoreTapeDecision } from '../lib/dailyTape';
import { useGame } from '../context/GameContext';
import type { ActionCode } from '../lib/gameTypes';
import { supabase, getSessionId } from '../lib/supabase';

type TapePhase = 'INTRO' | 'READING' | 'COMMITTED' | 'REVEAL';

interface Props {
  onBack: () => void;
}

const DIRECTION_COLOR = {
  up: 'text-paper-green',
  down: 'text-risk-red',
  neutral: 'text-phosphor-mid',
};

export default function DailyTapeScreen({ onBack }: Props) {
  const { state, earnXp } = useGame();
  const [phase, setPhase] = useState<TapePhase>('INTRO');
  const [selectedAction, setSelectedAction] = useState<ActionCode | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const today = getTodaysTape();
  const yesterday = getYesterdaysTape();

  useEffect(() => {
    const checkSubmission = async () => {
      const { data } = await supabase
        .from('daily_tape_submissions')
        .select('player_action, score')
        .eq('session_id', getSessionId())
        .eq('tape_date', today.date)
        .maybeSingle();

      if (data) {
        setAlreadySubmitted(true);
        setSelectedAction(data.player_action as ActionCode);
        setScore(data.score);
        setPhase('REVEAL');
      }
      setLoading(false);
    };
    checkSubmission();
  }, [today.date]);

  const handleCommit = async () => {
    if (!selectedAction) return;
    const tapeScore = scoreTapeDecision(selectedAction, today);

    await supabase.from('daily_tape_submissions').insert({
      session_id: getSessionId(),
      tape_id: today.id,
      tape_date: today.date,
      player_action: selectedAction,
      correct_action: today.correctAction,
      score: tapeScore,
      machine_action: today.machineAction,
    });

    setScore(tapeScore);
    setAlreadySubmitted(true);

    const xpAward = selectedAction === today.correctAction ? 25 : selectedAction === today.machineAction ? 15 : 5;
    earnXp(xpAward);
    setPhase('REVEAL');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <span className="font-mono text-phosphor text-xs tracking-widest animate-pulse">LOADING TAPE...</span>
      </div>
    );
  }

  const crowdPct = (code: ActionCode) => {
    const val = today.crowdDistribution[code] ?? 0;
    return Math.round(val * 100);
  };

  return (
    <div className="min-h-screen bg-terminal-black terminal-screen font-mono flex flex-col">
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-phosphor-dim text-xs tracking-widest mb-1">DAILY MARKET TAPE</div>
            <div className="text-phosphor text-xl font-bold">{today.date}</div>
          </div>
          <button
            onClick={onBack}
            className="text-phosphor-dim text-xs hover:text-phosphor transition-colors tracking-widest"
          >
            ← BACK
          </button>
        </div>

        {/* Yesterday's result (if viewing today's tape after submission, show yesterday) */}
        {phase !== 'REVEAL' && (
          <div className="terminal-panel-deep mb-6 p-4">
            <div className="text-phosphor-dim text-xs tracking-widest mb-3">
              YESTERDAY'S RESULT · {yesterday.date}
            </div>
            <div className="text-phosphor text-sm font-bold mb-2">{yesterday.title}</div>
            <div className="text-phosphor-dim text-xs leading-relaxed mb-3">{yesterday.explanation}</div>
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-phosphor-dim">CORRECT: </span>
                <span className="text-paper-green font-bold">{yesterday.correctAction}</span>
              </div>
              <div>
                <span className="text-phosphor-dim">MACHINE: </span>
                <span className="text-phosphor-mid font-bold">{yesterday.machineAction}</span>
              </div>
            </div>
          </div>
        )}

        {/* Today's tape */}
        <div className="terminal-panel p-5 mb-6">
          <div className="text-phosphor-dim text-xs tracking-widest mb-1">TODAY'S TAPE</div>
          <div className="text-phosphor text-xl font-bold mb-4">{today.title}</div>

          {/* Signals */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {today.signals.map((sig, i) => (
              <div key={i} className="border-l-2 border-phosphor/25 pl-3">
                <div className="text-phosphor-dim text-xs tracking-widest">{sig.category}</div>
                <div className="text-phosphor-mid text-xs mt-0.5 leading-snug">{sig.text}</div>
              </div>
            ))}
          </div>

          {/* Market data */}
          <div className="border-t border-phosphor/10 pt-4">
            <div className="text-phosphor-dim text-xs tracking-widest mb-3">MARKET DATA</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {today.marketData.map((md, i) => (
                <div key={i} className="text-center">
                  <div className="text-phosphor-dim text-xs">{md.indicator}</div>
                  <div className={`text-sm font-bold mt-1 ${DIRECTION_COLOR[md.direction]}`}>
                    {md.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decision area */}
        {phase !== 'REVEAL' && !alreadySubmitted && (
          <div>
            <div className="text-phosphor-dim text-xs tracking-widest mb-3">YOUR CALL</div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {today.availableActions.map((ac) => (
                <button
                  key={ac.code}
                  onClick={() => setSelectedAction(ac.code)}
                  className={`cmd-button py-3 px-4 text-left border transition-all duration-150 ${
                    selectedAction === ac.code
                      ? 'border-phosphor bg-phosphor/10 text-phosphor'
                      : 'border-phosphor/20 text-phosphor-mid hover:border-phosphor/40 hover:text-phosphor'
                  }`}
                >
                  <div className="text-xs font-bold tracking-wide">{ac.code}</div>
                  <div className="text-xs mt-1 opacity-70 leading-snug">{ac.label}</div>
                </button>
              ))}
            </div>

          </div>
        )}

        {/* Reveal */}
        {phase === 'REVEAL' && (
          <div className="space-y-4 animate-boot-fade">
            <div className="text-phosphor-dim text-xs tracking-widest mb-2">TODAY'S RESULT</div>

            {/* Score card */}
            <div className={`border p-5 ${
              selectedAction === today.correctAction
                ? 'border-paper-green/50 bg-paper-green/5'
                : selectedAction === today.machineAction
                ? 'border-phosphor/40 bg-phosphor/5'
                : 'border-risk-red/40 bg-risk-red/5'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-phosphor-dim text-xs tracking-widest mb-1">YOUR CALL</div>
                  <div className={`text-2xl font-bold ${
                    selectedAction === today.correctAction ? 'text-paper-green' :
                    selectedAction === today.machineAction ? 'text-phosphor' :
                    'text-risk-red'
                  }`}>{selectedAction}</div>
                </div>
                <div className="text-right">
                  <div className="text-phosphor-dim text-xs tracking-widest mb-1">SCORE</div>
                  <div className="text-2xl font-bold text-phosphor">{score}</div>
                </div>
              </div>

              <div className="flex gap-6 text-xs">
                <div>
                  <span className="text-phosphor-dim">CORRECT: </span>
                  <span className="text-paper-green font-bold">{today.correctAction}</span>
                </div>
                <div>
                  <span className="text-phosphor-dim">MACHINE: </span>
                  <span className="text-phosphor-mid font-bold">{today.machineAction}</span>
                </div>
                {selectedAction === today.correctAction && (
                  <div className="text-paper-green font-bold">✓ CORRECT PROCESS</div>
                )}
              </div>
            </div>

            {/* Explanation */}
            <div className="terminal-panel-deep p-4">
              <div className="text-phosphor-dim text-xs tracking-widest mb-2">PROCESS ANALYSIS</div>
              <div className="text-phosphor-mid text-xs leading-relaxed">{today.explanation}</div>
            </div>

            {/* Crowd distribution */}
            <div className="terminal-panel p-4">
              <div className="text-phosphor-dim text-xs tracking-widest mb-3">CROWD DISTRIBUTION</div>
              <div className="space-y-2">
                {today.availableActions.map(ac => {
                  const pct = crowdPct(ac.code);
                  if (pct === 0) return null;
                  return (
                    <div key={ac.code} className="flex items-center gap-3">
                      <div className="w-28 text-xs text-phosphor-dim">{ac.code}</div>
                      <div className="flex-1 h-1.5 bg-terminal-panel">
                        <div
                          className={`h-full transition-all duration-700 ${
                            ac.code === today.correctAction ? 'bg-paper-green' :
                            ac.code === selectedAction ? 'bg-phosphor' :
                            'bg-phosphor/30'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-8 text-xs text-right text-phosphor-dim tabular-nums">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* One decision, one commit: the tape keeps the same action territory as
          every arena checkpoint. */}
      {phase !== 'REVEAL' && !alreadySubmitted ? (
        <ActionZone
          note="RESULT REVEALED AT CLOSE · ONE SUBMISSION PER DAY"
          primary={{
            label: 'SUBMIT DAILY CALL',
            onClick: handleCommit,
            disabled: !selectedAction,
            disabledHint: 'SELECT YOUR CALL FIRST',
            keyHint: '[ENTER]',
          }}
        />
      ) : (
        <ActionZone
          note={`NEXT TAPE TOMORROW · ${state.profile.alphaXp} ALPHA XP TOTAL`}
          primary={{ label: 'BACK TO HUB', onClick: onBack, keyHint: '[ENTER]' }}
        />
      )}
    </div>
  );
}
