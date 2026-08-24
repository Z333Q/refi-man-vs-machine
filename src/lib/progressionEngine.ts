import type { ModuleCode, TerminalModule, MachineBenchmark, BenchmarkSnapshot, RankCode, PlayerProfile, DimensionCode } from './gameTypes';

// ─── Terminal modules ─────────────────────────────────────────────────────────

// All modules support U.S. equity analysis only.
// The player's terminal becomes more capable as they earn Alpha XP.
export const TERMINAL_MODULES: TerminalModule[] = [
  {
    code: 'PRICE_RETURN',
    label: 'PRICE & RETURN',
    key: 'P',
    description: 'Equity prices, position P&L, and portfolio return vs. S&P 500',
    unlockRequirement: 'Always available',
    alwaysAvailable: true,
  },
  {
    code: 'PORTFOLIO_SUMMARY',
    label: 'PORTFOLIO',
    key: 'F',
    description: 'Portfolio value, cash weight, drawdown, and equity turnover used',
    unlockRequirement: 'Always available',
    alwaysAvailable: true,
  },
  {
    code: 'SECTOR_EXPOSURE',
    label: 'SECTOR MAP',
    key: 'S',
    description: 'U.S. equity sector concentration and GICS exposure breakdown',
    unlockRequirement: 'Always available',
    alwaysAvailable: true,
  },
  {
    code: 'NEWS_FEED',
    label: 'WIRE',
    key: 'N',
    description: 'Equity event wire service — earnings, guidance, M&A, management',
    unlockRequirement: 'Always available',
    alwaysAvailable: true,
  },
  {
    code: 'CORRELATION_MATRIX',
    label: 'CORRELATION MAP',
    key: 'C',
    description: 'Equity-to-equity correlation matrix — reveals hidden risk clusters across U.S. stock positions',
    unlockRequirement: 'Checkpoint 6 (COVID Phase 2)',
    alwaysAvailable: false,
  },
  {
    code: 'DRAWDOWN_MAP',
    label: 'DRAWDOWN MAP',
    key: 'D',
    description: 'Historical equity portfolio drawdown paths vs. your current trajectory',
    unlockRequirement: '100 Alpha XP',
    alwaysAvailable: false,
  },
  {
    code: 'REGIME_SCANNER',
    label: 'REGIME SCANNER',
    key: 'R',
    description: 'Probabilistic U.S. equity regime classification — bull, bear, transition, panic',
    unlockRequirement: '300 Alpha XP',
    alwaysAvailable: false,
  },
  {
    code: 'STAGED_EXECUTION',
    label: 'STAGED EXECUTION',
    key: 'E',
    description: 'Split equity orders into tranches across time — reduces entry timing risk',
    unlockRequirement: '200 Alpha XP',
    alwaysAvailable: false,
  },
  {
    code: 'BASKET_WRITER',
    label: 'BASKET WRITER',
    key: 'B',
    description: 'Construct and analyze custom U.S. equity portfolios — sector, factor, concentration diagnostics',
    unlockRequirement: 'Alpha Profile unlocked',
    alwaysAvailable: false,
  },
  {
    code: 'POLICY_WRITER',
    label: 'POLICY WRITER',
    key: 'W',
    description: 'Write systematic equity rules — position limits, sector caps, drawdown triggers, re-entry conditions',
    unlockRequirement: 'Basket Writer performance threshold',
    alwaysAvailable: false,
  },
  {
    code: 'MACHINE_AUDIT',
    label: 'MACHINE AUDIT',
    key: 'A',
    description: 'Inspect machine equity decision logic, data access, and training cutoff transparency',
    unlockRequirement: '500 Alpha XP + 3 machine victories',
    alwaysAvailable: false,
  },
];

export function getModuleByCode(code: ModuleCode): TerminalModule | undefined {
  return TERMINAL_MODULES.find(m => m.code === code);
}

export function getAvailableModules(unlockedModules: ModuleCode[]): TerminalModule[] {
  return TERMINAL_MODULES.filter(m => m.alwaysAvailable || unlockedModules.includes(m.code));
}

