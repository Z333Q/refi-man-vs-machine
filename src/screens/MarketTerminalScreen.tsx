import { useState } from 'react';

interface Props {
  onAdvance: () => void;
  onBack: () => void;
}

type Panel = 'none' | 'order' | 'news' | 'risk' | 'journal';

const POSITIONS = [
  { symbol: 'SPY', weight: '18.0%', pnl: '-8.2%', risk: '21.4%', neg: true },
  { symbol: 'XLK', weight: '14.0%', pnl: '-7.5%', risk: '18.2%', neg: true },
  { symbol: 'XLF', weight: '12.0%', pnl: '-11.8%', risk: '19.9%', neg: true },
  { symbol: 'XLP', weight: '10.0%', pnl: '-2.1%', risk: '7.1%', neg: true },
  { symbol: 'IEF', weight: '10.5%', pnl: '+3.8%', risk: '3.4%', neg: false },
  { symbol: 'XLV', weight: '8.0%', pnl: '-4.1%', risk: '8.8%', neg: true },
  { symbol: 'GLD', weight: '6.0%', pnl: '+1.2%', risk: '2.9%', neg: false },
];

const NEWS_ITEMS = [
  { time: '10:02', cat: 'POLICY', text: 'POLICY RESPONSE DISCUSSION INCREASING' },
  { time: '09:42', cat: 'SECTOR', text: 'AIRLINES AND TRAVEL UNDER BROAD PRESSURE' },
  { time: '09:35', cat: 'CREDIT', text: 'CREDIT SPREADS WIDENING ACROSS INVESTMENT GRADE' },
  { time: '09:31', cat: 'GLOBAL', text: 'TRAVEL RESTRICTIONS EXPANDING INTERNATIONALLY' },
  { time: '08:54', cat: 'HEALTH', text: 'CASE GROWTH ACCELERATING ACROSS MULTIPLE REGIONS' },
  { time: '08:22', cat: 'MARKET', text: 'INDEX FUTURES INDICATE EXTENDED OPENING LOSSES' },
];

