import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reducer, type GameState } from '../context/gameReducer';
import { createDefaultProfile, MACHINE_LADDER } from './progressionEngine';
import { createInitialRun } from './runEngine';

// ─── Opponent identity through the run ────────────────────────────────────────
//
// 2026-08-25 audit P0: the ladder let the player choose an opponent and then
// discarded the choice; every run was recorded against refi_rules, and the
// per-machine ladder records in the profile were never written at all. The
// opponent is now part of run identity, and these tests pin the contract.

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    profile: createDefaultProfile('ses_test'),
    run: null,
    lastCheckpointScore: null,
    lastCheckpointFlags: [],
    moduleJustUnlocked: null,
    xpJustEarned: 0,
    loaded: true,
    ...overrides,
  };
}

test('createInitialRun carries the chosen opponent, defaulting to the rules machine', () => {
  assert.equal(createInitialRun(1).machineId, 'refi_rules');
  assert.equal(createInitialRun(1, 'covid_black_swan', 'spy_passive').machineId, 'spy_passive');
});

test('START_RUN threads the opponent into the run state', () => {
  const s = reducer(baseState(), {
    type: 'START_RUN', runId: 'run_t', seed: 1,
    arenaId: 'covid_black_swan', machineId: 'spy_passive',
  });
  assert.equal(s.run?.machineId, 'spy_passive');
});

test('COMPLETE_RUN writes the outcome to the ladder entry of the machine that was faced', () => {
  const started = reducer(baseState(), {
    type: 'START_RUN', runId: 'run_t', seed: 1,
    arenaId: 'covid_black_swan', machineId: 'refi_rules',
  });
  // A win: the run must report MACHINE_BEATEN, which requires beating the
  // machine score without critical failure.
  const winning: GameState = {
    ...started,
    run: { ...started.run!, playerScore: 80, machineScore: 60 },
  };
  const won = reducer(winning, { type: 'COMPLETE_RUN', result: 'MACHINE_BEATEN' });
  assert.equal(won.profile.machineLadder.refi_rules.wins, 1);
  assert.equal(won.profile.machineLadder.refi_rules.losses, 0);
  assert.equal(won.profile.machineLadder.refi_rules.status, 'DEFEATED');
  // The other rungs are untouched.
  assert.equal(won.profile.machineLadder.spy_passive.wins, 0);

  const lost = reducer(winning, { type: 'COMPLETE_RUN', result: 'FAILED' });
  assert.equal(lost.profile.machineLadder.refi_rules.wins, 0);
  assert.equal(lost.profile.machineLadder.refi_rules.losses, 1);
  assert.equal(lost.profile.machineLadder.refi_rules.status, 'ACTIVE');
});

test('an unknown machine id completes without corrupting the ladder', () => {
  const started = reducer(baseState(), {
    type: 'START_RUN', runId: 'run_t', seed: 1,
    arenaId: 'covid_black_swan', machineId: 'not_a_rung',
  });
  const done = reducer(started, { type: 'COMPLETE_RUN', result: 'FAILED' });
  assert.deepEqual(
    Object.keys(done.profile.machineLadder).sort(),
    Object.keys(baseState().profile.machineLadder).sort(),
  );
});

// ─── Playability is explicit ─────────────────────────────────────────────────
//
// A rung without a runtime must say so rather than silently substituting a
// different opponent. Only the rules machine has authored arena decisions
// today; if another rung gains a runtime, this test is where that fact is
// declared.

test('exactly the rungs with a runtime are playable', () => {
  const playable = MACHINE_LADDER.filter(m => m.playable).map(m => m.id);
  assert.deepEqual(playable, ['refi_rules']);
});

test('every rung declares playability explicitly', () => {
  for (const m of MACHINE_LADDER) {
    assert.equal(typeof m.playable, 'boolean', `${m.id} must declare playable`);
  }
});
