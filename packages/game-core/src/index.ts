// ReFi Alpha game core: the rules, with nothing around them.
//
// Everything in this package is deterministic and environment-free. Given the
// same inputs it returns the same outputs on a laptop, in a browser tab, and
// in a server-side verifier that has to recompute a ranked attempt without
// trusting the client that played it (REFI_ALPHA_GROWTH_ARCHITECTURE.md §6).
// That last consumer is the whole reason the boundary exists: a rule the
// server cannot recompute is a rule the server has to take on faith.
//
// The boundary is enforced, not merely described. scripts/game-core-gate.mjs
// fails the build if anything here reaches for React, the DOM, storage, the
// network, persistence, telemetry, or an ambient clock or random source.
//
// Extraction is incremental (PR C track). This is the first cluster: the
// domain contract, the decision contract, allocation arithmetic and scoring.
// runEngine, the arena registry and machine policy follow in later slices.

export * from './types';
export * from './decisionContract';
export * from './allocation';
export * from './scoringEngine';
