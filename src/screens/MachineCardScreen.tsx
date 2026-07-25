import { BENCHMARK_SNAPSHOTS } from '../lib/progressionEngine';
import type { BenchmarkSnapshot } from '../lib/gameTypes';
import { ResultCategoryLabel } from '../components/ResultCategoryLabel';
import type { ResultCategory } from '../lib/resultCategories';

interface Props {
  onReturn: () => void;
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-phosphor/10">
      <span className="font-mono text-xs text-phosphor-dim">{label}</span>
      <span className={`font-mono text-xs ${highlight ? 'text-phosphor-hot' : 'text-phosphor'}`}>{value}</span>
    </div>
  );
}

function BenchmarkCard({ snapshot, title, category }: { snapshot: BenchmarkSnapshot; title: string; category: ResultCategory }) {
  const s = snapshot.stats;
  return (
    <div className="terminal-panel p-4">
      <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2 mb-3">{title}</div>
      {/* Each card is one result category; the label makes the category
          explicit per §62 / §3.4 gate 1. */}
      <ResultCategoryLabel category={category} className="mb-3" />
      <div className="font-mono text-xs text-phosphor-mid tracking-widest mb-2" style={{ fontSize: '10px' }}>
        {snapshot.universe.symbolCount} SYMBOLS · {snapshot.period.firstTradingDay} → {snapshot.period.lastTradingDay}
      </div>
      <StatRow label="CAGR" value={`${(s.cagr * 100).toFixed(2)}%`} highlight />
      <StatRow label="SHARPE" value={s.sharpe.toFixed(2)} highlight />
      <StatRow label="SORTINO" value={s.sortino !== undefined ? s.sortino.toFixed(2) : '—'} />
      <StatRow label="MAX DRAWDOWN" value={`${(s.maxDrawdown * 100).toFixed(2)}%`} />
      <StatRow label="VOLATILITY" value={`${(s.volatility * 100).toFixed(2)}%`} />
      {s.calmar !== undefined && <StatRow label="CALMAR" value={s.calmar.toFixed(2)} />}
      {s.alphaAnnualized !== undefined && <StatRow label="ALPHA (ANN.)" value={`${(s.alphaAnnualized * 100).toFixed(2)}%`} />}
      {s.betaVsSpy !== undefined && <StatRow label="BETA vs SPY" value={s.betaVsSpy.toFixed(2)} />}
      {s.winDays !== undefined && <StatRow label="WIN DAYS" value={`${(s.winDays * 100).toFixed(1)}%`} />}
      {s.winMonths !== undefined && <StatRow label="WIN MONTHS" value={`${(s.winMonths * 100).toFixed(1)}%`} />}
      <div className="mt-2 font-mono text-phosphor-dim/50" style={{ fontSize: '9px', letterSpacing: '0.04em' }}>
        SOURCE: {snapshot.sourceType.replace(/_/g, ' ')} · ID: {snapshot.benchmarkId}
      </div>
    </div>
  );
}

