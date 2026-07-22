/**
 * AlphaHandoffToken contract — single source of truth for the token the game
 * mints and the investor shell (refi-us-sec-ia) verifies.
 *
 * PURE module: no jose, no pg, no I/O — so it is trivially unit-testable and
 * host-agnostic. The claim shape MUST stay byte-for-byte compatible with the
 * shell's strict verifier (apps/web/app/api/v1/investor/alpha-claim →
 * claimSchema). The shell rejects any unknown claim, so never add a field here
 * that isn't in that allowlist — in particular the ten DimensionCode
 * behavioral scores never leave the game (ReFi Alpha spec §6.6).
 */

export const HANDOFF_ISSUER = "refi-alpha" as const;
export const HANDOFF_AUDIENCE = "refi-us-sec-ia" as const;
/** Spec §2.2: exp must be <= 10 minutes from mint. */
export const HANDOFF_MAX_TTL_SECONDS = 600;

export const INTENDED_DESTINATIONS = [
  "ELIGIBILITY",
  "PAPER",
  "SIGNAL_INFO",
  "MANAGED_INFO",
] as const;
export type IntendedDestination = (typeof INTENDED_DESTINATIONS)[number];

/** Server-derived progress summary that seeds the token's private claims. */
export interface HandoffInput {
  /** Durable player identity (auth.users.id once upgraded; session id today). */
  sub: string;
  /** Immutable snapshot id for this frozen progress view. */
  progressSnapshotId: string;
  /** Arena ids only — never checkpoint or behavioral detail. */
  completedArenas: string[];
  machineBuilderUnlocked: boolean;
  machineVersionCount: number;
  /** Fair Match beat rate in [0,1], or null if no fair matches yet. */
  machineBeatRate: number | null;
  campaignSource?: string;
  intendedDestination: IntendedDestination;
}

/** The exact JWT payload the shell verifies. Registered + private claims only. */
export interface HandoffClaims {
  iss: typeof HANDOFF_ISSUER;
  aud: typeof HANDOFF_AUDIENCE;
  sub: string;
  iat: number;
  exp: number;
  jti: string;
  progressSnapshotId: string;
  completedArenas: string[];
  machineBuilderUnlocked: boolean;
  machineVersionCount: number;
  machineBeatRate: number | null;
  campaignSource?: string;
  intendedDestination: IntendedDestination;
}

export interface BuildOptions {
  /** Unix seconds "now"; injected for testability. */
  nowSeconds: number;
  /** Single-use token id. */
  jti: string;
  /** Token lifetime; clamped to HANDOFF_MAX_TTL_SECONDS. */
  ttlSeconds?: number;
}

export function isIntendedDestination(v: unknown): v is IntendedDestination {
  return (
    typeof v === "string" &&
    (INTENDED_DESTINATIONS as readonly string[]).includes(v)
  );
}

/**
 * Build the exact claim set the shell accepts. Fail-closed: throws on any input
 * the shell would reject, so a bad token is never minted (cheaper to catch here
 * than as a 401 after the round-trip).
 */
export function buildHandoffClaims(
  input: HandoffInput,
  opts: BuildOptions,
): HandoffClaims {
  if (!input.sub) throw new Error("handoff: sub (player identity) is required");
  if (!input.progressSnapshotId) {
    throw new Error("handoff: progressSnapshotId is required");
  }
  if (!isIntendedDestination(input.intendedDestination)) {
    throw new Error(
      `handoff: intendedDestination must be one of ${INTENDED_DESTINATIONS.join("|")}`,
    );
  }
  if (input.completedArenas.length > 64) {
    throw new Error("handoff: completedArenas exceeds the 64-arena cap");
  }
  if (
    !Number.isInteger(input.machineVersionCount) ||
    input.machineVersionCount < 0
  ) {
    throw new Error(
      "handoff: machineVersionCount must be a non-negative integer",
    );
  }
  if (
    input.machineBeatRate !== null &&
    (input.machineBeatRate < 0 || input.machineBeatRate > 1)
  ) {
    throw new Error("handoff: machineBeatRate must be within [0,1] or null");
  }
  if (!opts.jti) throw new Error("handoff: jti is required");

  const ttl = Math.min(
    opts.ttlSeconds ?? HANDOFF_MAX_TTL_SECONDS,
    HANDOFF_MAX_TTL_SECONDS,
  );

  const base = {
    iss: HANDOFF_ISSUER,
    aud: HANDOFF_AUDIENCE,
    sub: input.sub,
    iat: opts.nowSeconds,
    exp: opts.nowSeconds + ttl,
    jti: opts.jti,
    progressSnapshotId: input.progressSnapshotId,
    completedArenas: input.completedArenas,
    machineBuilderUnlocked: input.machineBuilderUnlocked,
    machineVersionCount: input.machineVersionCount,
    machineBeatRate: input.machineBeatRate,
    intendedDestination: input.intendedDestination,
  };

  // campaignSource is optional; include it only when present (exactOptional).
  return input.campaignSource
    ? { ...base, campaignSource: input.campaignSource.slice(0, 256) }
    : base;
}
