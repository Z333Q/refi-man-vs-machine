import { test, expect, type Page } from '@playwright/test';
import {
  gotoScreen, enterSelectedArena, resetProgress, skipFirstRunCoaching,
  dismissOverlays,
} from './helpers';

// ─── Block field placement and presentation laws ─────────────────────────────
//
// Placement (2026-08-25 #30 salvage ruling): two sanctioned homes and one
// absolute exclusion — the reveal side after resolution, the PORTFOLIO panel
// once the module is earned in COVID, and never the pre-commit DECIDE surface.
//
// Presentation (2026-08-31 mobile UX ruling): one model, two presentations.
// At phone width the treemap collapsed into ten outlined rectangles that read
// as disabled form fields on a real handset; below `sm` the field is an
// allocation ladder instead — every holding visible, stable order, current
// bar, before-marker — and the treemap does not render at all. At desktop
// width the treemap remains the view.
//
// These are behavioral assertions against the running app, not source-string
// checks: a refactor that moved the field into the decision surface, or
// re-shrank the treemap onto a phone, would fail here whatever the source
// happens to look like.

/** The COVID starting book: the canonical tickers a phone must keep legible. */
const COVID_TICKERS = ['MSFT', 'AAPL', 'JPM', 'DAL', 'MAR', 'XOM', 'JNJ', 'PG', 'CAT', 'HD'];

test.beforeEach(async ({ page }) => {
  await skipFirstRunCoaching(page);
  await resetProgress(page);
});

/** Seed the profile with BLOCK_FIELD already earned, as a returning player. */
async function withEarnedBlockField(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('refi_session_id', 'e2e_bf_seed');
    const key = 'refi_profile:e2e_bf_seed';
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify({
        sessionId: 'e2e_bf_seed',
        unlockedModules: ['BLOCK_FIELD'],
      }));
    }
  });
}

async function enterRun(page: Page) {
  await gotoScreen(page, 'ARENA MAP');
  await enterSelectedArena(page);
  await dismissOverlays(page);
}

/** Drive one commit without advancing past the reveal. */
async function driveOneCommit(page: Page) {
  const decide = page.getByRole('button', { name: /^DECIDE/ }).first();
  if (await decide.count() > 0) await decide.click().catch(() => {});
  for (const key of ['1', '2', '3', '4']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
    if (await page.getByRole('button', { name: /REVIEW & COMMIT/ }).count() > 0) break;
  }
  await page.getByRole('button', { name: /REVIEW & COMMIT/ }).click();
  await dismissOverlays(page);
  await page.getByRole('button', { name: /^COMMIT/ }).click();
  const thesis = page.getByRole('button', { name: /^\[1\]/ });
  await thesis.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  if (await thesis.count() > 0) await thesis.first().click().catch(() => {});
  await page.getByRole('button', { name: /NEXT SIGNAL|VIEW RUN RESULTS/ })
    .waitFor({ state: 'visible', timeout: 30_000 });
}

const decisionCount = (page: Page) => page.evaluate(() => {
  const runs = JSON.parse(localStorage.getItem('refi_run_records') ?? '[]');
  return runs.length ? runs[0].decisions.length : 0;
});

const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640;

const ladderTickers = (page: Page) =>
  page.getByTestId('ladder-row').locator('span.font-bold').allTextContents();

// ─── Placement laws, both widths ─────────────────────────────────────────────

test('the block field never renders on the pre-commit DECIDE surface', async ({ page }) => {
  await withEarnedBlockField(page);
  await enterRun(page);

  // Open the decision surface.
  const decide = page.getByRole('button', { name: /^DECIDE/ }).first();
  if (await decide.count() > 0) await decide.click();
  await page.keyboard.press('1');
  await page.waitForTimeout(200);

  await expect(page.getByTestId('block-field')).toHaveCount(0);
});

test('the earned block field lives in the PORTFOLIO panel, and preview does not decide', async ({ page }) => {
  await withEarnedBlockField(page);
  await enterRun(page);

  await page.getByRole('button', { name: 'PORTFOLIO[P]' }).click();
  const home = page.getByTestId('block-field-home');
  await expect(home).toBeVisible();
  await expect(home.getByTestId('block-field')).toBeVisible();

  // Previewing a stance shows the PREVIEW tag and must not select a stance:
  // the decision surface still reports none chosen.
  const previewButton = home.getByRole('button', { name: 'RAISE CASH' });
  if (await previewButton.count() > 0 && await previewButton.isEnabled()) {
    await previewButton.click();
    await expect(home.getByText(/PREVIEW · RAISE CASH/)).toBeVisible();
  }
  await page.keyboard.press('d');
  await expect(page.getByText(/NO STANCE SELECTED/)).toBeVisible();
});

test('an unearned block field is absent from the PORTFOLIO panel', async ({ page }) => {
  await enterRun(page);

  await page.getByRole('button', { name: 'PORTFOLIO[P]' }).click();
  await expect(page.getByText('YOUR POSITIONS · READ ONLY')).toBeVisible();
  await expect(page.getByTestId('block-field-home')).toHaveCount(0);
});

