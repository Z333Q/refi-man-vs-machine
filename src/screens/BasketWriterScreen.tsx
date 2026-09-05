import ActionZone from '../components/ui/ActionZone';
import { useState } from 'react';

interface Props {
  onBack: () => void;
  onComplete: () => void;
}

interface Constituent {
  symbol: string;
  weight: number;
  sector: string;
}

const UNIVERSE = [
  { symbol: 'AAPL', sector: 'TECH' },
  { symbol: 'MSFT', sector: 'TECH' },
  { symbol: 'GOOGL', sector: 'TECH' },
  { symbol: 'AMZN', sector: 'CONS DISC' },
  { symbol: 'JNJ', sector: 'HEALTH' },
  { symbol: 'XOM', sector: 'ENERGY' },
  { symbol: 'JPM', sector: 'FINANCIALS' },
  { symbol: 'PG', sector: 'CONS STAP' },
  { symbol: 'UNH', sector: 'HEALTH' },
  { symbol: 'HD', sector: 'CONS DISC' },
  { symbol: 'SPY', sector: 'INDEX' },
  { symbol: 'QQQ', sector: 'INDEX' },
  { symbol: 'IEF', sector: 'BONDS' },
  { symbol: 'GLD', sector: 'COMMODITIES' },
  { symbol: 'XLV', sector: 'HEALTH' },
  { symbol: 'XLP', sector: 'CONS STAP' },
];

function getSectorExposure(constituents: Constituent[]) {
  const map: Record<string, number> = {};
  constituents.forEach(c => {
    map[c.sector] = (map[c.sector] || 0) + c.weight;
  });
  return map;
}

