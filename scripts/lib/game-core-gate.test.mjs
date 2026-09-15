import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// The gate, exercised end to end against the real package.
//
// The unit tests beside this prove the scanner finds each import form. This
// proves the gate acts on what the scanner finds, which is the half that
// actually protects the boundary: a correct scanner wired into a rule that
// never consults it would pass every one of those tests and catch nothing.
//
// Each case writes one file into the package, runs the gate as CI runs it, and
// removes the file again in a finally block.

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const GATE = join(ROOT, 'scripts', 'game-core-gate.mjs');
const PROBE = join(ROOT, 'packages', 'game-core', 'src', '__gate_probe__.ts');
const PROBE_SIBLING = join(ROOT, 'packages', 'game-core', 'src', '__gate_probe_sibling__.ts');

function runGate() {
  const result = spawnSync(process.execPath, [GATE], { encoding: 'utf8' });
  return { code: result.status, out: result.stdout + result.stderr };
}

function withFiles(files, fn) {
  try {
    for (const [path, body] of Object.entries(files)) writeFileSync(path, body);
    return fn();
  } finally {
    for (const path of Object.keys(files)) rmSync(path, { force: true });
  }
}

test('the package passes the gate as it stands', () => {
  assert.equal(existsSync(PROBE), false, 'a probe file was left behind by an earlier run');
  const { code, out } = runGate();
  assert.equal(code, 0, out);
});

test('a side-effect import that leaves the package fails the gate', () => {
  // The escape hatch this test exists for: no `from`, no bindings, and the
  // same complete coupling as any other import.
  const { code, out } = withFiles(
    { [PROBE]: `import '../../../src/lib/persistence';\n` },
    runGate);
  assert.equal(code, 1, 'a side-effect import out of the package was waved through');
  assert.match(out, /imports outside the package/);
  assert.match(out, /__gate_probe__/);
});

test('a literal dynamic import that leaves the package fails the gate', () => {
  const { code, out } = withFiles(
    { [PROBE]: `export const late = () => import('../../../src/lib/identity');\n` },
    runGate);
  assert.equal(code, 1, 'a dynamic import out of the package was waved through');
  assert.match(out, /imports outside the package/);
});

test('a re-export that leaves the package fails the gate', () => {
  const { code } = withFiles(
    { [PROBE]: `export * from '../../../src/lib/arenas';\n` },
    runGate);
  assert.equal(code, 1);
});

test('a bare module specifier fails the gate', () => {
  const { code, out } = withFiles({ [PROBE]: `import './x';\nimport 'react';\n` }, runGate);
  assert.equal(code, 1);
  assert.match(out, /depends on a module outside the core: react/);
});

test('a side-effect import that stays inside the package passes', () => {
  // The same syntax, used the way the core legitimately could: arena
  // registration works exactly like this today, one module away. The rule is
  // about where the import points, not which keyword loaded it.
  const { code, out } = withFiles({
    [PROBE]: `import './__gate_probe_sibling__';\nexport const probe = 1;\n`,
    [PROBE_SIBLING]: `export const sibling = 1;\n`,
  }, runGate);
  assert.equal(code, 0, out);
});

test('a relative path that walks out and back in is judged by where it lands', () => {
  // './x/../types' resolves inside; a string search for '..' would have called
  // it an escape.
  const { code, out } = withFiles(
    { [PROBE]: `export type { RunState } from './sub/../types';\n` },
    runGate);
  assert.equal(code, 0, out);
});

// ─── Globals: the word versus the read ────────────────────────────────────────
//
// `window` is the DOM global and also the right word for the historical period
// an arena covers. The gate has to tell a data field from a browser
// dependency, and getting it wrong in either direction is expensive: a false
// positive pushes someone to rename good domain vocabulary to appease a lint
// bug, and a false negative lets the package break in Node.

test('a property named like a global is not a global read', () => {
  const { code, out } = withFiles({
    [PROBE]: 'export interface Probe {\n'
      + '  window: string;\n'
      + '  document?: string;\n'
      + '}\n'
      + 'export const read = (p: Probe) => p.window + p.document;\n',
  }, runGate);
  assert.equal(code, 0, out);
});

test('reaching for the global still fails, in every form that reaches', () => {
  for (const body of [
    'export const w = window;\n',
    'export const has = typeof window !== "undefined";\n',
    'export const href = window.location.href;\n',
  ]) {
    const { code, out } = withFiles({ [PROBE]: body }, runGate);
    assert.equal(code, 1, `waved through: ${body}`);
    assert.match(out, /uses window/);
  }
});

// ─── Shims and adapters ───────────────────────────────────────────────────────

test('an adapter that stops composing its content fails the gate', () => {
  // The failure this catches is silent at build time and total at runtime: the
  // core registry stays empty, and every run ends at its first checkpoint.
  const ADAPTER = join(ROOT, 'src', 'lib', 'runEngine.ts');
  const original = readFileSync(ADAPTER, 'utf8');
  try {
    writeFileSync(ADAPTER, `export * from '../../packages/game-core/src/runEngine';\n`);
    const { code, out } = runGate();
    assert.equal(code, 1, 'an adapter that composes nothing was waved through');
    assert.match(out, /does not compose \.\/arenaIndex/);
  } finally {
    writeFileSync(ADAPTER, original);
  }
});

test('an adapter may not grow logic beyond its one composing import', () => {
  const ADAPTER = join(ROOT, 'src', 'lib', 'runEngine.ts');
  const original = readFileSync(ADAPTER, 'utf8');
  try {
    writeFileSync(ADAPTER, original + 'export const extra = 1;\n');
    const { code, out } = runGate();
    assert.equal(code, 1, 'an adapter with logic in it was waved through');
    assert.match(out, /adapter contains logic/);
  } finally {
    writeFileSync(ADAPTER, original);
  }
});

test('an application file that reaches past the shims fails the gate', () => {
  // The regression this exists for is quiet: importing the engine directly
  // skips the file that registers the arenas, and the screen that did it gets
  // an engine with an empty registry.
  const APP_PROBE = join(ROOT, 'src', 'lib', '__gate_probe_app__.ts');
  const { code, out } = withFiles(
    { [APP_PROBE]: `export * from '../../packages/game-core/src/runEngine';\n` },
    runGate);
  assert.equal(code, 1, 'a direct import of the core from the app was waved through');
  assert.match(out, /imports the core directly/);
});
