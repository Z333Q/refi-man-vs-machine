/*
# ReFi Alpha — U.S. Equity Scope Enforcement

## Summary
Adds the securities universe enforcement layer. ReFi Alpha is a U.S. equities-only
game. All playable positions must be U.S.-listed common stocks. Bonds, gold,
commodities, FX, and international securities are not playable assets.

## New Tables

### `securities`
Defines the eligible U.S. equity universe. Only COMMON_STOCK listed in the US
with USD currency is permitted. International securities, ETFs (except eligible
ones), bonds, and commodities are excluded by constraint.

Columns:
- `id` — uuid primary key
- `symbol` — ticker symbol (e.g. MSFT, AAPL)
- `company_name` — full company name
- `exchange` — NYSE, NASDAQ, NYSE AMERICAN
- `security_type` — enforced as COMMON_STOCK
- `sector_code` — GICS sector classification
- `industry_code` — GICS industry
- `country_of_listing` — enforced as US
- `currency` — enforced as USD
- `first_trade_date` — for point-in-time eligibility
- `last_trade_date` — null if still active
- `is_active` — current eligibility status

### `arena_universes`
Maps which securities were eligible in each historical arena at each point in time.
Supports point-in-time reconstruction — a company only appears if it was eligible
on the simulated historical date.

Columns:
- `id` — uuid primary key
- `arena_id` — references the arena identifier (text, not FK to avoid dependency)
- `symbol` — ticker symbol
- `eligible_from` — when the stock became eligible in this arena
- `eligible_to` — when it stopped being eligible (null = still eligible)
- `liquidity_band` — LARGE, MID, SMALL
- `market_cap_band` — MEGA, LARGE, MID, SMALL

## Security

RLS enabled on both tables. Read-only for all users (anon + authenticated).
Game content is intentionally public — these are reference data tables.

## Important Notes

1. The check constraints enforce the scope: COMMON_STOCK + US + USD only.
2. No bonds (IEF, TLT), no gold (GLD), no commodities (USO, DBO) may enter the
   securities table — the security_type constraint prevents it.
3. The arena_universes table supports point-in-time eligibility: survivors of the
   crisis are only shown if they existed pre-crisis (no lookahead survivorship bias).
4. These tables are seeded separately with the actual universe data.
*/

CREATE TABLE IF NOT EXISTS securities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  company_name text NOT NULL,
  exchange text NOT NULL,
  security_type text NOT NULL DEFAULT 'COMMON_STOCK',
  sector_code text,
  industry_code text,
  country_of_listing text NOT NULL DEFAULT 'US',
  currency text NOT NULL DEFAULT 'USD',
  first_trade_date date,
  last_trade_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT securities_type_check CHECK (security_type = 'COMMON_STOCK'),
  CONSTRAINT securities_country_check CHECK (country_of_listing = 'US'),
  CONSTRAINT securities_currency_check CHECK (currency = 'USD'),
  CONSTRAINT securities_exchange_check CHECK (exchange IN ('NYSE', 'NASDAQ', 'NYSE AMERICAN'))
);

CREATE TABLE IF NOT EXISTS arena_universes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id text NOT NULL,
  symbol text NOT NULL,
  eligible_from date NOT NULL,
  eligible_to date,
  liquidity_band text CHECK (liquidity_band IN ('LARGE', 'MID', 'SMALL')),
  market_cap_band text CHECK (market_cap_band IN ('MEGA', 'LARGE', 'MID', 'SMALL')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS arena_universes_arena_idx ON arena_universes(arena_id);
CREATE INDEX IF NOT EXISTS arena_universes_symbol_idx ON arena_universes(symbol);
CREATE INDEX IF NOT EXISTS securities_symbol_idx ON securities(symbol);
CREATE INDEX IF NOT EXISTS securities_active_idx ON securities(is_active) WHERE is_active = true;

ALTER TABLE securities ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_universes ENABLE ROW LEVEL SECURITY;

-- Securities are public reference data — readable by all, not writable by clients
DROP POLICY IF EXISTS "anon_read_securities" ON securities;
CREATE POLICY "anon_read_securities" ON securities FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_read_arena_universes" ON arena_universes;
CREATE POLICY "anon_read_arena_universes" ON arena_universes FOR SELECT
  TO anon, authenticated USING (true);

-- Seed the COVID arena universe — stocks present at Jan 1, 2020
-- These 10 stocks are the COVID Black Swan starting portfolio
INSERT INTO securities (symbol, company_name, exchange, sector_code, industry_code) VALUES
  ('MSFT', 'Microsoft Corporation', 'NASDAQ', 'INFORMATION TECHNOLOGY', 'SOFTWARE'),
  ('AAPL', 'Apple Inc.', 'NASDAQ', 'INFORMATION TECHNOLOGY', 'TECHNOLOGY HARDWARE'),
  ('JPM',  'JPMorgan Chase & Co.', 'NYSE', 'FINANCIALS', 'DIVERSIFIED BANKS'),
  ('DAL',  'Delta Air Lines Inc.', 'NYSE', 'INDUSTRIALS', 'AIRLINES'),
  ('MAR',  'Marriott International Inc.', 'NASDAQ', 'CONSUMER DISCRETIONARY', 'HOTELS RESORTS AND CRUISE LINES'),
  ('XOM',  'Exxon Mobil Corporation', 'NYSE', 'ENERGY', 'INTEGRATED OIL AND GAS'),
  ('JNJ',  'Johnson & Johnson', 'NYSE', 'HEALTH CARE', 'PHARMACEUTICALS'),
  ('PG',   'Procter & Gamble Co.', 'NYSE', 'CONSUMER STAPLES', 'HOUSEHOLD PRODUCTS'),
  ('CAT',  'Caterpillar Inc.', 'NYSE', 'INDUSTRIALS', 'CONSTRUCTION MACHINERY'),
  ('HD',   'Home Depot Inc.', 'NYSE', 'CONSUMER DISCRETIONARY', 'HOME IMPROVEMENT RETAIL')
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO arena_universes (arena_id, symbol, eligible_from, liquidity_band, market_cap_band) VALUES
  ('covid_black_swan', 'MSFT', '2020-01-01', 'LARGE', 'MEGA'),
  ('covid_black_swan', 'AAPL', '2020-01-01', 'LARGE', 'MEGA'),
  ('covid_black_swan', 'JPM',  '2020-01-01', 'LARGE', 'MEGA'),
  ('covid_black_swan', 'DAL',  '2020-01-01', 'LARGE', 'LARGE'),
  ('covid_black_swan', 'MAR',  '2020-01-01', 'LARGE', 'LARGE'),
  ('covid_black_swan', 'XOM',  '2020-01-01', 'LARGE', 'MEGA'),
  ('covid_black_swan', 'JNJ',  '2020-01-01', 'LARGE', 'MEGA'),
  ('covid_black_swan', 'PG',   '2020-01-01', 'LARGE', 'MEGA'),
  ('covid_black_swan', 'CAT',  '2020-01-01', 'LARGE', 'LARGE'),
  ('covid_black_swan', 'HD',   '2020-01-01', 'LARGE', 'MEGA')
ON CONFLICT DO NOTHING;
