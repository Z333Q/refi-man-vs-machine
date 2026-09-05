import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

const { hasMadeFirstDecision, markFirstDecision, FIRST_DECISION_KEY } = await import('./playerEntry');

test('a fresh player has no first decision', () => {
  store.clear();
  assert.equal(hasMadeFirstDecision(), false);
});

test('marking the first decision is read back', () => {
  store.clear();
  markFirstDecision();
  assert.equal(store.get(FIRST_DECISION_KEY), '1');
  assert.equal(hasMadeFirstDecision(), true);
});

test('the legacy tutorial flag still counts as a returning player', () => {
  store.clear();
  store.set('refi_tutorial_complete', '1');
  assert.equal(hasMadeFirstDecision(), true);
});

test('a run record with a decision counts even without the flag', () => {
  store.clear();
  store.set('refi_run_records', JSON.stringify([{
    recordVersion: 2, runId: 'r1', seed: 1, arenaId: 'covid_black_swan', machineId: 'refi_rules',
    state: 'ACTIVE', result: null, currentCheckpoint: 2, totalCheckpoints: 14,
    playerScore: 50, machineScore: 50, criticalFailure: false, criticalFailureCheckpoint: null,
    portfolioValue: 100000, cashWeight: 0.2, drawdown: 0, volatility: 0.1, turnoverUsed: 0,
    decisions: [{ checkpoint: 1 }], startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
  }]));
  assert.equal(hasMadeFirstDecision(), true);
});

test('a run record with no decisions does not count', () => {
  store.clear();
  store.set('refi_run_records', JSON.stringify([{
    recordVersion: 2, runId: 'r1', seed: 1, arenaId: 'covid_black_swan', machineId: 'refi_rules',
    state: 'ACTIVE', result: null, currentCheckpoint: 1, totalCheckpoints: 14,
    playerScore: 50, machineScore: 50, criticalFailure: false, criticalFailureCheckpoint: null,
    portfolioValue: 100000, cashWeight: 0.2, drawdown: 0, volatility: 0.1, turnoverUsed: 0,
    decisions: [], startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
  }]));
  assert.equal(hasMadeFirstDecision(), false);
});
