// ─── Inflation / rate shock (§23) ─────────────────────────────────────────────
//
// Purpose: break the simplistic lesson BUY EVERY DIP.
//
// The two arenas before this one both reward a rule. COVID rewards respecting
// drawdowns; Recovery rewards participating. A player arrives here holding a
// habit, and this regime is where a habit costs money five times in a row.
//
// The closing checkpoint is the one that matters most and is the easiest to get
// wrong: the obvious lesson of 2022 is "rates matter, growth is dangerous", and
// a machine built around that conclusion is overfit in exactly the way the
// dip-buying rule was. §23 names rule overfitting as the thing being tested.
//
// The starting book is deliberately expensive: high multiple, long duration,
// the book a player builds after a recovery.

import type { CheckpointData } from './gameTypes';
import { registerArena, buildPortfolio } from './arenas';

export const INFLATION_CHECKPOINTS: CheckpointData[] = [
  {
    sequence: 1,
    machinePar: 64,
    phase: 'INFLATION_ONSET',
    crisisDay: 'JAN 2022',
    signalTitle: 'THE RULE THAT WORKED: BUY EVERY DIP',
    signalBody: 'Two years of evidence say the same thing. Every decline since March 2020 was a buying opportunity, and the ones who waited underperformed the ones who did not. The market opens the year down 6% and your rule has one answer.',
    marketSignals: [
      { indicator: 'SPX', value: '-6.1%', direction: 'down', magnitude: 'medium' },
      { indicator: '10Y', value: '1.79%', direction: 'up', magnitude: 'medium' },
      { indicator: 'CPI', value: '7.5%', direction: 'up', magnitude: 'extreme' },
      { indicator: 'FED FUNDS', value: '0.25%', direction: 'neutral', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'PATTERN', text: 'Every dip since March 2020 recovered within eight weeks' },
      { category: 'RATES', text: 'Market now prices four rate rises this year, from zero' },
      { category: 'DIVERGENCE', text: 'The dip-buying rule was learned in a zero-rate regime that is ending' },
      { category: 'MACHINE', text: 'Machine checks whether the conditions that made the rule work still hold' },
    ],
    portfolioEffect: { returnBias: -0.021, volatilityDelta: 0.02, correlationLevel: 0.61 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'The dip-buying rule was learned under zero rates and expanding liquidity',
        'Both conditions are being withdrawn deliberately',
        'A rule is only as good as the regime that produced it: verify before repeating',
      ],
      policyReason: 'Rule conditions no longer hold. Wait for evidence rather than repeat the pattern.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: check the rule before repeating it',
        shortLabel: 'VERIFY',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { REGIME_ADAPTATION: 6, RULE_ADHERENCE: 5, DECISION_CONSISTENCY: 4 },
          teachingMessage: 'You asked whether the conditions that made the rule work still hold. That question is the difference between a process and a habit.',
          machineComparison: 'Machine holds and verifies rather than repeating.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: buy the dip, it always works',
        shortLabel: 'BUY DIP',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS', 'OVERCONFIDENCE'],
          alphaImpact: { REGIME_ADAPTATION: -8, RULE_ADHERENCE: -5 },
          teachingMessage: 'It always worked in a regime of zero rates and expanding liquidity. Both are being removed. You are applying a rule to conditions it was never tested in.',
          machineComparison: 'Machine held. The rule outlived its regime.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: rates are rising, cut exposure',
        shortLabel: 'DE-RISK',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { REGIME_ADAPTATION: 4, REENTRY_DISCIPLINE: -2 },
          teachingMessage: 'Reasonable given the policy path, though acting on the first 6% before any confirmation is early.',
          machineComparison: 'Machine waited one checkpoint for confirmation.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: into rate-insensitive names',
        shortLabel: 'ROTATE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { REGIME_ADAPTATION: 6, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'Rotating by rate sensitivity is the right axis for this regime, and slightly early rather than wrong.',
          machineComparison: 'Machine rotated one checkpoint later on the same axis.',
        },
      },
    ],
    teachingPoint: 'BUY-THE-DIP IS NOT A LAW. IT IS A RULE THAT WORKED IN ONE REGIME. THE FIRST QUESTION IS ALWAYS WHETHER THE CONDITIONS THAT PRODUCED IT STILL HOLD.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. Verifying a rule against current conditions before firing it is the process this arena exists to teach.',
  },
  {
    sequence: 2,
    machinePar: 71,
    phase: 'RATE_SHOCK',
    crisisDay: 'MAR 2022',
    signalTitle: 'FIRST RISE IN FOUR YEARS, AND THE DISCOUNT RATE MOVES',
    signalBody: 'The policy rate rises for the first time since 2018. Nothing about your companies changed today. Their earnings, their products and their customers are identical to yesterday. Their present value is not, because the rate those earnings are discounted at has moved.',
    marketSignals: [
      { indicator: 'FED FUNDS', value: '0.50%', direction: 'up', magnitude: 'high' },
      { indicator: '10Y', value: '2.34%', direction: 'up', magnitude: 'high' },
      { indicator: 'LONG DURATION', value: '-14.2%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'EARNINGS EST', value: 'UNCHANGED', direction: 'neutral', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'POLICY', text: 'First rise of the cycle; six more priced for this year' },
      { category: 'VALUATION', text: 'High-multiple names fall hardest with no change to estimates' },
      { category: 'MECHANISM', text: 'Same company, different discount rate, lower present value' },
      { category: 'MACHINE', text: 'Machine reduces by duration rather than by conviction in the business' },
    ],
    portfolioEffect: { returnBias: -0.028, volatilityDelta: 0.03, correlationLevel: 0.68 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'Rate sensitivity, not business quality, is the axis that matters this regime',
        'The most expensive names carry the most duration risk',
        'Reduce by valuation multiple, not by how much the story is liked',
      ],
      policyReason: 'Rate regime confirmed. Reduce the longest-duration exposure first.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: cut the highest-multiple names',
        shortLabel: 'CUT DURATION',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'EARLY_REGIME_SENSITIVITY'],
          alphaImpact: { REGIME_ADAPTATION: 8, POSITION_SIZING: 5 },
          teachingMessage: 'You sold on duration rather than on sentiment. Same company, different discount rate is the whole mechanism of this regime.',
          machineComparison: 'Machine reduced on the same axis.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: the businesses are unchanged',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { REGIME_ADAPTATION: -6, LOSS_CONTROL: -4 },
          teachingMessage: 'The businesses are unchanged and their valuations are not. Holding because the story is intact ignores the only variable that moved.',
          machineComparison: 'Machine reduced. The mechanism is arithmetic, not sentiment.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: quality growth is now cheaper',
        shortLabel: 'BUY QUALITY',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING', 'RECENCY_BIAS'],
          alphaImpact: { REGIME_ADAPTATION: -8, POSITION_SIZING: -5 },
          teachingMessage: 'Cheaper against a discount rate that is still rising is not cheap. This is the dip-buying rule applied to the exposure the regime is punishing.',
          machineComparison: 'Machine reduced exactly what this adds.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: long duration into short duration',
        shortLabel: 'ROTATE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { REGIME_ADAPTATION: 7, CONCENTRATION_CONTROL: 3, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'Rotating along the duration axis keeps you invested while removing the exposure that is repricing. Slightly more turnover than a simple trim.',
          machineComparison: 'Machine trimmed; rotating reaches the same place for a little more cost.',
        },
      },
    ],
    teachingPoint: 'SAME COMPANY. DIFFERENT DISCOUNT RATE. NOTHING ABOUT THE BUSINESS CHANGED AND EVERYTHING ABOUT ITS PRESENT VALUE DID.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Holding on unchanged fundamentals ignores the one variable this regime moves.',
  },
  {
    sequence: 3,
    machinePar: 74,
    phase: 'VALUATION_COMPRESSION',
    crisisDay: 'JUN 2022',
    signalTitle: 'BEAR MARKET: -21%, AND THE OLD RULE WOULD HAVE BOUGHT FIVE TIMES',
    signalBody: 'The index is down 21% from the high. Since January there have been five declines that in the previous regime would each have been a buying opportunity. Every one of them continued lower. This is what a rule failing looks like from the inside.',
    marketSignals: [
      { indicator: 'SPX', value: '-21.3%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'CPI', value: '9.1%', direction: 'up', magnitude: 'extreme' },
      { indicator: 'FED FUNDS', value: '1.75%', direction: 'up', magnitude: 'high' },
      { indicator: 'FAILED BOUNCES', value: '5', direction: 'up', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'PATTERN', text: 'Five bounces since January, all sold into lower lows' },
      { category: 'INFLATION', text: 'Highest print in forty years; policy path steepening' },
      { category: 'RULE', text: 'Buy-drawdown logic has produced five consecutive losses' },
      { category: 'MACHINE', text: 'Machine stopped applying the rule when the regime that produced it ended' },
    ],
    portfolioEffect: { returnBias: -0.034, volatilityDelta: 0.03, correlationLevel: 0.74 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'The book is already sized for this regime: no further rule fires',
        'Selling a 21% decline after de-risking early is selling the bottom of your own process',
        'Inflation, not price, is the variable to watch for the turn',
      ],
      policyReason: 'Already positioned for the regime. No trigger; the work was done earlier.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: already sized for this regime',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { LOSS_CONTROL: 7, DECISION_CONSISTENCY: 6, RULE_ADHERENCE: 5 },
          teachingMessage: 'The reduction that matters happened in March. Holding now is the reward for acting early rather than the failure to act late.',
          machineComparison: 'Machine holds: the position was set when the regime turned.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: 21% down must be the bottom',
        shortLabel: 'BUY',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS', 'OVERCONFIDENCE'],
          alphaImpact: { REGIME_ADAPTATION: -9, LOSS_CONTROL: -6 },
          teachingMessage: 'This is the sixth time the rule has said buy. The previous five were wrong, and nothing in the inflation data has turned.',
          machineComparison: 'Machine held. A price level is not a regime signal.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: capitulate and preserve what is left',
        shortLabel: 'CAPITULATE',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['PANIC_REDUCTION_LARGE'],
          alphaImpact: { LOSS_CONTROL: -5, REENTRY_DISCIPLINE: -6 },
          teachingMessage: 'Selling after a 21% decline, having already de-risked, converts a managed drawdown into a realised one and creates the re-entry problem from the last arena.',
          machineComparison: 'Machine held. The de-risking already happened.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: more room to fall',
        shortLabel: 'MORE CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS'],
          alphaImpact: { LOSS_CONTROL: -2, REENTRY_DISCIPLINE: -5 },
          teachingMessage: 'Defensible instinct, poor timing. Raising cash at the point of maximum pessimism is how the Recovery Trap begins.',
          machineComparison: 'Machine held at the weight it set in March.',
        },
      },
    ],
    teachingPoint: 'RULE FAILURE. BUY-DRAWDOWN LOGIC PERFORMED POORLY. THE CAUSE WAS NOT THE RULE. IT WAS THAT THE UNDERLYING REGIME CHANGED AND THE RULE DID NOT.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. The position was set when the regime turned; holding it is the payoff for that, not passivity.',
  },
  {
    sequence: 4,
    machinePar: 78,
    phase: 'VALUATION_COMPRESSION',
    crisisDay: 'OCT 2022',
    signalTitle: 'THE FIRST COOLER PRINT: ONE DATA POINT OR THE TURN?',
    signalBody: 'Inflation comes in below expectations for the first time in eighteen months. The market rallies 5% in a session. One print is not a trend, and waiting for three confirmed prints means buying 20% higher. Both statements are true.',
    marketSignals: [
      { indicator: 'CPI', value: '7.7%', direction: 'down', magnitude: 'high' },
      { indicator: 'SPX', value: '+5.5%', direction: 'up', magnitude: 'high' },
      { indicator: '10Y', value: '4.05%', direction: 'up', magnitude: 'high' },
      { indicator: 'FED FUNDS', value: '3.75%', direction: 'up', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'INFLATION', text: 'First downside surprise since early 2021' },
      { category: 'CAUTION', text: 'A single print reversed twice before during this cycle' },
      { category: 'COST', text: 'Waiting for full confirmation has historically cost 15-20% of the recovery' },
      { category: 'MACHINE', text: 'Machine deploys a first tranche on the first genuine change in the driving variable' },
    ],
    portfolioEffect: { returnBias: 0.026, volatilityDelta: -0.02, correlationLevel: 0.58 },
    machineDecision: {
      actionCode: 'STAGED_BUY',
      reasoning: [
        'The variable that drove the regime has turned for the first time',
        'One print is not confirmation, which is why the response is one tranche',
        'Staging converts an unanswerable timing question into a sizing decision',
      ],
      policyReason: 'Driving variable turned. First tranche deployed; confirmation buys the rest.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'STAGED_BUY',
        label: 'STAGED: one tranche on the first real change',
        shortLabel: 'STAGE IN',
        turnoverCost: 0.03,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { REENTRY_DISCIPLINE: 8, REGIME_ADAPTATION: 6 },
          teachingMessage: 'Staging is how you act on incomplete evidence without pretending it is complete. You do not need to know whether this is the turn.',
          machineComparison: 'Machine deployed one tranche on the same reasoning.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: one print proves nothing',
        shortLabel: 'WAIT',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['REENTRY_DELAY'],
          alphaImpact: { REENTRY_DISCIPLINE: -6, REGIME_ADAPTATION: -3 },
          teachingMessage: 'One print proves nothing and three prints cost twenty percent. The arena you just played was built on exactly this hesitation.',
          machineComparison: 'Machine staged in. Certainty is the most expensive thing to wait for.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: deploy everything, the turn is in',
        shortLabel: 'ALL IN',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE'],
          alphaImpact: { REENTRY_DISCIPLINE: 3, POSITION_SIZING: -6 },
          teachingMessage: 'Right direction on one data point at full size. The sizing claims a confidence the evidence does not support.',
          machineComparison: 'Machine deployed one tranche, not the book.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: sell the rally',
        shortLabel: 'FADE',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'RECENCY_BIAS'],
          alphaImpact: { REGIME_ADAPTATION: -7, REENTRY_DISCIPLINE: -5 },
          teachingMessage: 'Fading the first improvement in the driving variable because the last eighteen months were bad is the recovery trap starting again.',
          machineComparison: 'Machine bought a first tranche.',
        },
      },
    ],
    teachingPoint: 'ONE PRINT IS NOT A TREND AND WAITING FOR THREE COSTS TWENTY PERCENT. STAGING IS HOW A PROCESS ACTS ON EVIDENCE THAT IS REAL BUT INCOMPLETE.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Holding for full confirmation is the hesitation the Recovery Trap already charged you for.',
  },
  {
    sequence: 5,
    machinePar: 80,
    phase: 'VALUATION_COMPRESSION',
    crisisDay: 'DEC 2022',
    signalTitle: 'THE YEAR ENDS AND THE OVERFIT IS THE REAL RISK',
    signalBody: 'Down 19% on the year. The lesson available now is that rates matter and expensive growth is dangerous, and a machine built entirely around that will be exactly wrong for the next regime the way the dip-buying rule was wrong for this one.',
    marketSignals: [
      { indicator: 'SPX 2022', value: '-19.4%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'CPI', value: '6.5%', direction: 'down', magnitude: 'high' },
      { indicator: '10Y', value: '3.87%', direction: 'neutral', magnitude: 'medium' },
      { indicator: 'GROWTH VS VALUE', value: '-22%', direction: 'down', magnitude: 'extreme' },
    ],
    eventFeed: [
      { category: 'YEAR', text: 'Worst year since 2008 for a balanced book' },
      { category: 'LESSON', text: 'The obvious conclusion is that rates matter and growth is dangerous' },
      { category: 'RISK', text: 'That conclusion is a rule learned from one regime, exactly like the last one' },
      { category: 'MACHINE', text: 'Machine writes rules with conditions attached rather than conclusions' },
    ],
    portfolioEffect: { returnBias: 0.004, volatilityDelta: -0.02, correlationLevel: 0.52 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'The book is at policy after staging back in',
        'A year end is not a portfolio trigger',
        'The rule to write is conditional, not the conclusion this year happens to support',
      ],
      policyReason: 'At policy, no trigger. The lesson to record is a condition, not a conclusion.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: at policy, record the condition not the conclusion',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { DECISION_CONSISTENCY: 7, RULE_ADHERENCE: 6, REGIME_ADAPTATION: 5 },
          teachingMessage: 'You finished the regime without converting it into the next overfit. A rule with its conditions attached survives; a conclusion does not.',
          machineComparison: 'Machine holds and records the condition rather than the conclusion.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: growth is structurally broken',
        shortLabel: 'CUT GROWTH',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS', 'ANCHORING'],
          alphaImpact: { REGIME_ADAPTATION: -7, RULE_ADHERENCE: -4 },
          teachingMessage: 'This is the overfit forming. You are writing the 2022 rule the way you wrote the 2020 rule, and it will fail the same way.',
          machineComparison: 'Machine held. One regime is not a law.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: it fell most so it recovers most',
        shortLabel: 'MEAN REVERT',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING'],
          alphaImpact: { REGIME_ADAPTATION: -5, POSITION_SIZING: -4 },
          teachingMessage: 'Largest decline does not imply largest recovery. That is a pattern, not a mechanism, and this arena is about the difference.',
          machineComparison: 'Machine held at policy.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: build a permanently defensive book',
        shortLabel: 'GO DEFENSIVE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { REGIME_ADAPTATION: -6, REENTRY_DISCIPLINE: -5 },
          teachingMessage: 'A permanently defensive book is the Recovery Trap written as policy. You already know what that costs.',
          machineComparison: 'Machine held at policy weight.',
        },
      },
    ],
    teachingPoint: 'THE REAL RISK NOW IS OVERFITTING TO THE REGIME YOU JUST SURVIVED. WRITE THE RULE WITH ITS CONDITIONS ATTACHED, OR YOU HAVE ONLY SWAPPED WHICH REGIME WILL BREAK YOU.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. Ending a regime without overfitting to it is the hardest discipline in the game.',
  },
];