export function checkModuleUnlocks(profile: PlayerProfile, checkpointReached: number): ModuleCode[] {
  const newUnlocks: ModuleCode[] = [];

  if (checkpointReached >= 6 && !profile.unlockedModules.includes('CORRELATION_MATRIX')) {
    newUnlocks.push('CORRELATION_MATRIX');
  }
  if (profile.alphaXp >= 100 && !profile.unlockedModules.includes('DRAWDOWN_MAP')) {
    newUnlocks.push('DRAWDOWN_MAP');
  }
  if (profile.alphaXp >= 200 && !profile.unlockedModules.includes('STAGED_EXECUTION')) {
    newUnlocks.push('STAGED_EXECUTION');
  }
  if (profile.alphaXp >= 300 && !profile.unlockedModules.includes('REGIME_SCANNER')) {
    newUnlocks.push('REGIME_SCANNER');
  }
  if (profile.alphaXp >= 500 && profile.machineBeats >= 3 && !profile.unlockedModules.includes('MACHINE_AUDIT')) {
    newUnlocks.push('MACHINE_AUDIT');
  }

  return newUnlocks;
}

// ─── Canonical benchmark snapshots ────────────────────────────────────────────

// IMPORTANT: The OOS period for all real RF/RL benchmarks begins 2023-04-18.
// COVID (2020), Recovery (2020-2021), Inflation (2022), and Banking Stress
// (early 2023) arenas cannot legitimately claim the production OOS benchmark
// as their opponent. Those arenas use GAME_RULES_ENGINE or HISTORICAL_WALK_FORWARD
// benchmarks. Only post-April-2023 arenas may cite real OOS data.

export const BENCHMARK_SNAPSHOTS = {
  // /analyze API snapshot — primary versioned benchmark
  rfRlAnalyze2025: {
    benchmarkId: 'rf-rl-analyze-2025-11-21',
    displayName: 'ReFi RF/RL Benchmark Snapshot',
    generatedAt: '2025-11-21',
    sourceType: 'ANALYZE_API',
    universe: { type: 'U.S. LISTED EQUITY', symbolCount: 321 },
    period: {
      firstTradingDay: '2023-04-18',
      lastTradingDay: '2025-10-17',
      businessDays: 654,
      note: 'Documented OOS period. Pre-April-2023 arenas use walk-forward reconstruction.',
    },
    exposureModel: { longAllowed: true, shortAllowed: true, cashAllowed: false },
    methodology: {
      modelVersion: 'RF-RL-2025-11-21',
      costModelVersion: 'COST-V1',
      riskFreeRate: 0.0525,
    },
    stats: {
      cagr: 0.2347,
      volatility: 0.0356,
      sharpe: 4.56,
      sortino: 8.69,
      maxDrawdown: -0.0114,
      calmar: 20.54,
      alphaAnnualized: 0.195,
      betaVsSpy: 0.05,
      winDays: 0.6483,
      winMonths: 0.9677,
    },
  } satisfies BenchmarkSnapshot,

  // Research paper — Good-Fit portfolio (292 symbols)
  rfRlGoodFit: {
    benchmarkId: 'rf-rl-gf-r3',
    displayName: 'ReFi Good-Fit Portfolio',
    generatedAt: '2025-11-25',
    sourceType: 'RESEARCH_PAPER',
    universe: { type: 'U.S. LISTED EQUITY — ROBUSTNESS APPROVED', symbolCount: 292 },
    period: {
      firstTradingDay: '2023-04-18',
      lastTradingDay: '2025-10-17',
      businessDays: 654,
    },
    exposureModel: { longAllowed: true, shortAllowed: true, cashAllowed: false },
    methodology: { modelVersion: 'RF-RL-GF-R3', costModelVersion: 'COST-V1' },
    stats: {
      cagr: 0.2247,
      volatility: 0.0370,
      sharpe: 4.38,
      maxDrawdown: -0.0108,
    },
  } satisfies BenchmarkSnapshot,

  // Research paper — Full Basket (355 symbols)
  rfRlFullBasket: {
    benchmarkId: 'rf-rl-fb-r3',
    displayName: 'ReFi Full Basket Portfolio',
    generatedAt: '2025-11-25',
    sourceType: 'RESEARCH_PAPER',
    universe: { type: 'U.S. LISTED EQUITY — FUNDAMENTALS + LIQUIDITY SCREENED', symbolCount: 355 },
    period: {
      firstTradingDay: '2023-04-18',
      lastTradingDay: '2025-10-17',
      businessDays: 654,
    },
    exposureModel: { longAllowed: true, shortAllowed: true, cashAllowed: false },
    methodology: { modelVersion: 'RF-RL-FB-R3', costModelVersion: 'COST-V1' },
    stats: {
      cagr: 0.1527,
      volatility: 0.0348,
      sharpe: 2.91,
      maxDrawdown: -0.0154,
    },
  } satisfies BenchmarkSnapshot,

  // SPY reference (game rules engine approximation)
  spy: {
    benchmarkId: 'spy-passive-ref',
    displayName: 'S&P 500 Index (SPY)',
    generatedAt: '2025-11-25',
    sourceType: 'GAME_RULES_ENGINE',
    universe: { type: 'S&P 500 CONSTITUENTS', symbolCount: 503 },
    period: {
      firstTradingDay: '2023-04-18',
      lastTradingDay: '2025-10-17',
      businessDays: 654,
    },
    exposureModel: { longAllowed: true, shortAllowed: false, cashAllowed: false },
    methodology: { modelVersion: 'BUY-HOLD-SPY-1', costModelVersion: 'ZERO' },
    stats: {
      cagr: 0.1979,
      volatility: 0.1507,
      sharpe: 1.00,
      maxDrawdown: -0.1973,
      betaVsSpy: 1.0,
    },
  } satisfies BenchmarkSnapshot,
};

