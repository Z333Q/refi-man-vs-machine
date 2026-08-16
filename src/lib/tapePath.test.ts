import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  synthesizeTapePath, bridge, mixShock, hashSeed, nextState, nextGaussian,
  DEFAULT_STEPS, type TapePathInput,
} from './tapePath';

function input(over: Partial<TapePathInput> = {}): TapePathInput {
  return {
    runSeed: 20200122,
    checkpointSequence: 1,
    playerReturn: -0.031,
    machineReturn: -0.018,
    volatilityDelta: 0.02,
    correlationLevel: 0.38,
    ...over,
  };
}

// ─── Endpoints are exact, not approximate ─────────────────────────────────────

test('both curves start at exactly zero and end at exactly the authored return', () => {
  // Exact equality, deliberately: a race that ends at -0.03099999999 while the
  // score says -0.031 is a race arguing with the verdict that follows it.
  for (const rho of [0, 0.25, 0.5, 0.75, 1]) {
    for (const [p, m] of [[-0.031, -0.018], [0.047, 0.012], [0, 0], [-0.2, 0.2]]) {
      const path = synthesizeTapePath(input({ correlationLevel: rho, playerReturn: p, machineReturn: m }));
      assert.equal(path.player[0], 0);
      assert.equal(path.machine[0], 0);
      assert.equal(path.player[path.player.length - 1], p, `player endpoint at rho ${rho}`);
      assert.equal(path.machine[path.machine.length - 1], m, `machine endpoint at rho ${rho}`);
    }
  }
});

test('the bridge pins its endpoint whatever the shocks did in between', () => {
  // Including a walk that wanders far past the target and one that is all zeros.
  const wild = bridge([5, -9, 12, -3, 7, -20], -0.031);
  assert.equal(wild[0], 0);
  assert.equal(wild[wild.length - 1], -0.031);

  const flat = bridge([0, 0, 0, 0], 0.05);
  assert.equal(flat[0], 0);
  assert.equal(flat[flat.length - 1], 0.05);
});

test('a path has one more sample than it has steps', () => {
  const path = synthesizeTapePath(input({ steps: 8 }));
  assert.equal(path.player.length, 9);
  assert.equal(path.machine.length, 9);
  assert.equal(synthesizeTapePath(input()).player.length, DEFAULT_STEPS + 1);
});

// ─── Determinism (§65) ────────────────────────────────────────────────────────

test('same seed and checkpoint reproduce a bit-identical race', () => {
  const a = synthesizeTapePath(input());
  const b = synthesizeTapePath(input());
  assert.deepEqual(a, b);
  // deepEqual on numbers is exact, but state it the way the replay promise is
  // actually consumed: serialized and compared.
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('determinism holds as a property across many seeds and checkpoints', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (let cp = 1; cp <= 14; cp++) {
      const one = synthesizeTapePath(input({ runSeed: seed, checkpointSequence: cp }));
      const two = synthesizeTapePath(input({ runSeed: seed, checkpointSequence: cp }));
      assert.equal(JSON.stringify(one), JSON.stringify(two), `seed ${seed} cp ${cp}`);
    }
  }
});

test('different seeds and different checkpoints produce different races', () => {
  const base = JSON.stringify(synthesizeTapePath(input()));
  assert.notEqual(base, JSON.stringify(synthesizeTapePath(input({ runSeed: 20200123 }))));
  assert.notEqual(base, JSON.stringify(synthesizeTapePath(input({ checkpointSequence: 2 }))));
});

test('the generator stays in uint32 space and never degenerates to zero', () => {
  // xorshift32 emits zeros forever from a zero state, so the hash must never
  // hand one over, and the stream must stay integral.
  assert.notEqual(hashSeed(0, 0), 0);
  let s = hashSeed(7, 3);
  for (let i = 0; i < 5000; i++) {
    const step = nextState(s);
    s = step.state;
    assert.equal(Number.isInteger(s), true);
    assert.ok(s >= 0 && s < 4294967296, `state out of uint32 range: ${s}`);
    assert.ok(step.uniform >= 0 && step.uniform < 1, `uniform out of range: ${step.uniform}`);
  }
});

