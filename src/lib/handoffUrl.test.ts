import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketingHandoffUrl } from './handoffUrl';

// Link-mode exits are a marketing link, and the one thing a marketing link
// must never become is a side channel for identity. §4.4 put the player id in
// an opaque server-minted token precisely so it would never ride in a URL, and
// a fallback that quietly undid that would be worse than the dead button it
// replaced.

const SITE = 'https://refi.trading';

test('carries marketing attribution and the destination, and nothing else', () => {
  const url = new URL(marketingHandoffUrl('ELIGIBILITY', {
    source: 'twitter', medium: 'social', campaign: 'launch',
  }, SITE));

  assert.equal(url.origin, SITE);
  assert.equal(url.searchParams.get('utm_source'), 'twitter');
  assert.equal(url.searchParams.get('utm_medium'), 'social');
  assert.equal(url.searchParams.get('utm_campaign'), 'launch');
  assert.equal(url.searchParams.get('intent'), 'eligibility');
  assert.deepEqual(
    [...url.searchParams.keys()].sort(),
    ['intent', 'utm_campaign', 'utm_medium', 'utm_source'],
  );
});

test('falls back to game attribution when the funnel captured none', () => {
  const url = new URL(marketingHandoffUrl('PAPER', {}, SITE));
  assert.equal(url.searchParams.get('utm_source'), 'alpha_game');
  assert.equal(url.searchParams.get('utm_medium'), 'game');
  assert.equal(url.searchParams.get('utm_campaign'), null);
  assert.equal(url.searchParams.get('intent'), 'paper');
});

test('no identifier reaches the query string, whatever attribution holds', () => {
  // Attribution is player-influenced (it comes from the landing URL), so the
  // builder must not become a passthrough for anything it does not name.
  const url = marketingHandoffUrl('MANAGED_INFO', {
    source: 'ref', campaign: 'q3',
    // Fields the builder deliberately ignores.
    ref: 'alp_01JABCDEF', landing: '/alpha/run/run_01J', capturedAt: '2026-01-01T00:00:00Z',
    content: 'variant-b', term: 'kw',
  }, SITE);

  for (const leak of ['alp_01JABCDEF', 'run_01J', 'variant-b', 'kw', '2026-01-01']) {
    assert.equal(url.includes(leak), false, `${leak} leaked into ${url}`);
  }
});

test('every destination maps to its own intent, lowercased', () => {
  for (const dest of ['ELIGIBILITY', 'PAPER', 'SIGNAL_INFO', 'MANAGED_INFO'] as const) {
    const url = new URL(marketingHandoffUrl(dest, {}, SITE));
    assert.equal(url.searchParams.get('intent'), dest.toLowerCase());
  }
});

test('a site url carrying its own path or query is preserved', () => {
  const url = new URL(marketingHandoffUrl('ELIGIBILITY', {}, 'https://refi.trading/start?x=1'));
  assert.equal(url.pathname, '/start');
  assert.equal(url.searchParams.get('x'), '1');
  assert.equal(url.searchParams.get('intent'), 'eligibility');
});
