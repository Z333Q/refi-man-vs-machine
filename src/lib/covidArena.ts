import type { CheckpointData } from './gameTypes';

// ─── COVID Black Swan Arena ───────────────────────────────────────────────────
// U.S. equities only. The player manages a 10-stock equity portfolio through
// the March 2020 crisis. Bonds, gold, and commodities appear only as context.
//
// Starting portfolio:
//   MSFT 10% | AAPL 10% | JPM 10% | DAL 8% | MAR 8% |
//   XOM  8%  | JNJ  8%  | PG  8%  | CAT 8% | HD  7% | CASH 15%
//
// Structural risks embedded:
//   TRAVEL CLUSTER       DAL + MAR = 16%
//   CYCLICAL CLUSTER     CAT + XOM + HD = 23%
//   TECH CONCENTRATION   MSFT + AAPL = 20%
//   FINANCIAL EXPOSURE   JPM = 10%
//   DEFENSIVE CUSHION    JNJ + PG = 16%

export const COVID_ARENA_ID = 'covid_black_swan';
export const COVID_CRITICAL_DRAWDOWN = -0.20;
export const COVID_MAX_SECTOR = 0.30;

export const COVID_CHECKPOINTS: CheckpointData[] = [

  // ───────────────────────────────────────────────────────────────────────────
  // CP 01 · Jan 22 · BACKGROUND_NOISE
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 1,
    machinePar: 64,
    phase: 'BACKGROUND_NOISE',
    crisisDay: 'JAN 22',
    signalTitle: 'WUHAN CLUSTER: EARLY REPORTS',
    signalBody: 'A respiratory illness cluster in Wuhan. WHO is monitoring. Chinese authorities confirm human-to-human transmission is possible. Market consensus: contained within 6-8 weeks. S&P 500 at all-time highs.',
    marketSignals: [
      { indicator: 'SPX', value: '-0.3%', direction: 'down', magnitude: 'low' },
      { indicator: 'VIX', value: '13.2', direction: 'neutral', magnitude: 'low' },
      { indicator: 'AIRLINES', value: '-1.4%', direction: 'down', magnitude: 'low' },
      { indicator: 'HOTELS', value: '-0.9%', direction: 'down', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'HEALTH', text: 'Wuhan cluster: human-to-human transmission confirmed', relevantAssets: ['DAL', 'MAR'] },
      { category: 'TRAVEL', text: 'Airlines begin monitoring Wuhan-route passengers', relevantAssets: ['DAL'] },
      { category: 'CONSENSUS', text: 'Analysts citing SARS 2003 template: contained within 6-8 weeks' },
      { category: 'MARKETS', text: 'S&P 500 at all-time high. No tail risk priced.' },
    ],
    portfolioEffect: { returnBias: 0.002, volatilityDelta: 0.01, correlationLevel: 0.30 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Single unconfirmed outbreak: no policy trigger reached',
        'Travel exposure (DAL + MAR = 16%) below concentration threshold',
        'SARS analogy: 2003 resolved in 8 weeks with limited economic impact',
        'Market at ATH: no drawdown, no risk flag',
      ],
      policyReason: 'Hold. One data point. No portfolio policy trigger reached.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: single report, no confirmed outbreak pattern',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE'],
          alphaImpact: { TURNOVER_DISCIPLINE: 3, RULE_ADHERENCE: 2 },
          teachingMessage: 'Correct process. One signal does not justify portfolio action. No trigger reached.',
          machineComparison: 'Machine holds. No confirmed outbreak. No policy threshold crossed.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE DAL/MAR: travel exposure is obvious vulnerability',
        shortLabel: 'REDUCE TRAVEL',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['EARLY_REGIME_SENSITIVITY'],
          alphaImpact: { REGIME_ADAPTATION: 4, TURNOVER_DISCIPLINE: -3 },
          teachingMessage: 'Unusually early: but the travel vulnerability is real. Cost is turnover. If outbreak develops, this was prescient. If not, it was unnecessary churn.',
          machineComparison: 'Machine holds. Signal too weak. Your travel reduction is early but not wrong in direction.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: headline risk is real',
        shortLabel: 'RAISE CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['ACTION_BIAS'],
          alphaImpact: { TURNOVER_DISCIPLINE: -5, POSITION_SIZING: -3 },
          teachingMessage: 'Overreaction. Portfolio-wide cash raise on one ambiguous report adds turnover cost without edge.',
          machineComparison: 'Machine holds. Cash drag on uncertain signal is poor risk-adjusted process.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: cyclicals to healthcare/staples',
        shortLabel: 'ROTATE DEFENSIVE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['ACTION_BIAS', 'RECENCY_BIAS'],
          alphaImpact: { TURNOVER_DISCIPLINE: -4, REGIME_ADAPTATION: -2 },
          teachingMessage: 'No confirmed regime shift. Rotating on background noise incurs unnecessary turnover.',
          machineComparison: 'Machine holds. Rotation not warranted at this signal level.',
        },
      },
    ],
    teachingPoint: 'BACKGROUND NOISE IS NOT A SIGNAL. ACTING ON EVERY EARLY REPORT ACCUMULATES TURNOVER COST WITHOUT EDGE.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. One unconfirmed data point: no trigger. Machine also holds.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 02 · Jan 30 · BACKGROUND_NOISE
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 2,
    machinePar: 63,
    phase: 'BACKGROUND_NOISE',
    crisisDay: 'JAN 30',
    signalTitle: 'WHO GLOBAL HEALTH EMERGENCY',
    signalBody: 'WHO declares a Public Health Emergency of International Concern. Multiple airlines suspend China routes. Marriott warns of Asia-Pacific occupancy impact. DAL -3.7% today. MAR -2.9%.',
    marketSignals: [
      { indicator: 'SPX', value: '-1.8%', direction: 'down', magnitude: 'medium' },
      { indicator: 'DAL', value: '-3.7%', direction: 'down', magnitude: 'medium' },
      { indicator: 'MAR', value: '-2.9%', direction: 'down', magnitude: 'medium' },
      { indicator: 'VIX', value: '17.4', direction: 'up', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'WHO', text: 'Global Health Emergency declared: strongest WHO alert level', relevantAssets: ['DAL', 'MAR'] },
      { category: 'AIRLINES', text: 'American, United suspend China routes. DAL monitoring.', relevantAssets: ['DAL'] },
      { category: 'HOTELS', text: 'Marriott: Asia-Pacific occupancy demand declining', relevantAssets: ['MAR'] },
      { category: 'MARKETS', text: 'Travel and leisure sector leading broad selloff today' },
    ],
    portfolioEffect: { returnBias: -0.014, volatilityDelta: 0.02, correlationLevel: 0.38 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'WHO emergency declaration is a confirmed escalation: not background noise',
        'DAL: Asia routes being cancelled: direct revenue impairment',
        'MAR: Asia-Pacific occupancy declining: this is a revenue event, not demand softening',
        'Travel cluster (DAL + MAR = 16%) warrants reduction on this confirmed catalyst',
      ],
      policyReason: 'Reduce travel exposure. WHO emergency triggers sector-specific risk policy.',
      targetChanges: [
        { asset: 'DAL', direction: 'decrease', magnitude: 0.04 },
        { asset: 'MAR', direction: 'decrease', magnitude: 0.03 },
      ],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REDUCE DAL/MAR: WHO emergency is the real trigger',
        shortLabel: 'REDUCE TRAVEL',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { LOSS_CONTROL: 5, REGIME_ADAPTATION: 4, TURNOVER_DISCIPLINE: 2 },
          teachingMessage: 'Good process. WHO emergency + route cancellations = confirmed revenue impairment. Reducing travel is the correct response.',
          machineComparison: 'Machine reduces DAL and MAR. Revenue impairment has a confirmed catalyst. Same decision.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: outbreak may still be contained quickly',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { LOSS_CONTROL: -3, REGIME_ADAPTATION: -2 },
          teachingMessage: 'Anchoring to the SARS template. WHO emergency is a threshold above background noise: machine acts here.',
          machineComparison: 'Machine reduces travel. Holding at WHO emergency signal is behind the risk curve.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: sell travel, add JNJ/PG',
        shortLabel: 'ROTATE DEFENSIVE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { REGIME_ADAPTATION: 3, LOSS_CONTROL: 3, TURNOVER_DISCIPLINE: -1 },
          teachingMessage: 'Sound direction. Rotating into healthcare and staples is valid: marginally more turnover than targeted reduction.',
          machineComparison: 'Machine targets DAL/MAR specifically. Rotation into defensives is the right direction.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: convert travel exposure to dry powder',
        shortLabel: 'RAISE CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['CASH_DRAG'],
          alphaImpact: { LOSS_CONTROL: 2, POSITION_SIZING: -2 },
          teachingMessage: 'Cash avoids the travel loss but introduces drag. Moving to specific defensive equities is better than undeployed capital at this stage.',
          machineComparison: 'Machine rotates specifically. Broad cash raise loses equity optionality if outbreak resolves.',
        },
      },
    ],
    teachingPoint: 'WHO EMERGENCY + ROUTE CANCELLATIONS = DIRECT REVENUE IMPAIRMENT. THE MACHINE DISTINGUISHES BETWEEN MARKET ANXIETY AND CONFIRMED BUSINESS IMPACT.',
    isRegimeChange: false,
    isHoldValid: false,
    holdTeaching: 'Hold was valid at CP1. WHO emergency with route cancellations is confirmed revenue impairment: action warranted.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 03 · Feb 12 · BACKGROUND_NOISE
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 3,
    machinePar: 64,
    phase: 'BACKGROUND_NOISE',
    crisisDay: 'FEB 12',
    signalTitle: 'DIAMOND PRINCESS: SPREAD MECHANICS VISIBLE',
    signalBody: 'Diamond Princess cruise ship: 355 cases among 3,700 passengers in a controlled environment. AAPL revises Q1 revenue guidance down citing China supply chain. Markets still near all-time highs: extreme disconnect between outbreak data and market pricing.',
    marketSignals: [
      { indicator: 'SPX', value: '+0.4%', direction: 'up', magnitude: 'low' },
      { indicator: 'AAPL', value: '+2.1%', direction: 'up', magnitude: 'low' },
      { indicator: 'MSFT', value: '+1.8%', direction: 'up', magnitude: 'low' },
      { indicator: 'VIX', value: '14.8', direction: 'neutral', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'OUTBREAK', text: 'Diamond Princess: 9.6% infection rate in controlled environment', relevantAssets: ['DAL', 'MAR'] },
      { category: 'SUPPLY CHAIN', text: 'AAPL cuts Q1 revenue guidance: China factory disruption', relevantAssets: ['AAPL'] },
      { category: 'MARKETS', text: 'S&P 500 at all-time highs. Outbreak narrative: still contained.' },
      { category: 'DISCONNECT', text: 'Outbreak data accelerating. Market disagrees.' },
    ],
    portfolioEffect: { returnBias: 0.005, volatilityDelta: 0.00, correlationLevel: 0.32 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Market at all-time highs: no portfolio drawdown trigger',
        'Travel reduction already completed at CP2',
        'AAPL supply chain warning is worth monitoring: not yet an action',
        'Diamond Princess is a contained ship environment: not community spread',
      ],
      policyReason: 'Hold. No new portfolio policy trigger. Travel already reduced.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: market at ATH, travel already reduced',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE'],
          alphaImpact: { TURNOVER_DISCIPLINE: 3, RULE_ADHERENCE: 2 },
          teachingMessage: 'Correct. Portfolio already adjusted at CP2. Market disagrees with outbreak data. Machine holds.',
          machineComparison: 'Machine holds. No new trigger. Travel reduction already done.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE AAPL: supply chain risk visible',
        shortLabel: 'REDUCE AAPL',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { STOCK_SELECTION: 3, REGIME_ADAPTATION: 2, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'AAPL guidance cut is a real signal. Reducing on confirmed supply chain disruption is valid stock-selection logic.',
          machineComparison: 'Machine holds AAPL for now: guidance cut is manageable. Your AAPL reduction is defensible.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD EQUITIES: market confirming no systemic risk',
        shortLabel: 'ADD EQUITIES',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING', 'OVERCONFIDENCE'],
          alphaImpact: { TURNOVER_DISCIPLINE: -3, POSITION_SIZING: -4 },
          teachingMessage: 'Adding equities when outbreak data worsens and AAPL cuts guidance is overconfident. Market price is not the only signal.',
          machineComparison: 'Machine holds. Not adding at ATH with unresolved outbreak and supply chain warning.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: data divergence from price is a warning',
        shortLabel: 'RAISE CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['EARLY_REGIME_SENSITIVITY', 'CONTRARIAN_EARLY'],
          alphaImpact: { REGIME_ADAPTATION: 3, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'Early but not wrong directionally. Raising cash as market disagrees with data carries cash drag cost. Machine holds policy.',
          machineComparison: 'Machine holds. Cash raise at ATH when market is not pricing risk is costly if market continues.',
        },
      },
    ],
    teachingPoint: 'THE DIAMOND PRINCESS DATA WAS ALARMING. THE MARKET DISAGREED. THE MACHINE FOLLOWS POLICY TRIGGERS, NOT NEWSPAPER HEADLINES. NO TRIGGER REACHED YET.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Market at all-time highs. Portfolio already adjusted at CP2. Machine holds.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 04 · Feb 21 · REGIME_RECOGNITION
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 4,
    machinePar: 70,
    phase: 'REGIME_RECOGNITION',
    crisisDay: 'FEB 21',
    signalTitle: 'ITALY: COMMUNITY SPREAD IN DEVELOPED WORLD',
    signalBody: 'Italy reports 152 cases with no China travel link. Community transmission in a developed market confirmed. This breaks the containment playbook. SPX -3.4%: first significant single-day decline from ATH.',
    marketSignals: [
      { indicator: 'SPX', value: '-3.4%', direction: 'down', magnitude: 'high' },
      { indicator: 'VIX', value: '25.0', direction: 'up', magnitude: 'high' },
      { indicator: 'XOM', value: '-4.2%', direction: 'down', magnitude: 'medium' },
      { indicator: 'JPM', value: '-3.8%', direction: 'down', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'ITALY', text: 'Community transmission confirmed: no travel link to China' },
      { category: 'REGIME', text: 'Containment model fails. Global spread now plausible.' },
      { category: 'EQUITIES', text: 'Cyclicals and financials leading the selloff' },
      { category: 'VIX', text: 'VIX above 25 for first time since August 2019' },
    ],
    portfolioEffect: { returnBias: -0.025, volatilityDelta: 0.04, correlationLevel: 0.58 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'Community transmission breaks the epidemic containment model: this is a new category',
        'Economic disruption now plausible across developed markets, not just China',
        'Cyclicals (XOM, CAT, HD) face demand destruction risk',
        'Financials (JPM) face loan book stress and credit cycle risk',
        'Reducing cyclicals and financials, building cash buffer',
      ],
      policyReason: 'Regime recognition. Reduce cyclicals and financials on confirmed community spread.',
      targetChanges: [
        { asset: 'XOM', direction: 'decrease', magnitude: 0.04 },
        { asset: 'JPM', direction: 'decrease', magnitude: 0.03 },
        { asset: 'CAT', direction: 'decrease', magnitude: 0.03 },
      ],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REDUCE cyclicals/financials: regime has shifted',
        shortLabel: 'REDUCE CYCLICALS',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { REGIME_ADAPTATION: 6, LOSS_CONTROL: 5, TURNOVER_DISCIPLINE: 2 },
          teachingMessage: 'Regime recognition. Community spread changes the economic disruption calculus. Cyclicals and financials have the highest sensitivity to demand destruction.',
          machineComparison: 'Machine reduces XOM, JPM, CAT. Same thesis: economic disruption now plausible at scale.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: sell cyclicals, add JNJ/PG',
        shortLabel: 'ROTATE DEFENSIVE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { REGIME_ADAPTATION: 5, LOSS_CONTROL: 4 },
          teachingMessage: 'Sound defensive rotation. Moving from cyclicals into healthcare and staples is the correct regime response.',
          machineComparison: 'Machine reduces and raises cash slightly. Rotating into defensives is the same direction, different expression.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: build liquidity for what comes next',
        shortLabel: 'RAISE CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { LOSS_CONTROL: 4, REGIME_ADAPTATION: 3 },
          teachingMessage: 'Valid. Building cash at regime recognition is defensible. Risk is missing defensive equity upside.',
          machineComparison: 'Machine prefers specific equity reduction. Both are defensible at this step.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: one bad day does not make a regime',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'RECENCY_BIAS'],
          alphaImpact: { REGIME_ADAPTATION: -6, LOSS_CONTROL: -4 },
          teachingMessage: 'Italy community spread is a qualitative regime change, not just a bad price day. Machine acts on the structural signal.',
          machineComparison: 'Machine reduces. Community transmission breaks the containment model: this is the machine\'s trigger.',
        },
      },
    ],
    teachingPoint: 'COMMUNITY TRANSMISSION IN A DEVELOPED COUNTRY IS A REGIME EVENT, NOT A PRICE EVENT. THE FIRST DAY OF A NEW REGIME IS THE BEST TIME TO RESPOND.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Regime shift confirmed. Holding here means anchoring to the old narrative.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 05 · Feb 27 · REGIME_RECOGNITION
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 5,
    machinePar: 69,
    phase: 'REGIME_RECOGNITION',
    crisisDay: 'FEB 27',
    signalTitle: 'FASTEST CORRECTION IN HISTORY: -10% IN 6 DAYS',
    signalBody: 'S&P 500 falls 10% from ATH in 6 trading days: fastest correction on record. VIX above 40. Q1 earnings estimates still unchanged. The repricing is faster than analyst models.',
    marketSignals: [
      { indicator: 'SPX', value: '-4.4%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'VIX', value: '40.1', direction: 'up', magnitude: 'extreme' },
      { indicator: 'JPM', value: '-5.8%', direction: 'down', magnitude: 'high' },
      { indicator: 'CAT', value: '-6.3%', direction: 'down', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'SPEED', text: 'S&P correction fastest from ATH in 90-year history' },
      { category: 'CORRELATION', text: 'All equity sectors falling together: no sector providing cover' },
      { category: 'ESTIMATES', text: 'Q1 earnings estimates unchanged: fundamental re-rating incoming' },
      { category: 'BEHAVIOR', text: 'Retail panic selling beginning to appear in data' },
    ],
    portfolioEffect: { returnBias: -0.038, volatilityDelta: 0.06, correlationLevel: 0.78 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Reductions already completed at CP2 and CP4',
        'Selling into VIX 40 velocity compounds realized losses with bad execution',
        'Bid-ask spreads elevated: transaction cost spike',
        'Machine policy: no panic selling after systematic reduction completed',
        'Current exposure is the deliberate post-reduction position',
      ],
      policyReason: 'Hold. Systematic reduction complete. No panic selling at VIX 40.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: already reduced; selling into VIX 40 is panic',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { LOSS_CONTROL: 4, TURNOVER_DISCIPLINE: 5, RULE_ADHERENCE: 3 },
          teachingMessage: 'Correct. Position right-sized at CP2 and CP4. Selling into velocity at VIX 40 is the behavioral error: not process.',
          machineComparison: 'Machine holds. Panic selling into speed is not a policy action.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE further: momentum is clearly down',
        shortLabel: 'REDUCE MORE',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['PANIC_REDUCTION_LARGE', 'RECENCY_BIAS'],
          alphaImpact: { LOSS_CONTROL: -4, TURNOVER_DISCIPLINE: -5, REGIME_ADAPTATION: -3 },
          teachingMessage: 'Selling into -4.4% on VIX 40 is panic reduction, not process. The time to reduce was at CP2 and CP4. This is the most expensive possible execution.',
          machineComparison: 'Machine holds. Selling into maximum volatility after systematic reduction is the machine\'s most explicit behavioral guardrail.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD EQUITIES: VIX 40 is a historical buy signal',
        shortLabel: 'BUY VIX 40',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CONTRARIAN_EARLY', 'OVERCONFIDENCE'],
          alphaImpact: { REENTRY_DISCIPLINE: -4, POSITION_SIZING: -5 },
          teachingMessage: 'VIX 40 can reach 80. Adding into a -10% correction week without a policy floor signal is not contrarian: it is averaging down.',
          machineComparison: 'Machine holds. No re-entry without a stabilization signal.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: protect what remains',
        shortLabel: 'RAISE CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['PANIC_REDUCTION_LARGE'],
          alphaImpact: { LOSS_CONTROL: -3, TURNOVER_DISCIPLINE: -4 },
          teachingMessage: 'Raising cash at VIX 40 locks in losses at maximum execution cost and removes equity exposure at the worst moment.',
          machineComparison: 'Machine holds. Panic cash raise at peak fear is the textbook behavioral error.',
        },
      },
    ],
    teachingPoint: 'THE MACHINE DOES NOT SELL INTO VELOCITY. IT REDUCES BEFORE VELOCITY ARRIVES. SELLING AT VIX 40 IS THE MOST EXPENSIVE SINGLE MISTAKE IN CRISIS MANAGEMENT.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Hold. Already right-sized. Selling into VIX 40 is panic, not process.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 06 · Mar 2 · REGIME_RECOGNITION
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 6,
    machinePar: 63,
    phase: 'REGIME_RECOGNITION',
    crisisDay: 'MAR 2',
    signalTitle: 'EMERGENCY FED CUT: RALLY FADES TO FLAT',
    signalBody: 'Fed cuts 50bp in emergency inter-meeting session. Market initially surges +4.6%. Then fades to near-flat. Emergency action that cannot hold a rally is the signal. JPM underperforms: rate cuts compress bank NIM.',
    marketSignals: [
      { indicator: 'SPX', value: '+0.5% (peak +4.6%)', direction: 'up', magnitude: 'low' },
      { indicator: 'JPM', value: '-2.1%', direction: 'down', magnitude: 'medium' },
      { indicator: 'XOM', value: '-3.4%', direction: 'down', magnitude: 'medium' },
      { indicator: 'VIX', value: '33.4', direction: 'down', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'FED', text: 'Emergency 50bp cut: first inter-meeting cut since 2008' },
      { category: 'SIGNAL', text: 'SPX +4.6% rally fades to near-flat: market pricing severity not policy' },
      { category: 'BANKS', text: 'JPM underperforms: NIM compression from rate cut', relevantAssets: ['JPM'] },
      { category: 'ENERGY', text: 'XOM: demand destruction is not rate-sensitive', relevantAssets: ['XOM'] },
    ],
    portfolioEffect: { returnBias: -0.005, volatilityDelta: -0.01, correlationLevel: 0.65 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Faded rally after emergency cut signals market pricing severity, not rate sensitivity',
        'Portfolio already adjusted from prior reductions',
        'JPM NIM compression worth monitoring but not yet an action',
        'No stabilization signal yet: hold current equity mix',
      ],
      policyReason: 'Hold. Ambiguous policy signal. Monitor JPM and XOM.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: faded rally is a warning, not a buying signal',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { DECISION_CONSISTENCY: 4, TURNOVER_DISCIPLINE: 3 },
          teachingMessage: 'Good read. A Fed-driven surge that fades to flat tells you the market is pricing crisis severity, not responding to policy support.',
          machineComparison: 'Machine holds. Emergency cut that fails to hold a rally is a warning signal.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD EQUITIES: Fed put confirmed',
        shortLabel: 'ADD ON FED',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS', 'CHASING'],
          alphaImpact: { REENTRY_DISCIPLINE: -5, REGIME_ADAPTATION: -3 },
          teachingMessage: 'The rally faded. Adding into a policy bounce that couldn\'t hold is chasing a reversed signal.',
          machineComparison: 'Machine holds. Fed cut did not stabilize the market: that\'s the key information.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE JPM: rate cuts structurally hurt bank margins',
        shortLabel: 'REDUCE JPM',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { REGIME_ADAPTATION: 3, STOCK_SELECTION: 3, TURNOVER_DISCIPLINE: -1 },
          teachingMessage: 'Rate cut → NIM compression → JPM margin pressure. Correct sector logic. Machine holds JPM for now but your reduction is defensible.',
          machineComparison: 'Machine holds JPM this checkpoint. Your reduction has valid logic: marginal turnover cost.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE into JNJ/PG: rate cut benefits defensives',
        shortLabel: 'ROTATE DEFENSIVE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { REGIME_ADAPTATION: 2, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'Defensives benefit from lower rates and uncertainty. Reasonable: portfolio already has 16% in JNJ/PG.',
          machineComparison: 'Machine holds. Portfolio already 16% in defensives. Rotation increases concentration.',
        },
      },
    ],
    teachingPoint: 'AN EMERGENCY CUT THAT CANNOT HOLD A RALLY TELLS YOU MORE ABOUT MARKET SEVERITY THAN THE CUT ITSELF. THE MACHINE READS MARKET REACTION TO POLICY, NOT JUST POLICY.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. Policy rally that fades to flat is a warning. Machine holds.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 07 · Mar 9 · PANIC
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 7,
    machinePar: 64,
    phase: 'PANIC',
    crisisDay: 'MAR 9',
    signalTitle: 'CIRCUIT BREAKER #1: TRADING HALTED',
    signalBody: 'S&P futures fall 7% overnight. OPEC+ collapses simultaneously: Saudi Arabia launches oil price war. Circuit breaker triggered at open. Market halted 15 minutes. VIX 54. No reliable prices. XOM -14.8% intraday.',
    marketSignals: [
      { indicator: 'STATUS', value: 'HALTED', direction: 'neutral', magnitude: 'extreme' },
      { indicator: 'SPX', value: '-7.6%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'XOM', value: '-14.8%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'VIX', value: '54.4', direction: 'up', magnitude: 'extreme' },
    ],
    eventFeed: [
      { category: 'HALT', text: 'Circuit breaker Level 1: 15-minute trading halt at open' },
      { category: 'OIL WAR', text: 'OPEC+ collapses. Saudi Arabia to ramp production in April.', relevantAssets: ['XOM'] },
      { category: 'ENERGY', text: 'XOM -14.8% intraday: oil price war + demand destruction simultaneous', relevantAssets: ['XOM'] },
      { category: 'SPREADS', text: 'Bid-ask spreads 3-5x normal. Execution price unknown.' },
    ],
    portfolioEffect: { returnBias: -0.062, volatilityDelta: 0.12, correlationLevel: 0.90 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Circuit breaker: price discovery has failed: no reliable quotes',
        'Bid-ask spreads extreme: any execution destroys value on spread alone',
        'XOM has oil price exposure but selling into circuit breaker is speculation on reopen price',
        'Machine policy: no execution during trading halt',
        'Portfolio was sized correctly. Hold until price discovery restores.',
      ],
      policyReason: 'Hold. Circuit breaker policy: no execution without reliable price discovery.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: no price discovery; circuit breaker policy',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { RULE_ADHERENCE: 6, LOSS_CONTROL: 4, TURNOVER_DISCIPLINE: 4 },
          teachingMessage: 'Correct. Circuit breakers exist because prices are unreliable. The machine never executes during a trading halt.',
          machineComparison: 'Machine holds. Its policy explicitly prohibits execution without price discovery.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'QUEUE SELLS at reopen: execute regardless',
        shortLabel: 'SELL AT REOPEN',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['PANIC_REDUCTION_LARGE', 'ACTION_BIAS'],
          alphaImpact: { LOSS_CONTROL: -6, RULE_ADHERENCE: -5, TURNOVER_DISCIPLINE: -5 },
          teachingMessage: 'Selling at circuit breaker reopen means accepting worst possible spread in worst possible liquidity. This is speculation on the gap, not portfolio management.',
          machineComparison: 'Machine never queues sells into halts. This is the clearest behavioral distinction in the game.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'BUY EQUITIES: VIX 54 is an extreme buying signal',
        shortLabel: 'BUY PANIC',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CONTRARIAN_EARLY', 'OVERCONFIDENCE'],
          alphaImpact: { REENTRY_DISCIPLINE: -5, POSITION_SIZING: -6 },
          teachingMessage: 'VIX 54 can reach 82. Buying into a circuit breaker without price discovery is speculation, not contrarian value.',
          machineComparison: 'Machine holds. No re-entry into unresolved tail events.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: maximum protection',
        shortLabel: 'MAX CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['PANIC_REDUCTION_LARGE'],
          alphaImpact: { LOSS_CONTROL: -4, TURNOVER_DISCIPLINE: -4 },
          teachingMessage: 'Same execution problem: raising cash during halt means selling at worst possible reopening price on extreme spreads.',
          machineComparison: 'Machine holds. Cash raise during circuit breaker is speculation on the reopen gap.',
        },
      },
    ],
    teachingPoint: 'CIRCUIT BREAKERS EXIST BECAUSE THE MARKET CANNOT PRICE RISK AT THAT MOMENT. THE MACHINE HAS AN EXPLICIT POLICY: NO EXECUTION WITHOUT PRICE DISCOVERY. THIS IS NOT INACTION: IT IS THE RULE.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Hold is mandatory policy during circuit breakers. Machine holds explicitly.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 08 · Mar 11 · PANIC
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 8,
    machinePar: 60,
    phase: 'PANIC',
    crisisDay: 'MAR 11',
    signalTitle: 'WHO PANDEMIC DECLARATION: TRAVEL BAN',
    signalBody: 'WHO declares COVID-19 a pandemic. U.S. announces travel ban to Europe. NBA suspended. SPX -4.9%. DAL -11.2%. MAR -9.4%. Pandemic declaration activates force majeure clauses globally: fundamental legal and operational change.',
    marketSignals: [
      { indicator: 'SPX', value: '-4.9%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'DAL', value: '-11.2%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'MAR', value: '-9.4%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'JNJ', value: '-2.1%', direction: 'down', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'WHO', text: 'COVID-19 declared a pandemic: first since H1N1 2009' },
      { category: 'TRAVEL BAN', text: 'U.S. travel ban to Europe: DAL and MAR direct operational impact', relevantAssets: ['DAL', 'MAR'] },
      { category: 'LEGAL', text: 'Pandemic declaration activates force majeure clauses: contract risk across sectors' },
      { category: 'ECONOMY', text: 'NBA, NCAA, NHL suspending: economic disruption now broad-based' },
    ],
    portfolioEffect: { returnBias: -0.042, volatilityDelta: 0.08, correlationLevel: 0.87 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'Pandemic + travel ban = operational cessation for DAL, not demand softening',
        'MAR hotel bookings will collapse with travel ban in place',
        'If travel positions not already reduced: reduce now on confirmed operational impact',
        'Pandemic declaration is a legal threshold that changes business model assumptions',
        'JNJ and PG are defensive holdbacks: maintain',
      ],
      policyReason: 'Reduce remaining travel exposure. Pandemic + travel ban = operational cessation trigger.',
      targetChanges: [
        { asset: 'DAL', direction: 'decrease', magnitude: 0.04 },
        { asset: 'MAR', direction: 'decrease', magnitude: 0.03 },
      ],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REDUCE DAL/MAR: travel ban = zero revenue, not reduced revenue',
        shortLabel: 'REDUCE TRAVEL',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { LOSS_CONTROL: 5, REGIME_ADAPTATION: 4, STOCK_SELECTION: 4 },
          teachingMessage: 'Pandemic + travel ban is not a price event: it is an operational event. Revenue model broken. Correct fundamental distinction.',
          machineComparison: 'Machine reduces remaining travel. Travel ban means zero revenue. This is not "already priced."',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: -11% means the damage is priced in',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'RECENCY_BIAS'],
          alphaImpact: { LOSS_CONTROL: -4, REGIME_ADAPTATION: -3 },
          teachingMessage: 'DAL -11% does not mean the damage is complete. Travel ban means revenue is zero, not reduced. Machine distinguishes "priced" from "fundamentally broken."',
          machineComparison: 'Machine reduces. Pandemic + travel ban changes the legal and operational framework.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: sell travel, add healthcare',
        shortLabel: 'ROTATE TO JNJ',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { REGIME_ADAPTATION: 3, LOSS_CONTROL: 3 },
          teachingMessage: 'JNJ benefits from pandemic healthcare demand. Rotating into healthcare is valid.',
          machineComparison: 'Machine reduces travel. Rotating into JNJ is the same direction.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: maximum liquidity',
        shortLabel: 'MAX CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['CASH_DRAG'],
          alphaImpact: { LOSS_CONTROL: 2, POSITION_SIZING: -2 },
          teachingMessage: 'Cash avoids travel impairment but misses healthcare/staples defensive equity benefit. Targeted reduction is more precise.',
          machineComparison: 'Machine targets travel specifically. Broad cash is blunter.',
        },
      },
    ],
    teachingPoint: 'PANDEMIC DECLARATION IS A LEGAL AND OPERATIONAL THRESHOLD: NOT A PRICE EVENT. REVENUE MODEL CHANGES ARE DIFFERENT FROM VOLATILITY. THE MACHINE RESPONDS TO FUNDAMENTALS.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Travel ban + pandemic = zero revenue. This is not "already priced": it is a new fundamental state.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 09 · Mar 16 · PANIC
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 9,
    machinePar: 56,
    phase: 'PANIC',
    crisisDay: 'MAR 16',
    signalTitle: 'CIRCUIT BREAKER #3: WORST DAY SINCE 1987',
    signalBody: 'S&P -12%: worst single-day decline since Black Monday 1987. Circuit breaker #3 triggered. Fed cut to 0-0.25% Sunday: market ignores it. VIX 82.7. Portfolio at -28% from starting value. All equities correlated.',
    marketSignals: [
      { indicator: 'SPX', value: '-12.0%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'VIX', value: '82.7', direction: 'up', magnitude: 'extreme' },
      { indicator: 'CAT', value: '-14.2%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'JPM', value: '-13.1%', direction: 'down', magnitude: 'extreme' },
    ],
    eventFeed: [
      { category: 'HISTORY', text: 'Worst single-day since Black Monday 1987' },
      { category: 'FED', text: 'Fed cut to 0-0.25% + $700B QE announced Sunday. Market falls -12% anyway.' },
      { category: 'CORRELATION', text: 'All equities at 0.95 correlation: diversification has failed today' },
      { category: 'LIQUIDITY', text: 'Bid-ask spreads 5-10x normal. Some names effectively unquoteable.' },
    ],
    portfolioEffect: { returnBias: -0.092, volatilityDelta: 0.20, correlationLevel: 0.95 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'VIX 82.7: transaction costs at extreme levels, execution destroys value',
        'Fed cut + QE did not stop the decline: market pricing systemic shock',
        'Portfolio reduced progressively at CP2, CP4, CP8: current exposure is deliberate',
        'Selling at VIX 82 would be worst execution in the entire crisis',
        'Machine policy: no execution at VIX above 60',
      ],
      policyReason: 'Hold. VIX 82.7. No execution. Portfolio correctly sized.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: VIX 82 means selling at maximum destruction cost',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { RULE_ADHERENCE: 6, LOSS_CONTROL: 5, DECISION_CONSISTENCY: 4 },
          teachingMessage: 'Correct. VIX 82 means bid-ask spreads are 5-10x normal. Selling locks in losses at maximum execution cost. Machine holds: its rule exists precisely for this moment.',
          machineComparison: 'Machine holds. Policy does not permit execution at VIX above 60.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: get flat before things get worse',
        shortLabel: 'SELL ALL',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['PANIC_REDUCTION_LARGE', 'ACTION_BIAS'],
          alphaImpact: { LOSS_CONTROL: -8, RULE_ADHERENCE: -7, TURNOVER_DISCIPLINE: -7 },
          teachingMessage: 'Selling at VIX 82 is the single most expensive decision in this arena. You capture worst execution, miss the recovery, and violate every risk process principle. This is the behavioral failure the game exists to prevent.',
          machineComparison: 'Machine never sells at this VIX level. This is the machine\'s most important rule.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'BUY: VIX 82 has never lasted',
        shortLabel: 'BUY PANIC',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CONTRARIAN_EARLY'],
          alphaImpact: { REENTRY_DISCIPLINE: -4, POSITION_SIZING: -5 },
          teachingMessage: 'VIX 82 has never lasted: but it can persist for weeks. No policy floor yet. Adding into maximum uncertainty is premature.',
          machineComparison: 'Machine holds. No re-entry signal even at historic VIX extremes.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: maximum defense',
        shortLabel: 'MAX CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['PANIC_REDUCTION_LARGE'],
          alphaImpact: { LOSS_CONTROL: -5, TURNOVER_DISCIPLINE: -5 },
          teachingMessage: 'Raising cash at VIX 82 = selling at maximum spread into circuit breaker conditions. Same problem as REDUCE.',
          machineComparison: 'Machine holds. No execution at VIX 82.',
        },
      },
    ],
    teachingPoint: 'VIX 82 IS NOT A SELLING OPPORTUNITY. IT IS A SURVIVING OPPORTUNITY. THE MACHINE BUILT THE PORTFOLIO CORRECTLY BEFORE THIS MOMENT. NOW IT HOLDS.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Hold is the only correct answer at VIX 82. The time to reduce was CP2, CP4, CP8.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 10 · Mar 23 · POLICY_INTERVENTION
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 10,
    machinePar: 52,
    phase: 'POLICY_INTERVENTION',
    crisisDay: 'MAR 23',
    signalTitle: 'FED UNLIMITED QE: CARES ACT IMMINENT',
    signalBody: 'Fed announces unlimited asset purchases: first time in history. Congress confirms $2.2T CARES Act will pass this week. S&P still falls -3% as market awaits fiscal confirmation. This is the last leg of the decline. Trough is -33.9% from February high.',
    marketSignals: [
      { indicator: 'SPX', value: '-2.9%', direction: 'down', magnitude: 'medium' },
      { indicator: 'POLICY', value: 'UNLIMITED QE', direction: 'neutral', magnitude: 'extreme' },
      { indicator: 'MSFT', value: '-1.8%', direction: 'down', magnitude: 'low' },
      { indicator: 'JNJ', value: '+0.4%', direction: 'up', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'FED', text: 'Unlimited QE announced: no cap on purchases' },
      { category: 'FISCAL', text: '$2.2T CARES Act: bipartisan; signing expected within days' },
      { category: 'DEFENSIVES', text: 'JNJ and PG beginning to show relative stability', relevantAssets: ['JNJ', 'PG'] },
      { category: 'SIGNAL', text: 'Policy floor being constructed. Market still falling on fiscal uncertainty.' },
    ],
    portfolioEffect: { returnBias: -0.015, volatilityDelta: -0.05, correlationLevel: 0.80 },
    machineDecision: {
      actionCode: 'STAGED_BUY',
      reasoning: [
        'Unlimited QE removes liquidity collapse tail risk: systemic failure scenario off the table',
        '$2.2T CARES Act imminent: economic floor being constructed',
        'Begin staged equity re-entry: 25% of planned allocation this checkpoint',
        'Quality growth (MSFT) and defensive growth (JNJ) first buys',
        'Not all-in: staged to manage execution risk as market still falling',
      ],
      policyReason: 'Begin staged equity re-entry. Policy floor established. 25% of planned allocation.',
      targetChanges: [
        { asset: 'MSFT', direction: 'increase', magnitude: 0.02 },
        { asset: 'JNJ', direction: 'increase', magnitude: 0.015 },
      ],
    },
    availableActions: [
      {
        actionCode: 'STAGED_BUY',
        label: 'STAGED BUY: begin re-entry, policy floor confirmed',
        shortLabel: 'STAGED BUY',
        turnoverCost: 0.03,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { REENTRY_DISCIPLINE: 6, REGIME_ADAPTATION: 5, POSITION_SIZING: 4 },
          teachingMessage: 'Correct process. Unlimited QE removes systemic tail risk. Begin staged re-entry: not all-in. Exactly what the machine does.',
          machineComparison: 'Machine begins staged buy. Same trigger, same staging logic.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: market still falling, wait for confirmation',
        shortLabel: 'WAIT FOR BOTTOM',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['REENTRY_DELAY', 'ANCHORING'],
          alphaImpact: { REENTRY_DISCIPLINE: -3, REGIME_ADAPTATION: -2 },
          teachingMessage: 'Waiting for the price bottom is not a process. The machine begins re-entry when policy floor is established: not when price confirms the bottom. You will always be late.',
          machineComparison: 'Machine begins staged re-entry here. Waiting for price confirmation costs the first leg of recovery.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ALL IN: unlimited QE guarantees the recovery',
        shortLabel: 'ALL IN',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'HIGH_CONVICTION_ACTION'],
          alphaImpact: { REENTRY_DISCIPLINE: -4, POSITION_SIZING: -5 },
          teachingMessage: 'All-in conviction at maximum uncertainty is not process: it is luck. Staged entry is superior even when direction is correct.',
          machineComparison: 'Machine stages. Even correct directional conviction should be sized across time.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'STAY DEFENSIVE: market may fall further',
        shortLabel: 'STAY CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'REENTRY_DELAY'],
          alphaImpact: { REENTRY_DISCIPLINE: -5, REGIME_ADAPTATION: -3 },
          teachingMessage: 'Unlimited QE + imminent fiscal is the policy floor signal. Raising cash after this signal means anchoring to the crisis, not responding to the present.',
          machineComparison: 'Machine begins staged re-entry. Cash raise after policy floor is anchoring to the panic narrative.',
        },
      },
    ],
    teachingPoint: 'UNLIMITED QE + IMMINENT FISCAL = POLICY FLOOR. THE MACHINE DOES NOT WAIT FOR THE PRICE BOTTOM. IT BEGINS STAGED RE-ENTRY WHEN SYSTEMIC TAIL RISK IS REMOVED.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'Policy floor established. Waiting for price confirmation misses the first 20% of recovery.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 11 · Mar 26 · BOTTOMING
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 11,
    machinePar: 52,
    phase: 'BOTTOMING',
    crisisDay: 'MAR 26',
    signalTitle: 'LARGEST SINGLE-DAY GAIN SINCE 1933: +9.4%',
    signalBody: 'S&P gains +9.4%: largest single-day since 1933. CARES Act signed. Jobless claims 3.28M: worst in U.S. history by factor of 5x. Best equity day ever. Worst employment day ever. Simultaneously.',
    marketSignals: [
      { indicator: 'SPX', value: '+9.4%', direction: 'up', magnitude: 'extreme' },
      { indicator: 'CAT', value: '+14.7%', direction: 'up', magnitude: 'extreme' },
      { indicator: 'JPM', value: '+11.2%', direction: 'up', magnitude: 'extreme' },
      { indicator: 'JOBLESS', value: '3.28M', direction: 'up', magnitude: 'extreme' },
    ],
    eventFeed: [
      { category: 'HISTORY', text: '+9.4% SPX: largest single-day gain since 1933' },
      { category: 'FISCAL', text: '$2.2T CARES Act signed by President' },
      { category: 'JOBS', text: '3.28M jobless claims: worst in U.S. history by 5x' },
      { category: 'SIGNAL', text: 'Market pricing the outcome, not the present. Classic bottoming.' },
    ],
    portfolioEffect: { returnBias: 0.072, volatilityDelta: -0.08, correlationLevel: 0.75 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Staged re-entry began at CP10: no need to chase the surge',
        'VIX still 61: not adding aggressively into a single-day surge',
        '+9.4% day adds transaction cost on any buy order',
        'Staged plan continues on schedule: not accelerated by the up-day',
        'Hold plan, do not react to single-day moves',
      ],
      policyReason: 'Hold. Staged plan in motion. Do not chase single-day surges.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: staged plan in motion; do not chase the surge',
        shortLabel: 'HOLD PLAN',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { REENTRY_DISCIPLINE: 5, TURNOVER_DISCIPLINE: 4, DECISION_CONSISTENCY: 3 },
          teachingMessage: 'Correct. Staged plan active. Chasing a +9.4% day adds at the peak of the move. Machine holds the plan.',
          machineComparison: 'Machine holds plan. Re-entry schedule does not accelerate on single-day surges.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: CARES Act signed; recovery confirmed',
        shortLabel: 'ADD MORE',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING', 'RECENCY_BIAS'],
          alphaImpact: { REENTRY_DISCIPLINE: -4, TURNOVER_DISCIPLINE: -3 },
          teachingMessage: 'Adding into +9.4% means buying at the highest price of the day. Recovery is directionally correct. Chasing the surge is not the process.',
          machineComparison: 'Machine holds plan. Adding on the best day worsens the average entry price.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'TAKE PROFITS: sell into the surge',
        shortLabel: 'TAKE PROFITS',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS', 'THESIS_CONTRADICTION'],
          alphaImpact: { REENTRY_DISCIPLINE: -5, REGIME_ADAPTATION: -4 },
          teachingMessage: 'You began re-entry at CP10. Selling 3 days later into the first strong day contradicts your own thesis.',
          machineComparison: 'Machine holds recovery position. Re-entry was a regime adjustment, not a trade.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE cyclicals: biggest winners in the crash should recover most',
        shortLabel: 'BUY CYCLICALS',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS', 'CHASING'],
          alphaImpact: { TURNOVER_DISCIPLINE: -3, DECISION_CONSISTENCY: -3 },
          teachingMessage: 'Rotating into cyclicals on the best day of the crisis is chasing momentum, not a considered rotation thesis.',
          machineComparison: 'Machine holds current mix. Cyclical rotation is valid: but not executed on a +9.4% day.',
        },
      },
    ],
    teachingPoint: 'THE MACHINE DOES NOT CHASE SINGLE-DAY SURGES. IT EXECUTES ITS PLAN ON THE PLAN\'S SCHEDULE. THE +9.4% DAY REWARDS PATIENCE: IT DOES NOT INVITE PANIC BUYING.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Hold the plan. Staged re-entry in motion. Machine holds.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 12 · Apr 9 · BOTTOMING
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 12,
    machinePar: 56,
    phase: 'BOTTOMING',
    crisisDay: 'APR 9',
    signalTitle: 'S&P +25% FROM TROUGH: STRUCTURAL VS. SPECULATIVE',
    signalBody: 'S&P has recovered 25% from March 23 trough. MSFT +38% from low. DAL +71% from low. Unemployment at 14.7%. The market is pricing the recovery: but not every company is the same recovery story. MSFT revenue is accelerating. DAL revenue is still zero.',
    marketSignals: [
      { indicator: 'SPX', value: '+25% from low', direction: 'up', magnitude: 'high' },
      { indicator: 'MSFT', value: '+38% from low', direction: 'up', magnitude: 'extreme' },
      { indicator: 'DAL', value: '+71% from low', direction: 'up', magnitude: 'extreme' },
      { indicator: 'UNEMPLOYMENT', value: '14.7%', direction: 'up', magnitude: 'extreme' },
    ],
    eventFeed: [
      { category: 'RECOVERY', text: 'S&P +25% from trough in 17 days: fastest bear market exit on record' },
      { category: 'DIVERGENCE', text: 'DAL +71% from low but Q2 revenue guidance: zero', relevantAssets: ['DAL'] },
      { category: 'DIGITAL', text: 'MSFT Azure cloud revenue +27% YoY: digital acceleration is structural', relevantAssets: ['MSFT'] },
      { category: 'EARNINGS', text: 'Q1 earnings season begins: broad guidance withdrawals' },
    ],
    portfolioEffect: { returnBias: 0.032, volatilityDelta: -0.06, correlationLevel: 0.58 },
    machineDecision: {
      actionCode: 'ROTATE_RISK',
      reasoning: [
        'Market +25% from trough: recovery pricing in progress',
        'MSFT Azure revenue accelerating through COVID: digital adoption is structural, not cyclical',
        'DAL +71% from low but Q2 revenue is zero: speculative recovery on hope, not earnings',
        'Rotate: add MSFT and JNJ on quality, reduce DAL on speculative recovery',
        'HD and PG benefiting from stay-at-home demand: hold',
      ],
      policyReason: 'Rotate to structural winners. Reduce speculative recovery names.',
      targetChanges: [
        { asset: 'MSFT', direction: 'increase', magnitude: 0.03 },
        { asset: 'JNJ', direction: 'increase', magnitude: 0.02 },
        { asset: 'DAL', direction: 'decrease', magnitude: 0.02 },
      ],
    },
    availableActions: [
      {
        actionCode: 'ROTATE_RISK',
        label: 'ROTATE: MSFT/JNJ over DAL; structural over speculative',
        shortLabel: 'ROTATE QUALITY',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { STOCK_SELECTION: 6, REGIME_ADAPTATION: 5, REENTRY_DISCIPLINE: 3 },
          teachingMessage: 'Excellent stock selection. MSFT revenue is accelerating. DAL revenue is zero. The machine rotates into quality growth away from speculative recovery.',
          machineComparison: 'Machine rotates MSFT/JNJ higher, reduces DAL. Structural vs. speculative: same thesis.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD DAL/CAT: biggest bounces still ahead',
        shortLabel: 'ADD CYCLICALS',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS', 'CHASING'],
          alphaImpact: { STOCK_SELECTION: -5, REENTRY_DISCIPLINE: -4 },
          teachingMessage: 'DAL +71% from low but revenue is zero. This is speculative positioning on vaccine hope. Machine does not buy revenue-zero companies on price momentum.',
          machineComparison: 'Machine reduces DAL. Revenue-zero companies rallying 71% is speculation, not value.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: do not trade the recovery noise',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE'],
          alphaImpact: { TURNOVER_DISCIPLINE: 2, STOCK_SELECTION: -1 },
          teachingMessage: 'Valid discipline. Machine sees a real quality rotation opportunity between structural (MSFT) and speculative (DAL) that a hold misses.',
          machineComparison: 'Machine rotates. Holding is not wrong but the quality divergence is a real edge.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: +25% bounce is a selling opportunity',
        shortLabel: 'TAKE PROFITS',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['THESIS_CONTRADICTION', 'REENTRY_DELAY'],
          alphaImpact: { REENTRY_DISCIPLINE: -5, REGIME_ADAPTATION: -4 },
          teachingMessage: 'You staged into recovery at CP10 to capture it. Raising cash after +25% reverses that decision. Machine holds and rotates: does not exit.',
          machineComparison: 'Machine holds and rotates. Exiting the recovery at +25% is premature.',
        },
      },
    ],
    teachingPoint: 'RECOVERY IS NOT EQUAL ACROSS EQUITIES. MSFT REVENUE ACCELERATED THROUGH COVID. DAL REVENUE WAS ZERO. BOTH BOUNCED +25%+. THE MACHINE SEPARATES STRUCTURAL FROM SPECULATIVE.',
    isRegimeChange: true,
    isHoldValid: false,
    holdTeaching: 'The divergence between MSFT (structural) and DAL (speculative) is a real selection opportunity. Hold misses it.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 13 · May 14 · RECOVERY_REENTRY
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 13,
    machinePar: 55,
    phase: 'RECOVERY_REENTRY',
    crisisDay: 'MAY 14',
    signalTitle: 'CONCENTRATION AUDIT: FIVE STOCKS, THREE RISKS',
    signalBody: 'Portfolio audit: MSFT + AAPL now represent 22% of portfolio. Correlation between MSFT and AAPL: 0.87. You have five names but three effective risk clusters. Concentration is measured in economic exposure, not ticker count.',
    marketSignals: [
      { indicator: 'MSFT', value: '+38% YTD', direction: 'up', magnitude: 'high' },
      { indicator: 'AAPL', value: '+22% YTD', direction: 'up', magnitude: 'medium' },
      { indicator: 'CORR(MSFT/AAPL)', value: '0.87', direction: 'up', magnitude: 'high' },
      { indicator: 'SPX', value: '-12% YTD', direction: 'down', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'CONCENTRATION', text: 'MSFT + AAPL at 22% with 0.87 correlation = one effective 22% position', relevantAssets: ['MSFT', 'AAPL'] },
      { category: 'ALPHA', text: 'Tech positions generated +30% relative vs. cyclicals: correct thesis' },
      { category: 'RISK', text: 'At 22% tech concentration: any single regulatory or earnings miss has doubled impact' },
      { category: 'MACHINE', text: 'Machine kept tech below 20%: sacrificed return for concentration control' },
    ],
    portfolioEffect: { returnBias: 0.010, volatilityDelta: 0.01, correlationLevel: 0.55 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'MSFT + AAPL at 22% with 0.87 correlation = effective single 22% position',
        'Concentration rule: no correlated sector cluster above 20%',
        'Trim both positions back to 9% each: not exit, but right-size',
        'This is concentration policy, not a market call on tech',
        'The thesis is intact: the sizing is the problem',
      ],
      policyReason: 'Trim tech concentration back to policy threshold. Portfolio rule, not market view.',
      targetChanges: [
        { asset: 'MSFT', direction: 'decrease', magnitude: 0.015 },
        { asset: 'AAPL', direction: 'decrease', magnitude: 0.015 },
      ],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'TRIM tech: concentration rule, not a market call',
        shortLabel: 'TRIM TECH',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { CONCENTRATION_CONTROL: 7, RULE_ADHERENCE: 5, POSITION_SIZING: 4 },
          teachingMessage: 'Critical distinction: trimming on concentration policy is not selling on a bearish view. The machine maintains the thesis: it just right-sizes the position.',
          machineComparison: 'Machine trims tech to concentration threshold. Portfolio rule, not market timing.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: both positions working; do not sell winners',
        shortLabel: 'HOLD WINNERS',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'ANCHORING'],
          alphaImpact: { CONCENTRATION_CONTROL: -6, RULE_ADHERENCE: -4 },
          teachingMessage: 'You have MSFT and AAPL at 0.87 correlation. You have two positions, not one. At 22%, any earnings miss has double the portfolio impact. Machine trims regardless of performance.',
          machineComparison: 'Machine trims. Holding winners into concentration is a behavioral bias, not a decision.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD MSFT/AAPL: momentum plus quality',
        shortLabel: 'ADD TECH',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'CHASING'],
          alphaImpact: { CONCENTRATION_CONTROL: -8, POSITION_SIZING: -7 },
          teachingMessage: 'Adding into 22% correlated tech concentration is the exact mistake the machine is built to prevent. You are adding single-exposure risk, not portfolio quality.',
          machineComparison: 'Machine trims. Adding here is adding concentration, not return quality.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: tech profits into defensive equities',
        shortLabel: 'ROTATE OUT',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { CONCENTRATION_CONTROL: 4, REGIME_ADAPTATION: 3, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'Right direction: reducing tech concentration. Rotating into defensives has slightly higher turnover than a simple trim.',
          machineComparison: 'Machine trims rather than rotates: lower turnover, same concentration result.',
        },
      },
    ],
    teachingPoint: 'FIVE STOCKS. TWO AT 0.87 CORRELATION. YOU HAD THREE RISK CLUSTERS. CONCENTRATION IS ECONOMIC EXPOSURE, NOT TICKER COUNT. THE MACHINE MANAGES THIS WITH RULES.',
    isRegimeChange: false,
    isHoldValid: false,
    holdTeaching: 'Holding 22% correlated tech is a concentration risk decision. Machine trims regardless of recent return.',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CP 14 · Jun 8 · RECOVERY_REENTRY
  // ───────────────────────────────────────────────────────────────────────────
  {
    sequence: 14,
    machinePar: 59,
    phase: 'RECOVERY_REENTRY',
    crisisDay: 'JUN 8',
    signalTitle: 'RECOVERY ROTATION: WHICH RECOVERY DO YOU OWN?',
    signalBody: 'S&P -1% YTD. Tech +12% YTD. Airlines -50%. Energy -35%. Two distinct equity recovery paths: structural winners (digital, healthcare, consumer staples) vs. damaged cyclicals (travel, energy, financials). Which recovery does your portfolio own?',
    marketSignals: [
      { indicator: 'TECH', value: '+12% YTD', direction: 'up', magnitude: 'high' },
      { indicator: 'AIRLINES', value: '-50% YTD', direction: 'down', magnitude: 'extreme' },
      { indicator: 'ENERGY', value: '-35% YTD', direction: 'down', magnitude: 'high' },
      { indicator: 'HEALTHCARE', value: '+6% YTD', direction: 'up', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'DIVERGENCE', text: 'Largest sector performance gap in 20 years' },
      { category: 'DAMAGED', text: 'DAL: Q2 revenue guidance zero. Book value impaired.', relevantAssets: ['DAL'] },
      { category: 'STRUCTURAL', text: 'MSFT Azure +27% YoY. Remote work demand structural.', relevantAssets: ['MSFT'] },
      { category: 'ROTATION', text: 'Value investors beginning to enter energy and financial names' },
    ],
    portfolioEffect: { returnBias: 0.018, volatilityDelta: -0.02, correlationLevel: 0.48 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Portfolio already correctly positioned through CPs 2, 4, 8, 12',
        'Current mix: overweight quality growth, underweight speculative recovery',
        'DAL revenue still 80% below 2019: value case not yet confirmed by earnings',
        'No new trigger for rotation: thesis still intact',
        'Hold and let the position work',
      ],
      policyReason: 'Hold. Thesis intact. No new rotation trigger.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: structural winners thesis intact; no new trigger',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { DECISION_CONSISTENCY: 5, TURNOVER_DISCIPLINE: 4, RULE_ADHERENCE: 3 },
          teachingMessage: 'Correct. Portfolio thesis was right. Structural winners are leading. No new trigger for rotation. Machine holds.',
          machineComparison: 'Machine holds. Thesis intact, no new trigger.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ADD energy/airlines: the damage is now in the price',
        shortLabel: 'BUY DAMAGED',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['RECENCY_BIAS'],
          alphaImpact: { STOCK_SELECTION: -4, DECISION_CONSISTENCY: -3 },
          teachingMessage: 'DAL revenue is 80% below 2019. Price decline is not a thesis. Machine distinguishes business-model recovery from price recovery.',
          machineComparison: 'Machine holds quality growth. Buying damaged businesses because they fell is not value investing.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE tech: take profits after a strong run',
        shortLabel: 'TAKE PROFITS',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['THESIS_CONTRADICTION'],
          alphaImpact: { DECISION_CONSISTENCY: -4, REGIME_ADAPTATION: -2 },
          teachingMessage: 'The tech thesis was structural acceleration, not momentum trade. Selling because price ran contradicts the thesis.',
          machineComparison: 'Machine holds. Selling the structural winner because it performed contradicts the thesis that drove the position.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD quality growth: extend the winning thesis',
        shortLabel: 'ADD GROWTH',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { STOCK_SELECTION: 2, CONCENTRATION_CONTROL: -2 },
          teachingMessage: 'Sound extension of the thesis. Concentration is the watch item: adding more to winners raises concentration above threshold.',
          machineComparison: 'Machine holds. Extending the thesis by adding raises concentration risk.',
        },
      },
    ],
    teachingPoint: 'THE HARDEST DISCIPLINE IS HOLDING WINNERS WHEN THE VALUE INVESTORS ARE BUYING THE DAMAGED ALTERNATIVE. THE MACHINE HOLDS THESIS, NOT PRICE. THE THESIS WAS STRUCTURAL ACCELERATION.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Portfolio thesis intact. No new trigger. Hold and let the position work.',
  },

  // ─── Phase 6 continued: re-entry (§21.3 CP15-22) ───────────────────────────
  //
  // The arena used to stop at JUN 8, which left its hardest lesson untaught.
  // §22 builds the Recovery arena on the premise that survival logic becomes a
  // liability, and §21.3 CP18-22 are where COVID is supposed to set that up:
  // cash raised in March is a re-entry decision in July, and a player who
  // never faces it has not finished the arena.
  //
  // The stress test made the gap measurable. Every buildable machine spent its
  // turnover on defensive churn and reached the recovery priced out, which
  // read as a policy failure when it was partly a content one: there was
  // almost no recovery left to re-enter.

  {
    sequence: 15,
    machinePar: 59,
    phase: 'RECOVERY_REENTRY',
    crisisDay: 'JUL 2',
    signalTitle: 'THE CASH QUESTION: STILL WAITING FOR CONFIRMATION?',
    signalBody: 'The S&P has recovered 40% from the March low. Unemployment is 11.1%. Both facts are true at once. Cash raised in the panic protected capital; every week it stays uninvested it costs recovery. There is no announcement that will tell you the coast is clear.',
    marketSignals: [
      { indicator: 'SPX FROM LOW', value: '+40%', direction: 'up', magnitude: 'high' },
      { indicator: 'UNEMPLOYMENT', value: '11.1%', direction: 'down', magnitude: 'high' },
      { indicator: 'VIX', value: '27.7', direction: 'down', magnitude: 'medium' },
      { indicator: 'BREADTH', value: '61%', direction: 'up', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'RE-ENTRY', text: 'Cash held since March has missed 40% of the move off the low' },
      { category: 'ECONOMY', text: 'Payrolls beat expectations; the level remains catastrophic' },
      { category: 'BREADTH', text: 'Advance-decline improving for a fifth consecutive week' },
      { category: 'MACHINE', text: 'Machine deploys on breadth confirmation, not on a headline' },
    ],
    portfolioEffect: { returnBias: 0.014, volatilityDelta: -0.01, correlationLevel: 0.52 },
    machineDecision: {
      actionCode: 'STAGED_BUY',
      reasoning: [
        'Breadth has improved for five consecutive weeks: the confirmation rule is met',
        'Deploy in tranches rather than at once: no single entry price is right',
        'Economic data is bad and known; the market prices expectations, not levels',
        'Waiting for good news means buying after it is priced',
      ],
      policyReason: 'Breadth confirmation met. Staged deployment begins, sized to the rule rather than to conviction.',
      targetChanges: [{ asset: 'CASH', direction: 'decrease', magnitude: 0.08 }],
    },
    availableActions: [
      {
        actionCode: 'STAGED_BUY',
        label: 'STAGED: deploy cash in tranches on breadth confirmation',
        shortLabel: 'STAGE IN',
        turnoverCost: 0.03,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { REENTRY_DISCIPLINE: 8, RULE_ADHERENCE: 5, TURNOVER_DISCIPLINE: 3 },
          teachingMessage: 'Staged re-entry answers the question cash created. You do not need to be right about the bottom, only to stop being absent.',
          machineComparison: 'Machine stages in on the same confirmation rule.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD cash: the economy has not recovered',
        shortLabel: 'STAY OUT',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['REENTRY_DELAY', 'CASH_DRAG'],
          alphaImpact: { REENTRY_DISCIPLINE: -7, REGIME_ADAPTATION: -4 },
          teachingMessage: 'The economy and the market are not the same instrument. Waiting for the economy to look safe is waiting for the recovery to be over.',
          machineComparison: 'Machine deployed on breadth. Holding cash here is a second decision, not the absence of one.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: deploy all remaining cash now',
        shortLabel: 'ALL IN',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE'],
          alphaImpact: { REENTRY_DISCIPLINE: 2, POSITION_SIZING: -5 },
          teachingMessage: 'Right direction, wrong sizing. Deploying everything at one price is the mirror image of the panic that raised the cash.',
          machineComparison: 'Machine stages. One entry price is a bet on timing you have already lost once.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE more cash: the rally is a bear market bounce',
        shortLabel: 'MORE CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'RECENCY_BIAS'],
          alphaImpact: { REENTRY_DISCIPLINE: -9, REGIME_ADAPTATION: -6 },
          teachingMessage: 'Raising cash after a 40% advance anchors on the March experience rather than on current evidence.',
          machineComparison: 'Machine deployed. The evidence moved; the position did not.',
        },
      },
    ],
    teachingPoint: 'CASH SOLVED HOW MUCH RISK TO TAKE IN MARCH. IT CREATED WHEN TO RETURN. THE SECOND QUESTION IS HARDER AND HAS NO ANNOUNCEMENT.',
    isRegimeChange: false,
    isHoldValid: false,
    holdTeaching: 'Holding cash into a confirmed breadth recovery is a re-entry decision with a cost, not neutrality.',
  },

  {
    sequence: 16,
    machinePar: 61,
    phase: 'RECOVERY_REENTRY',
    crisisDay: 'AUG 18',
    signalTitle: 'INDEX RECOVERS EVERYTHING. THE AVERAGE STOCK DOES NOT.',
    signalBody: 'The S&P closes at a record high. Beneath it, the median constituent is still 12% below February. Five names carry a quarter of the index. An index recovery and a portfolio recovery are different events.',
    marketSignals: [
      { indicator: 'SPX', value: 'RECORD HIGH', direction: 'up', magnitude: 'high' },
      { indicator: 'MEDIAN STOCK', value: '-12% FROM FEB', direction: 'down', magnitude: 'medium' },
      { indicator: 'TOP 5 WEIGHT', value: '24%', direction: 'up', magnitude: 'high' },
      { indicator: 'EQUAL-WEIGHT SPX', value: '-8% YTD', direction: 'down', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'BREADTH', text: 'Index at a record while the equal-weight index remains negative on the year' },
      { category: 'CONCENTRATION', text: 'Five megacaps account for a quarter of index weight' },
      { category: 'RISK', text: 'Owning the index now means owning a concentrated growth position' },
      { category: 'MACHINE', text: 'Machine measures its own portfolio, not the index headline' },
    ],
    portfolioEffect: { returnBias: 0.012, volatilityDelta: 0.0, correlationLevel: 0.58 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Portfolio is inside every policy limit: no rule requires action',
        'The index record is not a portfolio event',
        'Turnover spent chasing a headline is turnover unavailable later',
      ],
      policyReason: 'No limit breached and no rule triggered. Holding is the decision.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: no rule triggered by an index headline',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { TURNOVER_DISCIPLINE: 6, RULE_ADHERENCE: 5, DECISION_CONSISTENCY: 4 },
          teachingMessage: 'A record on an index you do not own is news, not information. Nothing in your portfolio changed.',
          machineComparison: 'Machine holds. A headline is not a trigger.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD megacap growth: it is what is working',
        shortLabel: 'CHASE',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING', 'RECENCY_BIAS'],
          alphaImpact: { CONCENTRATION_CONTROL: -7, REENTRY_DISCIPLINE: -3 },
          teachingMessage: 'Buying the five names that already carry the index adds concentration at the price that concentration created.',
          machineComparison: 'Machine holds. Chasing the leaders is buying correlation, not diversification.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE into the laggards: mean reversion',
        shortLabel: 'ROTATE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['ACTION_BIAS'],
          alphaImpact: { TURNOVER_DISCIPLINE: -5, REGIME_ADAPTATION: -2 },
          teachingMessage: 'Rotating on a valuation gap alone, with no regime evidence, spends turnover on a hunch.',
          machineComparison: 'Machine holds. The gap is real; the trigger is not.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: record highs are a selling opportunity',
        shortLabel: 'TAKE PROFIT',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { REENTRY_DISCIPLINE: -5, RULE_ADHERENCE: -3 },
          teachingMessage: 'Selling because a number is high is anchoring on the number rather than on the exposure.',
          machineComparison: 'Machine holds. No limit was breached.',
        },
      },
    ],
    teachingPoint: 'THE INDEX RECOVERED. THE AVERAGE STOCK DID NOT. AN INDEX RECORD IS NOT A PORTFOLIO EVENT, AND A HEADLINE IS NOT A TRIGGER.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. No policy limit was breached, so no action was owed. Turnover preserved here is turnover available in November.',
  },

  {
    sequence: 17,
    machinePar: 66,
    phase: 'RECOVERY_REENTRY',
    crisisDay: 'SEP 8',
    signalTitle: 'TECH CORRECTION: -11% IN THREE SESSIONS',
    signalBody: 'The names that led the recovery fall hardest. Nasdaq drops 11% in three sessions with no policy change and no economic news. Positioning unwinds. This is what concentration feels like from the inside, and it is the first test of whether your re-entry was sized or scrambled.',
    marketSignals: [
      { indicator: 'NASDAQ', value: '-11% / 3D', direction: 'down', magnitude: 'high' },
      { indicator: 'VIX', value: '33.6', direction: 'up', magnitude: 'high' },
      { indicator: 'SPX', value: '-6.7%', direction: 'down', magnitude: 'medium' },
      { indicator: 'CREDIT', value: 'STABLE', direction: 'neutral', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'POSITIONING', text: 'Options-driven unwind in megacap tech; no fundamental catalyst' },
      { category: 'CREDIT', text: 'Credit spreads unmoved: this is a positioning event, not a solvency one' },
      { category: 'RISK', text: 'Concentrated portfolios take the full move; diversified ones take part of it' },
      { category: 'MACHINE', text: 'Machine distinguishes a positioning unwind from a regime change' },
    ],
    portfolioEffect: { returnBias: -0.030, volatilityDelta: 0.04, correlationLevel: 0.71 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Credit is stable: the signal that mattered in March is absent here',
        'No regime rule fires on a positioning unwind',
        'Selling a three-day drawdown with intact credit is the March mistake at a smaller scale',
      ],
      policyReason: 'Positioning unwind with credit intact. No regime trigger, so no action.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: credit stable, no regime trigger',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { LOSS_CONTROL: 5, RULE_ADHERENCE: 6, DECISION_CONSISTENCY: 5 },
          teachingMessage: 'You separated a positioning unwind from a regime change by looking at credit. That distinction is the whole of March compressed into three days.',
          machineComparison: 'Machine holds on the same evidence.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: cut before it becomes another March',
        shortLabel: 'CUT',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['PANIC_REDUCTION_LARGE', 'RECENCY_BIAS'],
          alphaImpact: { LOSS_CONTROL: -4, REENTRY_DISCIPLINE: -5, TURNOVER_DISCIPLINE: -4 },
          teachingMessage: 'March taught you to respect drawdowns. It did not teach you that every drawdown is March. Credit was the tell then and it is the tell now.',
          machineComparison: 'Machine held. Selling here spends turnover on a memory.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: buy the dip in the leaders',
        shortLabel: 'BUY DIP',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING'],
          alphaImpact: { CONCENTRATION_CONTROL: -5, POSITION_SIZING: -3 },
          teachingMessage: 'Adding to the most concentrated exposure during its unwind increases the risk that just showed itself.',
          machineComparison: 'Machine held. Buying this dip is adding to the position that caused the move.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: tech into staples',
        shortLabel: 'ROTATE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['ACTION_BIAS'],
          alphaImpact: { CONCENTRATION_CONTROL: 3, TURNOVER_DISCIPLINE: -5 },
          teachingMessage: 'Reducing concentration is defensible. Doing it at the bottom of a three-day unwind pays the worst available price for it.',
          machineComparison: 'Machine held. The concentration decision belonged at checkpoint 13, not here.',
        },
      },
    ],
    teachingPoint: 'CREDIT WAS STABLE. IN MARCH IT WAS NOT. THE DIFFERENCE BETWEEN A POSITIONING UNWIND AND A REGIME CHANGE IS EVIDENCE, NOT FEELING.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. Every drawdown feels like the last one. The evidence said otherwise.',
  },

  {
    sequence: 18,
    machinePar: 62,
    phase: 'RECOVERY_REENTRY',
    crisisDay: 'OCT 28',
    signalTitle: 'SECOND WAVE AND AN ELECTION: TWO UNKNOWNS AT ONCE',
    signalBody: 'European lockdowns return. US cases hit records. An election is six days away and both outcomes are priced as volatile. The market falls 5% in a week. Two genuinely unknown events, and no rule you wrote anticipates either specifically.',
    marketSignals: [
      { indicator: 'SPX', value: '-5.6% / 1W', direction: 'down', magnitude: 'medium' },
      { indicator: 'VIX', value: '40.3', direction: 'up', magnitude: 'extreme' },
      { indicator: 'EU LOCKDOWNS', value: 'REINSTATED', direction: 'down', magnitude: 'high' },
      { indicator: 'CREDIT', value: 'STABLE', direction: 'neutral', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'HEALTH', text: 'France and Germany announce new national restrictions' },
      { category: 'POLITICS', text: 'Election outcome uncertain; both paths carry policy volatility' },
      { category: 'CREDIT', text: 'Spreads stable: liquidity conditions bear no resemblance to March' },
      { category: 'MACHINE', text: 'Machine has no rule for elections and does not invent one' },
    ],
    portfolioEffect: { returnBias: -0.022, volatilityDelta: 0.05, correlationLevel: 0.74 },
    machineDecision: {
      actionCode: 'RAISE_CASH',
      reasoning: [
        'Volatility above threshold with two unresolvable unknowns inside one week',
        'Raise a measured cash buffer: this is sizing, not a forecast',
        'No position on the election outcome, because no rule can price one',
        'A small buffer preserves the ability to act after the uncertainty resolves',
      ],
      policyReason: 'Volatility rule triggered. Buffer raised to preserve optionality, with no view taken on the outcome.',
      targetChanges: [{ asset: 'CASH', direction: 'increase', magnitude: 0.05 }],
    },
    availableActions: [
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE a measured buffer: sizing, not forecasting',
        shortLabel: 'BUFFER',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { LOSS_CONTROL: 6, RULE_ADHERENCE: 5, REGIME_ADAPTATION: 3 },
          teachingMessage: 'Raising a buffer because volatility breached a threshold is a rule firing. Raising one because you think you know the result is a forecast wearing a rule as a costume.',
          machineComparison: 'Machine raised the same buffer on the same trigger.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: elections are noise over any real horizon',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE'],
          alphaImpact: { TURNOVER_DISCIPLINE: 4, DECISION_CONSISTENCY: 3, LOSS_CONTROL: -2 },
          teachingMessage: 'Defensible. Elections are poor trading signals. Volatility at 40 is still a real change in the risk you are carrying.',
          machineComparison: 'Machine raised a buffer on the volatility rule, not on an election view.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: de-risk heavily ahead of the result',
        shortLabel: 'DE-RISK',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['PANIC_REDUCTION_LARGE', 'OVERCONFIDENCE'],
          alphaImpact: { REENTRY_DISCIPLINE: -6, LOSS_CONTROL: -3 },
          teachingMessage: 'A large reduction before a binary event is a position on the outcome. You have taken a view you have no edge in and created a re-entry problem you will face in a week.',
          machineComparison: 'Machine buffered. Positioning for an outcome nobody can price is not risk management.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: volatility is opportunity',
        shortLabel: 'ADD',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'CONTRARIAN_EARLY'],
          alphaImpact: { LOSS_CONTROL: -6, POSITION_SIZING: -4 },
          teachingMessage: 'Adding risk into two unresolved unknowns at VIX 40 is a forecast with extra steps.',
          machineComparison: 'Machine reduced exposure slightly. This adds it.',
        },
      },
    ],
    teachingPoint: 'A RULE THAT FIRES ON VOLATILITY IS RISK MANAGEMENT. A POSITION TAKEN ON AN ELECTION IS A FORECAST. THE MACHINE WILL NOT INVENT A RULE FOR SOMETHING IT CANNOT PRICE.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Defensible, though volatility at 40 is a genuine change in carried risk. The machine sized down without taking a view.',
  },

  {
    sequence: 19,
    machinePar: 64,
    phase: 'RECOVERY_REENTRY',
    crisisDay: 'NOV 9',
    signalTitle: 'VACCINE EFFICACY 90%: THE ROTATION ARRIVES IN ONE DAY',
    signalBody: 'Pfizer announces 90% efficacy. Airlines gain 15%, hotels 20%, stay-at-home names fall 12%, all before lunch. The entire recovery thesis inverts in a single session. Nobody had this date. The question is whether your portfolio needed it.',
    marketSignals: [
      { indicator: 'AIRLINES', value: '+15.2%', direction: 'up', magnitude: 'extreme' },
      { indicator: 'HOTELS', value: '+20.1%', direction: 'up', magnitude: 'extreme' },
      { indicator: 'STAY-AT-HOME', value: '-11.8%', direction: 'down', magnitude: 'high' },
      { indicator: 'SPX', value: '+1.2%', direction: 'up', magnitude: 'low' },
    ],
    eventFeed: [
      { category: 'HEALTH', text: 'Interim trial results far exceed expectations' },
      { category: 'ROTATION', text: 'Largest single-day value-over-growth move on record' },
      { category: 'INDEX', text: 'Index barely moves: the entire event is rotation beneath the surface' },
      { category: 'MACHINE', text: 'Machine held both sides and needed no forecast of the date' },
    ],
    portfolioEffect: { returnBias: 0.024, volatilityDelta: -0.02, correlationLevel: 0.44 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Portfolio held both reopening and stay-at-home exposure before the announcement',
        'A diversified book captures the rotation without predicting its date',
        'Chasing the winners after a 20% session buys the move at its highest price',
        'The index moved 1.2%: at portfolio level almost nothing happened',
      ],
      policyReason: 'Diversification did its job. No forecast was required and none is required now.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: you owned both sides already',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { CONCENTRATION_CONTROL: 6, DECISION_CONSISTENCY: 6, TURNOVER_DISCIPLINE: 4 },
          teachingMessage: 'This is what diversification is for. You did not need the date because you were not positioned against it.',
          machineComparison: 'Machine held. The rotation was captured, not predicted.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: reopening names after the move',
        shortLabel: 'CHASE',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['CHASING', 'RECENCY_BIAS'],
          alphaImpact: { REENTRY_DISCIPLINE: -5, POSITION_SIZING: -4 },
          teachingMessage: 'Buying airlines after a 15% session is paying for information the market has already absorbed.',
          machineComparison: 'Machine held. The move you are buying already happened.',
        },
      },
      {
        actionCode: 'ROTATE_RISK',
        label: 'ROTATE: fully out of stay-at-home into reopening',
        shortLabel: 'FULL ROTATE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['CHASING', 'OVERCONFIDENCE'],
          alphaImpact: { CONCENTRATION_CONTROL: -6, TURNOVER_DISCIPLINE: -5 },
          teachingMessage: 'Selling one concentrated bet to buy the opposite concentrated bet, on the day the news broke, is a forecast made after the fact.',
          machineComparison: 'Machine held both. Rotating fully replaces one undiversified position with another.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: stay-at-home exposure only',
        shortLabel: 'TRIM',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: [],
          alphaImpact: { REGIME_ADAPTATION: 3, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'Trimming the side whose thesis genuinely weakened is reasonable, though the price is worst on the day.',
          machineComparison: 'Machine held. The trim is defensible; its timing is the expensive part.',
        },
      },
    ],
    teachingPoint: 'NOBODY HAD THIS DATE. A DIVERSIFIED PORTFOLIO DID NOT NEED IT. THE MACHINE DOES NOT WIN BY KNOWING THE FUTURE. IT WINS BY NOT REQUIRING IT.',
    isRegimeChange: true,
    isHoldValid: true,
    holdTeaching: 'Correct. Owning both sides meant the rotation was captured rather than predicted. That is the whole argument of the game in one session.',
  },

  {
    sequence: 20,
    machinePar: 62,
    phase: 'RECOVERY_REENTRY',
    crisisDay: 'DEC 4',
    signalTitle: 'DRAWDOWN RECOVERED. THE PORTFOLIO IS NOT THE ONE YOU STARTED WITH.',
    signalBody: 'The portfolio is back above its February value. Nine months of decisions have left it somewhere you never explicitly chose: weights have drifted, one sector is larger than your rule allows, and the cash line no longer matches your policy. Recovery is not the same as being correctly positioned.',
    marketSignals: [
      { indicator: 'PORTFOLIO VS FEB', value: '+2.1%', direction: 'up', magnitude: 'medium' },
      { indicator: 'MAX SECTOR', value: '31%', direction: 'up', magnitude: 'high' },
      { indicator: 'CASH', value: 'OFF POLICY', direction: 'neutral', magnitude: 'medium' },
      { indicator: 'VIX', value: '20.8', direction: 'down', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'DRIFT', text: 'Largest sector weight has drifted past the policy limit through performance alone' },
      { category: 'POLICY', text: 'No decision created this position: nine months of drift did' },
      { category: 'RISK', text: 'Drift is a decision you did not make and are still carrying' },
      { category: 'MACHINE', text: 'Machine rebalances to policy on a drift threshold, not on a market view' },
    ],
    portfolioEffect: { returnBias: 0.008, volatilityDelta: -0.01, correlationLevel: 0.49 },
    machineDecision: {
      actionCode: 'REDUCE',
      reasoning: [
        'Sector weight above the policy limit: the drift rule fires',
        'Rebalancing is not a market call; it is a return to the position you chose',
        'Drift accumulates silently and is only visible when measured',
      ],
      policyReason: 'Drift threshold breached. Rebalance to policy weights.',
      targetChanges: [{ asset: 'TECHNOLOGY', direction: 'decrease', magnitude: 0.06 }],
    },
    availableActions: [
      {
        actionCode: 'REDUCE',
        label: 'REBALANCE: return the book to policy weights',
        shortLabel: 'REBALANCE',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { RULE_ADHERENCE: 7, CONCENTRATION_CONTROL: 6, POSITION_SIZING: 5 },
          teachingMessage: 'Rebalancing is how a portfolio stays the one you designed. Drift is the position nobody chose and everybody keeps.',
          machineComparison: 'Machine rebalances on the drift rule.',
        },
      },
      {
        actionCode: 'HOLD',
        label: 'HOLD: it recovered, do not touch it',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['ANCHORING', 'ACTION_BIAS'],
          alphaImpact: { RULE_ADHERENCE: -6, CONCENTRATION_CONTROL: -5 },
          teachingMessage: 'The portfolio recovered and drifted past your own limit at the same time. Leaving it there keeps a risk you explicitly wrote a rule against.',
          machineComparison: 'Machine rebalanced. Recovery is not the same as being positioned correctly.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: more of the sector that led the recovery',
        shortLabel: 'DOUBLE DOWN',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'CHASING'],
          alphaImpact: { CONCENTRATION_CONTROL: -8, RULE_ADHERENCE: -6 },
          teachingMessage: 'The sector is already past your limit. Adding to it is choosing the drift deliberately.',
          machineComparison: 'Machine reduced it to policy. This moves further from the rule.',
        },
      },
      {
        actionCode: 'ROTATE_DEFENSIVE',
        label: 'ROTATE: the excess into underweights',
        shortLabel: 'ROTATE',
        turnoverCost: 0.07,
        branchEffect: {
          flagsAdd: ['GOOD_PROCESS'],
          alphaImpact: { RULE_ADHERENCE: 5, CONCENTRATION_CONTROL: 5, TURNOVER_DISCIPLINE: -2 },
          teachingMessage: 'Same destination as a rebalance, slightly more turnover. Correct instinct, marginally more expensive route.',
          machineComparison: 'Machine trimmed to policy rather than rotating: same result, less turnover.',
        },
      },
    ],
    teachingPoint: 'NINE MONTHS OF DRIFT PRODUCED A PORTFOLIO YOU NEVER CHOSE. REBALANCING IS NOT A MARKET CALL. IT IS HOW A PORTFOLIO STAYS THE ONE YOU DESIGNED.',
    isRegimeChange: false,
    isHoldValid: false,
    holdTeaching: 'Holding a position past your own sector limit keeps a risk you wrote a rule to prevent.',
  },

  {
    sequence: 21,
    machinePar: 65,
    phase: 'RECOVERY_REENTRY',
    crisisDay: 'DEC 18',
    signalTitle: 'STRUCTURE NORMALISING. POSITIONING CROWDED.',
    signalBody: 'Volatility is back to pre-crisis levels. Credit is tight. Breadth is broad. Every measure says the crisis regime has ended, and every measure also says the market is positioned for it to keep ending. Calm and crowded are not the same thing, and neither is a signal on its own.',
    marketSignals: [
      { indicator: 'VIX', value: '21.6', direction: 'down', magnitude: 'medium' },
      { indicator: 'CREDIT SPREADS', value: 'PRE-CRISIS', direction: 'down', magnitude: 'medium' },
      { indicator: 'BREADTH', value: '78%', direction: 'up', magnitude: 'high' },
      { indicator: 'POSITIONING', value: 'CROWDED', direction: 'up', magnitude: 'high' },
    ],
    eventFeed: [
      { category: 'REGIME', text: 'Volatility and credit both back inside pre-crisis ranges' },
      { category: 'POSITIONING', text: 'Fund positioning at the highest equity weight in two years' },
      { category: 'RISK', text: 'Crowded positioning is a condition, not a timing signal' },
      { category: 'MACHINE', text: 'Machine returns to policy discipline rather than to a view' },
    ],
    portfolioEffect: { returnBias: 0.011, volatilityDelta: -0.02, correlationLevel: 0.42 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'Portfolio is at policy after the rebalance: no limit is breached',
        'Crowded positioning is a condition, not a trigger',
        'The crisis regime has ended; the discipline that survived it does not',
      ],
      policyReason: 'At policy, no rule triggered. The machine returns to routine rather than to a forecast.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: at policy, no trigger',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS'],
          alphaImpact: { RULE_ADHERENCE: 6, DECISION_CONSISTENCY: 6, TURNOVER_DISCIPLINE: 5 },
          teachingMessage: 'The portfolio is where your rules put it. That is the whole objective, and it is meant to feel unremarkable.',
          machineComparison: 'Machine holds. Discipline outlasts the regime that demanded it.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE cash: crowded positioning is a warning',
        shortLabel: 'DE-RISK',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['CONTRARIAN_EARLY'],
          alphaImpact: { REENTRY_DISCIPLINE: -4, RULE_ADHERENCE: -3 },
          teachingMessage: 'Crowded positioning tells you what could happen, never when. Acting on it without a trigger is a forecast, and it recreates the cash problem you just solved.',
          machineComparison: 'Machine held. A condition is not a trigger.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: the regime has clearly turned',
        shortLabel: 'ADD',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE', 'CHASING'],
          alphaImpact: { POSITION_SIZING: -5, RULE_ADHERENCE: -4 },
          teachingMessage: 'Adding beyond policy because conditions look good is how the next drawdown finds you oversized.',
          machineComparison: 'Machine held at policy.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: take profits into strength',
        shortLabel: 'TRIM',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { RULE_ADHERENCE: -3, TURNOVER_DISCIPLINE: -3 },
          teachingMessage: 'Selling at policy weight with no breach is trading on comfort rather than on a rule.',
          machineComparison: 'Machine held. No limit was breached.',
        },
      },
    ],
    teachingPoint: 'CALM AND CROWDED ARE BOTH TRUE AND NEITHER IS A TRIGGER. THE REGIME ENDED. THE PROCESS DOES NOT GET TO.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. At policy with no breach, holding is the rule working. It is supposed to feel like nothing happened.',
  },

  {
    sequence: 22,
    machinePar: 67,
    phase: 'RECOVERY_REENTRY',
    crisisDay: 'DEC 31',
    signalTitle: 'HISTORICAL WINDOW CLOSED',
    signalBody: 'The year ends. You did not know the bottom, the policy path, the recovery speed, the sector leaders, or the vaccine date. Neither did the machine. It faced the same cutoff at every checkpoint you did. One last decision, on the same terms as the first.',
    marketSignals: [
      { indicator: 'SPX 2020', value: '+16.3%', direction: 'up', magnitude: 'high' },
      { indicator: 'MAX DRAWDOWN', value: '-33.9%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'DAYS TO RECOVER', value: '149', direction: 'neutral', magnitude: 'medium' },
      { indicator: 'VIX CLOSE', value: '22.8', direction: 'down', magnitude: 'medium' },
    ],
    eventFeed: [
      { category: 'CHRONOLOGY', text: 'Bottom: MAR 23. Nobody in this run was told that at the time' },
      { category: 'CHRONOLOGY', text: 'Full index recovery took 149 sessions from the low' },
      { category: 'RECORD', text: 'Your decisions are now a record you can audit against the machine' },
      { category: 'MACHINE', text: 'Machine faced the identical information cutoff at every checkpoint' },
    ],
    portfolioEffect: { returnBias: 0.006, volatilityDelta: -0.01, correlationLevel: 0.40 },
    machineDecision: {
      actionCode: 'HOLD',
      reasoning: [
        'No limit breached and no rule triggered at the close of the window',
        'A year end is a calendar event, not a portfolio event',
        'The process ends the arena the way it ran it: on the rules',
      ],
      policyReason: 'No trigger. The window closes with the portfolio at policy.',
      targetChanges: [],
    },
    availableActions: [
      {
        actionCode: 'HOLD',
        label: 'HOLD: close the window at policy',
        shortLabel: 'HOLD',
        turnoverCost: 0,
        branchEffect: {
          flagsAdd: ['PATIENCE_POSITIVE', 'GOOD_PROCESS', 'ADAPTATION_EVENT'],
          alphaImpact: { DECISION_CONSISTENCY: 7, RULE_ADHERENCE: 6, TURNOVER_DISCIPLINE: 4 },
          teachingMessage: 'You finished the way you were meant to: on the rules, with nothing owed. The record is now yours to read.',
          machineComparison: 'Machine holds. Same cutoff, same information, all the way through.',
        },
      },
      {
        actionCode: 'REDUCE',
        label: 'REDUCE: lock in the year',
        shortLabel: 'LOCK IN',
        turnoverCost: 0.05,
        branchEffect: {
          flagsAdd: ['ANCHORING'],
          alphaImpact: { RULE_ADHERENCE: -4, TURNOVER_DISCIPLINE: -3 },
          teachingMessage: 'A date on a calendar is not a portfolio trigger. Nothing about the risk you carry changed at midnight.',
          machineComparison: 'Machine held. December 31 is not an event.',
        },
      },
      {
        actionCode: 'ADD_RISK',
        label: 'ADD: position for next year',
        shortLabel: 'POSITION',
        turnoverCost: 0.06,
        branchEffect: {
          flagsAdd: ['OVERCONFIDENCE'],
          alphaImpact: { POSITION_SIZING: -4, RULE_ADHERENCE: -4 },
          teachingMessage: 'Positioning for a year you cannot see is the belief this arena was built to test.',
          machineComparison: 'Machine held. The next regime is the next arena, not this one.',
        },
      },
      {
        actionCode: 'RAISE_CASH',
        label: 'RAISE CASH: buffer before an unknown year',
        shortLabel: 'CASH',
        turnoverCost: 0.04,
        branchEffect: {
          flagsAdd: ['CONTRARIAN_EARLY'],
          alphaImpact: { REENTRY_DISCIPLINE: -4, RULE_ADHERENCE: -3 },
          teachingMessage: 'Raising cash against an unknown with no trigger is the March decision made without March evidence.',
          machineComparison: 'Machine held. Uncertainty is permanent; a trigger is specific.',
        },
      },
    ],
    teachingPoint: 'YOU DID NOT KNOW THE BOTTOM, THE POLICY PATH, THE RECOVERY SPEED, THE SECTOR LEADERS OR THE VACCINE DATE. NEITHER DID THE MACHINE. IT MONITORED MORE, UPDATED CONSISTENTLY AND FOLLOWED A PROCESS.',
    isRegimeChange: false,
    isHoldValid: true,
    holdTeaching: 'Correct. The window closes with the portfolio at policy and nothing owed.',
  },
];

