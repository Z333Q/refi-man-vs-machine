import { test } from 'node:test';
import assert from 'node:assert/strict';

import './arenaIndex';
import { allArenas, getArena, buildPortfolio } from './arenas';
import { DEFAULT_MACHINE_CONFIG, DEFAULT_GUARDRAILS } from './gameTypes';
import type { MachineConfig } from './gameTypes';
import { createInitialRun, commitDecisionCommand, turnoverBudgetFor } from './runEngine';
import { runStressTest } from './stressTest';
import { runGauntlet, gauntletVerdict, GAUNTLET_ARENAS } from './gauntlet';

// Content is the part of this game most likely to be wrong and least likely to
// be caught by a type. These hold every arena to the same contract, so a new
// regime cannot ship half-authored: the failure mode is not a crash, it is a
// checkpoint that quietly offers no way to act, or a book whose sector weights
// disagree with its own positions.

const cfg = (o: Partial<MachineConfig> = {}): MachineConfig =>
  ({ ...DEFAULT_MACHINE_CONFIG, guardrails: { ...DEFAULT_GUARDRAILS }, ...o });

test('every §20 arena in the progression is registered', () => {
  const ids = allArenas().map(a => a.id);
  for (const expected of [
    'covid_black_swan', 'recovery_trap', 'inflation_shift', 'banking_stress', 'taco_protocol',
  ]) {
    assert.ok(ids.includes(expected as never), `${expected} is not registered`);
  }
});

test('arenas order without collisions', () => {
  const orders = allArenas().map(a => a.order);
  assert.equal(new Set(orders).size, orders.length, 'two arenas claim the same position');
  assert.deepEqual([...orders].sort((a, b) => a - b), orders, 'allArenas must return progression order');
});

test('every arena carries the metadata the briefing screens read', () => {
  for (const a of allArenas()) {
    assert.ok(a.name.length > 0, `${a.id} has no name`);
    assert.ok(a.lesson.length > 20, `${a.id} lesson is too thin to teach anything`);
    assert.ok(a.window.length > 0, `${a.id} has no window`);
    assert.ok(a.difficulty >= 1 && a.difficulty <= 5, `${a.id} difficulty out of range`);
    assert.ok(a.criticalDrawdown < 0, `${a.id} risk budget must be a loss`);
    assert.ok(a.checkpoints.length > 0, `${a.id} has no checkpoints`);
  }
});

test('checkpoints are sequential from 1, with no gaps or repeats', () => {
  for (const a of allArenas()) {
    const seqs = a.checkpoints.map(c => c.sequence);
    assert.deepEqual(
      seqs,
      seqs.map((_, i) => i + 1),
      `${a.id} checkpoint sequences are not 1..n`,
    );
  }
});

test('every checkpoint offers a real decision', () => {
  for (const a of allArenas()) {
    for (const cp of a.checkpoints) {
      assert.ok(
        cp.availableActions.length >= 2,
        `${a.id} CP${cp.sequence} offers fewer than two stances`,
      );
      const codes = cp.availableActions.map(b => b.actionCode);
      assert.equal(new Set(codes).size, codes.length, `${a.id} CP${cp.sequence} repeats a stance`);
      assert.ok(
        codes.includes('HOLD'),
        `${a.id} CP${cp.sequence} has no HOLD: it is always a valid decision (§8)`,
      );
    }
  }
});

test('HOLD is free everywhere and every other stance is priced', () => {
  for (const a of allArenas()) {
    for (const cp of a.checkpoints) {
      for (const b of cp.availableActions) {
        if (b.actionCode === 'HOLD') {
          assert.equal(b.turnoverCost, 0, `${a.id} CP${cp.sequence} charges for HOLD`);
        } else {
          assert.ok(b.turnoverCost > 0, `${a.id} CP${cp.sequence} ${b.actionCode} is free`);
        }
      }
    }
  }
});