export default function BasketWriterScreen({ onBack, onComplete }: Props) {
  const [search, setSearch] = useState('');
  const [basket, setBasket] = useState<Constituent[]>([
    { symbol: 'AAPL', weight: 8.0, sector: 'TECH' },
    { symbol: 'MSFT', weight: 8.0, sector: 'TECH' },
    { symbol: 'JNJ', weight: 7.0, sector: 'HEALTH' },
    { symbol: 'XOM', weight: 6.0, sector: 'ENERGY' },
    { symbol: 'IEF', weight: 10.0, sector: 'BONDS' },
    { symbol: 'GLD', weight: 5.0, sector: 'COMMODITIES' },
  ]);

  const totalWeight = basket.reduce((s, c) => s + c.weight, 0) + 5.0; // +5 cash
  const sectorMap = getSectorExposure(basket);
  const maxSector = Math.max(...Object.values(sectorMap));
  const concentration = maxSector > 30 ? 'HIGH' : maxSector > 20 ? 'MEDIUM' : 'LOW';

  const filteredUniverse = UNIVERSE.filter(
    u => u.symbol.includes(search.toUpperCase()) && !basket.find(b => b.symbol === u.symbol)
  );

  const addToBasket = (sym: string, sector: string) => {
    setBasket(prev => [...prev, { symbol: sym, weight: 5.0, sector }]);
  };

  const updateWeight = (symbol: string, delta: number) => {
    setBasket(prev =>
      prev.map(c =>
        c.symbol === symbol
          ? { ...c, weight: Math.max(0.5, Math.min(20, c.weight + delta)) }
          : c
      )
    );
  };

  const removeFromBasket = (symbol: string) => {
    setBasket(prev => prev.filter(c => c.symbol !== symbol));
  };

  return (
    <div className="terminal-screen min-h-screen flex flex-col">
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between">
        <div className="font-mono text-xs text-phosphor-mid tracking-widest">REFI ALPHA // BASKET WRITER</div>
        <button onClick={onBack} className="font-mono text-xs text-phosphor-dim hover:text-phosphor">[ESC] BACK</button>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Universe panel */}
        <div className="w-52 border-r border-phosphor/20 flex flex-col">
          <div className="border-b border-phosphor/20 p-3">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-2">UNIVERSE</div>
            <input
              type="text"
              placeholder="SEARCH..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-terminal-black border border-phosphor/30 text-phosphor font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-phosphor/60 placeholder-phosphor-dim"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredUniverse.map(item => (
              <button
                key={item.symbol}
                onClick={() => addToBasket(item.symbol, item.sector)}
                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-phosphor/10 transition-colors text-left border border-transparent hover:border-phosphor/20 rounded-terminal mb-0.5"
              >
                <span className="font-mono text-xs text-phosphor">{item.symbol}</span>
                <span className="font-mono text-xs text-phosphor-dim">{item.sector}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Basket panel */}
        <div className="flex-1 flex flex-col">
          <div className="border-b border-phosphor/20 p-3 flex items-center justify-between">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest">YOUR BASKET</div>
            <div className={`font-mono text-xs ${Math.abs(totalWeight - 100) < 0.5 ? 'text-phosphor' : 'warning-value'}`}>
              TOTAL {totalWeight.toFixed(1)}%
              {Math.abs(totalWeight - 100) >= 0.5 && ': UNBALANCED'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {basket.map(item => (
              <div key={item.symbol} className="flex items-center gap-3 py-2 border-b border-phosphor/10">
                <div className="font-mono text-xs text-phosphor-hot w-14">{item.symbol}</div>
                <div className="font-mono text-xs text-phosphor-dim w-20">{item.sector}</div>
                <div className="flex items-center gap-1 flex-1">
                  <button
                    onClick={() => updateWeight(item.symbol, -0.5)}
                    className="font-mono text-xs text-phosphor-dim hover:text-phosphor w-5 text-center"
                  >-</button>
                  <div className="flex-1 progress-bar-track h-3">
                    <div
                      className="progress-bar-fill h-full"
                      style={{ width: `${(item.weight / 20) * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={() => updateWeight(item.symbol, 0.5)}
                    className="font-mono text-xs text-phosphor-dim hover:text-phosphor w-5 text-center"
                  >+</button>
                </div>
                <div className="font-mono text-xs text-phosphor w-12 text-right">{item.weight.toFixed(1)}%</div>
                <button
                  onClick={() => removeFromBasket(item.symbol)}
                  className="font-mono text-xs text-phosphor-dim hover:text-phosphor w-4 text-center ml-1"
                >✕</button>
              </div>
            ))}
            <div className="flex items-center gap-3 py-2 border-b border-phosphor/10 opacity-60">
              <div className="font-mono text-xs text-phosphor-dim w-14">CASH</div>
              <div className="font-mono text-xs text-phosphor-dim w-20">RESERVE</div>
              <div className="flex-1" />
              <div className="font-mono text-xs text-phosphor w-12 text-right">5.0%</div>
              <div className="w-4 ml-1" />
            </div>
          </div>
        </div>

        {/* Risk map panel */}
        <div className="w-56 border-l border-phosphor/20 p-4 space-y-4">
          <div className="font-mono text-xs text-phosphor-dim tracking-widest">RISK MAP</div>

          <div className="space-y-2">
            {Object.entries(sectorMap).map(([sector, weight]) => (
              <div key={sector} className="space-y-1">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-phosphor-dim">{sector}</span>
                  <span className={weight > 30 ? 'warning-value' : 'text-phosphor'}>{weight.toFixed(1)}%</span>
                </div>
                <div className="progress-bar-track h-2">
                  <div
                    className="progress-bar-fill h-full"
                    style={{
                      width: `${Math.min(100, (weight / 35) * 100)}%`,
                      background: weight > 30 ? '#D6A647' : '#0CD4A0',
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-between font-mono text-xs border-t border-phosphor/20 pt-2">
              <span className="text-phosphor-dim">CASH</span>
              <span className="text-phosphor">5.0%</span>
            </div>
          </div>

          <div className="terminal-panel-deep p-3 space-y-2">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-phosphor-dim">CONCENTRATION</span>
              <span className={concentration === 'HIGH' ? 'warning-value' : 'text-phosphor'}>{concentration}</span>
            </div>
            <div className="flex justify-between font-mono text-xs">
              <span className="text-phosphor-dim">POSITIONS</span>
              <span className="text-phosphor">{basket.length}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Basket edits are the decision; locking the basket is the commit. */}
      <ActionZone
        variant="inline"
        note="A PORTFOLIO IS A THESIS. A POLICY IS HOW YOU KEEP IT."
        primary={{
          label: 'LOCK BASKET',
          onClick: onComplete,
          disabled: basket.length === 0,
          disabledHint: 'ADD AT LEAST ONE POSITION',
          keyHint: '[ENTER]',
        }}
      />
    </div>
  );
}
