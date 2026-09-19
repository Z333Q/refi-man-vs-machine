import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canonicalHandle, isReserved, HandleError } from '../src/handlePolicy.js';

// The shape law is a database CHECK and is tested there. This is the part a
// constraint cannot express: that some well-formed names are not available to
// whoever asks first.

test('input is human, storage is canonical', () => {
  assert.equal(canonicalHandle('  Z333Q  '), 'z333q');
  assert.equal(canonicalHandle('Patient_Compounder'), 'patient_compounder');
});

test('the shape law is enforced before the database sees it', () => {
  for (const bad of ['ab', 'a'.repeat(21), '_lead', 'trail_', 'has space', 'has-dash', 'émigré', '']) {
    assert.throws(() => canonicalHandle(bad), HandleError, `${bad} was accepted`);
  }
  assert.throws(() => canonicalHandle(42), HandleError);
  assert.throws(() => canonicalHandle(null), HandleError);
});

test('operational and product names are withheld', () => {
  for (const name of [
    'refi', 'refitrading', 'refi_alpha', 'admin', 'administrator', 'support',
    'help', 'security', 'compliance', 'moderator', 'staff', 'official',
    'system', 'root', 'api', 'www', 'play', 'season', 'challenge',
    'leaderboard', 'machine', 'alpha', 'paper', 'managed', 'signal',
  ]) {
    assert.equal(isReserved(name), true, `${name} was available`);
  }
});

test('separators do not launder an impersonation', () => {
  // refi_support and refisupport are the same claim to a reader, and a set
  // membership test catches neither. The comparison is made on the letters.
  for (const name of [
    'refi_support', 'refisupport', 'r_e_f_i', 'refi_team', 'refi_help',
    'refi_admin', 'refi_security', 'refi_billing', 'refi_bot', 'refi_hq',
    'refi_trading', 'refi_official', 'support_refi',
  ]) {
    assert.equal(isReserved(name), true, `${name} was available`);
  }
});

test('capitals do not launder one either', () => {
  assert.throws(() => canonicalHandle('ReFi_Admin'), HandleError);
  assert.throws(() => canonicalHandle('ADMIN'), HandleError);
});

test('ordinary names that merely contain a reserved word stay available', () => {
  // The policy protects impersonation, not vocabulary. Over-reaching here
  // costs real players their names for no security benefit.
  for (const name of [
    'machinist', 'alphabet_soup', 'paperboy', 'seasoned', 'helper_bee',
    'z333q', 'patient_compounder', 'regime_hunter', 'apiary',
  ]) {
    assert.equal(isReserved(name), false, `${name} was withheld`);
  }
});

test('a rejection says which rule it broke', () => {
  try {
    canonicalHandle('refi_support');
    assert.fail('accepted');
  } catch (err) {
    assert.ok(err instanceof HandleError);
    assert.equal(err.reason, 'HANDLE_RESERVED');
    assert.equal(err.status, 422);
  }
  try {
    canonicalHandle('ab');
    assert.fail('accepted');
  } catch (err) {
    assert.ok(err instanceof HandleError);
    assert.equal(err.reason, 'HANDLE_MALFORMED');
  }
});
