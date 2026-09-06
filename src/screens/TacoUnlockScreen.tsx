import ActionZone, { SecondaryAction } from '../components/ui/ActionZone';
import { useEffect, useMemo, useState } from 'react';
import { tacoRequirements, tacoUnlocked, tacoNextRequirement } from '../lib/progressionLaw';
import { readTacoEvidence } from '../lib/tacoEvidence';

interface Props {
  onEnter: () => void;
  onBack: () => void;
}

// The prerequisites used to be a fixture of eight PASSED strings that no code
// checked, and the screen was reachable by locking a basket. Every line below
// is now read from the player's records (owner ruling 2026-09-06).

const ASCII_TRUMP = `
                   ........:::::::::::::::........
              ....::::::////////////////::::::....
           ...:::://////++++++++++++++//////::::...
         ..:::////++++++==============++++++////:::..
       ..::///++++====----------------====++++///::..
      .::///+++===----::::::::::::::::----===+++///::.
     .:://+++==---:::................:::---==+++//::.
     :://++==--::......            ......::--==++//::
     ://++==--:....                    .....:--==++//:
     //++==--:...     TACO PROTOCOL      ...:--==++//
     \\++==--:...                          ...:--==++/
     |\\+=---:...    ___   ___   ___    ....:---=+//|
      |\\+==--...  _|   | |   | |   |_  ...:--=+//|
      |/++==-:.  | |   | |   | |   | | .:.-==++/|
      //++==--:   |_|___| |___| |___|   :--==++//
     ://++==---:.                    ..:---==++//:
    .://+++===----:::..............:::----===+++//::.
   ..::////++++=======-----------======++++////:::..
    ...:::://////++++++++++++++++++++//////::::...
        ....::::::::///////////////////::::....
              ..........::::::::::..........
`;

