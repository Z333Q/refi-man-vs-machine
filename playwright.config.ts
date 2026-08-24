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
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: 'real-flow.spec.ts' },
    // §62 and the viewport gate both claim the game is reachable on a phone.
    // That claim is checked here rather than asserted.
    //
    // Pixel 5 rather than an iPhone: it emulates a 393pt touch viewport on
    // Chromium, which is already installed, where the iPhone profiles require a
    // separate WebKit download. The claim under test is the layout at phone
    // width, not WebKit's rendering, so this buys the coverage without making
    // the suite depend on a browser the machine may not have.
    { name: 'mobile', use: { ...devices['Pixel 5'] }, testIgnore: 'real-flow.spec.ts' },
    // The production build, played the way a player would.
    //
    // Every other project runs against the dev server, where the DEMO jump
    // strip exists and the shared helpers use it. That verifies screens work
    // when opened directly — it cannot verify a player can reach them. This
    // project serves the real build (no dev strip) and its spec refuses
    // developer navigation, so reachability defects fail here instead of
    // hiding behind the shortcut.
    {
      name: 'real-flow',
      testMatch: 'real-flow.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: 'http://127.0.0.1:5200',
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5199 --host 127.0.0.1',
      url: 'http://127.0.0.1:5199',
      // Always reuse a server that is already up, including in CI.
      //
      // This was `!process.env.CI`, which is the documented default and which
      // leaks locally: a run killed part-way — by a command timeout, a Ctrl-C, a
      // crashed worker — never tears its dev server down, and the next run
      // starts another one. Six accumulated over two days here, each holding an
      // esbuild worker, and the machine's load average climbed until specs
      // started timing out and looking like flakes. Reusing means repeated runs
      // share one server instead of stacking new ones.
      //
      // CI starts clean every time, so there is never a server to reuse there and
      // the flag costs nothing.
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // The production build for the real-flow project. Freshly built on every
      // cold start; when reusing a warm server locally, re-run after source
      // changes with the port freed (or `npm run build` first) — CI always
      // starts cold, so CI always tests the current build.
      command: 'npm run build && npm run preview -- --port 5200 --host 127.0.0.1 --strictPort',
      url: 'http://127.0.0.1:5200',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
