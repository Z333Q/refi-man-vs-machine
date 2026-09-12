// ─── Audio policy ─────────────────────────────────────────────────────────────
// What plays where. Pure: no DOM, no Web Audio, so every rule here is testable.
//
// Three independent channels, each with its own switch:
//
//   fx        interface confirmation. On by default, quiet. A keyboard, not a
//             reward.
//   ambient   room tone per screen family. On by default, quieter.
//   music     opt-in. Off until the player turns it on.
//
// The law that shapes every mapping is §61A: sound must never encode outcome.
// The machine reveal plays the same cue whether the player is over or under
// par. The run's closing bell is the same bell on a win and on a loss. Cues
// that only make sense as a win or loss sting are listed in BARRED_CUES and
// the policy test proves nothing here can reach them.
//
// Cue ids are the `id` field of public/audio/manifest.json. A cue that has not
// been generated yet is simply absent from the scene: silence is the fallback,
// never a substitute cue that carries the wrong meaning.

import type { CheckpointPhase, GameVisualEventType } from './gameTypes';
import type { TipGameState } from '../context/tipGate';

// ─── Preferences ──────────────────────────────────────────────────────────────

export type SoundChannel = 'fx' | 'ambient' | 'music';

export interface SoundPrefs {
  fx: boolean;
  ambient: boolean;
  music: boolean;
}

export const DEFAULT_SOUND_PREFS: SoundPrefs = { fx: true, ambient: true, music: false };

export const SOUND_PREFS_KEY = 'refi_sound';

/** Parse a stored preference blob. Anything malformed falls back to defaults. */
export function parseSoundPrefs(raw: string | null): SoundPrefs {
  if (!raw) return { ...DEFAULT_SOUND_PREFS };
  try {
    const v = JSON.parse(raw) as Partial<Record<SoundChannel, unknown>>;
    return {
      fx: typeof v.fx === 'boolean' ? v.fx : DEFAULT_SOUND_PREFS.fx,
      ambient: typeof v.ambient === 'boolean' ? v.ambient : DEFAULT_SOUND_PREFS.ambient,
      music: typeof v.music === 'boolean' ? v.music : DEFAULT_SOUND_PREFS.music,
    };
  } catch {
    return { ...DEFAULT_SOUND_PREFS };
  }
}

export function serializeSoundPrefs(p: SoundPrefs): string {
  return JSON.stringify({ fx: p.fx, ambient: p.ambient, music: p.music });
}

/** Channel trims. Music sits under the UI, ambience under the music. */
export const CHANNEL_GAIN: Record<SoundChannel, number> = {
  fx: 0.8,
  ambient: 0.35,
  music: 0.5,
};

/** Music multiplier while the machine reveal has the floor. */
export const DUCK_FACTOR = 0.3;

// ─── Screen families ──────────────────────────────────────────────────────────

export type ScreenFamily =
  | 'title'
  | 'hub'
  | 'briefing'
  | 'run'
  | 'review'
  | 'builder'
  | 'other';

/** App screens collapse into families; the policy never needs the full list. */
export function screenFamily(screen: string): ScreenFamily {
  switch (screen) {
    case 'boot':
    case 'landing':
      return 'title';
    case 'progression-hub':
    case 'arena-map':
    case 'machine-ladder':
    case 'daily-tape':
      return 'hub';
    case 'arena-briefing':
    case 'machine-card':
    case 'taco-unlock':
      return 'briefing';
    case 'core-loop':
      return 'run';
    case 'machine-reveal':
    case 'checkpoint-score':
    case 'autopsy':
    case 'alpha-profile':
      return 'review';
    case 'machine-builder':
    case 'basket-writer':
      return 'builder';
    default:
      return 'other';
  }
}

// ─── Run intensity ────────────────────────────────────────────────────────────

export type RunIntensity = 'CALM' | 'STRESS';

/** Checkpoint phases where the floor is loud and the music is Margin. */
const STRESS_PHASES: ReadonlySet<CheckpointPhase> = new Set<CheckpointPhase>([
  'PANIC',
  'RATE_SHOCK',
  'FUNDING_STRESS',
  'CONTAGION',
  'POLICY_SHOCK',
]);

export function runIntensity(phase: CheckpointPhase | null | undefined): RunIntensity {
  return phase && STRESS_PHASES.has(phase) ? 'STRESS' : 'CALM';
}

// ─── Scenes ───────────────────────────────────────────────────────────────────

/** The title theme is two files: an intro that plays once and a loop under it. */
export const TITLE_THEME = { intro: '0930-intro', loop: '0930-loop' } as const;

export interface SceneInput {
  screen: string;
  state: TipGameState;
  intensity: RunIntensity;
}

export interface Scene {
  /** Music cue id, or the TITLE_THEME sentinel, or null for silence. */
  music: string | null;
  ambient: string | null;
  /** Music drops under the machine reveal so the result UI has the floor. */
  duck: boolean;
}

export const TITLE_MUSIC = 'title-theme';

