import { defineConfig, devices } from '@playwright/test';

// End-to-end configuration.
//
// Everything the game claims about its screens was, until now, verified by
// driving a real Chrome by hand. That produced three false readings in one
// session: CDP calls timing out mid-assertion, a background tab throttling a
// setTimeout chain into what looked like a stalled animation, and a window
// resize that never reached the page viewport. None of those were bugs in the
// game and all of them cost time to disprove.
//
// A headless run under Playwright removes all three: the page is never
// backgrounded, waits are on conditions rather than on sleeps, and the viewport
// is set rather than requested.

export default defineConfig({
  testDir: './e2e',
  // The game has animation timings measured in seconds (the boot sequence alone
  // is 5.25s), so the default 30s is tight for a full arena playthrough.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Content and engine determinism is covered by the unit suite; a flaky e2e
  // retry would hide a real race in the screens rather than surface it.
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5199',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // §62 and the viewport gate both claim the game is reachable on a phone.
    // That claim is checked here rather than asserted.
    //
    // Pixel 5 rather than an iPhone: it emulates a 393pt touch viewport on
    // Chromium, which is already installed, where the iPhone profiles require a
    // separate WebKit download. The claim under test is the layout at phone
    // width, not WebKit's rendering, so this buys the coverage without making
    // the suite depend on a browser the machine may not have.
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5199 --host 127.0.0.1',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
