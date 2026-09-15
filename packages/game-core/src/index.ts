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
// Extraction is incremental (PR C track). C1 took the domain contract, the
// decision contract, allocation arithmetic and scoring; C2 adds the arena
// registry, the machine policy and the run engine, which completes the
// deterministic engine.
//
// What deliberately stays outside is the authored content. The five arena
// modules are two thousand lines of narrative, signals and branches, and they
// are not rules — they are the material the rules run on. The package defines
// the ArenaDefinition contract and the registry; the application composes the
// content into it. That keeps the dependency one-way and keeps the package a
// thing a verifier can load, rather than a thing that carries a game's script
// around with it.

export * from './types';
export * from './decisionContract';
export * from './allocation';
export * from './scoringEngine';
export * from './arenas';
export * from './machinePolicy';
export * from './runEngine';
