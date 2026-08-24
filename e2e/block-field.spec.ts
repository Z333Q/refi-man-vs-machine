import { test, expect } from '@playwright/test';
import {
  gotoScreen, enterSelectedArena, resetProgress, skipFirstRunCoaching,
  dismissOverlays,
} from './helpers';

// ─── Block field placement law ───────────────────────────────────────────────
//
// Two sanctioned homes and one absolute exclusion (2026-08-25 #30 salvage
// ruling): the reveal side after resolution, the PORTFOLIO panel once the
// module is earned in COVID, and never the pre-commit DECIDE surface. These
// are behavioral assertions against the running app, not source-string
// checks: a refactor that moved the field into the decision surface would
// fail here whatever the source happens to look like.

test.beforeEach(async ({ page }) => {
  await skipFirstRunCoaching(page);
  await resetProgress(page);
});

/** Seed the profile with BLOCK_FIELD already earned, as a returning player. */
async function withEarnedBlockField(page: import('@playwright/test').Page) {
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

test('the block field never renders on the pre-commit DECIDE surface', async ({ page }) => {
  await withEarnedBlockField(page);
  await gotoScreen(page, 'ARENA MAP');
  await enterSelectedArena(page);
  await dismissOverlays(page);

  // Open the decision surface.
  const decide = page.getByRole('button', { name: /^DECIDE/ }).first();
  if (await decide.count() > 0) await decide.click();
  await page.keyboard.press('1');
  await page.waitForTimeout(200);

  await expect(page.getByTestId('block-field')).toHaveCount(0);
});

test('the earned block field lives in the PORTFOLIO panel, and preview does not decide', async ({ page }) => {
  await withEarnedBlockField(page);
  await gotoScreen(page, 'ARENA MAP');
  await enterSelectedArena(page);
  await dismissOverlays(page);

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
  await gotoScreen(page, 'ARENA MAP');
  await enterSelectedArena(page);
  await dismissOverlays(page);

  await page.getByRole('button', { name: 'PORTFOLIO[P]' }).click();
  await expect(page.getByText('YOUR POSITIONS · READ ONLY')).toBeVisible();
  await expect(page.getByTestId('block-field-home')).toHaveCount(0);
});

test('the reveal-side field appears only after resolution, with the before-ghost', async ({ page }) => {
  await withEarnedBlockField(page);
  await gotoScreen(page, 'ARENA MAP');
  await enterSelectedArena(page);
  await dismissOverlays(page);

  // During the decision there is no reveal field.
  await expect(page.getByTestId('block-field-reveal')).toHaveCount(0);

  // Drive one commit without advancing (playCheckpoint would click NEXT
  // SIGNAL and leave the reveal before it could be observed).
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

  // When the race settles, the reveal field is on screen with its ghost.
  await page.getByRole('button', { name: /NEXT SIGNAL|VIEW RUN RESULTS/ })
    .waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.getByTestId('block-field-reveal')).toBeVisible();
  // The channel legend is the player-facing law: allocation is the player's,
  // PnL is the market's.
  await expect(page.getByText('AREA IS YOUR ALLOCATION. OUTLINE IS BEFORE YOUR STANCE. PNL IS WHAT THE MARKET DID.')).toBeVisible();
});
