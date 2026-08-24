import { test, expect, type Page } from '@playwright/test';

// ─── The production build, played the way a player would ─────────────────────
//
// Every other spec runs against the dev server and is allowed to jump to any
// screen through the DEMO strip. These specs run against the real build, where
// that strip does not exist, and they never use developer navigation: the only
// moves allowed are the ones a player can see. A screen that cannot be reached
// this way is not shipped, whatever the other suites say about it.
//
// Two tests below are marked test.fail(): they encode reachability defects
// found in the 2026-08-25 audit as executable expectations. When the defect is
// fixed the runner flags the passing test, and the mark comes off in the same
// change. They are the audit's P0s, not aspirations.

/** Mark the tutorial as complete, so landing routes to the arena map. */
async function asReturningPlayer(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('refi_tutorial_complete', '1');
    localStorage.setItem('refi_cp1_coached', '1');
    localStorage.setItem('refi_guidance_mode', 'OFF');
  });
}

/** Sit through the boot sequence and land on the title screen. */
async function bootToLanding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /ENTER THE MARKET/ })
    .waitFor({ state: 'visible', timeout: 30_000 });
}

/** Landing → arena map → back, which is the product's only route to the hub. */
async function gotoHub(page: Page) {
  await page.getByRole('button', { name: /ENTER THE MARKET/ }).click();
  await expect(page.getByText('HISTORICAL REGIME NETWORK')).toBeVisible();
  await page.getByRole('button', { name: /BACK/ }).click();
  await page.getByRole('button', { name: /START ARENA RUN/ })
    .waitFor({ state: 'visible', timeout: 15_000 });
}

test('the production build exposes no developer navigation', async ({ page }) => {
  await asReturningPlayer(page);
  await bootToLanding(page);

  // The chrome bar exists (it is the permanent home of HELP)…
  await expect(page.getByRole('button', { name: '? HELP' })).toBeVisible();

  // …but the DEMO strip and its numbered jump buttons do not.
  await expect(page.getByText('DEMO', { exact: true })).toHaveCount(0);
  for (const label of ['TUTORIAL', 'BUILDER', 'LADDER', 'DAILY TAPE']) {
    await expect(
      page.getByRole('button', { name: new RegExp(`\\d+\\s+${label}$`) }),
    ).toHaveCount(0);
  }
});

test('a returning player reaches a live arena run from the title screen', async ({ page }) => {
  await asReturningPlayer(page);
  await bootToLanding(page);

  await page.getByRole('button', { name: /ENTER THE MARKET/ }).click();
  await expect(page.getByText('HISTORICAL REGIME NETWORK')).toBeVisible();

  await page.getByRole('button', { name: /ENTER ARENA/ }).click();
  const start = page.getByRole('button', { name: /START RUN/ });
  await start.waitFor({ state: 'visible', timeout: 20_000 });
  await start.click();

  // The loop is live when it shows its checkpoint counter.
  await expect(page.getByText(/CP \d+ \/ \d+/)).toBeVisible({ timeout: 30_000 });
});

test('the hub, daily tape and machine ladder are reachable through the product', async ({ page }) => {
  await asReturningPlayer(page);
  await bootToLanding(page);
  await gotoHub(page);

  await page.getByRole('button', { name: 'Daily tape' }).click();
  await expect(page.getByText('DAILY MARKET TAPE')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Machine ladder' })
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Machine ladder' }).click();
  await expect(page.getByRole('button', { name: /CHALLENGE MACHINE/ })).toBeVisible();
});

test('the machine builder is reachable through the product', async ({ page }) => {
  // AUDIT P0 (2026-08-25): the Builder has a route in App.tsx but the hub
  // offers no way into it, so the only door is the dev-only DEMO strip. The
  // spec walks the hub and every surface it links and expects a Builder
  // affordance somewhere. Remove the fail() mark when the route ships.
  test.fail();

  await asReturningPlayer(page);
  await bootToLanding(page);
  await gotoHub(page);

  await expect(page.getByRole('button', { name: /BUILDER/ })).toBeVisible({ timeout: 5_000 });
});

test('challenging a ladder opponent carries that opponent into the run', async ({ page }) => {
  // AUDIT P0 (2026-08-25): MachineLadderScreen passes the chosen machineId up,
  // App.tsx discards it, and GameContext.startRun hardcodes refi_rules. So
  // challenging the S&P 500 opponent must surface that opponent in the
  // briefing it opens — today it cannot. Remove the fail() mark when the
  // opponent becomes part of run identity.
  test.fail();

  await asReturningPlayer(page);
  await bootToLanding(page);
  await gotoHub(page);

  await page.getByRole('button', { name: 'Machine ladder' }).click();
  await page.getByText('S&P 500 INDEX').first().click();
  await page.getByRole('button', { name: /CHALLENGE MACHINE/ }).click();

  // The briefing (or the machine card behind it) must name the opponent the
  // player picked, not the house default.
  const start = page.getByRole('button', { name: /START RUN/ });
  await start.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(page.getByText(/S&P 500/)).toBeVisible({ timeout: 5_000 });
});
