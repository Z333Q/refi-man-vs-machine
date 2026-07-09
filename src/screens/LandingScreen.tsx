import { useState, useEffect } from 'react';

interface Props {
  onEnter: () => void;
}

const TICKER_ITEMS = [
  { symbol: 'SPX', value: '-4.2%', neg: true },
  { symbol: 'VIX', value: '+18.7', neg: false },
  { symbol: 'GOLD', value: '+1.8%', neg: false },
  { symbol: 'OIL', value: '-8.1%', neg: true },
  { symbol: '10Y', value: '-21bp', neg: true },
  { symbol: 'USD', value: '+0.4%', neg: false },
];

const COMPARISON_DAYS = [
  { day: '00', humanVal: '$100,000', machineVal: '$100,000', humanStatus: 'STANDING BY', machineStatus: 'READY' },
  { day: '03', humanVal: '$98,420', machineVal: '$99,100', humanStatus: 'HOLDS', machineStatus: 'REDUCES RISK' },
  { day: '07', humanVal: '$91,820', machineVal: '$95,440', humanStatus: 'PANICS', machineStatus: 'HOLDS POLICY' },
  { day: '14', humanVal: '$87,200', machineVal: '$93,100', humanStatus: 'SELLS', machineStatus: 'STAGES RE-ENTRY' },
];

export default function LandingScreen({ onEnter }: Props) {
  const [frame, setFrame] = useState(0);
  const [hovered, setHovered] = useState<'human' | 'machine' | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % COMPARISON_DAYS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const current = COMPARISON_DAYS[frame];

  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="border-b border-phosphor/20 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-mono text-xs text-phosphor-mid tracking-widest">REFI ALPHA</span>
          <span className="font-mono text-xs text-phosphor-dim">v0.9.2-BETA</span>
        </div>
        <div className="flex items-center gap-6">
          {TICKER_ITEMS.map(item => (
            <span key={item.symbol} className="font-mono text-xs">
              <span className="text-phosphor-mid">{item.symbol} </span>
              <span className={item.neg ? 'negative-value' : 'positive-value'}>{item.value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center px-8 lg:px-16 py-12 gap-16 max-w-7xl mx-auto w-full">
        {/* Left */}
        <div className="flex-1 space-y-8">
          <div>
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-4">
              REFI.TRADING // HISTORICAL REGIME SIMULATION
            </div>
            <h1 className="font-mono text-5xl lg:text-6xl font-bold tracking-tight terminal-glow-strong leading-tight"
                style={{ color: '#79FFD7' }}>
              REFI<br />ALPHA
            </h1>
          </div>

          <div className="space-y-3">
            <div className="font-mono text-xl text-phosphor tracking-wider terminal-glow">
              MAN VS MACHINE
            </div>
            <div className="w-16 border-t border-phosphor/40" />
          </div>

          <div className="space-y-2 font-mono text-sm text-phosphor-mid leading-7">
            <div>THE MARKET ALREADY HAPPENED.</div>
            <div>YOU STILL DO NOT KNOW WHAT COMES NEXT.</div>
          </div>

          <div className="terminal-panel p-4 space-y-2">
            <div className="flex items-center gap-6 font-mono text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-phosphor" />
                <span className="text-phosphor-mid">$100,000 VIRTUAL CAPITAL</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-phosphor" />
                <span className="text-phosphor-mid">SAME DATA</span>
              </div>
            </div>
            <div className="flex items-center gap-6 font-mono text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-phosphor" />
                <span className="text-phosphor-mid">SAME START</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-phosphor" />
                <span className="text-phosphor-mid">NO HINDSIGHT</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onEnter}
              className="cmd-button cmd-button-primary font-mono text-sm tracking-widest px-8 py-3"
            >
              [ ENTER THE MARKET ]
            </button>
            <div className="font-mono text-xs text-phosphor-dim">
              NO ACCOUNT REQUIRED &mdash; THREE FREE DECISIONS
            </div>
          </div>
        </div>

        {/* Right: Live competition display */}
        <div className="w-80 lg:w-96 flex-shrink-0">
          <div className="terminal-panel p-5 space-y-5">
            <div className="font-mono text-xs text-phosphor-mid tracking-widest border-b border-phosphor/20 pb-3">
              LIVE ARENA PREVIEW
            </div>

            {/* Scoreboard */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`terminal-panel-deep p-4 space-y-3 cursor-default transition-all duration-150 ${hovered === 'human' ? 'border-phosphor/50' : ''}`}
                onMouseEnter={() => setHovered('human')}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="font-mono text-xs text-phosphor-dim tracking-widest">HUMAN</div>
                <div className="font-mono text-lg font-bold text-phosphor-hot terminal-glow">{current.humanVal}</div>
                <div className="font-mono text-xs text-phosphor-mid">DAY {current.day}</div>
                <div className="font-mono text-xs tracking-wider"
                     style={{ color: current.humanStatus === 'PANICS' || current.humanStatus === 'SELLS' ? '#D94C4C' : '#0A8F68' }}>
                  {current.humanStatus}
                </div>
              </div>

              <div
                className={`terminal-panel-deep p-4 space-y-3 cursor-default transition-all duration-150 ${hovered === 'machine' ? 'border-phosphor/50' : ''}`}
                onMouseEnter={() => setHovered('machine')}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="font-mono text-xs text-phosphor-dim tracking-widest">MACHINE</div>
                <div className="font-mono text-lg font-bold text-phosphor-hot terminal-glow">{current.machineVal}</div>
                <div className="font-mono text-xs text-phosphor-mid">DAY {current.day}</div>
                <div className="font-mono text-xs text-phosphor tracking-wider">{current.machineStatus}</div>
              </div>
            </div>

            {hovered === 'human' && (
              <div className="font-mono text-xs text-phosphor-mid italic border-t border-phosphor/20 pt-3 animate-fade-in">
                YOU HAVE OPINIONS.
              </div>
            )}
            {hovered === 'machine' && (
              <div className="font-mono text-xs text-phosphor-mid italic border-t border-phosphor/20 pt-3 animate-fade-in">
                IT HAS A PROCESS.
              </div>
            )}
            {!hovered && (
              <div className="border-t border-phosphor/20 pt-3 space-y-1">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-phosphor-dim">PROGRESS</span>
                  <span className="text-phosphor-mid">DAY {current.day} / 22</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${(frame / 3) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Statement block */}
          <div className="mt-4 terminal-panel p-4 space-y-3">
            <div className="font-mono text-xs text-phosphor-dim">WHAT REFI ALPHA TEACHES</div>
            <div className="space-y-2 font-mono text-xs text-phosphor-mid leading-5">
              <div>BEATING A BENCHMARK ONCE IS POSSIBLE.</div>
              <div>DOING IT REPEATEDLY IS HARD.</div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'ARENAS', value: '8' },
              { label: 'CHECKPOINTS', value: '100+' },
              { label: 'PLAYER PASS', value: '18.4%' },
            ].map(stat => (
              <div key={stat.label} className="terminal-panel-deep p-3 text-center">
                <div className="font-mono text-base font-bold text-phosphor-hot terminal-glow">{stat.value}</div>
                <div className="font-mono text-xs text-phosphor-dim mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="border-t border-phosphor/20 px-6 py-2 flex items-center gap-6">
        <span className="font-mono text-xs text-phosphor-dim">
          <span className="nav-key">F1</span> ARENAS
          <span className="nav-key ml-3">F9</span> LEADERBOARD
          <span className="nav-key ml-3">F10</span> HELP
        </span>
      </div>
    </div>
  );
}
