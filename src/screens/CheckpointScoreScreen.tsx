import { ResultCategoryLabel } from '../components/ResultCategoryLabel';
import ActionZone, { SecondaryAction } from '../components/ui/ActionZone';

interface Props {
  onContinue: () => void;
  onViewAutopsy: () => void;
  result: 'active' | 'victory' | 'defeat';
}

function ScoreRow({ label, human, machine }: { label: string; human: string; machine: string }) {
  const humanNum = parseFloat(human.replace('%', '').replace('+', ''));
  const machineNum = parseFloat(machine.replace('%', '').replace('+', ''));
  const humanBetter = humanNum > machineNum;

  return (
    <tr className="border-b border-phosphor/10">
      <td className="py-2.5 font-mono text-xs text-phosphor-dim">{label}</td>
      <td className={`py-2.5 text-right font-mono text-xs ${humanBetter ? 'text-phosphor font-bold' : 'text-phosphor-mid'}`}>
        {human}
      </td>
      <td className={`py-2.5 text-right font-mono text-xs ${!humanBetter ? 'text-phosphor font-bold' : 'text-phosphor-mid'}`}>
        {machine}
      </td>
    </tr>
  );
}

export default function CheckpointScoreScreen({ onContinue, onViewAutopsy, result }: Props) {
  const isVictory = result === 'victory';
  const isContinue = result === 'active';

  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between pr-16 sm:pr-6">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">
          REFI ALPHA // {isContinue ? 'CHECKPOINT 07 COMPLETE' : isVictory ? 'ARENA COMPLETE // MACHINE BEATEN' : 'ARENA COMPLETE'}
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-8 py-10">
        <div className="max-w-3xl w-full space-y-6">
          {/* Score table */}
          <div className="terminal-panel p-5 space-y-4">
            {/* Human-vs-machine scores are a simulation of player decisions,
                not live performance (§62 / §3.4 gate 1). */}
            <ResultCategoryLabel category="SIMULATION_RESULT" />
            {isContinue && (
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                CHECKPOINT 07 OF 22
              </div>
            )}

            <table className="w-full">
              <thead>
                <tr className="border-b border-phosphor/25">
                  <th className="text-left font-mono text-xs text-phosphor-dim py-2 font-normal"></th>
                  <th className="text-right font-mono text-xs text-phosphor-dim py-2 font-normal tracking-wider">HUMAN</th>
                  <th className="text-right font-mono text-xs text-phosphor-dim py-2 font-normal tracking-wider">MACHINE</th>
                </tr>
              </thead>
              <tbody>
                <ScoreRow label="RETURN" human="-1.8%" machine="-2.1%" />
                <ScoreRow label="MAX DRAWDOWN" human="-8.6%" machine="-6.9%" />
                <ScoreRow label="VOLATILITY" human="24.1%" machine="19.4%" />
                <ScoreRow label="TURNOVER" human="23.6%" machine="11.2%" />
                <ScoreRow label="REGIME ADAPTATION" human="71" machine="78" />
              </tbody>
              <tfoot>
                <tr className="border-t border-phosphor/25">
                  <td className="pt-3 font-mono text-sm text-phosphor-dim">CHECKPOINT SCORE</td>
                  <td className={`pt-3 text-right font-mono text-2xl font-bold terminal-glow ${isContinue && 73 < 79 ? 'text-phosphor' : 'text-phosphor-hot'}`}>
                    {isVictory ? '86' : '73'}
                  </td>
                  <td className={`pt-3 text-right font-mono text-2xl font-bold terminal-glow ${isContinue && 79 > 73 ? 'text-phosphor-mid' : 'text-phosphor'}`}>
                    {isVictory ? '82' : '79'}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Score gap */}
            <div className={`border rounded-panel p-3 font-mono text-xs text-center ${
              isVictory ? 'border-phosphor/40 text-phosphor' : 'border-phosphor/20 text-phosphor-mid'
            }`}>
              {isVictory ? 'MACHINE BEATEN BY 4 POINTS' : isContinue ? 'MACHINE LEADS BY 6' : 'MACHINE LEADS BY 8'}
            </div>
          </div>

          {/* Teaching message */}
          <div className="terminal-panel-deep p-5 space-y-3">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
              {isVictory ? 'RESULT' : 'ANALYSIS'}
            </div>
            {isVictory ? (
              <div className="space-y-2">
                <div className="font-mono text-sm text-phosphor leading-6">YOUR RETURN WAS BETTER.</div>
                <div className="font-mono text-sm text-phosphor leading-6">YOUR REGIME ADAPTATION WAS STRONGER.</div>
                <div className="font-mono text-sm text-phosphor-mid leading-6 mt-4">
                  MACHINE BEAT RATE: 1 WIN / 1 ATTEMPT = 100%
                </div>
                <div className="font-mono text-xs text-phosphor-dim mt-2">
                  SAMPLE SIZE: 1. ONE WIN IS NOT CONSISTENCY.
                </div>
              </div>
            ) : isContinue ? (
              <div className="space-y-2">
                <div className="font-mono text-sm text-phosphor leading-6">YOUR RETURN WAS BETTER.</div>
                <div className="font-mono text-sm text-phosphor-mid leading-6">YOUR RISK EFFICIENCY WAS WORSE.</div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="font-mono text-sm text-phosphor-mid leading-6">YOUR MARKET VIEW WAS OFTEN RIGHT.</div>
                <div className="font-mono text-sm text-phosphor leading-6">THE MACHINE WAS MORE CONSISTENT.</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  {[
                    { label: 'PRIMARY GAP', value: 'RE-ENTRY DISCIPLINE' },
                    { label: 'SECONDARY GAP', value: 'TURNOVER' },
                    { label: 'STRONGEST AREA', value: 'LOSS CONTROL' },
                  ].map(item => (
                    <div key={item.label} className="terminal-panel p-3 space-y-1">
                      <div className="font-mono text-xs text-phosphor-dim">{item.label}</div>
                      <div className="font-mono text-xs text-phosphor">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Marketing line */}
          <div className="font-mono text-xs text-phosphor-dim text-center leading-6">
            {isVictory
              ? 'REFI DOES NOT REMOVE JUDGMENT. IT SYSTEMATIZES EXECUTION.'
              : 'IDEAS ARE EASY. CONSISTENCY IS HARD.'}
          </div>

        </div>
      </div>

      <ActionZone
        note="THIS RESULT IS ALREADY PART OF YOUR RUN RECORD."
        primary={{
          label: isContinue
            ? 'NEXT CHECKPOINT'
            : isVictory
              ? 'ENTER NEXT ARENA'
              : 'RETRY HIDDEN PATH',
          onClick: onContinue,
          keyHint: '[ENTER]',
        }}
        secondaryRight={<SecondaryAction label="VIEW AUTOPSY" onClick={onViewAutopsy} />}
      />
    </div>
  );
}