// ─── Machine ladder ───────────────────────────────────────────────────────────

// Progression:
//   SPY → REFI RULES → YOUR MACHINE → REFI FULL BASKET → REFI GOOD-FIT →
//   REFI BENCHMARK SNAPSHOT → TACO PROTOCOL
//
// Contest types:
//   FAIR_MATCH: same constraints as the player (long-only, same universe)
//   EXHIBITION: different capability model — explicitly flagged in UI
//
// OOS constraint: COVID/Recovery/Inflation/Banking arenas pre-date the 2023-04-18
// OOS window. Those arenas use GAME_RULES_ENGINE or HISTORICAL_WALK_FORWARD
// benchmarks and are labeled accordingly.

export const MACHINE_LADDER: MachineBenchmark[] = [
  {
    id: 'spy_passive',
    rank: 1,
    label: 'S&P 500 INDEX',
    subtitle: 'PASSIVE U.S. EQUITY BENCHMARK',
    description: 'No stock selection. No timing. Full S&P 500 exposure. The baseline every active manager must beat. Same constraints as you — long-only, no leverage.',
    xpRequired: 0,
    trainingCutoff: 'N/A',
    riskPolicy: 'Buy and hold — full U.S. equity exposure. No decisions.',
    auditId: 'RFA-MCH-SPY-001',
    playable: false,
    message: 'NO AI. NO SELECTION. JUST THE MARKET.',
    contestType: 'FAIR_MATCH',
    snapshot: BENCHMARK_SNAPSHOTS.spy,
  },
  {
    id: 'refi_rules',
    rank: 2,
    label: 'REFI RULES MACHINE',
    subtitle: 'TRANSPARENT LONG-ONLY RULES ENGINE',
    description: 'Deterministic U.S. equity rules: 20 positions, equal-weight target, 10% single-stock maximum, 25% sector maximum, monthly rebalance. No AI. No forecasting. Same constraints as you.',
    xpRequired: 0,
    trainingCutoff: 'Pre-arena',
    riskPolicy: 'Fixed threshold rules — position limits, sector caps, monthly rebalance',
    auditId: 'RFA-MCH-RULES-002',
    playable: true,
    message: 'TRANSPARENT RULES. NO FORECAST. SAME CONSTRAINTS.',
    contestType: 'FAIR_MATCH',
  },
  {
    id: 'your_machine',
    rank: 3,
    label: 'YOUR MACHINE',
    subtitle: 'MACHINE BUILDER — PLAYER-CONSTRUCTED',
    description: 'Your machine. Built in Machine Builder using the same 7-layer architecture. Universe, eligibility, regime logic, construction, guardrails, execution, monitoring.',
    xpRequired: 100,
    trainingCutoff: 'Player-defined',
    riskPolicy: 'Player-defined rules and guardrails',
    auditId: 'RFA-MCH-PLAYER',
    playable: false,
    message: 'YOUR RULES. YOUR MACHINE. YOUR RISK.',
    contestType: 'FAIR_MATCH',
  },
  {
    id: 'refi_full_basket',
    rank: 4,
    label: 'REFI FULL BASKET',
    subtitle: '355-SYMBOL RESEARCH BASELINE',
    description: 'The ReFi research paper\'s full basket — 355 U.S.-listed equities passing fundamental and liquidity screens. OOS period begins April 18, 2023. EXHIBITION: the full benchmark uses directional regime exposure (long + short), not long-only.',
    xpRequired: 300,
    trainingCutoff: '2023-04-17',
    riskPolicy: 'RF/RL directional regime exposure — full basket construction',
    auditId: 'RFA-MCH-FB-R3',
    playable: false,
    message: 'EXHIBITION. DIFFERENT CAPABILITY MODEL. EXPLICITLY FLAGGED.',
    contestType: 'EXHIBITION',
    snapshot: BENCHMARK_SNAPSHOTS.rfRlFullBasket,
  },
  {
    id: 'refi_good_fit',
    rank: 5,
    label: 'REFI GOOD-FIT',
    subtitle: 'ROBUSTNESS-FILTERED RF/RL PROCESS',
    description: '292 equities passing the ReFi robustness filter — bootstrapped Sharpe criteria and recent profitability approval on top of the full basket. Research paper documented OOS. EXHIBITION: long + short exposure.',
    xpRequired: 500,
    trainingCutoff: '2023-04-17',
    riskPolicy: 'RF/RL per-asset directional regime — Good-Fit selection layer',
    auditId: 'RFA-MCH-GF-R3',
    playable: false,
    message: 'SHARPE 4.38. DRAWDOWN -1.08%. RESEARCH PAPER OOS.',
    contestType: 'EXHIBITION',
    snapshot: BENCHMARK_SNAPSHOTS.rfRlGoodFit,
  },
  {
    id: 'refi_benchmark',
    rank: 6,
    label: 'REFI BENCHMARK SNAPSHOT',
    subtitle: 'VERSIONED RF/RL BENCHMARK · RF-RL-2025-11-21',
    description: 'The versioned /analyze API benchmark snapshot. 321 symbols. 654 business days OOS. This is the canonical production comparison — the actual ReFi RF/RL pipeline result. EXHIBITION: directional exposure model.',
    xpRequired: 750,
    trainingCutoff: '2023-04-17',
    riskPolicy: 'RF/RL hourly regime classification — 321-symbol cross-sectional portfolio',
    auditId: 'RF-RL-2025-11-21',
    playable: false,
    message: 'SHARPE 4.56. DRAWDOWN -1.14%. THE ACTUAL BENCHMARK.',
    contestType: 'EXHIBITION',
    snapshot: BENCHMARK_SNAPSHOTS.rfRlAnalyze2025,
  },
  {
    id: 'taco_protocol',
    rank: 7,
    label: 'TACO PROTOCOL',
    subtitle: 'FINAL BOSS — POLICY SHOCK EQUITY',
    description: 'U.S. equity positions under tariff and policy shock conditions. Tests whether your machine trades the pattern memory or the actual company-level impact. Regime reversals. Whipsaw. Reflexivity.',
    xpRequired: 1000,
    trainingCutoff: 'Variable',
    riskPolicy: 'Adaptive policy — company-level impact over macro narrative',
    auditId: 'RFA-MCH-TACO-001',
    playable: false,
    message: 'THE MARKET THINKS IT KNOWS THE PATTERN.',
    contestType: 'FAIR_MATCH',
  },
];

