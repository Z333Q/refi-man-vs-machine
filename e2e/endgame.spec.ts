import { test, expect, type Page } from '@playwright/test';
import { gotoScreen, resetProgress, seedFinishedRun, dismissOverlays, skipFirstRunCoaching } from './helpers';

// The endgame wiring (docs/PLAN-endgame.md). The builder is a desktop layout,
// so the flows that pass through it run at desktop width only, for the same
// reason builder-and-gauntlet.spec does.
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'the builder is a desktop layout');

async function compileAMachine(page: Page) {
  await gotoScreen(page, 'BUILDER');
  const install = page.getByRole('button', { name: /INSTALL MODULE/ });
  await install.scrollIntoViewIfNeeded();
  await install.click();
  const compile = page.getByRole('button', { name: /COMPILE/ });
  await compile.scrollIntoViewIfNeeded();
  await compile.click();
  await expect.poll(async () =>
    (await page.evaluate(() => JSON.parse(localStorage.getItem('refi_machine_versions') || '[]').length)),
    { timeout: 20_000 },
  ).toBeGreaterThan(0);
  // The compile animation hands off to the arena map when it finishes. Wait
  // for that, or the next navigation races it and loses.
  await expect(page.getByText('HISTORICAL REGIME NETWORK')).toBeVisible({ timeout: 30_000 });
}

async function runTheGauntlet(page: Page) {
  await gotoScreen(page, 'BUILDER');
  const tab = page.getByRole('button', { name: 'STRESS TEST', exact: true });
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  const gauntlet = page.getByRole('button', { name: 'BLIND GAUNTLET', exact: true });
  await gauntlet.scrollIntoViewIfNeeded();
  await gauntlet.click();
  await expect(page.locator('body')).toContainText('MACHINE LOCKED ACROSS 4 REGIMES');
  await expect.poll(async () =>
    (await page.evaluate(() => JSON.parse(localStorage.getItem('refi_gauntlet_records') || '[]').length)),
  ).toBeGreaterThan(0);
}

async function commitAndStopAtReveal(page: Page) {
  const decide = page.getByRole('button', { name: /^DECIDE/ }).first();
  if (await decide.count() > 0) await decide.click({ timeout: 5_000 }).catch(() => {});
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
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

async function lockABasket(page: Page) {
  await gotoScreen(page, 'BASKET');
  await page.getByRole('button', { name: /LOCK BASKET/ }).click();
  await expect.poll(async () =>
    (await page.evaluate(() => JSON.parse(localStorage.getItem('refi_baskets') || '[]').length)),
  ).toBeGreaterThan(0);
}

test('the final boss is gated on the real record, not a fixture', async ({ page }) => {
  test.setTimeout(180_000);
  await resetProgress(page);
  for (const id of ['covid_black_swan', 'recovery_trap', 'inflation_shift', 'banking_stress']) {
    await seedFinishedRun(page, id);
  }
  await page.reload();

  // Four regimes done, nothing else: TACO is still locked and says what is next.
  await gotoScreen(page, 'ARENA MAP');
  await page.getByText('TACO PROTOCOL', { exact: false }).first().click();
  await expect(page.getByRole('button', { name: /ENTER ARENA/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /LOCKED/ })).toBeDisabled();
  await expect(page.locator('body')).toContainText('NEXT: MACHINE COMPILED');

  // Earn the rest through the real surfaces.
  await compileAMachine(page);
  await runTheGauntlet(page);
  await lockABasket(page);

  // Locking a basket lands on the profile, never on the boss.
  await expect(page.locator('body')).toContainText('ALPHA PROFILE');
  await expect(page.locator('body')).toContainText('BASKET LOCKED');

  await gotoScreen(page, 'ARENA MAP');
  await page.getByText('TACO PROTOCOL', { exact: false }).first().click();
  await page.getByRole('button', { name: /ENTER ARENA/ }).click();

  // The unlock screen verifies, then opens.
  await expect(page.locator('body')).toContainText('PREREQUISITES VERIFIED');
  const prereqs = page.getByTestId('taco-prerequisites').locator('[data-met="0"]');
  await expect(prereqs).toHaveCount(0);
  await expect(page.getByRole('button', { name: /ENTER FINAL BOSS/ })).toBeEnabled({ timeout: 10_000 });
});

test('the unlock screen refuses a player who has not earned it, and offers the way back', async ({ page }) => {
  await resetProgress(page);
  await gotoScreen(page, 'TACO UNLOCK');
  await expect(page.getByTestId('taco-locked')).toBeVisible();
  await expect(page.getByRole('button', { name: /^LOCKED/ })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText('POLICY WRITER');
  await expect(page.locator('body')).not.toContainText('MACHINE SEASON');
  await page.getByRole('button', { name: 'Arena map', exact: true }).click();
  await expect(page.getByText('HISTORICAL REGIME NETWORK')).toBeVisible();
});

test('a locked basket is a record: equities only, reopened, shown on the profile', async ({ page }) => {
  await resetProgress(page);
  await gotoScreen(page, 'BASKET');
  const body = page.locator('body');
  // Checked as universe buttons, not body text: the demo nav's BRIEFING
  // contains the letters IEF.
  for (const banned of ['IEF', 'GLD', 'SPY', 'QQQ']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${banned}\\b`) })).toHaveCount(0);
  }
  await page.getByRole('button', { name: /LOCK BASKET/ }).click();
  await expect(page.getByTestId('profile-basket')).toContainText('BASKET LOCKED · 6 POSITIONS');

  await gotoScreen(page, 'BASKET');
  await expect(body).toContainText('LOCKED ·');
  await expect(page.getByRole('button', { name: /BASKET LOCKED/ })).toBeDisabled();
});

test('a compiled machine rides along in the next run and shows its call at the reveal', async ({ page }) => {
  test.setTimeout(180_000);
  await skipFirstRunCoaching(page);
  await resetProgress(page);
  await compileAMachine(page);

  await gotoScreen(page, 'HUB');
  await expect(page.getByTestId('hub-deployed')).toContainText('YOUR MACHINE v0.1 RIDES ALONG');

  await gotoScreen(page, 'CORE LOOP');
  await dismissOverlays(page);
  // Commit one decision and stop at the reveal. playCheckpoint would press
  // NEXT SIGNAL and take the reveal with it.
  await commitAndStopAtReveal(page);

  // The record carries it. Checked first: it says whether the machine was
  // attached at all, which is the more useful failure.
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('refi_run_records') || '[]')[0]);
  expect(rec.recordVersion).toBe(3);
  expect(rec.deployed?.version).toBe('v0.1');
  expect(rec.decisions[0].deployedActionCode).toBeTruthy();
  expect(rec.opponentPolicy).toEqual({ kind: 'AUTHORED' });

  // The reveal grid lands after the resolution race has played out.
  await expect(page.getByTestId('deployed-reveal')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('deployed-reveal')).toContainText('YOUR MACHINE v0.1');
});