export default function MachineCardScreen({ onReturn }: Props) {
  const primary = BENCHMARK_SNAPSHOTS.rfRlAnalyze2025;
  const goodFit = BENCHMARK_SNAPSHOTS.rfRlGoodFit;
  const fullBasket = BENCHMARK_SNAPSHOTS.rfRlFullBasket;
  const spy = BENCHMARK_SNAPSHOTS.spy;

  return (
    <div className="terminal-screen min-h-screen flex flex-col font-mono">
      <div className="border-b border-phosphor/20 px-6 py-3 flex items-center justify-between">
        <div className="text-xs text-phosphor-mid tracking-widest">
          REFI ALPHA // BENCHMARK TRANSPARENCY RECORD
        </div>
        <button onClick={onReturn} className="text-xs text-phosphor-dim hover:text-phosphor transition-colors">
          [ESC] RETURN
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Primary benchmark identity */}
          <div>
            <div className="text-xs text-phosphor-dim tracking-widest mb-2">CANONICAL BENCHMARK</div>
            <div className="text-2xl text-phosphor-hot tracking-wide">
              REFI RF/RL REGIME BENCHMARK
            </div>
            <div className="text-phosphor-dim text-xs mt-1">
              SNAPSHOT RF-RL-2025-11-21 · VERSIONED · OOS 2023-04-18 → 2025-10-17
            </div>
          </div>

          {/* Exhibition warning */}
          <div className="border border-alert-amber/30 bg-alert-amber/5 px-5 py-4 text-xs leading-relaxed">
            <div className="text-alert-amber font-bold tracking-widest mb-2">CAPABILITY DIFFERENCE</div>
            <div className="text-alert-amber/80 space-y-1">
              <div>YOUR MACHINE — LONG / CASH (no short exposure)</div>
              <div>REFI RF/RL — DIRECTIONAL REGIME EXPOSURE (+1 LONG / -1 SHORT PER ASSET)</div>
            </div>
            <div className="text-alert-amber/60 mt-2">
              THIS IS AN EXHIBITION COMPARISON, NOT A CONSTRAINT-MATCHED CONTEST.
              FAIR MATCH RESULTS DETERMINE ARENA ADVANCEMENT.
            </div>
          </div>

          {/* Three-way benchmark comparison */}
          <div>
            <div className="text-xs text-phosphor-dim tracking-widest mb-3">
              BENCHMARK RECONCILIATION NOTE
            </div>
            <div className="border border-phosphor/10 bg-phosphor/3 px-4 py-3 text-xs text-phosphor-dim leading-relaxed mb-4">
              The /analyze API snapshot (321 symbols) and the research paper (292 Good-Fit / 355 Full Basket)
              represent different portfolio construction states. They share the same OOS period.
              Do not merge results across snapshots. The canonical product benchmark is determined
              by the versioned /analyze snapshot.
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <BenchmarkCard snapshot={primary} title="RF/RL BENCHMARK SNAPSHOT" category="HISTORICAL_MODEL_SIMULATION" />
              <BenchmarkCard snapshot={goodFit} title="GOOD-FIT PORTFOLIO (PAPER)" category="PAPER_TRADING_RESULT" />
              <BenchmarkCard snapshot={fullBasket} title="FULL BASKET (PAPER)" category="PAPER_TRADING_RESULT" />
            </div>
          </div>

          {/* Passive comparison */}
          <div>
            <div className="text-xs text-phosphor-dim tracking-widest mb-3">PASSIVE BASELINE</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BenchmarkCard snapshot={spy} title="S&P 500 INDEX (SPY)" category="HISTORICAL_MARKET_DATA" />
              <div className="terminal-panel p-4">
                <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2 mb-3">
                  SIGNAL-LAG SENSITIVITY (GOOD-FIT)
                </div>
                {/* Good-Fit paper process, sensitivity view (§62 / §3.4 gate 1). */}
                <ResultCategoryLabel category="PAPER_TRADING_RESULT" className="mb-3" />
                <div className="space-y-1">
                  {[
                    { lag: '0H', cagr: 22.47, sharpe: 4.38 },
                    { lag: '3H', cagr: 15.25, sharpe: 2.78 },
                    { lag: '7H', cagr: 9.51, sharpe: 1.42 },
                    { lag: '14H', cagr: 3.82, sharpe: -0.10 },
                  ].map(row => (
                    <div key={row.lag} className="flex items-center gap-4 py-1.5 border-b border-phosphor/10">
                      <span className="text-phosphor-dim text-xs w-8">{row.lag}</span>
                      <div className="flex-1">
                        <div
                          className="h-1 bg-phosphor/40"
                          style={{ width: `${Math.max(2, (row.cagr / 22.47) * 100)}%` }}
                        />
                      </div>
                      <span className="text-phosphor text-xs tabular-nums w-14 text-right">
                        {row.cagr.toFixed(2)}% CAGR
                      </span>
                      <span className={`text-xs tabular-nums w-14 text-right ${
                        row.sharpe < 0 ? 'text-risk-red' : row.sharpe < 2 ? 'text-alert-amber' : 'text-phosphor-mid'
                      }`}>
                        {row.sharpe.toFixed(2)} SH
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-phosphor-dim text-xs">
                  THE EDGE DECAYS WITH EXECUTION LATENCY.
                  TIMING IS NOT DECORATION — IT IS THE EDGE.
                </div>
              </div>
            </div>
          </div>

          {/* Process */}
          <div className="terminal-panel p-5">
            <div className="font-mono text-xs text-phosphor-dim tracking-widest border-b border-phosphor/20 pb-2 mb-4">
              RF/RL PIPELINE (DOCUMENTED)
            </div>
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="space-y-2">
                {[
                  'U.S.-LISTED EQUITY UNIVERSE',
                  '↓ FUNDAMENTAL FILTER',
                  '↓ LIQUIDITY FILTER',
                  '↓ RF/RL PIPELINE PER ASSET',
                  '↓ HOURLY REGIME CLASSIFICATION (+1 / -1)',
                  '↓ CROSS-SECTIONAL PORTFOLIO',
                  '↓ DAILY AGGREGATED RETURN',
                  '↓ COST ADJUSTMENT',
                  '↓ PORTFOLIO METRICS',
                ].map((step, i) => (
                  <div
                    key={i}
                    className={step.startsWith('↓') ? 'text-phosphor-mid pl-2' : 'text-phosphor font-bold'}
                  >
                    {step}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-phosphor-dim tracking-widest mb-1">GOOD-FIT SELECTION LAYER</div>
                  <div className="text-phosphor-mid leading-snug">
                    292 equities passing bootstrapped-Sharpe robustness criteria and recent profitability filter applied on top of the 355 full basket.
                  </div>
                </div>
                <div>
                  <div className="text-phosphor-dim tracking-widest mb-1">THE MACHINE DOES NOT</div>
                  <div className="space-y-1 text-phosphor-dim">
                    <div>— PREDICT SPECIFIC PRICES</div>
                    <div>— USE FUTURE INFORMATION</div>
                    <div>— CHANGE RULES MID-RUN</div>
                    <div>— HAVE ACCESS TO YOUR DECISIONS</div>
                  </div>
                </div>
                <div className="border-t border-phosphor/10 pt-3">
                  <div className="text-phosphor leading-relaxed">
                    THE MACHINE DOES NOT WIN BECAUSE IT KNOWS THE FUTURE.
                    IT MONITORS HUNDREDS OF EQUITIES. IT UPDATES REGIME STATES.
                    IT ACTS CONSISTENTLY. IT DOES NOT PANIC.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={onReturn} className="cmd-button cmd-button-primary tracking-widest">
              [ RETURN ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
