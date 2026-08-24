import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  blocksFromPortfolio, previewStanceBlocks, orderBlocks, layoutBlocks,
  type BlockInput,
} from './blockField';
import {
  createInitialPortfolio, simulatePortfolioAdvance, nextCashWeight,
  stanceCashDelta, CASH_WEIGHT_MIN, CASH_WEIGHT_MAX,
} from './runEngine';
import { allArenas } from '../lib/arenas';
import '../lib/arenaIndex';
import { reducer, type GameState } from '../context/gameReducer';
import { createDefaultProfile, checkModuleUnlocks, TERMINAL_MODULES } from './progressionEngine';
import { createInitialRun } from './runEngine';
import type { ActionCode, ArenaId } from './gameTypes';

// ─── The 2026-08-25 #30 salvage, pinned ──────────────────────────────────────
//
// The historical branch's own tests gave it confidence it had not earned: its
// preview clamp disagreed with the engine's, its "blocks sum to the portfolio"
// could render 110%, and its stability test proved array order rather than
// row membership. Every corrected law gets a test here.

const EPS = 1e-9;

const sum = (blocks: readonly BlockInput[]) => blocks.reduce((s, b) => s + b.weight, 0);

const ALL_ACTIONS: ActionCode[] = [
  'HOLD', 'REDUCE', 'ROTATE_DEFENSIVE', 'ROTATE_RISK',
  'RAISE_CASH', 'ADD_RISK', 'STAGED_BUY', 'STAGED_SELL',
];

// ─── Normalization: the field always sums to exactly 1 ───────────────────────

test('every arena starting book normalizes to exactly 1', () => {
  for (const arena of allArenas()) {
    const p = createInitialPortfolio(arena.id);
    const blocks = blocksFromPortfolio(p.positions, p.cashWeight);
    assert.ok(Math.abs(sum(blocks) - 1) < EPS, `${arena.id} must sum to 1`);
    const cash = blocks.find(b => b.isCash);
    assert.ok(cash, `${arena.id} must carry a cash block`);
    assert.ok(Math.abs(cash!.weight - p.cashWeight) < EPS, `${arena.id} cash must be exact`);
  }
});

test('the field still sums to 1 after every supported stance', () => {
  // The defect this pins: the engine moves cashWeight without renormalizing
  // position weights, so raw weights + cash can exceed 1. The adapter must
  // absorb that, for every arena and every action.
  for (const arena of allArenas()) {
    let p = createInitialPortfolio(arena.id);
    for (const action of ALL_ACTIONS) {
      p = simulatePortfolioAdvance(p, action, 1, arena.id);
      const blocks = blocksFromPortfolio(p.positions, p.cashWeight);
      assert.ok(
        Math.abs(sum(blocks) - 1) < EPS,
        `${arena.id} after ${action}: sum ${sum(blocks)}`,
      );
    }
  }
});

test('relative equity exposure is preserved by normalization', () => {
  const p = createInitialPortfolio('covid_black_swan');
  const blocks = blocksFromPortfolio(p.positions, p.cashWeight);
  const a = p.positions[0];
  const b = p.positions[2];
  const blockA = blocks.find(x => x.key === a.symbol)!;
  const blockB = blocks.find(x => x.key === b.symbol)!;
  assert.ok(
    Math.abs(blockA.weight / blockB.weight - a.weight / b.weight) < 1e-6,
    'the ratio between two holdings must survive rescaling',
  );
});

// ─── Preview truthfulness: one cash authority ────────────────────────────────

test('preview cash equals committed cash for every stance, in every arena', () => {
  for (const arena of allArenas()) {
    const p = createInitialPortfolio(arena.id);
    for (const action of ALL_ACTIONS) {
      const preview = previewStanceBlocks(p.positions, p.cashWeight, action);
      const committed = simulatePortfolioAdvance(p, action, 1, arena.id);
      const previewCash = preview.find(b => b.isCash)!.weight;
      assert.ok(
        Math.abs(previewCash - committed.cashWeight) < EPS,
        `${arena.id} ${action}: preview ${previewCash} vs committed ${committed.cashWeight}`,
      );
    }
  }
});

test('preview and engine agree at both cash boundaries', () => {
  const p = createInitialPortfolio('covid_black_swan');
  // Pinned at the floor: ADD_RISK cannot take cash below the minimum.
  const atMin = { ...p, cashWeight: CASH_WEIGHT_MIN };
  assert.equal(nextCashWeight(atMin.cashWeight, 'ADD_RISK'), CASH_WEIGHT_MIN);
  assert.ok(Math.abs(
    previewStanceBlocks(atMin.positions, atMin.cashWeight, 'ADD_RISK').find(b => b.isCash)!.weight
    - simulatePortfolioAdvance(atMin, 'ADD_RISK', 1, 'covid_black_swan').cashWeight,
  ) < EPS);
  // Pinned at the ceiling: RAISE_CASH cannot take cash above the maximum.
  const atMax = { ...p, cashWeight: CASH_WEIGHT_MAX };
  assert.equal(nextCashWeight(atMax.cashWeight, 'RAISE_CASH'), CASH_WEIGHT_MAX);
  assert.ok(Math.abs(
    previewStanceBlocks(atMax.positions, atMax.cashWeight, 'RAISE_CASH').find(b => b.isCash)!.weight
    - simulatePortfolioAdvance(atMax, 'RAISE_CASH', 1, 'covid_black_swan').cashWeight,
  ) < EPS);
});

