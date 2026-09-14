import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseAttribution, sanitizeReferrer, toTouch, isNewMeaningfulTouch, meaningfulKey,
} from './attribution';

const AT = '2026-09-14T12:00:00.000Z';

// The parser is pure on purpose, so these run with no browser, no storage and
// no clock: everything it decides, it decides from its arguments.

test('every ruled acquisition parameter is recognised', () => {
  const { facts, attributable } = parseAttribution({
    url: 'https://alpha.refi.trading/alpha?utm_source=x&utm_medium=social'
       + '&utm_campaign=launch&utm_content=hero&utm_term=machine'
       + '&ref=kiu&creator=z333q&challenge_id=chl_9&referral_code=RF7',
    referrer: 'https://news.example.com/story',
    occurredAt: AT,
  });

  assert.equal(facts.source, 'x');
  assert.equal(facts.medium, 'social');
  assert.equal(facts.campaign, 'launch');
  assert.equal(facts.content, 'hero');
  assert.equal(facts.term, 'machine');
  assert.equal(facts.ref, 'kiu');
  assert.equal(facts.creator, 'z333q');
  assert.equal(facts.challenge, 'chl_9');
  assert.equal(facts.referralCode, 'RF7');
  assert.equal(facts.landingPath, '/alpha');
  assert.equal(attributable, true);
});

test('aid is accepted as the campaign id alongside ref', () => {
  assert.equal(parseAttribution({ url: 'https://a.example/?aid=camp7', occurredAt: AT })
    .facts.ref, 'camp7');
});

test('a referrer keeps its origin and path and loses everything else', () => {
  // The query string of a referring URL is written by somebody else, and is
  // where session ids, search terms and email addresses live.
  assert.equal(
    sanitizeReferrer('https://mail.example.com/inbox?token=abc123&email=a@b.c#frag'),
    'https://mail.example.com/inbox');
  assert.equal(sanitizeReferrer('https://example.com/'), 'https://example.com');
  assert.equal(sanitizeReferrer('javascript:alert(1)'), undefined);
  assert.equal(sanitizeReferrer('not a url'), undefined);
  assert.equal(sanitizeReferrer(''), undefined);
});

test('an internal navigation is not an arrival from anywhere', () => {
  const { facts } = parseAttribution({
    url: 'https://alpha.refi.trading/alpha/arenas',
    referrer: 'https://alpha.refi.trading/alpha',
    occurredAt: AT,
  });
  assert.equal(facts.referrer, undefined, 'the game referred itself and was counted as a source');
});

test('a lookalike domain is external, however our origin starts the string', () => {
  // The prefix test this replaces called alpha.refi.trading.evil.example
  // internal, which would have deleted it from the acquisition record: the
  // one arrival most worth keeping.
  const evil = parseAttribution({
    url: 'https://alpha.refi.trading/alpha',
    referrer: 'https://alpha.refi.trading.evil.example/path?steal=1',
    occurredAt: AT,
  });
  assert.equal(evil.facts.referrer, 'https://alpha.refi.trading.evil.example/path',
    'a lookalike origin was treated as our own');

  const ours = parseAttribution({
    url: 'https://alpha.refi.trading/alpha',
    referrer: 'https://alpha.refi.trading/path',
    occurredAt: AT,
  });
  assert.equal(ours.facts.referrer, undefined, 'our own page counted as a referrer');

  // Same host, different scheme or port is a different origin, and is kept.
  const otherPort = parseAttribution({
    url: 'https://alpha.refi.trading/alpha',
    referrer: 'https://alpha.refi.trading:8443/path',
    occurredAt: AT,
  });
  assert.equal(otherPort.facts.referrer, 'https://alpha.refi.trading:8443/path');
});

test('an unlabelled arrival is recorded but is not attributable', () => {
  // "Direct" is an answer, and it belongs in the first touch. It is not a
  // campaign, so it can never open a meaningful touch.
  const parsed = parseAttribution({
    url: 'https://alpha.refi.trading/alpha',
    referrer: 'https://duckduckgo.com/?q=refi+alpha',
    occurredAt: AT,
  });
  assert.equal(parsed.attributable, false);
  assert.equal(parsed.facts.referrer, 'https://duckduckgo.com');
  assert.equal(isNewMeaningfulTouch(parsed, null), false,
    'an ordinary inbound link manufactured a campaign');
});

test('a newly attributed landing is a meaningful touch; reloading it is not', () => {
  const first = parseAttribution({
    url: 'https://alpha.refi.trading/alpha?utm_source=x&utm_campaign=launch',
    occurredAt: AT,
  });
  assert.equal(isNewMeaningfulTouch(first, null), true);

  const key = meaningfulKey(first);
  assert.equal(isNewMeaningfulTouch(first, key), false, 'a reload counted as a second arrival');

  const second = parseAttribution({
    url: 'https://alpha.refi.trading/alpha?utm_source=y&utm_campaign=creator',
    occurredAt: AT,
  });
  assert.equal(isNewMeaningfulTouch(second, key), true);
});

test('gameplay is never an acquisition touch', () => {
  // A player who starts an arena, commits a decision and comes back tomorrow
  // has produced no new arrival. The URL is the only thing that can.
  for (const url of [
    'https://alpha.refi.trading/alpha/run/run_1',
    'https://alpha.refi.trading/alpha/arenas',
    'https://alpha.refi.trading/alpha',
  ]) {
    const parsed = parseAttribution({ url, occurredAt: AT });
    assert.equal(isNewMeaningfulTouch(parsed, 'x||launch||||||'), false, url);
  }
});

test('a stored touch carries no user id and no field the schema cannot hold', () => {
  const parsed = parseAttribution({
    url: 'https://alpha.refi.trading/alpha?utm_source=x&creator=z333q&challenge_id=chl_9',
    referrer: 'https://news.example.com/story?utm_secret=1',
    occurredAt: AT,
  });
  const touch = toTouch('first', parsed, AT);

  assert.deepEqual(Object.keys(touch).sort(), [
    'campaign', 'content', 'kind', 'landingPath', 'medium', 'occurredAt',
    'referrer', 'source', 'term',
  ]);
  assert.equal('user_id' in touch, false, 'a touch grew an owner');
  // creator and challenge are recognised but not stored: challenge_id becomes
  // a real column in 0004 (PR F), and inventing one here would take ownership
  // of a migration this PR does not own.
  assert.equal('creator' in touch, false);
  assert.equal('challenge' in touch, false);
  assert.equal(touch.referrer, 'https://news.example.com/story');
});
