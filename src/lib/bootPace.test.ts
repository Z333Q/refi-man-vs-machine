import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BOOT_PACE, bootSchedule } from '../screens/BootScreen';

// The boot sequence is the game's first sentence: FUTURE DATA BLOCKED and
// PLAYER EGO UNVERIFIED are the thesis in miniature. At the authored pace it
// was gone before it could be read. These assert the slowdown is one factor
// applied evenly, rather than thirteen numbers edited by hand into a rhythm
// nobody chose.

/** The authored beats, before pacing. Duplicated here on purpose: a test that
 *  imported them could not catch the table being edited by accident. */
const AUTHORED_LINES = [0, 200, 400, 700, 1000, 1300, 1600, 1900, 2100, 2200];
const AUTHORED_TITLE = 2500;
const AUTHORED_CURSOR = 2600;
const AUTHORED_COMPLETE = 4200;

test('the sequence runs 25% slower than authored', () => {
  assert.equal(BOOT_PACE, 1.25);
});

test('every line beat is stretched by exactly the pace factor', () => {
  const { lines } = bootSchedule();
  assert.equal(lines.length, AUTHORED_LINES.length);
  AUTHORED_LINES.forEach((authored, i) => {
    assert.equal(lines[i], Math.round(authored * BOOT_PACE), `line ${i}`);
  });
});

test('the title, cursor and hand-off ride the same clock as the lines', () => {
  const s = bootSchedule();
  assert.equal(s.title, Math.round(AUTHORED_TITLE * BOOT_PACE));
  assert.equal(s.cursor, Math.round(AUTHORED_CURSOR * BOOT_PACE));
  assert.equal(s.complete, Math.round(AUTHORED_COMPLETE * BOOT_PACE));
});

test('the authored spacing survives the stretch: beats stay in order', () => {
  const { lines, title, cursor, complete } = bootSchedule();
  for (let i = 1; i < lines.length; i++) {
    assert.ok(lines[i] >= lines[i - 1], `beat ${i} must not overtake ${i - 1}`);
  }
  const last = lines[lines.length - 1];
  assert.ok(title > last, 'the title lands after the final line');
  assert.ok(cursor > title, 'the cursor follows the title');
  assert.ok(complete > cursor, 'the hand-off is last');
});

test('nothing is left on screen unread: every line precedes the hand-off', () => {
  const { lines, complete } = bootSchedule();
  for (const beat of lines) assert.ok(beat < complete);
});

test('the reader gets a quarter more time on the whole sequence', () => {
  const { complete } = bootSchedule();
  assert.equal(complete, 5250);
  assert.equal(complete - AUTHORED_COMPLETE, 1050, 'a full extra second and then some');
});
