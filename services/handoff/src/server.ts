import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Pool } from "pg";
import type { JWK } from "jose";
import { mintHandoff, HttpError, type MintRequest } from "./handler.js";
import { loadPrivateJwk } from "./sign.js";

const PORT = Number(process.env["PORT"] ?? 8080);
const SHELL_BASE_URL =
  process.env["SHELL_BASE_URL"] ?? "https://refi-us-sec-ia-web.vercel.app";
// Default to the game origin, not "*": the mint endpoint is public, so CORS
// is one of the few browser-side abuse dampeners it has.
const ALLOWED_ORIGIN =
  process.env["ALLOWED_ORIGIN"] ?? "https://game.refi.trading";
const MAX_BODY_BYTES = 16 * 1024;

// Per-IP mint rate limit: fixed window, in-memory (per instance — a first
// layer; Cloud Armor / a distributed limiter is the scale follow-on).
const RATE_LIMIT_MAX = Number(process.env["RATE_LIMIT_MAX"] ?? 10);
const RATE_LIMIT_WINDOW_MS = Number(
  process.env["RATE_LIMIT_WINDOW_MS"] ?? 60_000,
);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    // Opportunistic cleanup so the map cannot grow unboundedly.
    if (rateBuckets.size > 10_000) {
      for (const [k, v] of rateBuckets) if (now >= v.resetAt) rateBuckets.delete(k);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}
function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0];
  return first?.trim() || req.socket.remoteAddress || "unknown";
}

// Lazy singletons so cold start / health checks don't require the DB or key.
let pool: Pool | undefined;
function db(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env["DATABASE_URL"],
      max: 3,
      // Managed Postgres (Neon, Cloud SQL public IP) require TLS, and both
      // present publicly-trusted certs — so verify by default. Escape
      // hatches: PGSSLMODE=disable for a local plaintext dev database, or
      // PGSSL_NO_VERIFY=true for a self-signed target you explicitly trust.
      ssl:
        process.env["PGSSLMODE"] === "disable"
          ? false
          : process.env["PGSSL_NO_VERIFY"] === "true"
            ? { rejectUnauthorized: false }
            : { rejectUnauthorized: true },
    });
  }
  return pool;
}

let privateJwk: JWK | undefined;
function key(): JWK {
  if (!privateJwk) privateJwk = loadPrivateJwk();
  return privateJwk;
}

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, "request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "body must be JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer((req, res) => {
  void (async () => {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    // Health check (Cloud Run).
    if (req.method === "GET" && (req.url === "/" || req.url === "/healthz")) {
      json(res, 200, { ok: true });
      return;
    }
    if (req.method !== "POST" || !req.url?.startsWith("/mint-handoff")) {
      json(res, 404, { error: "not_found" });
      return;
    }
    if (rateLimited(clientIp(req))) {
      json(res, 429, { error: "rate_limited" });
      return;
    }
    try {
      const body = (await readJson(req)) as Partial<MintRequest>;
      if (typeof body.sessionId !== "string") {
        throw new HttpError(400, "sessionId is required");
      }
      const result = await mintHandoff(
        { db: db(), privateJwk: key(), shellBaseUrl: SHELL_BASE_URL },
        {
          sessionId: body.sessionId,
          ...(typeof body.intendedDestination === "string"
            ? { intendedDestination: body.intendedDestination }
            : {}),
          ...(typeof body.campaignSource === "string"
            ? { campaignSource: body.campaignSource }
            : {}),
        },
      );
      json(res, 200, result);
    } catch (err) {
      if (err instanceof HttpError) {
        json(res, err.status, { error: err.message });
      } else {
        // Never leak internals; log server-side.
        console.error("mint-handoff error:", err);
        json(res, 500, { error: "internal_error" });
      }
    }
  })();
});

server.listen(PORT, () => {
  console.log(`mint-handoff listening on :${String(PORT)}`);
});
