import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { captureAcquisition, firstTouch } from './acquisition';
import type { AcquisitionTouch } from './attribution';

// node has no localStorage and no window; the same in-memory twins the other
// browser-boundary tests use.
function installBrowser(url: string, referrer = '') {
  let store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store = new Map(); },
  };
  (globalThis as { window?: unknown }).window = { location: { href: url } };
  (globalThis as { document?: unknown }).document = { referrer };
}

function setUrl(url: string, referrer = '') {
  (globalThis as { window: { location: { href: string } } }).window.location.href = url;
  (globalThis as { document: { referrer: string } }).document.referrer = referrer;
}

/** A port that records what it was asked to save. */
function fakePort() {
  const saved: AcquisitionTouch[] = [];
  return {
    saved,
    saveAcquisitionTouch: async (_s: string, t: AcquisitionTouch) => { saved.push(t); return true; },
  };
}

installBrowser('https://alpha.refi.trading/alpha?utm_source=x&utm_campaign=launch');

beforeEach(() => {
  (globalThis.localStorage as { clear(): void }).clear();
});

test('the first touch is recorded once and never overwritten', async () => {
  const port = fakePort();
  setUrl('https://alpha.refi.trading/alpha?utm_source=first&utm_campaign=launch');
  const one = await captureAcquisition(port, '2026-09-14T10:00:00.000Z');
  assert.equal(one.first?.source, 'first');
  assert.equal(one.persisted, true);

  // A later arrival through a different campaign. The first touch is history
  // and history does not change.
  setUrl('https://alpha.refi.trading/alpha?utm_source=second&utm_campaign=creator');
  const two = await captureAcquisition(port, '2026-09-15T10:00:00.000Z');
  assert.equal(two.first, null, 'a second first touch was written');
  assert.equal(two.meaningful?.source, 'second');

  assert.equal(firstTouch()?.source, 'first', 'the stored first touch was rewritten');
  assert.equal(port.saved.filter(t => t.kind === 'first').length, 1);
});

test('a plain revisit produces no touch at all', async () => {
  const port = fakePort();
  setUrl('https://alpha.refi.trading/alpha?utm_source=x&utm_campaign=launch');
  await captureAcquisition(port, '2026-09-14T10:00:00.000Z');

  // Same player, later, arriving with nothing attached. Not an arrival from
  // anywhere new, so there is nothing to attribute.
  setUrl('https://alpha.refi.trading/alpha');
  const again = await captureAcquisition(port, '2026-09-16T10:00:00.000Z');
  assert.equal(again.first, null);
  assert.equal(again.meaningful, null, 'a revisit manufactured an acquisition touch');
  assert.equal(port.saved.length, 1);
});

test('reloading the campaign link that brought them does not count twice', async () => {
  const port = fakePort();
  const url = 'https://alpha.refi.trading/alpha?utm_source=x&utm_campaign=launch';
  setUrl(url);
  await captureAcquisition(port, '2026-09-14T10:00:00.000Z');
  setUrl(url);
  const reload = await captureAcquisition(port, '2026-09-14T10:05:00.000Z');
  assert.equal(reload.meaningful, null);
  assert.equal(port.saved.length, 1);
});

test('a failing store never throws into the page', async () => {
  const angry = {
    saveAcquisitionTouch: async () => { throw new Error('network down'); },
  };
  setUrl('https://alpha.refi.trading/alpha?utm_source=x');
  const captured = await captureAcquisition(angry, '2026-09-14T10:00:00.000Z');
  assert.equal(captured.first?.source, 'x', 'the touch was lost as well as undelivered');
  assert.equal(captured.persisted, false);
});

// Not covered here, deliberately: a browser that refuses every localStorage
// write. Attribution survives it (every read and write in acquisition.ts is
// guarded), but getSessionId in identity.ts writes unguarded and throws first,
// so a test of this module would be asserting somebody else's defect. It is
// pre-existing, it is reported with this PR, and fixing it belongs to the PR
// that owns identity rather than to telemetry.
