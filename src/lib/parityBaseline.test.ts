import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { generateParityBaseline, DISPOSITIONS } from './parityBaseline';

// The extraction gate for the Game Core Boundary track.
//
// The fixture was generated from main before the first module moved into
// packages/game-core, and it is not regenerated to make a test pass. If this
// fails during an extraction PR, the extraction changed behaviour: find the
// difference, do not refresh the bytes.
//
// It is deliberately one byte-for-byte assertion rather than a field-by-field
// comparison. Field assertions only cover the fields somebody thought of, and
// the whole point of a baseline is the fields nobody thought of.

// fileURLToPath, not URL.pathname: this checkout lives under a path with spaces.
const GOLDEN = fileURLToPath(new URL('./__fixtures__/engine-parity.golden.json', import.meta.url));

test('every arena, played four ways, produces exactly the recorded engine output', () => {
  const actual = generateParityBaseline();
  const expected = readFileSync(GOLDEN, 'utf8');

  if (actual !== expected) {
    // A 576KB diff in the failure message helps nobody. Find the first run and
    // checkpoint that moved and say so.
    const a = JSON.parse(actual), e = JSON.parse(expected);
    for (let i = 0; i < Math.max(a.runs.length, e.runs.length); i++) {
      const ar = a.runs[i], er = e.runs[i];
      if (JSON.stringify(ar) === JSON.stringify(er)) continue;
      const where = `${er?.arenaId ?? ar?.arenaId} / ${er?.disposition ?? ar?.disposition}`;
      const len = Math.max(ar?.checkpoints.length ?? 0, er?.checkpoints.length ?? 0);
      for (let c = 0; c < len; c++) {
        const ac = ar?.checkpoints[c], ec = er?.checkpoints[c];
        if (JSON.stringify(ac) === JSON.stringify(ec)) continue;
        assert.deepEqual(ac, ec, `engine output changed at ${where}, checkpoint index ${c}`);
      }
      assert.deepEqual(ar?.final, er?.final, `run result changed at ${where}`);
    }
    assert.equal(actual, expected, 'parity baseline changed');
  }
});

test('the baseline still covers every arena and disposition', () => {
  // Guards the guard: a baseline that silently stopped walking an arena would
  // keep passing while proving less.
  const { runs } = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  const arenas = [...new Set(runs.map((r: { arenaId: string }) => r.arenaId))];
  assert.equal(arenas.length, 5, 'an arena left the parity baseline');
  assert.equal(runs.length, arenas.length * DISPOSITIONS.length);

  const checkpoints = runs.reduce(
    (n: number, r: { checkpoints: unknown[] }) => n + r.checkpoints.length, 0);
  assert.ok(checkpoints >= 168, `parity baseline shrank to ${checkpoints} checkpoints`);
});
