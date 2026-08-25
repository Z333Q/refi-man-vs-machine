import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { makeRefiRemote } from './refiApi';

// ─── RemoteResult mapping ─────────────────────────────────────────────────────
// The previous client collapsed every failure to null, which is how a server
// outage came to read as an empty account. These tests pin the five distinct
// answers a remote read can give, because the composed store's whole conflict
// policy stands on being able to tell them apart.

type FetchArgs = { url: string; init?: RequestInit };
const calls: FetchArgs[] = [];
const realFetch = globalThis.fetch;

function respondWith(response: () => Response | Promise<Response>) {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return response();
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
  calls.length = 0;
});

test('a 2xx body is VALUE', async () => {
  respondWith(() => new Response(JSON.stringify([{ runId: 'run_x' }]), { status: 200 }));
  const answer = await makeRefiRemote('https://api.test').loadRunRecords('ses_a');
  assert.equal(answer.kind, 'VALUE');
  if (answer.kind === 'VALUE') assert.equal(answer.value[0].runId, 'run_x');
});

test('a 404 is NOT_FOUND: the server answered, and holds nothing', async () => {
  respondWith(() => new Response('', { status: 404 }));
  const answer = await makeRefiRemote('https://api.test').loadRunRecords('ses_a');
  assert.equal(answer.kind, 'NOT_FOUND');
});

test('a 5xx is HTTP_ERROR with the status, never an absence', async () => {
  respondWith(() => new Response('', { status: 503 }));
  const answer = await makeRefiRemote('https://api.test').loadProfile('ses_a');
  assert.deepEqual(answer, { kind: 'HTTP_ERROR', status: 503 });
});

test('a failed fetch is NETWORK_ERROR, never an absence', async () => {
  respondWith(() => { throw new TypeError('fetch failed'); });
  const answer = await makeRefiRemote('https://api.test').loadMachineVersions('ses_a');
  assert.equal(answer.kind, 'NETWORK_ERROR');
});

test('a 2xx with an unparseable body is INVALID', async () => {
  respondWith(() => new Response('{not json', { status: 200 }));
  const answer = await makeRefiRemote('https://api.test').loadRunRecords('ses_a');
  assert.equal(answer.kind, 'INVALID');
});

test('a 204 write acknowledgement is VALUE', async () => {
  respondWith(() => new Response(null, { status: 204 }));
  const record = { runId: 'run_x' } as never;
  const answer = await makeRefiRemote('https://api.test').saveRunRecord('ses_a', record);
  assert.deepEqual(answer, { kind: 'VALUE', value: null });
});

// ─── Transport shape ──────────────────────────────────────────────────────────

test('the session travels in the x-alpha-session header, never in the URL', async () => {
  respondWith(() => new Response('null', { status: 200 }));
  const remote = makeRefiRemote('https://api.test');
  await remote.loadRunRecords('ses_secret');
  await remote.saveRunRecord('ses_secret', { runId: 'run_1' } as never);
  await remote.saveMachineVersion('ses_secret', { machineName: 'M', version: 2 } as never);

  for (const { url, init } of calls) {
    assert.ok(!url.includes('ses_secret'), 'a session id in a URL ends up in logs and referrers');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers['x-alpha-session'], 'ses_secret');
  }
});

test('runs and machine versions address their own resource routes', async () => {
  respondWith(() => new Response('null', { status: 200 }));
  const remote = makeRefiRemote('https://api.test/');
  await remote.loadRunRecords('ses_a');
  await remote.saveRunRecord('ses_a', { runId: 'run_abc' } as never);
  await remote.loadMachineVersions('ses_a');
  await remote.saveMachineVersion('ses_a', { machineName: 'MY MACHINE', version: 3 } as never);

  assert.equal(calls[0].url, 'https://api.test/v1/runs');
  assert.equal(calls[1].url, 'https://api.test/v1/runs/run_abc');
  assert.equal(calls[1].init?.method, 'PUT');
  assert.equal(calls[2].url, 'https://api.test/v1/machine-versions');
  assert.equal(calls[3].url, 'https://api.test/v1/machine-versions/MY%20MACHINE/3');
  assert.equal(calls[3].init?.method, 'PUT');
});
