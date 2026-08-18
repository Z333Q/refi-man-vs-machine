import type { Page } from '@playwright/test';

/**
 * Shared drivers for the game's screens.
 *
 * Written as conditions rather than sleeps. The manual sessions that preceded
 * these tests failed mostly on timing guesses, and a helper that waits for the
 * thing it needs cannot make that mistake.
 */

/**
 * Land on a known screen via the demo nav.
 *
 * Deliberately does not reload when the app is already up. Reloading resets
 * App-level state, and the arena a player chose on the map lives there: a
 * helper that navigated by reloading silently sent every run back to the
 * default regime, which is how the first playthrough spec "failed" against
 * correct code.
 */
export async function gotoScreen(page: Page, label: string) {
  // Match the nav item by NAME only, never by its position in the strip.
  // These used to be addressed as '17 BUILDER'; removing one screen from the
  // demo flow renumbered everything after it and broke specs that had nothing
  // to do with the change.
  const nav = page.getByRole('button', { name: new RegExp(`\\d+\\s+${label}$`) });
  if (await nav.count() === 0) {
    await page.goto('/');
  }
  await nav.waitFor({ state: 'attached', timeout: 30_000 });
  // The nav is a horizontally scrolling strip. On a phone the later items sit
  // off-screen and are not "visible" until scrolled — which is correct
  // behaviour, not a defect, so the helper scrolls rather than the app
  // reflowing a 20-item strip onto a 393pt viewport.
  await nav.scrollIntoViewIfNeeded();
  await nav.click();
}

/** Enter the currently selected arena through the map and its briefing. */
export async function enterSelectedArena(page: Page) {
  await page.getByRole('button', { name: /ENTER ARENA/ }).click();
  const start = page.getByRole('button', { name: /START RUN/ });
  await start.waitFor({ state: 'visible', timeout: 20_000 });
  await start.click();
}

/**
 * Clear all game storage, so a spec never inherits another spec's progress.
 *
 * Preserves the onboarding flags a spec may have set through addInitScript:
 * clearing them here would reinstate the coaching spotlight that
 * skipFirstRunCoaching exists to suppress, and the spec would hang rather than
 * fail.
 */
export async function resetProgress(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    const keep = ['refi_cp1_coached', 'refi_tutorial_complete', 'refi_guidance_mode'];
    const saved = keep.map(k => [k, localStorage.getItem(k)] as const);
    localStorage.clear();
    for (const [k, v] of saved) if (v !== null) localStorage.setItem(k, v);
  });
}

/** Seed a finished run for an arena, which is how the map unlocks the next one. */
export async function seedFinishedRun(page: Page, arenaId: string) {
  await page.evaluate((id) => {
    const existing = JSON.parse(localStorage.getItem('refi_run_records') || '[]');
    existing.push({
      recordVersion: 1, runId: `seed_${id}`, seed: 1, arenaId: id, machineId: "refi_rules",
      state: 'COMPLETE', result: 'PASSED', currentCheckpoint: 1, totalCheckpoints: 1,
      playerScore: 70, machineScore: 68, criticalFailure: false, criticalFailureCheckpoint: null,
      portfolioValue: 101000, cashWeight: 0.2, drawdown: -0.05, volatility: 0.16, turnoverUsed: 0.3,
      decisions: [], startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
      completedAt: '2026-01-02T00:00:00.000Z',
    });
    localStorage.setItem('refi_run_records', JSON.stringify(existing));
  }, arenaId);
}

/**
 * Close whatever tip, coaching spotlight or visual event is covering the
 * screen.
 *
 * Tips are modal: the card sits at z-70 over a scrim and swallows clicks meant
 * for the loop underneath. They also fire mid-decision (selecting a stance
 * triggers the risk tip), so dismissing once at the start of a checkpoint is
 * not enough — the card appears between choosing and committing.
 *
 * ESC is used rather than hunting for each tip's action label, because §13
 * makes it the documented dismissal for every non-blocking tip and the labels
 * differ per tip. That also means these specs exercise the keyboard path §9
 * requires rather than a bespoke test-only route.
 */
export async function dismissOverlays(page: Page) {
  for (let pass = 0; pass < 6; pass++) {
    // One DOM read per pass rather than a locator scan per candidate label.
    // The scan version cost roughly seven round trips each time and this runs
    // four times per checkpoint, which turned a legitimate playthrough into a
    // timeout.
    const state = await page.evaluate(() => {
      const text = document.body.innerText;
      const tipOpen = text.includes('GUIDANCE: FULL');
      const escDismissible = text.includes('ESC TO DISMISS');
      const labels = [...document.querySelectorAll('button')]
        .filter(b => (b as HTMLElement).offsetParent !== null)
        .map(b => b.textContent?.trim() ?? '');
      return { tipOpen, escDismissible, labels };
    });

    if (state.tipOpen) {
      if (state.escDismissible) {
        await page.keyboard.press('Escape');
      } else {
        // A blocking tip has to be answered through one of its own actions.
        const card = page.locator('div').filter({ hasText: 'GUIDANCE: FULL' }).last();
        await card.getByRole('button').last().click({ timeout: 3_000 }).catch(() => {});
      }
      await page.waitForTimeout(150);
      continue;
    }

    // The coaching spotlight and blocking visual events carry real buttons.
    const blocking = ['SKIP TUTORIAL →', 'GOT IT — LET ME PLAY ▶', '[CONTINUE]', '[ACKNOWLEDGE]', 'ENTER COVID', 'UNDERSTOOD'];
    const hit = state.labels.find(l => blocking.some(b => l.startsWith(b)));
    if (!hit) break;
    await page.getByRole('button', { name: hit, exact: true }).first()
      .click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

/**
 * Mark the first-run coaching as seen.
 *
 * Specs that are not about onboarding should not have to walk through it, and
 * a spec that clicked past it would be asserting the coaching rather than the
 * thing under test. The dedicated onboarding spec clears this flag instead.
 */
export async function skipFirstRunCoaching(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('refi_cp1_coached', '1');
    localStorage.setItem('refi_tutorial_complete', '1');
    // Guidance OFF (§13 lists it as a real player mode).
    //
    // Tips are a queue: dismissing one lets the next open, and they fire
    // mid-decision, so a spec about the loop spends its time racing the tip
    // system instead of testing the loop. Turning guidance off is what a player
    // who wants that does, and the tip system keeps its own spec.
    localStorage.setItem('refi_guidance_mode', 'OFF');
  });
}

