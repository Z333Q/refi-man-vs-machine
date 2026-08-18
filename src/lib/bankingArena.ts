// ─── Banking stress (§24) ─────────────────────────────────────────────────────
//
//   JPM  BAC  C  WFC  GS  MS
//   6 TICKERS
//   1 DOMINANT ECONOMIC RISK CLUSTER
//
// The arena hands the player exactly that book, because the lesson cannot be
// taught in the abstract. Six names, six management teams, six business mixes,
// one funding environment. The player has to be holding it when correlation
// converges or the point is a diagram rather than an experience.
//
// The last checkpoint is the one the arena is really for. Banks stabilise, and
// the player's remaining book has quietly become a second cluster in a
// different sector. A rule applied only to the thing that hurt you is a memory,
// not a policy.

import type { CheckpointData } from './gameTypes';
import { registerArena, buildPortfolio } from './arenas';

export const BANKING_CHECKPOINTS: CheckpointData[] = [
  {
    sequence: 1,
    machinePar: 63,
    phase: 'FUNDING_STRESS',
    crisisDay: 'MAR 8 2023',
    signalTitle: 'SIX TICKERS. HOW MANY RISKS?',
    signalBody: 'Your book holds JPM, BAC, C, WFC, GS and MS at 8% each: 48% in six separate companies with six different management teams and six different business mixes. A regional lender announces a capital raise after selling securities at a loss. The word contagion has not been used yet.',
    marketSignals: [
      { indicator: 'FINANCIALS', value: '48%', direction: 'neutral', magnitude: 'extreme' },
      { indicator: 'CORR(BANKS)', value: '0.71', direction: 'up', magnitude: 'high' },
      { indicator: 'REGIONAL', value: '-9.2%', direction: 'down', magnitude: 'high' },
      { indicator: '2Y YIELD', value: '4.86%', direction: 'down', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'FUNDING', text: 'A regional lender raises capital after realising losses on its securities book' },
      { category: 'MECHANISM', text: 'Rate rises devalued long-duration holdings across the whole sector' },
      { category: 'PORTFOLIO', text: 'Six bank tickers, one funding environment, one rate exposure' },
      { category: 'MACHINE', text: 'Machine measures the cluster, not the ticker count' },
    ],
    portfolioEffect: { returnBias: -0.014, volatilityDelta: 0.02, correlationLevel: 0.71 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'Six names at 48% share one funding environment and one duration exposure',
        'Diversification is measured in economic exposure, not in ticker count',
        'Reduce the cluster before the market decides whether it is a cluster',
      ],
      policyReason: 'Sector cluster at 48% with 0.71 internal correlation. Reduce on concentration rule.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: trim the bank cluster on concentration',
        shortLabel: 'TRIM CLUSTER',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'EARLY_REGIME_SENSITIVITY'],
          alphaImpact: { CONCENTRATION_CONTROL: 9, RULE_ADHERENCE: 5 },
          teachingMessage: 'You counted risks rather than tickers. Six names sharing one funding environment is one position wearing six names.',
          machineComparison: 'Machine trims the cluster on the same measure.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: six different banks is diversified',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { CONCENTRATION_CONTROL: -9, REGIME_ADAPTATION: -4 },
          teachingMessage: 'Six tickers, one economic exposure. Internal correlation is 0.71 and rising. The diversification is nominal.',
          machineComparison: 'Machine trimmed. Ticker count is not risk measurement.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: banks are cheap and well capitalised',
        shortLabel: 'ADD BANKS',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'CHASING'],
          alphaImpact: { CONCENTRATION_CONTROL: -10, POSITION_SIZING: -6 },
          teachingMessage: 'Adding to a 48% correlated cluster at the first sign of funding stress is increasing the exposure that just announced itself.',
          machineComparison: 'Machine reduced exactly what this adds.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: banks into staples and healthcare',
        shortLabel: 'ROTATE OUT',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { CONCENTRATION_CONTROL: 7, REGIME_ADAPTATION: 4, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'Right direction and slightly more expensive than a trim. Reducing the cluster is the decision that matters.',
          machineComparison: 'Machine trimmed rather than rotating: same concentration result, less turnover.',
        },
      },
    ],
    teachingPoint: 'SIX TICKERS. ONE DOMINANT ECONOMIC RISK CLUSTER. YOUR PORTFOLIO LOOKED DIVERSIFIED AND ITS EXPOSURE WAS NOT.',
    isRegimeChange: false,
    isHoldValid: false,
    holdTeaching: 'Holding 48% in one correlated cluster is a concentration decision, whatever the ticker count says.',
  },
  {
    sequence: 2,
    machinePar: 72,
    phase: 'CONTAGION',
    crisisDay: 'MAR 10 2023',
    signalTitle: 'A BANK FAILS IN 48 HOURS',
    signalBody: 'The sixteenth largest bank in the country is closed by regulators two days after announcing it was well capitalised. Depositors moved 42 billion dollars in a single day. Nothing about your six holdings changed, and every one of them fell.',
    marketSignals: [
      { indicator: 'SVB', value: 'CLOSED', direction: 'down', magnitude: 'extreme' },
      { indicator: 'CORR(BANKS)', value: '0.94', direction: 'up', magnitude: 'extreme' },
      { indicator: 'FINANCIALS', value: '-12.1%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'VIX', value: '26.5', direction: 'up', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'FAILURE', text: 'Regulators close the bank; deposits exceed insured limits by a wide margin' },
      { category: 'SPEED', text: 'A digital bank run moved 42 billion dollars in one day' },
      { category: 'CORRELATION', text: 'Internal bank correlation moves from 0.71 to 0.94 in 48 hours' },
      { category: 'MACHINE', text: 'Machine treats correlation convergence as the primary contagion signal' },
    ],
    portfolioEffect: { returnBias: -0.042, volatilityDelta: 0.05, correlationLevel: 0.94 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'Correlation at 0.94 means the cluster now trades as one instrument',
        'The distinction between a strong bank and a weak one has stopped being priced',
        'Reduce the systemic exposure, not the individual names',
      ],
      policyReason: 'Correlation converged to 0.94. The cluster is one position; reduce it as one.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: cut the systemic exposure',
        shortLabel: 'CUT SYSTEMIC',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { CONCENTRATION_CONTROL: 8, LOSS_CONTROL: 6, REGIME_ADAPTATION: 5 },
          teachingMessage: 'At 0.94 correlation the market has stopped distinguishing between your banks. Selling the cluster is selling the risk that is actually present.',
          machineComparison: 'Machine reduced the cluster as one exposure.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: my banks are the strong ones',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'OVERCONFIDENCE'],
          alphaImpact: { CONCENTRATION_CONTROL: -8, LOSS_CONTROL: -7 },
          teachingMessage: 'They may well be. At 0.94 correlation that distinction is not being priced, and being right about credit quality does not help while the cluster trades as one.',
          machineComparison: 'Machine reduced. Contagion prices the sector, not the balance sheet.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: the survivors take the deposits',
        shortLabel: 'BUY SURVIVORS',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CONTRARIAN_EARLY', 'OVERCONFIDENCE'],
          alphaImpact: { CONCENTRATION_CONTROL: -9, LOSS_CONTROL: -6 },
          teachingMessage: 'The thesis may prove right later. Acting on it during the convergence adds to the cluster at its most correlated moment.',
          machineComparison: 'Machine reduced first. The thesis survives the reduction; the drawdown might not.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: step out until it resolves',
        shortLabel: 'CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { LOSS_CONTROL: 5, CONCENTRATION_CONTROL: 4, REENTRY_DISCIPLINE: -3 },
          teachingMessage: 'Effective on risk and blunt as an instrument. It also recreates the re-entry problem from an earlier arena.',
          machineComparison: 'Machine reduced the cluster specifically rather than the whole book.',
        },
      },
    ],
    teachingPoint: 'CORRELATION WENT FROM 0.71 TO 0.94 IN FORTY-EIGHT HOURS. CONTAGION IS NOT A STORY ABOUT ONE BANK. IT IS THE MOMENT DIVERSIFICATION STOPS EXISTING.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Holding through correlation convergence keeps the exposure precisely as it stops being diversified.',
  },
  {
    sequence: 3,
    machinePar: 77,
    phase: 'CONTAGION',
    crisisDay: 'MAR 16 2023',
    signalTitle: 'THE BACKSTOP ARRIVES, AND SO DOES THE NEXT NAME',
    signalBody: 'Regulators guarantee deposits and open an emergency lending facility. The same week a second US bank fails and a systemically important European bank is forced into a merger. Policy support and continued failures are happening simultaneously.',
    marketSignals: [
      { indicator: 'BACKSTOP', value: 'ANNOUNCED', direction: 'up', magnitude: 'high' },
      { indicator: '2ND FAILURE', value: 'CONFIRMED', direction: 'down', magnitude: 'high' },
      { indicator: 'CS', value: 'FORCED MERGER', direction: 'down', magnitude: 'extreme' },
      { indicator: 'CORR(BANKS)', value: '0.89', direction: 'down', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'POLICY', text: 'Deposit guarantee and emergency lending facility announced' },
      { category: 'FAILURE', text: 'A second US institution fails and a European bank is merged under pressure' },
      { category: 'AMBIGUITY', text: 'Support arrives and the failures continue: both are true' },
      { category: 'MACHINE', text: 'Machine acts on funding conditions, not on the announcement' },
    ],
    portfolioEffect: { returnBias: -0.008, volatilityDelta: -0.01, correlationLevel: 0.89 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'The cluster was already reduced: the exposure that mattered is smaller',
        'Policy support does not immediately restore the price of risk',
        'No further rule fires at the current weight',
      ],
      policyReason: 'Exposure already reduced. Support does not itself constitute a re-entry signal.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: exposure already reduced, no new trigger',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { DECISION_CONSISTENCY: 7, LOSS_CONTROL: 5 },
          teachingMessage: 'The work happened before the backstop. Holding a reduced position through the ambiguity is the payoff for acting on the correlation rather than the headline.',
          machineComparison: 'Machine holds at the reduced weight.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: the backstop makes banks safe',
        shortLabel: 'BUY BACKSTOP',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING', 'OVERCONFIDENCE'],
          alphaImpact: { REGIME_ADAPTATION: -6, LOSS_CONTROL: -5 },
          teachingMessage: 'A guarantee stops a run. It does not repair the earnings power a rate cycle removed, and a second bank failed the same week.',
          machineComparison: 'Machine held. Policy support is not the same as resolution.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: cut the remaining banks entirely',
        shortLabel: 'EXIT BANKS',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['PANIC_REDUCTION_LARGE'],
          alphaImpact: { CONCENTRATION_CONTROL: 2, REENTRY_DISCIPLINE: -6 },
          teachingMessage: 'Exiting entirely after the backstop is selling into the support. The concentration decision was already made correctly.',
          machineComparison: 'Machine held the reduced position rather than exiting it.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: remaining banks into utilities',
        shortLabel: 'ROTATE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { CONCENTRATION_CONTROL: 3, TURNOVER_DISCIPLINE: -4 },
          teachingMessage: 'Defensible, and it spends turnover on an exposure already cut once. The first reduction did the work.',
          machineComparison: 'Machine held: the cluster is already inside policy.',
        },
      },
    ],
    teachingPoint: 'SUPPORT AND FAILURE ARRIVED IN THE SAME WEEK. AN ANNOUNCEMENT IS NOT A RESOLUTION, AND THE DECISION THAT MATTERED WAS MADE BEFORE EITHER.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. The exposure was reduced on evidence before the announcement, so the announcement changes nothing.',
  },
  {
    sequence: 4,
    machinePar: 81,
    phase: 'FUNDING_STRESS',
    crisisDay: 'MAY 2023',
    signalTitle: 'THE CLUSTER YOU DID NOT MEASURE',
    signalBody: 'Banks stabilise. Meanwhile your remaining book has quietly become 34% in three technology names on the argument that they are unrelated to financials. They are unrelated to financials. They are 0.88 correlated with each other.',
    marketSignals: [
      { indicator: 'TECH CLUSTER', value: '34%', direction: 'up', magnitude: 'high' },
      { indicator: 'CORR(TECH)', value: '0.88', direction: 'up', magnitude: 'high' },
      { indicator: 'FINANCIALS', value: 'STABILISING', direction: 'up', magnitude: 'medium' },
      { indicator: 'RISK CLUSTERS', value: '2', direction: 'down', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'CONCENTRATION', text: 'Three technology names at 34% with 0.88 internal correlation' },
      { category: 'IRONY', text: 'The lesson was learned about banks and applied to nothing else' },
      { category: 'MEASURE', text: 'Nine holdings, two effective risk clusters' },
      { category: 'MACHINE', text: 'Machine applies the cluster rule to every cluster, not to the one that hurt' },
    ],
    portfolioEffect: { returnBias: 0.012, volatilityDelta: -0.01, correlationLevel: 0.66 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'The concentration rule is not about banks: it is about correlated exposure',
        'Three names at 34% with 0.88 correlation is the same shape as the bank cluster',
        'Apply the rule uniformly or it is not a rule',
      ],
      policyReason: 'Second cluster breaches the same concentration rule. Trim on the same measure.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: apply the cluster rule to tech too',
        shortLabel: 'TRIM TECH',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { CONCENTRATION_CONTROL: 9, RULE_ADHERENCE: 7 },
          teachingMessage: 'You applied the lesson to a cluster that had not yet hurt you. That is the difference between learning a rule and remembering an event.',
          machineComparison: 'Machine applies the same rule to every cluster.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: tech is not banks',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'RECENCY_BIAS'],
          alphaImpact: { CONCENTRATION_CONTROL: -8, RULE_ADHERENCE: -6 },
          teachingMessage: 'Correct that tech is not banks, and irrelevant. The rule is about correlated exposure, and you have rebuilt the same shape in a different sector.',
          machineComparison: 'Machine trimmed. The rule was never about banks.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: tech led the recovery',
        shortLabel: 'ADD TECH',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING', 'OVERCONFIDENCE'],
          alphaImpact: { CONCENTRATION_CONTROL: -10, POSITION_SIZING: -6 },
          teachingMessage: 'Adding to a 34% cluster at 0.88 correlation, in the arena about correlated clusters, is the lesson failing in real time.',
          machineComparison: 'Machine reduced it.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: spread the excess across sectors',
        shortLabel: 'DIVERSIFY',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { CONCENTRATION_CONTROL: 8, RULE_ADHERENCE: 5, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'Reducing the cluster and genuinely spreading the proceeds is the most complete answer available, at slightly higher turnover.',
          machineComparison: 'Machine trimmed; spreading the proceeds reaches the same place.',
        },
      },
    ],
    teachingPoint: 'YOU LEARNED THE RULE ABOUT THE CLUSTER THAT HURT YOU AND REBUILT THE SAME SHAPE SOMEWHERE ELSE. A RULE APPLIED TO ONE SECTOR IS A MEMORY, NOT A POLICY.',
    isRegimeChange: false,
    isHoldValid: false,
    holdTeaching: 'Holding a second 34% cluster after the first one nearly failed is remembering an event rather than learning a rule.',
  },
];

