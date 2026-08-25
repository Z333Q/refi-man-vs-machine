import ActionZone from '../components/ui/ActionZone';
import { useState, useCallback } from 'react';
import type {
  MachineModuleId,
  MachineConfig,
  UniverseChoice,
  EligibilityChoice,
  SignalChoice,
  ConstructionChoice,
  GuardrailConfig,
  ExecutionChoice,
  MonitoringChoice,
  PlayerMachine,
  MachineOption,
} from '../lib/gameTypes';
import { DEFAULT_MACHINE_CONFIG, DEFAULT_GUARDRAILS } from '../lib/gameTypes';
import MachineCompile from '../components/game/MachineCompile';

// ─── Module definitions ───────────────────────────────────────────────────────

interface ModuleDef {
  id: MachineModuleId;
  label: string;
  question: string;
  sublabel: string;
  rfrlNote: string; // What the ReFi research says about this layer
}

const MODULES: ModuleDef[] = [
  {
    id: 'UNIVERSE',
    label: 'UNIVERSE',
    question: 'What can the machine see?',
    sublabel: '01',
    rfrlNote: 'ReFi RF/RL starts from all U.S.-listed equities meeting basic exchange criteria.',
  },
  {
    id: 'ELIGIBILITY',
    label: 'ELIGIBILITY FILTER',
    question: 'What names qualify?',
    sublabel: '02',
    rfrlNote: 'ReFi applies fundamental quality and liquidity screens before the RF/RL pipeline. Full basket: 355 names. Good-Fit adds a robustness layer: 292 names.',
  },
  {
    id: 'SIGNAL',
    label: 'SIGNAL / REGIME LOGIC',
    question: 'What state is each stock in?',
    sublabel: '03',
    rfrlNote: 'The ReFi RF/RL pipeline classifies each asset hourly as +1 (long regime) or -1 (short regime). Regime state determines directional exposure.',
  },
  {
    id: 'CONSTRUCTION',
    label: 'PORTFOLIO CONSTRUCTION',
    question: 'How are exposures built?',
    sublabel: '04',
    rfrlNote: 'ReFi aggregates per-asset directional strategy returns cross-sectionally. Position sizes are derived from the regime signal strength and portfolio constraints.',
  },
  {
    id: 'GUARDRAILS',
    label: 'RISK GUARDRAILS',
    question: 'What cannot happen?',
    sublabel: '05',
    rfrlNote: 'The ReFi Good-Fit layer applies bootstrapped-Sharpe and profitability constraints. These guardrails are what separates the Good-Fit (292) from the Full Basket (355).',
  },
  {
    id: 'EXECUTION',
    label: 'EXECUTION TIMELINESS',
    question: 'How quickly does it act?',
    sublabel: '06',
    rfrlNote: 'Signal-lag tests show CAGR decays from 22.47% at 0H → 3.82% at 14H lag. Execution timing is not decoration. It is the edge.',
  },
  {
    id: 'MONITORING',
    label: 'MONITORING',
    question: 'When has risk changed?',
    sublabel: '07',
    rfrlNote: 'The benchmark monitors 321 equities continuously for regime flips. Normal cross-sectional correlation is ~0.01. Rising correlation is the primary risk signal.',
  },
];

// ─── Option sets ──────────────────────────────────────────────────────────────

const UNIVERSE_OPTIONS: MachineOption<UniverseChoice>[] = [
  { value: 'US_ALL', label: 'ALL U.S. LISTED EQUITIES', detail: 'Maximum universe — ~7,000 names. Broader opportunity but more noise.' },
  { value: 'US_LIQUID', label: 'U.S. LIQUID EQUITIES', detail: 'Liquidity-filtered universe. ReFi starting point after exchange + volume screens.' },
  { value: 'SP500', label: 'S&P 500 ONLY', detail: '503 names. Simple, well-understood. Sacrifices long-tail alpha.' },
];

