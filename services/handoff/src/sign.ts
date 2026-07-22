import { SignJWT, importJWK, type JWK } from "jose";
import type { HandoffClaims } from "./contract.js";

/**
 * Load and validate the ES256 private key (JWK JSON) from the environment.
 * The private key lives ONLY here (a secret injected into the Cloud Run
 * service); the shell holds the matching public JWK to verify.
 */
export function loadPrivateJwk(
  env: NodeJS.ProcessEnv = process.env,
): JWK {
  const raw = env["ALPHA_HANDOFF_PRIVATE_KEY_JWK"];
  if (!raw) {
    throw new Error("ALPHA_HANDOFF_PRIVATE_KEY_JWK is not set");
  }
  const jwk = JSON.parse(raw) as JWK;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256") {
    throw new Error(
      "ALPHA_HANDOFF_PRIVATE_KEY_JWK must be an EC P-256 (ES256) key",
    );
  }
  if (!jwk.d) {
    throw new Error(
      "ALPHA_HANDOFF_PRIVATE_KEY_JWK must be a private key (missing 'd')",
    );
  }
  return jwk;
}

/** Sign the claims as an ES256 JWT. A `kid` on the JWK enables key rotation. */
export async function signHandoff(
  claims: HandoffClaims,
  privateJwk: JWK,
): Promise<string> {
  const key = await importJWK(privateJwk, "ES256");
  const header: { alg: "ES256"; kid?: string } =
    typeof privateJwk.kid === "string"
      ? { alg: "ES256", kid: privateJwk.kid }
      : { alg: "ES256" };
  return new SignJWT(claims as unknown as Record<string, unknown>)
    .setProtectedHeader(header)
    .sign(key);
}
