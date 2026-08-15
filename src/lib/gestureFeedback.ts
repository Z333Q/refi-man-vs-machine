// ─── Gesture feedback channels ────────────────────────────────────────────────
// The detent rhythm has to survive the platform it runs on.
//
// Addendum C leans on haptics structurally: section 4's muscle-memory argument
// is that players stop reading the numeral and start counting ticks, and the
// reduced-motion path promises "haptic detents remain; they are not motion."
// On iOS Safari that promise cannot be kept. navigator.vibrate is unsupported
// there, and the checkbox-switch side effect that some libraries exploited was
// patched in iOS 26.5. On the tablet this design is aimed at, the haptic
// channel does not exist at all.
//
// So the rhythm is carried on three channels in order of reliability:
//
//   visual   always available, survives mute, deafness and reduced motion
//   audio    a short quiet click, works everywhere including iOS
//   haptic   enhancement where the platform actually provides it
//
// See docs/g1-gesture-research.md section 6.

export type FeedbackKind =
  | 'ARM'
  | 'DETENT'
  | 'LANDMARK'
  | 'GOVERNOR'
  | 'HARD_STOP'
  | 'COMMIT'
  | 'COMMIT_HEAVY';

export interface FeedbackPreferences {
  /** Player mute. The audio channel is off, the others are unaffected. */
  muted: boolean;
  /** Honours prefers-reduced-motion. Ticks still report; only motion stops. */
  reducedMotion: boolean;
}

// ─── Haptics ──────────────────────────────────────────────────────────────────

const VIBRATION_MS: Record<FeedbackKind, number | number[]> = {
  ARM: 12,
  DETENT: 6,
  LANDMARK: [6, 24, 6],
  GOVERNOR: 22,
  HARD_STOP: [10, 20, 10],
  COMMIT: 16,
  COMMIT_HEAVY: 28,
};

export function hapticsAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function vibrate(kind: FeedbackKind): void {
  if (!hapticsAvailable()) return;
  try {
    navigator.vibrate(VIBRATION_MS[kind]);
  } catch {
    // A refused vibration is never worth interrupting a gesture for.
  }
}

// ─── Audio ────────────────────────────────────────────────────────────────────

// Short, quiet, synthesized. No asset to load and nothing to fail at the
// moment of a tick. The terminal aesthetic and a click are a natural fit, but
// the sound itself is a brand decision, not an engineering one.
const TONE: Record<FeedbackKind, { hz: number; ms: number; gain: number }> = {
  ARM:          { hz: 880,  ms: 18, gain: 0.05 },
  DETENT:       { hz: 1320, ms: 9,  gain: 0.03 },
  LANDMARK:     { hz: 1760, ms: 14, gain: 0.05 },
  GOVERNOR:     { hz: 220,  ms: 40, gain: 0.06 },
  HARD_STOP:    { hz: 330,  ms: 30, gain: 0.06 },
  COMMIT:       { hz: 660,  ms: 40, gain: 0.07 },
  COMMIT_HEAVY: { hz: 440,  ms: 60, gain: 0.09 },
};

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let context: AudioContext | null = null;

/**
 * Unlock audio from a real user gesture. The grip that starts a pull is
 * exactly that gesture, so this is called on the first pointerdown of a run
 * and is a no-op afterwards.
 */
export function unlockAudio(): void {
  if (context) {
    if (context.state === 'suspended') void context.resume();
    return;
  }
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  try {
    context = new Ctor();
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = null;
  }
}

function click(kind: FeedbackKind): void {
  if (!context || context.state !== 'running') return;
  const { hz, ms, gain } = TONE[kind];
  try {
    const now = context.currentTime;
    const osc = context.createOscillator();
    const envelope = context.createGain();
    osc.type = 'square';
    osc.frequency.value = hz;
    // A hard attack and a fast exponential decay reads as a click rather than
    // a beep, and keeps the tick short enough to sit under a fast pull.
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
    osc.connect(envelope).connect(context.destination);
    osc.start(now);
    osc.stop(now + ms / 1000);
  } catch {
    // Audio is a carrier, never a gate.
  }
}

// ─── The channel ──────────────────────────────────────────────────────────────

export interface FeedbackSink {
  /** Visual tick, driven by the caller. Always fires. */
  onVisual?: (kind: FeedbackKind) => void;
}

/**
 * Report one feedback beat across every channel available.
 *
 * Visual always fires, because it is the only channel that survives mute,
 * deafness and reduced motion at once. That is why the landmark structure has
 * to be legible on screen first and felt second.
 */
export function reportFeedback(
  kind: FeedbackKind,
  preferences: FeedbackPreferences,
  sink: FeedbackSink = {},
): void {
  sink.onVisual?.(kind);
  if (!preferences.muted) click(kind);
  vibrate(kind);
}

/** Which channels are actually live, for the settings surface and telemetry. */
export function availableChannels(preferences: FeedbackPreferences): {
  visual: boolean;
  audio: boolean;
  haptic: boolean;
} {
  return {
    visual: true,
    audio: !preferences.muted && context?.state === 'running',
    haptic: hapticsAvailable(),
  };
}
