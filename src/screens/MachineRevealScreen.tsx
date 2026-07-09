import { useState, useEffect } from 'react';

interface Props {
  onContinue: () => void;
}

export default function MachineRevealScreen({ onContinue }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setRevealed(true), 800);
    const t2 = setTimeout(() => setShowAnalysis(true), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">
          REFI ALPHA // MACHINE REVEAL // CHECKPOINT 07
        </div>
        <div className="font-mono text-xs text-phosphor-dim">
          ARENA: COVID BLACK SWAN
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-8 py-10">
        <div className="max-w-4xl w-full space-y-6">
          {/* Reveal header */}
          <div className="text-center space-y-2">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest">DECISION COMPARISON</div>
            <div className="font-mono text-xl text-phosphor-hot terminal-glow">CHECKPOINT 07 COMPLETE</div>
          </div>

          {/* Split comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Human */}
            <div className="terminal-panel p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs text-phosphor-dim tracking-widest">HUMAN DECISION</div>
                <div className="font-mono text-xs text-phosphor border border-phosphor/30 px-2 py-0.5">YOU</div>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2 py-1.5 border-b border-phosphor/10">
                  <span className="negative-value">▼</span>
                  <span className="text-phosphor">REDUCED FINANCIALS</span>
                  <span className="text-phosphor-dim ml-auto">12% → 7%</span>
                </div>
                <div className="flex items-center gap-2 py-1.5 border-b border-phosphor/10">
                  <span className="positive-value">▲</span>
                  <span className="text-phosphor">ADDED HEALTHCARE</span>
                  <span className="text-phosphor-dim ml-auto">4% → 9%</span>
                </div>
                <div className="flex items-center gap-2 py-1.5">
                  <span className="text-phosphor-dim">◆</span>
                  <span className="text-phosphor">CASH +2%</span>
                  <span className="text-phosphor-dim ml-auto">22% → 24%</span>
                </div>
              </div>

              <div className="terminal-panel-deep p-3 space-y-2">
                <div className="font-mono text-xs text-phosphor-dim">PRIMARY THESIS</div>
                <div className="font-mono text-xs text-phosphor leading-5">DETERIORATING FUNDAMENTALS</div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-xs text-phosphor-dim">CONFIDENCE</div>
                  <div className="flex-1 progress-bar-track h-2">
                    <div className="progress-bar-fill h-full" style={{ width: '70%' }} />
                  </div>
                  <div className="font-mono text-xs text-phosphor">70%</div>
                </div>
              </div>
            </div>

            {/* Machine */}
            <div className={`terminal-panel p-5 space-y-4 transition-all duration-500 ${revealed ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs text-phosphor-dim tracking-widest">MACHINE DECISION</div>
                <div className="font-mono text-xs text-phosphor-dim border border-phosphor/20 px-2 py-0.5">
                  CRISIS-R1
                </div>
              </div>

              {revealed ? (
                <>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex items-center gap-2 py-1.5 border-b border-phosphor/10">
                      <span className="text-phosphor-dim">◆</span>
                      <span className="text-phosphor">HELD FINANCIALS</span>
                      <span className="text-phosphor-dim ml-auto">UNCHANGED</span>
                    </div>
                    <div className="flex items-center gap-2 py-1.5 border-b border-phosphor/10">
                      <span className="negative-value">▼</span>
                      <span className="text-phosphor">REDUCED TECH CONCENTRATION</span>
                      <span className="text-phosphor-dim ml-auto">14% → 9%</span>
                    </div>
                    <div className="flex items-center gap-2 py-1.5">
                      <span className="text-phosphor-dim">◆</span>
                      <span className="text-phosphor">CASH UNCHANGED</span>
                      <span className="text-phosphor-dim ml-auto">22%</span>
                    </div>
                  </div>

                  <div className="terminal-panel-deep p-3 space-y-2">
                    <div className="font-mono text-xs text-phosphor-dim">POLICY RESPONSE</div>
                    <div className="font-mono text-xs text-phosphor leading-5">CORRELATION RISK ABOVE THRESHOLD</div>
                    <div className="font-mono text-xs text-phosphor-mid leading-5">PORTFOLIO VOLATILITY ELEVATED</div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <div className="font-mono text-sm text-phosphor-dim animate-[cursorBlink_1s_steps(1,end)_infinite]">
                    COMPUTING...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analysis */}
          {showAnalysis && (
            <div className="terminal-panel p-5 space-y-4 animate-fade-in">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                SYSTEM ANALYSIS
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="space-y-2">
                  <div className="text-phosphor-dim">YOU REACTED TO:</div>
                  <div className="text-phosphor leading-5">SECTOR-SPECIFIC RISK</div>
                  <div className="text-phosphor-dim">FINANCIALS DETERIORATING</div>
                </div>
                <div className="space-y-2">
                  <div className="text-phosphor-dim">MACHINE REACTED TO:</div>
                  <div className="text-phosphor leading-5">PORTFOLIO-WIDE CORRELATION</div>
                  <div className="text-phosphor-dim">CROSS-ASSET RISK CLUSTER</div>
                </div>
              </div>

              <div className="border-t border-phosphor/20 pt-4">
                <div className="font-mono text-sm text-phosphor-mid leading-7">
                  YOU REDUCED A SECTOR THAT WAS FALLING.
                  <br />
                  THE MACHINE REDUCED WHAT WAS MOST CORRELATED.
                  <br />
                  <span className="text-phosphor">RESULT NOT YET KNOWN.</span>
                </div>
              </div>

              <div className="terminal-panel-deep p-3 font-mono text-xs text-phosphor-dim leading-5">
                NOTE: THE MACHINE DOES NOT KNOW THE OUTCOME BEFORE ACTING.
                IT USES THE SAME INFORMATION AVAILABLE AT THIS SIMULATION TIMESTAMP.
              </div>
            </div>
          )}

          {showAnalysis && (
            <div className="flex justify-end animate-fade-in">
              <button onClick={onContinue} className="cmd-button cmd-button-primary tracking-widest">
                [ VIEW CHECKPOINT SCORE ]
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
