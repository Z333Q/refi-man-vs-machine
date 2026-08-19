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

const W = 23;          // canvas width
const FRAME = 17;      // chassis outer width
const INNER = FRAME - 2;
// The four legs mount at these columns of the chassis, and the bottom rail
// draws its sockets at the same indices. Sharing the constant is what keeps
// the feet under the body instead of beside it.
const MOUNTS = [2, 6, 10, 14];

const centre = (s: string, width: number) => {
  const room = width - [...s].length;
  const left = Math.max(0, Math.floor(room / 2));
  return ' '.repeat(left) + s + ' '.repeat(Math.max(0, room - left));
};
const pad = (s: string) => centre(s, W);

/**
 * A FRAME-wide row carrying a glyph at each leg mount.
 *
 * The row keeps its full width rather than being trimmed: a trimmed row is
 * shorter than the chassis, so re-centring it shifts the legs a column away
 * from the sockets they are supposed to hang from.
 */
const mountRow = (glyphs: string | string[]) => {
  const row = Array<string>(FRAME).fill(' ');
  MOUNTS.forEach((col, i) => {
    row[col] = Array.isArray(glyphs) ? glyphs[i] : glyphs;
  });
  return pad(row.join(''));
};

/**
 * Draw the machine.
 *
 * Every part is present only if the module that justifies it is installed, so
 * the drawing cannot claim capability the configuration does not have — the
 * same rule the plates follow.
 */
export function drawMachine(state: MachinePetState): string[] {
  const has = (m: MachineModuleId) => state.installed.includes(m);
  const p = posture(state);

  const lines: string[] = [];

  // ── Sensor mast: SIGNAL is how it perceives a regime at all.
  if (has('SIGNAL')) {
    const eyes = has('MONITORING') ? '◉ ◉' : '· ·';
    lines.push(pad('╔═════╗'));
    lines.push(pad(`║ ${eyes} ║`));
    lines.push(pad('╚══╤══╝'));
  } else {
    lines.push(pad(''));
    lines.push(pad('╷'));
    lines.push(pad('╵'));
  }

  // ── Chassis: UNIVERSE is the frame everything else bolts to.
  if (!has('UNIVERSE')) {
    lines.push(pad('┌─ ─ ─ ─ ─ ─ ─┐'));
    lines.push(pad('│ NO CHASSIS  │'));
    lines.push(pad('└─ ─ ─ ─ ─ ─ ─┘'));
    return lines;
  }

  // GUARDRAILS armour the frame: a double rule where they exist, single where
  // they do not.
  const g = has('GUARDRAILS');
  const [h, v, tl, tr, bl, br] = g
    ? ['═', '║', '╔', '╗', '╚', '╝']
    : ['─', '│', '┌', '┐', '└', '┘'];

  // Bottom rail carries the leg sockets at the shared mount columns.
  const rail = Array<string>(FRAME).fill(h);
  rail[0] = bl; rail[FRAME - 1] = br;
  MOUNTS.forEach(i => { rail[i] = '╤'; });

  lines.push(pad(tl + h.repeat(INNER) + tr));
  // Odd-length labels, because INNER is odd: an even label cannot sit centred
  // in an odd space and ends up a column off from the frame around it.
  lines.push(pad(v + centre(has('CONSTRUCTION') ? '███ PAYLOAD ███' : 'EMPTY PAYLOAD', INNER) + v));
  lines.push(pad(v + centre(has('ELIGIBILITY') ? '▤▤▤ FILTERS ▤▤▤' : 'NO FILTER', INNER) + v));
  lines.push(pad(rail.join('')));

  // ── Legs: EXECUTION is the ability to act at all. Four of them, because a
  // process that can only stand is not a process.
  if (!has('EXECUTION')) {
    lines.push(mountRow('╌'));
    lines.push(pad('NO ACTUATORS'));
    return lines;
  }

  if (p === 'BENCH') {
    // Folded on the bench: built, not compiled, so it has not stood up yet.
    lines.push(mountRow('╘'));
    lines.push(pad('ON THE BENCH'));
  } else if (p === 'BRACED') {
    // A wider stance under load: the outer legs splay to take it. Bracing is
    // competence, not injury, and must not be drawn as damage.
    lines.push(mountRow(['╱', '║', '║', '╲']));
    lines.push(mountRow('╨'));
  } else if (p === 'HALTED') {
    lines.push(mountRow('║'));
    lines.push(mountRow('▬'));
  } else {
    lines.push(mountRow('║'));
    lines.push(mountRow('╨'));
  }

  return lines;
}

/** One line of plain text saying what the drawing shows, for §62. */
export function describeMachine(state: MachinePetState): string {
  const n = state.installed.length;
  const p = posture(state);
  const stance =
    p === 'BENCH' ? 'on the bench, not yet compiled'
      : p === 'HALTED' ? 'halted by its own guardrail'
        : p === 'BRACED' ? 'braced, running under elevated risk'
          : 'standing, running inside its limits';
  return `Machine with ${n} of 7 modules installed, ${stance}.`;
}
