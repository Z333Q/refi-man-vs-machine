# `db/`

Provider-neutral PostgreSQL for ReFi Alpha.

Nothing here names an identity vendor, an auth schema, or a hosting product.
The schema runs on Cloud SQL, on another managed PostgreSQL, or on a laptop,
and the application does not know which.

## Applying it

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_founding_schema.sql
```

`0001` is a founding schema, not a step in a chain: it is applied to an empty
database. The migrations it replaces depended on a vendor's auth schema and
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

## Authorization lives in the API

There are no row-level policies. The service resolves the principal, maps it to
a user, and scopes every query. Row-level security is ordinary PostgreSQL and
stays available as defence in depth, but it would key on a ReFi-owned session
variable set by the API rather than on a vendor's function.

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
