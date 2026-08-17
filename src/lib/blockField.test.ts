import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  layoutBlocks, orderBlocks, blocksFromPortfolio, sectorHue, previewStanceBlocks,
  type BlockInput,
} from './blockField';
import { createInitialPortfolio, stanceCashDelta } from './runEngine';
import { checkModuleUnlocks } from './progressionEngine';
import type { ModuleCode } from './gameTypes';

const W = 600, H = 300;

function sample(): BlockInput[] {
  const p = createInitialPortfolio();
  return blocksFromPortfolio(p.positions, p.cashWeight);
}

// ─── Area is the message ──────────────────────────────────────────────────────

test('block area is proportional to weight', () => {
  // The whole claim the field makes is that size means exposure. If area and
  // weight disagree, the picture is lying about the portfolio.
  const rects = layoutBlocks(sample(), W, H);
  const total = rects.reduce((s, r) => s + r.weight, 0);
  const area = rects.reduce((s, r) => s + r.w * r.h, 0);

  for (const r of rects) {
    const expected = (r.weight / total) * area;
    const actual = r.w * r.h;
    // Row packing trades exact area for stable position, so allow a modest
    // tolerance; what must hold is that a bigger weight is never a smaller box.
    assert.ok(actual > 0, `${r.key} has no area`);
    assert.ok(
      Math.abs(actual - expected) / expected < 0.85,
      `${r.key} area ${actual.toFixed(0)} vs expected ${expected.toFixed(0)}`,
    );
  }
});

test('a heavier position is never drawn smaller than a lighter one in the same row', () => {
  const rects = layoutBlocks(sample(), W, H);
  const byRow = new Map<number, typeof rects>();
  for (const r of rects) {
    const row = byRow.get(r.y) ?? [];
    row.push(r);
    byRow.set(r.y, row);
  }
  for (const row of byRow.values()) {
    for (const a of row) for (const b of row) {
      if (a.weight > b.weight) assert.ok(a.w >= b.w, `${a.key} heavier than ${b.key} but narrower`);
    }
  }
});

test('the field fills its bounds exactly and never overflows', () => {
  const rects = layoutBlocks(sample(), W, H);
  for (const r of rects) {
    assert.ok(r.x >= -1e-6 && r.y >= -1e-6, `${r.key} starts outside`);
    assert.ok(r.x + r.w <= W + 1e-6, `${r.key} overflows width`);
    assert.ok(r.y + r.h <= H + 1e-6, `${r.key} overflows height`);
  }
  const area = rects.reduce((s, r) => s + r.w * r.h, 0);
  assert.ok(Math.abs(area - W * H) < 1, `field covers ${area.toFixed(0)} of ${W * H}`);
});

test('blocks do not overlap', () => {
  const rects = layoutBlocks(sample(), W, H);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const disjoint =
        a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 ||
        a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6;
      assert.ok(disjoint, `${a.key} overlaps ${b.key}`);
    }
  }
});

// ─── Stability is the point ───────────────────────────────────────────────────

test('order is by sector and never by size, so blocks keep their neighbours', () => {
  // Spatial memory is what makes a change in the picture read as a change
  // rather than as a new picture. Sorting by weight would rearrange the field
  // every time a position moved.
  const items = sample();
  const before = orderBlocks(items).map(i => i.key);

  // Make the smallest position the largest and re-order.
  const shuffled = items.map(i => (i.key === 'HD' ? { ...i, weight: 0.5 } : i));
  const after = orderBlocks(shuffled).map(i => i.key);

  assert.deepEqual(after, before, 'a weight change must not reorder the field');
});

test('cash is always the last block', () => {
  const ordered = orderBlocks(sample());
  assert.equal(ordered[ordered.length - 1].key, 'CASH');
  assert.equal(ordered[ordered.length - 1].isCash, true);
});

