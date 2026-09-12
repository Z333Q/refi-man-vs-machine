// ─── Audio engine ─────────────────────────────────────────────────────────────
// The only module that touches Web Audio for assets. It owns three gain nodes
// (fx, ambient, music) under one master, a decoded-buffer cache keyed by cue
// id, and the crossfades. It knows nothing about screens or outcomes; that is
// src/lib/audioPolicy.ts. It shares the AudioContext that gestureFeedback
// unlocks, so a page has exactly one context and one unlock gesture.
//
// Everything here is best-effort. A missing file, a decode failure or a
// context that never unlocks degrades to silence. Audio is a carrier, never a
// gate.

import { getAudioContext, unlockAudio } from './gestureFeedback';
import { CHANNEL_GAIN, DUCK_FACTOR, TITLE_MUSIC, TITLE_THEME, type SoundChannel, type SoundPrefs } from './audioPolicy';

interface ManifestCue {
  id: string;
  src: string;
  loop: boolean;
}

export interface SoundEngine {
  /** Call from a real user gesture. Idempotent. */
  unlock(): void;
  applyPrefs(prefs: SoundPrefs): void;
  playSfx(id: string): void;
  /** Music cue id, TITLE_MUSIC for the intro-then-loop theme, or null. */
  setMusic(id: string | null): void;
  setAmbient(id: string | null): void;
  duck(on: boolean): void;
}

const FADE_S = 0.8;
const MANIFEST_URL = '/audio/manifest.json';

interface Voice {
  id: string;
  gain: GainNode;
  sources: AudioBufferSourceNode[];
}

