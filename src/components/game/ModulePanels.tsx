import type { PortfolioState, CheckpointData, RunDecision } from '../../lib/gameTypes';

// ─── Unlocked-module panels ───────────────────────────────────────────────────
//
// Modules used to unlock into nothing. `activeModules` was read by exactly one
// component — the dot rack in the right rail — so earning CORRELATION MAP
// announced a module, ticked a counter from 4/11 to 5/11, and gave the player
// no way to open it. The reward for progressing was a number going up.
//
// These are the surfaces those unlocks were always promising. Each is built
// from data the run already has, so a panel cannot describe a portfolio the
// player does not hold, and each says plainly what it is showing rather than
// implying the machine knows something the player does not (§34, §57).

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * CORRELATION MAP — §14 and §37.
 *
 * The lesson is that a position count is not a diversification count. So the
 * panel leads with the cluster count, not with a matrix: the matrix is
 * evidence, the cluster count is the point.
 */
export function CorrelationPanel({
  portfolio, checkpoint,
}: { portfolio: PortfolioState; checkpoint: CheckpointData }) {
  const rho = checkpoint.portfolioEffect.correlationLevel ?? portfolio.correlationIndex ?? 0;

  // Sectors are the observable proxy for economic risk here. As correlation
  // rises, sectors stop being independent and collapse toward one another —
  // which is exactly what the player is meant to notice.
  const sectors = [...new Set(portfolio.positions.map(p => p.sector))];
  const clusters = rho >= 0.9 ? 1 : rho >= 0.75 ? Math.min(2, sectors.length)
    : rho >= 0.55 ? Math.min(3, sectors.length) : sectors.length;

  const bySector = sectors.map(s => ({
    sector: s,
    weight: portfolio.positions.filter(p => p.sector === s).reduce((a, p) => a + p.weight, 0),
    symbols: portfolio.positions.filter(p => p.sector === s).map(p => p.symbol),
  })).sort((a, b) => b.weight - a.weight);

  return (
    <div className="p-5">
      <div className="text-phosphor-dim text-xs tracking-widest mb-3">
        CORRELATION MAP · MODULE
      </div>

      <div className="border border-phosphor/25 bg-terminal-deep/40 p-4 mb-5">
        <div className="flex items-baseline gap-6 flex-wrap">
          <div>
            <div className="text-phosphor-dim text-xs tracking-widest">POSITIONS</div>
            <div className="text-phosphor text-2xl font-bold tabular-nums">
              {portfolio.positions.length}
            </div>
          </div>
          <div className="text-phosphor-dim text-xl">→</div>
          <div>
            <div className="text-phosphor-dim text-xs tracking-widest">RISK CLUSTERS</div>
            <div className={`text-2xl font-bold tabular-nums ${clusters <= 2 ? 'text-risk-red' : 'text-phosphor'}`}>
              {clusters}
            </div>
          </div>
          <div className="ml-auto">
            <div className="text-phosphor-dim text-xs tracking-widest">CORRELATION</div>
            <div className={`text-2xl font-bold tabular-nums ${rho >= 0.75 ? 'text-risk-red' : rho >= 0.55 ? 'text-alert-amber' : 'text-phosphor'}`}>
              {rho.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="text-phosphor-mid text-xs leading-relaxed mt-3">
          {clusters < portfolio.positions.length
            ? 'MORE TICKERS DO NOT AUTOMATICALLY MEAN MORE DIVERSIFICATION. AT THIS CORRELATION THESE POSITIONS ARE BEHAVING AS FEWER, LARGER BETS THAN THE COUNT SUGGESTS.'
            : 'POSITIONS ARE STILL MOVING INDEPENDENTLY. THIS IS THE STATE THAT CHANGES FIRST WHEN A REGIME TURNS.'}
        </div>
      </div>

      <div className="text-phosphor-dim text-xs tracking-widest mb-2">EXPOSURE BY CLUSTER</div>
      <div className="space-y-2">
        {bySector.map(s => (
          <div key={s.sector} className="border-l-2 border-phosphor/25 pl-3">
            <div className="flex justify-between items-baseline">
              <span className="text-phosphor text-xs tracking-widest">{s.sector}</span>
              <span className="text-phosphor text-xs font-bold tabular-nums">{pct(s.weight)}</span>
            </div>
            <div className="text-phosphor-dim text-xs mt-0.5">{s.symbols.join(' · ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * DRAWDOWN MAP — the run's own decline against the limit that ends it.
 *
 * Deliberately plots the player's actual path rather than a historical
 * comparison set: §26.4 forbids implying a ReFi benchmark traded these
 * pre-2023 windows, and an unlabelled second line here would do exactly that.
 */
export function DrawdownPanel({
  portfolio, decisions, criticalDrawdown,
}: { portfolio: PortfolioState; decisions: RunDecision[]; criticalDrawdown: number }) {
  const dd = portfolio.drawdown;
  const used = criticalDrawdown !== 0 ? Math.min(1, Math.abs(dd / criticalDrawdown)) : 0;
  const width = 34;
  const filled = Math.round(used * width);

  return (
    <div className="p-5">
      <div className="text-phosphor-dim text-xs tracking-widest mb-3">
        DRAWDOWN MAP · MODULE
      </div>

      <div className="border border-phosphor/25 bg-terminal-deep/40 p-4 mb-5">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-phosphor-dim text-xs tracking-widest">CURRENT</div>
            <div className={`text-3xl font-bold tabular-nums ${dd <= criticalDrawdown * 0.75 ? 'text-risk-red' : dd < -0.05 ? 'text-alert-amber' : 'text-phosphor'}`}>
              {pct(dd)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-phosphor-dim text-xs tracking-widest">RUN ENDS AT</div>
            <div className="text-phosphor-mid text-lg font-bold tabular-nums">{pct(criticalDrawdown)}</div>
          </div>
        </div>

        <pre className="font-mono text-xs leading-none" aria-hidden="true">
          <span className={used > 0.75 ? 'text-risk-red' : used > 0.5 ? 'text-alert-amber' : 'text-phosphor'}>
            {'█'.repeat(filled)}
          </span>
          <span className="text-phosphor-dim/40">{'░'.repeat(width - filled)}</span>
        </pre>
        <div className="text-phosphor-mid text-xs mt-2">
          {Math.round(used * 100)}% OF THE RISK BUDGET SPENT. LOSS IS AN OUTCOME,
          RISK IS A STATE — THIS BAR IS THE STATE.
        </div>
      </div>

      <div className="text-phosphor-dim text-xs tracking-widest mb-2">DECISION PATH</div>
      {decisions.length === 0 ? (
        <div className="text-phosphor-dim text-xs">NO DECISIONS COMMITTED YET.</div>
      ) : (
        <div className="space-y-1">
          {decisions.map(d => (
            <div key={d.checkpointSequence} className="flex justify-between items-baseline text-xs">
              <span className="text-phosphor-dim tabular-nums">
                CP {String(d.checkpointSequence).padStart(2, '0')}
              </span>
              <span className="text-phosphor-mid tracking-widest">{d.actionCode}</span>
              <span className={`tabular-nums font-bold ${d.scoreContribution >= 0 ? 'text-phosphor' : 'text-risk-red'}`}>
                {d.scoreContribution >= 0 ? '+' : ''}{d.scoreContribution}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * REGIME SCANNER — §23's lesson that a rule which worked can stop working
 * because the regime underneath it changed.
 *
 * Reports the state the checkpoint itself declares. It does not forecast, and
 * says so: the machine does not know the future either (§1.4).
 */
export function RegimePanel({
  portfolio, checkpoint,
}: { portfolio: PortfolioState; checkpoint: CheckpointData }) {
  const rho = checkpoint.portfolioEffect.correlationLevel ?? 0;
  const vol = portfolio.volatility;

  const regime = checkpoint.isRegimeChange ? 'TRANSITION'
    : rho >= 0.85 ? 'PANIC'
      : vol > 0.28 ? 'STRESS'
        : portfolio.drawdown < -0.1 ? 'BEAR'
          : 'EXPANSION';

  const color = regime === 'PANIC' ? 'text-risk-red'
    : regime === 'TRANSITION' || regime === 'STRESS' ? 'text-alert-amber'
      : 'text-phosphor';

  const rows: [string, string][] = [
    ['PHASE', checkpoint.phase.replace(/_/g, ' ')],
    ['CORRELATION', rho.toFixed(2)],
    ['PORTFOLIO VOL', pct(vol)],
    ['DRAWDOWN', pct(portfolio.drawdown)],
    ['REGIME CHANGE FLAG', checkpoint.isRegimeChange ? 'YES' : 'NO'],
  ];

  return (
    <div className="p-5">
      <div className="text-phosphor-dim text-xs tracking-widest mb-3">
        REGIME SCANNER · MODULE
      </div>

      <div className="border border-phosphor/25 bg-terminal-deep/40 p-4 mb-5">
        <div className="text-phosphor-dim text-xs tracking-widest">CLASSIFIED STATE</div>
        <div className={`text-3xl font-bold tracking-widest mt-1 ${color}`}>{regime}</div>
        <div className="text-phosphor-mid text-xs leading-relaxed mt-3">
          THIS IS A READING OF THE CURRENT STATE, NOT A FORECAST. THE SCANNER
          HAS THE SAME INFORMATION CUTOFF YOU DO, AND SO DOES THE MACHINE.
        </div>
      </div>

      <div className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between items-baseline">
            <span className="text-phosphor-dim text-xs tracking-widest">{k}</span>
            <span className="text-phosphor text-xs font-bold tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
