// ─── Recovery Trap (§22) ──────────────────────────────────────────────────────
//
// "SURVIVAL LOGIC: STRONG. RE-ENTRY LOGIC: WEAK."
//
// COVID teaches a player to respect drawdowns and raise cash. This arena is
// where that lesson turns into the position that costs them, because a rule has
// no expiry date written on it and the regime it was built for ends without an
// announcement.
//
// The starting book is deliberately the one a cautious COVID run produces: 45%
// cash, defensive survivors, nothing that participates. The player does not
// begin neutral. They begin holding the consequence of the previous arena.

import type { CheckpointData } from './gameTypes';
import { registerArena, buildPortfolio } from './arenas';

export const RECOVERY_CHECKPOINTS: CheckpointData[] = [
  {
    sequence: 1,
    machinePar: 62,
    phase: 'REENTRY_WINDOW',
    crisisDay: 'JAN 2021',
    signalTitle: 'YOU SURVIVED. YOU ARE ALSO 45% IN CASH.',
    signalBody: 'The book that carried you through the crash is the book you still own: heavy cash, defensive names, nothing that participates. Survival logic was correct and is now the position. Nobody rings a bell to tell you the rule has outlived its regime.',
    marketSignals: [
      { indicator: 'CASH', value: '45%', direction: 'neutral', magnitude: 'high' },
      { indicator: 'SPX 6M', value: '+22%', direction: 'up', magnitude: 'high' },
      { indicator: 'VIX', value: '21.9', direction: 'down', magnitude: 'medium' },
      { indicator: 'BREADTH', value: '74%', direction: 'up', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'POSITION', text: 'Cash at 45% against a 5% policy floor' },
      { category: 'MARKET', text: 'Broad participation: three quarters of the index above its 200-day' },
      { category: 'COST', text: 'Six months of a 22% advance earned on 55% of the book' },
      { category: 'MACHINE', text: 'Machine treats a defensive book past its regime as a live decision' },
    ],
    portfolioEffect: { returnBias: 0.016, volatilityDelta: -0.01, correlationLevel: 0.46 },
    machineDecision: {
      actionCode: 'STAGED_BUY',
      reasoning: [
        'Breadth broad and volatility normalised: the defensive regime has ended',
        'Cash at 45% against a 5% floor is a position, not a buffer',
        'Deploy in tranches: the rule is to close the gap, not to time it',
      ],
      policyReason: 'Defensive posture outlived its regime. Staged deployment toward policy weight.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'STAGED_BUY',
        label: 'STAGED: close the cash gap in tranches',
        shortLabel: 'STAGE IN',
        turnoverCost: 0.03,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { REENTRY_DISCIPLINE: 8, RULE_ADHERENCE: 6 },
          teachingMessage: 'Staged deployment answers the question the crisis left open without pretending you can time the entry.',
          machineComparison: 'Machine stages toward policy on the same breadth rule.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: the recovery is not proven',
        shortLabel: 'HOLD CASH',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['REENTRY_DELAY', 'CASH_DRAG'],
          alphaImpact: { REENTRY_DISCIPLINE: -8, REGIME_ADAPTATION: -5 },
          teachingMessage: 'Proof arrives priced. The rule that saved you in March is costing you now, and keeping it is a decision.',
          machineComparison: 'Machine deployed. Holding is the survival rule outliving its regime.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: deploy the whole cash balance now',
        shortLabel: 'ALL IN',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE'],
          alphaImpact: { REENTRY_DISCIPLINE: 3, POSITION_SIZING: -6 },
          teachingMessage: 'Correct direction, wrong sizing. One price for 40% of the book is the panic in reverse.',
          machineComparison: 'Machine stages. A single entry price is the mistake that raised this cash.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE more: wait for a real correction',
        shortLabel: 'MORE CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'RECENCY_BIAS'],
          alphaImpact: { REENTRY_DISCIPLINE: -10, REGIME_ADAPTATION: -7 },
          teachingMessage: 'Adding cash into a confirmed recovery anchors on the last regime rather than on this one.',
          machineComparison: 'Machine deployed. The evidence moved and the position did not.',
        },
      },
    ],
    teachingPoint: 'SURVIVAL LOGIC: STRONG. RE-ENTRY LOGIC: WEAK. THE RULE THAT SAVED YOU HAS NO EXPIRY DATE WRITTEN ON IT.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Holding 45% cash into a confirmed recovery is the arena\u2019s central mistake, not neutrality.',
  },
  {
    sequence: 2,
    machinePar: 66,
    phase: 'REENTRY_WINDOW',
    crisisDay: 'FEB 2021',
    signalTitle: 'THE FIRST PULLBACK: -4% AND YOUR INSTINCT SAYS TOLD YOU SO',
    signalBody: 'Four percent off the high. After last year that feels like the start of something. Credit is unmoved, breadth is intact, and the decline is smaller than three separate pullbacks inside the recovery you already missed.',
    marketSignals: [
      { indicator: 'SPX', value: '-4.1%', direction: 'down', magnitude: 'medium' },
      { indicator: 'VIX', value: '25.4', direction: 'up', magnitude: 'medium' },
      { indicator: 'CREDIT', value: 'STABLE', direction: 'neutral', magnitude: 'low' },
      { indicator: 'BREADTH', value: '69%', direction: 'up', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'MARKET', text: 'Fourth pullback of the recovery, and the shallowest so far' },
      { category: 'CREDIT', text: 'Spreads unchanged: no funding stress in the move' },
      { category: 'BEHAVIOUR', text: 'A player who missed the advance reads every decline as vindication' },
      { category: 'MACHINE', text: 'Machine sized on evidence, so a 4% move triggers nothing' },
    ],
    portfolioEffect: { returnBias: -0.012, volatilityDelta: 0.02, correlationLevel: 0.58 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Credit stable and breadth intact: no regime rule fires',
        'A 4% pullback is inside the normal distribution of a recovery',
        'Reacting here would restart the cash problem just solved',
      ],
      policyReason: 'Ordinary pullback with credit intact. No trigger, no action.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: ordinary pullback, credit intact',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { LOSS_CONTROL: 5, DECISION_CONSISTENCY: 6, REENTRY_DISCIPLINE: 4 },
          teachingMessage: 'You read the evidence rather than the memory. Four percent with stable credit is weather, not climate.',
          machineComparison: 'Machine holds on the same reading.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: this is how last year started',
        shortLabel: 'BACK TO CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS', 'PANIC_REDUCTION_LARGE'],
          alphaImpact: { REENTRY_DISCIPLINE: -8, REGIME_ADAPTATION: -5 },
          teachingMessage: 'Last year started with credit tightening and breadth collapsing. Neither is present. You are trading the memory.',
          machineComparison: 'Machine held. This is the trap the arena is named after.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: lock in what you have recovered',
        shortLabel: 'TRIM',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { REENTRY_DISCIPLINE: -5, TURNOVER_DISCIPLINE: -3 },
          teachingMessage: 'Selling a 4% dip to protect a partial recovery converts a temporary decline into a permanent underweight.',
          machineComparison: 'Machine held. Nothing in the evidence changed.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: buy the pullback',
        shortLabel: 'BUY DIP',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { REENTRY_DISCIPLINE: 4, POSITION_SIZING: -2 },
          teachingMessage: 'Reasonable if you are still underweight. Slightly aggressive as a single move rather than a staged one.',
          machineComparison: 'Machine held; adding here is defensible if the gap to policy is still open.',
        },
      },
    ],
    teachingPoint: 'THE FIRST DECLINE AFTER A CRISIS FEELS LIKE THE CRISIS RETURNING. CREDIT AND BREADTH SAY OTHERWISE. THE EVIDENCE IS THE SAME EVIDENCE.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. A shallow pullback with stable credit is not the last regime returning.',
  },
  {
    sequence: 3,
    machinePar: 70,
    phase: 'LEADERSHIP_CHANGE',
    crisisDay: 'MAR 2021',
    signalTitle: 'LEADERSHIP ROTATES: WHAT WORKED LAST YEAR STOPS WORKING',
    signalBody: 'Ten-year yields move from 0.9% to 1.7%. The names that led the recovery fall while banks, energy and industrials lead. Your defensive survivors are now the laggards. The recovery continued and changed character while you were deciding whether to trust it.',
    marketSignals: [
      { indicator: '10Y', value: '1.74%', direction: 'up', magnitude: 'high' },
      { indicator: 'GROWTH', value: '-9.2%', direction: 'down', magnitude: 'high' },
      { indicator: 'VALUE', value: '+11.4%', direction: 'up', magnitude: 'high' },
      { indicator: 'SPX', value: '+2.1%', direction: 'up', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'RATES', text: 'Ten-year yield nearly doubles in eight weeks' },
      { category: 'ROTATION', text: 'Value over growth by the widest quarterly margin since 2001' },
      { category: 'PORTFOLIO', text: 'A defensive book is not a value book: it lags both sides of this' },
      { category: 'MACHINE', text: 'Machine rebalances toward policy weights rather than picking the winner' },
    ],
    portfolioEffect: { returnBias: 0.008, volatilityDelta: 0.02, correlationLevel: 0.51 },
    machineDecision: {
      actionCode: 'ROTATE_RISK',
      reasoning: [
        'Leadership has changed and the book is positioned for the previous regime',
        'Rotate toward policy weights rather than toward whatever led last month',
        'This is a rebalance to neutral, not a bet on value continuing',
      ],
      policyReason: 'Leadership changed. Rotate to policy weight rather than chase the new leader.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'ROTATE_RISK',
        label: 'ROTATE: toward policy weights, not toward the winner',
        shortLabel: 'REBALANCE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { REGIME_ADAPTATION: 7, RULE_ADHERENCE: 5 },
          teachingMessage: 'Rotating to neutral is not a forecast. It is refusing to stay positioned for a regime that has ended.',
          machineComparison: 'Machine rotates to policy, not to the leader.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: defensives will come back',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'REENTRY_DELAY'],
          alphaImpact: { REGIME_ADAPTATION: -7, RULE_ADHERENCE: -4 },
          teachingMessage: 'Holding a book built for the last regime because it once worked is the definition of anchoring.',
          machineComparison: 'Machine rotated. The leadership changed and the book did not.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: buy the new leaders',
        shortLabel: 'CHASE VALUE',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING', 'RECENCY_BIAS'],
          alphaImpact: { CONCENTRATION_CONTROL: -6, REGIME_ADAPTATION: 2 },
          teachingMessage: 'Buying the rotation after the widest quarterly move in twenty years pays the crowded price for the correct idea.',
          machineComparison: 'Machine rebalanced to policy rather than chasing the move.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: cut the laggards entirely',
        shortLabel: 'CUT',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { REGIME_ADAPTATION: 3, CONCENTRATION_CONTROL: -2 },
          teachingMessage: 'Reducing the previous regime\u2019s winners is right in direction; cutting them entirely swaps one concentration for another.',
          machineComparison: 'Machine trimmed rather than exited.',
        },
      },
    ],
    teachingPoint: 'THE RECOVERY DID NOT WAIT FOR YOU AND DID NOT STAY THE SAME SHAPE. A BOOK BUILT FOR THE LAST REGIME LAGS BOTH SIDES OF THE NEXT ONE.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Holding a defensive book through a leadership change keeps a position the evidence has already retired.',
  },
  {
    sequence: 4,
    machinePar: 73,
    phase: 'LEADERSHIP_CHANGE',
    crisisDay: 'JUN 2021',
    signalTitle: 'DRIFT AUDIT: THE BOOK NOBODY DECIDED ON',
    signalBody: 'Eighteen months of crisis and recovery decisions have left weights nobody chose. Two positions are above the position limit, one sector is under half its target, and cash is still above policy. None of this came from a decision. All of it came from not making one.',
    marketSignals: [
      { indicator: 'MAX POSITION', value: '13.4%', direction: 'up', magnitude: 'high' },
      { indicator: 'MIN SECTOR', value: '3.1%', direction: 'down', magnitude: 'medium' },
      { indicator: 'CASH', value: '12%', direction: 'up', magnitude: 'medium' },
      { indicator: 'DRIFT SCORE', value: 'HIGH', direction: 'up', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'DRIFT', text: 'Two positions above the 10% limit through performance alone' },
      { category: 'POLICY', text: 'Cash still above target eighteen months after the crisis' },
      { category: 'RISK', text: 'Drift is the position you did not choose and are still carrying' },
      { category: 'MACHINE', text: 'Machine rebalances on a drift threshold, on a schedule, without a view' },
    ],
    portfolioEffect: { returnBias: 0.006, volatilityDelta: -0.01, correlationLevel: 0.44 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'Two positions past the limit: the drift rule fires',
        'Rebalancing restores the book the player designed',
        'Drift compounds silently and is only visible when measured',
      ],
      policyReason: 'Drift threshold breached on two positions. Rebalance to policy.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REBALANCE: trim the overweights back to limit',
        shortLabel: 'REBALANCE',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { RULE_ADHERENCE: 7, POSITION_SIZING: 6, CONCENTRATION_CONTROL: 5 },
          teachingMessage: 'Rebalancing is how a portfolio stays the one you designed rather than the one the market left you.',
          machineComparison: 'Machine rebalances on the drift rule.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: the winners earned their weight',
        shortLabel: 'LET RUN',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'ANCHORING'],
          alphaImpact: { RULE_ADHERENCE: -6, POSITION_SIZING: -5 },
          teachingMessage: 'Letting winners run past your own limit is choosing the drift. You wrote the limit for a reason you are now ignoring.',
          machineComparison: 'Machine trimmed to policy regardless of recent return.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: excess into the underweight sector',
        shortLabel: 'ROTATE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { RULE_ADHERENCE: 5, CONCENTRATION_CONTROL: 5, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'Same destination as a rebalance with more turnover. Correct instinct, costlier route.',
          machineComparison: 'Machine trimmed to policy: same result, less turnover.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: top up the underweights with cash',
        shortLabel: 'DEPLOY',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { REENTRY_DISCIPLINE: 5, RULE_ADHERENCE: 3 },
          teachingMessage: 'Deploying the excess cash toward the underweight is genuine progress; it leaves the overweight breach unaddressed.',
          machineComparison: 'Machine did both: trimmed the breach and closed the cash gap.',
        },
      },
    ],
    teachingPoint: 'EIGHTEEN MONTHS OF NOT DECIDING PRODUCED A BOOK YOU NEVER CHOSE. REBALANCING IS NOT A MARKET CALL. IT IS MAINTENANCE.',
    isRegimeChange: false,
    isHoldValid: false,
    holdTeaching: 'Holding two positions past your own limit keeps a risk you already wrote a rule against.',
  },
  {
    sequence: 5,
    machinePar: 76,
    phase: 'REENTRY_WINDOW',
    crisisDay: 'SEP 2021',
    signalTitle: 'FULLY INVESTED, AND THE FIRST REAL SCARE ARRIVES',
    signalBody: 'The book is finally at policy. Within a week a large property developer defaults abroad, the index falls 5%, and credit twitches for the first time since March 2020. You are now carrying the exposure you spent eighteen months avoiding, on the week it hurts.',
    marketSignals: [
      { indicator: 'SPX', value: '-5.2%', direction: 'down', magnitude: 'medium' },
      { indicator: 'CREDIT', value: 'WIDENING', direction: 'up', magnitude: 'medium' },
      { indicator: 'VIX', value: '25.7', direction: 'up', magnitude: 'medium' },
      { indicator: 'CASH', value: '6%', direction: 'down', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'CREDIT', text: 'Spreads widen for the first time in eighteen months, from a very tight base' },
      { category: 'CONTAGION', text: 'Offshore property default; direct US exposure minimal' },
      { category: 'POSITION', text: 'Fully invested for the first time since the crisis' },
      { category: 'MACHINE', text: 'Machine distinguishes a widening from a tight base from a genuine funding event' },
    ],
    portfolioEffect: { returnBias: -0.018, volatilityDelta: 0.03, correlationLevel: 0.66 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Spreads widened from historically tight levels: the level still signals no stress',
        'Direct exposure to the defaulting entity is immaterial',
        'Selling the week after reaching policy weight would restart the entire cycle',
      ],
      policyReason: 'Widening from a tight base with no direct exposure. No trigger.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: widening from a tight base is not stress',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { LOSS_CONTROL: 6, DECISION_CONSISTENCY: 7, REENTRY_DISCIPLINE: 5 },
          teachingMessage: 'You took eighteen months to reach policy weight and did not abandon it in the first difficult week. That is the discipline the arena is testing.',
          machineComparison: 'Machine holds: the level of spreads still signals no funding stress.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: the pattern is repeating',
        shortLabel: 'BACK TO CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS', 'PANIC_REDUCTION_LARGE'],
          alphaImpact: { REENTRY_DISCIPLINE: -9, LOSS_CONTROL: -4 },
          teachingMessage: 'You have just completed the re-entry this arena exists to teach and undone it in one week. The cash problem restarts from the beginning.',
          machineComparison: 'Machine held. This is the trap closing.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: trim back to a comfortable weight',
        shortLabel: 'TRIM',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { REENTRY_DISCIPLINE: -5, LOSS_CONTROL: -2 },
          teachingMessage: 'Comfort is not a risk measure. Nothing in the evidence changed except how the position feels.',
          machineComparison: 'Machine held. The trigger was never met.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: buy the fear',
        shortLabel: 'ADD',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'CONTRARIAN_EARLY'],
          alphaImpact: { LOSS_CONTROL: -5, POSITION_SIZING: -4 },
          teachingMessage: 'Adding into the first credit widening in eighteen months, at policy weight, is taking a view precisely where you have no edge.',
          machineComparison: 'Machine held at policy.',
        },
      },
    ],
    teachingPoint: 'YOU SPENT EIGHTEEN MONTHS GETTING BACK TO POLICY. THE TEST IS WHETHER YOU CAN STAY THERE THROUGH THE FIRST BAD WEEK.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. Reaching policy weight and keeping it through an ordinary scare is the whole arena.',
  },
  {
    sequence: 6,
    machinePar: 79,
    phase: 'LEADERSHIP_CHANGE',
    crisisDay: 'DEC 2021',
    signalTitle: 'THE RECOVERY IS OVER AND SOMETHING ELSE HAS STARTED',
    signalBody: 'Inflation prints at 7%, the highest in forty years. The central bank stops calling it transitory. The recovery regime you spent two years learning to trust is ending, and the next arena is already visible in the data.',
    marketSignals: [
      { indicator: 'CPI', value: '7.0%', direction: 'up', magnitude: 'extreme' },
      { indicator: '10Y', value: '1.52%', direction: 'up', magnitude: 'medium' },
      { indicator: 'FED', value: 'HAWKISH PIVOT', direction: 'up', magnitude: 'high' },
      { indicator: 'GROWTH', value: '-6.8%', direction: 'down', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'INFLATION', text: 'Highest print since 1982; the transitory framing is withdrawn' },
      { category: 'POLICY', text: 'Tapering accelerated, rate rises brought forward' },
      { category: 'REGIME', text: 'The conditions that produced the recovery are being removed deliberately' },
      { category: 'MACHINE', text: 'Machine registers a regime change and reduces rate-sensitive exposure' },
    ],
    portfolioEffect: { returnBias: -0.014, volatilityDelta: 0.03, correlationLevel: 0.62 },
    machineDecision: {
      actionCode: 'ROTATE_DEFENSIVE',
      reasoning: [
        'Inflation at 7% with an explicit policy pivot is a regime change, not a data point',
        'Long-duration growth exposure is the most rate-sensitive part of the book',
        'Rotate before the policy path is priced, not after',
      ],
      policyReason: 'Regime change confirmed by policy pivot. Reduce rate-sensitive exposure.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: out of long-duration growth',
        shortLabel: 'ROTATE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'EARLY_REGIME_SENSITIVITY'],
          alphaImpact: { REGIME_ADAPTATION: 8, RULE_ADHERENCE: 5 },
          teachingMessage: 'You read a policy pivot as a regime change rather than a headline. The next arena begins from this decision.',
          machineComparison: 'Machine rotated on the same evidence.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: inflation is transitory',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'RECENCY_BIAS'],
          alphaImpact: { REGIME_ADAPTATION: -8, LOSS_CONTROL: -4 },
          teachingMessage: 'The institution that coined transitory has just withdrawn the word. Holding the framing after its author abandoned it is anchoring.',
          machineComparison: 'Machine rotated. The policy path changed explicitly.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE broadly: raise defensive cash',
        shortLabel: 'DE-RISK',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { REGIME_ADAPTATION: 4, REENTRY_DISCIPLINE: -3 },
          teachingMessage: 'Reducing is directionally right. Doing it broadly rather than by rate sensitivity recreates the cash problem you just solved.',
          machineComparison: 'Machine rotated within equities rather than out of them.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: buy the growth dip',
        shortLabel: 'BUY DIP',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING', 'RECENCY_BIAS'],
          alphaImpact: { REGIME_ADAPTATION: -9, POSITION_SIZING: -5 },
          teachingMessage: 'Buying long-duration growth into a confirmed hawkish pivot is buying the exposure the regime is designed to punish.',
          machineComparison: 'Machine reduced exactly what this adds.',
        },
      },
    ],
    teachingPoint: 'EVERY REGIME ENDS. THE RECOVERY TAUGHT YOU TO TRUST PARTICIPATION, AND THAT LESSON EXPIRES HERE. WHAT SAVED YOU LAST TIME IS THE NEXT TRAP.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Holding through an explicit policy pivot is the recovery lesson outliving its own regime.',
  },
];

