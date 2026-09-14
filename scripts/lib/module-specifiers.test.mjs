import { test } from 'node:test';
import assert from 'node:assert/strict';

import { moduleSpecifiers } from './module-specifiers.mjs';

const specsOf = src => moduleSpecifiers(src).map(s => s.spec);

test('named, default, type and namespace imports are found', () => {
  assert.deepEqual(specsOf(`
import { a } from './a';
import b from './b';
import type { C } from './c';
import * as d from './d';
`), ['./a', './b', './c', './d']);
});

test('a side-effect import is found even though it has no bindings', () => {
  // The form that motivated this file: it loads the module completely, and a
  // gate blind to it would wave through the strongest coupling there is.
  assert.deepEqual(specsOf(`import './arenaIndex';`), ['./arenaIndex']);
  assert.deepEqual(specsOf(`import '../../../src/lib/persistence';`),
    ['../../../src/lib/persistence']);
});

test('re-exports are found', () => {
  assert.deepEqual(specsOf(`
export * from './types';
export { x } from './x';
export type { Y } from './y';
`), ['./types', './x', './y']);
});

test('a literal dynamic import is found, awaited or not', () => {
  assert.deepEqual(specsOf(`const m = await import('./late');`), ['./late']);
  assert.deepEqual(specsOf(`void import( "./spaced" );`), ['./spaced']);
});

test('require is found too, though this repository is ESM', () => {
  assert.deepEqual(specsOf(`const x = require('./legacy');`), ['./legacy']);
});

test('one import is reported once, not once per pattern', () => {
  assert.deepEqual(specsOf(`import x from './once';`), ['./once']);
});

test('line numbers point at the import', () => {
  const found = moduleSpecifiers(`const a = 1;\n\nimport './side';\n`);
  assert.equal(found[0].line, 3);
});

test('a multi-line import is found on the line carrying the specifier', () => {
  const found = moduleSpecifiers(`import {\n  a,\n  b,\n} from './wrapped';`);
  assert.deepEqual(found.map(f => f.spec), ['./wrapped']);
  assert.equal(found[0].line, 4);
});

test('a word ending in import is not an import', () => {
  assert.deepEqual(specsOf(`const reimport = 'x'; const y = "import";`), []);
});
