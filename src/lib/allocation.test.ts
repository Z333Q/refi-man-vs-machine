import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ROTATION_WEIGHT,
  reallocate,
  sectorCharacter,
  sectorExposureOf,
  turnoverOf,
} from './allocation';
import type { PortfolioPosition } from './gameTypes';

// The laws a stance has to obey once it moves real weight.
//
// The playtest found the engine moving a single scalar — cash — and leaving
// per-position weights untouched for an entire run. That made the risk panel's
// sector bars constant, and made ROTATE_DEFENSIVE identical to HOLD in every
// field but the turnover meter. These pin the replacement.

function book(): PortfolioPosition[] {
  return [
    { symbol: 'DAL', weight: 0.20, pnl: 0, riskContrib: 0.25, sector: 'AIRLINES' },
    { symbol: 'MAR', weight: 0.20, pnl: 0, riskContrib: 0.20, sector: 'HOTELS' },
    { symbol: 'JNJ', weight: 0.20, pnl: 0, riskContrib: 0.10, sector: 'HEALTHCARE' },
    { symbol: 'PG', weight: 0.20, pnl: 0, riskContrib: 0.10, sector: 'CONSUMER STAPLES' },
  ];
}

const totalWeight = (ps: readonly PortfolioPosition[]) =>
  Math.round(ps.reduce((a, p) => a + p.weight, 0) * 10000) / 10000;

const bySymbol = (ps: readonly PortfolioPosition[], s: string) =>
  ps.find(p => p.symbol === s)!.weight;

test('both spellings of a sector land in the same bucket', () => {
  assert.equal(sectorCharacter('HEALTH'), 'DEFENSIVE');
  assert.equal(sectorCharacter('HEALTHCARE'), 'DEFENSIVE');
  assert.equal(sectorCharacter('TECH'), 'CYCLICAL');
  assert.equal(sectorCharacter('TECHNOLOGY'), 'CYCLICAL');
  assert.equal(sectorCharacter('consumer staples'), 'DEFENSIVE', 'case does not decide a bucket');
});

test('a sector nobody classified trades in neither direction', () => {
  assert.equal(sectorCharacter('CRYPTO MINING'), 'NEUTRAL');
});

test('sector exposure is the sum of the positions that produce it', () => {
  const e = sectorExposureOf(book());
  assert.deepEqual(e, { AIRLINES: 0.2, HOTELS: 0.2, HEALTHCARE: 0.2, 'CONSUMER STAPLES': 0.2 });
});

test('a rotation costs two legs; a sale into cash costs one', () => {
  const before = book();

  const sale = reallocate(before, 0.25, 'RAISE_CASH');
  assert.ok(
    Math.abs(sale.turnover - 0.05) < 1e-9,
    `selling 5% into cash is one leg, got ${sale.turnover}`,
  );

  const rotation = reallocate(before, 0.20, 'ROTATE_DEFENSIVE');
  const movedOut = ROTATION_WEIGHT; // a fixed slice of the book, not of one side
  // Weights are carried to four places, so the two legs can each round by up
  // to half a basis point.
  assert.ok(
    Math.abs(rotation.turnover - movedOut * 2) < 1e-3,
    `a rotation is a sell and a buy, got ${rotation.turnover} for ${movedOut} moved`,
  );
  assert.ok(
    rotation.turnover > sale.turnover * 2 * 0.9,
    'and it costs materially more than the one-legged sale',
  );
});

test('HOLD trades nothing', () => {
  const before = book();
  const after = reallocate(before, 0.20, 'HOLD');
  assert.equal(after.turnover, 0);
  assert.deepEqual(after.positions.map(p => p.weight), before.map(p => p.weight));
});

test('ROTATE_DEFENSIVE is no longer indistinguishable from HOLD', () => {
  const before = book();
  const after = reallocate(before, 0.20, 'ROTATE_DEFENSIVE').positions;

  assert.ok(bySymbol(after, 'DAL') < bySymbol(before, 'DAL'), 'airlines came down');
  assert.ok(bySymbol(after, 'JNJ') > bySymbol(before, 'JNJ'), 'healthcare went up');
  assert.equal(totalWeight(after), totalWeight(before), 'and cash did not move');

  const exposure = sectorExposureOf(after);
  assert.ok(exposure.HEALTHCARE > 0.20, 'the risk panel has something to show');
});

test('ROTATE_RISK runs the other way', () => {
  const before = book();
  const after = reallocate(before, 0.20, 'ROTATE_RISK').positions;
  assert.ok(bySymbol(after, 'DAL') > bySymbol(before, 'DAL'));
  assert.ok(bySymbol(after, 'JNJ') < bySymbol(before, 'JNJ'));
});

test('raising cash shrinks every position, and the book still adds up', () => {
  const before = book();
  const after = reallocate(before, 0.35, 'RAISE_CASH');
  for (const p of after.positions) {
    assert.ok(p.weight < bySymbol(before, p.symbol), `${p.symbol} was trimmed`);
  }
  assert.equal(totalWeight(after.positions) + after.cashWeight, 1, 'equity plus cash is the book');
});

test('deploying cash favours the cyclical side but still adds up', () => {
  const before = book();
  const after = reallocate(before, 0.15, 'ADD_RISK');
  assert.equal(totalWeight(after.positions) + after.cashWeight, 1);
  const e = sectorExposureOf(after.positions);
  assert.ok(e.AIRLINES + e.HOTELS > 0.40, 'the added risk went where the stance said');
});

test('a rotation with nothing to rotate into leaves the book alone', () => {
  // All-cyclical book asked to rotate into risk: the target is everything and
  // the source is nothing. Inventing a defensive position to sell would be a
  // fiction, so nothing trades.
  const allCyclical: PortfolioPosition[] = [
    { symbol: 'DAL', weight: 0.4, pnl: 0, riskContrib: 0.5, sector: 'AIRLINES' },
    { symbol: 'MAR', weight: 0.4, pnl: 0, riskContrib: 0.5, sector: 'HOTELS' },
  ];
  const after = reallocate(allCyclical, 0.2, 'ROTATE_RISK');
  assert.equal(after.turnover, 0);
  assert.deepEqual(after.positions.map(p => p.weight), [0.4, 0.4]);
});

test('an empty book is a no-op, not a divide by zero', () => {
  const after = reallocate([], 1, 'ADD_RISK');
  assert.equal(after.turnover, 0);
  assert.deepEqual(after.positions, []);
});

test('turnover counts a position sold out of the book entirely', () => {
  const before = book();
  const after = before.filter(p => p.symbol !== 'DAL');
  assert.ok(Math.abs(turnoverOf(before, after) - 0.20) < 1e-9);
});

test('equity and cash always sum to one, across every stance', () => {
  for (const action of ['HOLD', 'REDUCE', 'RAISE_CASH', 'ADD_RISK', 'ROTATE_DEFENSIVE', 'ROTATE_RISK', 'STAGED_BUY', 'STAGED_SELL'] as const) {
    for (const [cash, next] of [[0.20, 0.25], [0.05, 0.05], [0.55, 0.60], [0.30, 0.25]]) {
      const r = reallocate(book(), next, action);
      assert.equal(
        totalWeight(r.positions) + r.cashWeight,
        1,
        `${action} at cash ${cash}→${next} left the book off by ${1 - (totalWeight(r.positions) + r.cashWeight)}`,
      );
    }
  }
});
