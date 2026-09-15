import { test } from 'node:test';
import assert from 'node:assert/strict';

// ─── The package, used the way a server will use it ───────────────────────────
//
// Every other engine test in this repository imports from src/lib, which drags
// in the application: the arena index, five content modules, and whatever they
// happen to import. Those tests prove the engine is correct. They cannot prove
// the thing the extraction exists for, because they would pass just as well if
// the package still depended on the app.
//
// This file imports the package entry point and nothing else. No React, no
// browser global, no application content, no arena index. If a future
// server-side verifier (REFI_ALPHA_GROWTH_ARCHITECTURE.md §6) cannot recompute
// a ranked attempt this way, this test fails before the verifier is written.
//
// The arena is a fixture built here, which is the second half of the claim:
// the package defines the content contract and a caller supplies the content.
// A verifier will supply a versioned competitive manifest instead, and the
// engine will not know the difference.
import {
  registerArena, getArena, allArenas, getCheckpoint, getTotalCheckpoints,
  buildPortfolio, sectorReturns, requireArena, UnregisteredArenaError,
  createInitialRun, createInitialPortfolio, commitDecisionCommand, attachThesis,
  advanceRunCheckpoint, resolveRunResult, committableActions,
  STARTING_CAPITAL,
} from '../src/index';
import type {
  ActionBranch, ArenaDefinition, ArenaId, CheckpointData, RunState,
} from '../src/index';

// The fixture borrows a real ArenaId because the type is a closed union today
// and C2 is not a content-manifest redesign. Nothing else about it is real:
// two checkpoints, a two-symbol book, numbers chosen to be legible.
const FIXTURE_ARENA: ArenaId = 'taco_protocol';
const UNREGISTERED_ARENA: ArenaId = 'banking_stress';

const BOOK = { AAA: 'ALPHA', BBB: 'BETA' } as const;

function branch(actionCode: ActionBranch['actionCode'], turnoverCost: number): ActionBranch {
  return {
    actionCode,
    label: actionCode,
    shortLabel: actionCode,
    turnoverCost,
    branchEffect: { flagsAdd: [], alphaImpact: {} },
  };
}

function checkpoint(sequence: number, returnBias: number): CheckpointData {
  return {
    sequence,
    machinePar: 60,
    phase: 'BACKGROUND_NOISE',
    crisisDay: `FIXTURE DAY ${sequence}`,
    signalTitle: `FIXTURE SIGNAL ${sequence}`,
    signalBody: 'A deterministic fixture, not historical market data.',
    marketSignals: [],
    eventFeed: [],
    portfolioEffect: {
      returnBias,
      volatilityDelta: 0,
      correlationLevel: 0.4,
      positionReturns: sectorReturns(BOOK, { ALPHA: returnBias, BETA: returnBias / 2 }),
      returnsSource: 'AUTHORED_GAME_SIMULATION',
    },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: ['fixture'],
      policyReason: 'FIXTURE',
      targetChanges: [],
    },
    availableActions: [branch('HOLD', 0), branch('REDUCE', 0.05)],
    teachingPoint: 'The engine ran content it was handed.',
    isRegimeChange: false,
    isHoldValid: true,
  };
}

const fixture: ArenaDefinition = {
  id: FIXTURE_ARENA,
  name: 'FIXTURE',
  order: 1,
  difficulty: 1,
  lesson: 'The package runs content the caller composes.',
  window: 'FIXTURE WINDOW',
  checkpoints: [checkpoint(1, -0.04), checkpoint(2, 0.03)],
  criticalDrawdown: -0.20,
  startingPortfolio: () => buildPortfolio(
    [
      { symbol: 'AAA', weight: 0.5, sector: 'ALPHA', riskContrib: 0.6 },
      { symbol: 'BBB', weight: 0.3, sector: 'BETA', riskContrib: 0.4 },
    ],
    { volatility: 0.18, correlationIndex: 0.4, startingCapital: STARTING_CAPITAL },
  ),
};

registerArena(fixture);

test('the registry holds the content the caller composed, and nothing else', () => {
  assert.equal(getArena(FIXTURE_ARENA)?.name, 'FIXTURE');
  assert.deepEqual(allArenas().map(a => a.id), [FIXTURE_ARENA]);
  assert.equal(getTotalCheckpoints(FIXTURE_ARENA), 2);
  assert.equal(getCheckpoint(FIXTURE_ARENA, 1)?.crisisDay, 'FIXTURE DAY 1');
  // Past the end is the end of a run, not an error: a registered arena that
  // has run out of content is an ordinary state.
  assert.equal(getCheckpoint(FIXTURE_ARENA, 99), undefined);
});

test('a run opens, commits, advances and resolves with no application present', () => {
  let run: RunState = createInitialRun(11, FIXTURE_ARENA);
  assert.equal(run.totalCheckpoints, 2);
  assert.equal(run.portfolio.value, STARTING_CAPITAL);
  assert.equal(run.portfolio.cashWeight, 0.2);

  for (let i = 0; i < 2; i++) {
    const action = committableActions(run)[0];
    const outcome = commitDecisionCommand(run, { action, conviction: 60 });
    assert.ok(outcome, `checkpoint ${i + 1} rejected ${action}`);
    run = attachThesis(outcome.run, 'THESIS_UNCHANGED');
    if (run.currentCheckpoint < 2) run = advanceRunCheckpoint(run);
  }

  assert.equal(run.decisions.length, 2);
  assert.notEqual(run.portfolio.value, STARTING_CAPITAL, 'the book never moved');
  const resolved = resolveRunResult(run, run.playerScore >= run.machineScore ? 'PASSED' : 'FAILED');
  assert.ok(['PASSED', 'FAILED', 'BEAT_MACHINE'].includes(resolved));
});

test('the same decisions replay to the same state', () => {
  const play = () => {
    let run: RunState = createInitialRun(11, FIXTURE_ARENA);
    for (let i = 0; i < 2; i++) {
      const outcome = commitDecisionCommand(run, { action: 'REDUCE', conviction: 60 });
      run = attachThesis(outcome!.run, 'THESIS_UNCHANGED');
      if (run.currentCheckpoint < 2) run = advanceRunCheckpoint(run);
    }
    return run;
  };
  assert.deepEqual(play(), play());
});

// ─── The invalid state ────────────────────────────────────────────────────────
//
// The engine used to answer an unregistered arena with a hard-coded COVID
// book. For the browser that is dead code; for a verifier it is a way to
// score a ranked attempt against the wrong portfolio and report the number
// with confidence. An error that names the arena is the only answer that
// cannot be mistaken for a result.

test('an unregistered arena fails explicitly, and says which one', () => {
  for (const call of [
    () => requireArena(UNREGISTERED_ARENA),
    () => createInitialPortfolio(UNREGISTERED_ARENA),
    () => createInitialRun(11, UNREGISTERED_ARENA),
  ]) {
    assert.throws(call, (err: unknown) => {
      assert.ok(err instanceof UnregisteredArenaError);
      assert.equal(err.arenaId, UNREGISTERED_ARENA);
      assert.match(err.message, new RegExp(UNREGISTERED_ARENA));
      return true;
    });
  }
});

test('an unregistered arena never silently opens an empty run', () => {
  // The old shape: total checkpoints 0, a run that ends the moment it starts,
  // and nothing anywhere saying a registration was forgotten.
  assert.throws(() => createInitialRun(11, UNREGISTERED_ARENA), UnregisteredArenaError);
  assert.equal(getTotalCheckpoints(UNREGISTERED_ARENA), 0);
});
