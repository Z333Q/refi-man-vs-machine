// ─── Tip system types ─────────────────────────────────────────────────────────

export type TipType = 'SPOTLIGHT' | 'FIRST_EVENT' | 'DECISION' | 'CONCEPT' | 'PROGRESSION';
export type TipState = 'UNSEEN' | 'SHOWN' | 'SNOOZED' | 'DISMISSED' | 'COMPLETED';
export type GuidanceMode = 'FULL' | 'STANDARD' | 'MINIMAL' | 'OFF';

export type TipTriggerEvent =
  | 'game.first_entry'
  | 'tutorial.first_signal'
  | 'tutorial.portfolio_open'
  | 'tutorial.stance_selected'
  | 'tutorial.review_ready'
  | 'tutorial.first_commit'
  | 'tutorial.machine_reveal'
  | 'tutorial.first_score'
  | 'tutorial.hold_available'
  | 'arena.covid_enter'
  | 'arena.correlation_spike'
  | 'arena.cash_raised'
  | 'arena.large_reduction_proposed'
  | 'arena.staged_execution_unlocked'
  | 'arena.economy_diverges_from_market'
  | 'module.correlation_matrix_unlocked'
  | 'module.regime_scanner_unlocked'
  | 'module.machine_audit_unlocked'
  | 'machine.first_machine_win'
  | 'machine.first_human_checkpoint_win'
  | 'machine.first_arena_win'
  | 'risk.drawdown_warning'
  | 'risk.first_risk_contribution_view'
  | 'decision.first_hold';

export interface TipAction {
  label: string;
  action: 'DISMISS' | 'COMPLETE' | 'SNOOZE' | 'OPEN_PORTFOLIO' | 'OPEN_RISK' | 'OPEN_DECIDE' | 'OPEN_SIGNAL' | 'TRY_HOLD';
}

export interface TipDef {
  code: string;
  type: TipType;
  title: string;
  body: string[];
  trigger: TipTriggerEvent;
  priority: number;
  blocking: boolean;
  maxShowCount: number;
  requiredMode: GuidanceMode;
  actions: TipAction[];
  spotlight?: string;
}

// ─── Priority constants ────────────────────────────────────────────────────────
// 100 = safety/blocking control
// 90  = required gameplay understanding
// 80  = new mechanic
// 70  = risk concept
// 60  = first event
// 50  = new module
// 40  = educational concept
// 30  = optional discovery

