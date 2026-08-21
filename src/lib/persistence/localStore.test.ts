import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { localStore } from './localStore';
import type { ProfileSnapshot } from './types';

// The store that was missing. Profile state had exactly one home, a remote
// table whose policies rejected every write the game could make, so progress
// did not survive a reload. These assert the replacement actually holds.

// Minimal localStorage for Node.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

const snapshot = (xp: number): ProfileSnapshot => ({
  handle: null, alphaXp: xp, rankCode: 'INITIATE', machineBeats: 1, machineAttempts: 3,
  currentStreak: 2, bestStreak: 4, archetype: 'UNCLASSIFIED', decisionStreak: 5,
  lastActiveDate: '2026-08-21',
  dimensions: {} as ProfileSnapshot['dimensions'],
  unlockedModules: [], machineLadder: {} as ProfileSnapshot['machineLadder'],
});

test('a saved profile survives and reads back identical', async () => {
  await localStore.saveProfile('ses_a', snapshot(120));
  assert.deepEqual(await localStore.loadProfile('ses_a'), snapshot(120));
});

test('an unknown session has no profile rather than a broken one', async () => {
  assert.equal(await localStore.loadProfile('ses_unknown'), null);
});

test('sessions do not read each other, on a shared device', async () => {
  await localStore.saveProfile('ses_a', snapshot(10));
  await localStore.saveProfile('ses_b', snapshot(99));
  assert.equal((await localStore.loadProfile('ses_a'))?.alphaXp, 10);
  assert.equal((await localStore.loadProfile('ses_b'))?.alphaXp, 99);
});

test('the latest save wins', async () => {
  await localStore.saveProfile('ses_a', snapshot(10));
  await localStore.saveProfile('ses_a', snapshot(250));
  assert.equal((await localStore.loadProfile('ses_a'))?.alphaXp, 250);
});

test('a corrupt stored value reads as absent rather than throwing', async () => {
  localStorage.setItem('refi_profile:ses_a', '{not json');
  assert.equal(await localStore.loadProfile('ses_a'), null);
});

test('one daily tape submission per date, per session', async () => {
  await localStore.saveDailyTape('ses_a', { tapeDate: '2026-08-21', playerAction: 'HOLD', score: 7 });
  assert.deepEqual(await localStore.loadDailyTape('ses_a', '2026-08-21'),
    { tapeDate: '2026-08-21', playerAction: 'HOLD', score: 7 });
  // A different day is a different decision, and a different session is a
  // different player.
  assert.equal(await localStore.loadDailyTape('ses_a', '2026-08-22'), null);
  assert.equal(await localStore.loadDailyTape('ses_b', '2026-08-21'), null);
});

test('tip state merges rather than replacing what is already recorded', async () => {
  await localStore.saveTipState('ses_a', { tipCode: 'T1', state: 'SHOWN', lastShownAt: 'x' });
  await localStore.saveTipState('ses_a', { tipCode: 'T1', state: 'COMPLETED', completedAt: 'y' });
  const raw = JSON.parse(localStorage.getItem('refi_tip_states:ses_a') as string);
  assert.equal(raw.T1.state, 'COMPLETED');
  assert.equal(raw.T1.lastShownAt, 'x', 'the earlier field was dropped by the merge');
});

test('a local store reports itself as local, and delivers no telemetry', async () => {
  assert.equal(localStore.kind, 'LOCAL');
  assert.equal(await localStore.deliverEvent({} as never), false);
});
