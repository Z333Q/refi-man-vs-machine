import type { DailyTape, ActionCode } from './gameTypes';

// ─── Daily tape seed data ─────────────────────────────────────────────────────
// U.S. equities only. Each tape shows named stock positions with context signals.
// Rates, VIX, oil, and credit spreads appear only as market context — not actions.
// Player chooses between equity actions: rotate, reduce, add, hold, raise cash.

const TAPE_LIBRARY: Omit<DailyTape, 'date'>[] = [

  // ─── TAPE 001: SEMICONDUCTOR SUPPLY CHAIN STRESS ─────────────────────────
  {
    id: 'tape_001',
    title: 'SEMICONDUCTOR SUPPLY CHAIN STRESS',
    signals: [
      { category: 'SEMIS', text: 'Lead times extending to 40+ weeks: demand visible, supply constrained' },
      { category: 'TECH', text: 'NVDA and AMD flagging capacity constraints in guidance updates' },
      { category: 'AUTOS', text: 'F and GM citing chip shortage impact on Q3 production schedules' },
      { category: 'CONTEXT', text: 'VIX stable. Rates unchanged. This is a supply issue, not demand issue.' },
    ],
    marketData: [
      { indicator: 'NVDA', value: '+3.2%', direction: 'up', magnitude: 'medium' },
      { indicator: 'F', value: '-2.8%', direction: 'down', magnitude: 'medium' },
      { indicator: 'GM', value: '-3.1%', direction: 'down', magnitude: 'medium' },
      { indicator: 'SPX', value: '+0.4%', direction: 'up', magnitude: 'low' },
    ],
    availableActions: [
      { code: 'HOLD', label: 'HOLD: semiconductor demand remains structurally strong' },
      { code: 'REDUCE', label: 'REDUCE autos: production impairment is real near-term' },
      { code: 'ADD_RISK', label: 'ADD NVDA: constraint proves demand; pricing power confirmed' },
      { code: 'ROTATE_DEFENSIVE', label: 'ROTATE: reduce tech/autos, add healthcare/staples' },
    ],
    correctAction: 'ADD_RISK',
    machineAction: 'ADD_RISK',
    explanation: 'SUPPLY CONSTRAINT WITH STRONG DEMAND IS NOT A RISK: IT IS A PRICING POWER SIGNAL. NVDA FACING CAPACITY CONSTRAINTS CONFIRMS DEMAND EXCEEDS SUPPLY. AUTO IMPAIRMENT IS TEMPORARY AND QUANTIFIABLE. THE MACHINE ADDS TO THE SUPPLY-CONSTRAINED SEMICONDUCTOR EQUITY, NOT AWAY FROM IT.',
    playerScore: 72,
    machineScore: 82,
    crowdDistribution: { HOLD: 0.32, REDUCE: 0.28, ROTATE_DEFENSIVE: 0.18, ADD_RISK: 0.22, RAISE_CASH: 0, ROTATE_RISK: 0, STAGED_BUY: 0, STAGED_SELL: 0 },
  },

  // ─── TAPE 002: BANK EARNINGS — LOAN LOSS PROVISIONS SURGE ────────────────
  {
    id: 'tape_002',
    title: 'BANK EARNINGS: LOAN LOSS PROVISIONS SURGE',
    signals: [
      { category: 'BANKS', text: 'JPM and BAC report: loan loss provisions +40% quarter-over-quarter' },
      { category: 'CREDIT', text: 'Consumer delinquency rates rising: credit card and auto loans' },
      { category: 'RATES', text: '10Y yield -18bp today: curve flattening compresses bank NIM' },
      { category: 'CONTEXT', text: 'Broad market flat. Banks leading sector underperformance.' },
    ],
    marketData: [
      { indicator: 'JPM', value: '-5.8%', direction: 'down', magnitude: 'high' },
      { indicator: 'BAC', value: '-6.1%', direction: 'down', magnitude: 'high' },
      { indicator: 'WFC', value: '-4.9%', direction: 'down', magnitude: 'medium' },
      { indicator: 'SPX', value: '-0.8%', direction: 'down', magnitude: 'low' },
    ],
    availableActions: [
      { code: 'HOLD', label: 'HOLD: provisions are a lagging indicator of past losses' },
      { code: 'REDUCE', label: 'REDUCE financials: credit cycle turning negative' },
      { code: 'ROTATE_DEFENSIVE', label: 'ROTATE: sell banks, add consumer staples' },
      { code: 'ADD_RISK', label: 'ADD: banks oversold on provision headline' },
    ],
    correctAction: 'REDUCE',
    machineAction: 'REDUCE',
    explanation: 'RISING LOAN LOSS PROVISIONS + CURVE FLATTENING = DOUBLE COMPRESSION ON BANK EARNINGS. PROVISIONS +40% QOQ IS NOT A LAGGING SIGNAL: IT IS MANAGEMENT TELLING YOU CREDIT DETERIORATED FASTER THAN EXPECTED. REDUCING FINANCIAL EXPOSURE ON CONFIRMED CREDIT CYCLE TURN IS CORRECT PROCESS.',
    playerScore: 70,
    machineScore: 81,
    crowdDistribution: { HOLD: 0.34, REDUCE: 0.31, ROTATE_DEFENSIVE: 0.22, ADD_RISK: 0.13, RAISE_CASH: 0, ROTATE_RISK: 0, STAGED_BUY: 0, STAGED_SELL: 0 },
  },

  // ─── TAPE 003: STRONG RETAIL SALES — LATE CYCLE CONSUMER ─────────────────
  {
    id: 'tape_003',
    title: 'STRONG RETAIL SALES: SAVINGS-FUNDED SPENDING',
    signals: [
      { category: 'RETAIL', text: 'Retail sales +1.2% MoM: above all consensus estimates' },
      { category: 'CONSUMER', text: 'Savings rate declining: consumers spending down pandemic reserves' },
      { category: 'CREDIT', text: 'Credit card balances at record highs. Delinquencies rising slowly.' },
      { category: 'EQUITIES', text: 'WMT, COST, HD outperforming today on retail beat' },
    ],
    marketData: [
      { indicator: 'WMT', value: '+3.1%', direction: 'up', magnitude: 'medium' },
      { indicator: 'COST', value: '+2.8%', direction: 'up', magnitude: 'medium' },
      { indicator: 'HD', value: '+2.2%', direction: 'up', magnitude: 'medium' },
      { indicator: 'SPX', value: '+1.1%', direction: 'up', magnitude: 'low' },
    ],
    availableActions: [
      { code: 'HOLD', label: 'HOLD: strong consumer is fundamentally good for equities' },
      { code: 'ADD_RISK', label: 'ADD consumer discretionary: retail momentum confirmed' },
      { code: 'ROTATE_DEFENSIVE', label: 'ROTATE: late cycle, add staples over discretionary' },
      { code: 'REDUCE', label: 'REDUCE consumer discretionary: savings-funded is unsustainable' },
    ],
    correctAction: 'HOLD',
    machineAction: 'HOLD',
    explanation: 'ONE STRONG RETAIL PRINT DOES NOT CONFIRM A CONSUMER CYCLE. DECLINING SAVINGS RATE WITH RISING CREDIT BALANCES IS A LATE CYCLE PATTERN, NOT SUSTAINABLE DEMAND. THE MACHINE DOES NOT ADD CONSUMER DISCRETIONARY ON ONE DATA POINT WHEN CREDIT QUALITY IS SIMULTANEOUSLY DETERIORATING. HOLD AND MONITOR.',
    playerScore: 74,
    machineScore: 80,
    crowdDistribution: { HOLD: 0.26, ADD_RISK: 0.34, ROTATE_DEFENSIVE: 0.22, REDUCE: 0.18, RAISE_CASH: 0, ROTATE_RISK: 0, STAGED_BUY: 0, STAGED_SELL: 0 },
  },

  // ─── TAPE 004: TARIFF ANNOUNCEMENT — UNEQUAL SECTOR DAMAGE ───────────────
  {
    id: 'tape_004',
    title: 'TARIFF ANNOUNCEMENT: SECTOR DAMAGE IS UNEQUAL',
    signals: [
      { category: 'POLICY', text: 'New tariff package announced: implementation date uncertain' },
      { category: 'EXPOSURE', text: 'Autos and industrials have highest direct import exposure' },
      { category: 'DEFENSIVE', text: 'Consumer staples and healthcare have domestic production or pricing power' },
      { category: 'PATTERN', text: 'Similar announcement reversed within 30 days last time. VIX +18%.' },
    ],
    marketData: [
      { indicator: 'F', value: '-8.2%', direction: 'down', magnitude: 'extreme' },
      { indicator: 'CAT', value: '-6.4%', direction: 'down', magnitude: 'high' },
      { indicator: 'PG', value: '-1.2%', direction: 'down', magnitude: 'low' },
      { indicator: 'JNJ', value: '-0.8%', direction: 'down', magnitude: 'low' },
    ],
    availableActions: [
      { code: 'HOLD', label: 'HOLD: will likely reverse like last time' },
      { code: 'REDUCE', label: 'REDUCE import-exposed equities: trade policy is a real risk' },
      { code: 'ROTATE_DEFENSIVE', label: 'ROTATE: sell autos/industrials, add staples/healthcare' },
      { code: 'ADD_RISK', label: 'BUY: pattern says it reverses; market overselling' },
    ],
    correctAction: 'ROTATE_DEFENSIVE',
    machineAction: 'ROTATE_DEFENSIVE',
    explanation: 'TARIFF DAMAGE IS NOT UNIFORM. F AND CAT HAVE HIGH DIRECT IMPORT EXPOSURE AND NO PRICING POWER. PG AND JNJ HAVE DOMESTIC PRODUCTION AND PRICING POWER. THE MACHINE DOES NOT TRADE THE MACRO HEADLINE: IT ASKS WHICH COMPANIES HAVE FUNDAMENTALLY CHANGED AND WHICH HAVE NOT. TRADING THE PATTERN ("IT REVERSED LAST TIME") IS THE TRAP.',
    playerScore: 68,
    machineScore: 83,
    crowdDistribution: { HOLD: 0.29, REDUCE: 0.22, ROTATE_DEFENSIVE: 0.21, ADD_RISK: 0.28, RAISE_CASH: 0, ROTATE_RISK: 0, STAGED_BUY: 0, STAGED_SELL: 0 },
  },

  // ─── TAPE 005: ENERGY EARNINGS BEAT WITH GUIDANCE CUT ────────────────────
  {
    id: 'tape_005',
    title: 'ENERGY EARNINGS BEAT: GUIDANCE CUT',
    signals: [
      { category: 'EARNINGS', text: 'XOM beats Q2 EPS by 12%: strong production and realized prices' },
      { category: 'GUIDANCE', text: 'XOM cuts Q3 capex guidance 15%: management citing demand uncertainty' },
      { category: 'CONTEXT', text: 'Oil demand growth flat. Energy transition pressure accelerating.' },
      { category: 'EQUITIES', text: 'Energy sector mixed: XOM +2.1%, CVX -1.4%, OXY -2.8%' },
    ],
    marketData: [
      { indicator: 'XOM', value: '+2.1%', direction: 'up', magnitude: 'low' },
      { indicator: 'CVX', value: '-1.4%', direction: 'down', magnitude: 'low' },
      { indicator: 'OXY', value: '-2.8%', direction: 'down', magnitude: 'medium' },
      { indicator: 'SPX', value: '+0.2%', direction: 'up', magnitude: 'low' },
    ],
    availableActions: [
      { code: 'HOLD', label: 'HOLD: beat with capex cut means capital discipline' },
      { code: 'ADD_RISK', label: 'ADD XOM: earnings quality plus capital discipline is positive' },
      { code: 'REDUCE', label: 'REDUCE energy: guidance cut is the real forward signal' },
      { code: 'ROTATE_RISK', label: 'ROTATE: sell energy, add tech on demand uncertainty' },
    ],
    correctAction: 'HOLD',
    machineAction: 'HOLD',
    explanation: 'BEAT PLUS CAPEX CUT IS A MIXED SIGNAL. THE BEAT IS REAL: BUT MANAGEMENT CUTTING FORWARD CAPEX SIGNALS DEMAND UNCERTAINTY THEY SEE AND YOU DO NOT. THE MACHINE DOES NOT ADD TO ENERGY ON A MIXED GUIDANCE QUARTER. CAPITAL DISCIPLINE IS POSITIVE FOR RETURN ON EQUITY BUT NOT A RE-RATING CATALYST. HOLD.',
    playerScore: 71,
    machineScore: 78,
    crowdDistribution: { HOLD: 0.31, ADD_RISK: 0.28, REDUCE: 0.24, ROTATE_RISK: 0.17, RAISE_CASH: 0, ROTATE_DEFENSIVE: 0, STAGED_BUY: 0, STAGED_SELL: 0 },
  },

  // ─── TAPE 006: HEALTHCARE M&A SPECULATION ────────────────────────────────
  {
    id: 'tape_006',
    title: 'HEALTHCARE M&A: SECTOR PREMIUM SPECULATION',
    signals: [
      { category: 'M&A', text: 'ABBV acquires biotech at 48% premium: rare disease pipeline expansion' },
      { category: 'SECTOR', text: 'Healthcare M&A activity highest since 2019: pipeline shopping by large caps' },
      { category: 'REGULATORY', text: 'FTC scrutiny of pharma M&A rising: deal execution risk increasing' },
      { category: 'EQUITIES', text: 'JNJ, UNH, PFE rising on sector-wide M&A premium expectation' },
    ],
    marketData: [
      { indicator: 'ABBV', value: '-3.1%', direction: 'down', magnitude: 'medium' },
      { indicator: 'JNJ', value: '+2.4%', direction: 'up', magnitude: 'medium' },
      { indicator: 'UNH', value: '+1.9%', direction: 'up', magnitude: 'low' },
      { indicator: 'SPX', value: '+0.3%', direction: 'up', magnitude: 'low' },
    ],
    availableActions: [
      { code: 'HOLD', label: 'HOLD: M&A premium is sector-wide, not single-name' },
      { code: 'ADD_RISK', label: 'ADD JNJ/UNH: M&A premium expanding to large caps' },
      { code: 'REDUCE', label: 'REDUCE ABBV: acquirer overpaying; typical pattern is underperformance' },
      { code: 'ROTATE_RISK', label: 'ROTATE into small biotech: acquisition targets trade at steeper discount' },
    ],
    correctAction: 'HOLD',
    machineAction: 'HOLD',
    explanation: 'SECTOR M&A RAISES PREMIUMS ACROSS THE SPACE: BUT ACQUIRER (ABBV) TYPICALLY UNDERPERFORMS. THE MACHINE DOES NOT CHASE M&A PREMIUM SPECULATION INTO LARGE CAP NAMES THAT WILL NOT BE ACQUIRED. HOLD EXISTING JNJ POSITION. TRADING ON ACQUISITION SPECULATION IS NOT PROCESS.',
    playerScore: 73,
    machineScore: 79,
    crowdDistribution: { HOLD: 0.29, ADD_RISK: 0.38, REDUCE: 0.15, ROTATE_RISK: 0.18, RAISE_CASH: 0, ROTATE_DEFENSIVE: 0, STAGED_BUY: 0, STAGED_SELL: 0 },
  },

  // ─── TAPE 007: CONCENTRATION CHECK — TECH AT 40% ─────────────────────────
  {
    id: 'tape_007',
    title: 'PORTFOLIO CONCENTRATION: TECH AT 41%',
    signals: [
      { category: 'PORTFOLIO', text: 'MSFT + AAPL + NVDA + META = 41% of portfolio after run-up' },
      { category: 'CORRELATION', text: 'All four names at 0.82+ correlation: effective single 41% bet' },
      { category: 'EARNINGS', text: 'Q3 earnings season begins in 11 days: all four report same week' },
      { category: 'CONTEXT', text: 'Broad market at new highs. Tech leading. No macro catalyst today.' },
    ],
    marketData: [
      { indicator: 'MSFT', value: '+1.4%', direction: 'up', magnitude: 'low' },
      { indicator: 'AAPL', value: '+0.9%', direction: 'up', magnitude: 'low' },
      { indicator: 'NVDA', value: '+2.1%', direction: 'up', magnitude: 'low' },
      { indicator: 'SPX', value: '+0.6%', direction: 'up', magnitude: 'low' },
    ],
    availableActions: [
      { code: 'HOLD', label: 'HOLD: tech thesis intact and positions working' },
      { code: 'REDUCE', label: 'REDUCE tech concentration: portfolio rule, not market call' },
      { code: 'ADD_RISK', label: 'ADD: momentum confirmed; market at all-time highs' },
      { code: 'RAISE_CASH', label: 'RAISE CASH: concentration ahead of earnings season is risky' },
    ],
    correctAction: 'REDUCE',
    machineAction: 'REDUCE',
    explanation: 'FOUR STOCKS AT 0.82+ CORRELATION IS ONE ECONOMIC BET AT 41%. THE MACHINE DOES NOT CARE THAT THE THESIS IS WORKING: IT CARES THAT PORTFOLIO RISK IS MISALIGNED WITH POLICY. FOUR NAMES REPORTING SAME WEEK AMPLIFIES THE CONCENTRATION PROBLEM. TRIM TO POLICY THRESHOLD. THIS IS A PORTFOLIO RULE, NOT A MARKET CALL.',
    playerScore: 66,
    machineScore: 84,
    crowdDistribution: { HOLD: 0.38, REDUCE: 0.27, ADD_RISK: 0.24, RAISE_CASH: 0.11, ROTATE_DEFENSIVE: 0, ROTATE_RISK: 0, STAGED_BUY: 0, STAGED_SELL: 0 },
  },
];

export function getTodaysTape(): DailyTape {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const tapeIndex = dayOfYear % TAPE_LIBRARY.length;
  const tape = TAPE_LIBRARY[tapeIndex];
  const dateStr = now.toISOString().split('T')[0];
  return { ...tape, date: dateStr };
}

export function getYesterdaysTape(): DailyTape {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dayOfYear = Math.floor((yesterday.getTime() - new Date(yesterday.getFullYear(), 0, 0).getTime()) / 86400000);
  const tapeIndex = dayOfYear % TAPE_LIBRARY.length;
  const tape = TAPE_LIBRARY[tapeIndex];
  const dateStr = yesterday.toISOString().split('T')[0];
  return { ...tape, date: dateStr };
}

export function scoreTapeDecision(playerAction: ActionCode, tape: DailyTape): number {
  if (playerAction === tape.correctAction) return tape.playerScore + 8;
  if (playerAction === tape.machineAction) return tape.playerScore;
  return tape.playerScore - 12;
}
