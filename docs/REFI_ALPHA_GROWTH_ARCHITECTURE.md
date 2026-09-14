# ReFi Alpha Growth Architecture

**Status:** RULED 2026-09-13, corrected the same day after two owner review
passes of PR #78 (§17.11, §17.12). The seven decisions in §17 and the
corrections in §17.11 and §17.12 are authoritative. PR A commits this document and nothing else. PR B does not
start until the owner has reviewed this revision.
**Supersedes:** the standalone "leaderboard project" framing. There is no
leaderboard project. There is one growth system and the leaderboard is one
module of it.
**Precedence:** CLAUDE.md governs game-design intent. The USA Build Integration
Spec governs integration, compliance, security, data contracts and build order.
This document sits under both and turns the §4 onboarding architecture into
the growth architecture. Where it conflicts with either, §17.9 names the
conflict rather than resolving it silently.

Governing principle for every trade-off below: **optimise the whole journey,
Game → Identity → Competition → Community → Machine → Alpha → Paper → ReFi.
Never optimise one layer locally.**

---

## 0. The one sentence

> ReFi Alpha is a public competitive investing environment that turns market
> curiosity into identity, identity into community, community into a
> repeatable process, that process into a machine, and that machine into a
> paper and ultimately commercial ReFi relationship.

Man vs Machine is ReFi Alpha's public acquisition mode. "The game" and "Alpha"
are not two products. Internally the system is four layers of one journey:

```text
REFI ALPHA
│
├── PLAY      Man vs Machine, historical arenas, challenges, rankings
├── BELONG    trader identity, friends, crews, seasons, Discord, creator cohorts
├── BUILD     Alpha Profile, Machine Builder, machine stress tests
└── PROVE     paper market, Closed Alpha, a ReFi machine beside yours
              ↓
REFI.TRADING  formal onboarding, brokerage, Signal / Managed, paid relationship
```

Every feature built from here must name the §3 state-domain transition it
improves. A PR that cannot name one is rejected at review.

---

## 1. Trust zones

One journey, four trust boundaries. Authority flows downward only at the two
merge points in §2. One coarse projection flows back upward (§2.3).

```text
┌──────────────────────────────────────────────────────────────┐
│ PUBLIC INTERNET                                              │
│ TikTok / X / Reddit / YouTube / Discord / creator / search   │
└──────────────────────────────┬───────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────┐
│ GAME / GROWTH LAYER            game.refi.trading             │
│ anonymous play · practice · challenges · profiles ·          │
│ ranked seasons · leaderboards · Machine Builder · community  │
│ authority: game core (browser for PRACTICE, server for RANKED)│
└──────────────────────────────┬───────────────────────────────┘
                     CLAIM IDENTITY  (merge point 1)
                               ↓
┌──────────────────────────────────────────────────────────────┐
│ REFI ALPHA MEMBERSHIP                                        │
│ persistent identity · Closed Alpha admission · deployed      │
│ machine · paper brokerage · current-market testing           │
│ authority: refi-us-sec-ia (paper, admission)                 │
└──────────────────────────────┬───────────────────────────────┘
                     FORMAL HANDOFF  (merge point 2)
                               ↓
┌──────────────────────────────────────────────────────────────┐
│ INVESTOR PRODUCT               refi-us-sec-ia                │
│ KYC · admission · brokerage · entitlement · billing ·        │
│ Signal / Managed                                             │
└──────────────────────────────────────────────────────────────┘
          ↑ coarse product-state projection only (§2.3)
```

Standing rules, each already stated in CLAUDE.md rules 3, 11, 12 and §61 and
restated here because the growth layer is where they are most likely to be
broken by accident:

- The game does not become KYC.
- KYC does not determine leaderboard rank.
- Billing does not determine Alpha admission.
- Discord is not an identity database.
- Gameplay is never suitability.

---

## 2. Two merge points and one projection

### 2.1 Merge point 1: player becomes a ReFi Alpha identity

Triggered by the player, never by the title screen, at the moment of a
meaningful result. It binds an anonymous game session to a person.

```text
game_sessions.id  ('ses_...', browser-minted, see src/lib/identity.ts)
        ↓ bind
app_users.id      (uuid; knows nothing about how the person authenticates)
        ↓ has
user_identities   (provider, subject, email)   one row per login method
        ↓ has
public_player_profiles (NEW, §7.1)              one handle per person
```

The first three tables exist in `db/migrations/0001_founding_schema.sql`. The
bind is `UPDATE game_sessions SET user_id, linked_at`. Anonymous history is
never copied and never destroyed; it resolves through the session row.
Multiple sessions (three browsers) resolve to one `app_user`.

Collected at merge point 1, and nothing more. Claim friction is handle plus
authentication; everything else is optional or later.

```text
handle                      (required, §7.1 handle law)
email or existing identity reference
display name, avatar        (optional)
referral attribution        (already captured first-touch, src/lib/events.ts)
community memberships       (later)
```

Country or region is not collected at claim. It becomes an optional field
only when a community feature has a concrete use for it.

Preserved: runs, rankings, scores, machines, achievements, friends, challenge
history, creator cohort.

The player is now inside ReFi Alpha. Not a client. Not KYC'd. Not an advisory
customer. Not necessarily admitted to Closed Alpha. Ranked play requires this
identity (§17.3); Practice never does.

### 2.2 Merge point 2: Alpha player crosses into the financial product

Uses the existing single-use handoff primitive (`handoffs` table,
`services/handoff`, destinations `ELIGIBILITY | PAPER | SIGNAL_INFO |
MANAGED_INFO`, TTL capped at 600 s, issuer `refi-alpha`, audience
`refi-us-sec-ia`).

Three separate concepts govern when this happens, and none gates another:

- **A. Direct entry, always available.** A player who wants formal ReFi can
  take the handoff at any time from the persistent `/alpha` surface. The
  game never traps a motivated user behind a growth metric.
- **B. Contextual prompts on observed intent.** Proactive product CTAs may
  appear at ruled intent milestones: first machine lock (strongest), three
  regimes completed, meaningful return engagement. These may fire before the
  user satisfies the QUALIFIED law.
- **C. QUALIFIED**, the §12 North Star cohort. A measurement and targeting
  segment. Not a permission, not a prerequisite for the handoff, and not a
  gate on A or B. Whether waiting for qualification helps or hurts
  conversion is an empirical question the §11 event context exists to answer.

Sequence. Identity binding happens after a verified formal product principal
exists and before any admission-dependent projection; the exact position of
product AUTH relative to ELIGIBILITY is governed by the investor-product
integration spec.

```text
game app_users.id
     ↓ POST /v1/handoffs { destination }         mint (services/handoff)
single-use token → refi-us-sec-ia                 product consumes and verifies
     ↓
user reaches / uses formal product auth           verified product principal
     ↓
bind alphaUserId (app_users.id) ↔ product user_id (owned by refi-us-sec-ia)
     ↓
eligibility · required consents · KYC · compliance · membership
     ↓
admission
     ↓
brokerage / paper
     ↓
projected lifecycle updates (§2.3), keyed to the bound app_users.id
```

