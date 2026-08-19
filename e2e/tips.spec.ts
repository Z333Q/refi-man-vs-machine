import { test, expect } from '@playwright/test';
import { gotoScreen, resetProgress } from './helpers';

// The tip system, at guidance FULL, where the loop specs deliberately do not go.

test('a tip opens on the first checkpoint and can be dismissed with ESC', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('refi_cp1_coached', '1');
    localStorage.setItem('refi_tutorial_complete', '1');
    localStorage.setItem('refi_guidance_mode', 'FULL');
  });
  await resetProgress(page);
  await gotoScreen(page, 'CORE LOOP');

  const tip = page.getByText('GUIDANCE: FULL', { exact: false });
  await expect(tip.first()).toBeVisible({ timeout: 20_000 });

  await page.keyboard.press('Escape');
  await expect(tip.first()).toBeHidden({ timeout: 10_000 });
});

test('a tip states a dismissal that actually works', async ({ page }) => {
  // The footer used to advertise ESC on every tip, including blocking ones
  // where the handler ignores it. A modal that names a key that does nothing
  // teaches the player not to trust the interface.
  await page.addInitScript(() => {
    localStorage.setItem('refi_cp1_coached', '1');
    localStorage.setItem('refi_tutorial_complete', '1');
    localStorage.setItem('refi_guidance_mode', 'FULL');
  });
  await resetProgress(page);
  await gotoScreen(page, 'CORE LOOP');

  const footer = page.getByText('GUIDANCE: FULL', { exact: false }).first();
  await expect(footer).toBeVisible({ timeout: 20_000 });

  const text = (await footer.textContent()) ?? '';
  if (text.includes('ESC TO DISMISS')) {
    await page.keyboard.press('Escape');
    await expect(footer).toBeHidden({ timeout: 10_000 });
  } else {
    // A blocking tip must say so and offer an action instead.
    expect(text).toContain('CHOOSE AN OPTION');
    const card = page.locator('div').filter({ hasText: 'GUIDANCE: FULL' }).last();
    await expect(card.getByRole('button').last()).toBeVisible();
  }
});

test('guidance OFF suppresses tips entirely', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('refi_cp1_coached', '1');
    localStorage.setItem('refi_tutorial_complete', '1');
    localStorage.setItem('refi_guidance_mode', 'OFF');
  });
  await resetProgress(page);
  await gotoScreen(page, 'CORE LOOP');
  await page.waitForTimeout(2500);
  await expect(page.getByText('GUIDANCE: FULL', { exact: false })).toHaveCount(0);
});
