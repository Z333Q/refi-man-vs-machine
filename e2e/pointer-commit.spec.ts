import { test, expect, type Page } from '@playwright/test';

// ─── The pull, driven by real browser pointer input ──────────────────────────
//
// pointerReplay.test.ts proves the geometry and the state machine are
// deterministic given a sample stream. It cannot prove that a hand moving on a
// real page produces that stream: between the finger and the reducer sit hit
// testing, pointer capture, coalesced events, the filter, and the layout that
// decides where the control actually is. Those are exactly where a gesture
// breaks for a player while every unit test stays green.
//
// So nothing here reaches into the application. The only inputs are browser
// pointer events at real coordinates read from rendered geometry, and the only
// assertions are on what the page shows and what the Run Record stores.

const ARM = 28;        // STANDARD dead zone: at/above this a pull arms.
const DISARM = 24;     // Schmitt floor: only below this does an armed pull let go.
const ENGAGE_MS = 350; // MIN_ENGAGEMENT_MS: a faster release is a flick.

async function asReturningPlayer(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('refi_first_decision', '1');
    localStorage.setItem('refi_cp1_coached', '1');
    localStorage.setItem('refi_guidance_mode', 'OFF');
  });
}

/** Boot, enter the arena, and open the decide panel on a live checkpoint. */
async function reachDecision(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /ENTER THE MARKET/ }).waitFor({ timeout: 45_000 });
  await page.getByRole('button', { name: /ENTER THE MARKET/ }).click();
  await page.getByRole('button', { name: /ENTER ARENA/ }).click();
  const start = page.getByRole('button', { name: /START RUN/ });
  await start.waitFor({ timeout: 30_000 });
  await start.click();
  await expect(page.getByText(/CP \d+ \/ \d+/)).toBeVisible({ timeout: 45_000 });
  const decide = page.getByRole('button', { name: /^DECIDE/ }).first();
  if (await decide.count() > 0) await decide.click().catch(() => {});
}

/** The HOLD stance card: always authored, always affordable, so always pullable. */
function holdCard(page: Page) {
  return page.getByRole('button', { name: /^HOLD/ }).first();
}

/** Is the conviction meter showing? The meter renders only while armed. */
async function armedValue(page: Page): Promise<number | null> {
  const meter = page.locator('div.text-4xl.tabular-nums');
  if (await meter.count() === 0) return null;
  const text = (await meter.first().textContent())?.trim() ?? '';
  return /^\d+$/.test(text) ? Number(text) : null;
}

const decisionCount = (page: Page) => page.evaluate(() => {
  const runs = JSON.parse(localStorage.getItem('refi_run_records') ?? '[]');
  return runs.length ? runs[0].decisions.length : 0;
});
const runIdOf = (page: Page) => page.evaluate(() => {
  const runs = JSON.parse(localStorage.getItem('refi_run_records') ?? '[]');
  return runs.length ? runs[0].runId : null;
});

/**
 * A pointer that moves the way a hand does: many small steps with time
 * between them, so the filter sees a real stream rather than one jump.
 */
class Hand {
  constructor(private page: Page, private touch: boolean) {}
  private cdp: import('@playwright/test').CDPSession | null = null;
  private id = 1;