Projection never guesses identity from an email address or browser state;
it exists only once the binding above does.

Import boundary. This is the compliance floor and is not negotiable in a PR.

```text
IMPORT                              DO NOT IMPORT AS ADVISORY FACT
✓ Alpha identity (handle, user id)  ✗ inferred risk tolerance
✓ accomplishments                   ✗ simulated goals
✓ machines built (version refs)     ✗ game conviction
✓ arenas completed                  ✗ willingness to take game drawdown
✓ acquisition attribution           ✗ any alpha_profile_dimensions row
✓ community identity
```

### 2.3 Product-state projection (ruled, §17.6)

After identity binding, the investor product projects one coarse lifecycle
value back to the growth system. One way. The investor product remains
authoritative. The projection exists so the game can choose a truthful next
action, grant community status, and measure the funnel below the handoff. It
exists so that a paper user is never asked to "Join Alpha".

```text
Formal ReFi / Alpha
        │  coarse lifecycle projection, keyed to app_users.id
        ↓
Growth system

NONE
ALPHA_CANDIDATE     invited or eligible on the product side
ALPHA_MEMBER        admission satisfied
PAPER_READY         paper environment provisioned, not yet trading
PAPER_ACTIVE        paper decisions flowing
COMMERCIAL_CLIENT   formal commercial relationship
BLOCKED             only if a product UX genuinely needs it; coarse
                    reason category only (e.g. REVIEW, REGION, CLOSED)
```

Never mirrored into the growth plane: KYC evidence, identity-verification
provider payloads, watchlist results, formal advisory answers, risk tolerance,
suitability, financial capacity, broker credentials, account numbers, raw
compliance reasons, any sensitive provider payload.

Binding rule: the projection is keyed to an authenticated `user_id`. It never
trusts `x-alpha-session`, which is continuity, not authentication.

**Transport (locked now, implemented in PR J).** PUSH from `refi-us-sec-ia`
to the growth plane. Not a route on the existing persistence API, which is
intentionally public for anonymous mirroring. A small private Cloud Run
service, `projection-ingest`, with its own IAM boundary:

- a dedicated user-managed service account for the projecting product
  service;
- the receiving service grants that principal Cloud Run Invoker only;
- the caller sends a Google-signed OIDC ID token with the receiving service
  as audience;
- no downloaded service-account key; Workload Identity Federation if the
  source workload ever runs outside GCP.

Payload contract:

```ts
interface ProductStateProjection {
  alphaUserId: string;        // app_users.id, the handoff `sub` under claimed identity
  state: ProjectionState;
  blockedCategory?: 'REVIEW' | 'REGION' | 'CLOSED';
  sourceEventId: string;      // idempotency key for retries
  sourceRevision: number;     // monotonically increasing per user
  sourceVersion: string;      // projecting service's contract version
  projectedAt: string;
}
```

The receiver upserts only when `sourceRevision` exceeds the stored revision.
Retries are idempotent by `sourceEventId`. A path-supplied user id is never
trusted on its own: the receiver resolves the known Alpha identity binding
first. Under claimed identity the handoff `sub` is the durable,
provider-neutral `app_users.id`; the product stores that binding when it
consumes the handoff and uses it for every projection.

CTA routing is a function of the projection value alone. Truthful next-action
routing is the entire purpose of the projection, so the states are never
collapsed. Game-side intent (§3 domains A to C) decides *whether* a
contextual prompt appears (§2.2 B); the projection decides *what it says*.

| Projection | Next action shown |
|---|---|
| `NONE` | `ENTER PAPER ALPHA` (formal Alpha entry via handoff) |
| `ALPHA_CANDIDATE` | `CONTINUE ALPHA` (the appropriate admission continuation) |
| `ALPHA_MEMBER` | `SET UP PAPER` |
| `PAPER_READY` | `START PAPER` / `OPEN PAPER SETUP` |
| `PAPER_ACTIVE` | `OPEN PAPER` |
| `COMMERCIAL_CLIENT` | `OPEN REFI` |
| `BLOCKED` | neutral status or help surface; no acquisition CTA |

With no projection row (unbound identity or anonymous session), the game
behaves as `NONE`.

---

## 3. Player state model: four orthogonal domains

There is no single linear lifecycle. A person can enter formal Alpha before
ever competing, onboard to ReFi directly without playing, lock a machine
before entering Ranked, or arrive as an existing commercial client and start
playing. Four independent, server-derivable domains describe a player, and
the architecture never assumes they advance in one fixed order. Every growth
feature names the domain and transition it moves.

**A. Game identity** (exactly one value; owner: game)

| Value | Derivation |
|---|---|
| `VISITOR` | landing viewed, no `arena.started` |
| `ANONYMOUS_PLAYER` | ≥1 `arena.started`, `game_sessions.user_id IS NULL` |
| `CLAIMED_PLAYER` | `game_sessions.user_id IS NOT NULL` and a `public_player_profiles` row |

**B. Game progression and achievements** (a set; values coexist; owner: game)

| Capability | Derivation |
|---|---|
| `COMPETITOR` | ≥1 `ranked_attempts` row in state `active` or later |
| `MACHINE_BUILDER` | ≥1 `player_machine_versions.locked_at IS NOT NULL` |
| arena completions | per arena, from run records and `season_results` |
| machine beats | per arena, `result_state = 'WIN'` |
| further achievements | as ruled per feature; none is a lifecycle stage |

**C. Growth qualification** (a derived boolean; owner: game analytics)

`QUALIFIED` is true when the §12 law holds: claimed identity, ≥3 meaningful
arenas, ≥2 separate active days, and (≥1 autopsy reviewed or ≥1 machine
locked). It is the North Star cohort and a targeting segment. It is not a
permission to enter formal ReFi, not a prerequisite for the handoff, and
not an input to any product state. `conversion.alpha_cta_seen` is telemetry
that records what the UI showed; it never creates state and is never a
prerequisite for state. When any conversion event fires, the player's
qualification status rides along as event context (§11) so qualified and
early converters can be compared.

**D. Product lifecycle projection** (exactly one value; owner: the investor
product, projected per §2.3)

`NONE`, `ALPHA_CANDIDATE`, `ALPHA_MEMBER`, `PAPER_READY`, `PAPER_ACTIVE`,
`COMMERCIAL_CLIENT`, `BLOCKED`. Authoritative for the financial-product
relationship. Read literally, never inferred from A to C.

The game computes A, B and C. It reads D. Nothing in A to C is ever written
from D, and nothing in D is ever written from A to C. The name QUALIFIED is
kept distinct from `ALPHA_CANDIDATE` so a game-side segment and a
product-side invitation cannot be confused.

---

## 4. Practice and Ranked

The single most important architectural split. A browser-run simulation
cannot be an authoritative competitive record.

```text
PRACTICE                         RANKED
client-authoritative             server-authoritative
anonymous allowed                claimed identity required (domain A: CLAIMED_PLAYER), no KYC
unlimited                        one official attempt per arena per user per season
offline-capable                  online only
local-first, mirrored (today)    server-issued, server-resolved, resumable
no anti-cheat                    sequential checkpoint reveal (§5)
```

