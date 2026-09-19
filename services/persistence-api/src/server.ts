import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Pool } from 'pg';
import {
  HttpError, validSessionId, validateEvent, validateTouch, validateGuidance,
  validateMachineVersion, validateProfile, validateRunRecord, validateTape,
  validateTip,
} from './contract.js';
import {
  getProfile, getTape, insertEvent, insertTouch, listMachineVersions, listRuns,
  putGuidance, putMachineVersion, putProfile, putRun, putTape, putTip,
  type Caller,
} from './store.js';
import {
  claimIdentity, identityOf, linkSession, patchOwnProfile, publicProfile,
  userForPrincipal,
} from './identityStore.js';
import { canonicalHandle } from './handlePolicy.js';
import {
  verifierFromEnv, type PrincipalVerifier, type VerifiedPrincipal,
} from './principal.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  // authorization carries the verified credential; x-alpha-session still says
  // which browser session the request is about. Two different questions.
  res.setHeader('Access-Control-Allow-Headers',
    'content-type, x-alpha-session, authorization');
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

// The verifier is resolved once per process, not per request: building it
// reads configuration, and a per-request build would turn a missing
// environment variable into an intermittent failure instead of a loud one.
let verifier: PrincipalVerifier | undefined;
function defaultVerifier(): PrincipalVerifier {
  verifier ??= verifierFromEnv();
  return verifier;
}

/** A route that changes an account needs to know whose account it is. */
function requirePrincipal(principal: VerifiedPrincipal | null): VerifiedPrincipal {
  if (!principal) throw new HttpError(401, 'authentication_required');
  return principal;
}

