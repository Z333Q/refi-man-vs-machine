#!/usr/bin/env node
// Encodes audio/masters/*.wav into public/audio/{music,ambience,sfx}/ per
// audio/cues.json, and writes public/audio/manifest.json for the client.
//
// Masters are the only editable source. Never encode from a production file.
//
// Usage:  node scripts/audio-build.mjs [--only <id>] [--dry]
// Needs:  ffmpeg with libopus + libvorbis. Set FFMPEG=/path/to/ffmpeg if it
//         is not on PATH.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const MASTERS = path.join(ROOT, 'audio', 'masters');
const OUT = path.join(ROOT, 'public', 'audio');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const dry = args.includes('--dry');

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio', 'cues.json'), 'utf8'));

function probeDuration(file) {
  // ffmpeg prints Duration to stderr; ffprobe is not guaranteed alongside a static binary.
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    const m = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(String(e.stderr));
    if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  }
  return null;
}

const manifest = { generatedAt: new Date().toISOString(), sampleRate: 48000, cues: [] };
let built = 0;

for (const cue of spec.cues) {
  if (only && cue.id !== only) continue;
  const enc = spec.encode[cue.kind];
  if (!enc) throw new Error(`${cue.id}: unknown kind ${cue.kind}`);
  const src = path.join(MASTERS, cue.master);
  if (!fs.existsSync(src)) {
    console.warn(`SKIP ${cue.id}: master missing (${cue.master})`);
    continue;
  }
  const rel = `${cue.kind}/${cue.id}.${enc.ext}`;
  const dst = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });

  const ff = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (cue.trim?.start != null) ff.push('-ss', String(cue.trim.start));
  if (cue.trim?.end != null) ff.push('-to', String(cue.trim.end));
  ff.push('-i', src, '-vn', '-ar', '48000', '-c:a', enc.codec);
  if (enc.codec === 'libopus') ff.push('-b:a', enc.bitrate, '-application', 'audio', '-vbr', 'on');
  if (enc.codec === 'libvorbis') ff.push('-q:a', enc.quality);
  // Loops: no fades, no padding. Opus pre-skip is handled by decodeAudioData.
  ff.push(dst);

  if (dry) {
    console.log(`${cue.id.padEnd(22)} -> ${rel}`);
  } else {
    execFileSync(FFMPEG, ff, { stdio: 'inherit' });
    built++;
    const bytes = fs.statSync(dst).size;
    console.log(`${cue.id.padEnd(22)} -> ${rel.padEnd(34)} ${(bytes / 1024).toFixed(0).padStart(6)} KB`);
  }

  manifest.cues.push({
    cue: cue.cue,
    id: cue.id,
    title: cue.title,
    kind: cue.kind,
    src: `/audio/${rel}`,
    loop: !!cue.loop,
    durationSec: dry ? null : probeDuration(dst),
    master: cue.master,
  });
}

if (!dry) {
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n${built} files encoded. Manifest: public/audio/manifest.json`);
}
