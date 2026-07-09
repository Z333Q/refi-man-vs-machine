import { useState } from 'react';

interface Props {
  onContinue: () => void;
}

type Tab = 'timeline' | 'analysis' | 'comparison' | 'profile';

const TIMELINE = [
  { cp: 'CP01', action: 'HOLD', quality: 'HIGH', result: '+0.2', score: 72 },
  { cp: 'CP02', action: 'HOLD', quality: 'HIGH', result: '-0.8', score: 74 },
  { cp: 'CP03', action: 'REDUCE 10%', quality: 'MEDIUM', result: '+1.1', score: 76 },
  { cp: 'CP04', action: 'REDUCE 15%', quality: 'HIGH', result: '+1.8', score: 79 },
  { cp: 'CP05', action: 'HOLD', quality: 'MEDIUM', result: '-2.1', score: 75 },
  { cp: 'CP06', action: 'SELL TECH', quality: 'LOW', result: '-3.4', score: 68 },
  { cp: 'CP07', action: 'REDUCE FIN.', quality: 'MEDIUM', result: '+0.8', score: 73 },
];

export default function AutopsyScreen({ onContinue }: Props) {
  const [tab, setTab] = useState<Tab>('timeline');

  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">
          REFI ALPHA // POST-RUN AUTOPSY
        </div>
        <div className="font-mono text-xs text-phosphor-dim">COVID BLACK SWAN // RUN ID: C19-8F2A-991C</div>
      </div>

      {/* Tabs */}
      <div className="border-b border-phosphor/20 px-6 flex gap-0">
        {[
          { id: 'timeline' as Tab, label: 'TIMELINE' },
          { id: 'analysis' as Tab, label: 'DECISIONS' },
          { id: 'comparison' as Tab, label: 'VS MACHINE' },
          { id: 'profile' as Tab, label: 'ALPHA PROFILE' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`font-mono text-xs px-4 py-3 border-b-2 transition-colors ${
              tab === t.id
                ? 'border-phosphor text-phosphor'
                : 'border-transparent text-phosphor-dim hover:text-phosphor-mid'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        {tab === 'timeline' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest">DECISION TIMELINE</div>
            <div className="space-y-1">
              {TIMELINE.map((item, i) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b border-phosphor/10 hover:bg-phosphor/5 transition-colors">
                  <div className="font-mono text-xs text-phosphor-dim w-10">{item.cp}</div>
                  <div className="flex-1 font-mono text-xs text-phosphor">{item.action}</div>
                  <div className={`font-mono text-xs w-16 text-right ${
                    item.quality === 'HIGH' ? 'text-phosphor' :
                    item.quality === 'LOW' ? 'negative-value' :
                    'warning-value'
                  }`}>
                    {item.quality}
                  </div>
                  <div className={`font-mono text-xs w-12 text-right ${
                    parseFloat(item.result) > 0 ? 'positive-value' : 'negative-value'
                  }`}>
                    {item.result}
                  </div>
                  <div className="w-24">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 progress-bar-track h-2">
                        <div
                          className="progress-bar-fill h-full"
                          style={{
                            width: `${item.score}%`,
                            background: item.score >= 75 ? '#0CD4A0' : item.score >= 60 ? '#D6A647' : '#D94C4C',
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs text-phosphor-dim">{item.score}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'analysis' && (
          <div className="max-w-4xl mx-auto grid grid-cols-2 gap-6">
            <div className="terminal-panel p-5 space-y-4">
              <div className="font-mono text-xs text-phosphor tracking-widest border-b border-phosphor/20 pb-2">
                BEST DECISION
              </div>
              <div className="space-y-2">
                <div className="font-mono text-sm text-phosphor-hot">CHECKPOINT 04</div>
                <div className="font-mono text-xs text-phosphor-mid">STAGED RISK REDUCTION</div>
              </div>
              <div className="space-y-2">
                <div className="font-mono text-xs text-phosphor-dim">WHY IT WORKED</div>
                <div className="font-mono text-xs text-phosphor leading-5">
                  YOU REDUCED EXPOSURE PROPORTIONAL TO EVIDENCE STRENGTH.
                  YOU DID NOT OVER-REACT OR WAIT TOO LONG.
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-mono text-xs text-phosphor-dim">PROCESS QUALITY</div>
                <div className="font-mono text-xs text-phosphor border border-phosphor/40 px-2 py-0.5">HIGH</div>
              </div>
            </div>

            <div className="terminal-panel p-5 space-y-4">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2">
                WORST DECISION
              </div>
              <div className="space-y-2">
                <div className="font-mono text-sm text-phosphor-hot">CHECKPOINT 06</div>
                <div className="font-mono text-xs text-phosphor-mid">FULL EXIT FROM TECHNOLOGY</div>
              </div>
              <div className="space-y-2">
                <div className="font-mono text-xs text-phosphor-dim">PROCESS ISSUE</div>
                <div className="font-mono text-xs negative-value leading-5">
                  ACTION SIZE EXCEEDED THESIS CONFIDENCE.
                </div>
                <div className="font-mono text-xs text-phosphor leading-5">
                  MISSED 8.4% OF SUBSEQUENT RECOVERY.
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-mono text-xs text-phosphor-dim">PROCESS QUALITY</div>
                <div className="font-mono text-xs negative-value border border-risk-red/40 px-2 py-0.5">LOW</div>
              </div>
            </div>

            <div className="terminal-panel p-5 col-span-2 space-y-3">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2">
                BEHAVIORAL FLAGS DETECTED
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { flag: 'ACTION_BIAS', count: 3, severity: 'medium' },
                  { flag: 'CONFIDENCE_SIZE_MISMATCH', count: 2, severity: 'high' },
                  { flag: 'THESIS_CONTRADICTION', count: 1, severity: 'high' },
                  { flag: 'ANCHORING', count: 2, severity: 'medium' },
                  { flag: 'RECENCY_BIAS', count: 1, severity: 'low' },
                  { flag: 'ADAPTATION_EVENT', count: 3, severity: 'positive' },
                ].map(item => (
                  <div key={item.flag} className={`terminal-panel-deep p-3 space-y-1 border-l-2 ${
                    item.severity === 'positive' ? 'border-phosphor' :
                    item.severity === 'high' ? 'border-risk-red' :
                    'border-alert-amber'
                  }`}>
                    <div className={`font-mono text-xs ${
                      item.severity === 'positive' ? 'text-phosphor' :
                      item.severity === 'high' ? 'negative-value' :
                      'warning-value'
                    }`}>{item.flag}</div>
                    <div className="font-mono text-xs text-phosphor-dim">×{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'comparison' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="grid grid-cols-2 gap-4 font-mono text-xs">
              <div className="terminal-panel p-4 space-y-3">
                <div className="text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2">YOU</div>
                <div className="space-y-2">
                  {[
                    { label: 'RETURN', value: '+12.4%' },
                    { label: 'MAX DD', value: '-14.2%' },
                    { label: 'VOLATILITY', value: '22.8%' },
                    { label: 'TURNOVER', value: '38.4%' },
                    { label: 'TRADE COUNT', value: '16' },
                    { label: 'REFI SCORE', value: '73' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-phosphor-dim">{row.label}</span>
                      <span className="text-phosphor">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="terminal-panel p-4 space-y-3">
                <div className="text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2">MACHINE</div>
                <div className="space-y-2">
                  {[
                    { label: 'RETURN', value: '+10.1%' },
                    { label: 'MAX DD', value: '-9.8%' },
                    { label: 'VOLATILITY', value: '17.2%' },
                    { label: 'TURNOVER', value: '18.6%' },
                    { label: 'TRADE COUNT', value: '7' },
                    { label: 'REFI SCORE', value: '82' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-phosphor-dim">{row.label}</span>
                      <span className="text-phosphor">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="terminal-panel p-5 space-y-4">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                COMPARATIVE ANALYSIS
              </div>
              <div className="space-y-3 font-mono text-sm text-phosphor leading-7">
                <div>YOU PICKED BETTER ENTRY POINTS.</div>
                <div>THE MACHINE MANAGED EXPOSURE BETTER.</div>
                <div className="text-phosphor-mid text-xs mt-2">
                  YOUR GOOD DECISIONS ADDED 11.2 SCORE POINTS.
                  <br />
                  YOUR POOR DECISIONS REMOVED 14.7.
                </div>
              </div>
              <div className="border-t border-phosphor/20 pt-4 font-mono text-xs text-phosphor-dim leading-5">
                REFI IS BUILT AROUND THIS GAP: GOOD THESIS, CONSISTENT EXECUTION.
              </div>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="terminal-panel p-5 space-y-4">
              <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-3">
                ALPHA PROFILE UPDATE // +7 DECISIONS
              </div>
              <div className="space-y-3">
                {[
                  { dim: 'STOCK SELECTION', score: 81, delta: '+2' },
                  { dim: 'POSITION SIZING', score: 43, delta: '-4' },
                  { dim: 'LOSS CONTROL', score: 76, delta: '+1' },
                  { dim: 'RE-ENTRY DISCIPLINE', score: 38, delta: '-6' },
                  { dim: 'REGIME ADAPTATION', score: 84, delta: '+5' },
                  { dim: 'RULE ADHERENCE', score: 47, delta: '-2' },
                ].map(item => (
                  <div key={item.dim} className="space-y-1">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="text-phosphor-dim">{item.dim}</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${item.delta.startsWith('+') ? 'positive-value' : 'negative-value'}`}>
                          {item.delta}
                        </span>
                        <span className="text-phosphor w-8 text-right">{item.score}</span>
                      </div>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${item.score}%`,
                          background: item.score >= 70 ? '#0CD4A0' : item.score >= 50 ? '#D6A647' : '#D94C4C',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="terminal-panel-deep p-4 font-mono text-xs space-y-2">
              <div className="text-phosphor-dim tracking-widest mb-3">PATTERN DETECTED</div>
              <div className="text-phosphor leading-5">YOU IDENTIFY REGIME CHANGE WELL.</div>
              <div className="text-phosphor leading-5">YOU OVERSIZE HIGH-CONVICTION DECISIONS.</div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-phosphor/20 px-6 py-4 flex items-center justify-between">
        <div className="font-mono text-xs text-phosphor-dim">
          REFI IS BUILT AROUND THIS GAP: GOOD THESIS, CONSISTENT EXECUTION.
        </div>
        <button onClick={onContinue} className="cmd-button cmd-button-primary tracking-widest">
          [ CONTINUE ]
        </button>
      </div>
    </div>
  );
}
