# `@refi/game-core`

Deterministic ReFi Alpha rules, with no environment around them.

`lib: ["ES2020"]` and no `DOM` is not a style choice. It is the boundary made
structural: a file here that touches `window`, `document` or `localStorage`
does not type-check, before any gate runs.

## What is here

```
types.ts             the shared domain contract
decisionContract.ts  action, thesis and conviction law
allocation.ts        allocation arithmetic
scoringEngine.ts     the ReFi Score components
```

## What may never be here

React, the DOM, storage, `fetch`, persistence, auth, telemetry, handoff, a
database client, or any network service. Nor ambient nondeterminism:
`Math.random`, `Date.now`, `new Date()` as an input, `crypto.randomUUID`. Time
and randomness arrive as arguments or they do not arrive.

`npm run game-core-gate` fails the build on any of that, and on any import
that points back into `src/`. The dependency runs one way.

## Consumers

The app imports through thin re-export shims in `src/lib`, so application code
did not have to be rewritten when the modules moved. There is one
implementation of every rule; the shims contain no logic.
