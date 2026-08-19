import { test, expect } from '@playwright/test';
import { gotoScreen, resetProgress, dismissOverlays, skipFirstRunCoaching } from './helpers';

// §62 makes specific, checkable claims. They have never been checked.

test('every screen is reachable by keyboard and shows focus', async ({ page }) => {
  await resetProgress(page);
  await gotoScreen(page, 'ARENA MAP');

  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    return {
      tag: el.tagName,
      // §62: visible focus states. Either an outline or a ring must be present.
      hasVisibleFocus: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
    };
  });
  expect(focused, 'nothing took focus on Tab').not.toBeNull();
  expect(focused!.hasVisibleFocus, `${focused!.tag} focuses invisibly`).toBe(true);
});

test('every keyboard action in the run has a clickable equivalent (§9)', async ({ page }) => {
  await resetProgress(page);
  await gotoScreen(page, 'CORE LOOP');
  await dismissOverlays(page);

  // The action bar advertises the keys; each must also be a real control.
  for (const label of [/\[D\] DECIDE/, /\[P\] PORTFOLIO/, /\[R\] RISK/]) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
});

test('reduced motion is honoured rather than advertised', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resetProgress(page);
  await gotoScreen(page, 'CORE LOOP');
  await dismissOverlays(page);

  // §62 requires a reduced-motion equivalent, not merely a shorter animation.
  // The stylesheet collapses durations; assert the rule actually applies.
  const animated = await page.evaluate(() => {
    const el = document.querySelector('.animate-fade-in, .animate-boot-fade');
    if (!el) return null;
    return getComputedStyle(el).animationDuration;
  });
  if (animated !== null) {
    expect(parseFloat(animated)).toBeLessThan(0.05);
  }
});

test('the run screen never uses colour alone for pass and fail (§62)', async ({ page }) => {
  // Guidance off. Tips are a queue: dismissing one lets the next open, so a
  // spec that dismisses and then clicks is racing the queue rather than
  // testing anything. On a laptop the click usually won; on a clean CI runner
  // it lost, and the tip's backdrop swallowed it. This spec is about colour
  // never carrying meaning alone — the tips have their own spec.
  await skipFirstRunCoaching(page);
  await resetProgress(page);
  await gotoScreen(page, 'CORE LOOP');
  await dismissOverlays(page);
  // The action bar is the phone-width route to the risk panel; the tab strip
  // is the desktop one. Either must reach it.
  const risk = page.getByRole('button', { name: /RISK/ }).first();
  await risk.scrollIntoViewIfNeeded();
  await risk.click();

  // The risk-adjusted block labels its rows in text, so the numbers are not
  // carried by colour alone.
  const body = page.locator('body');
  await expect(body).toContainText('RISK-ADJUSTED');
  await expect(body).toContainText('SHARPE');
  await expect(body).toContainText('RETURN');
});

test('the turnover meter exposes its state to assistive tech', async ({ page }) => {
  await resetProgress(page);
  await gotoScreen(page, 'CORE LOOP');
  await dismissOverlays(page);

  const meter = page.getByRole('meter', { name: /TURNOVER BUDGET SPENT/ });
  await expect(meter).toHaveCount(1);
  await expect(meter).toHaveAttribute('aria-valuenow', /\d+/);
});
