// ─── Core action types ────────────────────────────────────────────────────────

export type ActionCode =
  | 'HOLD'
  | 'REDUCE'
  | 'ROTATE_DEFENSIVE'
  | 'ROTATE_RISK'
  | 'RAISE_CASH'
  | 'ADD_RISK'
  | 'STAGED_BUY'
  | 'STAGED_SELL';

export type ThesisCode =
  | 'DETERIORATING_FUNDAMENTALS'
  | 'PANIC_REDUCTION'
  | 'VOLATILITY_CONTROL'
  | 'LIQUIDITY_PRESERVATION'
  | 'VALUATION'
  | 'REGIME_CHANGE'
  | 'POLICY_RESPONSE'
  | 'THESIS_UNCHANGED'
  | 'DIVERSIFICATION'
  | 'MOMENTUM'
  | 'CONTRARIAN'
  // Recorded when the player commits and lets the thesis prompt time out.
  // Decisiveness without articulated reasoning is its own behavioral signal,
  // so it is a real value rather than a missing one. Never offered as a chip.
  | 'THESIS_UNSTATED';

export type DecisionQuality = 'EXCELLENT' | 'GOOD' | 'NEUTRAL' | 'POOR' | 'CRITICAL_ERROR';

export type BehavioralFlag =
  | 'ACTION_BIAS'
  | 'ANCHORING'
  | 'PANIC_REDUCTION_LARGE'
  | 'HIGH_CONVICTION_ACTION'
  | 'CONFIDENCE_SIZE_MISMATCH'
  | 'THESIS_CONTRADICTION'
  | 'RECENCY_BIAS'
  | 'REENTRY_DELAY'
  | 'CHASING'
  | 'PATIENCE_POSITIVE'
  | 'ADAPTATION_EVENT'
  | 'EARLY_REGIME_SENSITIVITY'
  | 'GOOD_PROCESS'
  | 'CASH_DRAG'
  | 'OVERCONFIDENCE'
  | 'CONTRARIAN_EARLY';

// ─── Terminal modules ─────────────────────────────────────────────────────────

export type ModuleCode =
  | 'PRICE_RETURN'          // Always unlocked
  | 'PORTFOLIO_SUMMARY'     // Always unlocked
  | 'SECTOR_EXPOSURE'       // Always unlocked
  | 'NEWS_FEED'             // Always unlocked
  | 'CORRELATION_MATRIX'    // Unlock 1: After COVID Phase 2
  | 'DRAWDOWN_MAP'          // Unlock 2: After first crisis complete
  | 'REGIME_SCANNER'        // Unlock 3: After Recovery arena
  | 'STAGED_EXECUTION'      // Unlock 4: After 200 Alpha XP
  | 'BASKET_WRITER'         // Unlock 5: Progression
  | 'POLICY_WRITER'         // Unlock 6: After Basket Writer
  | 'MACHINE_AUDIT';        // Unlock 7: Late game

export interface TerminalModule {
  code: ModuleCode;
  label: string;
  key: string;
  description: string;
  unlockRequirement: string;
  alwaysAvailable: boolean;
}

// ─── Checkpoint data types ────────────────────────────────────────────────────

export type CheckpointPhase =
  | 'BACKGROUND_NOISE'
  | 'REGIME_RECOGNITION'
  | 'PANIC'
  | 'POLICY_INTERVENTION'
  | 'BOTTOMING'
  | 'RECOVERY_REENTRY';

export interface MarketSignal {
  indicator: string;
  value: string;
  direction: 'up' | 'down' | 'neutral';
  magnitude: 'low' | 'medium' | 'high' | 'extreme';
}

export interface EventFeedItem {
  category: string;
  text: string;
  relevantAssets?: string[];
}

export interface MachineDecision {
  actionCode: ActionCode;
  reasoning: string[];
  policyReason: string;
  targetChanges: { asset: string; direction: 'increase' | 'decrease' | 'hold'; magnitude: number }[];
}

