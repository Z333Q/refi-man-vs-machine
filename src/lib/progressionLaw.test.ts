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


// ─── The TACO gate and completion (owner ruling 2026-09-06) ───────────────────

import { tacoRequirements, tacoUnlocked, tacoNextRequirement, gameCompleted, TACO_REQUIRED_ARENAS } from './progressionLaw';

const allFour = TACO_REQUIRED_ARENAS.map(id => done(id));
const fullEvidence = { records: allFour, machineCompiled: true, basketLocked: true, gauntletRun: true };

test('TACO requires the four regimes, a compiled machine, a gauntlet run and a locked basket', () => {
  assert.equal(tacoUnlocked(fullEvidence), true);
  assert.equal(tacoRequirements(fullEvidence).length, 7);
  assert.equal(tacoUnlocked({ ...fullEvidence, records: allFour.slice(0, 3) }), false);
  assert.equal(tacoUnlocked({ ...fullEvidence, machineCompiled: false }), false);
  assert.equal(tacoUnlocked({ ...fullEvidence, basketLocked: false }), false);
  assert.equal(tacoUnlocked({ ...fullEvidence, gauntletRun: false }), false);
});

test('a blown-up regime still counts toward TACO: the player experienced it', () => {
  const records = TACO_REQUIRED_ARENAS.map(id => done(id, true));
  assert.equal(tacoUnlocked({ ...fullEvidence, records }), true);
});

test('the next requirement is the first unmet one, in journey order', () => {
  assert.equal(tacoNextRequirement({ ...fullEvidence, records: [] })?.key, 'covid_black_swan');
  assert.equal(tacoNextRequirement({ ...fullEvidence, machineCompiled: false })?.key, 'machine');
  assert.equal(tacoNextRequirement({ ...fullEvidence, gauntletRun: false })?.key, 'gauntlet');
  assert.equal(tacoNextRequirement({ ...fullEvidence, basketLocked: false })?.key, 'basket');
  assert.equal(tacoNextRequirement(fullEvidence), null);
});

test('nothing on the TACO list is a fixture: MACHINE SEASON and POLICY WRITER are not required', () => {
  const labels = tacoRequirements(fullEvidence).map(r => r.label);
  assert.ok(!labels.some(l => /SEASON|POLICY/.test(l)));
});

test('the game is complete once TACO has been finished, win or lose', () => {
  assert.equal(gameCompleted(allFour), false);
  assert.equal(gameCompleted([...allFour, done('taco_protocol', true)]), true);
});
