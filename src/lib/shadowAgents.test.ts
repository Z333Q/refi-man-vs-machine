import { test } from 'node:test';
import assert from 'node:assert/strict';

// The engine's shadow agents (docs/PLAN-endgame.md steps 1 and 2): a
// policy-driven opponent and the player's deployed machine, each on its own
// book, scored on the shared rubric, reproduced exactly by a replay.

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

const { createInitialRun, commitDecisionCommand, advanceRunCheckpoint, PASSIVE_HOLD_REASON } = await import('./runEngine');
const { getCheckpoint } = await import('./arenas');
const { DEFAULT_MACHINE_CONFIG } = await import('./gameTypes');
const { projectRun, replayRun, replayMatchesRecord, clearRunRecords, saveRun, getRunRecord } = await import('./runRecord');
const { opponentPolicyFor } = await import('./progressionEngine');
const { saveMachineVersion, deployedMachine, recordDeployedArena, clearMachineVersions, listMachineVersions } = await import('./machineVersions');
import type { DeployedMachine, RunState } from './gameTypes';

const ARENA = 'covid_black_swan' as const;

function playThrough(run: RunState, checkpoints: number): RunState {
  for (let i = 0; i < checkpoints; i++) {
    const out = commitDecisionCommand(run, { action: 'HOLD', conviction: 60 });
    assert.ok(out, `checkpoint ${run.currentCheckpoint} must commit`);
    run = advanceRunCheckpoint(out.run);
  }
  return run;
}

const deployed: DeployedMachine = {
  machineId: 'mch_test', name: 'TEST MACHINE', version: 'v0.1', versionNumber: 1,
  buildHash: 'AAAA:BBBB:CCCC', config: { ...DEFAULT_MACHINE_CONFIG, signal: 'REGIME_CLASSIFIER' },
};

test('an authored opponent leaves the run exactly as before', () => {
  const run = createInitialRun(1, ARENA, 'refi_rules');
  assert.equal(run.opponentPolicy.kind, 'AUTHORED');
  assert.equal(run.opponentAgent, null);
  assert.equal(run.deployed, null);
  const out = commitDecisionCommand(run, { action: 'HOLD', conviction: 60 });
  assert.ok(out);
  const cp = getCheckpoint(ARENA, 1)!;
  assert.equal(out.run.decisions[0].machineActionCode, cp.machineDecision.actionCode);
  assert.equal(out.run.decisions[0].machineReason, undefined);
  assert.equal(out.run.decisions[0].deployedActionCode, undefined);
});

test('the passive index holds every checkpoint and says why', () => {
  assert.deepEqual(opponentPolicyFor('spy_passive'), { kind: 'HOLD' });
  assert.deepEqual(opponentPolicyFor('refi_rules'), { kind: 'AUTHORED' });
  let run = createInitialRun(1, ARENA, 'spy_passive', { opponentPolicy: { kind: 'HOLD' } });
  assert.ok(run.opponentAgent, 'a policy-driven opponent keeps its own book');
  run = playThrough(run, 4);
  for (const d of run.decisions) {
    assert.equal(d.machineActionCode, 'HOLD');
    assert.equal(d.machineReason, PASSIVE_HOLD_REASON);
  }
  // Its score is its own running figure on the shared rubric, not the authored par.
  assert.equal(run.machineScore, run.opponentAgent!.score);
  // Its book never spent turnover: it never traded.
  assert.equal(run.opponentAgent!.portfolio.turnoverUsed, 0);
});

test('a deployed machine decides every checkpoint from its own book and is scored', () => {
  let run = createInitialRun(1, ARENA, 'refi_rules', { deployed });
  assert.ok(run.deployedAgent);
  run = playThrough(run, 5);
  for (const d of run.decisions) {
    assert.ok(d.deployedActionCode, 'every decision records the machine\'s call');
    assert.ok(d.deployedReason && d.deployedReason.length > 0, 'and its reason');
    assert.ok(typeof d.deployedConviction === 'number');
  }
  assert.ok(run.deployedAgent!.score > 0);
  // The player's own figures are untouched by the passenger.
  const solo = playThrough(createInitialRun(1, ARENA, 'refi_rules'), 5);
  assert.equal(run.playerScore, solo.playerScore);
  assert.equal(run.machineScore, solo.machineScore);
  assert.equal(run.portfolio.value, solo.portfolio.value);
});

