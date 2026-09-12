# Generation prompts for the missing cues

Companion to `cues.json` and the coverage table in `README.md`. Cue numbers
follow the 50-cue production prompt set. Every asset must satisfy the house
rule: institutional finance, Manhattan offices, exchange floors and computer
systems from roughly 1985 to 1992. No casino, coins, slot machines, fanfares,
smartphone notifications, synthwave, EDM, parody, comedy, or trailer effects.

Suno: Instrumental on, WAV download, the Exclude line goes in the
exclude-styles field. Suno cannot hear the existing 9:30 theme, so for cues 12
and 13 generate several takes and pick the closest motif, or seed with the
first 30 seconds of `masters/0930-theme.wav` via audio upload.

Section 61A: cue 10 is rewritten as an outcome-neutral resolution cue. A win
sting cannot be scheduled by the policy and would join `machine-beats-player`
on the barred list.

## Music (Suno)

### 2. Main Menu, The Firm
Style: Instrumental 1980s corporate finance atmosphere, 76 BPM. Minimal FM synth chords, clean digital piano, muted analog bass, sparse LinnDrum-style percussion, subtle glassy bell tones. Sophisticated, expensive, clinical, emotionally restrained. Manhattan investment bank lobby, polished marble, smoked glass, market terminals. Low intensity, no dramatic melody. A recurring three-note identity motif, cold and precise, stated on FM keys every 16 bars. Seamless loop, 60 to 90 seconds, no intro, no ending.
Exclude: vocals, synthwave, arpeggios, rock guitar, funk bass, sentimental chords, cinematic impacts, drum fills, reverb tails, fade out

### 4. Historical Briefing, The Tape
Style: Instrumental late-1980s financial newsroom underscore, 70 BPM. Low digital pad, restrained piano fragments, soft ticking pulse, muted electronic toms, occasional short brass swell, a teletype-like rhythmic texture woven in musically. Serious, analytical, emotionally neutral. Lots of space for text on screen. Mild anticipation with no bias about whether the market rises or falls. Seamless loop, 75 to 100 seconds, no intro, no ending.
Exclude: vocals, crescendos, strings, action percussion, synthwave, melody, fade out

### 10. Checkpoint Resolved (replaces Player Beats Machine)
Style: Short 6 to 8 second late-1980s financial terminal resolution cue. Cold FM synth chord settles into a neutral sustained tone, one low analog bass note, a single muted brass accent, faint exchange-floor air underneath. Communicates that a result has been computed and is now on the record. Neither triumph nor loss. Ends cleanly with under half a second of tail.
Exclude: fanfare, casino, applause, arcade, vocals, major-key resolution, minor-key sting, drums

### 12. Results Screen, After Hours
Style: Instrumental late-1980s Manhattan after-hours finance cue, 72 BPM. Sparse digital piano, low analog bass, cold atmospheric synth pad, soft electronic percussion, subtle glassy FM tones. Reflective, analytical, detached. An empty trading floor at night, monitors still glowing, final numbers under review. A four-note motif on FM keys stated at half speed, cold and precise. Seamless 90-second loop, no intro, no ending.
Exclude: vocals, saxophone, synthwave, sentimental, cinematic ending, strings, fade out

### 13. Final Session Score
Style: Instrumental late-1980s corporate finance closing cue, 78 BPM. Opens with a four-note motif alone on clean FM keys, cold and precise. Warm analog bass and restrained electronic percussion enter after 8 seconds. A fuller harmonic version of the motif is revealed gradually. Performance being measured, not judged. Serious, quantitative, professional. 30 to 45 seconds with a clean ending.
Exclude: fanfare, vocals, emotional swell, strings, synthwave, cymbal crash, big finish

## Ambience beds (Suno, Instrumental on)