// ─── Arena registration ───────────────────────────────────────────────────────

import { registerArena, buildPortfolio } from './arenas';

/**
 * The book the player is handed for COVID.
 *
 * Ten names carrying three embedded risks the arena goes on to expose: travel
 * (DAL + MAR = 16%), tech concentration (MSFT + AAPL = 20%) and cyclicals
 * (CAT + XOM + HD = 23%). None of that is stated to the player. It is the
 * thing the correlation lessons reveal.
 */
export const COVID_ARENA = registerArena({
  id: 'covid_black_swan',
  name: 'COVID BLACK SWAN',
  order: 1,
  difficulty: 3,
  lesson: 'Uncertainty, correlation and the cost of acting on pain rather than evidence.',
  window: 'JAN 2020 - DEC 2020',
  checkpoints: COVID_CHECKPOINTS,
  criticalDrawdown: -0.20,
  startingPortfolio: () => buildPortfolio(
    [
      { symbol: 'MSFT', weight: 0.10, riskContrib: 0.14, sector: 'TECHNOLOGY' },
      { symbol: 'AAPL', weight: 0.10, riskContrib: 0.14, sector: 'TECHNOLOGY' },
      { symbol: 'JPM',  weight: 0.10, riskContrib: 0.18, sector: 'FINANCIALS' },
      { symbol: 'DAL',  weight: 0.08, riskContrib: 0.20, sector: 'AIRLINES' },
      { symbol: 'MAR',  weight: 0.08, riskContrib: 0.18, sector: 'HOTELS' },
      { symbol: 'XOM',  weight: 0.08, riskContrib: 0.16, sector: 'ENERGY' },
      { symbol: 'JNJ',  weight: 0.08, riskContrib: 0.07, sector: 'HEALTHCARE' },
      { symbol: 'PG',   weight: 0.08, riskContrib: 0.06, sector: 'CONSUMER STAPLES' },
      { symbol: 'CAT',  weight: 0.08, riskContrib: 0.15, sector: 'INDUSTRIALS' },
      { symbol: 'HD',   weight: 0.07, riskContrib: 0.10, sector: 'CONSUMER DISCRETIONARY' },
    ],
    { volatility: 0.16, correlationIndex: 0.48, startingCapital: 100000 },
  ),
});

// Kept for callers that predate the registry and only ever meant COVID.
export function getCovidCheckpoint(sequence: number): CheckpointData | undefined {
  return COVID_CHECKPOINTS.find(cp => cp.sequence === sequence);
}
