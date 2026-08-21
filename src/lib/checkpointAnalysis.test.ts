import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributeCheckpoint, convictionEffect, SCORE_COMPONENTS } from './checkpointAnalysis';
import { scoreCheckpoint, SCORE_WEIGHTS, convictionMultiplier } from './scoringEngine';
import { getCheckpoint } from './arenas';
// Arenas register themselves on import; without this the registry is empty.
import './covidArena';

// The screen explains the score by rebuilding it. If the rebuild ever stops
// matching the engine, the explanation is a lie told confidently, which is
// worse than no explanation at all. These tests are the thing that stops that.

function sampleScore(confidence: number) {
  const checkpoint = getCheckpoint('covid_black_swan', 1)!;
  return scoreCheckpoint({
    action: 'HOLD',
    checkpoint,
    flags: [],
    confidence,
    turnoverUsed: 0.05,
    portfolioDD: -0.03,
  });
}

test('the weights sum to one, so the process score is on the same 0 to 100 scale', () => {
  const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
});

test('every documented component maps to a real weight', () => {
  for (const doc of SCORE_COMPONENTS) {
    assert.ok(doc.key in SCORE_WEIGHTS, `${doc.key} has no weight`);
  }
  assert.equal(SCORE_COMPONENTS.length, Object.keys(SCORE_WEIGHTS).length);
});

test('the attribution reconstructs the engine total, including conviction', () => {
  for (const confidence of [0.5, 0.7, 0.95]) {
    const score = sampleScore(confidence);
    const a = attributeCheckpoint(score, confidence);

    // Rebuild the engine's arithmetic: par plus the conviction-scaled distance.
    const rebuilt = Math.round(
      a.machinePar + (a.processScore - a.machinePar) * convictionMultiplier(confidence),
    );
    assert.equal(rebuilt, score.totalScore, `confidence ${confidence}`);
  }
});

test('the weighted points sum to the process score', () => {
  const score = sampleScore(0.7);
  const a = attributeCheckpoint(score, 0.7);
  const summed = a.rows.reduce((s, r) => s + r.points, 0);
  assert.ok(Math.abs(summed - a.processScore) < 1e-9);
});

test('conviction above the default amplifies the distance from par', () => {
  const score = sampleScore(0.95);
  const effect = convictionEffect(attributeCheckpoint(score, 0.95));
  assert.equal(effect.amplified, true);
  assert.ok(Math.abs(effect.scaledDistance) >= Math.abs(effect.distanceFromPar));
});

test('the weakest driver is the component furthest below par by weighted points', () => {
  const score = sampleScore(0.7);
  const a = attributeCheckpoint(score, 0.7);
  for (const row of a.rows) {
    assert.ok(a.weakest.vsPar <= row.vsPar + 1e-9);
    assert.ok(a.strongest.vsPar >= row.vsPar - 1e-9);
  }
});
