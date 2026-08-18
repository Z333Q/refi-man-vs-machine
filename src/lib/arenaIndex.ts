// ─── Arena index ──────────────────────────────────────────────────────────────
//
// Importing an arena module is what registers it. Collecting those imports in
// one place means the engine depends on "the arenas" rather than on any
// particular one, and adding a regime is a file plus a line here.
//
// Kept separate from arenas.ts to avoid a cycle: each arena module imports
// `registerArena` from there.

import './covidArena';
import './recoveryArena';
import './inflationArena';
import './bankingArena';
import './tacoArena';
