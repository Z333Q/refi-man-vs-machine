import { test, expect, type Page } from '@playwright/test';
import {
  dismissOverlays, enterSelectedArena, gotoScreen, playToEnd,
  resetProgress, seedFinishedRun, skipFirstRunCoaching,
} from './helpers';

// The two arenas that matter most, played end to end through the real screens.
//
// Required by the 2026-09-12 engine reviews, which changed what a stance does
// to the book, what it costs, how the checkpoint is scored and what the market
// does to the weights afterwards. The existing playthrough spec proves the loop
// works on a six-checkpoint arena; these prove the longest arena and the final
// boss still finish, and that the book they finish with is not the book they
// started with.

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await skipFirstRunCoaching(page);
});

/** The live run record, read the way the product stores it. */
async function runState(page: Page, arenaId: string) {
  return page.evaluate((id) => {
    const runs = JSON.parse(localStorage.getItem('refi_run_records') ?? '[]');
    const r = runs.find((x: { arenaId: string }) => x.arenaId === id);
    return r ? {
      decisions: r.decisions.length,
      playerScore: r.playerScore,
      machineScore: r.machineScore,
      drawdown: r.drawdown,
      turnoverUsed: r.turnoverUsed,
      cashWeight: r.cashWeight,
    } : null;
  }, arenaId);
}

test('COVID plays all 22 checkpoints, and both sides are scored', async ({ page }) => {
  test.setTimeout(300_000);

  await resetProgress(page);
  await page.reload();
  await gotoScreen(page, 'ARENA MAP');
  await page.getByText('COVID BLACK SWAN', { exact: false }).first().click();
  await enterSelectedArena(page);
  await dismissOverlays(page);

  await expect(page.locator('body')).toContainText('COVID BLACK SWAN');

  const played = await playToEnd(page, 30);
  expect(played).toBeGreaterThanOrEqual(22);
  await expect(page.getByRole('button', { name: /VIEW RUN RESULTS/ })).toBeVisible();

  const s = await runState(page, 'covid_black_swan');
  expect(s).not.toBeNull();
  expect(s!.decisions).toBeGreaterThanOrEqual(22);

  // The authored machine plays its own book and is scored by the same model.
  // A run where it never scores would pass silently before this.
  expect(s!.machineScore).toBeGreaterThan(0);
  expect(s!.playerScore).toBeGreaterThan(0);

  // Twenty-two checkpoints of a crash leave a mark and cost turnover.
  expect(s!.drawdown).toBeLessThan(0);
  expect(s!.turnoverUsed).toBeGreaterThan(0);
});

test('TACO plays its five rounds', async ({ page }) => {
  test.setTimeout(300_000);

  await resetProgress(page);
  for (const id of ['covid_black_swan', 'recovery_trap', 'inflation_shift', 'banking_stress']) {
    await seedFinishedRun(page, id);
  }
  // The gate itself is endgame.spec's subject; this spec is about the rounds,
  // so it seeds the remaining evidence rather than re-earning it.
  await page.evaluate(() => {
    localStorage.setItem('refi_machine_versions', JSON.stringify([{
      recordVersion: 1, id: 'mv_e2e', machineName: 'Z333Q', version: 1,
      config: {
        universe: 'US_LIQUID', eligibility: 'FUNDAMENTAL_LIQUIDITY',
        signal: 'REGIME_CLASSIFIER', construction: 'CONSTRAINED_OPT',
        guardrails: { maxPositionPct: 0.10, maxSectorPct: 0.25, maxCorrelation: 0.85, drawdownGatePct: -0.15, cashFloorPct: 0.05 },
        execution: 'DAILY_CLOSE', monitoring: 'CORRELATION_ALERT',
      },
      buildHash: 'E2E0:0001:AAAA', lockedAt: '2026-01-02T00:00:00.000Z', createdAt: '2026-01-02T00:00:00.000Z',
    }]));
    localStorage.setItem('refi_gauntlet_records', JSON.stringify([{
      recordVersion: 1, id: 'g_e2e', createdAt: '2026-01-02T00:00:00.000Z', arenas: ['covid_black_swan'], score: 70,
    }]));
    localStorage.setItem('refi_baskets', JSON.stringify([{
      recordVersion: 1, id: 'b_e2e', lockedAt: '2026-01-02T00:00:00.000Z',
      constituents: [{ symbol: 'JNJ', weight: 0.5 }, { symbol: 'PG', weight: 0.5 }],
    }]));
  });
  await page.reload();

  await gotoScreen(page, 'ARENA MAP');
  await page.getByText('TACO PROTOCOL', { exact: false }).first().click();
  await page.getByRole('button', { name: /ENTER ARENA/ }).click();

  const boss = page.getByRole('button', { name: /ENTER FINAL BOSS/ });
  await boss.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(boss).toBeEnabled({ timeout: 20_000 });
  await boss.click();
  await dismissOverlays(page);

  const played = await playToEnd(page, 12);
  expect(played).toBeGreaterThanOrEqual(5);
  await expect(page.getByRole('button', { name: /VIEW RUN RESULTS/ })).toBeVisible();

  const s = await runState(page, 'taco_protocol');
  expect(s!.decisions).toBeGreaterThanOrEqual(5);
  expect(s!.machineScore).toBeGreaterThan(0);
});