export interface BranchEffect {
  flagsAdd: BehavioralFlag[];
  alphaImpact: Partial<Record<DimensionCode, number>>;
  futurePrompts?: string[];
  teachingMessage?: string;
  // Per USA Build Integration Spec §3.3 this arrives as a string today
  // and migrates to a typed BenchmarkSnapshotRef alongside the §69
  // "benchmark snapshot attached to every machine comparison" rollout.
  machineComparison?: string;
}

export interface ActionBranch {
  actionCode: ActionCode;
  label: string;
  shortLabel: string;
  // The 2 to 3 theses offered for this stance after commit. Absent, a default
  // set is derived per action code. Authoring these per branch is a copy-pass
  // item (Addendum B section B3).
  thesisOptions?: ThesisCode[];
  // Fixed, authored turnover price of taking this stance. The run's turnover
  // budget is a finite, deterministic resource: no estimate, no noise term.
  // HOLD is always 0.
  turnoverCost: number;
  branchEffect: BranchEffect;
  // Kept optional at the outer level for content authored before
  // `machineComparison` moved into BranchEffect (see BranchEffect note).
  machineComparison?: string;
}

export interface CheckpointData {
  sequence: number;
  // The machine's score to beat at this checkpoint. Par is content, not engine
  // logic, so the rules-machine export pipeline can later overwrite these rows
  // without touching the scoring engine. It is published in the UI: difficulty
  // is legible, never hidden.
  machinePar: number;
  phase: CheckpointPhase;
  crisisDay: string;
  signalTitle: string;
  signalBody: string;
  marketSignals: MarketSignal[];
  eventFeed: EventFeedItem[];
  portfolioEffect: {
    returnBias: number;        // Expected return contribution this checkpoint
    volatilityDelta: number;   // Volatility change
    correlationLevel: number;  // Cross-asset correlation 0-1
    // Optional authored per-symbol returns for this checkpoint. Where absent,
    // every position moves by the checkpoint return exactly. No noise term:
    // run state must be reproducible from the decision sequence alone.
    positionReturns?: Record<string, number>;
    // Optional authored machine drawdown at this checkpoint. Scoring uses it
    // when present and never fabricates one when it is absent.
    machineDrawdown?: number;
  };
  machineDecision: MachineDecision;
  availableActions: ActionBranch[];
  teachingPoint: string;
  isRegimeChange: boolean;
  isHoldValid: boolean;       // Whether HOLD is genuinely the best action
  holdTeaching?: string;      // What holding earns/costs
}

// ─── Portfolio state ──────────────────────────────────────────────────────────

export interface PortfolioPosition {
  symbol: string;
  weight: number;
  pnl: number;
  riskContrib: number;
  sector: string;
}

export interface PortfolioState {
  value: number;
  cashWeight: number;
  positions: PortfolioPosition[];
  // High-water mark. Ratchets up only; drawdown is measured against it so a
  // recovered-then-fallen run reports the real decline, not decline-from-start.
  peakValue: number;
  drawdown: number;
  volatility: number;
  sectorExposure: Record<string, number>;
  turnoverUsed: number;
  correlationIndex: number;
}

// ─── Run state ────────────────────────────────────────────────────────────────

export type RunPhase =
  | 'SIGNAL'
  | 'INVESTIGATING'
  | 'COMMITTING'
  | 'RESOLVING'
  | 'COMPARING'
  | 'LEARNING'
  | 'COMPLETE';

export interface RunDecision {
  checkpointSequence: number;
  actionCode: ActionCode;
  thesisCode?: ThesisCode;
  confidence?: number;
  modulesConsulted: ModuleCode[];
  turnoverCost: number;
  scoreContribution: number;
  quality: DecisionQuality;
  behavioralFlags: BehavioralFlag[];
  machineActionCode: ActionCode;
  committed: boolean;
}

