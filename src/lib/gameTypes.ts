// Compatibility shim. The implementation lives in packages/game-core.
//
// The module moved to the deterministic core (PR C1) so a server-side
// verifier can run the same rules the browser ran. This file exists so the
// move did not require rewriting every import in the application at the same
// time, which would have buried a behaviour-preserving extraction inside a
// large diff.
//
// It re-exports and nothing else. There is one implementation of every rule
// here: no copied constants, no parallel types, no second version of a
// scoring function that drifts from the first. scripts/game-core-gate.mjs
// fails the build if this file grows logic.
export * from '../../packages/game-core/src/types';
