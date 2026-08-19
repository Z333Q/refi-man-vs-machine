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
const L = 4;           // left edge of the head and body
const HEAD_W = 13;     // ears included
// Legs paired front and back the way a dog's are. Evenly spaced legs read as a
// table; paired legs read as an animal. They sit under the belly's sockets.
const MOUNTS = [6, 8, 12, 14];
const TAIL = 17;       // the tail hangs off the body's right wall, at TAIL - 1

/**
 * Box-drawing, not ASCII — and that is a deliberate choice, not the old
 * confusion.
 *
 * A previous pass moved this to strict printable ASCII on the grounds that
 * ASCII is letters and digits, which is true. But the drawing that came out of
 * it read worse: `,-._____,-.` over `(  o   o  )` reads as a bear, and the
 * letterforms fight the terminal grid rather than sitting in it. This shape,
 * built from U+2500 box-drawing, is the one that reads as a pup. Looking right
 * wins over being categorically named right, so the name is what gets
 * corrected: this is box-drawing art, and the file should eventually say so.
 *
 * The half-width rule still holds and is still tested: a fullwidth glyph counts
 * as one code point but occupies two columns, which tears the row it sits on.
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
function eyesFor(state: MachinePetState, canSee: boolean): [string, string] {
  if (!canSee) return ['·', '·'];
  switch (posture(state)) {
    case 'BENCH':  return ['^', '^'];   // dozing
    case 'BRACED': return ['◉', '◉'];   // wide awake, watching the risk
    case 'HALTED': return ['—', '—'];   // stopped, calm
    default:       return ['◕', '◕'];   // happy
  }
}

/**
 * The tail.
 *
 * It joins the body through a ╠ in the right wall rather than floating beside
 * it — an unattached diagonal next to a dog's rump does not read as a tail, as
 * was pointed out in the least flattering way available. It is also the fastest
 * read of state in the drawing, so each posture gets a distinct shape.
 */
function drawTail(canvas: string[][], state: MachinePetState) {
  switch (posture(state)) {
    case 'STANDING':                       // up in a happy curl
      put(canvas[4], TAIL, '╭╮');
      put(canvas[5], TAIL, '╯│');
      put(canvas[6], TAIL + 1, '╰');
      break;
    case 'BRACED':                         // straight out behind, balancing
      put(canvas[5], TAIL, '══╗');
      put(canvas[6], TAIL + 2, '╰');
      break;
    case 'HALTED':                         // lowered, still
      put(canvas[5], TAIL, '╮');
      put(canvas[6], TAIL, '╰╮');
      break;
    default:                               // BENCH: curled in tight, resting
      put(canvas[5], TAIL, '╯');
      break;
  }
}

/**
 * Draw the pup.
 *
 * Every part is present only if the module that justifies it is installed, so
 * the drawing cannot claim capability the configuration does not have.
 */
export function drawMachine(state: MachinePetState): string[] {
  const has = (m: MachineModuleId) => state.installed.includes(m);
  const p = posture(state);
  const canvas = [row(), row(), row(), row(), row(), row(), row(), row()];
  const [eyeL, eyeR] = eyesFor(state, has('MONITORING'));
  const nose = has('ELIGIBILITY') ? 'ᴥ' : '·';

  // ── Head. SIGNAL gives it the long floppy ears, which hang past the eyes to
  // the jaw. Short ears sitting on the corners of the skull read as a bear;
  // the length is what makes it a dog.
  const ears = has('SIGNAL');
  put(canvas[0], L, ears ? '╭╮╭───────╮╭╮' : '  ╭───────╮  ');
  put(canvas[1], L, ears ? `│││ ${eyeL}   ${eyeR} │││` : `  │ ${eyeL}   ${eyeR} │  `);
  put(canvas[2], L, ears ? `│││   ${nose}   │││` : `  │   ${nose}   │  `);
  put(canvas[3], L, ears ? '╰╯╰─┬───┬─╯╰╯' : '  ╰─┬───┬─╯  ');

  // ── Body. UNIVERSE is the frame everything else hangs off.
  if (!has('UNIVERSE')) {
    put(canvas[5], L, ' no chassis ');
    return canvas.map(r => r.join(''));
  }

  const g = has('GUARDRAILS');
  const [h, v, tl, tr, bl, br, join] = g
    ? ['═', '║', '╔', '╗', '╚', '╝', '╠']
    : ['─', '│', '╭', '╮', '╰', '╯', '├'];

  // Back, with the two neck posts the head sits on.
  const back = Array<string>(HEAD_W).fill(h);
  back[0] = tl; back[HEAD_W - 1] = tr;
  back[4] = '╧'; back[8] = '╧';
  put(canvas[4], L, back.join(''));

  // The barrel, carrying whatever the machine holds. Its right wall is a
  // junction, because that is where the tail attaches.
  put(canvas[5], L, v + `   ${has('CONSTRUCTION') ? '█████' : '·····'}   ` + join);

  // Belly, with the four leg sockets.
  const belly = Array<string>(HEAD_W).fill(h);
  belly[0] = bl; belly[HEAD_W - 1] = br;
  MOUNTS.forEach(c => { belly[c - L] = '╤'; });
  put(canvas[6], L, belly.join(''));

  drawTail(canvas, state);

  // ── Legs. EXECUTION is the ability to act at all.
  if (!has('EXECUTION')) {
    MOUNTS.forEach(c => { canvas[7][c] = '╌'; });
    return canvas.map(r => r.join(''));
  }

  if (p === 'BRACED') {
    // A wider stance under load. Bracing is competence, not injury.
    put(canvas[7], MOUNTS[0] - 1, '╱');
    canvas[7][MOUNTS[1]] = '║';
    canvas[7][MOUNTS[2]] = '║';
    put(canvas[7], MOUNTS[3] + 1, '╲');
  } else {
    const paw = p === 'BENCH' ? '╘' : p === 'HALTED' ? '▬' : '╨';
    MOUNTS.forEach(c => { canvas[7][c] = paw; });
  }

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
