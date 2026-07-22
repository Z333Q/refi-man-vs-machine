import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Pool } from "pg";
import type { JWK } from "jose";
import { mintHandoff, HttpError, type MintRequest } from "./handler.js";
import { loadPrivateJwk } from "./sign.js";
import { verifyFirebaseIdToken } from "./firebase-auth.js";

const PORT = Number(process.env["PORT"] ?? 8080);
const SHELL_BASE_URL =
  process.env["SHELL_BASE_URL"] ?? "https://refi-us-sec-ia-web.vercel.app";
const ALLOWED_ORIGIN = process.env["ALLOWED_ORIGIN"] ?? "*";
const MAX_BODY_BYTES = 16 * 1024;

// Identity: when a Firebase project is configured, the mint verifies the
// caller's Firebase ID token and uses the uid as the token `sub`.
const FIREBASE_PROJECT_ID = process.env["FIREBASE_PROJECT_ID"];
const REQUIRE_VERIFIED_IDENTITY =
  process.env["REQUIRE_VERIFIED_IDENTITY"] === "true";

const verifyIdentity = FIREBASE_PROJECT_ID
  ? async (bearer: string) =>
      verifyFirebaseIdToken(bearer, { projectId: FIREBASE_PROJECT_ID })
  : undefined;

// Lazy singletons so cold start / health checks don't require the DB or key.
let pool: Pool | undefined;
function db(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env["DATABASE_URL"],
      max: 3,
      // Managed Postgres (Neon, Cloud SQL public IP) require TLS. Set
      // PGSSLMODE=disable only for a local plaintext dev database.
      ssl:
        process.env["PGSSLMODE"] === "disable"
          ? false
          : { rejectUnauthorized: false },
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
    try {
      const body = (await readJson(req)) as Partial<MintRequest>;
      if (typeof body.sessionId !== "string") {
        throw new HttpError(400, "sessionId is required");
      }
      const result = await mintHandoff(
        {
          db: db(),
          privateJwk: key(),
          shellBaseUrl: SHELL_BASE_URL,
          ...(verifyIdentity ? { verifyIdentity } : {}),
          requireVerifiedIdentity: REQUIRE_VERIFIED_IDENTITY,
        },
        {
          sessionId: body.sessionId,
          ...(typeof req.headers.authorization === "string"
            ? { authorization: req.headers.authorization }
            : {}),
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
