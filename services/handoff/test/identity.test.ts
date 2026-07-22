import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT, jwtVerify } from 'jose';
import { verifyFirebaseIdToken } from '../src/firebase-auth.ts';
import { mintHandoff, HttpError } from '../src/handler.ts';
import type { Queryable } from '../src/progress.ts';

const PROJECT = 'refi-alpha-demo';

async function rsaKeys() {
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    extractable: true,
  });
  return { publicKey, privateKey };
}

async function firebaseToken(
  privateKey: CryptoKey,
  over: { iss?: string; aud?: string; sub?: string } = {},
) {
  return new SignJWT({ email: 'p@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(over.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(over.aud ?? PROJECT)
    .setSubject(over.sub ?? 'firebase-uid-123')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

test('verifyFirebaseIdToken: valid token → uid + email', async () => {
  const { publicKey, privateKey } = await rsaKeys();
  const token = await firebaseToken(privateKey);
  const id = await verifyFirebaseIdToken(token, { projectId: PROJECT, key: publicKey });
  assert.equal(id.uid, 'firebase-uid-123');
  assert.equal(id.email, 'p@example.com');
});

test('verifyFirebaseIdToken: wrong project (iss/aud) is rejected', async () => {
  const { publicKey, privateKey } = await rsaKeys();
  const token = await firebaseToken(privateKey, { aud: 'someone-else', iss: 'https://securetoken.google.com/someone-else' });
  await assert.rejects(verifyFirebaseIdToken(token, { projectId: PROJECT, key: publicKey }));
});

test('verifyFirebaseIdToken: wrong signing key is rejected', async () => {
  const a = await rsaKeys();
  const b = await rsaKeys();
  const token = await firebaseToken(a.privateKey);
  await assert.rejects(verifyFirebaseIdToken(token, { projectId: PROJECT, key: b.publicKey }));
});

function fakeDb(): Queryable {
  return {
    async query(text: string) {
      if (text.includes('from arena_runs')) return { rows: [{ arena_id: 'covid_black_swan' }] } as never;
      if (text.includes('from player_profiles')) return { rows: [{ machine_beats: 1, machine_attempts: 2, machine_version_count: 1 }] } as never;
      if (text.includes('from module_unlocks')) return { rows: [{ n: 0 }] } as never;
      return { rows: [] };
    },
  };
}

test('mintHandoff: verified bearer → token sub is the Firebase uid (not the session id)', async () => {
  const es = await generateKeyPair('ES256', { extractable: true });
  const privateJwk = await exportJWK(es.privateKey);
  const result = await mintHandoff(
    {
      db: fakeDb(),
      privateJwk,
      shellBaseUrl: 'https://shell.example',
      verifyIdentity: async (t) => {
        if (t !== 'good-token') throw new Error('bad');
        return { uid: 'firebase-uid-999' };
      },
    },
    { sessionId: 'ses_local', authorization: 'Bearer good-token' },
  );
  const { payload } = await jwtVerify(result.token, es.publicKey, { algorithms: ['ES256'] });
  assert.equal(payload.sub, 'firebase-uid-999', 'sub must be the verified uid');
  assert.notEqual(payload.sub, 'ses_local', 'sub must NOT be the raw session id');
});

test('mintHandoff: requireVerifiedIdentity rejects requests with no bearer (401)', async () => {
  const es = await generateKeyPair('ES256', { extractable: true });
  const privateJwk = await exportJWK(es.privateKey);
  await assert.rejects(
    mintHandoff(
      { db: fakeDb(), privateJwk, shellBaseUrl: 'https://shell.example', requireVerifiedIdentity: true },
      { sessionId: 'ses_local' },
    ),
    (e: unknown) => e instanceof HttpError && e.status === 401,
  );
});

test('mintHandoff: an invalid bearer is rejected (401)', async () => {
  const es = await generateKeyPair('ES256', { extractable: true });
  const privateJwk = await exportJWK(es.privateKey);
  await assert.rejects(
    mintHandoff(
      {
        db: fakeDb(),
        privateJwk,
        shellBaseUrl: 'https://shell.example',
        verifyIdentity: async () => {
          throw new Error('bad token');
        },
      },
      { sessionId: 'ses_local', authorization: 'Bearer nope' },
    ),
    (e: unknown) => e instanceof HttpError && e.status === 401,
  );
});
