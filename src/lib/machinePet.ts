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

const W = 26;          // canvas width
const BODY_L = 4;      // left edge of the body
const BODY_W = 12;
const HEAD_L = 6;      // the head sits above the body, slightly forward
// Legs paired front and back the way a dog's are. Evenly spaced legs read as a
// table; paired legs read as an animal.
const MOUNTS = [6, 7, 12, 13];

/**
 * Actual ASCII.
 *
 * The first versions of this were drawn in box-drawing and block characters —
 * U+2500 and U+2580 — which is not ASCII at all, whatever the file is called.
 * That mattered for more than pedantry: line-drawing gives you clean geometry,
 * which is exactly why it kept reading as a diagram instead of an animal. A
 * face needs letters and punctuation, and `( o.o )` is cuter than any
 * arrangement of ╭ and ╮ is ever going to be.
 *
 * Everything below is printable ASCII, 0x20 to 0x7E. That also removes a whole
 * class of bug: no fullwidth glyphs to tear the grid, no missing-glyph boxes in
 * whatever monospace font the player happens to have.
 */
const row = () => Array<string>(W).fill(' ');
const put = (r: string[], col: number, text: string) => {
  [...text].forEach((ch, i) => { r[col + i] = ch; });
};

/**
 * The eyes carry the state.
 *
 * A reader looks at a face before anything else, so the posture should be
 * legible there before a single label is read. HALTED deliberately gets no
 * X-eyes: a guardrail stopping an order is a success condition (§45), and
 * drawing it as roadkill would teach the opposite.
 */
function eyesFor(state: MachinePetState, canSee: boolean): string {
  if (!canSee) return '. .';
  switch (posture(state)) {
    case 'BENCH':  return 'u.u';   // dozing
    case 'BRACED': return 'O.O';   // wide awake, watching the risk
    case 'HALTED': return '-.-';   // stopped, calm
    default:       return 'o.o';   // happy
  }
}

/**
 * The tail, which is the fastest read in the drawing.
 *
 * It cascades up and away when the machine is running clean, so the wag is
 * legible as motion in a still frame.
 */
function drawTail(canvas: string[][], state: MachinePetState) {
  switch (posture(state)) {
    case 'STANDING':
      put(canvas[1], 20, '~~');
      put(canvas[2], 18, '~~');
      put(canvas[3], 16, '~~');
      break;
    case 'BRACED':                       // straight out behind, balancing
      put(canvas[3], 16, '~~~~');
      break;
    case 'HALTED':                       // lowered, still
      put(canvas[4], 16, '\\');
      put(canvas[5], 17, '\\');
      break;
    default:                             // BENCH: curled in against the body
      put(canvas[5], 16, '_,');
      break;
  }
}

/**
 * Draw the dog.
 *
 * Every part is present only if the module that justifies it is installed, so
 * the drawing cannot claim capability the configuration does not have.
 */
export function drawMachine(state: MachinePetState): string[] {
  const has = (m: MachineModuleId) => state.installed.includes(m);
  const p = posture(state);
  const canvas = [row(), row(), row(), row(), row(), row(), row()];

  // ── Head. SIGNAL is what it hears a regime with, so SIGNAL gives it ears.
  put(canvas[0], HEAD_L, has('SIGNAL') ? ' /\\_/\\ ' : ' _____ ');
  put(canvas[1], HEAD_L, `( ${eyesFor(state, has('MONITORING'))} )`);
  // ELIGIBILITY is the intake screen; on a dog, that is its nose.
  put(canvas[2], HEAD_L, ` > ${has('ELIGIBILITY') ? 'w' : ' '} < `);

  // ── Body. UNIVERSE is the frame everything else hangs off.
  if (!has('UNIVERSE')) {
    put(canvas[4], BODY_L, 'no chassis');
    return canvas.map(r => r.join(''));
  }

  // GUARDRAILS thicken the shell.
  const h = has('GUARDRAILS') ? '=' : '-';
  put(canvas[3], BODY_L, ',' + h.repeat(BODY_W - 2) + '.');
  put(canvas[4], BODY_L, `(  ${has('CONSTRUCTION') ? '######' : '......'}  )`);
  put(canvas[5], BODY_L, '`' + h.repeat(BODY_W - 2) + "'");

  drawTail(canvas, state);

  // ── Legs. EXECUTION is the ability to act at all.
  const paw = !has('EXECUTION') ? '.'
    : p === 'BENCH' ? ','
      : p === 'BRACED' ? '/'
        : p === 'HALTED' ? '.'
          : "'";
  MOUNTS.forEach(c => { canvas[6][c] = paw; });

  return canvas.map(r => r.join(''));
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