/** Optional free text, bounded. Absent stays absent; null is handled separately. */
function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be a string`);
  const text = value.trim();
  if (text.length > 280) throw new HttpError(400, `${field} is too long`);
  return text === '' ? undefined : text;
}

/** An explicit null means "clear this field", which is different from absent. */
function nullIfNull(value: unknown): null | undefined {
  return value === null ? null : undefined;
}

function validVisibility(value: unknown): 'public' | 'private' | undefined {
  if (value === undefined) return undefined;
  if (value !== 'public' && value !== 'private') {
    throw new HttpError(400, 'visibility must be public or private');
  }
  return value;
}

/**
 * Route one request. Exported so tests can drive the exact production paths
 * through an ordinary http server without mocking the routing.
 */
export async function route(
  req: IncomingMessage,
  res: ServerResponse,
  poolOverride?: Pool,
  verifierOverride?: PrincipalVerifier,
): Promise<void> {
  const p = poolOverride ?? db();
  const verifier = verifierOverride ?? defaultVerifier();
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

  // Who is asking. Null for the anonymous majority; a 401 if a credential was
  // offered and did not hold up. Never taken from the body: a request that
  // names its own provider and subject is a request, not a principal.
  const principal = await verifier.verify(req.headers.authorization);

  // ─── Claimed identity (merge point 1) ───────────────────────────────────────

  if (path === '/v1/identity/me' && method === 'GET') {
    const me = await identityOf(p, requirePrincipal(principal));
    if (!me) {
      json(res, 404, { error: 'not_claimed' });
      return;
    }
    json(res, 200, me);
    return;
  }

  if (path === '/v1/identity/claim' && method === 'POST') {
    const who = requirePrincipal(principal);
    const claimSession = validSessionId(req.headers['x-alpha-session']);
    const body = await readJson(req);
    if (typeof body !== 'object' || body === null) throw new HttpError(400, 'body must be an object');
    const fields = body as Record<string, unknown>;

    // Only the player's own choices are accepted. Ownership fields in a body
    // are ignored rather than validated: there is no version of "the client
    // told us which user this is" that is safe to read.
    const result = await claimIdentity(p, who, claimSession, {
      handle: canonicalHandle(fields['handle']),
      displayName: optionalText(fields['displayName'], 'displayName'),
    });
    json(res, result.outcome === 'CLAIMED' ? 201 : 200, result);
    return;
  }

  if (path === '/v1/identity/link-session' && method === 'POST') {
    const who = requirePrincipal(principal);
    const linkTarget = validSessionId(req.headers['x-alpha-session']);
    json(res, 200, await linkSession(p, who, linkTarget));
    return;
  }

  // ─── Profiles ───────────────────────────────────────────────────────────────

  if (path === '/v1/profiles/me' && method === 'PATCH') {
    const who = requirePrincipal(principal);
    const userId = await userForPrincipal(p, who);
    if (!userId) throw new HttpError(404, 'no_profile');
    const body = await readJson(req);
    if (typeof body !== 'object' || body === null) throw new HttpError(400, 'body must be an object');
    const fields = body as Record<string, unknown>;

    json(res, 200, await patchOwnProfile(p, userId, {
      handle: fields['handle'] === undefined ? undefined : canonicalHandle(fields['handle']),
      displayName: optionalText(fields['displayName'], 'displayName') ?? nullIfNull(fields['displayName']),
      avatarUrl: optionalText(fields['avatarUrl'], 'avatarUrl') ?? nullIfNull(fields['avatarUrl']),
      bio: optionalText(fields['bio'], 'bio') ?? nullIfNull(fields['bio']),
      visibility: validVisibility(fields['visibility']),
    }));
    return;
  }

  const profileMatch = /^\/v1\/profiles\/([^/]+)$/.exec(path);
  if (profileMatch && method === 'GET') {
    // Public and unauthenticated on purpose: a profile page is a public page.
    // It exposes only what a profile is, and never an email, a provider
    // subject, a session id or anything from the formal product.
    const found = await publicProfile(p, decodeURIComponent(profileMatch[1] as string).toLowerCase());
    if (found.kind === 'PROFILE') { json(res, 200, found.profile); return; }
    if (found.kind === 'MOVED') { json(res, 200, found); return; }
    // A retired name is gone, not free. Saying so is what stops it looking
    // available to whoever asks next.
    if (found.kind === 'RETIRED') { json(res, 410, { error: 'handle_retired' }); return; }
    json(res, 404, { error: 'not_found' });
    return;
  }

  // ─── Session-scoped persistence ─────────────────────────────────────────────

  const sessionId = validSessionId(req.headers['x-alpha-session']);
  // An anonymous session authorizes itself; a linked one needs its owner. The
  // store decides, once, for every route below.
  const caller: Caller = {
    sessionId,
    userId: principal ? await userForPrincipal(p, principal) : null,
    authenticated: principal !== null,
  };

  // How this session arrived (§7.4). Session-scoped like every other write
  // below, and carrying no user id: a touch reaches a claimed player through
  // game_sessions.user_id and is never copied onto the user.
  if (method === 'POST' && path === '/v1/growth/touches') {
    await insertTouch(p, caller, validateTouch(await readJson(req)));
    noContent(res);
    return;
  }

  if (path === '/v1/progress') {
    if (method === 'GET') {
      const profile = await getProfile(p, caller);
      if (!profile) {
        json(res, 404, { error: 'not_found' });
        return;
      }
      json(res, 200, profile);
      return;
    }
    if (method === 'PUT') {
      await putProfile(p, caller, validateProfile(await readJson(req)));
      noContent(res);
      return;
    }
  }

  if (method === 'POST' && path === '/v1/tips') {
    await putTip(p, caller, validateTip(await readJson(req)));
    noContent(res);
    return;
  }

  if (method === 'PUT' && path === '/v1/guidance') {
    await putGuidance(p, caller, validateGuidance(await readJson(req)));
    noContent(res);
    return;
  }

  const tapeGet = path.match(/^\/v1\/daily-tape\/(\d{4}-\d{2}-\d{2})$/);
  if (method === 'GET' && tapeGet) {
    const tape = await getTape(p, caller, tapeGet[1] as string);
    if (!tape) {
      json(res, 404, { error: 'not_found' });
      return;
    }
    json(res, 200, tape);
    return;
  }

  if (method === 'POST' && path === '/v1/daily-tape') {
    await putTape(p, caller, validateTape(await readJson(req)));
    noContent(res);
    return;
  }

  if (method === 'GET' && path === '/v1/runs') {
    json(res, 200, await listRuns(p, caller));
    return;
  }

  const runPut = path.match(/^\/v1\/runs\/([^/]+)$/);
  if (method === 'PUT' && runPut) {
    const runId = decodeURIComponent(runPut[1] as string);
    await putRun(p, caller, validateRunRecord(await readJson(req), runId));
    noContent(res);
    return;
  }

  if (method === 'GET' && path === '/v1/machine-versions') {
    json(res, 200, await listMachineVersions(p, caller));
    return;
  }

  const machinePut = path.match(/^\/v1\/machine-versions\/([^/]+)\/(\d+)$/);
  if (method === 'PUT' && machinePut) {
    const machineName = decodeURIComponent(machinePut[1] as string);
    const version = Number(machinePut[2]);
    await putMachineVersion(
      p,
      caller,
      validateMachineVersion(await readJson(req), machineName, version),
    );
    noContent(res);
    return;
  }

  json(res, 404, { error: 'not_found' });
}

export function makeServer(
  poolOverride?: Pool,
  verifierOverride?: PrincipalVerifier,
): ReturnType<typeof createServer> {
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
        await route(req, res, poolOverride, verifierOverride);
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
