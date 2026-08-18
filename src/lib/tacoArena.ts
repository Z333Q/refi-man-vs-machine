// ─── TACO Protocol (§25) ──────────────────────────────────────────────────────
//
// "THE MARKET THINKS IT KNOWS THE PATTERN. DOES YOUR MACHINE?"
//
// §25.1 is explicit that the final boss is not a trivia game about predicting
// whether a politician reverses policy. Nothing in these five rounds asks the
// player to forecast the outcome, and no branch is scored on guessing it. What
// is scored is whether a process survives contact with its own reputation.
//
// The shape of the trap, round by round: an exposure that has to be measured
// rather than read off a headline; a partial change in the facts that earns a
// partial change in the position; a pattern that worked once and is now
// consensus; the round where the pattern fails; and the round where the
// player's expected response has itself become part of the setup.
//
// Round 5 is the closing argument of the whole progression. The rule is sound
// and its edge is smaller because everyone runs it. Keeping the rule and
// letting position size carry the uncertainty is the answer; suspending it
// replaces one process with two forecasts, and inverting it after a single
// failure is the overfit every earlier arena already charged for.
//
// The dates are rounds, not calendar days. §25 specifies an episode set that is
// still an open decision (§66), so nothing here claims a specific historical
// window it cannot source.

import type { CheckpointData } from './gameTypes';
import { registerArena, buildPortfolio } from './arenas';