test('the gaussian is bounded and centred, without a transcendental in sight', () => {
  let s = hashSeed(11, 5);
  let sum = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    const g = nextGaussian(s);
    s = g.state;
    // Irwin-Hall over twelve uniforms is bounded on [-6, 6] by construction.
    assert.ok(g.value >= -6 && g.value <= 6, `shock out of bounds: ${g.value}`);
    sum += g.value;
  }
  assert.ok(Math.abs(sum / n) < 0.1, `mean drifted: ${sum / n}`);
});

test('no transcendental math reaches the synthesizer', () => {
  // The §65 promise is bit-identical replay, and ECMAScript does not require
  // Math.log/exp/sin/cos/pow to be correctly rounded, so engines may disagree
  // in the last bits. Math.sqrt is required to be correctly rounded and is
  // allowed. This test fails the moment someone reaches for Box-Muller.
  const src = readFileSync(new URL('./tapePath.ts', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const banned of ['Math.log', 'Math.exp', 'Math.sin', 'Math.cos', 'Math.tan', 'Math.pow', 'Math.random', 'Date.now']) {
    assert.equal(code.includes(banned), false, `${banned} breaks bit-identical replay`);
  }
});

// ─── Correlation, including the edges ─────────────────────────────────────────

test('correlation 1 makes the machine shock identical to the player shock', () => {
  for (const v of [-3.2, -0.5, 0, 0.5, 4.1]) {
    assert.equal(mixShock(v, 999, 1), v);
  }
});

test('correlation 0 makes the machine shock purely independent', () => {
  for (const v of [-3.2, -0.5, 0, 0.5, 4.1]) {
    assert.equal(mixShock(999, v, 0), v);
  }
});

test('correlation is clamped, so out-of-range content cannot bend the mix', () => {
  assert.equal(mixShock(2, 5, -1), 5);
  assert.equal(mixShock(2, 5, 1.4), 2);
});

test('a mid correlation lands between the two edges', () => {
  const shared = 2, indep = -1;
  const mid = mixShock(shared, indep, 0.5);
  assert.notEqual(mid, shared);
  assert.notEqual(mid, indep);
  // 0.5 * 2 + sqrt(0.75) * -1
  assert.ok(Math.abs(mid - (1 - Math.sqrt(0.75))) < 1e-12);
});

test('high correlation tracks the two curves together, low correlation lets them diverge', () => {
  // The claim the race is built on, asserted rather than assumed: correlation
  // is what makes a checkpoint read as a shared fall or as a fork.
  const shape = (rho: number) => {
    const p = synthesizeTapePath(input({ correlationLevel: rho, playerReturn: 0, machineReturn: 0 }));
    let apart = 0;
    for (let i = 0; i < p.player.length; i++) apart += Math.abs(p.player[i] - p.machine[i]);
    return apart / p.player.length;
  };
  assert.ok(shape(0.95) < shape(0.1), 'correlated lines must travel closer than uncorrelated ones');
  assert.equal(shape(1), 0, 'at correlation 1 with equal endpoints the lines coincide exactly');
});

// ─── Volatility is texture, never outcome ─────────────────────────────────────

test('volatility changes the shape of the race and not where it finishes', () => {
  const calm = synthesizeTapePath(input({ volatilityDelta: 0 }));
  const wild = synthesizeTapePath(input({ volatilityDelta: 0.6 }));

  // Same destination, exactly.
  assert.equal(calm.player[calm.player.length - 1], wild.player[wild.player.length - 1]);
  assert.equal(calm.machine[calm.machine.length - 1], wild.machine[wild.machine.length - 1]);

  // Different journey.
  assert.notEqual(JSON.stringify(calm.player), JSON.stringify(wild.player));

  const swing = (xs: number[]) => xs.reduce((a, v, i) => i ? a + Math.abs(v - xs[i - 1]) : 0, 0);
  assert.ok(swing(wild.player) > swing(calm.player), 'a violent checkpoint must look violent');
});

test('a degenerate step count still produces a valid pinned path', () => {
  const one = synthesizeTapePath(input({ steps: 1 }));
  assert.equal(one.player.length, 2);
  assert.equal(one.player[0], 0);
  assert.equal(one.player[1], -0.031);

  const zeroed = synthesizeTapePath(input({ steps: 0 }));
  assert.equal(zeroed.player[0], 0);
  assert.equal(zeroed.player[zeroed.player.length - 1], -0.031);
});