export interface RunState {
  id: string | null;
  /**
   * The run's determinism anchor (§54 `arena_runs.seed`, §65 "deterministic
   * replay from run seed"). Chosen once when the run opens and never again, so
   * a stored record plus its decision sequence reproduces the run exactly.
   *
   * The engine only carries it. Generating it means reading a clock or an RNG,
   * which the engine may not do, so the seed is injected from the React layer.
   */
  seed: number;
  arenaId: string;
  machineId: string;
  currentCheckpoint: number;
  totalCheckpoints: number;
  phase: RunPhase;
  portfolio: PortfolioState;
  // Finite run-scoped turnover allowance. Non-HOLD stances are unavailable
  // once turnoverUsed reaches it.
  turnoverBudget: number;
  playerScore: number;
  machineScore: number;
  decisions: RunDecision[];
  criticalFailure: boolean;
  // The checkpoint at which the critical drawdown was first crossed, so the
  // run can say where it happened rather than only that it did.
  criticalFailureCheckpoint: number | null;
  activeModules: ModuleCode[];
  investigatedModules: ModuleCode[];
  pendingAction: ActionCode | null;
  // No pendingThesis: thesis is not an input to the commit. It is attached to
  // the committed decision afterwards and can never revise it (Addendum C
  // section C.5).
  pendingConfidence: number;
  result: 'ACTIVE' | 'PASSED' | 'FAILED' | 'MACHINE_BEATEN' | 'ABANDONED';
}

// ─── Progression types ────────────────────────────────────────────────────────

export type DimensionCode =
  | 'STOCK_SELECTION'
  | 'POSITION_SIZING'
  | 'LOSS_CONTROL'
  | 'REENTRY_DISCIPLINE'
  | 'TURNOVER_DISCIPLINE'
  | 'REGIME_ADAPTATION'
  | 'RULE_ADHERENCE'
  | 'ACTION_BIAS_SCORE'
  | 'CONCENTRATION_CONTROL'
  | 'DECISION_CONSISTENCY';

export type Archetype =
  | 'REGIME_HUNTER'
  | 'DEFENSIVE_ALLOCATOR'
  | 'MOMENTUM_RIDER'
  | 'CONTRARIAN'
  | 'RISK_ARCHITECT'
  | 'PATIENT_COMPOUNDER'
  | 'TACTICAL_ROTATOR'
  | 'POLICY_BUILDER'
  | 'UNCLASSIFIED';

export type RankCode =
  | 'INITIATE'
  | 'ANALYST'
  | 'ASSOCIATE'
  | 'PORTFOLIO_MANAGER'
  | 'SENIOR_PM'
  | 'CHIEF_INVESTMENT_OFFICER';

export interface PlayerProfile {
  sessionId: string;
  handle: string | null;
  alphaXp: number;
  rankCode: RankCode;
  machineBeats: number;
  machineAttempts: number;
  currentStreak: number;
  bestStreak: number;
  archetype: Archetype;
  decisionStreak: number;
  lastActiveDate: string | null;
  dimensions: Record<DimensionCode, { score: number; sampleSize: number }>;
  unlockedModules: ModuleCode[];
  machineLadder: Record<string, { wins: number; losses: number; status: 'LOCKED' | 'ACTIVE' | 'DEFEATED' }>;
}

// ─── Benchmark snapshot ───────────────────────────────────────────────────────

export type BenchmarkSourceType =
  | 'ANALYZE_API'
  | 'RESEARCH_PAPER'
  | 'HISTORICAL_WALK_FORWARD'
  | 'GAME_RULES_ENGINE';