export default function TacoUnlockScreen({ onEnter, onBack }: Props) {
  const [phase, setPhase] = useState(0);
  const [asciiLines, setAsciiLines] = useState(0);

  const evidence = useMemo(() => readTacoEvidence(), []);
  const requirements = useMemo(() => tacoRequirements(evidence), [evidence]);
  const unlocked = tacoUnlocked(evidence);
  const next = tacoNextRequirement(evidence);

  const lines = ASCII_TRUMP.split('\n').filter(Boolean);

  useEffect(() => {
    // The boss reveal plays only for a player who has earned it. Locked, the
    // screen stops at the list and says what is still open.
    const t1 = setTimeout(() => setPhase(1), 500);
    if (!unlocked) return () => clearTimeout(t1);
    const t2 = setTimeout(() => setPhase(2), 1500);
    const t3 = setTimeout(() => setPhase(3), 2200);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [unlocked]);

  useEffect(() => {
    if (phase < 2) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setAsciiLines(i);
      if (i >= lines.length) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [phase, lines.length]);

  return (
    <div className="terminal-screen min-h-screen flex flex-col items-center justify-center">
      {phase >= 1 && (
        <div className="max-w-5xl w-full px-8 animate-fade-in">
          {/* Prerequisites */}
          <div className="mb-8">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-4">
              {unlocked ? 'PREREQUISITES VERIFIED' : 'PREREQUISITES'}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="taco-prerequisites">
              {requirements.map(item => (
                <div key={item.key} className="flex items-center gap-2" data-met={item.met ? '1' : '0'}>
                  <span className={`text-xs ${item.met ? 'text-phosphor' : 'text-phosphor-dim'}`}>{item.met ? '✓' : '○'}</span>
                  <span className="font-mono text-xs text-phosphor-dim">{item.label}</span>
                  <span className={`font-mono text-xs ml-auto ${item.met ? 'text-phosphor' : 'text-alert-amber'}`}>
                    {item.met ? 'DONE' : 'OPEN'}
                  </span>
                </div>
              ))}
            </div>
            {!unlocked && next && (
              <div className="mt-6 border-t border-phosphor/20 pt-6 font-mono text-xs space-y-2" data-testid="taco-locked">
                <div className="text-alert-amber tracking-widest">FINAL BOSS LOCKED</div>
                <div className="text-phosphor-mid">NEXT: {next.label}</div>
                <div className="text-phosphor-dim leading-5">
                  THE MARKET THINKS IT KNOWS THE PATTERN. FINISH THE PROCESS FIRST.
                </div>
              </div>
            )}
          </div>

          {phase >= 2 && (
            <div className="border-t border-phosphor/20 pt-8 mb-8 animate-fade-in">
              <div className="font-mono text-xs text-alert-amber tracking-widest mb-4 animate-[cursorBlink_0.5s_steps(1,end)_3]">
                UNKNOWN POLICY SIGNAL DETECTED
              </div>
              <div className="space-y-2 font-mono text-xs text-phosphor-mid">
                <div>MARKET RESPONSE MODEL: <span className="warning-value">UNSTABLE</span></div>
                <div>PATTERN DETECTED:</div>
                <div className="ml-4 space-y-0.5 text-phosphor">
                  <div>THREAT</div>
                  <div>SELL-OFF</div>
                  <div>NEGOTIATION</div>
                  <div>REVERSAL</div>
                </div>
                <div>PATTERN CONFIDENCE: <span className="warning-value">DANGEROUSLY HIGH</span></div>
              </div>
            </div>
          )}

          {phase >= 2 && (
            <div className="border-t border-phosphor/20 pt-8 animate-fade-in">
              <div className="grid grid-cols-2 gap-8 items-start">
                {/* ASCII portrait */}
                <div className="overflow-hidden">
                  <pre
                    className="font-mono text-phosphor-dim"
                    style={{ fontSize: '7px', lineHeight: '1.0', letterSpacing: '-0.04em', whiteSpace: 'pre' }}
                  >
                    {lines.slice(0, asciiLines).join('\n')}
                  </pre>
                </div>

                {/* Boss intro */}
                {phase >= 3 && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-3">FINAL BOSS UNLOCKED</div>
                      <h1 className="font-mono text-4xl font-bold text-phosphor-hot terminal-glow-strong leading-tight">
                        TACO<br />PROTOCOL
                      </h1>
                    </div>

                    <div className="terminal-panel p-4 space-y-2">
                      <div className="font-mono text-sm text-phosphor leading-6">TRUMP ALWAYS CHICKENS OUT?</div>
                      <div className="font-mono text-xs text-phosphor-dim">THE QUESTION MARK MATTERS.</div>
                    </div>

                    <div className="space-y-2 font-mono text-xs text-phosphor-mid leading-5">
                      <div>5 POLICY ROUNDS</div>
                      <div>DATES HIDDEN</div>
                      <div>EPISODES MIXED</div>
                      <div>PATTERN MEMORY ENABLED</div>
                      <div>POLICY OUTCOME UNKNOWN</div>
                    </div>

                    <div className="terminal-panel-deep p-4 space-y-2">
                      <div className="font-mono text-xs text-phosphor leading-6">THE LAST DIP WAS BOUGHT.</div>
                      <div className="font-mono text-xs text-phosphor leading-6">THE LAST THREAT WAS SOFTENED.</div>
                      <div className="font-mono text-xs text-phosphor leading-6">THE MARKET REMEMBERS.</div>
                      <div className="font-mono text-xs text-phosphor-mid mt-2">DO YOU?</div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* The unlock sequence plays above; the action keeps its territory
          throughout and says what it is waiting for. */}
      <ActionZone
        note={unlocked ? '5 POLICY ROUNDS · DATES HIDDEN · OUTCOME UNKNOWN' : `${requirements.filter(r => r.met).length} / ${requirements.length} PREREQUISITES MET`}
        primary={{
          label: unlocked ? 'ENTER FINAL BOSS' : 'LOCKED',
          onClick: onEnter,
          disabled: !unlocked || phase < 3,
          disabledHint: !unlocked && next ? `NEXT: ${next.label}` : 'VERIFYING PREREQUISITES',
          keyHint: '[ENTER]',
        }}
        secondaryLeft={<SecondaryAction label="Arena map" onClick={onBack} />}
      />
    </div>
  );
}
