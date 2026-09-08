// ─── Locked baskets ───────────────────────────────────────────────────────────
//
// The Basket Writer produced a basket and then forgot it: LOCK BASKET was a
// navigation. A locked basket is a player artifact (§3 maps Basket Builder to
// Strategy Review), a TACO prerequisite, and part of the finale record, so it
// is stored like a machine version: locally, synchronously, with a hash.
//
// What it is NOT yet: an input to the machine's decisions. The policy engine
// acts on authored checkpoint effects, not per-symbol prices, so wiring a
// symbol list into it would be invented economics. Stated here so nobody
// reads the store as more than it is.

export interface BasketConstituent {
  symbol: string;
  /** Percent of the book, e.g. 8 for 8%. */
  weight: number;
  sector: string;
}

export interface BasketRecord {
  recordVersion: number;
  basketId: string;
  constituents: BasketConstituent[];
  cashPct: number;
  hash: string;
  lockedAt: string;
}

export const BASKET_RECORD_VERSION = 1;
const STORE_KEY = 'refi_baskets';
const MAX_STORED = 20;

/** Spec 2.1: U.S.-listed common equities only. ETFs, bonds and gold are out. */
export const BASKET_UNIVERSE: readonly { symbol: string; sector: string }[] = [
  { symbol: 'AAPL', sector: 'TECH' },
  { symbol: 'MSFT', sector: 'TECH' },
  { symbol: 'GOOGL', sector: 'TECH' },
  { symbol: 'NVDA', sector: 'TECH' },
  { symbol: 'AMZN', sector: 'CONS DISC' },
  { symbol: 'HD', sector: 'CONS DISC' },
  { symbol: 'JNJ', sector: 'HEALTH' },
  { symbol: 'UNH', sector: 'HEALTH' },
  { symbol: 'XOM', sector: 'ENERGY' },
  { symbol: 'CVX', sector: 'ENERGY' },
  { symbol: 'JPM', sector: 'FINANCIALS' },
  { symbol: 'BAC', sector: 'FINANCIALS' },
  { symbol: 'PG', sector: 'CONS STAP' },
  { symbol: 'KO', sector: 'CONS STAP' },
  { symbol: 'CAT', sector: 'INDUSTRIALS' },
  { symbol: 'DAL', sector: 'INDUSTRIALS' },
];

export const DEFAULT_BASKET: BasketConstituent[] = [
  { symbol: 'AAPL', weight: 8.0, sector: 'TECH' },
  { symbol: 'MSFT', weight: 8.0, sector: 'TECH' },
  { symbol: 'JNJ', weight: 7.0, sector: 'HEALTH' },
  { symbol: 'XOM', weight: 6.0, sector: 'ENERGY' },
  { symbol: 'JPM', weight: 8.0, sector: 'FINANCIALS' },
  { symbol: 'PG', weight: 7.0, sector: 'CONS STAP' },
];

export const BASKET_CASH_PCT = 5.0;

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Order-independent: the same holdings at the same weights hash the same. */
export function basketHash(constituents: readonly BasketConstituent[], cashPct: number): string {
  const canon = [...constituents]
    .map(c => `${c.symbol}:${c.weight.toFixed(1)}`)
    .sort()
    .join('|') + `|CASH:${cashPct.toFixed(1)}`;
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(8, '0');
  const all = hex(fnv1a(canon)) + hex(fnv1a(`${canon}:1`));
  return `${all.slice(0, 4)}:${all.slice(4, 8)}:${all.slice(8, 12)}`;
}

function readAll(): BasketRecord[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as BasketRecord[]).filter(
      r => r && typeof r === 'object' && r.recordVersion === BASKET_RECORD_VERSION && Array.isArray(r.constituents),
    );
  } catch {
    return [];
  }
}

function writeAll(records: BasketRecord[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(records.slice(0, MAX_STORED)));
  } catch { /* storage unavailable; the lock must not break the screen */ }
}

/** Newest first. */
export function listBaskets(): BasketRecord[] {
  return readAll().slice().sort((a, b) => (a.lockedAt < b.lockedAt ? 1 : a.lockedAt > b.lockedAt ? -1 : 0));
}

export function latestBasket(): BasketRecord | null {
  return listBaskets()[0] ?? null;
}

/** Lock a basket. Re-locking an identical basket returns the existing record. */
export function lockBasket(
  constituents: readonly BasketConstituent[],
  cashPct: number = BASKET_CASH_PCT,
  now: string = new Date().toISOString(),
): BasketRecord {
  const hash = basketHash(constituents, cashPct);
  const existing = readAll().find(r => r.hash === hash);
  if (existing) return existing;
  const record: BasketRecord = {
    recordVersion: BASKET_RECORD_VERSION,
    basketId: `bsk_${hash.replace(/:/g, '').toLowerCase()}`,
    constituents: constituents.map(c => ({ ...c })),
    cashPct,
    hash,
    lockedAt: now,
  };
  writeAll([record, ...readAll()]);
  return record;
}

export function clearBaskets(): void {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}
