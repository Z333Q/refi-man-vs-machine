import { useEffect, useState } from 'react';
import ActionZone from '../components/ui/ActionZone';

interface Props {
  onEnter: () => void;
}

const PREREQUISITES = [
  { label: 'COVID BLACK SWAN', status: 'PASSED' },
  { label: 'RECOVERY TRAP', status: 'PASSED' },
  { label: 'INFLATION SHIFT', status: 'PASSED' },
  { label: 'BANKING STRESS', status: 'PASSED' },
  { label: 'MACHINE SEASON', status: 'PASSED' },
  { label: 'BASKET WRITER', status: 'COMPLETE' },
  { label: 'POLICY WRITER', status: 'COMPLETE' },
  { label: 'BLIND GAUNTLET', status: 'PASSED' },
];

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

export default function TacoUnlockScreen({ onEnter }: Props) {
  const [phase, setPhase] = useState(0);
  const [asciiLines, setAsciiLines] = useState(0);

  const lines = ASCII_TRUMP.split('\n').filter(Boolean);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 1500);
    const t3 = setTimeout(() => setPhase(3), 2200);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

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
    <div className="terminal-screen min-h-screen flex flex-col">
      {phase >= 1 && (
        <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col justify-center px-4 sm:px-8 py-8 animate-fade-in">
          {/* Prerequisites */}
          <div className="mb-8">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-4">
              PREREQUISITES VERIFIED
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PREREQUISITES.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-phosphor text-xs">✓</span>
                  <span className="font-mono text-xs text-phosphor-dim">{item.label}</span>
                  <span className="font-mono text-xs text-phosphor ml-auto">{item.status}</span>
                </div>
              ))}
            </div>
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

      {/* The boss unlock only reveals itself once the sequence has played;
          the action keeps its territory and states why it is waiting. */}
      <ActionZone
        note="5 POLICY ROUNDS · DATES HIDDEN · OUTCOME UNKNOWN"
        primary={{
          label: 'ENTER FINAL BOSS',
          onClick: onEnter,
          disabled: phase < 3,
          disabledHint: 'VERIFYING PREREQUISITES',
          keyHint: '[ENTER]',
        }}
      />
    </div>
  );
}