function OrderPanel({ onClose }: { onClose: () => void }) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('SELL');
  const [symbol, setSymbol] = useState('XLF');
  const [amount, setAmount] = useState('5000');
  const [thesis, setThesis] = useState('');

  return (
    <div className="absolute inset-y-0 right-0 w-96 terminal-panel border-l border-phosphor/25 flex flex-col animate-slide-in z-10">
      <div className="border-b border-phosphor/20 px-4 py-3 flex items-center justify-between">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">ORDER TICKET</div>
        <button onClick={onClose} className="font-mono text-xs text-phosphor-dim hover:text-phosphor">✕</button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <div className="flex gap-2">
          {(['BUY', 'SELL'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`cmd-button flex-1 text-xs ${side === s ? 'cmd-button-primary' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="font-mono text-xs text-phosphor-dim">SYMBOL</div>
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            className="w-full bg-terminal-black border border-phosphor/30 text-phosphor font-mono text-sm px-3 py-2 focus:outline-none focus:border-phosphor/60"
          />
        </div>

        <div className="space-y-2">
          <div className="font-mono text-xs text-phosphor-dim">NOTIONAL AMOUNT ($)</div>
          <input
            type="text"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-terminal-black border border-phosphor/30 text-phosphor font-mono text-sm px-3 py-2 focus:outline-none focus:border-phosphor/60"
          />
        </div>

        <div className="terminal-panel-deep p-3 space-y-2 font-mono text-xs">
          <div className="text-phosphor-dim border-b border-phosphor/10 pb-2">PORTFOLIO EFFECT</div>
          <div className="flex justify-between"><span className="text-phosphor-dim">CURRENT WEIGHT</span><span className="text-phosphor">12.0%</span></div>
          <div className="flex justify-between"><span className="text-phosphor-dim">PROPOSED WEIGHT</span><span className={side === 'SELL' ? 'negative-value' : 'text-phosphor'}>
            {side === 'SELL' ? '7.1%' : '16.9%'}
          </span></div>
          <div className="flex justify-between"><span className="text-phosphor-dim">SECTOR EXPOSURE</span><span className="text-phosphor">18.1%</span></div>
          <div className="flex justify-between"><span className="text-phosphor-dim">CASH AFTER</span><span className="text-phosphor">23.8%</span></div>
          <div className="flex justify-between"><span className="text-phosphor-dim">TURNOVER USED</span><span className="text-phosphor">8.1%</span></div>
        </div>

        <div className="space-y-2">
          <div className="font-mono text-xs text-phosphor-dim">WHY ARE YOU DOING THIS?</div>
          <div className="space-y-1">
            {['VALUATION', 'DEFENSIVE ROTATION', 'MOMENTUM', 'DIVERSIFICATION', 'RISK REDUCTION', 'OTHER'].map((t, i) => (
              <button
                key={t}
                onClick={() => setThesis(t)}
                className={`w-full text-left font-mono text-xs px-3 py-1.5 border transition-colors ${
                  thesis === t
                    ? 'border-phosphor/60 bg-phosphor/10 text-phosphor'
                    : 'border-phosphor/20 text-phosphor-dim hover:text-phosphor-mid hover:border-phosphor/30'
                }`}
              >
                [{i + 1}] {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-phosphor/20 p-4 space-y-2">
        <button className="cmd-button cmd-button-primary w-full tracking-widest">[ ADD TO DECISION ]</button>
        <button onClick={onClose} className="cmd-button w-full">[ CANCEL ]</button>
      </div>
    </div>
  );
}

function NewsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-y-0 right-0 w-96 terminal-panel border-l border-phosphor/25 flex flex-col animate-slide-in z-10">
      <div className="border-b border-phosphor/20 px-4 py-3 flex items-center justify-between">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">NEWS TERMINAL</div>
        <button onClick={onClose} className="font-mono text-xs text-phosphor-dim hover:text-phosphor">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {NEWS_ITEMS.map((item, i) => (
          <div key={i} className="border-b border-phosphor/10 pb-3">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-xs text-phosphor-dim">{item.time}</span>
              <span className="font-mono text-xs text-phosphor-mid border border-phosphor/20 px-1">{item.cat}</span>
            </div>
            <div className="font-mono text-xs text-phosphor leading-5">{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-y-0 right-0 w-96 terminal-panel border-l border-phosphor/25 flex flex-col animate-slide-in z-10">
      <div className="border-b border-phosphor/20 px-4 py-3 flex items-center justify-between">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">RISK PANEL</div>
        <button onClick={onClose} className="font-mono text-xs text-phosphor-dim hover:text-phosphor">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="terminal-panel-deep p-4 space-y-3 font-mono text-xs">
          <div className="text-phosphor-dim tracking-widest border-b border-phosphor/10 pb-2">CURRENT RISK STATE</div>
          {[
            { label: 'DRAWDOWN', value: '-8.58%', pct: 43, danger: false },
            { label: 'VOLATILITY', value: '24.1%', pct: 65, danger: false },
            { label: 'SECTOR MAX (TECH)', value: '29.4%', pct: 84, danger: false },
            { label: 'TURNOVER TO DATE', value: '18.2%', pct: 61, danger: false },
          ].map(row => (
            <div key={row.label} className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-phosphor-dim">{row.label}</span>
                <span className={row.danger ? 'negative-value' : 'text-phosphor'}>{row.value}</span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${row.pct}%`,
                    background: row.pct > 80 ? '#D6A647' : '#0CD4A0',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="terminal-panel-deep p-4 space-y-2 font-mono text-xs">
          <div className="text-phosphor-dim tracking-widest border-b border-phosphor/10 pb-2">SECTOR BREAKDOWN</div>
          {[
            { sector: 'TECHNOLOGY', pct: 29.4 },
            { sector: 'FINANCIALS', pct: 12.0 },
            { sector: 'CONSUMER STAPLES', pct: 10.0 },
            { sector: 'HEALTHCARE', pct: 8.0 },
            { sector: 'ENERGY', pct: 0 },
            { sector: 'BONDS', pct: 10.5 },
            { sector: 'CASH', pct: 21.8 },
          ].map(row => (
            <div key={row.sector} className="flex items-center gap-3">
              <span className="text-phosphor-dim w-28 flex-shrink-0">{row.sector}</span>
              <div className="flex-1 progress-bar-track h-3">
                <div
                  className="progress-bar-fill h-full"
                  style={{
                    width: `${(row.pct / 35) * 100}%`,
                    background: row.pct > 30 ? '#D6A647' : '#0CD4A0',
                  }}
                />
              </div>
              <span className="text-phosphor w-10 text-right">{row.pct.toFixed(1)}%</span>
            </div>
          ))}
          <div className="border-t border-phosphor/10 pt-2 text-phosphor-dim">
            ARENA LIMIT: 35.0% PER SECTOR
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketTerminalScreen({ onAdvance, onBack }: Props) {
  const [activePanel, setActivePanel] = useState<Panel>('none');

  const togglePanel = (panel: Panel) => {
    setActivePanel(p => p === panel ? 'none' : panel);
  };

  return (
    <div className="terminal-screen min-h-screen flex flex-col relative overflow-hidden">
      {/* Header bar */}
      <div className="border-b border-phosphor/25 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 font-mono text-xs">
          <span className="text-phosphor-hot terminal-glow">REFI ALPHA</span>
          <span className="text-phosphor-dim">ARENA: COVID</span>
          <span className="text-phosphor-mid">CHECKPOINT 07/22</span>
          <span className="text-phosphor-dim">CRISIS DAY: ??</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-xs text-phosphor">
            SCORE: <span className="text-phosphor-hot terminal-glow">73</span>
            <span className="text-phosphor-dim mx-2">|</span>
            MACHINE: <span className="warning-value">79</span>
          </div>
          <button onClick={onBack} className="font-mono text-xs text-phosphor-dim hover:text-phosphor">
            [ESC]
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top data row */}
        <div className="grid grid-cols-3 border-b border-phosphor/20 flex-shrink-0">
          {/* Market */}
          <div className="border-r border-phosphor/20 p-4">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-3">MARKET</div>
            <div className="space-y-1.5 font-mono text-xs">
              {[
                { sym: 'SPX', val: '-4.2%', neg: true },
                { sym: 'VIX', val: '+18.7', neg: false },
                { sym: '10Y', val: '-21bp', neg: true },
                { sym: 'OIL', val: '-8.1%', neg: true },
                { sym: 'GOLD', val: '+1.8%', neg: false },
              ].map(item => (
                <div key={item.sym} className="flex justify-between">
                  <span className="text-phosphor-mid">{item.sym}</span>
                  <span className={item.neg ? 'negative-value' : 'positive-value font-bold'}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio */}
          <div className="border-r border-phosphor/20 p-4">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-3">PORTFOLIO</div>
            <div className="space-y-1.5 font-mono text-xs">
              {[
                { label: 'VALUE', val: '$91,420', hot: true },
                { label: 'CASH', val: '$21,800', hot: false },
                { label: 'EQUITY', val: '$59,120', hot: false },
                { label: 'BONDS', val: '$10,500', hot: false },
              ].map(item => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-phosphor-mid">{item.label}</span>
                  <span className={item.hot ? 'data-value terminal-glow' : 'text-phosphor'}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk */}
          <div className="p-4">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-3">RISK</div>
            <div className="space-y-1.5 font-mono text-xs">
              {[
                { label: 'DD', val: '-8.58%', warn: false },
                { label: 'VOL', val: '24.1%', warn: true },
                { label: 'SECTOR MAX', val: '29.4%', warn: false },
                { label: 'TURNOVER', val: '18.2%', warn: false },
              ].map(item => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-phosphor-mid">{item.label}</span>
                  <span className={item.warn ? 'warning-value' : 'text-phosphor'}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Event feed */}
        <div className="border-b border-phosphor/20 px-4 py-2 flex-shrink-0 bg-terminal-deep/50">
          <div className="flex items-center gap-6 overflow-hidden">
            <div className="font-mono text-xs text-phosphor-dim flex-shrink-0">EVENT FEED</div>
            <div className="flex items-center gap-6 overflow-x-auto font-mono text-xs">
              {NEWS_ITEMS.slice(0, 4).map((item, i) => (
                <div key={i} className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-phosphor-dim">{item.time}</span>
                  <span className="text-phosphor-mid border border-phosphor/20 px-1">{item.cat}</span>
                  <span className="text-phosphor">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Positions table */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="p-4">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-3">POSITIONS</div>
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="border-b border-phosphor/20">
                  <th className="text-left text-phosphor-dim py-2 font-normal">SYMBOL</th>
                  <th className="text-right text-phosphor-dim py-2 font-normal">WEIGHT</th>
                  <th className="text-right text-phosphor-dim py-2 font-normal">P&amp;L</th>
                  <th className="text-right text-phosphor-dim py-2 font-normal">RISK CONTRIB.</th>
                  <th className="text-right text-phosphor-dim py-2 font-normal">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {POSITIONS.map(pos => (
                  <tr key={pos.symbol} className="border-b border-phosphor/10 hover:bg-phosphor/5 transition-colors">
                    <td className="py-2.5 text-phosphor-hot font-bold">{pos.symbol}</td>
                    <td className="py-2.5 text-right text-phosphor">{pos.weight}</td>
                    <td className={`py-2.5 text-right ${pos.neg ? 'negative-value' : 'positive-value'}`}>
                      {pos.pnl}
                    </td>
                    <td className="py-2.5 text-right text-phosphor-mid">{pos.risk}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => togglePanel('order')}
                        className="font-mono text-xs text-phosphor-dim hover:text-phosphor border border-phosphor/20 hover:border-phosphor/50 px-2 py-0.5 transition-colors"
                      >
                        [MODIFY]
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Panels */}
          {activePanel === 'order' && <OrderPanel onClose={() => setActivePanel('none')} />}
          {activePanel === 'news' && <NewsPanel onClose={() => setActivePanel('none')} />}
          {activePanel === 'risk' && <RiskPanel onClose={() => setActivePanel('none')} />}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-phosphor/25 px-4 py-3 flex items-center justify-between flex-shrink-0 bg-terminal-deep">
        <div className="flex items-center gap-4">
          {[
            { key: 'O', label: 'ORDER', panel: 'order' as Panel },
            { key: 'N', label: 'NEWS', panel: 'news' as Panel },
            { key: 'R', label: 'RISK', panel: 'risk' as Panel },
            { key: 'J', label: 'JOURNAL', panel: 'journal' as Panel },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => togglePanel(item.panel)}
              className={`font-mono text-xs transition-colors ${
                activePanel === item.panel
                  ? 'text-phosphor-hot'
                  : 'text-phosphor-mid hover:text-phosphor'
              }`}
            >
              <span className="nav-key">{item.key}</span> {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-xs text-phosphor">
            DECISION REQUIRED
          </div>
          <button
            onClick={onAdvance}
            className="cmd-button cmd-button-primary text-xs tracking-widest"
          >
            <span className="nav-key">ENTER</span> ADVANCE
          </button>
        </div>
      </div>
    </div>
  );
}