/** Read the checkpoint the run is on, for progress detection. */
async function currentCheckpoint(page: Page): Promise<number | null> {
  const t = await page.locator('body').innerText().catch(() => '');
  const m = t.match(/CP (\d+) \/ (\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Drive a run to its end, returning how many checkpoints were committed.
 *
 * Stops and throws the moment the checkpoint number stops advancing, rather
 * than looping until the test times out. A timeout says only that something is
 * wrong; this says which checkpoint stopped moving, which is the difference
 * between a diagnosis and a restart.
 */
export async function playToEnd(page: Page, maxCheckpoints = 30): Promise<number> {
  let committed = 0;
  let lastSeen = await currentCheckpoint(page);

  for (let i = 0; i < maxCheckpoints; i++) {
    const more = await playCheckpoint(page);
    committed += 1;
    if (!more) return committed;

    const now = await currentCheckpoint(page);
    if (now !== null && lastSeen !== null && now <= lastSeen) {
      throw new Error(
        `run stopped advancing at checkpoint ${now} after ${committed} commits`,
      );
    }
    lastSeen = now;
  }
  throw new Error(`run did not finish within ${maxCheckpoints} checkpoints`);
}

/**
 * Commit one checkpoint in the core loop.
 *
 * Returns false when the run has finished, so a caller can drive to the end
 * without knowing the arena's length.
 */
export async function playCheckpoint(page: Page): Promise<boolean> {
  await dismissOverlays(page);

  // Finished?
  if (await page.getByRole('button', { name: /VIEW RUN RESULTS/ }).count() > 0) return false;

  // Open the decide panel.
  const decide = page.getByRole('button', { name: /^DECIDE/ }).first();
  if (await decide.count() > 0) await decide.click().catch(() => {});

  // Pick a stance the run can still afford.
  //
  // The keyboard is the documented alternative to the pull gesture (§9 requires
  // parity, and every key has a visible equivalent). A real key press rather
  // than a synthesised KeyboardEvent: the synthetic one is untrusted and
  // reaches the window listener only by accident of bubbling, so it proves
  // nothing about what a player can do.
  //
  // Trying each slot in turn matters. The turnover budget is a hard constraint,
  // so by the last checkpoints of an arena the expensive stances are genuinely
  // priced out and their cards correctly refuse selection. A helper that always
  // pressed 1 would stall on a correctly-behaving screen and report it as a
  // hang, which is exactly what it did.
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});

  let selected = false;
  for (const key of ['1', '2', '3', '4']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
    if (await page.getByRole('button', { name: /REVIEW & COMMIT/ }).count() > 0) {
      selected = true;
      break;
    }
  }

  if (!selected) {
    // HOLD is always authored and always free, so it is the floor. If even it
    // cannot be selected, the screen is genuinely stuck and the wait below
    // will say so.
    const holdCard = page.locator('div[class*="select-none"]').filter({ hasText: 'HOLD' }).first();
    if (await holdCard.count() > 0) await holdCard.click({ timeout: 3_000 }).catch(() => {});
  }

  const review = page.getByRole('button', { name: /REVIEW & COMMIT/ });
  await review.waitFor({ state: 'visible', timeout: 10_000 });
  // Selecting a stance can raise the risk tip, which covers this button.
  await dismissOverlays(page);
  await review.click();

  await dismissOverlays(page);

  const commit = page.getByRole('button', { name: /^COMMIT/ });
  await commit.waitFor({ state: 'visible', timeout: 10_000 });
  await dismissOverlays(page);
  await commit.click();

  // The thesis prompt: answer it rather than let it time out, so the record
  // carries a stated thesis.
  const thesis = page.getByRole('button', { name: /^\[1\]/ });
  await thesis.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  if (await thesis.count() > 0) await thesis.first().click().catch(() => {});

  // Wait for the resolution to settle into either the next-signal control or
  // the end-of-run control.
  const next = page.getByRole('button', { name: /NEXT SIGNAL|VIEW RUN RESULTS/ });
  await next.waitFor({ state: 'visible', timeout: 30_000 });

  if (await page.getByRole('button', { name: /VIEW RUN RESULTS/ }).count() > 0) {
    return false;
  }
  await dismissOverlays(page);
  await page.getByRole('button', { name: /NEXT SIGNAL/ }).click();
  return true;
}