const ELIGIBILITY_OPTIONS: MachineOption<EligibilityChoice>[] = [
  { value: 'NONE', label: 'NO FILTER', detail: 'Use the raw universe. High noise exposure.' },
  { value: 'FUNDAMENTAL', label: 'FUNDAMENTAL SCREEN', detail: 'Quality and earnings filters. Removes deteriorating names.' },
  { value: 'FUNDAMENTAL_LIQUIDITY', label: 'FUNDAMENTAL + LIQUIDITY', detail: 'ReFi Full Basket approach — 355 names after both screens.' },
  { value: 'ROBUSTNESS', label: 'ROBUSTNESS FILTER', detail: 'Add bootstrapped-Sharpe and recent profitability criteria. ReFi Good-Fit approach — 292 names.' },
];

const SIGNAL_OPTIONS: MachineOption<SignalChoice>[] = [
  { value: 'PRICE_MOMENTUM', label: 'PRICE MOMENTUM', detail: 'Simple 3-12 month price momentum. Transparent. Regime-blind.' },
  { value: 'QUALITY_FACTOR', label: 'QUALITY FACTOR', detail: 'Earnings quality, return on equity, cash flow. Slow-moving. Better in stable regimes.' },
  { value: 'REGIME_CLASSIFIER', label: 'REGIME CLASSIFIER', detail: 'ML-based binary regime classification (+1/-1) per asset. Adapts to market phase.' },
  { value: 'RF_RL_PIPELINE', label: 'RF/RL PIPELINE', detail: 'Random Forest + Reinforcement Learning per asset. Hourly update. The ReFi production approach.' },
];

const CONSTRUCTION_OPTIONS: MachineOption<ConstructionChoice>[] = [
  { value: 'EQUAL_WEIGHT', label: 'EQUAL WEIGHT', detail: '1/N allocation. Simple. No view on relative signal strength.' },
  { value: 'RISK_PARITY', label: 'RISK PARITY', detail: 'Volatility-adjusted weight. Equalizes risk contribution.' },
  { value: 'SIGNAL_WEIGHTED', label: 'SIGNAL WEIGHTED', detail: 'Position size proportional to signal strength. Higher conviction → larger exposure.' },
  { value: 'CONSTRAINED_OPT', label: 'CONSTRAINED OPTIMIZATION', detail: 'Optimize expected return subject to position and sector constraints. Most sophisticated.' },
];

const EXECUTION_OPTIONS: MachineOption<ExecutionChoice>[] = [
  { value: 'WEEKLY', label: 'WEEKLY REBALANCE', detail: 'Act once per week. Reduces turnover. Sacrifices signal freshness.' },
  { value: 'DAILY_CLOSE', label: 'DAILY EOD CLOSE', detail: 'Act on end-of-day close price. Standard systematic approach.' },
  { value: 'STAGED_3TRANCHE', label: 'STAGED — 3 TRANCHES', detail: 'Deploy in three equal tranches over 3 days. Reduces entry timing risk.' },
  { value: 'INTRADAY_1H', label: 'INTRADAY 1H', detail: 'Act within 1 hour of signal. Captures most of the edge. Requires robust execution.' },
];

const MONITORING_OPTIONS: MachineOption<MonitoringChoice>[] = [
  { value: 'PASSIVE', label: 'PASSIVE — NO MONITORING', detail: 'Set and forget. No risk alerts. Drift control only.' },
  { value: 'CORRELATION_ALERT', label: 'CORRELATION ALERT', detail: 'Alert when cross-asset correlation exceeds threshold. Primary COVID/banking-stress signal.' },
  { value: 'REGIME_SCANNER', label: 'REGIME SCANNER', detail: 'Monitor regime state changes across the portfolio. Faster regime recognition.' },
  { value: 'FULL_RISK_MONITOR', label: 'FULL RISK MONITOR', detail: 'Correlation + regime + drawdown + concentration. Real-time portfolio risk dashboard.' },
];

// ─── Compile check list (derived from config) ─────────────────────────────────