export function createSoundEngine(manifestUrl: string = MANIFEST_URL): SoundEngine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const channels: Partial<Record<SoundChannel, GainNode>> = {};
  let prefs: SoundPrefs = { fx: true, ambient: true, music: false };
  let ducked = false;

  let manifest: Promise<Map<string, ManifestCue>> | null = null;
  const buffers = new Map<string, Promise<AudioBuffer | null>>();

  // Desired state, applied once the context exists and re-applied on change.
  let wantMusic: string | null = null;
  let wantAmbient: string | null = null;
  let musicVoice: Voice | null = null;
  let ambientVoice: Voice | null = null;
  // A request token so a slow decode cannot start a cue the scene has left.
  let musicToken = 0;
  let ambientToken = 0;

  function ensureGraph(): boolean {
    if (ctx && master) return true;
    const c = getAudioContext();
    if (!c) return false;
    ctx = c;
    master = c.createGain();
    master.gain.value = 1;
    master.connect(c.destination);
    for (const ch of ['fx', 'ambient', 'music'] as SoundChannel[]) {
      const g = c.createGain();
      g.connect(master);
      channels[ch] = g;
    }
    applyChannelGains();
    return true;
  }

  function channelTarget(ch: SoundChannel): number {
    if (!prefs[ch]) return 0;
    const base = CHANNEL_GAIN[ch];
    return ch === 'music' && ducked ? base * DUCK_FACTOR : base;
  }

  function applyChannelGains(): void {
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const ch of ['fx', 'ambient', 'music'] as SoundChannel[]) {
      const g = channels[ch];
      if (!g) continue;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(channelTarget(ch), now + 0.25);
    }
  }

  function loadManifest(): Promise<Map<string, ManifestCue>> {
    if (!manifest) {
      manifest = fetch(manifestUrl)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((m: { cues: ManifestCue[] }) => new Map(m.cues.map(c => [c.id, c])))
        .catch(() => new Map<string, ManifestCue>());
    }
    return manifest;
  }

  function loadBuffer(id: string): Promise<AudioBuffer | null> {
    let p = buffers.get(id);
    if (!p) {
      p = loadManifest().then(async m => {
        const cue = m.get(id);
        if (!cue || !ctx) return null;
        try {
          const res = await fetch(cue.src);
          if (!res.ok) return null;
          const bytes = await res.arrayBuffer();
          return await ctx.decodeAudioData(bytes);
        } catch {
          return null;
        }
      });
      buffers.set(id, p);
    }
    return p;
  }

  function stopVoice(v: Voice | null): void {
    if (!v || !ctx) return;
    const now = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(0, now + FADE_S);
    for (const s of v.sources) {
      try { s.stop(now + FADE_S + 0.05); } catch { /* already stopped */ }
    }
  }

  function startVoice(ch: SoundChannel, id: string, parts: { buffer: AudioBuffer; loop: boolean }[]): Voice | null {
    if (!ctx) return null;
    const out = channels[ch];
    if (!out) return null;
    const gain = ctx.createGain();
    gain.connect(out);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE_S);
    const sources: AudioBufferSourceNode[] = [];
    let at = now;
    for (const part of parts) {
      const src = ctx.createBufferSource();
      src.buffer = part.buffer;
      src.loop = part.loop;
      src.connect(gain);
      src.start(at);
      sources.push(src);
      if (!part.loop) at += part.buffer.duration;
    }
    return { id, gain, sources };
  }

  async function musicParts(id: string): Promise<{ buffer: AudioBuffer; loop: boolean }[] | null> {
    if (id === TITLE_MUSIC) {
      const [intro, loop] = await Promise.all([loadBuffer(TITLE_THEME.intro), loadBuffer(TITLE_THEME.loop)]);
      if (!loop) return null;
      return intro ? [{ buffer: intro, loop: false }, { buffer: loop, loop: true }] : [{ buffer: loop, loop: true }];
    }
    const [b, m] = await Promise.all([loadBuffer(id), loadManifest()]);
    if (!b) return null;
    // A cue the manifest marks non-looping (the closing piece) plays once and
    // leaves silence behind it rather than restarting.
    return [{ buffer: b, loop: m.get(id)?.loop ?? true }];
  }

  function applyMusic(): void {
    if (!ensureGraph()) return;
    if (musicVoice?.id === wantMusic) return;
    const token = ++musicToken;
    stopVoice(musicVoice);
    musicVoice = null;
    const id = wantMusic;
    if (!id || !prefs.music) return;
    void musicParts(id).then(parts => {
      if (token !== musicToken || !parts) return;
      musicVoice = startVoice('music', id, parts);
    });
  }

  function applyAmbient(): void {
    if (!ensureGraph()) return;
    if (ambientVoice?.id === wantAmbient) return;
    const token = ++ambientToken;
    stopVoice(ambientVoice);
    ambientVoice = null;
    const id = wantAmbient;
    if (!id || !prefs.ambient) return;
    void loadBuffer(id).then(b => {
      if (token !== ambientToken || !b) return;
      ambientVoice = startVoice('ambient', id, [{ buffer: b, loop: true }]);
    });
  }

  return {
    unlock() {
      unlockAudio();
      if (ensureGraph()) {
        applyMusic();
        applyAmbient();
      }
    },
    applyPrefs(next) {
      const musicWasOff = !prefs.music;
      const ambientWasOff = !prefs.ambient;
      prefs = { ...next };
      if (!ensureGraph()) return;
      applyChannelGains();
      // Turning a channel off fades it; turning it on has to start the voice
      // the scene already asked for.
      if (!prefs.music) { stopVoice(musicVoice); musicVoice = null; musicToken++; }
      else if (musicWasOff) applyMusic();
      if (!prefs.ambient) { stopVoice(ambientVoice); ambientVoice = null; ambientToken++; }
      else if (ambientWasOff) applyAmbient();
    },
    playSfx(id) {
      if (!prefs.fx || !ensureGraph()) return;
      void loadBuffer(id).then(b => {
        if (!b || !ctx) return;
        const out = channels.fx;
        if (!out) return;
        try {
          const src = ctx.createBufferSource();
          src.buffer = b;
          src.connect(out);
          src.start();
        } catch {
          // A refused one-shot is never worth interrupting the game for.
        }
      });
    },
    setMusic(id) {
      wantMusic = id;
      applyMusic();
    },
    setAmbient(id) {
      wantAmbient = id;
      applyAmbient();
    },
    duck(on) {
      if (ducked === on) return;
      ducked = on;
      applyChannelGains();
    },
  };
}
