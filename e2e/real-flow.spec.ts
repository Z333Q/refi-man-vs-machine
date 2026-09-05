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

/** Mark the player as having decided before, so landing routes to the arena map. */
async function asReturningPlayer(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('refi_first_decision', '1');
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
  await expect(page.getByText('DAILY PRACTICE TAPE')).toBeVisible();
  // Its provenance is stated on the screen, not implied away (audit P0).
  await expect(page.getByText(/SIMULATED HISTORICAL SCENARIO/)).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Machine ladder' })
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Machine ladder' }).click();
  await expect(page.getByRole('button', { name: /CHALLENGE MACHINE/ })).toBeVisible();
});

test('the machine builder gate follows the progression law', async ({ page }) => {
  // Owner ruling 2026-08-25: the Builder is visible on the hub from the
  // start, locked until Bronze (a completed run without critical risk
  // failure). Completion alone opens the next arena but not the Builder.
  await asReturningPlayer(page);

  // A player whose only finished run blew the risk budget: no Builder.
  // Guarded, because init scripts re-run on reload and would otherwise
  // erase the Bronze run the test adds later.
  await page.addInitScript(() => {
    if (localStorage.getItem('refi_run_records') !== null) return;
    localStorage.setItem('refi_run_records', JSON.stringify([{
      recordVersion: 1, runId: 'seed_blown', seed: 1, arenaId: 'covid_black_swan',
      machineId: 'refi_rules', state: 'COMPLETE', result: 'FAILED',
      currentCheckpoint: 5, totalCheckpoints: 14, playerScore: 40, machineScore: 70,
      criticalFailure: true, criticalFailureCheckpoint: 5,
      portfolioValue: 78000, cashWeight: 0.1, drawdown: -0.3, volatility: 0.4,
      turnoverUsed: 0.8, decisions: [], startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z', completedAt: '2026-01-02T00:00:00.000Z',
    }]));
  });
  await bootToLanding(page);
  await gotoHub(page);

  await expect(page.getByText('MACHINE BUILDER', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('COMPLETE A REGIME WITHOUT A CRITICAL RISK FAILURE')).toBeVisible();
  await expect(page.getByRole('button', { name: /OPEN MACHINE BUILDER/ })).toHaveCount(0);

  // Earn Bronze and the same door opens.
  await page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem('refi_run_records') || '[]');
    records.push({
      recordVersion: 1, runId: 'seed_bronze', seed: 2, arenaId: 'covid_black_swan',
      machineId: 'refi_rules', state: 'COMPLETE', result: 'PASSED',
      currentCheckpoint: 14, totalCheckpoints: 14, playerScore: 70, machineScore: 68,
      criticalFailure: false, criticalFailureCheckpoint: null,
      portfolioValue: 101000, cashWeight: 0.2, drawdown: -0.05, volatility: 0.16,
      turnoverUsed: 0.3, decisions: [], startedAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-04T00:00:00.000Z', completedAt: '2026-01-04T00:00:00.000Z',
    });
    localStorage.setItem('refi_run_records', JSON.stringify(records));
  });
  await page.reload();
  await page.getByRole('button', { name: /ENTER THE MARKET/ })
    .waitFor({ state: 'visible', timeout: 30_000 });
  await gotoHub(page);

  const open = page.getByRole('button', { name: /OPEN MACHINE BUILDER/ });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByText('ARCHITECTURE')).toBeVisible({ timeout: 10_000 });
});

test('challenging a ladder opponent carries that opponent into the briefing', async ({ page }) => {
  // The 2026-08-25 audit P0, fixed: the chosen machine is part of run
  // identity. The rules machine is the one rung with a runtime today, so it
  // is the one that can be challenged, and the briefing names it.
  await asReturningPlayer(page);
  await bootToLanding(page);
  await gotoHub(page);

  await page.getByRole('button', { name: 'Machine ladder' }).click();
  // The rules machine is the default selection: the ladder prefers a rung
  // that can actually be challenged.
  await expect(page.getByText(/SELECTED: REFI RULES MACHINE/)).toBeVisible();
  await page.getByRole('button', { name: /CHALLENGE MACHINE/ }).click();

  const start = page.getByRole('button', { name: /START RUN/ });
  await start.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(page.getByText('REFI RULES MACHINE')).toBeVisible();
  await expect(page.getByText('RFA-MCH-RULES-002')).toBeVisible();
});

test('a defeated rules machine stays challengeable as a rematch', async ({ page }) => {
  // PR #60 review blocker: the first cut of the ladder fix made DEFEATED
  // unchallengeable, so beating the only playable opponent stranded the
  // ladder. DEFEATED is an achievement; the rematch stays open.
  await asReturningPlayer(page);
  await page.addInitScript(() => {
    // The profile is stored per session id, merged over defaults at the top
    // level, so the seed pins the session and carries the full ladder map.
    localStorage.setItem('refi_session_id', 'e2e_defeated_seed');
    localStorage.setItem('refi_profile:e2e_defeated_seed', JSON.stringify({
      sessionId: 'e2e_defeated_seed',
      machineLadder: {
        spy_passive: { wins: 0, losses: 0, status: 'ACTIVE' },
        refi_rules: { wins: 1, losses: 0, status: 'DEFEATED' },
        your_machine: { wins: 0, losses: 0, status: 'LOCKED' },
        refi_full_basket: { wins: 0, losses: 0, status: 'LOCKED' },
        refi_good_fit: { wins: 0, losses: 0, status: 'LOCKED' },
        refi_benchmark: { wins: 0, losses: 0, status: 'LOCKED' },
        taco_protocol: { wins: 0, losses: 0, status: 'LOCKED' },
      },
    }));
  });
  await bootToLanding(page);
  await gotoHub(page);

  // The hub still names a real opponent, not SPY by ACTIVE-status accident.
  // Scoped to the opponent panel: the ladder summary list legitimately shows
  // every rung, SPY included.
  const opponentPanel = page.locator('.terminal-panel-deep').filter({ hasText: 'CURRENT OPPONENT' });
  await expect(opponentPanel).toBeVisible();
  await expect(opponentPanel).toContainText('REFI RULES MACHINE');
  await expect(opponentPanel).not.toContainText('S&P 500 INDEX');

  await page.getByRole('button', { name: 'Machine ladder' }).click();
  await expect(page.getByText('✓ DEFEATED')).toBeVisible();
  // The defeated rung is the default selection and the challenge is open.
  await expect(page.getByText(/SELECTED: REFI RULES MACHINE/)).toBeVisible();
  const challenge = page.getByRole('button', { name: /CHALLENGE MACHINE/ });
  await expect(challenge).toBeEnabled();
  await challenge.click();

  const start = page.getByRole('button', { name: /START RUN/ });
  await start.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(page.getByText('RFA-MCH-RULES-002')).toBeVisible();
});

test('a rung without a runtime refuses the challenge and says why', async ({ page }) => {
  // The other half of the same P0: opponents that do not exist at runtime
  // used to funnel silently into the rules machine. Now they are explicit.
  await asReturningPlayer(page);
  await bootToLanding(page);
  await gotoHub(page);

  await page.getByRole('button', { name: 'Machine ladder' }).click();
  // The only other active rung is the S&P 500 index, so the one plain SELECT
  // button is its selector (the default rung shows SELECTED instead).
  await page.getByRole('button', { name: 'SELECT', exact: true }).click();
  await expect(page.getByText(/SELECTED: S&P 500 INDEX/)).toBeVisible();
  await expect(page.getByText('OPPONENT RUNTIME IN DEVELOPMENT', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /CHALLENGE MACHINE/ })).toBeDisabled();
});