test('HOLD previews as stillness: byte-equivalent allocation', () => {
  const p = createInitialPortfolio('covid_black_swan');
  assert.equal(stanceCashDelta('HOLD'), 0);
  assert.deepEqual(
    previewStanceBlocks(p.positions, p.cashWeight, 'HOLD'),
    blocksFromPortfolio(p.positions, p.cashWeight),
  );
});

test('the preview never leaks the market: only allocation moves', () => {
  // Same PnL in and out; only weights change. A preview that applied returns
  // would be a forecast.
  const p = createInitialPortfolio('covid_black_swan');
  const preview = previewStanceBlocks(p.positions, p.cashWeight, 'RAISE_CASH');
  for (const pos of p.positions) {
    const block = preview.find(b => b.key === pos.symbol)!;
    assert.equal(block.pnl, pos.pnl, `${pos.symbol} PnL must be untouched by preview`);
  }
});

// ─── Layout: exact area, no overlap, stable rows ─────────────────────────────

function covidBlocks(): BlockInput[] {
  const p = createInitialPortfolio('covid_black_swan');
  return blocksFromPortfolio(p.positions, p.cashWeight);
}

test('block area is proportional to allocation within floating-point tolerance', () => {
  // The historical test allowed 85% relative error. Row math makes area exact:
  // area = weight/total × field area, so the tolerance is numerical, not visual.
  const W = 600, H = 200;
  const blocks = covidBlocks();
  const rects = layoutBlocks(blocks, W, H);
  for (const r of rects) {
    const expected = r.weight * W * H;
    assert.ok(
      Math.abs(r.w * r.h - expected) < 1e-6,
      `${r.key}: area ${r.w * r.h} vs expected ${expected}`,
    );
  }
});

test('blocks never overlap and never leave the field', () => {
  const W = 600, H = 200;
  const rects = layoutBlocks(covidBlocks(), W, H);
  for (const r of rects) {
    assert.ok(r.x >= -EPS && r.y >= -EPS && r.x + r.w <= W + 1e-6 && r.y + r.h <= H + 1e-6, `${r.key} in bounds`);
    for (const o of rects) {
      if (o === r) continue;
      const disjoint =
        r.x + r.w <= o.x + 1e-6 || o.x + o.w <= r.x + 1e-6 ||
        r.y + r.h <= o.y + 1e-6 || o.y + o.h <= r.y + 1e-6;
      assert.ok(disjoint, `${r.key} overlaps ${o.key}`);
    }
  }
});

test('layout is deterministic', () => {
  const a = layoutBlocks(covidBlocks(), 600, 200);
  const b = layoutBlocks(covidBlocks(), 600, 200);
  assert.deepEqual(a, b);
});

test('cash orders last and is the hollow block', () => {
  const ordered = orderBlocks(covidBlocks());
  const last = ordered[ordered.length - 1];
  assert.equal(last.key, 'CASH');
  assert.equal(last.isCash, true);
  assert.ok(ordered.slice(0, -1).every(b => !b.isCash));
});

test('a PnL-only change does not move a single rectangle', () => {
  // The channel law, pinned: allocation geometry belongs to the player's
  // stance; the market speaks only through PnL. The engine never marks
  // position weights to market, so a field whose rectangles moved on a PnL
  // change would be inventing an allocation shift no engine state contains.
  const before = covidBlocks();
  const repriced = before.map(b => (b.isCash ? b : { ...b, pnl: b.pnl - 0.12 }));

  const a = layoutBlocks(before, 600, 200);
  const b = layoutBlocks(repriced, 600, 200);
  assert.equal(a.length, b.length);
  a.forEach((rect, i) => {
    assert.equal(b[i].key, rect.key);
    assert.equal(b[i].x, rect.x, `${rect.key} x`);
    assert.equal(b[i].y, rect.y, `${rect.key} y`);
    assert.equal(b[i].w, rect.w, `${rect.key} w`);
    assert.equal(b[i].h, rect.h, `${rect.key} h`);
    assert.equal(b[i].row, rect.row, `${rect.key} row`);
  });
  // And the changed PnL is still carried, for the edge and the printed number.
  for (const rect of b) {
    if (!rect.isCash) {
      const src = before.find(x => x.key === rect.key)!;
      assert.ok(Math.abs(rect.pnl - (src.pnl - 0.12)) < EPS, `${rect.key} carries new PnL`);
    }
  }
});