export interface BenchmarkSnapshot {
  benchmarkId: string;
  displayName: string;
  generatedAt: string;
  sourceType: BenchmarkSourceType;
  sourceRunId?: string;
  universe: {
    type: string;
    symbolCount: number;
  };
  period: {
    firstTradingDay: string;
    lastTradingDay: string;
    businessDays: number;
    note?: string;
  };
  exposureModel: {
    longAllowed: boolean;
    shortAllowed: boolean;
    cashAllowed: boolean;
  };
  methodology: {
    modelVersion: string;
    costModelVersion: string;
    riskFreeRate?: number;
  };
  stats: {
    cagr: number;
    volatility: number;
    sharpe: number;
    sortino?: number;
    maxDrawdown: number;
    calmar?: number;
    alphaAnnualized?: number;
    betaVsSpy?: number;
    winDays?: number;
    winMonths?: number;
  };
}

// ─── Machine ladder ───────────────────────────────────────────────────────────

export interface MachineBenchmark {
  id: string;
  rank: number;
  label: string;
  subtitle: string;
  description: string;
  xpRequired: number;
  trainingCutoff: string;
  riskPolicy: string;
  auditId: string;
  message: string;
  // When sourced from real benchmark data, the snapshot is attached
  snapshot?: BenchmarkSnapshot;
  // Contest fairness designation
  contestType?: 'FAIR_MATCH' | 'EXHIBITION';
}

// ─── Daily tape ───────────────────────────────────────────────────────────────

export interface DailyTape {
  id: string;
  date: string;
  title: string;
  signals: EventFeedItem[];
  marketData: MarketSignal[];
  availableActions: { code: ActionCode; label: string }[];
  correctAction: ActionCode;
  machineAction: ActionCode;
  explanation: string;
  playerScore: number;
  machineScore: number;
  crowdDistribution: Record<ActionCode, number>;
}

// ─── Visual event system ─────────────────────────────────────────────────────

export type GameVisualEventType =
  | 'MARKET_SHOCK'
  | 'CORRELATION_COLLAPSE'
  | 'VOLATILITY_SPIKE'
  | 'DRAWDOWN_WARNING'
  | 'RISK_LIMIT_BREACH'
  | 'SECTOR_ROTATION'
  | 'CASH_RAISED'
  | 'CAPITAL_DEPLOYED'
  | 'MACHINE_ACTION_REVEAL'
  | 'MACHINE_ADVANTAGE'
  | 'HUMAN_ADVANTAGE'
  | 'REGIME_SHIFT'
  | 'POLICY_SHOCK'
  | 'POLICY_REVERSAL'
  | 'PATTERN_FAILURE'
  | 'BANK_CONTAGION'
  | 'INFLATION_PRESSURE'
  | 'SUPPLY_CHAIN_STRESS'
  | 'MACHINE_MODULE_INSTALLED'
  | 'MACHINE_VERSION_COMPILED'
  | 'ARENA_UNLOCKED'
  | 'BOSS_UNLOCKED'
  | 'AUTOPSY_REPLAY';

// Priority scale: 100 (critical) → 30 (ambient)
export const VISUAL_PRIORITY: Record<GameVisualEventType, number> = {
  MACHINE_VERSION_COMPILED:  95,
  BOSS_UNLOCKED:             95,
  REGIME_SHIFT:              90,
  POLICY_SHOCK:              80,
  POLICY_REVERSAL:           80,
  MARKET_SHOCK:              75,
  MACHINE_ACTION_REVEAL:     70,
  BANK_CONTAGION:            65,
  CORRELATION_COLLAPSE:      60,
  DRAWDOWN_WARNING:          60,
  RISK_LIMIT_BREACH:         60,
  INFLATION_PRESSURE:        55,
  MACHINE_MODULE_INSTALLED:  50,
  ARENA_UNLOCKED:            50,
  VOLATILITY_SPIKE:          45,
  CASH_RAISED:               40,
  CAPITAL_DEPLOYED:          40,
  MACHINE_ADVANTAGE:         40,
  HUMAN_ADVANTAGE:           40,
  SECTOR_ROTATION:           35,
  SUPPLY_CHAIN_STRESS:       35,
  PATTERN_FAILURE:           30,
  AUTOPSY_REPLAY:            30,
};

