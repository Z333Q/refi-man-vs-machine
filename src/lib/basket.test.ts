import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

const { lockBasket, latestBasket, listBaskets, clearBaskets, basketHash, BASKET_UNIVERSE, DEFAULT_BASKET } = await import('./basket');

test('the basket universe is U.S. equities only (spec 2.1)', () => {
  const banned = ['SPY', 'QQQ', 'IEF', 'GLD', 'XLV', 'XLP', 'TLT', 'BTC'];
  for (const b of banned) assert.ok(!BASKET_UNIVERSE.some(u => u.symbol === b), `${b} is not a playable holding`);
  for (const c of DEFAULT_BASKET) assert.ok(BASKET_UNIVERSE.some(u => u.symbol === c.symbol), `${c.symbol} must be in the universe`);
});

test('the hash is a function of holdings and weights, not order', () => {
  const a = [{ symbol: 'AAPL', weight: 8, sector: 'TECH' }, { symbol: 'JNJ', weight: 7, sector: 'HEALTH' }];
  const b = [a[1], a[0]];
  assert.equal(basketHash(a, 5), basketHash(b, 5));
  assert.notEqual(basketHash(a, 5), basketHash([{ ...a[0], weight: 9 }, a[1]], 5));
  assert.match(basketHash(a, 5), /^[0-9A-F]{4}:[0-9A-F]{4}:[0-9A-F]{4}$/);
});

test('locking stores a record, and re-locking the same basket is the same record', () => {
  clearBaskets();
  assert.equal(latestBasket(), null);
  const first = lockBasket(DEFAULT_BASKET, 5, '2026-09-06T10:00:00.000Z');
  const again = lockBasket([...DEFAULT_BASKET].reverse(), 5, '2026-09-06T11:00:00.000Z');
  assert.equal(again.basketId, first.basketId);
  assert.equal(listBaskets().length, 1);
  const changed = lockBasket(DEFAULT_BASKET.slice(1), 5, '2026-09-06T12:00:00.000Z');
  assert.notEqual(changed.basketId, first.basketId);
  assert.equal(latestBasket()?.basketId, changed.basketId);
});
