# `db/`

Provider-neutral PostgreSQL for ReFi Alpha.

Nothing here names an identity vendor, an auth schema, or a hosting product.
The schema runs on Cloud SQL, on another managed PostgreSQL, or on a laptop,
and the application does not know which.

## Applying it

```sh
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

`0001` is a founding schema: it is applied to an empty database. Later files
are additive steps applied in order after it, each written to be re-runnable
(`ADD COLUMN IF NOT EXISTS`), so applying the whole directory to a database at
any earlier step is safe. Both database suites apply the whole directory.

A service that writes a new record version ships with the migration that
stores it, and the migration is applied to production **before** the service
is deployed: the service reads and writes the new columns on its first
request. `src/lib/persistence/wireVersions.test.ts` fails the client suite when
the client's record version runs ahead of the server's. The migrations it replaces depended on a vendor's auth schema and
guarded prototype data that was disposable, and in practice empty, because
every write the browser could make was rejected by policies the game could not
satisfy.

## Identity is three tables

```
app_users            the person
  └── user_identities   each way they can sign in (google, password, saml.acme)
game_sessions        a browser playing, with or without an account
  └── user_id           set when the player links, null while they have not
```

One person can hold several logins. A session owns progress before any account
exists, and linking is an explicit act that copies nothing. A player can finish
the whole game without signing up: that is the conversion design, not a
degraded mode.

## `x-alpha-session` is continuity, not authentication

The session id is generated in the browser, is not a secret, and proves nothing
about who holds it. It may scope anonymous progress. Once an account exists,
anything that matters resolves the principal from a verified token and uses
`app_users.id`; trusting the header instead would let any caller name any
session.

## Growth foundation (`0003`)

Six tables that no screen reads yet. They exist before the features that need
them so nothing has to be reconstructed from memory later.

```
public_player_profiles   the durable public identity of a claimed player
  └── cascades with the user
player_handle_history    every handle ever held. Never cascades.
growth_campaigns         how a link was minted
acquisition_touches      how a session arrived (first) and what made it stick
experiment_assignments   sticky per session, so claiming never moves a cohort
outbox_events            work that must survive the process that should do it
```

Two rules in that list are not obvious from the DDL:

- **A retired handle is never reassigned.** `player_handle_history.handle` is
  the primary key and it is permanent; `user_id` is nullable and
  `ON DELETE SET NULL`. Deleting an account empties the row without releasing
  the name, which is what lets a dead `/@handle` answer with a neutral
  unavailable response instead of being handed to the next person who asks.
  The profile itself cascades; the reservation does not.
- **Attribution is session-scoped and never copied to the user.** It resolves
  through `game_sessions.user_id`, so claiming an identity cannot rewrite how
  the player arrived. `acquisition_touches` deliberately has no `user_id`
  column, and a partial unique index makes a session unable to acquire a
  second first touch.

Migrations are owned per PR (`docs/REFI_ALPHA_GROWTH_ARCHITECTURE.md` §7), so
a column whose target table arrives later is added by `ALTER` in the migration
that creates that target, never written forward into an earlier file.
`npm run schema-drift-gate` fails on any foreign key that does not resolve in
migration order.

## Authorization lives in the API

There are no row-level policies. The service resolves the principal, maps it to
a user, and scopes every query. Row-level security is ordinary PostgreSQL and
stays available as defence in depth, but it would key on a ReFi-owned session
variable set by the API rather than on a vendor's function.

## The rule for service SQL

Every SQL query a production service issues must have at least one integration
test against `0001_founding_schema.sql`, not only a mocked `Queryable`.

A mock agrees with whatever SQL it is handed, so it cannot tell you the schema
moved underneath it. That is not theoretical: the handoff service counted a
player's machine versions through a link table this schema does not have, and
because those reads fail soft to zero, nothing crashed. Every token would have
carried `machineVersionCount: 0` for exactly the players who had built the
most.

Two layers enforce it:

- `npm run schema-drift-gate` fails if any table a service references is absent
  from the schema. It is static and takes a second, so it catches drift while
  the change is being written.
- The integration tests catch what table names cannot: wrong columns, wrong
  joins, wrong filters, wrong results.

## Tests

`db/schema.test.ts` runs against a real PostgreSQL and is skipped when
`DATABASE_URL` is unset:

```sh
DATABASE_URL=postgresql://... npm run test:schema
```

It checks what only a database can: that anonymous play works, that linking
keeps what was already there, that one person can hold several logins, that
closing an account does not delete the play behind it, and that deleting a
session does.
