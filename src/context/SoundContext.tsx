// ─── Sound provider ───────────────────────────────────────────────────────────
// Holds the three channel switches, drives the engine from the policy, and
// renders the toggle. Screens report where they are; the provider decides what
// that sounds like. No screen ever names a cue.
//
// Unlock: browsers refuse audio before a gesture, so the first pointerdown or
// keydown anywhere resumes the shared context. Nothing plays on the landing
// screen until the visitor has touched the page, which is also the product
// intent: no autoplay on arrival.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { GameVisualEventType } from '../lib/gameTypes';
import type { TipGameState } from './tipGate';
import {
  DEFAULT_SOUND_PREFS,
  SOUND_PREFS_KEY,
  parseSoundPrefs,
  sceneFor,
  serializeSoundPrefs,
  sfxForEvent,
  sfxForTransition,
  type RunIntensity,
  type SceneInput,
  type SoundChannel,
  type SoundPrefs,
} from '../lib/audioPolicy';
import { createSoundEngine, type SoundEngine } from '../lib/audioEngine';

interface SoundContextValue {
  prefs: SoundPrefs;
  toggle: (channel: SoundChannel) => void;
  /** Which app screen is mounted. Reported by App. */
  setScreen: (screen: string) => void;
  /** What the run is presenting. Reported by the core loop. */
  setRunState: (state: TipGameState, intensity: RunIntensity) => void;
  /** A visual event was emitted. Reported by the visual event bus. */
  event: (type: GameVisualEventType) => void;
}

const SoundContext = createContext<SoundContextValue>({
  prefs: DEFAULT_SOUND_PREFS,
  toggle: () => {},
  setScreen: () => {},
  setRunState: () => {},
  event: () => {},
});

export function useSound(): SoundContextValue {
  return useContext(SoundContext);
}

function loadPrefs(): SoundPrefs {
  try {
    return parseSoundPrefs(localStorage.getItem(SOUND_PREFS_KEY));
  } catch {
    return { ...DEFAULT_SOUND_PREFS };
  }
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<SoundPrefs>(loadPrefs);
  const [input, setInput] = useState<SceneInput>({ screen: 'boot', state: 'IDLE', intensity: 'CALM' });
  const engineRef = useRef<SoundEngine | null>(null);
  const prevInputRef = useRef<SceneInput | null>(null);

  const engine = useCallback((): SoundEngine | null => {
    if (typeof window === 'undefined') return null;
    if (!engineRef.current) engineRef.current = createSoundEngine();
    return engineRef.current;
  }, []);

  // One unlock listener for the page. Stays installed: a context can be
  // suspended again by the platform, and unlock is idempotent.
  useEffect(() => {
    const unlock = () => engine()?.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [engine]);

  useEffect(() => {
    engine()?.applyPrefs(prefs);
  }, [prefs, engine]);

  // The scene follows the input; transitions fire their one-shots.
  useEffect(() => {
    const e = engine();
    if (!e) return;
    const scene = sceneFor(input);
    e.setMusic(scene.music);
    e.setAmbient(scene.ambient);
    e.duck(scene.duck);
    for (const id of sfxForTransition(prevInputRef.current, input)) e.playSfx(id);
    prevInputRef.current = input;
  }, [input, engine]);

  const toggle = useCallback((channel: SoundChannel) => {
    setPrefs(p => {
      const next = { ...p, [channel]: !p[channel] };
      try { localStorage.setItem(SOUND_PREFS_KEY, serializeSoundPrefs(next)); } catch { /* best-effort */ }
      return next;
    });
  }, []);

  const setScreen = useCallback((screen: string) => {
    setInput(i => (i.screen === screen ? i : { ...i, screen }));
  }, []);

  const setRunState = useCallback((state: TipGameState, intensity: RunIntensity) => {
    setInput(i => (i.state === state && i.intensity === intensity ? i : { ...i, state, intensity }));
  }, []);

  const event = useCallback((type: GameVisualEventType) => {
    const id = sfxForEvent(type);
    if (id) engine()?.playSfx(id);
  }, [engine]);

  const value = useMemo<SoundContextValue>(
    () => ({ prefs, toggle, setScreen, setRunState, event }),
    [prefs, toggle, setScreen, setRunState, event],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<SoundChannel, string> = { fx: 'FX', ambient: 'AMB', music: 'MUS' };

/**
 * Three switches in the chrome bar. State is written in the label, not only
 * in the colour (§62): an off channel reads as struck through.
 */
export function SoundToggle() {
  const { prefs, toggle } = useSound();
  return (
    <div className="flex items-center h-full flex-shrink-0" role="group" aria-label="Sound">
      <span className="font-mono text-xs text-phosphor-dim tracking-widest pr-1.5 select-none">SOUND</span>
      {(['fx', 'ambient', 'music'] as SoundChannel[]).map(ch => {
        const on = prefs[ch];
        return (
          <button
            key={ch}
            type="button"
            aria-pressed={on}
            title={`${CHANNEL_LABEL[ch]} ${on ? 'on' : 'off'}`}
            onClick={() => toggle(ch)}
            className={`font-mono text-xs px-1.5 h-full transition-colors whitespace-nowrap ${
              on ? 'text-phosphor' : 'text-phosphor-dim line-through hover:text-phosphor-mid'
            }`}
          >
            {CHANNEL_LABEL[ch]}
          </button>
        );
      })}
    </div>
  );
}
