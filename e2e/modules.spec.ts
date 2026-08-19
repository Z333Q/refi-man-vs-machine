import { test, expect } from '@playwright/test';
import { gotoScreen, resetProgress, dismissOverlays, playCheckpoint, skipFirstRunCoaching } from './helpers';

/**
 * Modules used to unlock into nothing: `activeModules` was read by one dot rack
 * in a desktop-only rail and by nothing else, so earning a module announced it,
 * ticked a counter from 4/11 to 5/11, and gave the player nowhere to open it.
 * The unlock has to lead somewhere, and this is the test that says so.
 */
test.skip(
  ({ viewport }) => (viewport?.width ?? 0) < 1024,
  'state assertion, not a layout one — no need to replay six checkpoints twice',
);

test('an unlocked module becomes a panel the player can actually open', async ({ page }) => {
  test.setTimeout(240_000);

  // This spec is about modules, not about the tip queue; the tips have their
  // own spec.
  await skipFirstRunCoaching(page);
  await resetProgress(page);
  await gotoScreen(page, 'CORE LOOP');
  await dismissOverlays(page);

  // No module is earned yet, so no module tab may be present.
  await expect(page.getByRole('button', { name: /^CORRELATION/ })).toHaveCount(0);

  // DRAWDOWN MAP lands at 100 XP and CORRELATION MAP at checkpoint 6; playing
  // through the early checkpoints reaches both.
  for (let i = 0; i < 6; i++) {
    await playCheckpoint(page);
    await dismissOverlays(page);
  }

  const correlation = page.getByRole('button', { name: /^CORRELATION/ });
  await expect(correlation).toHaveCount(1);

  await correlation.scrollIntoViewIfNeeded();
  await correlation.click();

  // The panel has to render its own content, not just exist as a tab.
  await expect(page.getByText(/RISK CLUSTERS/)).toBeVisible();
  await expect(page.getByText(/EXPOSURE BY CLUSTER/)).toBeVisible();
});
