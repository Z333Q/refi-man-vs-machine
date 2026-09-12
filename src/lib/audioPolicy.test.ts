import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BARRED_CUES,
  DEFAULT_SOUND_PREFS,
  TITLE_MUSIC,
  parseSoundPrefs,
  reachableCues,
  runIntensity,
  sceneFor,
  serializeSoundPrefs,
  sfxForEvent,
  sfxForTransition,
  type SceneInput,
} from './audioPolicy';

// The sound system's laws, pinned. §61A: sound never encodes outcome. Rule 6:
// nothing rewards trade frequency. Rule 16: no casino. And one engineering
// law: the policy only names cues that the build actually produced, so a
// missing asset is silence, never a 404 at the moment of a commit.

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(here, '../../public/audio/manifest.json');

function manifestIds(): Set<string> {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { cues: { id: string }[] };
  return new Set(m.cues.map(c => c.id));
}

test('music is opt-in; interface and ambient are on by default', () => {
  assert.deepEqual(DEFAULT_SOUND_PREFS, { fx: true, ambient: true, music: false });
});

test('preferences survive a round trip and reject garbage', () => {
  const p = { fx: false, ambient: true, music: true };
  assert.deepEqual(parseSoundPrefs(serializeSoundPrefs(p)), p);
  assert.deepEqual(parseSoundPrefs(null), DEFAULT_SOUND_PREFS);
  assert.deepEqual(parseSoundPrefs('{not json'), DEFAULT_SOUND_PREFS);
  assert.deepEqual(parseSoundPrefs('{"music":"yes"}'), DEFAULT_SOUND_PREFS);
});

test('every reachable cue exists in the built manifest', () => {
  const ids = manifestIds();
  for (const id of reachableCues()) {
    assert.ok(ids.has(id), `policy names ${id} but public/audio/manifest.json has no such cue`);
  }
});

test('no reachable cue is an outcome cue', () => {
  const reachable = new Set(reachableCues());
  for (const barred of BARRED_CUES) {
    assert.ok(!reachable.has(barred), `${barred} is reachable`);
  }
});

test('the machine reveal plays one cue regardless of intensity or prior state', () => {
  const priors: SceneInput[] = [
    { screen: 'core-loop', state: 'MARKET_ADVANCING', intensity: 'CALM' },
    { screen: 'core-loop', state: 'MARKET_ADVANCING', intensity: 'STRESS' },
    { screen: 'core-loop', state: 'DECISION_REQUIRED', intensity: 'CALM' },
  ];
  const cues = new Set<string>();
  for (const prev of priors) {
    for (const intensity of ['CALM', 'STRESS'] as const) {
      const out = sfxForTransition(prev, { screen: 'core-loop', state: 'MACHINE_REVEAL', intensity });
      assert.deepEqual(out, ['machine-reveal']);
      out.forEach(c => cues.add(c));
    }
  }
  assert.equal(cues.size, 1);
});

test('the closing bell is the same bell on every run', () => {
  for (const intensity of ['CALM', 'STRESS'] as const) {
    const out = sfxForTransition(
      { screen: 'core-loop', state: 'MACHINE_REVEAL', intensity },
      { screen: 'core-loop', state: 'COMPLETE', intensity },
    );
    assert.deepEqual(out, ['exchange-bell']);
  }
});

test('the commit stamp fires once per commit and not on a re-render', () => {
  const before: SceneInput = { screen: 'core-loop', state: 'COMMIT_CONFIRM', intensity: 'CALM' };
  const after: SceneInput = { screen: 'core-loop', state: 'MARKET_ADVANCING', intensity: 'CALM' };
  assert.deepEqual(sfxForTransition(before, after), ['order-submitted']);
  assert.deepEqual(sfxForTransition(after, after), []);
});

test('outcome visual events are silent', () => {
  assert.equal(sfxForEvent('MACHINE_ADVANTAGE'), null);
  assert.equal(sfxForEvent('HUMAN_ADVANTAGE'), null);
  assert.equal(sfxForEvent('MARKET_SHOCK'), 'market-shock');
});

test('returning to the map from the title is not a return', () => {
  const toMap: SceneInput = { screen: 'arena-map', state: 'IDLE', intensity: 'CALM' };
  assert.deepEqual(sfxForTransition({ screen: 'landing', state: 'IDLE', intensity: 'CALM' }, toMap), []);
  assert.deepEqual(sfxForTransition({ screen: 'autopsy', state: 'IDLE', intensity: 'CALM' }, toMap), ['return-to-map']);
  assert.deepEqual(sfxForTransition(toMap, toMap), []);
});

test('the title screen is the two-part theme and nothing else', () => {
  const s = sceneFor({ screen: 'landing', state: 'IDLE', intensity: 'CALM' });
  assert.equal(s.music, TITLE_MUSIC);
  assert.equal(s.ambient, null);
});

test('stress phases switch the decision music and bring in the floor', () => {
  assert.equal(runIntensity('PANIC'), 'STRESS');
  assert.equal(runIntensity('BACKGROUND_NOISE'), 'CALM');
  assert.equal(runIntensity(undefined), 'CALM');
  const calm = sceneFor({ screen: 'core-loop', state: 'DECISION_REQUIRED', intensity: 'CALM' });
  const stress = sceneFor({ screen: 'core-loop', state: 'DECISION_REQUIRED', intensity: 'STRESS' });
  assert.equal(calm.music, 'the-position');
  assert.equal(stress.music, 'margin');
  assert.equal(stress.ambient, 'trading-floor-panic');
});

test('the reveal ducks the music; the decision does not', () => {
  assert.equal(sceneFor({ screen: 'core-loop', state: 'MACHINE_REVEAL', intensity: 'CALM' }).duck, true);
  assert.equal(sceneFor({ screen: 'core-loop', state: 'DECISION_REQUIRED', intensity: 'CALM' }).duck, false);
});

test('screens without a generated cue are silent, not substituted', () => {
  for (const screen of ['arena-briefing', 'autopsy', 'machine-builder']) {
    const s = sceneFor({ screen, state: 'IDLE', intensity: 'CALM' });
    assert.equal(s.music, null, screen);
    assert.equal(s.ambient, null, screen);
  }
});