test('the machine is deterministic: same build, same arena, same calls', () => {
  const a = playThrough(createInitialRun(1, ARENA, 'refi_rules', { deployed }), 6);
  const b = playThrough(createInitialRun(1, ARENA, 'refi_rules', { deployed }), 6);
  assert.deepEqual(
    a.decisions.map(d => d.deployedActionCode),
    b.decisions.map(d => d.deployedActionCode),
  );
  assert.equal(a.deployedAgent!.score, b.deployedAgent!.score);
});

test('a run record carries the opponent policy and the passenger, and a replay reproduces both', () => {
  clearRunRecords();
  let run: RunState = {
    ...createInitialRun(7, ARENA, 'spy_passive', { opponentPolicy: { kind: 'HOLD' }, deployed }),
    id: 'run_shadow',
  };
  run = playThrough(run, 4);
  const rec = projectRun(run, '2026-09-06T00:00:00.000Z');
  assert.ok(rec);
  assert.equal(rec.recordVersion, 3);
  assert.deepEqual(rec.opponentPolicy, { kind: 'HOLD' });
  assert.equal(rec.deployed?.buildHash, deployed.buildHash);
  assert.equal(rec.deployedScore, run.deployedAgent!.score);
  assert.equal(rec.decisions[0].deployedActionCode, run.decisions[0].deployedActionCode);
  assert.equal(rec.decisions[0].machineReason, PASSIVE_HOLD_REASON);

  const back = replayRun(rec);
  assert.ok(back, 'a v3 record must replay');
  assert.equal(back.machineId, 'spy_passive');
  assert.equal(back.opponentPolicy.kind, 'HOLD');
  assert.equal(back.deployedAgent?.score, run.deployedAgent!.score);
  assert.deepEqual(
    back.decisions.map(d => d.deployedActionCode),
    run.decisions.map(d => d.deployedActionCode),
  );
  assert.ok(replayMatchesRecord(rec, back));
});

test('a v2 record migrates to AUTHORED with no passenger, never an invented one', () => {
  clearRunRecords();
  let run: RunState = { ...createInitialRun(3, ARENA), id: 'run_v2' };
  run = playThrough(run, 2);
  const rec = projectRun(run, '2026-01-01T00:00:00.000Z')!;
  const v2 = {
    ...rec,
    recordVersion: 2,
    opponentPolicy: undefined, deployed: undefined, deployedScore: undefined,
    decisions: rec.decisions.map(({ machineReason: _a, deployedActionCode: _b, deployedReason: _c, deployedConviction: _d, ...d }) => d),
  };
  localStorage.setItem('refi_run_records', JSON.stringify([v2]));
  const back = getRunRecord('run_v2');
  assert.ok(back);
  assert.equal(back.recordVersion, 3);
  assert.deepEqual(back.opponentPolicy, { kind: 'AUTHORED' });
  assert.equal(back.deployed, null);
  assert.equal(back.deployedScore, null);
  assert.equal(back.decisions[0].deployedActionCode, null);
  assert.ok(replayRun(back), 'a migrated record still replays');
  // Re-saving keeps it honest.
  const saved = saveRun(run, '2026-06-01T00:00:00.000Z');
  assert.equal(saved?.deployed, null);
});

test('compile is deploy: the latest compiled version rides along, and finishing an arena is recorded on it', () => {
  clearMachineVersions();
  assert.equal(deployedMachine(), null);
  saveMachineVersion('Z333Q', DEFAULT_MACHINE_CONFIG, ['UNIVERSE'], '2026-09-06T10:00:00.000Z');
  const second = saveMachineVersion('Z333Q', { ...DEFAULT_MACHINE_CONFIG, signal: 'PRICE_MOMENTUM' }, ['UNIVERSE'], '2026-09-06T11:00:00.000Z');
  const d = deployedMachine();
  assert.ok(d);
  assert.equal(d.buildHash, second.buildHash);
  assert.equal(d.version, 'v0.2');
  recordDeployedArena(d.machineId, ARENA);
  recordDeployedArena(d.machineId, ARENA);
  assert.deepEqual(listMachineVersions('Z333Q').find(v => v.machineId === d.machineId)?.arenasCompleted, [ARENA]);
});
