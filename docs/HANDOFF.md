# Alpha handoff: game → investor shell

Connects the game to the SEC investor shell (`refi-us-sec-ia`). When a player
finishes proving alpha, the game mints a short-lived, single-use
**AlphaHandoffToken** and redirects them into the shell's onboarding funnel,
which verifies the token and binds their progress.

```
GAME (browser)                mint-handoff (Cloud Run)              SHELL (refi-us-sec-ia)
  ClaimHandoffButton  ──POST /mint-handoff──▶  read progress (Postgres)   POST /api/v1/investor/alpha-claim
  src/lib/handoff.ts                          build §2.2 claims           verify ES256 + iss/aud/exp + jti
                       ◀── { token, redirectUrl } ──  sign ES256 (private JWK)   bind → eligibility → onboarding
  window.location = redirectUrl ─────────────────────────────────────────▶ /us/alpha-claim?token=…
```

**Portable by design (no Supabase lock-in for this code):** the service is a
plain Node container on Cloud Run and reads Postgres over a `DATABASE_URL`
connection string — Neon today, Cloud SQL/AlloyDB later, with no code change.

## Layout
- `services/handoff/` — the Cloud Run mint service (`src/contract.ts` is the
  token contract SSOT; `handler.ts`/`server.ts`; `test/` runnable Node tests).
- `src/lib/handoff.ts` + `src/components/ClaimHandoffButton.tsx` — game client.
- `infra/terraform/` — Cloud Run + Secret Manager + IAM.

## ES256 key exchange (do this once)
Generate a P-256 keypair. The **private** JWK goes to the service secret; the
**public** JWK goes to the shell's verifier. Never commit either.

```bash
cd services/handoff && npm install   # provides jose
node --input-type=module -e '
import { generateKeyPair, exportJWK } from "jose";
const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
const pub = await exportJWK(publicKey), priv = await exportJWK(privateKey);
pub.alg = priv.alg = "ES256"; pub.kid = priv.kid = "alpha-handoff-1";
console.log("PUBLIC  (shell ALPHA_HANDOFF_PUBLIC_KEY_JWK):\n" + JSON.stringify(pub));
console.log("PRIVATE (service secret alpha-handoff-private-key):\n" + JSON.stringify(priv));
'
```
- **PUBLIC** → set as `ALPHA_HANDOFF_PUBLIC_KEY_JWK` in the shell (Vercel
  Production), alongside `ALPHA_HANDOFF_ISSUER=refi-alpha`,
  `ALPHA_HANDOFF_AUDIENCE=refi-us-sec-ia`, `FLAG_ALPHA_CLAIM_ROUTE=on`.
- **PRIVATE** → add as a Secret Manager version (below). Store nowhere else.

## Deploy
```bash
# 1. Build & push the image
gcloud builds submit services/handoff \
  --tag us-central1-docker.pkg.dev/<project>/refi/handoff:$(git rev-parse --short HEAD)

# 2. Provision infra
cd infra/terraform && terraform init
terraform apply -var project_id=<project> -var image=<image-from-step-1>

# 3. Add secret values (kept out of Terraform state)
printf '%s' '<PRIVATE_JWK_JSON>' | gcloud secrets versions add alpha-handoff-private-key --data-file=-
printf '%s' '<postgres-connection-string>' | gcloud secrets versions add handoff-database-url --data-file=-

# 4. Point the game at the service
#    VITE_HANDOFF_URL=<terraform output service_url>   (game build env)
```

## Service env
| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres (Neon/Cloud SQL) connection string (secret) |
| `ALPHA_HANDOFF_PRIVATE_KEY_JWK` | ES256 private JWK (secret) |
| `SHELL_BASE_URL` | Investor shell origin (default prod) |
| `ALLOWED_ORIGIN` | CORS origin of the game frontend |
| `PGSSLMODE` | `disable` only for a local plaintext DB |

## Testing
```bash
cd services/handoff && npm test   # contract invariants + ES256 round-trip + handler (fake DB)
```
The tests assert the minted token stays within the shell's exact claim
allowlist (no drift, no behavioral-score leakage) and that a token signed with
one key does not verify with another.

## Required follow-ons (not in this seam)
1. **Identity hardening** — the token `sub` is the game's `session_id` today
   (spoofable). Add anonymous auth + magic-link (Firebase Auth, GCP-native) so
   `sub` is a durable user before the handoff backs investor-facing claims.
2. **Durable progress snapshot** — persist a real snapshot row and use its id
   as `progressSnapshotId` (currently a fresh uuid).
3. **Verify the progress SQL** in `services/handoff/src/progress.ts` against the
   live migrations (column/table names).
4. **RLS tightening** (owner-scoped) and **§62 result-category labels** on the
   game's performance visuals.
5. **Game CRUD migration** off Supabase → the portable Postgres (separate,
   larger track).
