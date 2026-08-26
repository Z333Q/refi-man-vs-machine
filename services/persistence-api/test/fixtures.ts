// Shared wire-shape fixtures for the contract and integration suites.
// One source, so the two suites cannot quietly drift apart on what a
// well-formed record looks like. Every value is drawn from the canonical
// vocabularies and id shapes the validators enforce.

import { machineBuildHash, derivedMachineId } from '../src/contract.js';

/** A canonical session id (ses_<20 hex>), deterministic per label. */
export function sid(n: number): string {
  return 'ses_' + n.toString(16).padStart(20, '0');
}

export function runFixture(overrides: Record<string, unknown> = {}) {
  return {
    recordVersion: 2,
    runId: 'run_a1b2c3d4e5f60718293a4b01',
    seed: 1234,
    arenaId: 'covid_black_swan',
    machineId: 'refi_rules',
    state: 'SIGNAL',
    result: 'ACTIVE',
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
        modulesConsulted: ['PORTFOLIO_SUMMARY'],
        turnoverCost: 0,
        scoreContribution: 2.5,
        quality: 'GOOD',
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
        behavioralFlags: ['PANIC_REDUCTION_LARGE'],
        machineActionCode: 'ROTATE_DEFENSIVE',
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

/** The canonical MachineConfig the fixtures compile. */
export function machineConfigFixture() {
  return {
    universe: 'US_LIQUID',
    eligibility: 'FUNDAMENTAL_LIQUIDITY',
    signal: 'REGIME_CLASSIFIER',
    construction: 'CONSTRAINED_OPT',
    guardrails: {
      maxPositionPct: 0.10,
      maxSectorPct: 0.25,
      maxCorrelation: 0.85,
      drawdownGatePct: -0.15,
      cashFloorPct: 0.05,
    },
    execution: 'DAILY_CLOSE',
    monitoring: 'PASSIVE',
  };
}

export function machineFixture(overrides: Record<string, unknown> = {}) {
  const config = (overrides['config'] as Record<string, unknown>) ?? machineConfigFixture();
  const installedModules = (overrides['installedModules'] as string[]) ?? ['UNIVERSE', 'SIGNAL'];
  const buildHash = machineBuildHash(config, installedModules);
  return {
    recordVersion: 1,
    machineId: derivedMachineId(buildHash),
    machineName: 'PLAYER MACHINE',
    version: 1,
    config,
    installedModules,
    buildHash,
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
    archetype: 'UNCLASSIFIED',
    decisionStreak: 4,
    lastActiveDate: '2026-08-25',
    dimensions: {
      POSITION_SIZING: { score: 43.5, sampleSize: 12 },
      REGIME_ADAPTATION: { score: 71, sampleSize: 9 },
    },
    // Alphabetical, matching the deterministic tie-break order a same-instant
    // batch of unlocks reads back in.
    unlockedModules: ['BASKET_WRITER', 'CORRELATION_MATRIX'],
    machineLadder: {
      spy_benchmark: { wins: 1, losses: 2, status: 'DEFEATED' as const },
      refi_rules: { wins: 0, losses: 1, status: 'ACTIVE' as const },
    },
  };
}
