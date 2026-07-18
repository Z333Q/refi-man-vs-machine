# alpha-handoff Edge Function

Mints the signed **AlphaHandoffToken** (ES256 JWT) the investor shell's
`POST /api/v1/investor/alpha-claim` verifies. Signing lives server-side
because a browser SPA cannot hold the private key (spec §2.2 / §4.4).

## Token contract (must match the shell exactly)

- `alg` ES256, `iss` `refi-alpha`, `aud` `refi-us-sec-ia`, `exp` ≤ 10 min, single-use `jti`.
- Claims: `sub` (alphaPlayerId), `progressSnapshotId`, `completedArenas`,
  `machineBuilderUnlocked`, `machineVersionCount`, `machineBeatRate`,
  `campaignSource?`, `intendedDestination`.
- The shell does a **strict** parse — no extra claims, and never any
  behavioural dimension (§6.6).

## One-time key provisioning (infra action)

Generate a P-256 keypair as JWKs (Node with `jose`):

```js
import { generateKeyPair, exportJWK } from 'jose';
const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
console.log('PRIVATE', JSON.stringify(await exportJWK(privateKey)));
console.log('PUBLIC ', JSON.stringify(await exportJWK(publicKey)));
```

- **Game (this repo):** set the private JWK as a function secret:
  `supabase secrets set ALPHA_HANDOFF_PRIVATE_KEY_JWK='{"kty":"EC","crv":"P-256",...}'`
- **Investor shell (`refi-us-sec-ia`):** set env
  `ALPHA_HANDOFF_PUBLIC_KEY_JWK` to the matching **public** JWK (replaces
  the non-prod placeholder in `apps/web/src/lib/config/env.ts`), and enable
  `FLAG_ALPHA_CLAIM_ROUTE`.

Rotate by generating a new pair and updating both sides together.

## Deploy

```sh
supabase functions deploy alpha-handoff
```

The client invokes it via `supabase.functions.invoke('alpha-handoff', …)`;
see `src/lib/handoff.ts`.

## Local

`supabase functions serve alpha-handoff` with `ALPHA_HANDOFF_PRIVATE_KEY_JWK`
exported in the shell environment.