  async attach() {
    if (this.touch) this.cdp = await this.page.context().newCDPSession(this.page);
  }
  async down(x: number, y: number) {
    if (this.cdp) {
      await this.cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ x, y, id: this.id }],
      });
    } else {
      await this.page.mouse.move(x, y);
      await this.page.mouse.down();
    }
  }
  /**
   * Glide to a point over intermediate samples, then let it settle.
   *
   * Steps scale with the distance travelled: a hand crossing 140pt emits far
   * more samples than one crossing 15, and the jitter filter converges on the
   * stream it is given. Eight samples for any distance is not a hand, and the
   * filter correctly refuses to have arrived.
   */
  async glideTo(fromX: number, fromY: number, toX: number, toY: number, settleMs?: number) {
    const span = Math.hypot(toX - fromX, toY - fromY);
    const steps = Math.max(8, Math.ceil(span / 6));
    const settle = settleMs ?? Math.min(600, 200 + span);
    for (let i = 1; i <= steps; i++) {
      const x = fromX + ((toX - fromX) * i) / steps;
      const y = fromY + ((toY - fromY) * i) / steps;
      await this.sample(x, y);
      await this.page.waitForTimeout(16);
    }
    // Dwell. The jitter filter is driven by samples, not by the clock: when the
    // stream stops it holds its last output, so a gesture that simply waits
    // never finishes converging. A finger resting on real glass keeps emitting
    // moves with a little tremor, which is what lets the filter arrive — so the
    // hand does the same here. The tremor is well under the 0.5pt settle
    // epsilon, so it cannot manufacture a conviction change of its own.
    const dwell = Math.max(10, Math.ceil(span / 8));
    for (let i = 0; i < dwell; i++) {
      await this.sample(toX + (i % 2 ? 0.25 : -0.25), toY + (i % 2 ? -0.25 : 0.25));
      await this.page.waitForTimeout(16);
    }
    await this.page.waitForTimeout(settle);
  }

  private async sample(x: number, y: number) {
    if (this.cdp) {
      await this.cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x, y, id: this.id }],
      });
    } else {
      await this.page.mouse.move(x, y);
    }
  }
  async up(x: number, y: number) {
    if (this.cdp) {
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await this.page.mouse.move(x, y);
      await this.page.mouse.up();
    }
  }
  async cancel() {
    if (this.cdp) {
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    } else {
      // A mouse gesture is cancelled the way the browser cancels one: the
      // pointer is taken away by a competing gesture. Escape + up is the
      // closest honest equivalent available to browser input.
      await this.page.keyboard.press('Escape');
      await this.page.mouse.up();
    }
  }
}

/** Grip point and pull direction chosen from rendered geometry, never guessed. */
async function gripAndAxis(page: Page) {
  const card = holdCard(page);
  await card.waitFor({ state: 'visible', timeout: 15_000 });
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  const view = page.viewportSize()!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  // Pull along whichever axis has room to pass full draw inside the viewport,
  // because direction carries no meaning to the geometry but the window edge
  // very much does.
  const room = { down: view.height - y, left: x, right: view.width - x };
  const dir = room.down >= 260 ? 'down' : room.right >= 260 ? 'right' : 'left';
  const at = (d: number) => dir === 'down' ? { x, y: y + d }
    : dir === 'right' ? { x: x + d, y } : { x: x - d, y };
  return { x, y, at, dir };
}