test('the reveal-side field appears only after resolution, with the before state', async ({ page }) => {
  await withEarnedBlockField(page);
  await enterRun(page);

  // During the decision there is no reveal field.
  await expect(page.getByTestId('block-field-reveal')).toHaveCount(0);

  await driveOneCommit(page);
  await expect(page.getByTestId('block-field-reveal')).toBeVisible();

  // The field leads with what it is, then keeps the channels separate:
  // allocation is the player's, the market result is the market's.
  await expect(page.getByText('YOUR PORTFOLIO AFTER THIS STANCE')).toBeVisible();
  await expect(page.getByTestId('block-field-market')).toBeVisible();
  await expect(page.getByTestId('block-field-changes')).toBeVisible();

  if (isNarrow(page)) {
    await expect(page.getByTestId('block-field-ladder')).toBeVisible();
    await expect(page.getByTestId('block-field-treemap')).toHaveCount(0);
    await expect(page.getByText('MARKER = BEFORE YOUR STANCE')).toBeVisible();
  } else {
    await expect(page.getByTestId('block-field-treemap')).toBeVisible();
    await expect(page.getByTestId('block-field-ladder')).toHaveCount(0);
    await expect(page.getByText('AREA = YOUR ALLOCATION NOW · OUTLINE = BEFORE YOUR STANCE')).toBeVisible();
  }

  // The summary lists only rows whose printed percent moved. Every row it
  // does print must state an actual change; the exact membership law is
  // pinned at unit level in blockField.test.ts.
  for (const text of await page.getByTestId('change-row').allTextContents()) {
    const m = text.match(/(\d+)% → (\d+)%/);
    expect(m, `change row must state before → after: "${text}"`).not.toBeNull();
    expect(m![1]).not.toBe(m![2]);
  }
});

// ─── Phone presentation laws ─────────────────────────────────────────────────

test('phone: the ladder replaces the treemap and every holding stays legible', async ({ page }) => {
  test.skip(!isNarrow(page), 'phone-width law');
  await withEarnedBlockField(page);
  await enterRun(page);

  await page.getByRole('button', { name: 'PORTFOLIO[P]' }).click();
  const home = page.getByTestId('block-field-home');
  await expect(home.getByTestId('block-field-ladder')).toBeVisible();
  await expect(home.getByTestId('block-field-treemap')).toHaveCount(0);

  // Every canonical holding, plus cash, in one stable ladder.
  const tickers = await ladderTickers(page);
  for (const symbol of COVID_TICKERS) {
    expect(tickers, `${symbol} must be on the ladder`).toContain(symbol);
  }
  expect(tickers).toContain('CASH');
  expect(tickers[tickers.length - 1]).toBe('CASH');

  // Each row prints its allocation and stays inside the viewport.
  const view = page.viewportSize()!;
  const rows = home.getByTestId('ladder-row');
  for (let i = 0; i < await rows.count(); i++) {
    const row = rows.nth(i);
    await expect(row.getByText(/^\d+%$/)).toBeVisible();
    const box = await row.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1);
    }
  }

  // The page itself never scrolls sideways.
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('phone: previewing a stance draws the before-markers', async ({ page }) => {
  test.skip(!isNarrow(page), 'phone-width law');
  await withEarnedBlockField(page);
  await enterRun(page);

  await page.getByRole('button', { name: 'PORTFOLIO[P]' }).click();
  const home = page.getByTestId('block-field-home');
  await expect(home.getByTestId('block-field-ladder')).toBeVisible();
  await expect(home.getByTestId('ladder-marker')).toHaveCount(0);

  const previewButton = home.getByRole('button', { name: 'RAISE CASH' });
  test.skip(await previewButton.count() === 0 || !await previewButton.isEnabled(), 'stance not previewable here');
  await previewButton.click();

  await expect(home.getByText('MARKER = BEFORE YOUR STANCE')).toBeVisible();
  expect(await home.getByTestId('ladder-marker').count()).toBeGreaterThan(0);
});

test('phone: rows keep their order, and detail disclosure reads without touching the record', async ({ page }) => {
  test.skip(!isNarrow(page), 'phone-width law');
  await withEarnedBlockField(page);
  await enterRun(page);

  // The ladder order the player learns in the PORTFOLIO panel...
  await page.getByRole('button', { name: 'PORTFOLIO[P]' }).click();
  await expect(page.getByTestId('block-field-ladder')).toBeVisible();
  const orderBefore = await ladderTickers(page);
  await page.keyboard.press('Escape');

  await driveOneCommit(page);
  await expect(page.getByTestId('block-field-reveal')).toBeVisible();

  // ...is the order the reveal keeps. Same names, same places.
  const orderAfter = await ladderTickers(page);
  expect(orderAfter).toEqual(orderBefore);

  // Tapping a row opens before/current/PnL, and only reads.
  const before = await decisionCount(page);
  const firstRow = page.getByTestId('block-field-reveal').getByTestId('ladder-row').first();
  await firstRow.click();
  const detail = page.getByTestId('ladder-detail');
  await expect(detail).toBeVisible();
  await expect(detail.getByText(/^BEFORE \d+%$/)).toBeVisible();
  await expect(detail.getByText(/^CURRENT \d+%$/)).toBeVisible();
  await expect(detail.getByText(/^PNL [+-]?\d+\.\d%$/)).toBeVisible();
  expect(await decisionCount(page)).toBe(before);

  // A second tap closes it again.
  await firstRow.click();
  await expect(page.getByTestId('ladder-detail')).toHaveCount(0);
});

// ─── Desktop presentation law ────────────────────────────────────────────────

test('desktop: the treemap remains the wide view', async ({ page }) => {
  test.skip(isNarrow(page), 'desktop-width law');
  await withEarnedBlockField(page);
  await enterRun(page);

  await page.getByRole('button', { name: 'PORTFOLIO[P]' }).click();
  const home = page.getByTestId('block-field-home');
  await expect(home.getByTestId('block-field-treemap')).toBeVisible();
  await expect(home.getByTestId('block-field-ladder')).toHaveCount(0);
});