function buildCompileChecks(config: MachineConfig): { label: string; detail?: string }[] {
  const eligLabel = ELIGIBILITY_OPTIONS.find(o => o.value === config.eligibility)?.label ?? config.eligibility;
  const signalLabel = SIGNAL_OPTIONS.find(o => o.value === config.signal)?.label ?? config.signal;
  const constructLabel = CONSTRUCTION_OPTIONS.find(o => o.value === config.construction)?.label ?? config.construction;
  const execLabel = EXECUTION_OPTIONS.find(o => o.value === config.execution)?.label ?? config.execution;
  const monLabel = MONITORING_OPTIONS.find(o => o.value === config.monitoring)?.label ?? config.monitoring;

  return [
    { label: 'UNIVERSE', detail: UNIVERSE_OPTIONS.find(o => o.value === config.universe)?.label },
    { label: 'ELIGIBILITY FILTER', detail: eligLabel },
    { label: 'SIGNAL LOGIC', detail: signalLabel },
    { label: 'PORTFOLIO CONSTRUCTION', detail: constructLabel },
    { label: 'POSITION LIMIT', detail: `MAX ${Math.round(config.guardrails.maxPositionPct * 100)}%` },
    { label: 'SECTOR LIMIT', detail: `MAX ${Math.round(config.guardrails.maxSectorPct * 100)}%` },
    { label: 'CORRELATION GUARD', detail: `ρ < ${config.guardrails.maxCorrelation}` },
    { label: 'DRAWDOWN GATE', detail: `PAUSE AT ${Math.round(config.guardrails.drawdownGatePct * 100)}%` },
    { label: 'EXECUTION', detail: execLabel },
    { label: 'MONITORING', detail: monLabel },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function versionString(n: number): string {
  if (n >= 10) return 'v1.0';
  return `v0.${n}`;
}

// Estimate universe funnel counts from config
function funnelCounts(config: MachineConfig): { start: number; afterFund: number; afterLiq: number; final: number } {
  const start = config.universe === 'SP500' ? 503 : config.universe === 'US_LIQUID' ? 2800 : 7000;
  const afterFund = config.eligibility === 'NONE' ? start : config.universe === 'SP500' ? 420 : 580;
  const afterLiq = config.eligibility === 'FUNDAMENTAL_LIQUIDITY' || config.eligibility === 'ROBUSTNESS'
    ? (config.universe === 'SP500' ? 380 : 355)
    : afterFund;
  const final = config.eligibility === 'ROBUSTNESS' ? 292
    : config.eligibility === 'FUNDAMENTAL_LIQUIDITY' ? 355
    : config.eligibility === 'FUNDAMENTAL' ? Math.round(afterFund * 0.7)
    : Math.round(start * 0.5);
  return { start, afterFund, afterLiq, final };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onCompiled?: (machine: PlayerMachine) => void;
}

type BuilderTab = 'BUILD' | 'SCHEMATIC' | 'FUNNEL';

export default function MachineBuilderScreen({ onBack, onCompiled }: Props) {
  const [config, setConfig] = useState<MachineConfig>({ ...DEFAULT_MACHINE_CONFIG, guardrails: { ...DEFAULT_GUARDRAILS } });
  const [activeModule, setActiveModule] = useState<MachineModuleId>('UNIVERSE');
  const [installedModules, setInstalledModules] = useState<Set<MachineModuleId>>(new Set());
  const [versionNumber, setVersionNumber] = useState(0);
  const [machineName] = useState('PLAYER MACHINE');
  const [tab, setTab] = useState<BuilderTab>('BUILD');
  const [compiling, setCompiling] = useState(false);
  const [compiled, setCompiled] = useState(false);
  const [compiledVersion, setCompiledVersion] = useState<string>('');

  const activeDef = MODULES.find(m => m.id === activeModule)!;

  const installModule = useCallback((id: MachineModuleId) => {
    setInstalledModules(prev => new Set([...prev, id]));
  }, []);

  const isInstalled = (id: MachineModuleId) => installedModules.has(id);
  const allInstalled = MODULES.every(m => installedModules.has(m.id));

  function handleCompile() {
    if (compiling) return;
    setCompiling(true);
    setCompiled(false);
    const nextVersion = versionNumber + 1;
    setVersionNumber(nextVersion);
    setCompiledVersion(versionString(nextVersion));
  }

  function handleCompileComplete() {
    setCompiling(false);
    setCompiled(true);
    const machine: PlayerMachine = {
      machineId: `player_${Date.now()}`,
      name: machineName,
      version: compiledVersion,
      versionNumber,
      config,
      compiledAt: new Date().toISOString(),
      installedModules: [...installedModules],
      arenasCompleted: [],
    };
    onCompiled?.(machine);
  }

  const funnel = funnelCounts(config);

  return (
    <div className="screen-fit bg-terminal-black terminal-screen font-mono flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-phosphor/15 bg-terminal-deep/60 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-phosphor-dim text-xs hover:text-phosphor transition-colors tracking-widest">
            ← BACK
          </button>
          <div className="h-4 w-px bg-phosphor/20" />
          <div>
            <div className="text-phosphor-dim text-xs tracking-widest">MACHINE BUILDER</div>
            <div className="text-phosphor text-sm font-bold">{machineName}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-phosphor-dim text-xs">
            {installedModules.size}/{MODULES.length} MODULES
          </div>
          <div className="text-phosphor text-xs font-bold">
            {versionString(versionNumber)}
          </div>
          {(['BUILD', 'SCHEMATIC', 'FUNNEL'] as BuilderTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs tracking-widest px-2.5 py-1 border transition-colors ${
                tab === t
                  ? 'border-phosphor text-phosphor bg-phosphor/8'
                  : 'border-phosphor/20 text-phosphor-dim hover:border-phosphor/35 hover:text-phosphor'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: module list ── */}
        <div className="hidden md:flex w-56 flex-shrink-0 border-r border-phosphor/10 flex-col">
          <div className="px-4 py-3 border-b border-phosphor/10 bg-terminal-deep/40">
            <div className="text-phosphor-dim text-xs tracking-widest">ARCHITECTURE</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {MODULES.map((mod, i) => {
              const installed = isInstalled(mod.id);
              const isActive = activeModule === mod.id;
              return (
                <button
                  key={mod.id}
                  onClick={() => setActiveModule(mod.id)}
                  className={`w-full text-left px-4 py-3 border-b border-phosphor/8 transition-all ${
                    isActive
                      ? 'bg-phosphor/8 border-l-2 border-l-phosphor'
                      : 'hover:bg-phosphor/4'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs"
                      style={{ color: installed ? '#0CD4A0' : '#27634E' }}
                    >
                      {installed ? '●' : '○'}
                    </span>
                    <div>
                      <div
                        className="text-xs font-bold tracking-wide"
                        style={{ color: installed ? '#0CD4A0' : isActive ? 'rgba(12,212,160,0.65)' : '#27634E' }}
                      >
                        {mod.sublabel} {mod.label}
                      </div>
                      <div className="text-phosphor-dim text-xs leading-snug mt-0.5" style={{ fontSize: '9px' }}>
                        {mod.question}
                      </div>
                    </div>
                  </div>

                  {/* Connector line */}
                  {i < MODULES.length - 1 && (
                    <div className="ml-1.5 mt-1.5 h-2 border-l border-phosphor/15" />
                  )}
                </button>
              );
            })}
          </div>

        </div>

        {/* ── Center: module editor / compile / schematic ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── BUILD TAB ── */}
          {tab === 'BUILD' && !compiling && (
            <div className="p-6 max-w-2xl">

              {/* Module header */}
              <div className="mb-5">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-phosphor-dim text-xs tracking-widest">{activeDef.sublabel}</span>
                  <span className="text-phosphor font-bold text-lg tracking-wide">{activeDef.label}</span>
                  {isInstalled(activeModule) && (
                    <span className="text-paper-green text-xs tracking-widest border border-paper-green/30 px-2 py-0.5">INSTALLED</span>
                  )}
                </div>
                <div className="text-phosphor-mid text-sm mb-2">{activeDef.question}</div>
                <div className="border-l-2 border-phosphor/20 pl-3 text-phosphor-dim text-xs leading-relaxed">
                  {activeDef.rfrlNote}
                </div>
              </div>

              {/* Module-specific editor */}
              <ModuleEditor
                module={activeModule}
                config={config}
                onConfigChange={setConfig}
              />

              {/* Install button */}
              <button
                onClick={() => installModule(activeModule)}
                className={`mt-5 w-full py-2.5 text-xs tracking-widest border transition-colors ${
                  isInstalled(activeModule)
                    ? 'border-paper-green/40 text-paper-green bg-paper-green/5 cursor-default'
                    : 'border-phosphor/50 text-phosphor hover:bg-phosphor/10'
                }`}
              >
                {isInstalled(activeModule) ? '✓ INSTALLED' : 'INSTALL MODULE →'}
              </button>

              {/* Next module hint */}
              {!isInstalled(activeModule) && (
                <div className="mt-2 text-phosphor-dim text-xs text-center">
                  Configure options above then install
                </div>
              )}
            </div>
          )}

          {/* ── COMPILE ANIMATION ── */}
          {compiling && (
            <div className="p-6 max-w-md">
              <MachineCompile
                machineName={machineName}
                version={compiledVersion}
                checks={buildCompileChecks(config)}
                checkIntervalMs={160}
                onComplete={handleCompileComplete}
              />
            </div>
          )}

          {/* ── SCHEMATIC TAB ── */}
          {tab === 'SCHEMATIC' && !compiling && (
            <div className="p-6">
              <div className="text-phosphor-dim text-xs tracking-widest mb-4">MACHINE SCHEMATIC · {versionString(versionNumber)}</div>
              <MachineSchematic config={config} installedModules={installedModules} />
            </div>
          )}

          {/* ── FUNNEL TAB ── */}
          {tab === 'FUNNEL' && !compiling && (
            <div className="p-6 max-w-md">
              <div className="text-phosphor-dim text-xs tracking-widest mb-4">UNIVERSE FUNNEL</div>
              <UniverseFunnel funnel={funnel} config={config} />
            </div>
          )}
        </div>

        {/* ── Right: installed summary ── */}
        <div className="hidden xl:flex w-52 flex-shrink-0 border-l border-phosphor/10 flex-col">
          <div className="px-4 py-3 border-b border-phosphor/10 bg-terminal-deep/40">
            <div className="text-phosphor-dim text-xs tracking-widest">INSTALLED</div>
          </div>
          <div className="flex-1 px-4 py-3 overflow-y-auto space-y-3">
            {MODULES.map(mod => {
              const installed = isInstalled(mod.id);
              return (
                <div key={mod.id} className={`text-xs ${installed ? '' : 'opacity-35'}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span style={{ color: installed ? '#0CD4A0' : '#27634E', fontSize: '8px' }}>
                      {installed ? '●' : '○'}
                    </span>
                    <span className={installed ? 'text-phosphor' : 'text-phosphor-dim'}>
                      {mod.label}
                    </span>
                  </div>
                  {installed && (
                    <div className="text-phosphor-dim pl-3.5" style={{ fontSize: '9px' }}>
                      {getInstalledSummary(mod.id, config)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Version history */}
          <div className="border-t border-phosphor/10 px-4 py-3">
            <div className="text-phosphor-dim text-xs tracking-widest mb-2">VERSION</div>
            <div className="text-phosphor font-bold text-lg">{versionString(versionNumber)}</div>
            {compiled && (
              <div className="text-paper-green text-xs mt-0.5">COMPILED</div>
            )}
            <div className="text-phosphor-dim text-xs mt-2 leading-snug" style={{ fontSize: '9px' }}>
              {versionNumber === 0
                ? 'NOT YET COMPILED'
                : `COMPILED ${versionNumber} TIME${versionNumber !== 1 ? 'S' : ''}`}
            </div>
          </div>
        </div>
      </div>

      {/* Installing a module is the decision; compiling the version is the
          commit — same territory as COMMIT DECISION in a run. */}
      <ActionZone
        variant="inline"
        note={
          compiling
            ? 'COMPILING…'
            : compiled
              ? `✓ ${compiledVersion} READY`
              : `${installedModules.size}/${MODULES.length} MODULES INSTALLED · ${versionString(versionNumber + 1)} NEXT`
        }
        primary={{
          label: allInstalled ? 'COMPILE MACHINE' : `COMPILE PARTIAL (${installedModules.size}/${MODULES.length})`,
          onClick: handleCompile,
          disabled: installedModules.size === 0 || compiling,
          disabledHint: compiling ? 'BUILD IN PROGRESS' : 'INSTALL AT LEAST ONE MODULE',
          keyHint: '[ENTER]',
        }}
      />
    </div>
  );
}

// ─── Module editor sub-components ────────────────────────────────────────────

function OptionGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: MachineOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`w-full text-left p-3 border transition-all ${
            value === opt.value
              ? 'border-phosphor bg-phosphor/8 text-phosphor'
              : 'border-phosphor/15 text-phosphor-dim hover:border-phosphor/35 hover:text-phosphor-mid'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-xs mt-0.5 flex-shrink-0">
              {value === opt.value ? '◉' : '○'}
            </span>
            <div>
              <div className="text-xs font-bold tracking-wide">{opt.label}</div>
              <div className="text-xs leading-snug mt-0.5 opacity-70">{opt.detail}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function GuardrailEditor({
  guardrails,
  onChange,
}: {
  guardrails: GuardrailConfig;
  onChange: (g: GuardrailConfig) => void;
}) {
  const fields: { key: keyof GuardrailConfig; label: string; min: number; max: number; step: number; format: (v: number) => string }[] = [
    { key: 'maxPositionPct', label: 'MAX SINGLE POSITION', min: 0.03, max: 0.25, step: 0.01, format: v => `${Math.round(v * 100)}%` },
    { key: 'maxSectorPct', label: 'MAX SECTOR EXPOSURE', min: 0.1, max: 0.5, step: 0.05, format: v => `${Math.round(v * 100)}%` },
    { key: 'maxCorrelation', label: 'MAX PORTFOLIO ρ', min: 0.5, max: 0.99, step: 0.05, format: v => v.toFixed(2) },
    { key: 'drawdownGatePct', label: 'DRAWDOWN GATE (PAUSE)', min: -0.30, max: -0.05, step: 0.01, format: v => `${(v * 100).toFixed(0)}%` },
    { key: 'cashFloorPct', label: 'CASH FLOOR', min: 0, max: 0.20, step: 0.01, format: v => `${Math.round(v * 100)}%` },
  ];

  return (
    <div className="space-y-4">
      {fields.map(f => (
        <div key={f.key}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-phosphor-dim tracking-widest">{f.label}</span>
            <span className="text-phosphor font-bold tabular-nums">
              {f.format(guardrails[f.key] as number)}
            </span>
          </div>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={guardrails[f.key] as number}
            onChange={e => onChange({ ...guardrails, [f.key]: parseFloat(e.target.value) })}
            className="w-full accent-phosphor cursor-pointer"
            style={{ accentColor: '#0CD4A0' }}
          />
          <div className="flex justify-between text-phosphor-dim mt-0.5" style={{ fontSize: '9px' }}>
            <span>{f.format(f.min)}</span>
            <span>{f.format(f.max)}</span>
          </div>
        </div>
      ))}

      {/* Guardrail rationale */}
      <div className="border-l-2 border-phosphor/20 pl-3 text-phosphor-dim text-xs leading-relaxed">
        Current guardrails: max {Math.round(guardrails.maxPositionPct * 100)}% single name,
        max {Math.round(guardrails.maxSectorPct * 100)}% sector,
        pause trading at {Math.round(guardrails.drawdownGatePct * 100)}% drawdown.
        {guardrails.maxPositionPct > 0.15 && (
          <span className="text-alert-amber"> MAX POSITION IS HIGH — concentration risk.</span>
        )}
        {guardrails.maxSectorPct > 0.35 && (
          <span className="text-alert-amber"> SECTOR LIMIT IS HIGH — systemic risk.</span>
        )}
      </div>
    </div>
  );
}

function ModuleEditor({
  module,
  config,
  onConfigChange,
}: {
  module: MachineModuleId;
  config: MachineConfig;
  onConfigChange: (c: MachineConfig) => void;
}) {
  switch (module) {
    case 'UNIVERSE':
      return (
        <OptionGrid<UniverseChoice>
          options={UNIVERSE_OPTIONS}
          value={config.universe}
          onChange={v => onConfigChange({ ...config, universe: v })}
        />
      );
    case 'ELIGIBILITY':
      return (
        <OptionGrid<EligibilityChoice>
          options={ELIGIBILITY_OPTIONS}
          value={config.eligibility}
          onChange={v => onConfigChange({ ...config, eligibility: v })}
        />
      );
    case 'SIGNAL':
      return (
        <OptionGrid<SignalChoice>
          options={SIGNAL_OPTIONS}
          value={config.signal}
          onChange={v => onConfigChange({ ...config, signal: v })}
        />
      );
    case 'CONSTRUCTION':
      return (
        <OptionGrid<ConstructionChoice>
          options={CONSTRUCTION_OPTIONS}
          value={config.construction}
          onChange={v => onConfigChange({ ...config, construction: v })}
        />
      );
    case 'GUARDRAILS':
      return (
        <GuardrailEditor
          guardrails={config.guardrails}
          onChange={g => onConfigChange({ ...config, guardrails: g })}
        />
      );
    case 'EXECUTION':
      return (
        <OptionGrid<ExecutionChoice>
          options={EXECUTION_OPTIONS}
          value={config.execution}
          onChange={v => onConfigChange({ ...config, execution: v })}
        />
      );
    case 'MONITORING':
      return (
        <OptionGrid<MonitoringChoice>
          options={MONITORING_OPTIONS}
          value={config.monitoring}
          onChange={v => onConfigChange({ ...config, monitoring: v })}
        />
      );
  }
}

// ─── Machine schematic ────────────────────────────────────────────────────────

function MachineSchematic({
  config,
  installedModules,
}: {
  config: MachineConfig;
  installedModules: Set<MachineModuleId>;
}) {
  const rows: { id: MachineModuleId; label: string; value: string }[] = [
    { id: 'UNIVERSE', label: 'UNIVERSE', value: UNIVERSE_OPTIONS.find(o => o.value === config.universe)?.label ?? '—' },
    { id: 'ELIGIBILITY', label: 'ELIGIBILITY FILTER', value: ELIGIBILITY_OPTIONS.find(o => o.value === config.eligibility)?.label ?? '—' },
    { id: 'SIGNAL', label: 'SIGNAL / REGIME LOGIC', value: SIGNAL_OPTIONS.find(o => o.value === config.signal)?.label ?? '—' },
    { id: 'CONSTRUCTION', label: 'PORTFOLIO CONSTRUCTION', value: CONSTRUCTION_OPTIONS.find(o => o.value === config.construction)?.label ?? '—' },
    { id: 'GUARDRAILS', label: 'RISK GUARDRAILS', value: `${Math.round(config.guardrails.maxPositionPct * 100)}% / ${Math.round(config.guardrails.maxSectorPct * 100)}% / DD${Math.round(config.guardrails.drawdownGatePct * 100)}%` },
    { id: 'EXECUTION', label: 'EXECUTION', value: EXECUTION_OPTIONS.find(o => o.value === config.execution)?.label ?? '—' },
    { id: 'MONITORING', label: 'MONITORING', value: MONITORING_OPTIONS.find(o => o.value === config.monitoring)?.label ?? '—' },
  ];

  return (
    <div className="max-w-lg">
      {rows.map((row, i) => {
        const installed = installedModules.has(row.id);
        return (
          <div key={row.id}>
            <div
              className="border px-4 py-3 transition-all"
              style={{
                borderColor: installed ? 'rgba(12,212,160,0.4)' : 'rgba(12,212,160,0.1)',
                background: installed ? 'rgba(12,212,160,0.04)' : 'transparent',
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div
                    className="text-xs font-bold tracking-wide"
                    style={{ color: installed ? '#0CD4A0' : '#27634E' }}
                  >
                    {installed ? '● ' : '○ '}{row.label}
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{
                      color: installed ? 'rgba(12,212,160,0.7)' : 'rgba(12,212,160,0.2)',
                      fontSize: '10px',
                    }}
                  >
                    {installed ? row.value : 'NOT INSTALLED'}
                  </div>
                </div>
                <div
                  className="text-xs"
                  style={{ color: installed ? '#0CD4A0' : '#27634E', fontSize: '9px' }}
                >
                  {installed ? 'ONLINE' : 'OFFLINE'}
                </div>
              </div>
            </div>
            {i < rows.length - 1 && (
              <div
                className="ml-6 h-4 border-l"
                style={{ borderColor: installed ? 'rgba(12,212,160,0.3)' : 'rgba(12,212,160,0.08)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Universe funnel ─────────────────────────────────────────────────────────

function UniverseFunnel({
  funnel,
  config,
}: {
  funnel: { start: number; afterFund: number; afterLiq: number; final: number };
  config: MachineConfig;
}) {
  const FILL = '█';
  const EMPTY = '░';
  const BAR = 32;

  function bar(count: number, max: number): string {
    const filled = Math.round((count / max) * BAR);
    return FILL.repeat(filled) + EMPTY.repeat(BAR - filled);
  }

  const max = funnel.start;

  const steps: { label: string; count: number; filter: string }[] = [
    { label: 'INITIAL UNIVERSE', count: funnel.start, filter: UNIVERSE_OPTIONS.find(o => o.value === config.universe)?.label ?? '' },
    { label: 'AFTER FUNDAMENTAL', count: funnel.afterFund, filter: 'QUALITY + EARNINGS FILTER' },
    { label: 'AFTER LIQUIDITY', count: funnel.afterLiq, filter: 'LIQUIDITY + VOLUME SCREEN' },
    { label: 'ACTIVE UNIVERSE', count: funnel.final, filter: ELIGIBILITY_OPTIONS.find(o => o.value === config.eligibility)?.label ?? '' },
  ];

  return (
    <div className="space-y-4">
      {steps.map((step, i) => (
        <div key={step.label}>
          <div className="text-phosphor-dim text-xs tracking-widest mb-1" style={{ fontSize: '9px' }}>
            {step.filter}
          </div>
          <div className="font-mono text-xs" style={{ color: i === steps.length - 1 ? '#0CD4A0' : 'rgba(12,212,160,0.55)' }}>
            {bar(step.count, max)}
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-phosphor-dim text-xs">{step.label}</span>
            <span className={`text-sm font-bold tabular-nums ${i === steps.length - 1 ? 'text-phosphor' : 'text-phosphor-dim'}`}>
              {step.count.toLocaleString()}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="text-phosphor-dim ml-2 mt-1" style={{ fontSize: '11px' }}>↓</div>
          )}
        </div>
      ))}

      <div className="border-t border-phosphor/10 pt-3 text-xs text-phosphor-dim leading-relaxed">
        <div className="text-phosphor font-bold mb-1">MACHINE SEES {funnel.final.toLocaleString()} EQUITIES</div>
        <div>
          Systematic investing begins before the first buy decision.
          Your machine has already filtered {(funnel.start - funnel.final).toLocaleString()} names.
        </div>
        {config.eligibility === 'ROBUSTNESS' && (
          <div className="text-paper-green mt-1">
            MATCHES REFI GOOD-FIT LAYER — 292 SYMBOLS
          </div>
        )}
        {config.eligibility === 'FUNDAMENTAL_LIQUIDITY' && (
          <div className="text-phosphor-mid mt-1">
            MATCHES REFI FULL BASKET APPROACH — 355 SYMBOLS
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Installed summary helper ─────────────────────────────────────────────────

function getInstalledSummary(id: MachineModuleId, config: MachineConfig): string {
  switch (id) {
    case 'UNIVERSE': return UNIVERSE_OPTIONS.find(o => o.value === config.universe)?.label ?? '';
    case 'ELIGIBILITY': return ELIGIBILITY_OPTIONS.find(o => o.value === config.eligibility)?.label ?? '';
    case 'SIGNAL': return SIGNAL_OPTIONS.find(o => o.value === config.signal)?.label ?? '';
    case 'CONSTRUCTION': return CONSTRUCTION_OPTIONS.find(o => o.value === config.construction)?.label ?? '';
    case 'GUARDRAILS': return `MAX POS ${Math.round(config.guardrails.maxPositionPct * 100)}% / SECTOR ${Math.round(config.guardrails.maxSectorPct * 100)}%`;
    case 'EXECUTION': return EXECUTION_OPTIONS.find(o => o.value === config.execution)?.label ?? '';
    case 'MONITORING': return MONITORING_OPTIONS.find(o => o.value === config.monitoring)?.label ?? '';
  }
}
