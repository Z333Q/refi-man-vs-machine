import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findInCopy, classify, CODE, COMMENT, COPY } from './scan-code.mjs';

// Regression coverage for the em-dash gate's scanner.
//
// The scanner decides what counts as player-facing copy. Getting it wrong in
// either direction is expensive: a false negative ships an em dash, and a
// false positive pushes someone to edit a comment to satisfy a gate.

const EM = '—';
const flagged = src => findInCopy(src, EM).length;

// ─── The laws ─────────────────────────────────────────────────────────────────

test('a string literal is copy', () => {
  assert.equal(flagged(`const x = 'copy ${EM} here';`), 1);
  assert.equal(flagged(`const x = "copy ${EM} here";`), 1);
});

test('a template literal is copy, and may span lines', () => {
  assert.equal(flagged('const x = `copy ' + EM + ' here`;'), 1);
  assert.equal(flagged('const x = `line one\nline ' + EM + ' two`;'), 1);
});

test('JSX text is copy', () => {
  assert.equal(flagged(`<div>copy ${EM} here</div>`), 1);
});

test('a line comment is exempt', () => {
  assert.equal(flagged(`// comment ${EM} exempt`), 0);
});

test('a block comment is exempt', () => {
  assert.equal(flagged(`/* comment ${EM} exempt */`), 0);
});

test('a JSX comment expression is exempt', () => {
  assert.equal(flagged(`<div>\n  {/* comment ${EM} exempt */}\n</div>`), 0);
});

// ─── The defect this fix exists for ───────────────────────────────────────────

test('an apostrophe in JSX text is a character, never a quote opener', () => {
  // Must still see the dash, and must not desynchronize.
  assert.equal(flagged(`<div>TODAY'S SIGNAL ${EM} NOW</div>`), 1);
});

test('an apostrophe in JSX text does not leak into a following comment', () => {
  const src = [
    `<div>TODAY'S SIGNAL</div>`,
    `{/* comment ${EM} exempt */}`,
  ].join('\n');
  assert.equal(flagged(src), 0);
});

test('the scanner resumes correctly after an apostrophe in JSX text', () => {
  // Proves the fix does not simply suppress everything downstream: a real
  // string literal after the apostrophe must still be seen as copy.
  const src = [
    `<div>TODAY'S SIGNAL</div>`,
    `const later = 'real copy ${EM} here';`,
  ].join('\n');
  assert.equal(flagged(src), 1);

  // And with a comment in between, only the string is flagged.
  const withComment = [
    `<div>TODAY'S SIGNAL</div>`,
    `// comment ${EM} exempt`,
    `const later = 'real copy ${EM} here';`,
  ].join('\n');
  assert.equal(flagged(withComment), 1);
});

test('several apostrophes in JSX text do not pair with each other', () => {
  const src = `<div>TODAY'S AND TOMORROW'S SIGNAL ${EM} NOW</div>`;
  assert.equal(flagged(src), 1);
});

test('an escaped quote inside a string does not end it early', () => {
  assert.equal(flagged(`const x = 'it\\'s ${EM} fine';`), 1);
});

test('an apostrophe inside a JSX attribute string stays inside that string', () => {
  const src = `<div title="don't stop ${EM} now">text</div>`;
  assert.equal(flagged(src), 1);
});

// ─── Classification shape ─────────────────────────────────────────────────────

test('classification marks the expected regions', () => {
  const src = `<div>hi</div> // note\n'str';`;
  const kind = classify(src);
  assert.equal(kind[src.indexOf('hi')], COPY);
  assert.equal(kind[src.indexOf('note')], COMMENT);
  assert.equal(kind[src.indexOf('str')], COPY);
  assert.equal(kind[src.indexOf('<')], CODE);
});

test('an unpaired apostrophe is classified as code, not copy', () => {
  const src = `const label = TODAY'S;`;
  const kind = classify(src);
  assert.equal(kind[src.indexOf("'")], CODE);
});
