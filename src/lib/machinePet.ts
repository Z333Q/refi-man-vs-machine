import type { MachineModuleId } from './gameTypes';

// ─── The machine, with a body ─────────────────────────────────────────────────
//
// "Your machine" has been an abstraction: a config object and a rack of dots
// reading 7/11. §19 asks for visible evolution from v0.1 to v1.0 and §43 for an
// assembly where each module lights up as it is installed. This gives that a
// shape — a four-legged lab machine that is built out of the modules actually
// installed, so the thing being constructed is a thing rather than a checklist.
//
// DELIBERATELY NOT A TAMAGOTCHI, in the one way that matters. There is no
// hunger, no timer, no decay, and nothing that punishes absence. §16 bans fake
// urgency, and a machine that withers when you do not log in would teach the
// exact opposite of this game's thesis: the argument for a process is that it
// does not depend on your attention. Leave for a month and it is precisely
// where you left it — that is the lesson, not a failure state.
//
// It changes for two reasons only, both evidence:
//   1. what you have BUILT   — installed modules, compiled version
//   2. what your portfolio IS DOING — guardrail breach, drawdown against budget
//
// Both are current state, never elapsed time. The pure-function shape below is
// enforced by machinePet.test.ts, which fails if this file ever reads a clock
// or an RNG.

export interface MachinePetState {
  installed: MachineModuleId[];
  /** A locked, compiled version stands; an uncompiled draft stays on the bench. */
  compiled: boolean;
  /** Drawdown as a fraction of the arena risk budget, 0-1. Absent outside a run. */
  riskUsed?: number;
  /** A guardrail is currently breached. */
  breached?: boolean;
}

export type PetPosture = 'BENCH' | 'STANDING' | 'BRACED' | 'HALTED';

/**
 * Posture reads the portfolio, not the calendar.
 *
 * BRACED and HALTED are not damage and must never be drawn as damage: the
 * machine doing its job under stress is the machine working, not the machine
 * suffering. A guardrail stopping an order is a success condition (§45).
 */
export function posture(state: MachinePetState): PetPosture {
  if (!state.compiled) return 'BENCH';
  if (state.breached) return 'HALTED';
  if ((state.riskUsed ?? 0) >= 0.6) return 'BRACED';
  return 'STANDING';
}

const W = 22;          // canvas width
const L = 2;           // left edge of the dog's outline
const R = 15;          // right edge of it
// Four legs, paired front and back the way a dog's are. Evenly spaced legs
// read as a table; paired legs read as an animal.
const MOUNTS = [4, 6, 11, 13];

/** Blank canvas row. */
const row = () => Array<string>(W).fill(' ');
const put = (r: string[], col: number, text: string) => {
  [...text].forEach((ch, i) => { r[col + i] = ch; });
};

/**
 * The face carries the state.
 *
 * A reader looks at a dog's eye before anything else, so the posture should be
 * legible there before a single label is read. HALTED deliberately gets no
 * X-eye and no dead face: a guardrail stopping an order is a success condition
 * (§45), and drawing it as roadkill would teach the opposite.
 *
 * Every glyph is half-width. A fullwidth character takes two columns while
 * counting as one code point, which tears the drawing apart on its row.
 */
function faceFor(state: MachinePetState, canSee: boolean): { eye: string; snout: string } {
  if (!canSee) return { eye: '·', snout: 'ᴥ' };
  switch (posture(state)) {
    case 'BENCH':  return { eye: '^', snout: '‿' };   // dozing, content
    case 'BRACED': return { eye: '◉', snout: 'ᴗ' };   // wide awake, watching
    case 'HALTED': return { eye: '-', snout: '·' };   // stopped, calm
    default:       return { eye: '◕', snout: 'ᴥ' };   // happy
  }
}

/**
 * The tail, drawn in half-blocks so it reads as thick and fluffy rather than as
 * a scratch of line art. It is the loudest thing in the drawing on purpose:
 * it is the fastest read of what the machine is doing.
 */