// ─── Ladder lifecycle ─────────────────────────────────────────────────────────
//
// Two independent axes, never conflated (2026-08-25 review of PR #60):
//
//   playable — a runtime for this opponent actually exists. A property of the
//              build, not of the player.
//   status   — the player's progression history: LOCKED / ACTIVE / DEFEATED.
//
// DEFEATED is an achievement, not a dead button: a playable opponent that has
// been beaten stays replayable. And no surface may present an unplayable rung
// as the player's opponent, however ACTIVE its status is — the first version
// of this fix stranded the ladder by missing both rules: beating the only
// playable rung left nothing challengeable, while the hub crowned SPY, an
// opponent that does not exist at runtime, as CURRENT OPPONENT.

export type LadderStatus = 'LOCKED' | 'ACTIVE' | 'DEFEATED';

/** Whether this rung can be challenged right now. */
export function isChallengeable(machine: MachineBenchmark, status: LadderStatus): boolean {
  return machine.playable && (status === 'ACTIVE' || status === 'DEFEATED');
}

/**
 * The opponent a surface should present as the player's current one:
 * the first playable rung still ACTIVE, else the first playable rung already
 * DEFEATED (a rematch is a real opponent; a rung with no runtime is not).
 */
export function currentOpponent(
  ladder: Record<string, { status: LadderStatus } | undefined>,
): MachineBenchmark | undefined {
  return (
    MACHINE_LADDER.find(m => m.playable && ladder[m.id]?.status === 'ACTIVE') ??
    MACHINE_LADDER.find(m => m.playable && ladder[m.id]?.status === 'DEFEATED')
  );
}