Today's `mirroredStore` (local authoritative, remote mirror, survives API
outage) is exactly right for PRACTICE and stays as is. RANKED is a new path
beside it, not a replacement.

Attempt rule (ruled, §17.2):

- The official attempt **begins when the first ranked decision is committed**.
  Opening the arena, reading the briefing, or abandoning before the first
  commit consumes nothing.
- A disconnect or browser crash does not consume or kill the attempt. The
  server-side run is the record and resumes where it stopped.
- After the official attempt completes, further plays of that arena in the
  same season are Practice and cannot replace the ranked result.
- No best-of-N in v1. Later seasons provide replayability without corrupting
  rank.

---

## 5. Ranked protocol

Stateless per request. Each run has at most 22 decisions, so the server
replays from zero on every call. No live game-server memory, no Redis.

```text
POST /v1/ranked/attempts
  body   { seasonId, arenaId }
  auth   claimed identity
  200    CompetitiveManifest + checkpoint 1 packet        (state: issued)
  200    existing attempt if one is already issued/active (idempotent)
  409    attempt already complete for (season, user, arena)

POST /v1/ranked/attempts/{attemptId}/decisions
  body   { checkpoint: n, actionCode, thesisCode, confidence, orders?, invalidationCondition? }
  server load manifest → load decisions 1..n-1 → replay 0→n with game-core
         → validate action against rules_version → resolve checkpoint n
         → persist decision + resolution → return outcome n + packet n+1
         first accepted decision moves the attempt issued → active
  200    { resolution: CheckpointResult, next: CheckpointPacket | null }
  409    checkpoint out of sequence
  410    attempt expired

GET  /v1/ranked/attempts/{attemptId}
  resumable state: manifest, decisions so far, resolutions so far, next packet
```

The future never reaches the browser before the decision is committed. This
does not erase historical knowledge (a player may know COVID happened); it
prevents reading the authored return path from DevTools.

`CompetitiveManifest`, recorded permanently on the attempt:

```ts
interface CompetitiveManifest {
  seasonId: string;
  arenaId: string;
  arenaVersion: string;
  engineVersion: string;
  scoringVersion: string;
  rulesVersion: string;
  contentVersion: string;
  seed: number;
  startingCapital: number;
  turnoverAllowance: number;
  criticalDrawdown: number;
  issuedAt: string;
  expiresAt: string;
}
```

A season's manifest is frozen when the season opens. Scoring, turnover rules,
drawdown limit, machine behaviour, checkpoint returns and arena difficulty
are never A/B tested inside a live season (§13).

---

## 6. One game core, two hosts (ruled, §17.4)

Move the pure mechanics out of `src/lib` into a package that both the browser
and the server verifier import. Same algorithm, one place.

```text
packages/game-core/
├── engine/        runEngine, allocation, checkpoint resolution
├── scoring/       scoringEngine, §29.1 amendment (run-so-far Sharpe scale)
├── replay/        deterministic replay from (manifest, decisions[])
├── machine/       machinePolicy, authored opponent, player-machine executor
├── content/       arena content contract, checkpoint packets
└── rules/         turnover allowance, critical drawdown, action validity
```

Forbidden imports inside game-core: React, localStorage, network, any auth
vendor, Postgres, Discord, analytics. The existing `vendor-gate` extends to
enforce this. There is never a frontend score algorithm and a backend score
algorithm.

Extraction rules:

- Incremental only. No big-bang rewrite. One module or one coherent cluster
  per PR, with `src/lib` re-exporting until the move is complete.
- Every extraction PR is behaviour-preserving and proves it: the existing
  replay-parity tests (`projectRun` → `replayRun` → `replayMatchesRecord`)
  must produce identical records before and after, for every arena and every
  disposition in `arenaPlaythrough.test.ts`.
- Never combine an extraction with an engine behaviour change. If a behaviour
  change is needed, it ships first, on its own, with its own tests.
- Order: allocation, scoring, run transitions, replay, shared contracts →
  machine policy → remaining pure domain logic as the verifier needs it.
- UI, React and browser persistence never enter game-core.

---

## 7. Database extension (target schema and migration ownership)

Extend the founding schema. Do not replace it. Do not create forty tables.

This section shows the **target** schema. It is not one migration. Each
table lands, additively, in the PR that owns the feature it serves, so that
no PR creates a table nothing reads yet:

| Migration | PR | Creates | Alters (cross-migration FKs added here) | Depends on |
|---|---|---|---|---|
| 0003 | B | `public_player_profiles`, `player_handle_history`, `growth_campaigns` (no `season_id`), `acquisition_touches` (no `challenge_id`), `experiment_assignments`, `outbox_events`, minimal `game_events` contract additions | none | 0001, 0002 |
| 0004 | F | `result_cards`, `challenges` (no `season_id`), `challenge_attempts` | `acquisition_touches` ADD `challenge_id` FK → `challenges(id)` | 0003 |
| 0005 | G | `seasons`, `season_arenas`, `ranked_attempts`, `ranked_decisions`, `season_results` | `growth_campaigns` ADD `season_id` FK → `seasons(id)`; `challenges` ADD `season_id` FK → `seasons(id)` | 0003, 0004 |
| 0006 | I | `community_links`, later `crews`, `crew_members` | none | 0003 |
| 0007 | J | `product_state_projections` | none | 0001 |

Numbers are indicative of order, not reserved; whichever PR merges first
takes the next number, and the "depends on" column is what must hold. PR B
creates nothing from 0004 onward.

FK dependency review, every future foreign key:

| FK | Target | Target created in | FK added in | Order holds |
|---|---|---|---|---|
| `public_player_profiles.user_id` | `app_users` | 0001 | 0003 | yes |
| `player_handle_history.user_id` | `app_users` | 0001 | 0003 | yes |
| `growth_campaigns.creator_id` | `app_users` | 0001 | 0003 | yes |
| `acquisition_touches.session_id` | `game_sessions` | 0001 | 0003 | yes |
| `acquisition_touches.campaign_id` | `growth_campaigns` | 0003 | 0003 | yes |
| `experiment_assignments.session_id` | `game_sessions` | 0001 | 0003 | yes |
| `result_cards.user_id` | `app_users` | 0001 | 0004 | yes |
| `challenges.creator_user_id` | `app_users` | 0001 | 0004 | yes |
| `challenges.campaign_id` | `growth_campaigns` | 0003 | 0004 | yes |
| `challenge_attempts.challenge_id` | `challenges` | 0004 | 0004 | yes |
| `challenge_attempts.session_id` | `game_sessions` | 0001 | 0004 | yes |
| `acquisition_touches.challenge_id` | `challenges` | 0004 | 0004 (ALTER) | yes |
| `season_arenas.season_id` | `seasons` | 0005 | 0005 | yes |
| `ranked_attempts.season_id` / `.user_id` | `seasons` / `app_users` | 0005 / 0001 | 0005 | yes |
| `ranked_decisions.attempt_id` | `ranked_attempts` | 0005 | 0005 | yes |
| `season_results.*` | `seasons`, `app_users`, `ranked_attempts` | 0005 / 0001 / 0005 | 0005 | yes |
| `growth_campaigns.season_id` | `seasons` | 0005 | 0005 (ALTER) | yes |
| `challenges.season_id` | `seasons` | 0005 | 0005 (ALTER) | yes |
| `community_links.user_id` | `app_users` | 0001 | 0006 | yes |
| `product_state_projections.user_id` | `app_users` | 0001 | 0007 | yes |

