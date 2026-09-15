import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { getSessionId, sessionIsEphemeral, resetEphemeralSession } from './identity';

// getSessionId is called by nearly everything the game does. Before this, a
// browser that refused storage made it throw, which took the page down before
// any of that ran: telemetry, attribution and persistence all failed at the
// first line. The rule is now simple — storage is best effort, the session is
// not optional.

function withStorage(storage: unknown) {
  (globalThis as { localStorage?: unknown }).localStorage = storage;
  resetEphemeralSession();
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

beforeEach(() => { resetEphemeralSession(); });

test('an ordinary browser stores the id and keeps answering with it', () => {
  const store = memoryStorage();
  withStorage(store);
  const first = getSessionId();
  assert.match(first, /^ses_[0-9a-f]{20}$/);
  assert.equal(getSessionId(), first);
  assert.equal(store.data.get('refi_session_id'), first);
  assert.equal(sessionIsEphemeral(), false);
});

test('a storage that throws on read does not end the session', () => {
  withStorage({
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { /* accepted */ },
    removeItem: () => {},
  });
  assert.match(getSessionId(), /^ses_[0-9a-f]{20}$/);
});

test('a storage that throws on write falls back to memory, stably', () => {
  withStorage({
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
    removeItem: () => {},
  });
  const first = getSessionId();
  assert.match(first, /^ses_[0-9a-f]{20}$/);
  assert.equal(getSessionId(), first, 'a new session was minted on every call');
  assert.equal(getSessionId(), first);
  assert.equal(sessionIsEphemeral(), true);
});

test('no storage object at all is survivable', () => {
  // Server-side rendering, a locked-down embed, or a browser that removed the
  // property entirely.
  withStorage(undefined);
  const first = getSessionId();
  assert.match(first, /^ses_[0-9a-f]{20}$/);
  assert.equal(getSessionId(), first);
});

test('a stored id wins over the in-memory fallback once storage returns', () => {
  withStorage({
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
    removeItem: () => {},
  });
  const ephemeral = getSessionId();

  const store = memoryStorage();
  store.data.set('refi_session_id', 'ses_' + 'a'.repeat(20));
  (globalThis as { localStorage?: unknown }).localStorage = store;

  assert.equal(getSessionId(), 'ses_' + 'a'.repeat(20),
    'the fallback outranked what the device actually remembers');
  assert.notEqual(getSessionId(), ephemeral);
});
