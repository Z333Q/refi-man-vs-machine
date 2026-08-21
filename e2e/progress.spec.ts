import { test, expect } from '@playwright/test';
import {
  gotoScreen, resetProgress, enterSelectedArena, dismissOverlays,
  playCheckpoint, skipFirstRunCoaching,
} from './helpers';

// Progress has to survive a reload.
//
// It did not. Profile state had exactly one home, a remote table whose
// row-level policies reject every write the game can make because no player
// ever authenticates, and the rejection was swallowed. Alpha XP, rank, the
// machine ladder and unlocked modules reset on every page load in production,
// and "SAVE YOUR RUN" saved nothing. Nothing in the suite noticed, because
// nothing asserted the second load.

test.describe.configure({ timeout: 300_000 });

test.beforeEach(async ({ page }) => {
  await skipFirstRunCoaching(page);
});

test('alpha xp earned in a run is still there after a reload', async ({ page }) => {
  await resetProgress(page);
  await gotoScreen(page, 'ARENA MAP');
  await enterSelectedArena(page);
  await dismissOverlays(page);

  await playCheckpoint(page);

  // What the game believes it stored.
  const stored = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('refi_profile:'));
    return key ? (JSON.parse(localStorage.getItem(key) as string).alphaXp as number) : null;
  });
  expect(stored, 'a committed checkpoint wrote no profile at all').not.toBeNull();
  expect(stored!, 'a committed checkpoint earned no XP').toBeGreaterThan(0);

  // The second load is the part that was broken.
  await page.reload();
  await gotoScreen(page, 'HUB');
  await dismissOverlays(page);

  const reloaded = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('refi_profile:'));
    return key ? (JSON.parse(localStorage.getItem(key) as string).alphaXp as number) : null;
  });
  expect(reloaded, 'the profile did not survive the reload').toBe(stored);

  // And the screen shows it, rather than a fresh zero.
  await expect(page.locator('body')).toContainText(String(stored));
});

test('a session that has never played has no stored profile to misread', async ({ page }) => {
  await resetProgress(page);
  await gotoScreen(page, 'HUB');

  const xp = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('refi_profile:'));
    return key ? (JSON.parse(localStorage.getItem(key) as string).alphaXp as number) : null;
  });
  // Either nothing is written yet, or what is written is an honest zero.
  expect(xp === null || xp === 0).toBe(true);
  await expect(page.locator('body')).toContainText('INITIATE');
});