export const RECOVERY_ARENA = registerArena({
  id: 'recovery_trap',
  name: 'RECOVERY TRAP',
  order: 2,
  difficulty: 3,
  lesson: 'Survival logic becomes the liability. Protection is half a process; re-entry is the other half.',
  window: 'JAN 2021 - DEC 2021',
  checkpoints: RECOVERY_CHECKPOINTS,
  // Tighter than COVID: this arena's losses come from absence rather than
  // exposure, so a book that never participates should fail on cash drag long
  // before it can fail on drawdown.
  criticalDrawdown: -0.15,
  startingPortfolio: () => buildPortfolio(
    [
      { symbol: 'JNJ',  weight: 0.11, riskContrib: 0.07, sector: 'HEALTHCARE' },
      { symbol: 'PG',   weight: 0.11, riskContrib: 0.06, sector: 'CONSUMER STAPLES' },
      { symbol: 'KO',   weight: 0.08, riskContrib: 0.06, sector: 'CONSUMER STAPLES' },
      { symbol: 'MSFT', weight: 0.10, riskContrib: 0.14, sector: 'TECHNOLOGY' },
      { symbol: 'VZ',   weight: 0.08, riskContrib: 0.07, sector: 'TELECOM' },
      { symbol: 'WMT',  weight: 0.07, riskContrib: 0.08, sector: 'CONSUMER STAPLES' },
    ],
    { volatility: 0.13, correlationIndex: 0.44, startingCapital: 100000 },
  ),
});