export interface GameVisualEvent {
  id: string;
  type: GameVisualEventType;
  intensity: number;        // 0-1
  durationMs: number;
  blocking: boolean;
  affectedSymbols?: string[];
  affectedSectors?: string[];
  payload: Record<string, unknown>;
  createdAt: string;
}

// ─── Machine Builder ──────────────────────────────────────────────────────────

// The 7 architectural layers of a systematic equity machine,
// mirroring the actual RF/RL documented process.

export type MachineModuleId =
  | 'UNIVERSE'
  | 'ELIGIBILITY'
  | 'SIGNAL'
  | 'CONSTRUCTION'
  | 'GUARDRAILS'
  | 'EXECUTION'
  | 'MONITORING';

export interface MachineOption<T extends string = string> {
  value: T;
  label: string;
  detail: string;
}

// Universe module
export type UniverseChoice = 'US_ALL' | 'SP500' | 'US_LIQUID';

// Eligibility filter
export type EligibilityChoice = 'NONE' | 'FUNDAMENTAL' | 'FUNDAMENTAL_LIQUIDITY' | 'ROBUSTNESS';

// Signal / regime logic
export type SignalChoice = 'PRICE_MOMENTUM' | 'REGIME_CLASSIFIER' | 'RF_RL_PIPELINE' | 'QUALITY_FACTOR';

// Portfolio construction
export type ConstructionChoice = 'EQUAL_WEIGHT' | 'RISK_PARITY' | 'SIGNAL_WEIGHTED' | 'CONSTRAINED_OPT';

// Risk guardrails
export interface GuardrailConfig {
  maxPositionPct: number;    // e.g. 0.10
  maxSectorPct: number;      // e.g. 0.25
  maxCorrelation: number;    // e.g. 0.85
  drawdownGatePct: number;   // e.g. -0.15 — pause trading if DD exceeds this
  cashFloorPct: number;      // e.g. 0.05
}

// Execution timeliness
export type ExecutionChoice = 'DAILY_CLOSE' | 'INTRADAY_1H' | 'WEEKLY' | 'STAGED_3TRANCHE';

// Monitoring
export type MonitoringChoice = 'PASSIVE' | 'CORRELATION_ALERT' | 'REGIME_SCANNER' | 'FULL_RISK_MONITOR';

export interface MachineConfig {
  universe: UniverseChoice;
  eligibility: EligibilityChoice;
  signal: SignalChoice;
  construction: ConstructionChoice;
  guardrails: GuardrailConfig;
  execution: ExecutionChoice;
  monitoring: MonitoringChoice;
}

export interface PlayerMachine {
  machineId: string;
  name: string;
  version: string;            // e.g. "v0.3"
  versionNumber: number;      // 0, 1, 2, 3 … 10 (maps to v0.0–v1.0)
  config: MachineConfig;
  compiledAt: string | null;
  installedModules: MachineModuleId[];
  arenasCompleted: string[];  // arenaIds where this machine version competed
}

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxPositionPct: 0.10,
  maxSectorPct: 0.25,
  maxCorrelation: 0.85,
  drawdownGatePct: -0.15,
  cashFloorPct: 0.05,
};

export const DEFAULT_MACHINE_CONFIG: MachineConfig = {
  universe: 'US_LIQUID',
  eligibility: 'FUNDAMENTAL_LIQUIDITY',
  signal: 'REGIME_CLASSIFIER',
  construction: 'CONSTRAINED_OPT',
  guardrails: { ...DEFAULT_GUARDRAILS },
  execution: 'DAILY_CLOSE',
  monitoring: 'CORRELATION_ALERT',
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface CheckpointScore {
  raerScore: number;
  drawdownScore: number;
  downsideScore: number;
  recoveryScore: number;
  regimeAdaptScore: number;
  turnoverScore: number;
  consistencyScore: number;
  positionSizingScore: number;
  totalScore: number;
  machineScore: number;
  delta: number;
  quality: DecisionQuality;
}