export const TACO_CHECKPOINTS: CheckpointData[] = [
  {
    sequence: 1,
    machinePar: 68,
    phase: 'POLICY_SHOCK',
    crisisDay: 'ROUND 1',
    signalTitle: 'POLICY ALERT: NEW TARIFF ACTION ANNOUNCED',
    signalBody: 'Broad tariffs are announced with an uncertain implementation path. Scope is wide, timing is unclear, and the exposure is not evenly distributed: an importer of components and a domestic services business are not the same trade. The market has one day of information and is pricing a year of consequences.',
    marketSignals: [
      { indicator: 'SCOPE', value: 'BROAD', direction: 'down', magnitude: 'high' },
      { indicator: 'IMPLEMENTATION', value: 'UNCERTAIN', direction: 'neutral', magnitude: 'high' },
      { indicator: 'AUTOS', value: '-7.4%', direction: 'down', magnitude: 'high' },
      { indicator: 'SEMIS', value: '-6.1%', direction: 'down', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'POLICY', text: 'Tariff action announced; implementation path unresolved' },
      { category: 'EXPOSURE', text: 'Input-cost exposure varies enormously by company, not by sector label' },
      { category: 'MARKET', text: 'Broad selling with little differentiation on actual exposure' },
      { category: 'MACHINE', text: 'Machine maps exposure company by company before sizing anything' },
    ],
    portfolioEffect: { returnBias: -0.026, volatilityDelta: 0.04, correlationLevel: 0.69 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'Tariff exposure is a company-level input-cost question, not a sector one',
        'Reduce the names with genuine imported-input exposure',
        'No position taken on whether the policy survives',
      ],
      policyReason: 'Reduce measured input-cost exposure. No view taken on the policy path.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: trim measured input-cost exposure',
        shortLabel: 'TRIM EXPOSED',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { REGIME_ADAPTATION: 7, POSITION_SIZING: 5 },
          teachingMessage: 'You reduced by measured exposure rather than by headline. The tariff is a cost input before it is a narrative.',
          machineComparison: 'Machine reduced on the same measurement.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: it will be negotiated away',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { REGIME_ADAPTATION: -5, LOSS_CONTROL: -3 },
          teachingMessage: 'It may well be. Holding on that basis is a forecast about a political outcome, and you have no edge in it.',
          machineComparison: 'Machine reduced exposure without predicting the outcome.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: step back from the whole thing',
        shortLabel: 'CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { LOSS_CONTROL: 4, REENTRY_DISCIPLINE: -4 },
          teachingMessage: 'Blunt but not wrong. It treats a company-level exposure question as a market-level one, and creates a re-entry decision.',
          machineComparison: 'Machine reduced the exposed names rather than the whole book.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: buy the panic in the exposed names',
        shortLabel: 'BUY PANIC',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CONTRARIAN_EARLY', 'OVERCONFIDENCE'],
          alphaImpact: { REGIME_ADAPTATION: -7, POSITION_SIZING: -5 },
          teachingMessage: 'Adding to the most exposed names on day one of an unresolved policy is a bet on reversal with no evidence yet.',
          machineComparison: 'Machine reduced them.',
        },
      },
    ],
    teachingPoint: 'A TARIFF IS AN INPUT COST BEFORE IT IS A NARRATIVE. EXPOSURE IS MEASURED COMPANY BY COMPANY, NOT BY THE SECTOR LABEL ON THE HEADLINE.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Holding on the expectation of a reversal is a political forecast wearing a portfolio decision.',
  },
  {
    sequence: 2,
    machinePar: 72,
    phase: 'NEGOTIATION',
    crisisDay: 'ROUND 2',
    signalTitle: 'NEGOTIATIONS CONTINUE. REVERSAL PROBABILITY RISING.',
    signalBody: 'Talks are reported as constructive. Implementation is delayed but not withdrawn. The market now prices a meaningful chance of reversal and the exposed names have recovered most of the fall. Nothing has actually been decided.',
    marketSignals: [
      { indicator: 'REVERSAL ODDS', value: 'RISING', direction: 'up', magnitude: 'high' },
      { indicator: 'AUTOS', value: '+5.9%', direction: 'up', magnitude: 'high' },
      { indicator: 'IMPLEMENTATION', value: 'DELAYED', direction: 'neutral', magnitude: 'medium' },
      { indicator: 'VIX', value: '19.8', direction: 'down', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'NEGOTIATION', text: 'Talks described as constructive; no agreement signed' },
      { category: 'PRICE', text: 'Exposed names recover most of the announcement decline' },
      { category: 'STATE', text: 'Delay is not withdrawal, and the policy remains on the table' },
      { category: 'MACHINE', text: 'Machine re-enters partially: the exposure fell, it did not disappear' },
    ],
    portfolioEffect: { returnBias: 0.019, volatilityDelta: -0.02, correlationLevel: 0.62 },
    machineDecision: {
      actionCode: 'STAGED_BUY',
      reasoning: [
        'Delay genuinely reduces near-term exposure and does not remove it',
        'A partial restoration matches a partial change in the facts',
        'Full re-entry would price a resolution that has not happened',
      ],
      policyReason: 'Exposure reduced, not removed. Restore part of the position, not all of it.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'STAGED_BUY',
        label: 'STAGED: restore part of the position',
        shortLabel: 'PARTIAL',
        turnoverCost: 0.03,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { REENTRY_DISCIPLINE: 7, REGIME_ADAPTATION: 5 },
          teachingMessage: 'A partial change in the facts earns a partial change in the position. That proportionality is the whole discipline here.',
          machineComparison: 'Machine restored part of the exposure.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: full re-entry, the reversal is coming',
        shortLabel: 'FULL RE-ENTRY',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'CHASING'],
          alphaImpact: { REGIME_ADAPTATION: -6, POSITION_SIZING: -5 },
          teachingMessage: 'Full re-entry prices a resolution nobody has signed. You are buying the outcome, not the change in odds.',
          machineComparison: 'Machine restored part of it.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: wait for a signed agreement',
        shortLabel: 'WAIT',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['REENTRY_DELAY'],
          alphaImpact: { REENTRY_DISCIPLINE: -4, REGIME_ADAPTATION: -2 },
          teachingMessage: 'Waiting for the signature means re-entering after the news is priced. The delay is itself a real change in exposure.',
          machineComparison: 'Machine acted on the change in the facts rather than on the announcement.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE further: the delay is a trap',
        shortLabel: 'CUT MORE',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { REGIME_ADAPTATION: -5, REENTRY_DISCIPLINE: -4 },
          teachingMessage: 'Reducing after the exposure has demonstrably fallen is moving in the opposite direction to the evidence.',
          machineComparison: 'Machine increased slightly. The facts improved.',
        },
      },
    ],
    teachingPoint: 'DELAY IS NOT WITHDRAWAL. A PARTIAL CHANGE IN THE FACTS EARNS A PARTIAL CHANGE IN THE POSITION, AND NOTHING MORE.',
    isRegimeChange: false,
    isHoldValid: false,
    holdTeaching: 'Waiting for a signature means acting after the information is priced.',
  },
  {
    sequence: 3,
    machinePar: 76,
    phase: 'PATTERN_TRAP',
    crisisDay: 'ROUND 3',
    signalTitle: 'PATTERN MEMORY: BUYING WEAKNESS WORKED LAST TIME',
    signalBody: 'A second tariff announcement lands. The market falls, and then buys the dip within hours: everyone remembers what happened last round. Dip-buying is accelerating and volatility is muted. The question is not what the policy will do. It is whether you are trading the policy or the memory of the last one.',
    marketSignals: [
      { indicator: 'DIP BUYING', value: 'ACCELERATING', direction: 'up', magnitude: 'high' },
      { indicator: 'VOL RESPONSE', value: 'MUTED', direction: 'down', magnitude: 'medium' },
      { indicator: 'POSITIONING', value: 'CROWDED', direction: 'up', magnitude: 'high' },
      { indicator: 'AUTOS', value: '-3.1%', direction: 'down', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'MEMORY', text: 'The previous round rewarded buying weakness within days' },
      { category: 'CROWDING', text: 'Positioning surveys show the reversal trade is consensus' },
      { category: 'REFLEXIVITY', text: 'Everyone expecting the same reversal changes the payoff of expecting it' },
      { category: 'MACHINE', text: 'Machine sizes on current exposure, with no memory of the last round' },
    ],
    portfolioEffect: { returnBias: -0.011, volatilityDelta: 0.01, correlationLevel: 0.72 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'The current exposure is already inside policy limits after round two',
        'The reversal trade is consensus, which changes its payoff',
        'Acting on the previous round\u2019s outcome is pattern memory, not analysis',
      ],
      policyReason: 'At policy on measured exposure. The pattern is not evidence.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: the pattern is not evidence',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { DECISION_CONSISTENCY: 8, RULE_ADHERENCE: 6, REGIME_ADAPTATION: 5 },
          teachingMessage: 'You declined to trade the memory. One prior instance is an anecdote, and a crowded anecdote is worse than none.',
          machineComparison: 'Machine holds: it has no memory of round one to trade on.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: it worked last time',
        shortLabel: 'REPEAT',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS', 'CHASING', 'OVERCONFIDENCE'],
          alphaImpact: { REGIME_ADAPTATION: -8, DECISION_CONSISTENCY: -6 },
          teachingMessage: 'One prior instance, now consensus. You are trading the memory of the last policy rather than this one, which is exactly what this round is built to catch.',
          machineComparison: 'Machine held. The pattern is a sample of one.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: crowded trades unwind badly',
        shortLabel: 'FADE CROWD',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { REGIME_ADAPTATION: 3, TURNOVER_DISCIPLINE: -3 },
          teachingMessage: 'Crowding is a real condition and a poor timing signal. Reducing on it alone is trading a different pattern.',
          machineComparison: 'Machine held at measured exposure.',
        },
      },
      {
        actionCode: 'ROTATE_RISK',
        label: 'ROTATE: into the names that reverse hardest',
        shortLabel: 'ROTATE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['CHASING', 'OVERCONFIDENCE'],
          alphaImpact: { CONCENTRATION_CONTROL: -7, REGIME_ADAPTATION: -5 },
          teachingMessage: 'Concentrating into the highest-beta version of a consensus trade is the pattern trap with leverage on top.',
          machineComparison: 'Machine held its measured exposure.',
        },
      },
    ],
    teachingPoint: 'ARE YOU TRADING THE POLICY OR THE MEMORY OF THE LAST POLICY? ONE PRIOR INSTANCE IS AN ANECDOTE, AND WHEN EVERYONE REMEMBERS IT THE PAYOFF HAS ALREADY CHANGED.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. Declining to trade a sample of one, especially a crowded one, is the discipline this round tests.',
  },
  {
    sequence: 4,
    machinePar: 79,
    phase: 'PERSISTENCE',
    crisisDay: 'ROUND 4',
    signalTitle: 'PATTERN FAILURE: THE POLICY DOES NOT REVERSE',
    signalBody: 'Implementation proceeds. No reversal, no delay, no negotiated exit. The dip-buyers are underwater and the exposed names break to new lows. The pattern that defined the previous rounds has failed, and everything positioned on it is wrong at once.',
    marketSignals: [
      { indicator: 'IMPLEMENTATION', value: 'PROCEEDING', direction: 'down', magnitude: 'extreme' },
      { indicator: 'AUTOS', value: '-11.8%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'DIP BUYERS', value: 'UNDERWATER', direction: 'down', magnitude: 'high' },
      { indicator: 'CORR', value: '0.81', direction: 'up', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'POLICY', text: 'Tariffs take effect as announced; no reversal materialises' },
      { category: 'PATTERN', text: 'The reversal trade fails for the first time in the sequence' },
      { category: 'CROWDING', text: 'Consensus positioning unwinds into a falling market' },
      { category: 'MACHINE', text: 'Machine holds a small measured exposure and is not positioned on the pattern' },
    ],
    portfolioEffect: { returnBias: -0.032, volatilityDelta: 0.04, correlationLevel: 0.81 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'The exposure is now real and persistent rather than announced and uncertain',
        'Reduce to reflect a policy in force, not a policy proposed',
        'Being unpositioned on the pattern is why this is a trim and not a rescue',
      ],
      policyReason: 'Policy in force. Reduce to reflect realised rather than proposed exposure.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: the exposure is now real',
        shortLabel: 'TRIM',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { REGIME_ADAPTATION: 8, LOSS_CONTROL: 6 },
          teachingMessage: 'A proposed cost and an implemented one are different exposures. You resized when the fact changed rather than when the price did.',
          machineComparison: 'Machine reduced on the change in facts.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: it still has to be reversed eventually',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'RECENCY_BIAS'],
          alphaImpact: { REGIME_ADAPTATION: -8, LOSS_CONTROL: -6 },
          teachingMessage: 'The pattern has failed and the thesis has not been updated. This is the round that punishes holding a rule after its evidence expired.',
          machineComparison: 'Machine reduced. The policy is in force.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: even better prices now',
        shortLabel: 'DOUBLE DOWN',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'RECENCY_BIAS'],
          alphaImpact: { REGIME_ADAPTATION: -10, LOSS_CONTROL: -8 },
          teachingMessage: 'Adding after the pattern failed, on the argument that the pattern will work, is the most expensive decision available in this arena.',
          machineComparison: 'Machine reduced. The pattern is the thing that just broke.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: exit the exposure entirely',
        shortLabel: 'EXIT',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { LOSS_CONTROL: 5, REENTRY_DISCIPLINE: -4 },
          teachingMessage: 'Effective and blunt. The exposure warranted reduction; a full exit prices a permanence the policy has not demonstrated.',
          machineComparison: 'Machine trimmed rather than exited.',
        },
      },
    ],
    teachingPoint: 'THE MARKET EXPECTED REVERSAL. POLICY REMAINS ACTIVE. A PATTERN IS A HYPOTHESIS AND THIS IS WHAT IT COSTS TO KEEP ONE AFTER ITS EVIDENCE HAS FAILED.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Holding after the pattern failed keeps a thesis the evidence has already retired.',
  },
  {
    sequence: 5,
    machinePar: 84,
    phase: 'REFLEXIVITY',
    crisisDay: 'ROUND 5',
    signalTitle: 'FINAL ROUND: THE MARKET THINKS IT KNOWS THE PATTERN',
    signalBody: 'Another announcement. This time dip buying is elevated but hesitant, volatility response is muted, positioning is crowded and the policy path is unknown. The market has learned from round four, which changes the setup again. Your expected response is now part of the market state. Do you keep the rule?',
    marketSignals: [
      { indicator: 'DIP BUYING', value: 'ELEVATED', direction: 'up', magnitude: 'medium' },
      { indicator: 'VOL RESPONSE', value: 'MUTED', direction: 'down', magnitude: 'medium' },
      { indicator: 'POSITIONING', value: 'CROWDED', direction: 'up', magnitude: 'high' },
      { indicator: 'POLICY PATH', value: 'UNKNOWN', direction: 'neutral', magnitude: 'extreme' },
    ],
    eventFeed: [
      { category: 'REFLEXIVITY', text: 'Expected response is now priced into the setup it was a response to' },
      { category: 'LEARNING', text: 'The market updated after round four, changing what round five is' },
      { category: 'RULE', text: 'A rule that everyone runs stops producing what it produced' },
      { category: 'MACHINE', text: 'Machine keeps the rule and reduces the size it is expressed at' },
    ],
    portfolioEffect: { returnBias: -0.009, volatilityDelta: 0.02, correlationLevel: 0.7 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'The rule is sound and its edge is smaller now that it is widely run',
        'Keeping a rule and reducing its size is not the same as suspending it',
        'Suspending a rule because it is crowded replaces a process with a forecast',
      ],
      policyReason: 'Keep the rule, express it smaller. Crowding changes the size, not the process.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'KEEP THE RULE: same process, smaller size',
        shortLabel: 'KEEP RULE',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { RULE_ADHERENCE: 8, DECISION_CONSISTENCY: 8, REGIME_ADAPTATION: 6 },
          teachingMessage: 'You kept the process and let the size carry the uncertainty. That is what a machine is for: it does not need to know the outcome to decide how much to commit.',
          machineComparison: 'Machine keeps the rule and reduces the size it is expressed at.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'SUSPEND: stand aside until the pattern is clear',
        shortLabel: 'SUSPEND',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { RULE_ADHERENCE: -6, DECISION_CONSISTENCY: -5 },
          teachingMessage: 'Suspending a rule because it has become crowded means you now need to know when to restart it. You have replaced a process with two forecasts.',
          machineComparison: 'Machine kept the rule at a smaller size.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'MODIFY: invert the rule, fade the crowd',
        shortLabel: 'INVERT',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'CHASING'],
          alphaImpact: { RULE_ADHERENCE: -8, REGIME_ADAPTATION: -6 },
          teachingMessage: 'Inverting a rule after one failure is overfitting to the most recent round, which is the mistake every arena in this game has charged you for.',
          machineComparison: 'Machine kept the rule. One failure is not an inversion signal.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'REDUCE SIZE: keep the rule, hold more cash',
        shortLabel: 'SIZE DOWN',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { RULE_ADHERENCE: 6, POSITION_SIZING: 6, REENTRY_DISCIPLINE: -2 },
          teachingMessage: 'Same answer as the machine reached by a different route: the rule survives and the size carries the uncertainty.',
          machineComparison: 'Machine expressed the same conclusion through position size.',
        },
      },
    ],
    teachingPoint: 'EXPECTED RESPONSE IS NOW PART OF THE MARKET STATE. YOU DO NOT NEED TO BECOME THE MACHINE. YOU NEED A PROCESS THAT CAN OPERATE LIKE ONE WHEN THE ANSWER IS GENUINELY UNKNOWN.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. Keeping the rule and letting size carry the uncertainty is the closing lesson of the entire progression.',
  },
];