export const BANKING_ARENA = registerArena({
  id: 'banking_stress',
  name: 'BANKING STRESS',
  order: 4,
  difficulty: 4,
  lesson: 'Diversification is measured in economic exposure, never in ticker count.',
  window: 'MAR 2023 - MAY 2023',
  checkpoints: BANKING_CHECKPOINTS,
  // Contagion is fast and deep. A wider budget than Recovery so the arena can
  // teach the concentration lesson rather than ending the run on the shock.
  criticalDrawdown: -0.22,
  startingPortfolio: () => buildPortfolio(
    [
      { symbol: 'JPM', weight: 0.08, riskContrib: 0.14, sector: 'FINANCIALS' },
      { symbol: 'BAC', weight: 0.08, riskContrib: 0.15, sector: 'FINANCIALS' },
      { symbol: 'C',   weight: 0.08, riskContrib: 0.17, sector: 'FINANCIALS' },
      { symbol: 'WFC', weight: 0.08, riskContrib: 0.16, sector: 'FINANCIALS' },
      { symbol: 'GS',  weight: 0.08, riskContrib: 0.18, sector: 'FINANCIALS' },
      { symbol: 'MS',  weight: 0.08, riskContrib: 0.18, sector: 'FINANCIALS' },
      { symbol: 'MSFT', weight: 0.12, riskContrib: 0.13, sector: 'TECHNOLOGY' },
      { symbol: 'NVDA', weight: 0.11, riskContrib: 0.19, sector: 'TECHNOLOGY' },
      { symbol: 'AAPL', weight: 0.11, riskContrib: 0.12, sector: 'TECHNOLOGY' },
      { symbol: 'JNJ',  weight: 0.08, riskContrib: 0.07, sector: 'HEALTHCARE' },
    ],
    { volatility: 0.17, correlationIndex: 0.62, startingCapital: 100000 },
  ),
});
