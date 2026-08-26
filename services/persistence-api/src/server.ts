import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Pool } from 'pg';
import {
  HttpError, validSessionId, validateEvent, validateGuidance,
  validateMachineVersion, validateProfile, validateRunRecord, validateTape,
  validateTip,
} from './contract.js';
import {
  getProfile, getTape, insertEvent, listMachineVersions, listRuns,
  putGuidance, putMachineVersion, putProfile, putRun, putTape, putTip,
} from './store.js';

// ─── persistence-api ──────────────────────────────────────────────────────────
//
// The remote half of the game's persistence port (src/lib/persistence in the
// game client). The client treats this service as a mirror: local storage is
// authoritative on the device, writes arrive here fire-and-forget, and reads
// only ever fill local gaps. Nothing here is in a player's critical path — an
// instance that is down costs the mirror, never the game.
//
// x-alpha-session is continuity, not authentication. It scopes anonymous
// progress and proves nothing about who is holding it; once accounts exist,
// operations that matter resolve a verified principal instead (see the
// founding schema's identity comments).

const PORT = Number(process.env['PORT'] ?? 8080);
// Default to the game origin, not "*": the API is public, so CORS is one of
// the few browser-side abuse dampeners it has.
const ALLOWED_ORIGIN = process.env['ALLOWED_ORIGIN'] ?? 'https://game.refi.trading';
// Run records with a full decision history are the largest payload; the
// ordered cap leaves a maximum 22-decision canonical run several multiples
// of headroom.
const MAX_BODY_BYTES = 256 * 1024;

// Per-IP rate limit: fixed window, in-memory (per instance — a first layer;
// a distributed limiter is the scale follow-on). More generous than the mint
// endpoint's: a playing session legitimately writes on every commit.
const RATE_LIMIT_MAX = Number(process.env['RATE_LIMIT_MAX'] ?? 240);
const RATE_LIMIT_WINDOW_MS = Number(process.env['RATE_LIMIT_WINDOW_MS'] ?? 60_000);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (rateBuckets.size > 10_000) {
      for (const [k, v] of rateBuckets) if (now >= v.resetAt) rateBuckets.delete(k);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}
function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return first?.trim() || req.socket.remoteAddress || 'unknown';
}

// Lazy singleton so cold start / health checks don't require the DB.
let pool: Pool | undefined;
function db(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 5,
      ssl:
        process.env['PGSSLMODE'] === 'disable'
          ? false
          : process.env['PGSSL_NO_VERIFY'] === 'true'
            ? { rejectUnauthorized: false }
            : { rejectUnauthorized: true },
    });
  }
  return pool;
}

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-alpha-session');
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(payload);
}

function noContent(res: ServerResponse): void {
  res.writeHead(204).end();
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'body must be JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Route one request. Exported so tests can drive the exact production paths
 * through an ordinary http server without mocking the routing.
 */
export async function route(
  req: IncomingMessage,
  res: ServerResponse,
  poolOverride?: Pool,
): Promise<void> {
  const p = poolOverride ?? db();
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'GET' && (path === '/' || path === '/healthz')) {
    json(res, 200, { ok: true });
    return;
  }

  // Telemetry carries its ids inside the envelope; every other route is
  // scoped by the continuity header.
  if (method === 'POST' && path === '/v1/events') {
    await insertEvent(p, validateEvent(await readJson(req)));
    noContent(res);
    return;
  }

  const sessionId = validSessionId(req.headers['x-alpha-session']);

  if (path === '/v1/progress') {
    if (method === 'GET') {
      const profile = await getProfile(p, sessionId);
      if (!profile) {
        json(res, 404, { error: 'not_found' });
        return;
      }
      json(res, 200, profile);
      return;
    }
    if (method === 'PUT') {
      await putProfile(p, sessionId, validateProfile(await readJson(req)));
      noContent(res);
      return;
    }
  }

  if (method === 'POST' && path === '/v1/tips') {
    await putTip(p, sessionId, validateTip(await readJson(req)));
    noContent(res);
    return;
  }

  if (method === 'PUT' && path === '/v1/guidance') {
    await putGuidance(p, sessionId, validateGuidance(await readJson(req)));
    noContent(res);
    return;
  }

  const tapeGet = path.match(/^\/v1\/daily-tape\/(\d{4}-\d{2}-\d{2})$/);
  if (method === 'GET' && tapeGet) {
    const tape = await getTape(p, sessionId, tapeGet[1] as string);
    if (!tape) {
      json(res, 404, { error: 'not_found' });
      return;
    }
    json(res, 200, tape);
    return;
  }

  if (method === 'POST' && path === '/v1/daily-tape') {
    await putTape(p, sessionId, validateTape(await readJson(req)));
    noContent(res);
    return;
  }

  if (method === 'GET' && path === '/v1/runs') {
    json(res, 200, await listRuns(p, sessionId));
    return;
  }

  const runPut = path.match(/^\/v1\/runs\/([^/]+)$/);
  if (method === 'PUT' && runPut) {
    const runId = decodeURIComponent(runPut[1] as string);
    await putRun(p, sessionId, validateRunRecord(await readJson(req), runId));
    noContent(res);
    return;
  }

  if (method === 'GET' && path === '/v1/machine-versions') {
    json(res, 200, await listMachineVersions(p, sessionId));
    return;
  }

  const machinePut = path.match(/^\/v1\/machine-versions\/([^/]+)\/(\d+)$/);
  if (method === 'PUT' && machinePut) {
    const machineName = decodeURIComponent(machinePut[1] as string);
    const version = Number(machinePut[2]);
    await putMachineVersion(
      p,
      sessionId,
      validateMachineVersion(await readJson(req), machineName, version),
    );
    noContent(res);
    return;
  }

  json(res, 404, { error: 'not_found' });
}

export function makeServer(poolOverride?: Pool): ReturnType<typeof createServer> {
  return createServer((req, res) => {
    void (async () => {
      setCors(res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
      }
      if (rateLimited(clientIp(req))) {
        json(res, 429, { error: 'rate_limited' });
        return;
      }
      try {
        await route(req, res, poolOverride);
      } catch (err) {
        if (err instanceof HttpError) {
          json(res, err.status, { error: err.message });
        } else {
          // Never leak internals; log server-side.
          console.error('persistence-api error:', err);
          json(res, 500, { error: 'internal_error' });
        }
      }
    })();
  });
}

// Started directly (node dist/server.js); imported by tests without listening.
if (process.argv[1]?.endsWith('server.js')) {
  makeServer().listen(PORT, () => {
    console.log(`persistence-api listening on :${String(PORT)}`);
  });
}