test('terminal module access keys are unique', () => {
  // BLOCK_FIELD briefly claimed B, which BASKET_WRITER already owns. Module
  // keys are canonical metadata; two modules must never share one.
  const keys = TERMINAL_MODULES.map(m => m.key);
  assert.equal(new Set(keys).size, keys.length, `duplicate key among: ${keys.join(', ')}`);
});

test('row membership survives a large weight change', () => {
  // The historical defect: rows followed cumulative weight, so a position
  // that grew could evict its neighbours into another row. Membership must
  // depend on identity only.
  const before = covidBlocks();
  const rowsBefore = new Map(layoutBlocks(before, 600, 200).map(r => [r.key, r.row]));

  // One holding quadruples; everything else shrinks to fund it.
  const distorted = before.map(b =>
    b.key === 'MSFT' ? { ...b, weight: b.weight * 4 } : { ...b, weight: b.weight * 0.6 },
  );
  const total = distorted.reduce((s, b) => s + b.weight, 0);
  const renormed = distorted.map(b => ({ ...b, weight: b.weight / total }));

  const rowsAfter = layoutBlocks(renormed, 600, 200);
  for (const r of rowsAfter) {
    assert.equal(r.row, rowsBefore.get(r.key), `${r.key} must stay in its row`);
  }
  // And relative order inside the field is unchanged.
  assert.deepEqual(
    rowsAfter.map(r => r.key),
    layoutBlocks(before, 600, 200).map(r => r.key),
  );
});

// ─── Unlock law (owner ruling: COVID CP3, completion, win or lose) ───────────

function stateInRun(arenaId: string, checkpoint: number): GameState {
  const run = { ...createInitialRun(1, arenaId as never), id: 'run_bf', currentCheckpoint: checkpoint };
  return {
    profile: createDefaultProfile('ses_bf'),
    run,
    lastCheckpointScore: null,
    lastCheckpointFlags: [],
    moduleJustUnlocked: null,
    xpJustEarned: 0,
    loaded: true,
  };
}

test('COVID CP1 and CP2 completion do not unlock the block field', () => {
  const profile = createDefaultProfile('ses_bf');
  assert.deepEqual(checkModuleUnlocks(profile, 1, 'covid_black_swan'), []);
  assert.deepEqual(checkModuleUnlocks(profile, 2, 'covid_black_swan'), []);
});

test('completing COVID CP3 unlocks the block field, regardless of score', () => {
  const profile = createDefaultProfile('ses_bf');
  assert.deepEqual(checkModuleUnlocks(profile, 3, 'covid_black_swan'), ['BLOCK_FIELD']);
});

test('another arena reaching CP3 does not independently unlock it', () => {
  const profile = createDefaultProfile('ses_bf');
  const others: ArenaId[] = ['recovery_trap', 'inflation_shift', 'banking_stress', 'taco_protocol'];
  for (const arenaId of others) {
    const unlocks = checkModuleUnlocks(profile, 3, arenaId);
    assert.ok(!unlocks.includes('BLOCK_FIELD'), `${arenaId} must not grant BLOCK_FIELD`);
  }
});

test('the unlock never fires twice', () => {
  const profile = createDefaultProfile('ses_bf');
  profile.unlockedModules = ['BLOCK_FIELD'];
  assert.deepEqual(checkModuleUnlocks(profile, 3, 'covid_black_swan'), []);
  assert.deepEqual(checkModuleUnlocks(profile, 4, 'covid_black_swan'), []);
});

test('reducer integration: committing COVID CP3 earns the module for CP4', () => {
  // The reducer evaluates unlocks during COMMIT_DECISION, before
  // ADVANCE_CHECKPOINT, so committing at currentCheckpoint 3 is "completing
  // the third decision" and the module must be active when CP4 opens.
  const s3 = stateInRun('covid_black_swan', 3);
  const committed = reducer(s3, {
    type: 'COMMIT_DECISION',
    command: { action: 'HOLD', conviction: 70 },
  });
  assert.equal(committed.moduleJustUnlocked, 'BLOCK_FIELD');
  assert.ok(committed.profile.unlockedModules.includes('BLOCK_FIELD'));
  assert.ok(committed.run!.activeModules.includes('BLOCK_FIELD'), 'active in the very run that earned it');

  const advanced = reducer(committed, { type: 'ADVANCE_CHECKPOINT' });
  assert.equal(advanced.run!.currentCheckpoint, 4);
  assert.ok(advanced.run!.activeModules.includes('BLOCK_FIELD'), 'still active entering CP4');

  // And committing CP1/CP2 must not have unlocked it.
  const s1 = stateInRun('covid_black_swan', 1);
  const c1 = reducer(s1, {
    type: 'COMMIT_DECISION',
    command: { action: 'HOLD', conviction: 70 },
  });
  assert.ok(!c1.profile.unlockedModules.includes('BLOCK_FIELD'));
});
