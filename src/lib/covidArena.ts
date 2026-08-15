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
];

// ─── Arena exports ────────────────────────────────────────────────────────────

export function getCheckpoint(sequence: number): CheckpointData | undefined {
  return COVID_CHECKPOINTS.find(cp => cp.sequence === sequence);
}

export function getTotalCheckpoints(): number {
  return COVID_CHECKPOINTS.length;
}
