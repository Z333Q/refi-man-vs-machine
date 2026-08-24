import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  arenaCompleted, nextArenaOpen, hasBronzeRun, builderUnlocked,
  type ProgressView,
} from './progressionLaw';

// The 2026-08-25 owner ruling, pinned. If any of these change, that is a
// product decision, not a refactor.

const done = (arenaId: string, criticalFailure = false): ProgressView => ({
  arenaId, criticalFailure, completedAt: '2026-08-25T00:00:00.000Z',
});
const abandoned = (arenaId: string): ProgressView => ({
  arenaId, criticalFailure: false, completedAt: null,
});

test('the first arena is always open', () => {
  assert.equal(nextArenaOpen([], null), true);
});

test('completion opens the next arena, win or lose', () => {
  // A finished run that blew through the risk budget still counts: the
  // player experienced the regime, and that is the unlock criterion.
  assert.equal(nextArenaOpen([done('covid_black_swan', true)], 'covid_black_swan'), true);
  assert.equal(nextArenaOpen([done('covid_black_swan', false)], 'covid_black_swan'), true);
});

test('an unfinished or abandoned run opens nothing', () => {
  assert.equal(nextArenaOpen([abandoned('covid_black_swan')], 'covid_black_swan'), false);
  assert.equal(arenaCompleted([abandoned('covid_black_swan')], 'covid_black_swan'), false);
});

test('completing one arena does not open a different chain link', () => {
  assert.equal(nextArenaOpen([done('covid_black_swan')], 'recovery_trap'), false);
});

test('the Builder requires Bronze: completion alone is not enough', () => {
  // Finished, but with a critical risk failure: next arena yes, Builder no.
  const blownUp = [done('covid_black_swan', true)];
  assert.equal(nextArenaOpen(blownUp, 'covid_black_swan'), true);
  assert.equal(builderUnlocked(blownUp), false);
});

test('one Bronze run anywhere unlocks the Builder', () => {
  assert.equal(builderUnlocked([done('covid_black_swan', true), done('recovery_trap', false)]), true);
  assert.equal(hasBronzeRun([done('recovery_trap', false)]), true);
});

test('an abandoned clean run is not Bronze', () => {
  assert.equal(builderUnlocked([abandoned('covid_black_swan')]), false);
});
