import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialRun, commitDecisionCommand, advanceRunCheckpoint,
  attachThesis, DEFAULT_RUN_SEED,
} from './runEngine';
import type { RunState } from './gameTypes';
import { getCheckpoint } from './arenas';
import './arenaIndex';
import {
  MAX_STORED_RUNS, RUN_RECORD_VERSION, applyRemoteRun, clearRunRecords,
  getRunRecord, latestFinishedRun, latestUnfinishedRun, listRunRecords,
  projectRun, saveRun, setRunRecordMirror, replayRun, replayMatchesRecord,
} from './runRecord';
import { bestAndWorst, flagTallies, headline, outcomes, scoreAttribution } from './runAnalysis';

// ─── localStorage stand-in ────────────────────────────────────────────────────
// The record store is a browser module; node has no localStorage. A minimal
// in-memory twin keeps these tests exercising the real code path rather than a
// re-implementation of it.

function installStorage(): { failWrites: (on: boolean) => void } {
  let store = new Map<string, string>();
  let failing = false;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failing) throw new Error('QuotaExceededError');
      store.set(k, v);
    },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store = new Map(); },
  };
  return { failWrites: (on: boolean) => { failing = on; } };
}

const storage = installStorage();

/** A run with `n` committed decisions, all HOLD unless told otherwise. */
function runWith(n: number, seed = 1234): RunState {
  let run: RunState = { ...createInitialRun(seed), id: 'run_test_0001' };
  for (let i = 0; i < n; i++) {
    const out = commitDecisionCommand(run, { action: 'HOLD', conviction: 50 });
    assert.ok(out, `commit ${i + 1} should succeed`);
    run = attachThesis(out.run, 'THESIS_UNCHANGED');
    run = advanceRunCheckpoint(run);
  }
  return run;
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

test('a run carries its seed, and the engine default is fixed', () => {
  assert.equal(createInitialRun().seed, DEFAULT_RUN_SEED);
  assert.equal(createInitialRun(99).seed, 99);
});

test('the seed survives commits and checkpoint advances', () => {
  const run = runWith(3, 4242);
  assert.equal(run.seed, 4242, 'seed must be an anchor, not a per-checkpoint value');
});

test('identical decision sequences from one seed produce identical state', () => {
  const a = runWith(4, 777);
  const b = runWith(4, 777);
  assert.deepEqual(a, b, '§65: deterministic replay from the run seed');
});

// ─── Projection ───────────────────────────────────────────────────────────────

test('a run with no id does not project: an unidentified run cannot be stored', () => {
  const run = createInitialRun();
  assert.equal(projectRun(run, '2026-01-01T00:00:00.000Z'), null);
});

test('projection carries the decision record faithfully', () => {
  const run = runWith(3);
  const rec = projectRun(run, '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  assert.equal(rec.recordVersion, RUN_RECORD_VERSION);
  assert.equal(rec.decisions.length, 3);
  assert.equal(rec.decisions[0].actionCode, 'HOLD');
  assert.equal(rec.decisions[0].thesisCode, 'THESIS_UNCHANGED');
  assert.equal(rec.seed, run.seed);
  assert.equal(rec.runId, 'run_test_0001');
});

test('startedAt is carried from the earlier record, not reset on every write', () => {
  const run = runWith(1);
  const first = projectRun(run, '2026-01-01T00:00:00.000Z');
  assert.ok(first);
  const second = projectRun(run, '2026-01-02T00:00:00.000Z', first);
  assert.ok(second);
  assert.equal(second.startedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(second.updatedAt, '2026-01-02T00:00:00.000Z');
});

test('a completion time, once set, never moves', () => {
  const run = { ...runWith(1), phase: 'COMPLETE' as const };
  const first = projectRun(run, '2026-01-01T00:00:00.000Z');
  assert.ok(first);
  assert.equal(first.completedAt, '2026-01-01T00:00:00.000Z');
  const second = projectRun(run, '2026-06-01T00:00:00.000Z', first);
  assert.ok(second);
  assert.equal(second.completedAt, '2026-01-01T00:00:00.000Z');
});

// ─── Store ────────────────────────────────────────────────────────────────────

test('a saved run round-trips', () => {
  clearRunRecords();
  const run = runWith(2);
  saveRun(run, '2026-01-01T00:00:00.000Z');
  const back = getRunRecord('run_test_0001');
  assert.ok(back);
  assert.equal(back.decisions.length, 2);
});

test('re-saving the same run replaces it rather than accumulating duplicates', () => {
  clearRunRecords();
  saveRun(runWith(1), '2026-01-01T00:00:00.000Z');
  saveRun(runWith(3), '2026-01-02T00:00:00.000Z');
  const all = listRunRecords();
  assert.equal(all.length, 1);
  assert.equal(all[0].decisions.length, 3, 'the later write wins');
});

test('the store is capped, and the newest runs are the ones kept', () => {
  clearRunRecords();
  for (let i = 0; i < MAX_STORED_RUNS + 5; i++) {
    const run = { ...runWith(1), id: `run_${String(i).padStart(3, '0')}` };
    saveRun(run, `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`);
  }
  assert.equal(listRunRecords().length, MAX_STORED_RUNS);
});

test('finished and unfinished runs are told apart', () => {
  clearRunRecords();
  saveRun({ ...runWith(2), id: 'run_open' }, '2026-01-01T00:00:00.000Z');
  saveRun(
    { ...runWith(2), id: 'run_done', phase: 'COMPLETE' },
    '2026-01-02T00:00:00.000Z',
  );
  assert.equal(latestFinishedRun()?.runId, 'run_done');
  assert.equal(latestUnfinishedRun()?.runId, 'run_open');
});

test('a failed write never throws into the run', () => {
  clearRunRecords();
  storage.failWrites(true);
  assert.doesNotThrow(() => saveRun(runWith(1)));
  storage.failWrites(false);
});

test('records from an unknown shape are dropped, not half-read', () => {
  clearRunRecords();
  localStorage.setItem(
    'refi_run_records',
    JSON.stringify([
      { recordVersion: 0, runId: 'ancient', decisions: [] },
      { recordVersion: RUN_RECORD_VERSION + 1, runId: 'future', decisions: [] },
    ]),
  );
  assert.equal(listRunRecords().length, 0);
  assert.equal(getRunRecord('ancient'), null);
  assert.equal(getRunRecord('future'), null);
});

test('a legacy v1 record survives migration with commit times honestly null', () => {
  clearRunRecords();
  // A v2 record with the v1 shape restored: version 1, no committedAt anywhere.
  const rec = projectRun(runWith(2), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  const v1 = {
    ...rec,
    recordVersion: 1,
    decisions: rec.decisions.map(({ committedAt: _committedAt, ...d }) => d),
  };
  localStorage.setItem('refi_run_records', JSON.stringify([v1]));

  const back = getRunRecord(rec.runId);
  assert.ok(back, 'a v1 record must migrate, not vanish');
  assert.equal(back.recordVersion, RUN_RECORD_VERSION);
  assert.equal(back.decisions.length, 2);
  for (const d of back.decisions) {
    assert.equal(d.committedAt, null,
      'a migration must never invent the timestamp it is missing');
  }
});

test('re-saving a migrated run keeps null commit times null', () => {
  clearRunRecords();
  const live = runWith(2);
  const rec = projectRun(live, '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  const v1 = {
    ...rec,
    recordVersion: 1,
    decisions: rec.decisions.map(({ committedAt: _committedAt, ...d }) => d),
  };
  localStorage.setItem('refi_run_records', JSON.stringify([v1]));

  const saved = saveRun(live, '2026-06-01T00:00:00.000Z');
  assert.ok(saved);
  for (const d of saved.decisions) {
    assert.equal(d.committedAt, null,
      're-projection must not stamp a commit time onto a decision that never had one');
  }
});

test('corrupt storage reads as empty rather than throwing', () => {
  clearRunRecords();
  localStorage.setItem('refi_run_records', '{not json');
  assert.deepEqual(listRunRecords(), []);
});

// ─── Commit times ─────────────────────────────────────────────────────────────

test('new decisions are stamped with the write time, and the stamp never moves', () => {
  clearRunRecords();
  const one = runWith(1);
  const first = saveRun(one, '2026-01-01T00:00:00.000Z');
  assert.ok(first);
  assert.equal(first.decisions[0].committedAt, '2026-01-01T00:00:00.000Z');

  // The run grows by one decision; the earlier decision keeps its time.
  const two = runWith(2);
  const second = saveRun(two, '2026-02-01T00:00:00.000Z');
  assert.ok(second);
  assert.equal(second.decisions[0].committedAt, '2026-01-01T00:00:00.000Z',
    'a commit time, once recorded, is fixed');
  assert.equal(second.decisions[1].committedAt, '2026-02-01T00:00:00.000Z');
});

// ─── Wire shape ───────────────────────────────────────────────────────────────

test('the serialized record names no identity: no session_id, no owner', () => {
  clearRunRecords();
  const rec = saveRun(runWith(2), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  const wire = JSON.stringify(rec);
  for (const field of ['session_id', 'sessionId', 'owner_id', 'alpha_player_id', 'alphaPlayerId']) {
    assert.ok(!wire.includes(field),
      `${field} must not travel in the record; identity is the transport header's job`);
  }
});

// ─── Remote mirror ────────────────────────────────────────────────────────────

test('a save is announced to the mirror, and a failing mirror never reaches the run', () => {
  clearRunRecords();
  const announced: string[] = [];
  setRunRecordMirror(r => { announced.push(r.runId); });
  saveRun(runWith(1), '2026-01-01T00:00:00.000Z');
  assert.deepEqual(announced, ['run_test_0001']);

  setRunRecordMirror(() => { throw new Error('mirror down'); });
  assert.doesNotThrow(() => saveRun(runWith(2)));
  setRunRecordMirror(null);
});

test('a remote run fills a local gap; a run local holds is never overwritten', () => {
  clearRunRecords();
  const rec = projectRun(runWith(2), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);

  assert.equal(applyRemoteRun(rec).kind, 'ADOPTED');
  assert.equal(getRunRecord(rec.runId)?.decisions.length, 2);

  // The identical record again: local is authoritative and untouched.
  assert.equal(applyRemoteRun(rec).kind, 'LOCAL_KEPT');

  // A differing record for the same run id: conflict, local kept, remote
  // preserved in the outcome. Timestamps play no part in the decision.
  const differing = { ...rec, playerScore: rec.playerScore + 10, updatedAt: '2030-01-01T00:00:00.000Z' };
  const outcome = applyRemoteRun(differing);
  assert.equal(outcome.kind, 'CONFLICT');
  assert.equal(getRunRecord(rec.runId)?.playerScore, rec.playerScore,
    'a newer timestamp must not buy the remote record the win');
  if (outcome.kind === 'CONFLICT') {
    assert.equal(outcome.remote.playerScore, rec.playerScore + 10);
  }
});

test('updatedAt alone is not a difference: it is audit metadata, not content', () => {
  clearRunRecords();
  const rec = projectRun(runWith(1), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  assert.equal(applyRemoteRun(rec).kind, 'ADOPTED');
  const echo = { ...rec, updatedAt: '2027-01-01T00:00:00.000Z' };
  assert.equal(applyRemoteRun(echo).kind, 'LOCAL_KEPT',
    'a mirror echo with a later updatedAt is the same record, not a conflict');
});

test('a malformed or unknown-version remote payload is refused, not stored', () => {
  clearRunRecords();
  const bad = { runId: 'run_bad', recordVersion: 99, decisions: [] } as never;
  assert.equal(applyRemoteRun(bad).kind, 'REFUSED');
  assert.equal(getRunRecord('run_bad'), null);
  const notARecord = { recordVersion: RUN_RECORD_VERSION } as never;
  assert.equal(applyRemoteRun(notARecord).kind, 'REFUSED');
});

test('a remote v1 record is migrated on adoption, commit times honestly null', () => {
  clearRunRecords();
  const rec = projectRun(runWith(1), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  const v1 = {
    ...rec,
    recordVersion: 1,
    decisions: rec.decisions.map(({ committedAt: _committedAt, ...d }) => d),
  } as never;
  assert.equal(applyRemoteRun(v1).kind, 'ADOPTED');
  const back = getRunRecord(rec.runId);
  assert.ok(back);
  assert.equal(back.recordVersion, RUN_RECORD_VERSION);
  assert.equal(back.decisions[0].committedAt, null);
});

// ─── Analysis ─────────────────────────────────────────────────────────────────

test('outcomes carry a return for both sides at every committed checkpoint', () => {
  const rec = projectRun(runWith(4), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  const rows = outcomes(rec);
  assert.equal(rows.length, 4);
  for (const r of rows) {
    assert.equal(typeof r.playerReturn, 'number');
    assert.equal(typeof r.machineReturn, 'number');
    assert.ok(r.signalTitle.length > 0, 'the timeline needs the authored headline');
  }
});

test('best and worst are withheld until the run can support them', () => {
  const one = projectRun(runWith(1), '2026-01-01T00:00:00.000Z');
  assert.ok(one);
  assert.deepEqual(bestAndWorst(one), { best: null, worst: null });
});

test('best and worst are distinct decisions when they exist', () => {
  const rec = projectRun(runWith(6), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  const { best, worst } = bestAndWorst(rec);
  if (best && worst) {
    assert.notEqual(best.sequence, worst.sequence);
    assert.ok(best.decision.scoreContribution >= worst.decision.scoreContribution);
  }
});

test('flag tallies count real occurrences and record where they happened', () => {
  const rec = projectRun(runWith(5), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  for (const t of flagTallies(rec)) {
    assert.equal(t.count, t.checkpoints.length);
    assert.ok(['positive', 'caution', 'severe'].includes(t.tone));
  }
});

test('score attribution splits every decision against par, losing none', () => {
  const rec = projectRun(runWith(5), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  const a = scoreAttribution(rec);
  assert.equal(a.aboveParCount + a.belowParCount, rec.decisions.length);
  assert.ok(a.added >= 0 && a.removed >= 0, 'both sides are reported as magnitudes');
});

test('an empty run gets an honest headline rather than a diagnosis', () => {
  const rec = projectRun({ ...createInitialRun(), id: 'run_empty' }, '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  assert.match(headline(rec).verdict, /NO DECISIONS/);
});

test('a breached risk budget is reported before any score comparison', () => {
  const rec = projectRun(
    { ...runWith(3), criticalFailure: true, criticalFailureCheckpoint: 2 },
    '2026-01-01T00:00:00.000Z',
  );
  assert.ok(rec);
  const h = headline(rec);
  assert.match(h.verdict, /RISK BUDGET/);
  assert.match(h.detail, /checkpoint 2/);
});

test('the headline never claims a win the score does not show', () => {
  const base = runWith(3);
  const behind = projectRun({ ...base, playerScore: 40, machineScore: 60 }, 'now');
  const ahead = projectRun({ ...base, playerScore: 70, machineScore: 60 }, 'now');
  const level = projectRun({ ...base, playerScore: 55, machineScore: 55 }, 'now');
  assert.ok(behind && ahead && level);
  assert.match(headline(behind).verdict, /MACHINE LED BY 20/);
  assert.match(headline(ahead).verdict, /YOU BEAT THE MACHINE/);
  assert.match(headline(level).verdict, /LEVEL/);
});

// ─── Replay ───────────────────────────────────────────────────────────────────

/** A run whose stances differ per checkpoint, so replay has something to get wrong. */
function variedRun(seed = 31337): RunState {
  let run: RunState = { ...createInitialRun(seed), id: 'run_varied' };
  const wanted = ['HOLD', 'REDUCE', 'HOLD', 'RAISE_CASH', 'HOLD'] as const;
  for (const action of wanted) {
    const cp = run.currentCheckpoint;
    const branch = getCheckpoint('covid_black_swan', cp)?.availableActions.find(a => a.actionCode === action);
    // Content does not author every stance at every checkpoint; take what is
    // there so the fixture stays honest about the arena it replays.
    const chosen = branch?.actionCode ?? getCheckpoint('covid_black_swan', cp)!.availableActions[0].actionCode;
    const out = commitDecisionCommand(run, { action: chosen, conviction: 60 });
    assert.ok(out);
    run = attachThesis(out.run, 'THESIS_UNCHANGED');
    run = advanceRunCheckpoint(run);
  }
  return run;
}

test('replay reproduces the run the record came from', () => {
  const live = variedRun();
  const rec = projectRun(live, '2026-01-01T00:00:00.000Z');
  assert.ok(rec);

  const replayed = replayRun(rec);
  assert.ok(replayed, 'a well-formed record must replay');
  assert.equal(replayed.playerScore, live.playerScore);
  assert.equal(replayed.machineScore, live.machineScore);
  assert.equal(replayed.currentCheckpoint, live.currentCheckpoint);
  assert.equal(replayed.portfolio.value, live.portfolio.value);
  assert.equal(replayed.portfolio.drawdown, live.portfolio.drawdown);
  assert.equal(replayed.portfolio.turnoverUsed, live.portfolio.turnoverUsed);
  assert.equal(replayed.seed, live.seed);
  assert.deepEqual(
    replayed.decisions.map(d => d.actionCode),
    live.decisions.map(d => d.actionCode),
  );
});

test('replay restores the thesis on every decision that had one', () => {
  const rec = projectRun(variedRun(), 'now');
  assert.ok(rec);
  const replayed = replayRun(rec);
  assert.ok(replayed);
  assert.deepEqual(
    replayed.decisions.map(d => d.thesisCode),
    rec.decisions.map(d => d.thesisCode ?? undefined),
  );
});

test('replay is checked against the record, and a match is reported', () => {
  const live = variedRun();
  const rec = projectRun(live, 'now');
  assert.ok(rec);
  const replayed = replayRun(rec);
  assert.ok(replayed);
  assert.equal(replayMatchesRecord(rec, replayed), true);
});

test('a record whose scores no longer reproduce is refused, not silently accepted', () => {
  const rec = projectRun(variedRun(), 'now');
  assert.ok(rec);
  const replayed = replayRun(rec);
  assert.ok(replayed);
  // Stand in for a scoring change since the run was stored.
  const drifted = { ...rec, playerScore: rec.playerScore + 7 };
  assert.equal(replayMatchesRecord(drifted, replayed), false);
});

test('a stance the arena does not author refuses to replay', () => {
  const rec = projectRun(variedRun(), 'now');
  assert.ok(rec);
  const broken = {
    ...rec,
    decisions: [{ ...rec.decisions[0], actionCode: 'ROTATE_RISK' as const }, ...rec.decisions.slice(1)],
  };
  const replayed = replayRun(broken);
  // Either the engine refuses the stance outright, or the run it produces no
  // longer matches the record. Both are a refusal; neither is a silent resume.
  assert.ok(replayed === null || !replayMatchesRecord(broken, replayed));
});

test('replay carries the modules the player had earned', () => {
  const rec = projectRun(variedRun(), 'now');
  assert.ok(rec);
  const replayed = replayRun(rec, ['CORRELATION_MATRIX']);
  assert.ok(replayed);
  assert.ok(replayed.activeModules.includes('CORRELATION_MATRIX'));
  assert.equal(
    new Set(replayed.activeModules).size,
    replayed.activeModules.length,
    'the module list must not gain duplicates on resume',
  );
});

test('a run recorded mid-resolution replays without advancing past itself', () => {
  // Commit without advancing: the state a player leaves by closing the tab on
  // the reveal.
  let run: RunState = { ...createInitialRun(4242), id: 'run_midair' };
  const out = commitDecisionCommand(run, { action: 'HOLD', conviction: 50 });
  assert.ok(out);
  run = attachThesis(out.run, 'THESIS_UNCHANGED');

  const rec = projectRun(run, 'now');
  assert.ok(rec);
  assert.equal(rec.currentCheckpoint, 1, 'the run had not advanced');

  const replayed = replayRun(rec);
  assert.ok(replayed);
  assert.equal(replayed.currentCheckpoint, 1);
  assert.equal(replayed.decisions.length, 1);
  assert.equal(replayMatchesRecord(rec, replayed), true);
});

test('an empty record replays to an empty run rather than failing', () => {
  const rec = projectRun({ ...createInitialRun(9), id: 'run_empty2' }, 'now');
  assert.ok(rec);
  const replayed = replayRun(rec);
  assert.ok(replayed);
  assert.equal(replayed.decisions.length, 0);
});
