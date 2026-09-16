// Compatibility shim. The implementation lives in packages/game-core.
//
// The registry moved to the deterministic core (PR C2) so a server-side
// verifier can run the same rules the browser ran. What did NOT move is
// registration: the five authored arena modules stay in this directory and
// register themselves through this contract. The package owns the rules and
// the content contract; the application supplies the content.
//
// It re-exports and nothing else. There is one implementation of every rule
// here: no copied constants, no parallel types, no second version of a
// scoring function that drifts from the first. scripts/game-core-gate.mjs
// fails the build if this file grows logic.
export * from '../../packages/game-core/src/arenas';