export function sceneFor(input: SceneInput): Scene {
  const family = screenFamily(input.screen);
  switch (family) {
    case 'title':
      return { music: TITLE_MUSIC, ambient: null, duck: false };
    case 'hub':
      return { music: 'capital-moves', ambient: null, duck: false };
    case 'briefing':
      // Cue 4, The Tape, is not generated yet. Silence rather than a stand-in.
      return { music: null, ambient: null, duck: false };
    case 'run':
      return runScene(input);
    case 'review':
    case 'builder':
    case 'other':
    default:
      // After Hours (cue 12) and the office hum (cue 33) are not generated yet.
      return { music: null, ambient: null, duck: false };
  }
}

function runScene(input: SceneInput): Scene {
  const stress = input.intensity === 'STRESS';
  switch (input.state) {
    case 'MARKET_ADVANCING':
      // The tape prints while the market moves. Same cue at every intensity:
      // the advance is information, not drama.
      return { music: 'the-floor', ambient: 'printer-continuous', duck: false };
    case 'MACHINE_REVEAL':
    case 'RESULT_COMPUTING':
      return {
        music: stress ? 'margin' : 'the-position',
        ambient: stress ? 'trading-floor-panic' : null,
        duck: true,
      };
    case 'COMPLETE':
      return { music: null, ambient: null, duck: false };
    case 'IDLE':
      return { music: null, ambient: null, duck: false };
    case 'DECISION_REQUIRED':
    case 'COMMIT_CONFIRM':
    case 'THESIS_PROMPT':
    default:
      return {
        music: stress ? 'margin' : 'the-position',
        ambient: stress ? 'trading-floor-panic' : null,
        duck: false,
      };
  }
}

// ─── One-shot interface cues ──────────────────────────────────────────────────

/**
 * Interface cues fired by a change of scene input. Each one confirms an act
 * or a transition. None of them knows how the checkpoint went.
 */
export function sfxForTransition(prev: SceneInput | null, next: SceneInput): string[] {
  const out: string[] = [];
  const prevState = prev?.state ?? 'IDLE';
  const prevScreen = prev?.screen ?? '';

  // Entering the map from anywhere but the title is a return to the overview.
  if (next.screen === 'arena-map' && prevScreen !== 'arena-map' && screenFamily(prevScreen) !== 'title') {
    out.push('return-to-map');
  }

  if (screenFamily(next.screen) === 'run' && next.state !== prevState) {
    switch (next.state) {
      case 'MARKET_ADVANCING':
        // The order is in. Same stamp for HOLD as for any stance (rule 6).
        out.push('order-submitted');
        break;
      case 'MACHINE_REVEAL':
        // One reveal cue for every result (§61A).
        out.push('machine-reveal');
        break;
      case 'COMPLETE':
        // The closing bell rings on a win and on a loss alike.
        out.push('exchange-bell');
        break;
      default:
        break;
    }
  }
  return out;
}

/** Visual events that carry a sound. Everything else is silent. */
export function sfxForEvent(type: GameVisualEventType): string | null {
  switch (type) {
    case 'MARKET_SHOCK':
      return 'market-shock';
    case 'MACHINE_VERSION_COMPILED':
      return 'machine-calculation';
    default:
      // DRAWDOWN_WARNING and RISK_LIMIT_BREACH wait on cue 41. REGIME_SHIFT
      // waits on cue 44. MACHINE_ADVANTAGE and HUMAN_ADVANTAGE are outcome
      // events and stay silent by law, not by omission.
      return null;
  }
}

// ─── The barred list ──────────────────────────────────────────────────────────

/**
 * Cues that exist as files but can never be scheduled by this policy, because
 * their only meaning is an outcome. Kept as a list so the test can prove the
 * reachable set excludes them, and so a future cue 10 lands here too.
 */
export const BARRED_CUES: readonly string[] = ['machine-beats-player'];

/** Every cue id the policy can reach, for the manifest coverage test. */
export function reachableCues(): string[] {
  const ids = new Set<string>();
  const screens = [
    'boot', 'landing', 'progression-hub', 'arena-map', 'machine-ladder', 'daily-tape',
    'arena-briefing', 'machine-card', 'taco-unlock', 'core-loop', 'machine-reveal',
    'checkpoint-score', 'autopsy', 'alpha-profile', 'machine-builder', 'basket-writer',
  ];
  const states: TipGameState[] = [
    'IDLE', 'DECISION_REQUIRED', 'COMMIT_CONFIRM', 'THESIS_PROMPT',
    'MARKET_ADVANCING', 'MACHINE_REVEAL', 'RESULT_COMPUTING', 'COMPLETE',
  ];
  const intensities: RunIntensity[] = ['CALM', 'STRESS'];
  const inputs: SceneInput[] = [];
  for (const screen of screens) for (const state of states) for (const intensity of intensities) {
    inputs.push({ screen, state, intensity });
  }
  for (const input of inputs) {
    const s = sceneFor(input);
    if (s.music === TITLE_MUSIC) { ids.add(TITLE_THEME.intro); ids.add(TITLE_THEME.loop); }
    else if (s.music) ids.add(s.music);
    if (s.ambient) ids.add(s.ambient);
    for (const prev of [null, ...inputs]) for (const id of sfxForTransition(prev, input)) ids.add(id);
  }
  const eventTypes: GameVisualEventType[] = ['MARKET_SHOCK', 'MACHINE_VERSION_COMPILED'];
  for (const t of eventTypes) { const id = sfxForEvent(t); if (id) ids.add(id); }
  return [...ids].sort();
}
