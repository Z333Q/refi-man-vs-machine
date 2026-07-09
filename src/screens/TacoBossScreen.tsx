import { useState } from 'react';

interface Props {
  onComplete: () => void;
  onBack: () => void;
}

type Round = 'shock' | 'negotiation' | 'pattern' | 'persistence' | 'reflexivity';

const ROUNDS: { id: Round; label: string; num: number }[] = [
  { id: 'shock', label: 'TARIFF SHOCK', num: 1 },
  { id: 'negotiation', label: 'NEGOTIATION SIGNAL', num: 2 },
  { id: 'pattern', label: 'PATTERN TRAP', num: 3 },
  { id: 'persistence', label: 'PERSISTENCE', num: 4 },
  { id: 'reflexivity', label: 'REFLEXIVITY', num: 5 },
];

function ShockRound({ onNext }: { onNext: () => void }) {
  const [decision, setDecision] = useState('');
  return (
    <div className="space-y-6">
      <div className="terminal-panel p-5 space-y-4">
        <div className="font-mono text-xs text-alert-amber tracking-widest border-b border-alert-amber/30 pb-3">
          POLICY ALERT // TARIFF SHOCK
        </div>
        <div className="font-mono text-xs text-phosphor leading-5">NEW TARIFF ACTION ANNOUNCED.</div>
        <div className="grid grid-cols-2 gap-4 font-mono text-xs">
          <div>
            <div className="text-phosphor-dim mb-1">SCOPE</div>
            <div className="text-phosphor">BROAD</div>
          </div>
          <div>
            <div className="text-phosphor-dim mb-1">IMPLEMENTATION</div>
            <div className="warning-value">UNCERTAIN</div>
          </div>
        </div>
      </div>

      <div className="terminal-panel p-5 space-y-4">
        <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
          MARKET RESPONSE
        </div>
        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
          {[
            { sym: 'SPX', val: '-5.8%', neg: true },
            { sym: 'SEMIS', val: '-10.2%', neg: true },
            { sym: 'INDUSTRIALS', val: '-7.1%', neg: true },
            { sym: 'GOLD', val: '+3.2%', neg: false },
            { sym: 'VOL (VIX)', val: '+41%', neg: false },
            { sym: 'BONDS', val: '+2.1%', neg: false },
          ].map(item => (
            <div key={item.sym} className="flex justify-between">
              <span className="text-phosphor-dim">{item.sym}</span>
              <span className={item.neg ? 'negative-value' : 'positive-value font-bold'}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="terminal-panel-deep p-4 space-y-3">
        <div className="font-mono text-xs text-phosphor-dim">DECISION REQUIRED</div>
        <div className="space-y-2">
          {[
            'REDUCE RISK BROADLY',
            'SELL CYCLICALS, HOLD DEFENSIVES',
            'BUY WEAKNESS — EXPECT REVERSAL',
            'INCREASE CASH TO 30%+',
            'HOLD — WAIT FOR CLARITY',
          ].map((opt, i) => (
            <button
              key={opt}
              onClick={() => setDecision(opt)}
              className={`w-full text-left font-mono text-xs px-3 py-2 border transition-colors ${
                decision === opt
                  ? 'border-phosphor/60 bg-phosphor/10 text-phosphor'
                  : 'border-phosphor/20 text-phosphor-dim hover:border-phosphor/40 hover:text-phosphor-mid'
              }`}
            >
              [{i + 1}] {opt}
            </button>
          ))}
        </div>
      </div>

      {decision && (
        <div className="flex justify-end animate-fade-in">
          <button onClick={onNext} className="cmd-button cmd-button-primary tracking-widest">
            [ COMMIT DECISION ]
          </button>
        </div>
      )}
    </div>
  );
}

function PatternRound({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div className="terminal-panel p-5 space-y-4 border-alert-amber/30 border">
        <div className="font-mono text-xs text-alert-amber tracking-widest border-b border-alert-amber/30 pb-3">
          PATTERN MEMORY ACTIVATED
        </div>
        <div className="space-y-3 font-mono text-sm text-phosphor leading-7">
          <div>PRIOR ROUND:</div>
          <div className="text-phosphor-mid text-xs ml-4">BUYING WEAKNESS WORKED</div>
          <div>CURRENT MARKET:</div>
          <div className="text-phosphor-mid text-xs ml-4">DIP BUYING ACCELERATING</div>
        </div>
      </div>

      <div className="terminal-panel-deep p-5 space-y-4">
        <div className="font-mono text-sm text-phosphor leading-7">
          QUESTION:
        </div>
        <div className="font-mono text-sm text-phosphor-hot terminal-glow leading-7">
          ARE YOU TRADING THE POLICY
          <br />
          OR THE MEMORY OF THE LAST POLICY?
        </div>
      </div>

      <div className="space-y-2">
        {['TRADE THE POLICY — NEW EVIDENCE ONLY', 'TRADE THE PATTERN — IT WORKED BEFORE', 'REDUCE SIZE — UNCERTAIN'].map((opt, i) => (
          <button
            key={opt}
            onClick={onNext}
            className="w-full text-left cmd-button tracking-wider text-xs"
          >
            [{i + 1}] {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReflexivityRound({ onComplete }: { onComplete: () => void }) {
  const [choice, setChoice] = useState('');

  return (
    <div className="space-y-6">
      <div className="terminal-panel p-5 space-y-4">
        <div className="font-mono text-xs text-phosphor-hot terminal-glow tracking-widest border-b border-phosphor/20 pb-3">
          FINAL ROUND // REFLEXIVITY TEST
        </div>
        <div className="space-y-2 font-mono text-xs text-phosphor-mid">
          <div>DIP BUYING: <span className="warning-value">ELEVATED</span></div>
          <div>VOL RESPONSE: <span className="text-phosphor">MUTED</span></div>
          <div>POSITIONING: <span className="warning-value">CROWDED</span></div>
          <div>POLICY PATH: <span className="negative-value">UNKNOWN</span></div>
        </div>
      </div>

      <div className="terminal-panel-deep p-4 space-y-2">
        <div className="font-mono text-xs text-phosphor-dim">YOUR PRIOR RULE</div>
        <div className="font-mono text-sm text-phosphor">BUY WEAKNESS AFTER POLICY SHOCK</div>
        <div className="font-mono text-xs text-phosphor-dim mt-2">DO YOU KEEP IT?</div>
      </div>

      <div className="space-y-2">
        {[
          { id: 'keep', label: 'KEEP RULE' },
          { id: 'modify', label: 'MODIFY RULE — SIZE DOWN 50%' },
          { id: 'suspend', label: 'SUSPEND RULE — ENVIRONMENT CHANGED' },
          { id: 'reduce', label: 'REDUCE POSITION SIZE — CROWD RISK HIGH' },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => setChoice(opt.id)}
            className={`w-full text-left font-mono text-xs px-3 py-2.5 border transition-colors ${
              choice === opt.id
                ? 'border-phosphor/60 bg-phosphor/10 text-phosphor'
                : 'border-phosphor/20 text-phosphor-dim hover:border-phosphor/40 hover:text-phosphor-mid'
            }`}
          >
            [ {opt.label} ]
          </button>
        ))}
      </div>

      {choice && (
        <div className="animate-fade-in space-y-4">
          <div className="terminal-panel p-4 font-mono text-xs text-phosphor-mid leading-5">
            PAST PATTERN &ne; GUARANTEED FUTURE.
            <br />
            ADAPTING YOUR RULE BASED ON CROWD POSITIONING IS META-LEVEL RISK MANAGEMENT.
          </div>
          <button onClick={onComplete} className="cmd-button cmd-button-primary w-full tracking-widest">
            [ COMPLETE FINAL BOSS ]
          </button>
        </div>
      )}
    </div>
  );
}

export default function TacoBossScreen({ onComplete, onBack }: Props) {
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const currentRound = ROUNDS[currentRoundIdx];

  const advanceRound = () => {
    if (currentRoundIdx < ROUNDS.length - 1) {
      setCurrentRoundIdx(i => i + 1);
    }
  };

  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between">
        <div className="font-mono text-xs text-phosphor-hot terminal-glow tracking-widest">
          TACO PROTOCOL // FINAL BOSS
        </div>
        <button onClick={onBack} className="font-mono text-xs text-phosphor-dim hover:text-phosphor">[ESC]</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {/* Round progress */}
          <div className="flex items-center gap-0 mb-8">
            {ROUNDS.map((round, i) => (
              <div key={round.id} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 border font-mono text-xs transition-all ${
                  i === currentRoundIdx
                    ? 'border-phosphor text-phosphor bg-phosphor/10'
                    : i < currentRoundIdx
                    ? 'border-phosphor/40 text-phosphor-dim bg-phosphor/5'
                    : 'border-phosphor/15 text-phosphor-dim/50'
                }`}>
                  <span>{i < currentRoundIdx ? '✓' : `${round.num}`}</span>
                  <span className="hidden lg:block">{round.label}</span>
                </div>
                {i < ROUNDS.length - 1 && (
                  <div className={`w-4 h-px ${i < currentRoundIdx ? 'bg-phosphor/40' : 'bg-phosphor/15'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left: Portrait strip */}
            <div className="col-span-1">
              <div className="terminal-panel p-4 space-y-4">
                <div className="font-mono text-xs text-phosphor-dim">ROUND {currentRound.num} OF 5</div>
                <div className="font-mono text-lg text-phosphor-hot terminal-glow">{currentRound.label}</div>

                <pre
                  className="font-mono text-phosphor-dim overflow-hidden"
                  style={{ fontSize: '6px', lineHeight: '1.0', letterSpacing: '-0.04em', whiteSpace: 'pre' }}
                >
{`     ........:::::.....
   ..:::://////::::::..
  .:////++++++++////:.
  |////==--------==///|
  |//=:..        .:=//|
  |/=:.   TACO   .:=/|
  ||=:.  PROTOCOL.:=||
  ||==:.         :==/||
  |\\++==-......-==++/|
   \\\\++++======++++//
    \\\\///+++++++///
      \\\\:::::://`}
                </pre>

                <div className="space-y-2 font-mono text-xs text-phosphor-dim">
                  <div className="border-t border-phosphor/20 pt-3">SCORE THIS ROUND</div>
                  <div className="flex justify-between">
                    <span>YOU</span>
                    <span className="text-phosphor">--</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MACHINE</span>
                    <span className="text-phosphor">--</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Round content */}
            <div className="col-span-2">
              {currentRound.id === 'shock' && <ShockRound onNext={advanceRound} />}
              {currentRound.id === 'negotiation' && (
                <div className="space-y-6">
                  <div className="terminal-panel p-5 space-y-4">
                    <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                      POLICY UPDATE
                    </div>
                    <div className="space-y-2 font-mono text-xs text-phosphor leading-6">
                      <div>NEGOTIATIONS CONTINUE.</div>
                      <div>IMPLEMENTATION PATH UNRESOLVED.</div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-phosphor-dim">MARKET EXPECTATION</div>
                      <div className="font-mono text-xs text-phosphor">REVERSAL PROBABILITY RISING</div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-phosphor-dim">YOUR CURRENT POSITION</div>
                      <div className="font-mono text-xs text-phosphor">DEFENSIVE</div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-phosphor-dim">MACHINE CURRENT POSITION</div>
                      <div className="font-mono text-xs text-phosphor-dim">HIDDEN</div>
                    </div>
                  </div>
                  <button onClick={advanceRound} className="cmd-button cmd-button-primary tracking-widest">
                    [ OPEN ORDER TICKET ]
                  </button>
                </div>
              )}
              {currentRound.id === 'pattern' && <PatternRound onNext={advanceRound} />}
              {currentRound.id === 'persistence' && (
                <div className="space-y-6">
                  <div className="terminal-panel p-5 space-y-4 border-risk-red/30 border">
                    <div className="font-mono text-xs negative-value tracking-widest border-b border-risk-red/30 pb-3">
                      PATTERN FAILURE DETECTED
                    </div>
                    <div className="space-y-3 font-mono text-sm text-phosphor leading-7">
                      <div>THE MARKET EXPECTED REVERSAL.</div>
                      <div>POLICY REMAINS ACTIVE.</div>
                      <div className="text-phosphor-mid text-xs">THIS PATH DID NOT FOLLOW THE SAME RESOLUTION STRUCTURE.</div>
                    </div>
                    <div className="font-mono text-sm text-phosphor-hot terminal-glow">REASSESS.</div>
                  </div>
                  <button onClick={advanceRound} className="cmd-button cmd-button-primary tracking-widest">
                    [ ADAPT POSITION ]
                  </button>
                </div>
              )}
              {currentRound.id === 'reflexivity' && <ReflexivityRound onComplete={onComplete} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
