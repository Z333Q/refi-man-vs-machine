import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reducer, type GameState } from '../context/gameReducer';
import { createDefaultProfile } from './progressionEngine';
import { createInitialRun } from './runEngine';
import type { ModuleCode } from './gameTypes';

// The module unlock is the one moment in a run where the terminal the player
// is using permanently changes. It has failed twice:
//
//   1. The unlock landed on the profile only, so the run's module rack never
//      changed and the module the toast announced was nowhere to be found.
//   2. The toast cleared itself after 3000ms. Because the unlock is raised by
//      the commit, those three seconds were spent underneath the resolution
//      animation, so the announcement came and went while the player was
//      watching something else.
//
// Both are reducer rules, invisible from the engine and expensive to reach
// through the UI. They are asserted here instead.

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    profile: createDefaultProfile('ses_test'),
    run: { ...createInitialRun(1), id: 'run_unlock_test' },
    lastCheckpointScore: null,
    lastCheckpointFlags: [],
    moduleJustUnlocked: null,
    xpJustEarned: 0,
    loaded: true,
    ...overrides,
  };
}

/** A state that looks like the instant after a commit that earned a module. */
function withUnlock(module: ModuleCode = 'DRAWDOWN_MAP'): GameState {
  const s = baseState();
  return {
    ...s,
    moduleJustUnlocked: module,
    xpJustEarned: 30,
    profile: { ...s.profile, unlockedModules: [module] },
    run: { ...s.run!, activeModules: [...s.run!.activeModules, module] },
  };
}

test('an unlock survives everything that is not the player moving on', () => {
  const s = withUnlock();

  // The moments that pass between earning a module and reading about it: the
  // thesis attaches, panels open, conviction moves. None of them are the
  // player leaving, so none of them may take the announcement away.
  const survives = [
    { type: 'SET_RUN_PHASE', phase: 'RESOLVING' } as const,
    { type: 'ATTACH_THESIS', thesis: 'THESIS_UNCHANGED' } as const,
    { type: 'INVESTIGATE_MODULE', module: 'SECTOR_EXPOSURE' } as const,
    { type: 'SET_PENDING_CONFIDENCE', confidence: 0.8 } as const,
  ];

  for (const action of survives) {
    const next = reducer(s, action);
    assert.equal(
      next.moduleJustUnlocked,
      'DRAWDOWN_MAP',
      `${action.type} must not clear the unlock`,
    );
  }
});

test('advancing the checkpoint clears it: that is the player moving on', () => {
  const next = reducer(withUnlock(), { type: 'ADVANCE_CHECKPOINT' });
  assert.equal(next.moduleJustUnlocked, null);
  assert.equal(next.xpJustEarned, 0, 'the XP line belongs to the same checkpoint');
});

test('the player can dismiss it directly', () => {
  const next = reducer(withUnlock(), { type: 'CLEAR_MODULE_UNLOCK' });
  assert.equal(next.moduleJustUnlocked, null);
});

test('clearing the announcement never removes the module itself', () => {
  const s = withUnlock();
  for (const action of [
    { type: 'CLEAR_MODULE_UNLOCK' } as const,
    { type: 'ADVANCE_CHECKPOINT' } as const,
  ]) {
    const next = reducer(s, action);
    assert.ok(
      next.profile.unlockedModules.includes('DRAWDOWN_MAP'),
      'the unlock is permanent; only the notice is transient',
    );
    assert.ok(next.run?.activeModules.includes('DRAWDOWN_MAP'));
  }
});

test('a new run keeps the modules the player has already earned', () => {
  const s = withUnlock();
  const next = reducer(s, { type: 'START_RUN', runId: 'run_next', seed: 7, arenaId: 'covid_black_swan', machineId: 'refi_rules' });
  assert.ok(
    next.run?.activeModules.includes('DRAWDOWN_MAP'),
    'a returning player must not lose earned modules at run start',
  );
  assert.equal(
    new Set(next.run!.activeModules).size,
    next.run!.activeModules.length,
    'and must not gain duplicates',
  );
});

test('the run seed and id come from the action, never from the engine', () => {
  const next = reducer(baseState(), { type: 'START_RUN', runId: 'run_abc', seed: 4242, arenaId: 'covid_black_swan', machineId: 'refi_rules' });
  assert.equal(next.run?.id, 'run_abc');
  assert.equal(next.run?.seed, 4242);
});
