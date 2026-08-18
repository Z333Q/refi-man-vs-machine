import { test, expect } from '@playwright/test';
import {
  gotoScreen, resetProgress, seedFinishedRun, dismissOverlays, playCheckpoint, playToEnd,
  enterSelectedArena, skipFirstRunCoaching,
} from './helpers';

// A full arena is genuinely long: the resolution race alone is several seconds
// per checkpoint and these walk every one of them.
// A full COVID run is 22 checkpoints, each with a resolution animation, and
// both projects run it. 300s was enough on an idle machine and not enough on a
// busy one, which showed up as a different spec timing out on each run — the
// signature of a budget that is too tight, not of a race. Retries stay at 0 so
// a real race still surfaces.
test.describe.configure({ timeout: 600_000 });

test.beforeEach(async ({ page }) => {
  // These specs are about the loop, not about onboarding. The coaching
  // spotlight has its own spec.
  await skipFirstRunCoaching(page);
});

// Playing an arena to the end through the screens.
//
// The engine has had a playthrough test for a while; the screens never have.
// Everything between a committed decision and the autopsy was verified by hand,
// which is how a hardcoded -20% risk limit survived four arenas.

test('a run can be played from the first checkpoint to the results screen', async ({ page }) => {

  await resetProgress(page);
  // Recovery is six checkpoints: long enough to exercise the loop, short enough
  // to finish inside a sensible timeout.
  await seedFinishedRun(page, 'covid_black_swan');
  await page.reload();

  await gotoScreen(page, 'ARENA MAP');
  await enterSelectedArena(page);
  await dismissOverlays(page);

  // The header names the regime being played, not always COVID.
  await expect(page.locator('body')).toContainText('RECOVERY TRAP');

  const played = await playToEnd(page);

  // Every checkpoint committed, and the run offers its result.
  expect(played).toBeGreaterThanOrEqual(6);
  await expect(page.getByRole('button', { name: /VIEW RUN RESULTS/ })).toBeVisible();
});

test('a completed run produces an autopsy built from the decisions taken', async ({ page }) => {

  // Recovery rather than COVID: six checkpoints exercises the same path as
  // twenty-two and leaves the spec inside a sane wall-clock budget.
  await resetProgress(page);
  await seedFinishedRun(page, 'covid_black_swan');
  await page.reload();
  await gotoScreen(page, 'ARENA MAP');
  await enterSelectedArena(page);
  await dismissOverlays(page);

  const played = await playToEnd(page);
  await page.getByRole('button', { name: /VIEW RUN RESULTS/ }).click();

  const body = page.locator('body');
  await expect(body).toContainText('DECISION TIMELINE');
  // The count on the screen matches the run that was actually played.
  await expect(body).toContainText(`${played} COMMITTED`);
  // And it is not the old fixture.
  await expect(body).not.toContainText('SELL TECH');
  await expect(body).not.toContainText('REDUCE FIN.');
});

test('the run record survives a reload and can be resumed mid-arena', async ({ page }) => {

  await resetProgress(page);
  await gotoScreen(page, 'CORE LOOP');
  await dismissOverlays(page);

  await playCheckpoint(page);
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('refi_run_records') || '[]')[0]);
  expect(before?.decisions?.length).toBeGreaterThan(0);

  await page.reload();
  await gotoScreen(page, 'CORE LOOP');

  // The offer is a choice, never an automatic restore.
  const offer = page.getByText('RUN IN PROGRESS');
  await expect(offer).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /RESUME RUN/ }).click();

  // Resumed to the same place, with the same score.
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('refi_run_records') || '[]')[0]);
  expect(after.runId).toBe(before.runId);
  expect(after.playerScore).toBe(before.playerScore);
});

test('starting over opens a new run and keeps the one that was left', async ({ page }) => {

  await resetProgress(page);
  await gotoScreen(page, 'CORE LOOP');
  await dismissOverlays(page);
  await playCheckpoint(page);

  const firstId = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('refi_run_records') || '[]')[0].runId);

  await page.reload();
  await gotoScreen(page, 'CORE LOOP');
  await expect(page.getByText('RUN IN PROGRESS')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /START OVER/ }).click();
  await dismissOverlays(page);

  // A fresh run is not written until its first decision commits — an empty
  // run with no decisions is not a record worth keeping. So the meaningful
  // assertion is that starting over PRESERVES the abandoned run, and that
  // committing in the new one adds a second record rather than overwriting.
  let ids = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('refi_run_records') || '[]').map((r: { runId: string }) => r.runId));
  expect(ids).toContain(firstId);

  await playCheckpoint(page);

  ids = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('refi_run_records') || '[]').map((r: { runId: string }) => r.runId));
  expect(ids).toContain(firstId);
  expect(ids.length).toBeGreaterThan(1);
});
