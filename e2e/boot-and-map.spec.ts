import { test, expect } from '@playwright/test';
import { gotoScreen, resetProgress, seedFinishedRun } from './helpers';

// The screens I had only ever checked by hand.

test('the boot sequence completes and hands over to the landing screen', async ({ page }) => {
  await page.goto('/');
  // The sequence is paced at 5.25s (BOOT_PACE 1.25 over the authored beats).
  await expect(page.getByText('MAN VS MACHINE').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /01 LANDING/ })).toBeVisible({ timeout: 20_000 });
});

test('the boot sequence is readable rather than instant', async ({ page }) => {
  // The complaint that started this was that the opening text moved too fast.
  // The assertion is that the sequence is still on screen a second in, which
  // an instant render would fail.
  await page.goto('/');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  expect(body).toContain('REFI NETWORK BIOS');
});

test('the arena map lists every registered regime', async ({ page }) => {
  await resetProgress(page);
  await gotoScreen(page, 'ARENA MAP');
  for (const name of [
    'COVID BLACK SWAN', 'RECOVERY TRAP', 'INFLATION SHIFT', 'BANKING STRESS', 'TACO PROTOCOL',
  ]) {
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
  }
});

test('the map states the arena it will actually run', async ({ page }) => {
  // It used to advertise 22 decisions while the engine ran 14.
  await resetProgress(page);
  await gotoScreen(page, 'ARENA MAP');
  const panel = page.locator('body');
  await expect(panel).toContainText('COVID BLACK SWAN');
  await expect(panel).toContainText('NEXT');
  await expect(panel).toContainText('22');
  await expect(panel).toContainText('-20% DD');
});

test('a locked arena can be read but not entered', async ({ page }) => {
  // Selection and entry are different permissions. The guard used to be on
  // selection, so clicking a locked regime did nothing and the panel's own
  // LOCKED branch was unreachable.
  await resetProgress(page);
  await gotoScreen(page, 'ARENA MAP');
  await page.getByText('RECOVERY TRAP', { exact: false }).first().click();

  const body = page.locator('body');
  await expect(body).toContainText('RECOVERY TRAP');
  await expect(body).toContainText('FINISH THE PREVIOUS ARENA');
  await expect(page.getByRole('button', { name: /ENTER ARENA/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /LOCKED/ })).toBeDisabled();
});

test('finishing an arena unlocks the next one, and it survives a reload', async ({ page }) => {
  await resetProgress(page);
  await seedFinishedRun(page, 'covid_black_swan');
  await page.reload();
  await gotoScreen(page, 'ARENA MAP');

  const body = page.locator('body');
  await expect(body).toContainText('RECOVERY TRAP');
  await expect(body).toContainText('NEXT');
  // Recovery's own numbers, not COVID's.
  await expect(body).toContainText('-15% DD');
  await expect(page.getByRole('button', { name: /ENTER ARENA/ })).toBeVisible();
});

test('the briefing describes the arena being entered, not always COVID', async ({ page }) => {
  await resetProgress(page);
  await seedFinishedRun(page, 'covid_black_swan');
  await page.reload();
  await gotoScreen(page, 'ARENA MAP');
  await page.getByRole('button', { name: /ENTER ARENA/ }).click();

  const body = page.locator('body');
  await expect(body).toContainText('RECOVERY');
  await expect(body).toContainText('ARENA 02');
  // The defect this test exists for: a -20% limit printed over a -15% arena.
  await expect(body).toContainText('-15%');
  await expect(body).not.toContainText('-20%');
});
