// Application composition adapter. The engine lives in packages/game-core.
//
// This is deliberately not a pure re-export shim, and the one extra line is
// the point of PR C2.
//
// The core engine reads arenas out of a registry it does not populate. The
// authored arena modules populate it as a side effect of being imported, and
// that side effect is composition: a decision about which content this
// application runs, which is exactly the kind of decision a deterministic
// rules package must not make for its callers. A server-side verifier
// recomputing a ranked attempt (REFI_ALPHA_GROWTH_ARCHITECTURE.md §6) composes
// a different, versioned set; if the package imported the arena index the
// verifier would inherit this application's content whether it wanted it or
// not, along with two thousand lines of COVID narrative.
//
// So the package stays content-free and the composition happens here, once, in
// front of the re-export. Every application module that imports the engine
// through this path gets the production arenas registered before any of its
// own code runs, which is the behaviour it had before the extraction.
import './arenaIndex';

export * from '../../packages/game-core/src/runEngine';