test('every branch label uses the colon separator the cards derive from', () => {
  for (const a of allArenas()) {
    for (const cp of a.checkpoints) {
      for (const b of cp.availableActions) {
        assert.ok(
          b.label.includes(': '),
          `${a.id} CP${cp.sequence} ${b.actionCode}: ${b.label}`,
        );
      }
    }
  }
});

test('every checkpoint teaches something and every branch says why', () => {
  for (const a of allArenas()) {
    for (const cp of a.checkpoints) {
      assert.ok(cp.teachingPoint.length > 30, `${a.id} CP${cp.sequence} teaching point is too thin`);
      assert.ok(cp.signalBody.length > 60, `${a.id} CP${cp.sequence} signal body is too thin`);
      assert.ok(cp.machineDecision.reasoning.length >= 2, `${a.id} CP${cp.sequence} machine gives one reason or none`);
      for (const b of cp.availableActions) {
        assert.ok(
          (b.branchEffect.teachingMessage ?? '').length > 30,
          `${a.id} CP${cp.sequence} ${b.actionCode} teaches nothing`,
        );
      }
    }
  }
});

test('the machine always picks a stance the checkpoint authors', () => {
  for (const a of allArenas()) {
    for (const cp of a.checkpoints) {
      const codes = cp.availableActions.map(b => b.actionCode);
      assert.ok(
        codes.includes(cp.machineDecision.actionCode),
        `${a.id} CP${cp.sequence} machine takes ${cp.machineDecision.actionCode}, which is not on offer`,
      );
    }
  }
});

test('par is authored per checkpoint and inside the score range', () => {
  for (const a of allArenas()) {
    for (const cp of a.checkpoints) {
      assert.equal(typeof cp.machinePar, 'number', `${a.id} CP${cp.sequence}`);
      assert.ok(cp.machinePar > 0 && cp.machinePar <= 100, `${a.id} CP${cp.sequence} par out of range`);
    }
  }
});

test('a valid HOLD is never contradicted by its own teaching', () => {
  // isHoldValid drives the reward for patience. A checkpoint that marks HOLD
  // valid and then explains why holding is wrong would score one way and read
  // the other.
  for (const a of allArenas()) {
    for (const cp of a.checkpoints) {
      if (!cp.isHoldValid) continue;
      const hold = cp.availableActions.find(b => b.actionCode === 'HOLD');
      assert.ok(hold, `${a.id} CP${cp.sequence} marks HOLD valid but does not offer it`);
      const flags = hold.branchEffect.flagsAdd;
      assert.ok(
        !flags.includes('ACTION_BIAS') && !flags.includes('REENTRY_DELAY'),
        `${a.id} CP${cp.sequence} marks HOLD valid and then penalises it`,
      );
    }
  }
});

// ─── Starting books ───────────────────────────────────────────────────────────

test('every starting book is internally consistent', () => {
  for (const a of allArenas()) {
    const p = a.startingPortfolio();
    const invested = p.positions.reduce((s, x) => s + x.weight, 0);
    assert.ok(invested > 0.3 && invested <= 1, `${a.id} invests ${invested}`);
    assert.ok(Math.abs(invested + p.cashWeight - 1) < 1e-6, `${a.id} weights and cash do not sum to 1`);

    const sectorTotal = Object.values(p.sectorExposure).reduce((s, x) => s + x, 0);
    assert.ok(
      Math.abs(sectorTotal - invested) < 1e-6,
      `${a.id} sector exposure disagrees with its own positions`,
    );
    assert.equal(p.drawdown, 0, `${a.id} starts already in drawdown`);
    assert.equal(p.turnoverUsed, 0, `${a.id} starts with turnover spent`);
    assert.equal(p.value, p.peakValue, `${a.id} starts below its own high-water mark`);
  }
});

test('a starting book is fresh each time, never shared state', () => {
  for (const a of allArenas()) {
    const first = a.startingPortfolio();
    first.positions[0].weight = 0.99;
    const second = a.startingPortfolio();
    assert.notEqual(second.positions[0].weight, 0.99, `${a.id} hands out a shared portfolio`);
  }
});