export const TACO_ARENA = registerArena({
  id: 'taco_protocol',
  name: 'TACO PROTOCOL',
  order: 5,
  difficulty: 5,
  lesson: 'A rule everyone runs stops paying what it paid. Keep the process and let size carry the uncertainty.',
  window: 'FIVE POLICY ROUNDS',
  checkpoints: TACO_CHECKPOINTS,
  criticalDrawdown: -0.18,
  // Tariff exposure is a company-level input-cost question, so the book is
  // built to have genuinely different exposures rather than one sector to sell.
  startingPortfolio: () => buildPortfolio(
    [
      { symbol: 'F',    weight: 0.10, riskContrib: 0.18, sector: 'AUTOS' },
      { symbol: 'GM',   weight: 0.09, riskContrib: 0.18, sector: 'AUTOS' },
      { symbol: 'NVDA', weight: 0.10, riskContrib: 0.19, sector: 'SEMICONDUCTORS' },
      { symbol: 'AMAT', weight: 0.08, riskContrib: 0.20, sector: 'SEMICONDUCTORS' },
      { symbol: 'WMT',  weight: 0.09, riskContrib: 0.09, sector: 'RETAIL' },
      { symbol: 'CAT',  weight: 0.09, riskContrib: 0.15, sector: 'INDUSTRIALS' },
      { symbol: 'JNJ',  weight: 0.09, riskContrib: 0.07, sector: 'HEALTHCARE' },
      { symbol: 'V',    weight: 0.09, riskContrib: 0.10, sector: 'FINANCIALS' },
      { symbol: 'NEE',  weight: 0.08, riskContrib: 0.09, sector: 'UTILITIES' },
    ],
    { volatility: 0.18, correlationIndex: 0.51, startingCapital: 100000 },
  ),
});