### 14. Trading Floor Bed
Style: Sound design only, no music. Late-1980s New York equities trading floor ambience. Large indoor exchange hall, dozens of distant indistinct voices overlapping, order calls without words, intermittent phone rings, paper handling, footsteps, distant printers, room reverberation. Continuous, no foreground events. 60-second seamless loop.
Exclude: music, melody, drums, intelligible speech, modern electronics, sirens

### 15. Calm Trading Floor
Style: Sound design only, no music. Large 1980s securities trading room before peak activity. Low conversation murmur, occasional telephone ring, paper movement, distant dot-matrix printer, chair movement, subdued order calls. Professional office acoustics. 30-second seamless loop.
Exclude: music, melody, drums, intelligible speech, shouting, modern notifications

### 33. Fluorescent Office Hum
Style: Sound design only, no music. Quiet late-1980s corporate office at night. Low fluorescent ballast hum, faint HVAC airflow, distant electrical room tone. Subtle, unobtrusive. 30-second seamless loop.
Exclude: music, voices, computers, melody, drones with pitch movement

### 46. Newsroom Radio Texture
Style: Sound design only, no music. Late-1980s financial television newsroom heard faintly through a wall. Indistinct male and female announcer cadence, broadcast compression, low intelligibility, soft static. 20-second seamless loop.
Exclude: music, intelligible words, brand names, jingles, modern audio

## Interface SFX (dedicated SFX generator, not Suno)

Append to every prompt: dry, late-1980s financial office, no music, no modern UI chime.

- 17 Phone ring: single 1980s American desk phone ring, dual-tone electronic bell, plastic body resonance, one cycle
- 18 Phone pickup: hard-plastic handset lifted from cradle, switch click, under one second
- 19 Phone hang-up: heavy handset placed firmly on cradle, plastic impact then switch click
- 20 Dot-matrix printer: print head burst left-right, tractor feed advance, pause, second burst, 4 seconds
- 22 Teletype: electronic market teletype, rapid key strikes, paper advance, motor, occasional mechanical bell, 10-second loop
- 23 CRT power on: switch click, rising electrical hum, faint high whine, static discharge, under 2 seconds
- 24 Terminal keypress: single firm mechanical keypress, thick keycap, muted desk resonance
- 25 Confirmation beep: single clean beep 1000 Hz, 150 ms, slight hardware roughness
- 26 Warning beep: two dry descending electronic beeps, restrained, under one second
- 27 Ticket tear: heavy paper order ticket torn cleanly along perforation, close mic
- 28 Paper stack: several sheets placed firmly on a wood desk, light slide, muted impact
- 29 Calculator: five rapid plastic key presses then one larger enter key, spring noise
- 30 Fax start: short handshake tone sequence, paper feed engages, small motor, 4 seconds
- 32 Clock tick: quiet analog office wall clock, one tick per second, slight room tone, 10-second loop
- 34 Elevator arrival: muted mechanical stop, single restrained electronic chime, heavy metal doors open, 3 seconds
- 36 Data update: tiny mechanical tick with faint electronic pulse, 150 ms
- 37 Price up tick: dry high-mid electronic tick with slight upward pitch, under 200 ms
- 38 Price down tick: dry lower electronic tick with slight downward pitch, under 200 ms
- 39 Position opened: relay click, terminal beep, soft low pulse, under one second
- 40 Position closed: relay click, slightly lower terminal tone, short digital tail, under one second
- 41 Risk limit: three short restrained electronic pulses then one low tone, institutional not alarming, 1.5 seconds
- 43 Score tick: single dry mechanical-electronic tick, 100 ms, neutral
- 44 Era transition: low analog synth swell, brief tape-machine texture, one muted electronic impact, 2.5 seconds
- 45 Newspaper: folded newspaper snapped open on a desk, page rustle, 1.5 seconds
- 49 Help open: single soft FM bell tone with subtle key click, under half a second

Notes. 37 and 38 encode price direction, which is information rather than
outcome; keep their levels identical. 43 must play at one fixed rate regardless
of the score value, or it becomes the slot reel section 61A bars.