test('banking stress hands the player the cluster its lesson is about', () => {
  // §24: six bank tickers, one economic exposure. The lesson cannot be taught
  // to a player who is not holding it.
  const p = getArena('banking_stress')!.startingPortfolio();
  const banks = p.positions.filter(x => x.sector === 'FINANCIALS');
  assert.ok(banks.length >= 6, 'fewer than six banks: there is no cluster to discover');
  const clusterWeight = banks.reduce((s, x) => s + x.weight, 0);
  assert.ok(clusterWeight >= 0.4, `bank cluster is only ${clusterWeight}: too small to be the lesson`);
});

test('recovery hands the player the defensive book the previous arena produces', () => {
  // §22 only works if the player starts holding the consequence of surviving.
  const p = getArena('recovery_trap')!.startingPortfolio();
  assert.ok(p.cashWeight >= 0.35, `recovery starts at ${p.cashWeight} cash: the trap needs the cash`);
});

test('buildPortfolio derives cash and sectors rather than trusting them twice', () => {
  const p = buildPortfolio(
    [
      { symbol: 'A', weight: 0.3, sector: 'TECH', riskContrib: 0.1 },
      { symbol: 'B', weight: 0.2, sector: 'TECH', riskContrib: 0.1 },
      { symbol: 'C', weight: 0.1, sector: 'ENERGY', riskContrib: 0.1 },
    ],
    { volatility: 0.15, correlationIndex: 0.4, startingCapital: 100000 },
  );
  assert.equal(p.cashWeight, 0.4);
  assert.equal(p.sectorExposure.TECH, 0.5);
  assert.equal(p.sectorExposure.ENERGY, 0.1);
});

// ─── Engine integration ───────────────────────────────────────────────────────

test('a run opens on the arena it was asked for', () => {
  for (const a of allArenas()) {
    const run = createInitialRun(1, a.id);
    assert.equal(run.arenaId, a.id);
    assert.equal(run.totalCheckpoints, a.checkpoints.length);
    assert.equal(run.turnoverBudget, turnoverBudgetFor(a.checkpoints.length));
  }
});

test('the turnover budget scales with the arena, so no arena is HOLD-only by construction', () => {
  for (const a of allArenas()) {
    const run = createInitialRun(1, a.id);
    const cheapest = Math.min(
      ...a.checkpoints.flatMap(cp =>
        cp.availableActions.filter(b => b.actionCode !== 'HOLD').map(b => b.turnoverCost),
      ),
    );
    assert.ok(
      run.turnoverBudget / cheapest >= a.checkpoints.length * 0.4,
      `${a.id} cannot afford to act at 40% of its checkpoints`,
    );
  }
});

test('every authored stance is committable through the engine', () => {
  // The engine rejects a stance the checkpoint does not author. This asserts
  // the reverse: nothing authored is rejected, so no branch is decorative.
  for (const a of allArenas()) {
    const cp = a.checkpoints[0];
    for (const b of cp.availableActions) {
      const run = createInitialRun(1, a.id);
      const outcome = commitDecisionCommand(run, { action: b.actionCode, conviction: 60 });
      assert.ok(outcome, `${a.id} CP1 ${b.actionCode} was rejected by the engine`);
    }
  }
});

test('every arena can be played end to end by a machine', () => {
  for (const a of allArenas()) {
    const r = runStressTest(cfg(), { seed: 7, arenaId: a.id });
    assert.equal(
      r.steps.length,
      a.checkpoints.length,
      `${a.id} stopped after ${r.steps.length} of ${a.checkpoints.length} checkpoints`,
    );
  }
});

test('arenas are genuinely different: one machine does not score them alike', () => {
  const results = allArenas().map(a => runStressTest(cfg(), { seed: 7, arenaId: a.id }));
  const perCheckpoint = results.map(r => r.vsPar / Math.max(1, r.steps.length));
  const spread = Math.max(...perCheckpoint) - Math.min(...perCheckpoint);
  assert.ok(spread > 1, `regimes are interchangeable: spread of only ${spread} per checkpoint`);
});