test.describe('the pull commits only from a real, armed, deliberate drag', () => {
  test('hysteresis, conviction and a single commit, driven by pointer input', async ({ page }, info) => {
    test.setTimeout(180_000);
    const touch = info.project.name === 'pointer-phone';
    await asReturningPlayer(page);
    await reachDecision(page);

    const before = await decisionCount(page);
    const runId = await runIdOf(page);
    const { x, y, at } = await gripAndAxis(page);
    const hand = new Hand(page, touch);
    await hand.attach();

    // ── grip ────────────────────────────────────────────────────────────────
    await hand.down(x, y);
    expect(await armedValue(page)).toBeNull();

    // ── below the arm threshold: not armed ──────────────────────────────────
    const under = at(ARM - 10);
    await hand.glideTo(x, y, under.x, under.y);
    expect(await armedValue(page)).toBeNull();

    // ── across the arm threshold: armed ─────────────────────────────────────
    const over = at(ARM + 26);
    await hand.glideTo(under.x, under.y, over.x, over.y);
    const armed = await armedValue(page);
    expect(armed).not.toBeNull();
    expect(armed!).toBeGreaterThanOrEqual(50);
    expect(armed!).toBeLessThanOrEqual(95);

    // ── back inside the hysteresis band: still armed ────────────────────────
    const band = at((ARM + DISARM) / 2);
    await hand.glideTo(over.x, over.y, band.x, band.y);
    expect(await armedValue(page)).not.toBeNull();

    // ── below the disarm floor: released ────────────────────────────────────
    const below = at(DISARM - 12);
    await hand.glideTo(band.x, band.y, below.x, below.y);
    await expect.poll(() => armedValue(page), { timeout: 8_000 }).toBeNull();

    // ── re-arm and travel to a meaningful conviction ────────────────────────
    const deep = at(150);
    await hand.glideTo(below.x, below.y, deep.x, deep.y);
    const high = await armedValue(page);
    expect(high).not.toBeNull();
    expect(high!).toBeGreaterThan(armed!);
    expect(high!).toBeLessThanOrEqual(95);

    // ── release from an armed pull, after the engagement floor ──────────────
    await page.waitForTimeout(ENGAGE_MS);
    await hand.up(deep.x, deep.y);

    await expect.poll(() => decisionCount(page), { timeout: 20_000 }).toBe(before + 1);
    expect(await runIdOf(page)).toBe(runId ?? await runIdOf(page));

    // One physical drag commits at most once: a stray release cannot re-submit.
    await hand.up(deep.x, deep.y).catch(() => {});
    await page.waitForTimeout(1200);
    expect(await decisionCount(page)).toBe(before + 1);
  });

  test('a release that never armed commits nothing', async ({ page }, info) => {
    test.setTimeout(120_000);
    const touch = info.project.name === 'pointer-phone';
    await asReturningPlayer(page);
    await reachDecision(page);

    const before = await decisionCount(page);
    const { x, y, at } = await gripAndAxis(page);
    const hand = new Hand(page, touch);
    await hand.attach();

    await hand.down(x, y);
    const shallow = at(ARM - 12);
    await hand.glideTo(x, y, shallow.x, shallow.y);
    await page.waitForTimeout(ENGAGE_MS);
    await hand.up(shallow.x, shallow.y);

    await page.waitForTimeout(1500);
    expect(await decisionCount(page)).toBe(before);
  });

  test('a release below the disarm floor commits nothing', async ({ page }, info) => {
    test.setTimeout(120_000);
    const touch = info.project.name === 'pointer-phone';
    await asReturningPlayer(page);
    await reachDecision(page);

    const before = await decisionCount(page);
    const { x, y, at } = await gripAndAxis(page);
    const hand = new Hand(page, touch);
    await hand.attach();

    // Arm it for real, then let it go slack past the Schmitt floor. The pull
    // is no longer armed, so the release is not a decision however long the
    // finger was down.
    await hand.down(x, y);
    const deep = at(150);
    await hand.glideTo(x, y, deep.x, deep.y);
    expect(await armedValue(page)).not.toBeNull();

    const slack = at(DISARM - 12);
    await hand.glideTo(deep.x, deep.y, slack.x, slack.y);
    await expect.poll(() => armedValue(page), { timeout: 8_000 }).toBeNull();

    await page.waitForTimeout(ENGAGE_MS);
    await hand.up(slack.x, slack.y);

    await page.waitForTimeout(1500);
    expect(await decisionCount(page)).toBe(before);
  });

  test('a cancelled gesture commits nothing', async ({ page }, info) => {
    // pointercancel is a touch phenomenon: it is what the browser sends when it
    // takes the pointer away for a scroll. A mouse has no honest equivalent, so
    // this law is proven where it actually occurs.
    test.skip(info.project.name !== 'pointer-phone', 'pointercancel is touch-only');
    test.setTimeout(120_000);
    await asReturningPlayer(page);
    await reachDecision(page);

    const before = await decisionCount(page);
    const { x, y, at } = await gripAndAxis(page);
    const hand = new Hand(page, true);
    await hand.attach();

    await hand.down(x, y);
    const deep = at(150);
    await hand.glideTo(x, y, deep.x, deep.y);
    expect(await armedValue(page)).not.toBeNull();
    await page.waitForTimeout(ENGAGE_MS);
    await hand.cancel();

    await page.waitForTimeout(1500);
    expect(await decisionCount(page)).toBe(before);
  });
});

test('Pixel 5 portrait: no orientation gate, no overflow, and the pull is reachable', async ({ page }, info) => {
  test.skip(info.project.name !== 'pointer-phone', 'phone-only law');
  test.setTimeout(120_000);
  await asReturningPlayer(page);
  await reachDecision(page);

  // §62 and the audit: portrait is a supported orientation, never a gate.
  // Phrased narrowly on purpose: ROTATE alone is a legitimate stance name
  // (ROTATE DEFENSIVE / ROTATE RISK), so the gate is matched by what a gate
  // actually says, not by a word the game uses for something else.
  await expect(page.getByText(
    /ROTATE YOUR (PHONE|DEVICE|SCREEN)|LANDSCAPE (MODE )?REQUIRED|TURN YOUR (PHONE|DEVICE)|BEST (VIEWED|PLAYED) IN LANDSCAPE/i,
  )).toHaveCount(0);

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const card = holdCard(page);
  await expect(card).toBeVisible();
  const box = (await card.boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1);
});