// ─── Rank progression ─────────────────────────────────────────────────────────

const RANK_XP_THRESHOLDS: { rank: RankCode; xp: number; label: string }[] = [
  { rank: 'INITIATE', xp: 0, label: 'INITIATE' },
  { rank: 'ANALYST', xp: 100, label: 'ANALYST' },
  { rank: 'ASSOCIATE', xp: 300, label: 'ASSOCIATE' },
  { rank: 'PORTFOLIO_MANAGER', xp: 600, label: 'PORTFOLIO MANAGER' },
  { rank: 'SENIOR_PM', xp: 1000, label: 'SENIOR PM' },
  { rank: 'CHIEF_INVESTMENT_OFFICER', xp: 2000, label: 'CHIEF INVESTMENT OFFICER' },
];

export function getRankForXp(xp: number): RankCode {
  const rank = [...RANK_XP_THRESHOLDS].reverse().find(r => xp >= r.xp);
  return rank?.rank ?? 'INITIATE';
}

export function getRankLabel(rank: RankCode): string {
  return RANK_XP_THRESHOLDS.find(r => r.rank === rank)?.label ?? 'INITIATE';
}

export function getXpToNextRank(xp: number): { current: number; next: number; label: string } | null {
  const idx = RANK_XP_THRESHOLDS.findIndex(r => r.rank === getRankForXp(xp));
  if (idx === RANK_XP_THRESHOLDS.length - 1) return null;
  const nextRank = RANK_XP_THRESHOLDS[idx + 1];
  return { current: xp, next: nextRank.xp, label: nextRank.label };
}

// ─── Default profile ──────────────────────────────────────────────────────────

const DEFAULT_DIMENSION_SCORES: Record<DimensionCode, { score: number; sampleSize: number }> = {
  STOCK_SELECTION: { score: 50, sampleSize: 0 },
  POSITION_SIZING: { score: 50, sampleSize: 0 },
  LOSS_CONTROL: { score: 50, sampleSize: 0 },
  REENTRY_DISCIPLINE: { score: 50, sampleSize: 0 },
  TURNOVER_DISCIPLINE: { score: 50, sampleSize: 0 },
  REGIME_ADAPTATION: { score: 50, sampleSize: 0 },
  RULE_ADHERENCE: { score: 50, sampleSize: 0 },
  ACTION_BIAS_SCORE: { score: 50, sampleSize: 0 },
  CONCENTRATION_CONTROL: { score: 50, sampleSize: 0 },
  DECISION_CONSISTENCY: { score: 50, sampleSize: 0 },
};

export function createDefaultProfile(sessionId: string): PlayerProfile {
  return {
    sessionId,
    handle: null,
    alphaXp: 0,
    rankCode: 'INITIATE',
    machineBeats: 0,
    machineAttempts: 0,
    currentStreak: 0,
    bestStreak: 0,
    archetype: 'UNCLASSIFIED',
    decisionStreak: 0,
    lastActiveDate: null,
    dimensions: { ...DEFAULT_DIMENSION_SCORES },
    unlockedModules: [],
    machineLadder: {
      spy_passive: { wins: 0, losses: 0, status: 'ACTIVE' },
      refi_rules: { wins: 0, losses: 0, status: 'ACTIVE' },
      your_machine: { wins: 0, losses: 0, status: 'LOCKED' },
      refi_full_basket: { wins: 0, losses: 0, status: 'LOCKED' },
      refi_good_fit: { wins: 0, losses: 0, status: 'LOCKED' },
      refi_benchmark: { wins: 0, losses: 0, status: 'LOCKED' },
      taco_protocol: { wins: 0, losses: 0, status: 'LOCKED' },
    },
  };
}

// ─── Dimension update from decision ──────────────────────────────────────────

export function updateDimensions(
  dimensions: Record<DimensionCode, { score: number; sampleSize: number }>,
  updates: Partial<Record<DimensionCode, number>>
): Record<DimensionCode, { score: number; sampleSize: number }> {
  const result = { ...dimensions };
  Object.entries(updates).forEach(([key, delta]) => {
    const dim = key as DimensionCode;
    if (result[dim] !== undefined && delta !== undefined) {
      const { score, sampleSize } = result[dim];
      const newScore = Math.max(0, Math.min(100, score + delta));
      result[dim] = { score: newScore, sampleSize: sampleSize + 1 };
    }
  });
  return result;
}