// ─── Gauntlet ─────────────────────────────────────────────────────────────────

test('the gauntlet crosses every regime but the final boss', () => {
  // §20 places TACO after the gauntlet, and §25.1 makes it a reflexivity test
  // rather than a regime.
  assert.ok(!GAUNTLET_ARENAS.includes('taco_protocol'));
  assert.equal(GAUNTLET_ARENAS.length, 4);
});

test('the gauntlet runs one machine across every leg', () => {
  const g = runGauntlet(cfg(), { seed: 7 });
  assert.equal(g.legs.length, GAUNTLET_ARENAS.length);
  assert.deepEqual(g.legs.map(l => l.arenaId), GAUNTLET_ARENAS);
});

test('the machine is locked across the sequence (§7.5)', () => {
  // Each leg must produce exactly what that arena produces alone. If the
  // gauntlet mutated the config between legs, these would diverge.
  const config = cfg({ signal: 'REGIME_CLASSIFIER' });
  const g = runGauntlet(config, { seed: 7 });
  for (const leg of g.legs) {
    const alone = runStressTest(config, { seed: 7, arenaId: leg.arenaId });
    assert.deepEqual(
      leg.result.steps.map(s => s.action),
      alone.steps.map(s => s.action),
      `${leg.arenaId} played differently inside the gauntlet`,
    );
  }
});

test('each leg starts from its own arena, not from the previous one', () => {
  const g = runGauntlet(cfg(), { seed: 7 });
  for (const leg of g.legs) {
    const expected = getArena(leg.arenaId)!.startingPortfolio();
    assert.equal(
      leg.result.run.decisions.length > 0,
      true,
      `${leg.arenaId} committed nothing`,
    );
    // Position symbols identify the book the leg opened on.
    assert.deepEqual(
      leg.result.run.portfolio.positions.map(p => p.symbol),
      expected.positions.map(p => p.symbol),
      `${leg.arenaId} did not start from its own book`,
    );
  }
});

test('the consistency spread is the gap between best and worst regime', () => {
  const g = runGauntlet(cfg(), { seed: 7 });
  const vs = g.legs.map(l => l.vsPar);
  assert.equal(g.consistencySpread, Math.max(...vs) - Math.min(...vs));
  assert.equal(g.totalVsPar, vs.reduce((a, b) => a + b, 0));
});

test('the verdict reports a broken regime before it reports a score', () => {
  const g = runGauntlet(cfg(), { seed: 7 });
  const broken = {
    ...g,
    legs: g.legs.map((l, i) => (i === 1 ? { ...l, survived: false } : l)),
  };
  assert.match(gauntletVerdict(broken).headline, /BROKE IN 1 OF 4/);
});

test('the verdict never claims a clean sweep that did not happen', () => {
  const g = runGauntlet(cfg(), { seed: 7 });
  const none = { ...g, beatParCount: 0, legs: g.legs.map(l => ({ ...l, survived: true })) };
  assert.match(gauntletVerdict(none).headline, /BEAT NONE/);
  const all = { ...g, beatParCount: g.legs.length, legs: g.legs.map(l => ({ ...l, survived: true })) };
  assert.match(gauntletVerdict(all).headline, /ALL 4 REGIMES/);
});

test('a machine that suits one regime is visible as a spread, not hidden in an average', () => {
  // §1.4: beating a machine once is possible; doing it across regimes is hard.
  // The mode only makes that point if the spread is reported.
  const g = runGauntlet(cfg({ signal: 'PRICE_MOMENTUM' }), { seed: 7 });
  assert.ok(g.consistencySpread > 0, 'a machine scored identically in every regime');
  assert.ok(g.worstArena !== null && g.bestArena !== null);
  assert.notEqual(g.worstArena, g.bestArena);
});
