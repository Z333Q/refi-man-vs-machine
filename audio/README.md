# Audio pipeline

Sonic identity: institutional finance, Manhattan corporate offices, exchange
floors and computer systems from roughly 1985 to 1992. No casino, coins, slot
machines, fanfares, smartphone notifications, synthwave, EDM, parody or trailer
effects. The four-note motif from the 9:30 title theme is the ReFi audio
signature; altered versions belong in the menu, machine reveal, final score and
results cues.

## Layout

```text
audio/
  masters/        WAV source assets. Gitignored. Backed up by Dropbox. Never delete.
  cues.json       Source of truth: cue number, master, output kind, trim, loop.
  README.md
public/audio/
  music/          Opus, 160 kbps, 48 kHz
  ambience/       Opus, 112 kbps, 48 kHz
  sfx/            OGG Vorbis, q5 (about 160 kbps), 48 kHz
  manifest.json   Generated. Cue id, src, loop flag, duration.
scripts/audio-build.mjs
```

## Rules

1. Every edit, trim, normalisation or loop adjustment starts from `audio/masters/`.
   Never re-encode a production file.
2. Loops carry no fades and no padding. MP3 is not a production format because
   its encoder padding breaks seamless loops.
3. Masters should be WAV, 48 kHz, 16 or 24 bit. Suno: choose WAV, not MP3.
4. Production files are rebuilt, not hand-edited: `npm run audio:build`.
5. The build needs ffmpeg with libopus and libvorbis. Homebrew cannot install it
   on a Mac whose Command Line Tools are older than the OS; a static build from
   evermeet.cx works with `FFMPEG=/path/to/ffmpeg npm run audio:build`.

## Title theme

The 9:30 master is 3:00. The title screen plays `0930-intro.opus` (0:00 to 0:30)
once, then repeats `0930-loop.opus` (0:30 to 1:30). `0930-full.opus` is the whole
render for a finale or credits. The loop point is the spec default and has not
been confirmed by ear.

## Coverage against the 50-cue production prompt set

Delivered and mapped (cue numbers from the prompt set):

| Cue | Slot | Master | Status |
|---|---|---|---|
| 1 | Title Theme, 9:30 | 0930-theme.wav | intro, loop and full encoded |
| 2 | Main Menu, The Firm | the-firm.wav | builder screens |
| 3 | Arena Map, Capital Moves | capital-moves.wav, capital-moves-alt.wav | two takes, choose one |
| 4 | Historical Briefing, The Tape | the-tape.wav | briefing screens |
| 5 | Decision Screen, The Position | the-position.wav, the-position-alt.wav | two takes, choose one |
| 6 | Order Submitted | order-submitted.wav | ok |
| 7 | Market Opens, The Floor | the-floor.wav | loop-in point after the build not set |
| 8 | High Volatility, Margin | margin.wav | ok |
| 9 | Machine Reveal | machine-reveal.wav | ok |
| 10 | Market Open (rewritten, outcome-neutral) | market-open.wav | plays on entering a run |
| 11 | Machine Beats Player | machine-beats-player.wav | encoded, barred by policy (61A) |
| 12 | Results Screen, After Hours | after-hours.wav | review screens |
| 13 | Final Session Score | final-score.mp4 | plays once at run complete; AAC source, replace with WAV |
| 14 | Trading Floor Bed | trading-floor-bed.wav | encoded, not yet scheduled |
| 15 | Calm Trading Floor | trading-floor-calm.m4a | briefing and calm decisions; Opus source, replace with WAV |
| 16 | Panic Trading Floor | trading-floor-panic.wav | stress decisions |
| 21 | Continuous Market Printer | printer-continuous.wav | market advance |
| 31 | Exchange Bell | exchange-bell.wav | 9 s master against a 2 to 3 s spec, trim to one strike |
| 33 | Fluorescent Office Hum | office-hum.wav | hub, review and builder screens |
| 35 | Executive Office Door | office-door-close.wav | 10 s master, needs trim to 2 s; not yet scheduled |
| 42 | Machine Calculation | machine-calculation.wav | ok |
| 47 | Big Market Shock | market-shock.mp4 | AAC source, replace with WAV |
| 48 | Successful Risk Control | risk-control-ok.wav | 12 s master, needs trim; not yet scheduled |
| 50 | Return to Arena Map | return-to-map.wav | ok |
| none | Market Watch (start) | market-watch-start.wav | unmapped spare |

Still to generate (prompts in PROMPTS.md):

- Ambience: 46 Newsroom Radio Texture.
- SFX: 17 to 20, 22 to 30, 32, 34, 36 to 41, 43 to 45, 49.

Tempo of each music master was measured by onset autocorrelation and recorded as
`bpmMeasured` in cues.json where it informed the mapping.

## In the game

Three channels, each with its own switch in the chrome bar (`SOUND FX AMB MUS`),
persisted in localStorage under `refi_sound`. Interface sound and ambience are
on by default; music is opt-in. Nothing plays before the first pointer or key
gesture.

- `src/lib/audioPolicy.ts` decides what each screen and run state sounds like.
  Pure, tested. It is the only place a cue id is named.
- `src/lib/audioEngine.ts` owns the Web Audio graph, buffer cache and
  crossfades, on the same AudioContext the gesture feedback unlocks.
- `src/context/SoundContext.tsx` holds the switches and drives the engine from
  what App and the core loop report.

Section 61A applies: the machine reveal and the closing bell are the same cue
on every result, outcome visual events are silent, and `machine-beats-player`
is on the policy's barred list. The policy test proves both.