function drawTail(canvas: string[][], state: MachinePetState) {
  switch (posture(state)) {
    case 'STANDING':                    // up and wagging
      put(canvas[0], 17, '▟▛');
      put(canvas[1], 16, '▟▛');
      put(canvas[2], 16, '▛');
      break;
    case 'BRACED':                      // out straight behind, balancing
      put(canvas[1], 16, '▟▛');
      put(canvas[2], 16, '▀▀▄');
      break;
    case 'HALTED':                      // lowered, still
      put(canvas[2], 16, '▙');
      put(canvas[3], 16, '▜▖');
      break;
    default:                            // BENCH: curled in against the body
      put(canvas[3], 16, '▂▖');
      break;
  }
}

/**
 * Draw the dog, in profile.
 *
 * A front view is a box with ears; a side view reads as an animal, and gives
 * the tail somewhere to go. Every part is present only if the module that
 * justifies it is installed, so the drawing cannot claim capability the
 * configuration does not have.
 */
export function drawMachine(state: MachinePetState): string[] {
  const has = (m: MachineModuleId) => state.installed.includes(m);
  const p = posture(state);
  const { eye, snout } = faceFor(state, has('MONITORING'));

  // Six rows: ear, back, eye, muzzle, belly, paws.
  const canvas = [row(), row(), row(), row(), row(), row()];

  // ── Ear. SIGNAL is what it hears a regime with, so SIGNAL gives it one.
  if (has('SIGNAL')) put(canvas[0], 3, '╭╮');

  // ── Body. UNIVERSE is the frame everything else hangs off.
  if (!has('UNIVERSE')) {
    put(canvas[2], L, '╌ ╌ ╌ ╌ ╌ ╌');
    put(canvas[3], L, 'NO CHASSIS');
    return canvas.map(r => r.join('').replace(/\s+$/, '').padEnd(W));
  }

  const g = has('GUARDRAILS');
  const [h, v, br] = g ? ['═', '║', '╝'] : ['─', '│', '╯'];

  // The back: head crown, then the spine running to the rump.
  put(canvas[1], L, (has('SIGNAL') ? '╭╯╰' : '╭──') + h.repeat(R - L - 3) + (g ? '╗' : '╮'));
  // The eye line, carrying whatever the machine is holding.
  put(canvas[2], L, v);
  put(canvas[2], L + 2, eye);
  put(canvas[2], L + 6, has('CONSTRUCTION') ? '█████' : '·····');
  put(canvas[2], R, v);
  // The muzzle line. ELIGIBILITY is the intake screen; on a dog, its nose.
  put(canvas[3], L - 1, '╰' + (has('ELIGIBILITY') ? snout : '·'));
  put(canvas[3], L + 2, ' ');
  put(canvas[3], R, v);

  // The belly, with the four leg sockets.
  const belly = row();
  put(belly, L, (g ? '╚' : '╰') + h.repeat(R - L - 1) + br);
  MOUNTS.forEach(c => { belly[c] = '┬'; });
  canvas[4] = belly;

  drawTail(canvas, state);

  // ── Legs. EXECUTION is the ability to act at all.
  if (!has('EXECUTION')) {
    MOUNTS.forEach(c => { canvas[5][c] = '╌'; });
    return canvas.map(r => r.join('').replace(/\s+$/, '').padEnd(W));
  }

  const paw =
    p === 'BENCH' ? '╘'
      : p === 'HALTED' ? '▬'
        : '╨';
  if (p === 'BRACED') {
    // A wider stance under load. Bracing is competence, not injury.
    put(canvas[5], MOUNTS[0] - 1, '╱');
    canvas[5][MOUNTS[1]] = '║';
    canvas[5][MOUNTS[2]] = '║';
    put(canvas[5], MOUNTS[3] + 1, '╲');
  } else {
    MOUNTS.forEach(c => { canvas[5][c] = paw; });
  }

  return canvas.map(r => r.join('').replace(/\s+$/, '').padEnd(W));
}

/** One line of plain text saying what the drawing shows, for §62. */
export function describeMachine(state: MachinePetState): string {
  const n = state.installed.length;
  const p = posture(state);
  const stance =
    p === 'BENCH' ? 'curled up on the bench, not yet compiled'
      : p === 'HALTED' ? 'halted by its own guardrail'
        : p === 'BRACED' ? 'braced, running under elevated risk'
          : 'up on all four legs, running inside its limits';
  return `Robot dog with ${n} of 7 modules installed, ${stance}.`;
}
