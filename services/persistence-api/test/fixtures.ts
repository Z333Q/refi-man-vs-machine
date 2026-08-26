// Shared wire-shape fixtures for the contract and integration suites.
// One source, so the two suites cannot quietly drift apart on what a
// well-formed record looks like.

export function runFixture(overrides: Record<string, unknown> = {}) {
  return {
    recordVersion: 2,
    runId: 'run_a1b2c3d4e5f60718293a4b01',
    seed: 1234,
    arenaId: 'covid_black_swan',
    machineId: 'refi_rules',
    state: 'COMPLETE',
    result: 'MACHINE_WIN',
    currentCheckpoint: 2,
    totalCheckpoints: 22,
    playerScore: 61.5,
    machineScore: 66,
    criticalFailure: false,
    criticalFailureCheckpoint: null,
    portfolioValue: 98750.25,
    cashWeight: 0.24,
    drawdown: 0.031,
    volatility: 0.185,
    turnoverUsed: 0.08,
    decisions: [
      {
        checkpointSequence: 1,
        actionCode: 'HOLD',
        thesisCode: 'THESIS_UNCHANGED',
        confidence: 0.6,
        modulesConsulted: ['RISK_PANEL'],
        turnoverCost: 0,
        scoreContribution: 2.5,
        quality: 'SOUND',
        behavioralFlags: [],
        machineActionCode: 'HOLD',
        committedAt: '2026-08-25T12:00:00.000Z',
      },
      {
        checkpointSequence: 2,
        actionCode: 'REDUCE',
        thesisCode: null,
        confidence: null,
        modulesConsulted: [],
        turnoverCost: 0.004,
        scoreContribution: -1.25,
        quality: 'NEUTRAL',
        behavioralFlags: ['PANIC_ADJACENT'],
        machineActionCode: 'ROTATE',
        // Migrated from a v1 record: the commit time was never captured.
        committedAt: null,
      },
    ],
    startedAt: '2026-08-25T11:00:00.000Z',
    updatedAt: '2026-08-25T12:05:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

export function machineFixture(overrides: Record<string, unknown> = {}) {
  return {
    recordVersion: 1,
    machineId: 'mch_9f2a31d877c1',
    machineName: 'PLAYER MACHINE',
    version: 1,
    config: { universe: 'US_LARGE_CAP', guardrails: { maxPositionPct: 0.1 } },
    installedModules: ['UNIVERSE', 'SIGNAL'],
    buildHash: '9F2A:31D8:77C1',
    createdAt: '2026-08-25T12:00:00.000Z',
    lockedAt: null,
    arenasCompleted: [],
    ...overrides,
  };
}

export function profileFixture() {
  return {
    handle: null,
    alphaXp: 480,
    rankCode: 'ANALYST',
    machineBeats: 2,
    machineAttempts: 7,
    currentStreak: 1,
    bestStreak: 3,
    archetype: null,
    decisionStreak: 4,
    lastActiveDate: '2026-08-25',
    dimensions: {
      POSITION_SIZING: { score: 43.5, sampleSize: 12 },
      REGIME_ADAPTATION: { score: 71, sampleSize: 9 },
    },
    unlockedModules: ['CORRELATION_MATRIX', 'MACHINE_BUILDER'],
    machineLadder: {
      spy_benchmark: { wins: 1, losses: 2, status: 'DEFEATED' as const },
      refi_rules: { wins: 0, losses: 1, status: 'ACTIVE' as const },
    },
  };
}
