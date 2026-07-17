// Result-category labels (USA Build Integration Spec §3.4 gate 1, CLAUDE.md §62).
//
// Every chart / performance component must render exactly one of these
// categories so a viewer can never mistake a historical simulation for
// live client performance. The four canonical strings below are the
// §3.4 CI-authoritative set; `scripts/label-gate.mjs` fails the build if
// a registered performance component renders zero — or more than one —
// of them.
//
// Keep this list and the four §3.4 strings in lockstep: the gate reads
// the KEYS from here, and the rendered copy from the VALUES.

export const RESULT_CATEGORY = {
  HISTORICAL_MARKET_DATA: 'HISTORICAL MARKET DATA',
  SIMULATION_RESULT: 'SIMULATION RESULT',
  HISTORICAL_MODEL_SIMULATION: 'HISTORICAL MODEL SIMULATION / NOT LIVE CLIENT PERFORMANCE',
  PAPER_TRADING_RESULT: 'PAPER TRADING RESULT',
} as const;

export type ResultCategory = keyof typeof RESULT_CATEGORY;