export const INFLATION_ARENA = registerArena({
  id: 'inflation_shift',
  name: 'INFLATION SHIFT',
  order: 3,
  difficulty: 4,
  lesson: 'A rule is only as good as the regime that produced it. Verify the conditions before firing it again.',
  window: 'JAN 2022 - DEC 2022',
  checkpoints: INFLATION_CHECKPOINTS,
  criticalDrawdown: -0.25,
  startingPortfolio: () => buildPortfolio(
    [
      { symbol: 'NVDA', weight: 0.12, riskContrib: 0.20, sector: 'TECHNOLOGY' },
      { symbol: 'MSFT', weight: 0.11, riskContrib: 0.14, sector: 'TECHNOLOGY' },
      { symbol: 'CRM',  weight: 0.09, riskContrib: 0.18, sector: 'TECHNOLOGY' },
      { symbol: 'TSLA', weight: 0.09, riskContrib: 0.22, sector: 'CONSUMER DISCRETIONARY' },
      { symbol: 'AMZN', weight: 0.10, riskContrib: 0.16, sector: 'CONSUMER DISCRETIONARY' },
      { symbol: 'JNJ',  weight: 0.08, riskContrib: 0.07, sector: 'HEALTHCARE' },
      { symbol: 'XOM',  weight: 0.07, riskContrib: 0.13, sector: 'ENERGY' },
      { symbol: 'PG',   weight: 0.07, riskContrib: 0.06, sector: 'CONSUMER STAPLES' },
    ],
    { volatility: 0.19, correlationIndex: 0.55, startingCapital: 100000 },
  ),
});