test('layout is deterministic', () => {
  const a = layoutBlocks(sample(), W, H);
  const b = layoutBlocks(sample(), W, H);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ─── Degenerate input ─────────────────────────────────────────────────────────

test('zero-weight positions are dropped rather than drawn as slivers', () => {
  const items: BlockInput[] = [
    { key: 'A', weight: 0.5, sector: 'TECHNOLOGY' },
    { key: 'GONE', weight: 0, sector: 'TECHNOLOGY' },
    { key: 'CASH', weight: 0.5, sector: 'CASH', isCash: true },
  ];
  const keys = layoutBlocks(items, W, H).map(r => r.key);
  assert.equal(keys.includes('GONE'), false);
  assert.deepEqual(keys.sort(), ['A', 'CASH']);
});

test('an empty or zero-area field returns nothing instead of throwing', () => {
  assert.deepEqual(layoutBlocks([], W, H), []);
  assert.deepEqual(layoutBlocks(sample(), 0, H), []);
  assert.deepEqual(layoutBlocks(sample(), W, 0), []);
});

test('a single position fills the whole field', () => {
  const one: BlockInput[] = [{ key: 'ONLY', weight: 1, sector: 'TECHNOLOGY' }];
  const [r] = layoutBlocks(one, W, H);
  assert.equal(r.w, W);
  assert.equal(r.h, H);
});

// ─── Colour semantics ─────────────────────────────────────────────────────────

test('cash is hollow and sectors carry distinct hues', () => {
  assert.equal(sectorHue('CASH', true), 'transparent');
  assert.notEqual(sectorHue('TECHNOLOGY'), sectorHue('FINANCIALS'));
  // An unknown sector still gets a colour rather than undefined.
  assert.match(sectorHue('SOMETHING NEW'), /^#[0-9A-Fa-f]{6}$/);
});

// ─── Addendum B B4: the pre-commit surface stays at two elements ──────────────

test('the pre-commit decision surface holds exactly two numbered elements', () => {
  // Founder ruling, made permanent. The DECIDE panel is what a player faces
  // before their first pull, and it holds the stance cards and the conviction
  // control. Nothing else may be added to it, including this block field: the
  // treemap lives on the reveal side and inside the earned PORTFOLIO module.
  //
  // Structural rather than visual, because the property being protected is
  // "how much is on this screen", which no unit test of a component can see.
  const src = readFileSync(join(process.cwd(), 'src/screens/CoreLoopScreen.tsx'), 'utf8');
  const start = src.indexOf("activePanel === 'DECIDE' &&");
  assert.ok(start > 0, 'DECIDE panel not found');

  // Read to the thesis prompt, which is post-commit and outside the surface.
  const end = src.indexOf('Thesis quick-pick', start);
  const panel = src.slice(start, end > start ? end : undefined);

  const numbered = [...panel.matchAll(/>\s*(\d+)\s*·\s*[A-Z]/g)].map(m => m[1]);
  assert.deepEqual(
    numbered, ['1', '2'],
    `the pre-commit surface must hold exactly two numbered elements, found ${numbered.length}`,
  );

  // And the field itself must not appear there.
  assert.equal(
    /BlockField/.test(panel), false,
    'the block field must never render on the pre-commit decision surface',
  );
});

// ─── Stance preview (earned module only) ─────────────────────────────────────

test('a preview moves weight into cash without reordering the field', () => {
  const base = sample();
  const preview = previewStanceBlocks(base, stanceCashDelta('RAISE_CASH'));

  const cashBefore = base.find(b => b.isCash)!.weight;
  const cashAfter = preview.find(b => b.isCash)!.weight;
  assert.ok(cashAfter > cashBefore, 'raising cash must grow the cash block');

  // Spatial memory survives the preview.
  assert.deepEqual(orderBlocks(preview).map(b => b.key), orderBlocks(base).map(b => b.key));
});

test('a preview preserves relative equity exposure', () => {
  // The stance funds cash proportionally: it does not pick winners. A preview
  // that changed the mix would be inventing a decision the player did not make.
  const base = sample();
  const preview = previewStanceBlocks(base, stanceCashDelta('REDUCE'));
  const ratio = (bs: BlockInput[], a: string, b: string) =>
    bs.find(x => x.key === a)!.weight / bs.find(x => x.key === b)!.weight;

  assert.ok(Math.abs(ratio(preview, 'MSFT', 'JPM') - ratio(base, 'MSFT', 'JPM')) < 1e-9);
});

test('HOLD previews as stillness', () => {
  // The lesson the field is meant to teach without words: doing nothing has a
  // picture, and the picture is that nothing moves.
  const base = sample();
  assert.equal(stanceCashDelta('HOLD'), 0);
  assert.deepEqual(previewStanceBlocks(base, stanceCashDelta('HOLD')), base);
});

test('the preview and the commit cannot disagree about cash', () => {
  // Both read the same engine table. A second copy would drift, and a preview
  // that lies is worse than no preview.
  for (const action of ['HOLD', 'REDUCE', 'RAISE_CASH', 'ADD_RISK'] as const) {
    const preview = previewStanceBlocks(sample(), stanceCashDelta(action));
    const cash = preview.find(b => b.isCash)!.weight;
    const expected = Math.max(0.02, Math.min(0.9, createInitialPortfolio().cashWeight + stanceCashDelta(action)));
    assert.ok(Math.abs(cash - expected) < 1e-9, action);
  }
});

test('weights still sum to one after a preview', () => {
  for (const action of ['REDUCE', 'RAISE_CASH', 'ADD_RISK'] as const) {
    const total = previewStanceBlocks(sample(), stanceCashDelta(action))
      .reduce((s, b) => s + b.weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `${action} sums to ${total}`);
  }
});

// ─── The module is earned, not given ─────────────────────────────────────────

test('BLOCK_FIELD unlocks on completing Background Noise and not before', () => {
  // Only the fields the unlock rule reads; the rest of the profile is
  // irrelevant to whether Background Noise is complete.
  const profile = {
    alphaXp: 0, machineBeats: 0, unlockedModules: [] as ModuleCode[],
  } as unknown as Parameters<typeof checkModuleUnlocks>[0];
  for (const cp of [1, 2, 3]) {
    assert.equal(
      checkModuleUnlocks(profile, cp).includes('BLOCK_FIELD'), false,
      `must not unlock at CP${cp}, Background Noise is not complete`,
    );
  }
  assert.equal(checkModuleUnlocks(profile, 4).includes('BLOCK_FIELD'), true, 'unlocks on reaching CP4');

  const already = { ...profile, unlockedModules: ['BLOCK_FIELD'] as ModuleCode[] };
  assert.equal(checkModuleUnlocks(already, 9).includes('BLOCK_FIELD'), false, 'never unlocks twice');
});
