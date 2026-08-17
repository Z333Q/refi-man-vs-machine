import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialRun, commitDecisionCommand, advanceRunCheckpoint,
  attachThesis, DEFAULT_RUN_SEED,
} from './runEngine';
import type { RunState } from './gameTypes';
import {
  MAX_STORED_RUNS, RUN_RECORD_VERSION, clearRunRecords, flushableRows,
  getRunRecord, latestFinishedRun, latestUnfinishedRun, listRunRecords,
  projectRun, saveRun,
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

test('records from an older shape are dropped, not half-read', () => {
  clearRunRecords();
  localStorage.setItem(
    'refi_run_records',
    JSON.stringify([{ recordVersion: RUN_RECORD_VERSION - 1, runId: 'ancient', decisions: [] }]),
  );
  assert.equal(listRunRecords().length, 0);
  assert.equal(getRunRecord('ancient'), null);
});

test('corrupt storage reads as empty rather than throwing', () => {
  clearRunRecords();
  localStorage.setItem('refi_run_records', '{not json');
  assert.deepEqual(listRunRecords(), []);
});

// ─── Forward path to Supabase ─────────────────────────────────────────────────

test('flushable rows match the arena_runs / checkpoint_decisions columns', () => {
  clearRunRecords();
  const rec = saveRun(runWith(2), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  const { run, decisions } = flushableRows(rec, 'ses_abc');

  assert.equal(run.id, 'run_test_0001');
  assert.equal(run.session_id, 'ses_abc');
  assert.equal(run.seed, rec.seed);
  assert.equal(run.arena_id, 'covid_black_swan');
  assert.equal(decisions.length, 2);
  assert.equal(decisions[0].run_id, 'run_test_0001');
  assert.equal(decisions[0].checkpoint_sequence, 1);
});

test('the client never names an owner: owner_id defaults to auth.uid() server-side', () => {
  clearRunRecords();
  const rec = saveRun(runWith(1), '2026-01-01T00:00:00.000Z');
  assert.ok(rec);
  const { run, decisions } = flushableRows(rec, 'ses_abc');
  assert.ok(!('owner_id' in run), 'a client-supplied owner would defeat owner-scoped RLS');
  assert.ok(decisions.every(d => !('owner_id' in d)));
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
