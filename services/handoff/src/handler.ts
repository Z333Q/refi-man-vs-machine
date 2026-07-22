import { randomUUID } from "node:crypto";
import type { JWK } from "jose";
import { buildHandoffClaims, isIntendedDestination } from "./contract.js";
import { loadProgress, type Queryable } from "./progress.js";
import { signHandoff } from "./sign.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface MintDeps {
  db: Queryable;
  privateJwk: JWK;
  /** Investor shell origin, e.g. https://refi-us-sec-ia-web.vercel.app */
  shellBaseUrl: string;
  /** Injected for tests. */
  nowMs?: () => number;
  newId?: () => string;
}

export interface MintRequest {
  /** Player identity (session id today; auth uid once upgraded). */
  sessionId: string;
  intendedDestination?: string;
  campaignSource?: string;
}

export interface MintResult {
  token: string;
  redirectUrl: string;
}

/**
 * Core mint logic: server-derive progress → build the §2.2 claims → ES256 sign
 * → return the token + the shell redirect URL. Pure w.r.t. its injected deps
 * (db + key), so it is fully testable without a live DB or network.
 */
export async function mintHandoff(
  deps: MintDeps,
  req: MintRequest,
): Promise<MintResult> {
  if (!req.sessionId) throw new HttpError(400, "sessionId is required");

  const dest = req.intendedDestination ?? "ELIGIBILITY";
  if (!isIntendedDestination(dest)) {
    throw new HttpError(400, "invalid intendedDestination");
  }

  const nowMs = deps.nowMs ?? Date.now;
  const newId = deps.newId ?? randomUUID;

  // Follow-on: freeze a durable snapshot row and use its id here. For now the
  // snapshot id is a fresh uuid marking this frozen view.
  const progressSnapshotId = `snap_${newId()}`;

  const input = await loadProgress({
    db: deps.db,
    sessionId: req.sessionId,
    progressSnapshotId,
    intendedDestination: dest,
    ...(req.campaignSource ? { campaignSource: req.campaignSource } : {}),
  });

  const claims = buildHandoffClaims(input, {
    nowSeconds: Math.floor(nowMs() / 1000),
    jti: newId(),
  });

  const token = await signHandoff(claims, deps.privateJwk);
  const base = deps.shellBaseUrl.replace(/\/+$/, "");
  const redirectUrl = `${base}/us/alpha-claim?token=${encodeURIComponent(token)}`;
  return { token, redirectUrl };
}
