// Supabase Edge Function: alpha-handoff — mints the AlphaHandoffToken.
//
// Why a server function: the handoff token is a signed ES256 JWT (spec
// §2.2/§4.4). A browser SPA cannot hold the ES256 private key, so signing
// lives here. The client sends the player's game progress; this function
// signs a short-lived, single-use JWT whose claims match the investor
// shell's /api/v1/investor/alpha-claim schema EXACTLY (a strict .strict()
// Zod parse there rejects any extra claim — including any behavioural
// dimension, which must never be on the token per §6.6).
//
// Deploy + keys: see ./README.md. Requires the secret
// ALPHA_HANDOFF_PRIVATE_KEY_JWK (a P-256 private JWK); the matching public
// JWK goes in the shell's ALPHA_HANDOFF_PUBLIC_KEY_JWK.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { importJWK, SignJWT } from "https://deno.land/x/jose@v5.9.6/index.ts";

const ISSUER = "refi-alpha";
const AUDIENCE = "refi-us-sec-ia";
const TTL_SECONDS = 10 * 60; // shell requires exp ≤ 10 min
const DESTINATIONS = ["ELIGIBILITY", "PAPER", "SIGNAL_INFO", "MANAGED_INFO"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

function rid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const alphaPlayerId = body.alphaPlayerId;
  if (typeof alphaPlayerId !== "string" || alphaPlayerId.length === 0) {
    return json({ error: "alphaPlayerId_required" }, 400);
  }
  const destination = DESTINATIONS.includes(body.destination as string)
    ? (body.destination as string)
    : "ELIGIBILITY";

  const jwkStr = Deno.env.get("ALPHA_HANDOFF_PRIVATE_KEY_JWK");
  if (!jwkStr) return json({ error: "signer_not_configured" }, 500);

  let key: CryptoKey | Uint8Array;
  try {
    key = await importJWK(JSON.parse(jwkStr), "ES256");
  } catch {
    return json({ error: "signer_key_invalid" }, 500);
  }

  // Coerce progress claims to the shell's exact shapes; empty/false/0/null
  // are all schema-valid, so partial prototype progress still produces a
  // valid token.
  const completedArenas = Array.isArray(body.completedArenas)
    ? (body.completedArenas as unknown[]).slice(0, 64).map((a) => String(a))
    : [];
  const machineVersionCount = Number.isFinite(body.machineVersionCount)
    ? Math.max(0, Math.trunc(body.machineVersionCount as number))
    : 0;
  const rawRate = body.machineBeatRate;
  const machineBeatRate =
    typeof rawRate === "number" && rawRate >= 0 && rawRate <= 1 ? rawRate : null;
  const campaignSource =
    typeof body.campaignSource === "string" && body.campaignSource.length > 0
      ? { campaignSource: (body.campaignSource as string).slice(0, 256) }
      : {};
  const progressSnapshotId =
    typeof body.progressSnapshotId === "string" && body.progressSnapshotId.length > 0
      ? (body.progressSnapshotId as string)
      : rid("snap");

  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    progressSnapshotId,
    completedArenas,
    machineBuilderUnlocked: Boolean(body.machineBuilderUnlocked),
    machineVersionCount,
    machineBeatRate,
    ...campaignSource,
    intendedDestination: destination,
  })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(alphaPlayerId)
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .setJti(crypto.randomUUID())
    .sign(key);

  return json({ token }, 200);
});