export const TIP_LIBRARY: TipDef[] = [

  // ─── First-run sequence ────────────────────────────────────────────────────

  {
    code: 'FIRST_RUN_01_OBJECTIVE',
    type: 'CONCEPT',
    title: 'WELCOME TO REFI ALPHA',
    body: [
      'YOU CONTROL A VIRTUAL U.S. EQUITY PORTFOLIO.',
      'AT EACH CHECKPOINT: READ WHAT CHANGED. INSPECT THE PORTFOLIO. MAKE A DECISION. COMMIT. COMPARE AGAINST THE MACHINE.',
      'YOUR FIRST GOAL: LEARN THE CONTROLS.',
    ],
    trigger: 'game.first_entry',
    priority: 100,
    blocking: true,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [{ label: 'BEGIN', action: 'COMPLETE' }],
  },

  {
    code: 'FIRST_RUN_02_SIGNAL',
    type: 'SPOTLIGHT',
    title: 'MARKET SIGNAL',
    body: [
      'THIS IS NEW INFORMATION AVAILABLE AT THE CURRENT HISTORICAL MOMENT.',
      'THE SIGNAL TELLS YOU WHAT CHANGED.',
      'IT DOES NOT TELL YOU WHAT TO DO.',
    ],
    trigger: 'tutorial.first_signal',
    priority: 90,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    spotlight: 'SIGNAL PANEL',
    actions: [{ label: 'CONTINUE', action: 'COMPLETE' }],
  },

  {
    code: 'FIRST_RUN_03_PORTFOLIO',
    type: 'SPOTLIGHT',
    title: 'YOUR PORTFOLIO',
    body: [
      'EVERY POSITION SHOWS: WEIGHT, PROFIT OR LOSS, SECTOR, RISK CONTRIBUTION.',
      'READ THEM AS EVIDENCE. YOU DECIDE FOR THE WHOLE PORTFOLIO, NOT ONE NAME.',
      'PRESS [P] OR CLICK PORTFOLIO.',
    ],
    trigger: 'tutorial.portfolio_open',
    priority: 90,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    spotlight: 'PORTFOLIO PANEL',
    actions: [
      { label: 'CONTINUE', action: 'COMPLETE' },
    ],
  },

  {
    code: 'FIRST_RUN_04_STANCE',
    type: 'DECISION',
    title: 'ONE STANCE, ONE CHECKPOINT',
    body: [
      'YOU SET A STANCE FOR THE WHOLE PORTFOLIO. THERE IS NO PER POSITION ORDER.',
      'CONVICTION SETS HOW STRONGLY YOU BELIEVE IT.',
      'HOLD IS A REAL, SCORED DECISION AND COSTS NO TURNOVER.',
    ],
    trigger: 'tutorial.stance_selected',
    priority: 90,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [{ label: 'CONTINUE', action: 'COMPLETE' }],
  },

  {
    code: 'FIRST_RUN_06_RISK',
    type: 'SPOTLIGHT',
    title: 'CHECK THE EFFECT',
    body: [
      'BEFORE COMMITTING, INSPECT: CASH · SECTOR EXPOSURE · DRAWDOWN · TURNOVER BUDGET · PORTFOLIO RISK.',
      'TURNOVER IS FINITE AND DOES NOT REFILL. SPENDING IT IS PART OF THE DECISION.',
      'PRESS [R] OR CLICK RISK.',
    ],
    trigger: 'tutorial.review_ready',
    priority: 85,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    spotlight: 'RISK PANEL',
    actions: [{ label: 'OPEN RISK', action: 'COMPLETE' }],
  },

  {
    code: 'FIRST_RUN_07_COMMIT',
    type: 'CONCEPT',
    title: 'COMMITMENT',
    body: [
      'ONCE CONFIRMED, YOUR DECISION IS LOCKED.',
      'THE HISTORICAL MARKET ADVANCES.',
      'THE MACHINE\'S DECISION REMAINS HIDDEN UNTIL YOUR CHOICE IS FINAL.',
    ],
    trigger: 'tutorial.review_ready',
    priority: 88,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [{ label: 'UNDERSTOOD', action: 'COMPLETE' }],
  },

  {
    code: 'FIRST_RUN_08_MACHINE_REVEAL',
    type: 'FIRST_EVENT',
    title: 'MACHINE REVEAL',
    body: [
      'YOU AND THE MACHINE RECEIVED THE SAME HISTORICAL INFORMATION CUTOFF.',
      'ITS ACTION WAS CALCULATED INDEPENDENTLY.',
      'COMPARE: WHAT YOU CHANGED · WHAT THE MACHINE CHANGED · WHY EACH PROCESS ACTED.',
    ],
    trigger: 'tutorial.machine_reveal',
    priority: 80,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [{ label: 'CONTINUE', action: 'COMPLETE' }],
  },

  {
    code: 'FIRST_RUN_09_SCORE',
    type: 'CONCEPT',
    title: 'REFI SCORE',
    body: [
      'RETURN IS ONLY PART OF THE GAME.',
      'THE SCORE ALSO MEASURES: DRAWDOWN CONTROL · DOWNSIDE CONTROL · REGIME ADAPTATION · TURNOVER DISCIPLINE · DECISION CONSISTENCY.',
      'A LUCKY TRADE IS NOT THE SAME AS A GOOD PROCESS.',
    ],
    trigger: 'tutorial.first_score',
    priority: 80,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [
      { label: 'VIEW SCORE', action: 'COMPLETE' },
    ],
  },

  {
    code: 'FIRST_RUN_10_HOLD',
    type: 'DECISION',
    title: 'HOLD IS A DECISION',
    body: [
      'YOU DO NOT NEED TO TRADE AT EVERY CHECKPOINT.',
      'CHOOSE HOLD WHEN: YOUR THESIS REMAINS VALID · NEW INFORMATION IS INSUFFICIENT · THE PORTFOLIO IS ALREADY POSITIONED.',
      'A GOOD HOLD CAN BEAT A BAD TRADE.',
    ],
    trigger: 'tutorial.hold_available',
    priority: 70,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [
      { label: 'TRY HOLD', action: 'TRY_HOLD' },
      { label: 'CONTINUE', action: 'DISMISS' },
    ],
  },

  // ─── COVID arena contextual tips ───────────────────────────────────────────

  {
    code: 'COVID_01_HIDDEN_TIME',
    type: 'FIRST_EVENT',
    title: 'CHALLENGE MODE',
    body: [
      'YOU KNOW THE EVENT.',
      'YOU DO NOT KNOW THE EXACT DATE. FUTURE PRICES, THE MARKET BOTTOM, AND LATER POLICY ACTIONS ARE HIDDEN.',
      'THE MACHINE FACES THE SAME CUTOFF.',
    ],
    trigger: 'arena.covid_enter',
    priority: 90,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'STANDARD',
    actions: [{ label: 'ENTER COVID', action: 'COMPLETE' }],
  },

  {
    code: 'COVID_02_CORRELATION',
    type: 'CONCEPT',
    title: 'CORRELATION IS RISING',
    body: [
      'YOU OWN MULTIPLE STOCKS. THEY MAY STILL REPRESENT THE SAME ECONOMIC RISK.',
      'AIRLINE · HOTEL · CREDIT CARD · AIRCRAFT MANUFACTURER.',
      'DIFFERENT TICKERS. RELATED ECONOMIC EXPOSURE.',
    ],
    trigger: 'arena.correlation_spike',
    priority: 70,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [
      { label: 'CONTINUE', action: 'DISMISS' },
    ],
  },

  {
    code: 'COVID_03_RISK_CONTRIBUTION',
    type: 'CONCEPT',
    title: 'WEIGHT IS NOT RISK',
    body: [
      'A POSITION CAN BE 7% OF CAPITAL BUT 14% OF ESTIMATED PORTFOLIO RISK.',
      'A SMALL POSITION CAN STILL DOMINATE PORTFOLIO BEHAVIOR.',
    ],
    trigger: 'risk.first_risk_contribution_view',
    priority: 60,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    spotlight: 'RISK PANEL',
    actions: [
      { label: 'VIEW RISK', action: 'COMPLETE' },
      { label: 'GOT IT', action: 'DISMISS' },
    ],
  },

  {
    code: 'COVID_04_LARGE_REDUCTION',
    type: 'FIRST_EVENT',
    title: 'LARGE EXPOSURE CHANGE',
    body: [
      'YOU ARE PROPOSING A MAJOR REDUCTION AFTER A LARGE MARKET DECLINE.',
      'CHECK THREE THINGS: DID THE COMPANY THESIS CHANGE? DID PORTFOLIO RISK CHANGE? ARE YOU RESPONDING TO INFORMATION OR TO LOSS?',
      'YOUR DECISION REMAINS YOURS.',
    ],
    trigger: 'arena.large_reduction_proposed',
    priority: 70,
    blocking: false,
    maxShowCount: 2,
    requiredMode: 'FULL',
    actions: [
      { label: 'REVIEW THESIS', action: 'DISMISS' },
      { label: 'CONTINUE', action: 'DISMISS' },
    ],
  },

  {
    code: 'COVID_05_CASH',
    type: 'CONCEPT',
    title: 'YOU RAISED CASH',
    body: [
      'THIS REDUCES EQUITY EXPOSURE. YOU HAVE SOLVED ONE PROBLEM: HOW MUCH RISK TO TAKE NOW.',
      'YOU HAVE CREATED ANOTHER: WHEN TO RE-ENTER.',
      'CASH MANAGEMENT AND RE-ENTRY ARE SEPARATE SKILLS.',
    ],
    trigger: 'arena.cash_raised',
    priority: 60,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [{ label: 'GOT IT', action: 'DISMISS' }],
  },

  {
    code: 'COVID_06_MARKETS_VS_ECONOMY',
    type: 'CONCEPT',
    title: 'MARKETS AND ECONOMIES',
    body: [
      'CURRENT ECONOMIC DATA AND EQUITY PRICES DO NOT ALWAYS MOVE TOGETHER.',
      'EQUITY PRICES REFLECT EXPECTATIONS ABOUT FUTURE BUSINESS CONDITIONS.',
      'CURRENT CONDITIONS MAY WORSEN WHILE MARKET EXPECTATIONS IMPROVE.',
    ],
    trigger: 'arena.economy_diverges_from_market',
    priority: 50,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [{ label: 'GOT IT', action: 'DISMISS' }],
  },

  {
    code: 'COVID_07_STAGED_EXECUTION',
    type: 'PROGRESSION',
    title: 'MODULE UNLOCKED · STAGED RE-ENTRY',
    body: [
      'YOU NO LONGER NEED TO CHOOSE BETWEEN: BUY EVERYTHING NOW OR WAIT FOR CERTAINTY.',
      'YOU MAY DEPLOY CAPITAL ACROSS MULTIPLE CHECKPOINTS.',
    ],
    trigger: 'arena.staged_execution_unlocked',
    priority: 80,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'STANDARD',
    actions: [
      { label: 'TRY STAGED ORDER', action: 'COMPLETE' },
      { label: 'LATER', action: 'SNOOZE' },
    ],
  },

  // ─── Module unlock tips ────────────────────────────────────────────────────

  {
    code: 'MODULE_CORRELATION_UNLOCKED',
    type: 'PROGRESSION',
    title: 'MODULE UNLOCKED · CORRELATION MAP',
    body: [
      'USE THIS MODULE TO INSPECT WHETHER POSITIONS ARE MOVING TOGETHER.',
      'TEN STOCKS CAN STILL REPRESENT ONE ECONOMIC RISK.',
    ],
    trigger: 'module.correlation_matrix_unlocked',
    priority: 80,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'STANDARD',
    actions: [{ label: 'OPEN', action: 'COMPLETE' }],
  },

  {
    code: 'MODULE_REGIME_SCANNER_UNLOCKED',
    type: 'PROGRESSION',
    title: 'MODULE UNLOCKED · REGIME SCANNER',
    body: [
      'THE SCANNER ESTIMATES CURRENT MARKET REGIME CONDITIONS.',
      'IT PROVIDES PROBABILITIES, NOT ANSWERS.',
      'YOU REMAIN RESPONSIBLE FOR THE PORTFOLIO DECISION.',
    ],
    trigger: 'module.regime_scanner_unlocked',
    priority: 80,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'STANDARD',
    actions: [
      { label: 'OPEN SCANNER', action: 'COMPLETE' },
      { label: 'LATER', action: 'SNOOZE' },
    ],
  },

  // ─── Machine comparison tips ───────────────────────────────────────────────

  {
    code: 'MACHINE_FIRST_WIN',
    type: 'FIRST_EVENT',
    title: 'MACHINE LEADS',
    body: [
      'DO NOT COPY THE LAST MACHINE ACTION.',
      'THE NEXT CHECKPOINT MAY REQUIRE A DIFFERENT DECISION.',
      'STUDY THE PROCESS, NOT THE TRADE.',
    ],
    trigger: 'machine.first_machine_win',
    priority: 60,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [{ label: 'VIEW MACHINE LOGIC', action: 'COMPLETE' }],
  },

  {
    code: 'MACHINE_FIRST_HUMAN_WIN',
    type: 'FIRST_EVENT',
    title: 'YOU WON THE CHECKPOINT',
    body: [
      'ONE RESULT DOES NOT PROVE A PROCESS.',
      'THE GAME TRACKS PERFORMANCE ACROSS MULTIPLE DECISIONS AND MULTIPLE REGIMES.',
    ],
    trigger: 'machine.first_human_checkpoint_win',
    priority: 50,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [{ label: 'CONTINUE', action: 'DISMISS' }],
  },

  {
    code: 'MACHINE_FIRST_ARENA_WIN',
    type: 'FIRST_EVENT',
    title: 'MACHINE BEATEN',
    body: [
      'YOU EARNED A HIGHER FINAL REFI SCORE AND STAYED INSIDE THE ARENA RISK LIMITS.',
      'ONE ARENA IS ONE SAMPLE. THE NEXT REGIME WILL TEST A DIFFERENT WEAKNESS.',
    ],
    trigger: 'machine.first_arena_win',
    priority: 70,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'STANDARD',
    actions: [
      { label: 'VIEW AUTOPSY', action: 'COMPLETE' },
    ],
  },

  // ─── Risk concept tips ─────────────────────────────────────────────────────

  {
    code: 'RISK_DRAWDOWN_CONCEPT',
    type: 'CONCEPT',
    title: 'DRAWDOWN',
    body: [
      'DRAWDOWN MEASURES HOW FAR YOUR PORTFOLIO HAS FALLEN FROM ITS PREVIOUS PEAK.',
      'EXAMPLE: PEAK $100,000 → CURRENT $91,000 → DRAWDOWN -9.0%',
      'YOUR ARENA HAS A CRITICAL DRAWDOWN LIMIT OF -20%.',
    ],
    trigger: 'risk.drawdown_warning',
    priority: 70,
    blocking: false,
    maxShowCount: 1,
    requiredMode: 'FULL',
    actions: [
      { label: 'VIEW RISK', action: 'COMPLETE' },
      { label: 'GOT IT', action: 'DISMISS' },
    ],
  },

];

// ─── Lookup helpers ────────────────────────────────────────────────────────────

export function getTipByCode(code: string): TipDef | undefined {
  return TIP_LIBRARY.find(t => t.code === code);
}

export function getTipsByTrigger(trigger: TipTriggerEvent): TipDef[] {
  return TIP_LIBRARY.filter(t => t.trigger === trigger);
}

export function isVisibleInMode(tip: TipDef, mode: GuidanceMode): boolean {
  const modeRank: Record<GuidanceMode, number> = { FULL: 3, STANDARD: 2, MINIMAL: 1, OFF: 0 };
  const requiredRank: Record<GuidanceMode, number> = { FULL: 3, STANDARD: 2, MINIMAL: 1, OFF: 0 };
  return modeRank[mode] >= requiredRank[tip.requiredMode];
}
