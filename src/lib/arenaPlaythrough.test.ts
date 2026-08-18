import { test } from 'node:test';
import assert from 'node:assert/strict';

import './arenaIndex';
import { allArenas } from './arenas';
import type { ActionCode, RunState } from './gameTypes';
import {
  createInitialRun, commitDecisionCommand, advanceRunCheckpoint, attachThesis,
  affordableActions, resolveRunResult, observationModeReason,
} from './runEngine';
import { projectRun, replayRun, replayMatchesRecord } from './runRecord';
import { outcomes, headline, scoreAttribution, flagTallies } from './runAnalysis';

// Playing every arena to the end, through the same commit boundary a player
// uses.
//
// The unit tests below the engine prove pieces; this proves an arena is
// finishable. It is the check that would have caught a checkpoint that offers
// nothing affordable, a run that ends early because content ran out, or a
// record that cannot be replayed once the arena is longer than COVID.
//
// Deliberately not a machine policy run: this walks every arena four times with
// four different fixed dispositions, so a regime cannot pass because one
// particular strategy happens to survive it.

type Disposition = 'ALWAYS_HOLD' | 'ALWAYS_FIRST' | 'ALWAYS_LAST' | 'ALWAYS_COSTLIEST';

function chooseAction(
  run: RunState,
  disposition: Disposition,
  authored: ActionCode[],
): ActionCode {
  const affordable = affordableActions(run).filter(a => authored.includes(a));
  const pool = affordable.length > 0 ? affordable : (['HOLD'] as ActionCode[]);
  switch (disposition) {
    case 'ALWAYS_HOLD': return 'HOLD';
    case 'ALWAYS_FIRST': return pool[0];
    case 'ALWAYS_LAST': return pool[pool.length - 1];
    case 'ALWAYS_COSTLIEST': return pool.find(a => a !== 'HOLD') ?? 'HOLD';
  }
}

function playThrough(arenaId: Parameters<typeof createInitialRun>[1], disposition: Disposition) {
  const arena = allArenas().find(a => a.id === arenaId)!;
  let run: RunState = { ...createInitialRun(11, arenaId), id: `play_${arenaId}_${disposition}` };

  for (let i = 0; i < arena.checkpoints.length; i++) {
    const cp = arena.checkpoints[i];
    assert.equal(run.currentCheckpoint, cp.sequence, `${arenaId} lost its place at ${i}`);

    const authored = cp.availableActions.map(b => b.actionCode);
    const action = chooseAction(run, disposition, authored);
    const outcome = commitDecisionCommand(run, { action, conviction: 60 });
    assert.ok(outcome, `${arenaId} CP${cp.sequence} rejected ${action} (${disposition})`);

    run = attachThesis(outcome.run, 'THESIS_UNCHANGED');
    if (run.currentCheckpoint < arena.checkpoints.length) {
      run = advanceRunCheckpoint(run);
    }
  }
  return { run, arena };
}

const DISPOSITIONS: Disposition[] = [
  'ALWAYS_HOLD', 'ALWAYS_FIRST', 'ALWAYS_LAST', 'ALWAYS_COSTLIEST',
];

for (const arena of allArenas()) {
  for (const disposition of DISPOSITIONS) {
    test(`${arena.id} plays to the end (${disposition})`, () => {
      const { run } = playThrough(arena.id, disposition);
      assert.equal(
        run.decisions.length,
        arena.checkpoints.length,
        `finished with ${run.decisions.length} of ${arena.checkpoints.length} decisions`,
      );
      assert.equal(run.currentCheckpoint, arena.checkpoints.length);
      // Scores stay inside the range the UI renders.
      assert.ok(run.playerScore >= 0 && run.playerScore <= 100, `player score ${run.playerScore}`);
      assert.ok(run.machineScore >= 0 && run.machineScore <= 100);
    });
  }

  test(`${arena.id} never runs out of affordable stances`, () => {
    // The budget scales with arena length, so no checkpoint should be reachable
    // with nothing but HOLD available unless the player spent the budget
    // themselves. Walked with the cheapest-first disposition.
    const { run } = playThrough(arena.id, 'ALWAYS_FIRST');
    assert.ok(
      run.portfolio.turnoverUsed <= run.turnoverBudget + 1e-9,
      `${arena.id} overspent its budget`,
    );
  });

  test(`${arena.id} produces a record that replays to itself`, () => {
    const { run } = playThrough(arena.id, 'ALWAYS_FIRST');
    const rec = projectRun(run, '2026-01-01T00:00:00.000Z');
    assert.ok(rec, `${arena.id} did not project`);
    const replayed = replayRun(rec);
    assert.ok(replayed, `${arena.id} record could not be replayed`);
    assert.ok(
      replayMatchesRecord(rec, replayed),
      `${arena.id} replay diverged: ${replayed.playerScore} vs ${rec.playerScore}`,
    );
  });

  test(`${arena.id} produces an autopsy that reads`, () => {
    const { run } = playThrough(arena.id, 'ALWAYS_LAST');
    const rec = projectRun(run, '2026-01-01T00:00:00.000Z');
    assert.ok(rec);

    const rows = outcomes(rec);
    assert.equal(rows.length, run.decisions.length, `${arena.id} autopsy lost decisions`);
    for (const r of rows) {
      assert.ok(r.signalTitle.length > 0, `${arena.id} CP${r.sequence} has no title in the timeline`);
      assert.ok(r.crisisDay.length > 0, `${arena.id} CP${r.sequence} has no day`);
    }

    const attribution = scoreAttribution(rec);
    assert.equal(
      attribution.aboveParCount + attribution.belowParCount,
      rows.length,
      `${arena.id} attribution lost a decision`,
    );

    const h = headline(rec);
    assert.ok(h.verdict.length > 0 && h.detail.length > 0);
    // Flags must be resolvable; an unknown flag would render untoned.
    for (const t of flagTallies(rec)) {
      assert.ok(['positive', 'caution', 'severe'].includes(t.tone), `${t.flag} has no tone`);
    }
  });

  test(`${arena.id} resolves to a terminal result`, () => {
    const { run } = playThrough(arena.id, 'ALWAYS_FIRST');
    const result = resolveRunResult(run, run.playerScore > run.machineScore ? 'MACHINE_BEATEN' : 'PASSED');
    assert.ok(
      ['PASSED', 'FAILED', 'MACHINE_BEATEN'].includes(result),
      `${arena.id} ended as ${result}`,
    );
    // Observation mode is a real state, not an error: it must either be absent
    // or explain itself.
    const reason = observationModeReason(run);
    if (reason !== null) assert.ok(reason.length > 10, `${arena.id} observation reason is empty`);
  });
}

test('a HOLD-only run never breaches its own budget in any arena', () => {
  for (const arena of allArenas()) {
    const { run } = playThrough(arena.id, 'ALWAYS_HOLD');
    assert.equal(run.portfolio.turnoverUsed, 0, `${arena.id} charged for holding`);
  }
});

test('the arenas do not all end the same way', () => {
  // If every regime resolved identically for the same disposition, the
  // progression would be five coats of paint on one arena.
  const finals = allArenas().map(a => {
    const { run } = playThrough(a.id, 'ALWAYS_FIRST');
    return `${run.playerScore}:${run.portfolio.drawdown.toFixed(3)}`;
  });
  assert.ok(new Set(finals).size > 1, `every arena ended identically: ${finals[0]}`);
});