In the DDL below, a column marked `-- ADDED IN 0005` (or 0004) is shown for
the target shape only. Do not copy it into the migration that creates the
table.

### 7.1 Public identity

```sql
CREATE TABLE public_player_profiles (
  user_id       uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  handle        text NOT NULL UNIQUE,
  display_name  text,
  avatar_url    text,
  bio           text,
  -- 'friends' is added only when a friend or crew relationship exists and
  -- the API can enforce it. No authorization state ships without semantics.
  visibility    text NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public', 'private')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

```sql
-- Every handle a person has ever held. Tombstone-safe: the handle row
-- survives account deletion (user_id becomes NULL), so a retired handle is
-- never reassigned even after its owner is gone. The profile row itself may
-- cascade with the user; this table never does.
CREATE TABLE player_handle_history (
  handle        text PRIMARY KEY,                -- lowercase, same CHECK as above
  user_id       uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
  held_from     timestamptz NOT NULL DEFAULT now(),
  released_at   timestamptz                      -- null while current
);
```

Route behaviour: while the account exists, an old `/@handle` permanently
redirects to the current handle. If the account has been deleted
(`user_id IS NULL`), the historic handle stays retired and the route returns
a neutral unavailable response (410-style), never a reassignment. A rename
updates `public_player_profiles.handle`, closes the old history row
(`released_at`) and opens the new one in a single transaction.

`player_profiles` (keyed by `session_id`) remains the anonymous progression
record. `public_player_profiles` is the durable social identity. The existing
`player_profiles.handle` column becomes a pre-claim placeholder and is copied,
not moved, at claim time.

**Handle law (ruled).**

- 3 to 20 characters, stored lowercase, ASCII `a-z`, `0-9`, `_`; first and
  last character alphanumeric. Case-insensitive uniqueness follows from
  lowercase storage. Column CHECK: `handle ~ '^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$'`.
- Display name is separate, Unicode-capable, non-unique.
- Reserved identities are dynamic policy in the API, not a CHECK constraint:
  a maintained list of names and prefixes (refi, refitrading, refi_alpha,
  admin, administrator, support, help, security, compliance, moderator,
  staff, official, system, root, api, www, play, season, challenge,
  leaderboard, machine, alpha, paper, managed, signal) plus ReFi-brand
  impersonation patterns.
- Renames allowed, at most once every 30 days, atomically across profile
  and history. A prior handle is never reassigned to another person, during
  or after the account's life; `player_handle_history` keeps the reservation
  with `ON DELETE SET NULL`, and a prior `/@handle` route redirects while the
  account exists and returns a neutral unavailable response after deletion.

### 7.2 Competition

```sql
CREATE TABLE seasons (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  opens_at         timestamptz NOT NULL,
  closes_at        timestamptz NOT NULL,
  manifest_json    jsonb NOT NULL,          -- frozen CompetitiveManifest defaults
  status           text NOT NULL CHECK (status IN ('draft','open','closed','archived'))
);

CREATE TABLE season_arenas (
  season_id  text REFERENCES seasons(id),
  arena_id   text NOT NULL,
  sequence   integer NOT NULL,
  PRIMARY KEY (season_id, arena_id)
);

CREATE TABLE ranked_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id        text NOT NULL REFERENCES seasons(id),
  user_id          uuid NOT NULL REFERENCES app_users(id),
  arena_id         text NOT NULL,
  manifest_json    jsonb NOT NULL,
  -- issued: manifest handed out, nothing committed, consumes nothing.
  -- active: first decision committed; this is the official attempt.
  state            text NOT NULL CHECK (state IN ('issued','active','complete','expired','voided')),
  issued_at        timestamptz NOT NULL DEFAULT now(),
  activated_at     timestamptz,
  expires_at       timestamptz NOT NULL,
  completed_at     timestamptz,
  CONSTRAINT ranked_one_attempt UNIQUE (season_id, user_id, arena_id)
);

CREATE TABLE ranked_decisions (
  attempt_id           uuid REFERENCES ranked_attempts(id) ON DELETE CASCADE,
  checkpoint_sequence  integer NOT NULL,
  decision_json        jsonb NOT NULL,     -- same shape as checkpoint_decisions
  resolution_json      jsonb NOT NULL,     -- server-computed, never client-supplied
  committed_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, checkpoint_sequence)
);

CREATE TABLE season_results (
  season_id        text REFERENCES seasons(id),
  user_id          uuid REFERENCES app_users(id),
  arena_id         text NOT NULL,
  attempt_id       uuid NOT NULL REFERENCES ranked_attempts(id),
  result_state     text NOT NULL CHECK (result_state IN ('WIN','LOSS','TIE','RISK_FAILURE')),
  player_score     numeric(6,2) NOT NULL,
  machine_score    numeric(6,2) NOT NULL,
  score_margin     numeric(6,2) NOT NULL,   -- displayed as fact, never a tier
  max_drawdown     numeric(8,6) NOT NULL,
  turnover_used    numeric(8,6) NOT NULL,
  completed_at     timestamptz NOT NULL,
  PRIMARY KEY (season_id, user_id, arena_id)
);
```

Leaderboards read `season_results`, never raw `arena_runs`, cached
periodically in Postgres. Ranking order (ruled), applied in sequence as
tie-breaks:

1. number of `WIN` results (machines beaten);
2. arenas completed without `RISK_FAILURE`;
3. cumulative eligible score margin versus the machine, where eligible means
   `result_state <> 'RISK_FAILURE'`: a positive margin on a failed run is
   stored as historical truth but never improves this sum;
4. mean ReFi Score;
5. less severe maximum drawdown.

Canonical interpretation of 5, because drawdown is stored as a negative
fraction and "lower" can be implemented backwards: the value closest to zero
ranks higher. -5% outranks -12%. In SQL over `season_results.max_drawdown`
that is `ORDER BY max_drawdown DESC`; equivalently, absolute magnitude
ascending. Both leaderboard read models and any test fixture use this one
reading.

Raw return is not a ranking input (CLAUDE.md §31.3, §61). `RISK_FAILURE` is
never a win regardless of margin. Machine Beat Rate (§31.1) remains a
prestige and profile metric, not the ranking algorithm.

### 7.3 Virality

```sql
CREATE TABLE challenges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,            -- /c/{slug}
  creator_user_id  uuid REFERENCES app_users(id),  -- null for creator campaigns pre-claim
  source_run_id    text,                           -- arena_runs.id or ranked_attempts.id
  arena_id         text NOT NULL,
  season_id        text REFERENCES seasons(id),   -- ADDED IN 0005 (ALTER), not in 0004
  campaign_id      uuid REFERENCES growth_campaigns(id),
  headline_json    jsonb NOT NULL,                 -- scores, max dd, result_state
  expires_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE challenge_attempts (
  challenge_id  uuid REFERENCES challenges(id),
  session_id    text NOT NULL REFERENCES game_sessions(id),
  run_id        text,
  beat_creator  boolean,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  PRIMARY KEY (challenge_id, session_id)
);

