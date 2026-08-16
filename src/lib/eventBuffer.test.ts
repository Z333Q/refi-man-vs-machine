import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bufferEvent, drainBuffer, readBuffer, restoreBuffer, sinkConfigStatus,
  BUFFER_KEY, BUFFER_MAX, type BufferStorage, type EventEnvelope,
} from './eventBuffer';

function memory(seed: Record<string, string> = {}): BufferStorage & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: k => { delete data[k]; },
  };
}

const ev = (id: string, extra: Record<string, unknown> = {}): EventEnvelope =>
  ({ event_id: id, event_type: 'decision.committed', ...extra });

// ─── Ordering and capacity ────────────────────────────────────────────────────

test('events are retained in the order they were emitted', () => {
  // Envelopes carry causation_id chains, so a queue that reordered them would
  // corrupt the causal record it exists to protect.
  const s = memory();
  for (const id of ['a', 'b', 'c', 'd']) bufferEvent(s, ev(id));
  assert.deepEqual(readBuffer(s).map(e => e.event_id), ['a', 'b', 'c', 'd']);
});

test('overflow drops the oldest, never the newest', () => {
  // A full buffer means the sink has been down a long time. What the player is
  // doing now is the part worth keeping.
  const s = memory();
  for (let i = 0; i < BUFFER_MAX + 25; i++) bufferEvent(s, ev(`e${i}`));

  const held = readBuffer(s);
  assert.equal(held.length, BUFFER_MAX);
  assert.equal(held[0].event_id, 'e25', 'oldest 25 should have been dropped');
  assert.equal(held[held.length - 1].event_id, `e${BUFFER_MAX + 24}`);
});

test('overflow reports what it dropped rather than losing it silently', () => {
  const s = memory();
  for (let i = 0; i < BUFFER_MAX; i++) bufferEvent(s, ev(`e${i}`));
  const result = bufferEvent(s, ev('one-more'));
  assert.equal(result.dropped, 1);
  assert.equal(result.size, BUFFER_MAX);
});

test('the same event is never queued twice', () => {
  // A retry that fails after the write would otherwise duplicate on every
  // attempt, and the duplicates would outlive the outage.
  const s = memory();
  bufferEvent(s, ev('dup'));
  bufferEvent(s, ev('dup'));
  bufferEvent(s, ev('dup'));
  assert.equal(readBuffer(s).length, 1);
});

// ─── Drain and restore ────────────────────────────────────────────────────────

test('draining hands over everything and empties the queue', () => {
  const s = memory();
  for (const id of ['a', 'b']) bufferEvent(s, ev(id));
  const drained = drainBuffer(s);
  assert.deepEqual(drained.map(e => e.event_id), ['a', 'b']);
  assert.equal(readBuffer(s).length, 0);
});

test('a failed flush restores undelivered events ahead of newer ones', () => {
  // Causal order has to survive the failure, so what could not be sent goes
  // back at the front rather than the back.
  const s = memory();
  for (const id of ['a', 'b']) bufferEvent(s, ev(id));
  const inFlight = drainBuffer(s);

  // The game keeps playing while delivery is attempted.
  bufferEvent(s, ev('c'));

  restoreBuffer(s, inFlight);
  assert.deepEqual(readBuffer(s).map(e => e.event_id), ['a', 'b', 'c']);
});

test('restoring does not duplicate an event that was re-queued meanwhile', () => {
  const s = memory();
  bufferEvent(s, ev('a'));
  const inFlight = drainBuffer(s);
  bufferEvent(s, ev('a'));
  restoreBuffer(s, inFlight);
  assert.deepEqual(readBuffer(s).map(e => e.event_id), ['a']);
});

test('restoring nothing is a no-op', () => {
  const s = memory();
  bufferEvent(s, ev('a'));
  const r = restoreBuffer(s, []);
  assert.equal(r.size, 1);
  assert.deepEqual(readBuffer(s).map(e => e.event_id), ['a']);
});

// ─── Storage that misbehaves ──────────────────────────────────────────────────

test('corrupt storage yields an empty queue instead of throwing', () => {
  assert.deepEqual(readBuffer(memory({ [BUFFER_KEY]: 'not json' })), []);
  assert.deepEqual(readBuffer(memory({ [BUFFER_KEY]: '{"not":"an array"}' })), []);
  assert.deepEqual(readBuffer(memory({ [BUFFER_KEY]: '[1,2,3]' })), []);
});

test('entries without an id are discarded, since they cannot be de-duplicated', () => {
  const s = memory({ [BUFFER_KEY]: JSON.stringify([{ event_id: 'ok' }, { no_id: true }, null]) });
  assert.deepEqual(readBuffer(s).map(e => e.event_id), ['ok']);
});

test('storage that refuses writes reports it and never throws', () => {
  const s: BufferStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => {},
  };
  const r = bufferEvent(s, ev('a'));
  assert.equal(r.stored, false);
  // The player must never see this. The caller decides what to do with it.
});

// ─── Sink configuration ───────────────────────────────────────────────────────

const REAL_REF = 'abcdefghijklmnopqrst';                    // 20 lowercase letters
const REAL_KEY = 'aaa.' + btoa('{"role":"anon","ref":"x"}').replace(/=/g, '') + '.bbb';

test('the exact configuration that shipped is reported as a placeholder', () => {
  // This is the regression: "present and non-empty" passed, and the sink wrote
  // to nowhere for the life of the project.
  assert.equal(sinkConfigStatus('https://placeholder.supabase.co', REAL_KEY), 'PLACEHOLDER');
});

test('a real-looking project with a real JWT is accepted', () => {
  assert.equal(sinkConfigStatus(`https://${REAL_REF}.supabase.co`, REAL_KEY), 'OK');
});

test('a supabase host that is not a 20 character ref cannot be a real project', () => {
  for (const ref of ['short', 'my-project', 'test123', REAL_REF.slice(0, 19)]) {
    assert.equal(sinkConfigStatus(`https://${ref}.supabase.co`, REAL_KEY), 'PLACEHOLDER', ref);
  }
});

test('obvious stand-in words are caught on any host', () => {
  for (const host of ['example.com', 'your-project.db.io', 'changeme.internal', 'dummy.api.dev']) {
    assert.equal(sinkConfigStatus(`https://${host}`, REAL_KEY), 'PLACEHOLDER', host);
  }
});

test('missing configuration is distinguished from wrong configuration', () => {
  assert.equal(sinkConfigStatus(undefined, REAL_KEY), 'MISSING');
  assert.equal(sinkConfigStatus(`https://${REAL_REF}.supabase.co`, undefined), 'MISSING');
  assert.equal(sinkConfigStatus('', ''), 'MISSING');
});

test('a key that is not a decodable JWT is not accepted', () => {
  assert.equal(sinkConfigStatus(`https://${REAL_REF}.supabase.co`, 'not-a-jwt'), 'MALFORMED');
  assert.equal(sinkConfigStatus(`https://${REAL_REF}.supabase.co`, 'aaa.!!!notbase64!!!.bbb'), 'PLACEHOLDER');
});

test('a custom domain is not second-guessed', () => {
  // Self-hosted and proxied sinks are legitimate; only stand-in words are.
  assert.equal(sinkConfigStatus('https://events.refi.trading', REAL_KEY), 'OK');
});
