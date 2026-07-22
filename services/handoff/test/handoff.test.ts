import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, jwtVerify, decodeProtectedHeader } from "jose";
import {
  buildHandoffClaims,
  HANDOFF_ISSUER,
  HANDOFF_AUDIENCE,
  HANDOFF_MAX_TTL_SECONDS,
  type HandoffInput,
} from "../src/contract.ts";
import { signHandoff } from "../src/sign.ts";
import { mintHandoff, HttpError } from "../src/handler.ts";
import type { Queryable } from "../src/progress.ts";

// The exact claim allowlist the shell's strict verifier accepts (§2.2). The
// minted token must never carry a key outside this set (no DimensionCode
// behavioral scores — §6.6).
const ALLOWED_CLAIM_KEYS = new Set([
  "iss", "aud", "sub", "iat", "exp", "jti",
  "progressSnapshotId", "completedArenas", "machineBuilderUnlocked",
  "machineVersionCount", "machineBeatRate", "campaignSource",
  "intendedDestination",
]);

const baseInput: HandoffInput = {
  sub: "ses_player1",
  progressSnapshotId: "snap_1",
  completedArenas: ["covid_black_swan", "recovery"],
  machineBuilderUnlocked: true,
  machineVersionCount: 4,
  machineBeatRate: 0.3,
  intendedDestination: "ELIGIBILITY",
};

async function keypair() {
  const { publicKey, privateKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  return {
    publicKey,
    privateJwk: await exportJWK(privateKey),
  };
}

test("buildHandoffClaims: shape, iss/aud, ttl clamp, jti", () => {
  const c = buildHandoffClaims(baseInput, {
    nowSeconds: 1000,
    jti: "jti-1",
    ttlSeconds: 99999,
  });
  assert.equal(c.iss, HANDOFF_ISSUER);
  assert.equal(c.aud, HANDOFF_AUDIENCE);
  assert.equal(c.iat, 1000);
  assert.equal(c.exp, 1000 + HANDOFF_MAX_TTL_SECONDS, "ttl clamps to 10 min");
  assert.equal(c.jti, "jti-1");
  assert.deepEqual(c.completedArenas, ["covid_black_swan", "recovery"]);
  assert.equal(c.machineBeatRate, 0.3);
  assert.ok(!("campaignSource" in c), "campaignSource omitted when absent");
  for (const k of Object.keys(c)) {
    assert.ok(ALLOWED_CLAIM_KEYS.has(k), `unexpected claim key: ${k}`);
  }
});

test("buildHandoffClaims: campaignSource included + truncated when present", () => {
  const c = buildHandoffClaims(
    { ...baseInput, campaignSource: "x".repeat(300) },
    { nowSeconds: 0, jti: "j" },
  );
  assert.equal(c.campaignSource?.length, 256);
});

test("buildHandoffClaims: fail-closed on invalid input", () => {
  assert.throws(
    () => buildHandoffClaims({ ...baseInput, intendedDestination: "MARS" as never }, { nowSeconds: 0, jti: "j" }),
    /intendedDestination/,
  );
  assert.throws(
    () => buildHandoffClaims({ ...baseInput, machineBeatRate: 1.5 }, { nowSeconds: 0, jti: "j" }),
    /machineBeatRate/,
  );
  assert.throws(
    () => buildHandoffClaims({ ...baseInput, machineVersionCount: -1 }, { nowSeconds: 0, jti: "j" }),
    /machineVersionCount/,
  );
  assert.throws(
    () => buildHandoffClaims({ ...baseInput, completedArenas: Array(65).fill("a") }, { nowSeconds: 0, jti: "j" }),
    /64-arena cap/,
  );
});

test("signHandoff: ES256 round-trips and verifies with the public key", async () => {
  const { publicKey, privateJwk } = await keypair();
  const now = Math.floor(Date.now() / 1000);
  const claims = buildHandoffClaims(baseInput, { nowSeconds: now, jti: "jti-rt" });
  const token = await signHandoff(claims, privateJwk);

  assert.equal(decodeProtectedHeader(token).alg, "ES256", "alg pinned ES256");
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: HANDOFF_ISSUER,
    audience: HANDOFF_AUDIENCE,
    algorithms: ["ES256"],
  });
  assert.equal(payload.sub, "ses_player1");
  assert.equal(payload["intendedDestination"], "ELIGIBILITY");
});

test("signHandoff: token does NOT verify against a different key", async () => {
  const a = await keypair();
  const b = await keypair();
  const claims = buildHandoffClaims(baseInput, {
    nowSeconds: Math.floor(Date.now() / 1000),
    jti: "jti-x",
  });
  const token = await signHandoff(claims, a.privateJwk);
  await assert.rejects(
    jwtVerify(token, b.publicKey, { algorithms: ["ES256"] }),
    "a token signed with key A must not verify with key B",
  );
});

function fakeDb(): Queryable {
  return {
    async query(text: string) {
      if (text.includes("from arena_runs")) {
        return { rows: [{ arena_id: "covid_black_swan" }, { arena_id: "recovery" }] } as never;
      }
      if (text.includes("from player_profiles")) {
        return { rows: [{ machine_beats: 3, machine_attempts: 10, machine_version_count: 4 }] } as never;
      }
      if (text.includes("from module_unlocks")) {
        return { rows: [{ n: 1 }] } as never;
      }
      return { rows: [] };
    },
  };
}

test("mintHandoff: server-derives claims from the DB and returns a verifiable token + redirect", async () => {
  const { publicKey, privateJwk } = await keypair();
  const result = await mintHandoff(
    {
      db: fakeDb(),
      privateJwk,
      shellBaseUrl: "https://refi-us-sec-ia-web.vercel.app/",
      nowMs: () => Date.now(),
      newId: (() => {
        let n = 0;
        return () => `id-${String(++n)}`;
      })(),
    },
    { sessionId: "ses_abc", intendedDestination: "PAPER" },
  );

  assert.match(
    result.redirectUrl,
    /^https:\/\/refi-us-sec-ia-web\.vercel\.app\/us\/alpha-claim\?token=/,
  );

  const { payload } = await jwtVerify(result.token, publicKey, {
    issuer: HANDOFF_ISSUER,
    audience: HANDOFF_AUDIENCE,
    algorithms: ["ES256"],
  });
  assert.equal(payload.sub, "ses_abc");
  assert.equal(payload["intendedDestination"], "PAPER");
  assert.deepEqual(payload["completedArenas"], ["covid_black_swan", "recovery"]);
  assert.equal(payload["machineBuilderUnlocked"], true);
  assert.equal(payload["machineVersionCount"], 4);
  assert.equal(payload["machineBeatRate"], 0.3, "beats/attempts = 3/10");
  // Interop guard: no claim key outside the shell's allowlist (no drift / no
  // behavioral-score leakage).
  for (const k of Object.keys(payload)) {
    assert.ok(ALLOWED_CLAIM_KEYS.has(k), `unexpected claim key on token: ${k}`);
  }
});

test("mintHandoff: rejects missing sessionId and invalid destination", async () => {
  const { privateJwk } = await keypair();
  const deps = {
    db: fakeDb(),
    privateJwk,
    shellBaseUrl: "https://shell.example",
  };
  await assert.rejects(
    mintHandoff(deps, { sessionId: "" }),
    (e: unknown) => e instanceof HttpError && e.status === 400,
  );
  await assert.rejects(
    mintHandoff(deps, { sessionId: "s", intendedDestination: "NOPE" }),
    (e: unknown) => e instanceof HttpError && e.status === 400,
  );
});