CREATE TABLE result_cards (
  slug        text PRIMARY KEY,                   -- /r/{slug}
  run_id      text NOT NULL,
  user_id     uuid REFERENCES app_users(id),
  card_json   jsonb NOT NULL,                     -- rendered server-side for OG
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### 7.4 Attribution and campaigns

```sql
CREATE TABLE growth_campaigns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text NOT NULL UNIQUE,
  kind           text NOT NULL CHECK (kind IN ('creator','partner','paid','organic','internal')),
  creator_id     uuid REFERENCES app_users(id),
  arena_id       text,
  creator_score  numeric(6,2),
  season_id      text REFERENCES seasons(id),     -- ADDED IN 0005 (ALTER), not in 0003
  starts_at      timestamptz,
  ends_at        timestamptz
);

CREATE TABLE acquisition_touches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text NOT NULL REFERENCES game_sessions(id),
  kind          text NOT NULL CHECK (kind IN ('first','meaningful')),
  source        text, medium text, campaign text, content text, term text,
  referrer      text,
  landing_path  text,
  campaign_id   uuid REFERENCES growth_campaigns(id),
  challenge_id  uuid REFERENCES challenges(id),    -- ADDED IN 0004 (ALTER), not in 0003
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
```

Touches are keyed by session, never copied to the user. They resolve through
`game_sessions.user_id`, the same way everything else does.

### 7.5 Community, experiments, projection, outbox

```sql
CREATE TABLE community_links (
  user_id           uuid REFERENCES app_users(id) ON DELETE CASCADE,
  provider          text NOT NULL,                -- 'DISCORD'
  external_user_id  text NOT NULL,
  linked_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider),
  UNIQUE (provider, external_user_id)
);

CREATE TABLE experiment_assignments (
  session_id     text NOT NULL REFERENCES game_sessions(id),
  experiment_id  text NOT NULL,
  variant        text NOT NULL,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, experiment_id)
);

-- §2.3, owned by PR J. One row per user. Coarse by construction: the CHECK
-- is the whole vocabulary and there is no free-text column for a reason to
-- leak into. Upsert only when source_revision increases; source_event_id
-- makes retries idempotent.
CREATE TABLE product_state_projections (
  user_id          uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  state            text NOT NULL CHECK (state IN
                     ('NONE','ALPHA_CANDIDATE','ALPHA_MEMBER','PAPER_READY',
                      'PAPER_ACTIVE','COMMERCIAL_CLIENT','BLOCKED')),
  blocked_category text CHECK (blocked_category IN ('REVIEW','REGION','CLOSED')),
  source_event_id  text NOT NULL UNIQUE,
  source_revision  bigint NOT NULL,
  source_version   text NOT NULL,                 -- projecting service's contract version
  projected_at     timestamptz NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_category_only_when_blocked
    CHECK ((state = 'BLOCKED') = (blocked_category IS NOT NULL))
);

CREATE TABLE outbox_events (
  id           bigserial PRIMARY KEY,
  topic        text NOT NULL,
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
```

Crews (`crews`, `crew_members`) are deferred until challenge virality is
measured (§15, PR I).

**Authorization model (ruled).** The founding schema is provider-neutral on
purpose, and the API is responsible for resolving a verified principal and
scoping every query. That remains the primary model for every table above.
RLS is not reintroduced by default: it may be added later as defence in
depth only if it is keyed to a ReFi-owned server or session principal
context and is integration-tested. `auth.uid()`, Supabase auth-schema
dependencies, or any other vendor identity function never enter the schema.
Public surfaces (`season_results`, `challenges`, `result_cards`,
`growth_campaigns`) are served by API read models that respect
`visibility`. `product_state_projections` is written only by the
`projection-ingest` service (§2.3). The `schema-drift-gate` and
`db/schema.test.ts` cover every migration.

---

## 8. API surface

One deployable. The existing persistence API (`services/persistence-api`,
Cloud Run) grows into a modular monolith. The handoff mint service stays
separate because it holds signing keys with a different blast radius.

```text
/v1
├── healthz, events, progress, tips, guidance, daily-tape,
│   runs, machine-versions                       (existing)
├── identity     POST claim, GET me, POST link-session
├── profiles     GET /profiles/{handle}, PATCH /profiles/me
├── ranked       §5
├── seasons      GET /seasons/current, GET /seasons/{id}/leaderboard
├── challenges   POST /challenges, GET /c/{slug}, POST /c/{slug}/attempts
├── cards        GET /r/{slug}  (OG HTML + JSON)
├── growth       POST /touches, GET /experiments/assignments
├── community    POST /community/discord/link, GET /community/roles
└── handoffs     POST (existing mint service, proxied or called directly)
```

The product-state projection is **not** a route on this API. It arrives at a
separate private Cloud Run service, `projection-ingest` (§2.3, PR J), because
this API is public by design and `x-alpha-session` is continuity, not
authentication.

Split a module into its own service only when scale forces it. Async work
(Discord role sync, card rendering, analytics forwarding, email, campaign
reports) goes through `outbox_events` consumed by a Cloud Run worker, never
inline in a game request.

---

## 9. URL structure

```text
game.refi.trading/                       landing (attract)
game.refi.trading/play/{arenaId}         practice, deep-linkable
game.refi.trading/c/{slug}               challenge landing → PLAY THIS ARENA
game.refi.trading/r/{slug}               result card, server-rendered OG
game.refi.trading/@{handle}              public profile
game.refi.trading/season                 current season + leaderboard
game.refi.trading/season/{id}
game.refi.trading/challenge/{campaign}   creator campaign landing
game.refi.trading/machine                Machine Builder
game.refi.trading/alpha                  Alpha CTA surface → handoff
```

Attribution parameters accepted on any entry URL:
`utm_source utm_medium utm_campaign utm_content utm_term ref aid creator
challenge_id referral_code`. First touch is already captured once and never
overwritten (`captureFunnelAttribution`). Add a second capture, kind
`meaningful`, on the touch immediately preceding the claim event.

Share cards and challenge links land on the arena, never the homepage.

---

## 10. Result states (ruled, §17.1)

Four canonical competitive result states. No margin-driven tiers of any kind.

```ts
type ResultState =
  | 'WIN'           // player ReFi Score > machine ReFi Score, no critical risk failure
  | 'LOSS'          // player ReFi Score < machine ReFi Score, no critical risk failure
  | 'TIE'           // equal scores; the machine was not beaten
  | 'RISK_FAILURE'; // critical risk threshold crossed; overrides the score result
```

Rules:

- Score margin is displayed as a plain number. It never selects copy, audio,
  animation or typography. A one point loss and a fifteen point loss receive
  the identical LOSS treatment (CLAUDE.md §61A).
- `TIE` is not a machine beat. The pass rule is strictly greater (§29.2), and
  Machine Beat Rate (§31.1) counts only `WIN`.
- `RISK_FAILURE` overrides the score for arena clear, leaderboard win and
  Machine Beat Rate purposes, whatever the margin.
- No near-miss copy, no escalating audio, no "so close", no manufactured
  urgency. Feel comes from clarity, consequence, progression, typography,
  animation of what actually happened, autopsy and unlocks.

Presentation is where the drama lives, and it is the same drama at every
margin:

```text
WIN                             LOSS                            TIE

YOU BEAT THE MACHINE            THE MACHINE WON                 SCORE TIED

76 / 71                         70 / 71                         71 / 71

COVID SURVIVED                  ARENA SURVIVED                  ARENA SURVIVED
MAX DRAWDOWN   -8.4%            MACHINE NOT BEATEN              MACHINE NOT BEATEN
TURNOVER       41%
SEASON         2 / 5

[SEE WHY]                       [SEE WHERE IT WON]              [SEE THE SPLIT]
[NEXT REGIME]                   [NEXT REGIME]                   [NEXT REGIME]
[CHALLENGE SOMEONE]             [RUN AGAIN IN PRACTICE]         [RUN AGAIN IN PRACTICE]

RISK_FAILURE

NOT CLEARED
DRAWDOWN EXCEEDED -20% AT CP09
```

Arena clear and machine beat are different achievements (ruled, confirming
CLAUDE.md §29.2): a completed run inside the critical risk limit has
survived the arena even when the machine wins. Progression is never
redefined to require a machine beat merely to complete an arena; the beat is
the higher-status competitive result. LOSS reads `THE MACHINE WON / ARENA
SURVIVED / MACHINE NOT BEATEN`. TIE reads `SCORE TIED / ARENA SURVIVED /
MACHINE NOT BEATEN`: it is never labelled a machine victory, because that
would be false, and it still counts toward neither Machine Beat Rate nor
leaderboard wins. Only `RISK_FAILURE` reads `NOT CLEARED`. The score
separator is a slash because the em-dash gate bars that character in player copy.

`ResultState` replaces the `outcome_tier` idea everywhere: `season_results`,
share cards, challenge headlines, profile history, achievements.

---

## 11. Event taxonomy

Extend `GameEventType` in `src/lib/events.ts`. Keep the §51 envelope. All
tracking goes through one typed function; no component calls an analytics SDK
directly. Add `event_version` and `experiment_assignments` to the envelope.

```text
LANDING      landing.viewed  campaign.attributed  challenge.opened
ACTIVATION   arena.started*  decision.committed*  checkpoint.resolved  arena.passed* / arena.failed*
IDENTITY     profile.claim_prompted  profile.claim_started  profile.claimed  handle.created
VIRAL        result.share_opened  result.shared  challenge.created  challenge.clicked  challenge.completed
RETENTION    arena.selected  session.resumed*  daily_tape.completed  season.entered
MASTERY      arena.machine_beaten*  risk.critical_failure  machine.builder_started
             machine.compiled  machine.locked  machine.deployed  gauntlet.completed
COMPETITION  ranked.attempt_issued  ranked.attempt_activated  ranked.decision_committed
             ranked.attempt_completed  ranked.attempt_voided
COMMUNITY    community.discord_link_started  community.discord_linked  crew.joined  challenge.friend_sent
ALPHA        conversion.alpha_cta_seen  conversion.alpha_cta_clicked  conversion.refi_handoff_started*
             conversion.paper_cta_viewed*  conversion.paper_started*  projection.received
```

`*` already emitted today. Game analytics and formal investor actions remain
separate taxonomies (CLAUDE.md §52). The `game_events` sink is append-only.

Conversion event context. Every `conversion.*` event carries, in its
payload, enough non-sensitive context to compare qualified against early
converters later:

```ts
interface ConversionContext {
  qualified: boolean;            // §12 law at the moment of the event
  arenasCompleted: number;
  machineLocked: boolean;
  competitor: boolean;           // §3 domain B
  gameIdentity: 'VISITOR' | 'ANONYMOUS_PLAYER' | 'CLAIMED_PLAYER';
  acquisitionCohort?: string;    // first-touch campaign or creator slug, no PII
  projection?: ProjectionState;  // §2.3 value if bound, else omitted
}
```

`conversion.alpha_cta_seen` records what the UI showed.
`conversion.refi_handoff_started` records what the user did. Neither creates
state. Nothing here touches the formal-advisory data boundary (§2.2).

Destination: `/v1/events` (existing) → first-party `game_events` → forwarded
to the product-analytics destination via the outbox. The analytics vendor is
a destination, not a store. Nothing from KYC, brokerage, suitability or
formal compliance answers enters product analytics, and the vendor name never
appears in game code (`vendor-gate`, `db/README.md`).

---

## 12. North Star, funnel, leaderboard honesty

North Star: **Qualified Alpha Players**, not DAU, sessions, trades or screen
time.

```text
QUALIFIED ALPHA PLAYER =
  claimed identity
  AND completed ≥ 3 meaningful arenas
  AND returned on ≥ 2 separate days
  AND (reviewed ≥ 1 autopsy OR locked ≥ 1 machine)
```

Funnel with a conversion rate between every adjacent pair:

```text
VISITOR → GAME START → FIRST DECISION → FIRST ARENA COMPLETE → PROFILE CLAIMED
→ SECOND SESSION → CHALLENGE SENT → 3 ARENAS COMPLETE → MACHINE LOCKED
→ ALPHA CTA SEEN → ALPHA HANDOFF → PAPER CONNECTED → PAPER RETAINED → REFI CLIENT
```

Loop metrics:

| Loop | Metric |
|---|---|
| Viral | shares per activated player × share click rate × new-player completion rate |
| Identity | claimed profiles / first arena completions |
| Retention | players returning for another arena / first arena completions |
| Mastery | machine builders / claimed players |
| Alpha intent | handoffs / machine builders |
| Product activation | PAPER_ACTIVE projections / handoffs |

Stages 7 to 9 are measured from the §2.3 projection.

Leaderboard honesty (ruled, §17.5):

- The public leaderboard launches with the first production Ranked Season.
  Not earlier, not months later.
- Rank always shows its denominator: `#7 OF 38`. Never imply scale.
- No percentile language until the relevant population has at least
  **100 verified ranked players**.
- Before Ranked exists, surfaces show personal records and challenge results.
  No provisional or fake global leaderboard.
- Only server-verified ranked results enter competitive leaderboards.

---

## 13. Experiments

A/B test freely: landing hero, start CTA, first-run tutorial, save-rank copy,
claim timing, share CTA, challenge CTA, Discord CTA, Machine Builder
invitation, Alpha CTA.

Never A/B test inside a live ranked season: scoring weights, turnover rules,
drawdown limit, machine behaviour, checkpoint returns, arena difficulty.

Assignments are sticky to `session_id` and resolve to the user through the
session link, so claiming an identity never changes a cohort.

---

## 14. Compliance rules for the growth layer

Restating what already binds, because the growth layer is the pressure point.

1. Rank rewards disciplined decisions, never transactions. No XP per trade, no
   streak for consecutive trade days, no turnover prize, no "trade now".
   (CLAUDE.md rule 6, §61A. The existing Daily Tape streak counts attendance
   with HOLD as full credit and stays.)
2. Every performance surface renders exactly one `RESULT_CATEGORY` label
   (`label-gate`). Share cards and challenge landings are performance
   surfaces and are registered with the gate.
3. Benchmarks render from `BenchmarkSnapshot` records only (rule 14).
4. Gameplay never writes to advisory fields. `alpha_profile_dimensions` is
   never exported (rule 11, §2.2 here).
5. Handoff tokens are opaque, single-use, ≤ 600 s, and carry no profile fields
   in the URL (§4.4).
6. No in-app social feed until PR I has produced usage evidence. Feeds bring
   moderation, financial-promotion and abuse obligations the team is not
   resourced for.
7. Discord roles are derived from ReFi achievements. Discord never writes back.
8. The product-state projection is the only data that flows from the investor
   product into the growth plane, and its vocabulary is the CHECK constraint
   in §7.5.
9. Any proposal adding a reward schedule, urgency device or activity incentive
   is rejected by §61A rather than debated.
10. Standard and Challenge play never lock a stance behind a resource meter.
    The turnover allowance is scored, not enforced (2026-09-13 ruling, applied
    in the engine the same day). Hard action budgets belong to Iron Mode
    (CLAUDE.md §7.4) and to nothing else.

---

## 15. Build sequence (ruled)

Ten PRs, each in its own risk domain. If B breaks it cannot change scoring.
If C breaks it cannot mutate the growth schema. If Ranked has an exploit,
Practice is untouched. The funnel is measurable before community
infrastructure is paid for.

| PR | Name | Scope | Schema it owns | Explicitly excluded | Transition |
|---|---|---|---|---|---|
| A | ARCHITECTURE LAW | this document, rulings incorporated | none | any runtime or schema change | all |
| B | GROWTH DATA FOUNDATION | schema tests, event/attribution contracts, public profile and handle primitives | 0003: `public_player_profiles`, `player_handle_history`, `growth_campaigns` (no `season_id`), `acquisition_touches` (no `challenge_id`), `experiment_assignments`, `outbox_events`, minimal `game_events` additions | seasons, ranked, challenges, cards, community, projection tables; leaderboard UI; any engine change | measurement |
| C | GAME CORE BOUNDARY | incremental pure-engine extraction with replay parity | none | any behaviour change | integrity |
| D | GROWTH TELEMETRY | typed emitter, conversion context, first and meaningful touch, funnel instrumentation | none | new UI | measurement (domain C) |
| E | CLAIMED PLAYER IDENTITY | handle claim, reserved-name policy, public profile, session → user binding, atomic rename, redirect and 410 | none (uses 0003) | KYC, ranked | A: ANONYMOUS_PLAYER → CLAIMED_PLAYER |
| F | RESULT + SHARE + CHALLENGE | `ResultState`, result screens, `/r/{slug}`, `/c/{slug}` | 0004: `result_cards`, `challenges` (no `season_id`), `challenge_attempts`; ALTER `acquisition_touches` ADD `challenge_id` | leaderboard | A: VISITOR → ANONYMOUS_PLAYER → CLAIMED_PLAYER |
| G | RANKED SERVER | season manifest, sequential reveal, attempt lifecycle, server replay | 0005: `seasons`, `season_arenas`, `ranked_attempts`, `ranked_decisions`, `season_results`; ALTER `growth_campaigns` and `challenges` ADD `season_id` | public leaderboard | B: + COMPETITOR |
| H | VERIFIED LEADERBOARD | `season_results` read models, ruled ranking order, denominator, percentile gate | none (uses 0005) | anything not server-verified | B retention |
| I | COMMUNITY | Discord binding and roles; crews only if F data supports it | 0006: `community_links`, later `crews`, `crew_members` | feed | B retention |
| J | MACHINE → ALPHA | executable deployed machine, handoff surfaces, `projection-ingest` service, CTA routing | 0007: `product_state_projections` | advisory import | B: + MACHINE_BUILDER; D: NONE → ALPHA_* |

A is a prerequisite for everything. B, C and D may run in parallel branches
once A lands and the owner has reviewed it. The 2026-09-13 turnover-lockout
fix is not part of this sequence; it ships on its own as a game-correctness
PR.

---

## 16. ICP

Behavioural, not demographic:

> The self-directed market participant who believes they have investment
> skill but has experienced enough volatility to recognise that discipline,
> sizing, execution and consistency are harder than finding ideas.

Likely 22 to 40, owns stocks, has a brokerage account, consumes finance media
on YouTube / X / Reddit / Discord / TikTok, interested in AI, sceptical of
black-box robo-advisers, enjoys competition, has made a bad decision, thinks
their judgement has value, does not want to surrender control immediately.

Do not tell this person they are bad at trading. Let them try to prove they
are good. `THINK YOU CAN BEAT THE MACHINE?` earns the right to challenge that.

Positioning against Robinhood Social: their social object is *what did you
trade*. Ours is *how well does your process survive*.

---

## 17. Owner rulings, 2026-09-13

| ID | Ruling | Encoded in |
|---|---|---|
| 17.1 Result states | No PHOTO_FINISH, no margin-based tiers of any kind. Canonical `WIN`, `LOSS`, `TIE`, `RISK_FAILURE`. Margin shown as fact only. `TIE` is not a beat. `RISK_FAILURE` overrides score. | §10, §7.2 `result_state` |
| 17.2 Ranked attempts | Unlimited Practice. One official attempt per arena per user per season. Attempt begins at first committed decision. Disconnect does not consume it; server run resumes. Post-completion plays are Practice. No best-of-N in v1. | §4, §5, §7.2 `issued` → `active` |
| 17.3 Ranked identity | Ranked requires a claimed lightweight identity via `game_sessions → app_users → user_identities`. No KYC, brokerage, admission, subscription or formal onboarding. Practice stays anonymous. Claim is value-led, after a result. | §2.1, §4 |
| 17.4 Game-core | Incremental extraction only, behaviour-preserving, replay parity proven per PR, never mixed with behaviour changes. Order: allocation, scoring, run, replay, contracts → machine policy → rest. | §6, PR C |
| 17.5 Leaderboard | Public with the first production Ranked Season. Denominator always shown. No percentiles under 100 verified ranked players. Records and challenges before Ranked exists. Server-verified results only. | §12 |
| 17.6 Projection | One-way coarse product-state projection after identity binding: `NONE, ALPHA_CANDIDATE, ALPHA_MEMBER, PAPER_READY, PAPER_ACTIVE, COMMERCIAL_CLIENT`, plus `BLOCKED` with a coarse category only. Keyed to `user_id`, never the session header. Nothing sensitive crosses. | §2.3, §3, §7.5, §8 |
| 17.7 Hosting | Vercel frontend, Google Cloud API / verifier / handoff / Cloud SQL / workers / Terraform. No frontend migration. Revisit only on a concrete security, procurement, cost, latency or operational reason. | §8 |

### 17.8 Superseded from the draft

- "One restart permitted before the first committed decision" is replaced by
  the `issued` state: nothing before the first commit consumes anything.
- `OutcomeTier` and the six-band enum are removed in favour of `ResultState`.
- The single combined "step 1" PR is replaced by A, B and C as separate PRs.
- The draft named `turnoverBudget` in the manifest; it is `turnoverAllowance`
  to match the engine's scored-not-enforced semantics.

### 17.9 Contradictions these rulings surface elsewhere

1. **Arena clear vs machine beat (CLAUDE.md §29.2).** RESOLVED by owner
   ruling (§17.11.1): the existing model stands. Surviving the risk limit
   clears the arena; the machine beat is the higher-status result. §10
   carries the copy. `progressionLaw.hasBronzeRun` is unchanged.
2. **ALPHA_CANDIDATE ownership.** RESOLVED: the game-side state is
   `QUALIFIED`, derived from the §12 law alone (§17.11.2).
3. **CLAUDE.md §7.4 Iron Mode "limited action budget".** Consistent with the
   rulings, but the engine until 2026-09-13 applied a hard budget in standard
   play. Fixed the same day; §14.10 records the boundary. CLAUDE.md itself
   does not need to change.
4. **CLAUDE.md §66 "Progression gating: Gold-only machine beat; Bronze/Silver/
   Gold model".** Still open in CLAUDE.md. Rulings 17.1 and 17.5 assume the
   Bronze/Silver/Gold model. If Gold-only is ever chosen, §10 copy and
   `season_results` semantics change.
5. **Daily Tape streak (CLAUDE.md §61A).** The growth plan said "no streak
   for consecutive trade days". §61A's Daily Tape streak counts attendance
   with HOLD as full credit and rewards no trading. Not a contradiction;
   noted so no one removes it by mistake.

### 17.10 Remaining inputs

Nothing blocks PR B. Both former blockers were ruled on 2026-09-13: the
handle law is in §7.1 and the projection transport is locked in §2.3 and
lands in PR J, outside B's scope.

| Input | Needed before | Why |
|---|---|---|
| Season 1 arena list and duration | PR G | Seed data, not schema. |
| Identity provider for the claim flow (magic link, existing product auth) | PR E | The schema is provider-neutral (`user_identities.provider`). |
| Whether `BLOCKED` ships in v1 | PR J | The CHECK already admits it; omitting it from the product's projection contract costs nothing. |
| Initial reserved-name list beyond the seed in §7.1 | PR E | Dynamic policy in the API, not schema. |

No unresolved architecture issue blocks PR B after the §17.12 pass.

### 17.11 Corrections from owner review of PR #78, 2026-09-13

1. **Arena clear vs machine beat.** Existing model confirmed. WIN `YOU BEAT
   THE MACHINE`; LOSS and TIE `ARENA SURVIVED / MACHINE NOT BEATEN`;
   RISK_FAILURE `NOT CLEARED`. Progression never requires a beat to complete
   an arena. (§10)
2. **QUALIFIED.** Name kept. Derived solely from the §12 law; never from
   `conversion.alpha_cta_seen`, which is emitted downstream when the
   qualifying surface renders. States 6 to 9 are literal projection reads;
   REFI PROSPECT demoted to a possible derived segment. (§3)
3. **Just-in-time schema.** §7 is a target, not one migration. PR B creates
   only the growth foundation D and E need; every other table lands with its
   owning PR as an additive migration. Projection transport is therefore not
   a B blocker. (§7 ownership table, §15)
4. **Projection transport.** Locked: PUSH, private Cloud Run
   `projection-ingest`, OIDC ID token from a dedicated service account with
   Invoker only, no downloaded keys, WIF if ever off-GCP, monotonic
   `sourceRevision`, idempotent `sourceEventId`, binding resolved before any
   write. Not a route on the public persistence API. Implemented in J.
   (§2.3, §7.5, §8)
5. **Handle law.** 3 to 20 chars, lowercase, `[a-z0-9_]`, alphanumeric ends,
   CHECK regex; reserved names as dynamic policy; renames once per 30 days;
   old handles never reassigned and permanently redirected via
   `player_handle_history`; display name separate; no mandatory
   country/region at claim. (§2.1, §7.1)
6. **Leaderboard order.** Wins, then arenas completed without RISK_FAILURE,
   then cumulative eligible margin (RISK_FAILURE margins excluded), then mean
   ReFi Score, then less severe maximum drawdown. Machine Beat Rate is a profile
   metric. (§7.2)
7. **Authorization model.** API-resolved principal and query scoping remain
   primary. No default RLS reintroduction; RLS only later as tested defence
   in depth keyed to a ReFi-owned principal; no `auth.uid()` or vendor auth
   schema in the provider-neutral database. (§7.5)

### 17.12 Corrections from the second owner review of PR #78, 2026-09-13

1. **Orthogonal state domains.** The linear 0 to 9 lifecycle is replaced by
   four independent domains: A game identity, B progression and
   achievements (a set), C QUALIFIED as a derived segment, D product
   projection. No fixed advance order is assumed. (§0, §3, §15)
2. **Cross-migration foreign keys.** `growth_campaigns.season_id`,
   `challenges.season_id` and `acquisition_touches.challenge_id` are added by
   ALTER in the migration that creates their target (0005, 0005, 0004). Full
   FK dependency review recorded; target DDL labels late-added columns. (§7)
3. **Handle retention on deletion.** `player_handle_history.user_id` is
   nullable with `ON DELETE SET NULL`; the handle row is permanent. Redirect
   while the account lives, neutral 410-style response after deletion,
   rename atomic across profile and history. (§7.1)
4. **TIE presentation.** `SCORE TIED / ARENA SURVIVED / MACHINE NOT BEATEN`;
   never `THE MACHINE WON`. Still no beat, no leaderboard win. (§10)
5. **CTA routing.** One row per projection value including `PAPER_READY`
   and a distinct `ALPHA_CANDIDATE` continuation; never collapsed. (§2.3)
6. **Handoff and binding order.** Mint → product consumes → verified product
   principal → bind `app_users.id` ↔ product `user_id` → eligibility,
   consents, KYC, compliance, membership → admission → brokerage/paper →
   projection. Binding precedes any admission-dependent projection. (§2.2)
7. **Drawdown tie-break.** "Less severe maximum drawdown", stored negative,
   closest to zero wins, `ORDER BY max_drawdown DESC`. (§7.2)
8. **Profile visibility.** 0003 ships `public` and `private` only; `friends`
   arrives with an enforceable relationship. (§7.1)
9. **Conversion triggers vs qualification.** Three separate concepts: direct
   entry always available, contextual prompts on intent milestones, QUALIFIED
   as the North Star cohort. `alpha_cta_seen` and `refi_handoff_started` are
   telemetry carrying `ConversionContext`; neither is gated by QUALIFIED.
   Formal-advisory boundary unchanged. (§2.2, §3, §11)
