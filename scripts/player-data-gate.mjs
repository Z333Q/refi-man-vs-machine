#!/usr/bin/env node
// ─── Authored player data gate ────────────────────────────────────────────────
//
// A screen may hold authored CONTENT. It may never hold authored PLAYER DATA,
// and it may never present authored content as live or measured data. A
// statistic without a source is a performance claim.
//
// Salvaged from PR #29 (2026-08-25 audit ruling: extract the gate, rebuild it
// against current main, discard the rest of that branch). Two checks:
//
// 1. STRUCTURE — a module-level array literal in src/screens whose objects
//    carry a player-performance key. Content arrays (arena definitions, boot
//    lines, help sections) do not carry these keys. This caught
//    AlphaProfileScreen rendering the spec's example dimension scores as the
//    player's own, identical for everyone.
//
// 2. VOCABULARY — player-facing copy that claims live or measured provenance.
//    This is the Daily Tape defect: a rotating authored fixture presented as
//    "TODAY'S TAPE" with a "CROWD DISTRIBUTION" no player had ever produced.
//    Copy that needs these words for honest reasons carries its provenance in
//    the same string (e.g. "SAMPLE DISTRIBUTION · AUTHORED, NOT MEASURED").
//
// To allow a genuine exception, add the marker comment on the line above:
//   // player-data-gate: allow <reason>

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/screens';
const ALLOW = 'player-data-gate: allow';

// Keys that describe a player's own performance rather than authored content.
const PLAYER_KEYS = ['score', 'pnl', 'quality', 'passPct', 'sampleSize', 'conviction', 'xp', 'streak'];

// Phrases that claim live or measured provenance. Matched inside string
// literals and JSX text only, same surface as the em-dash gate's definition
// of player-facing copy.
const LIVE_CLAIMS = [
  /TODAY'?S (MARKET|TAPE|RESULT)/,
  /LIVE MARKET DATA/,
  /\bCROWD DISTRIBUTION\b/,
  /\bREAL[- ]TIME DATA\b/,
];

function allowedAbove(lines, i) {
  for (let k = i - 1; k >= 0; k--) {
    const prev = (lines[k] ?? '').trim();
    if (!prev.startsWith('//') && !prev.startsWith('{/*')) break;
    if (prev.includes(ALLOW)) return true;
  }
  return false;
}

const offences = [];
for (const file of readdirSync(DIR).filter(f => f.endsWith('.tsx')).sort()) {
  const path = join(DIR, file);
  const lines = readFileSync(path, 'utf8').split('\n');

  lines.forEach((line, i) => {
    // ── Check 2: live-provenance claims in player-facing copy ──
    // Skip pure comment lines; JSX text and string literals are what ships.
    // A line that states its provenance in the same breath (SIMULATED,
    // AUTHORED, NOT MEASURED, or an explicit negation) is the honest case
    // this gate exists to force, not an offence.
    const trimmed = line.trim();
    const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('{/*');
    const statesProvenance = /SIMULATED|AUTHORED|NOT MEASURED|NOT TODAY/.test(line);
    if (!isComment && !statesProvenance) {
      for (const claim of LIVE_CLAIMS) {
        if (claim.test(line) && !allowedAbove(lines, i)) {
          offences.push(`${path}:${i + 1}  presents authored content as live/measured: ${trimmed.slice(0, 70)}`);
        }
      }
    }

    // ── Check 1: module-level array literal carrying player keys ──
    if (!/^const [A-Z_][A-Z0-9_]* *(:[^=]*)?= *\[/.test(line)) return;
    if (allowedAbove(lines, i)) return;

    let depth = 0, body = '';
    for (let j = i; j < lines.length; j++) {
      body += lines[j] + '\n';
      depth += (lines[j].match(/\[/g) ?? []).length - (lines[j].match(/\]/g) ?? []).length;
      if (j > i && depth <= 0) break;
    }

    const found = PLAYER_KEYS.filter(k => new RegExp(`\\b${k}\\s*:\\s*[0-9'"\`]`).test(body));
    if (found.length > 0) {
      offences.push(`${path}:${i + 1}  ${line.trim().slice(0, 60)}  → authored ${found.join(', ')}`);
    }
  });
}

if (offences.length > 0) {
  console.error('player-data-gate FAILED:\n');
  for (const o of offences) console.error('  ✗ ' + o);
  console.error('\nA screen may hold authored content. It may never hold authored player');
  console.error('data, or present authored content as live or measured. Read player data');
  console.error('from state; state provenance in the copy itself; or mark a genuine');
  console.error(`exception with:  // ${ALLOW} <reason>`);
  process.exit(1);
}

console.log(`player-data-gate OK — ${readdirSync(DIR).filter(f => f.endsWith('.tsx')).length} screen(s) scanned: no authored player data, no false live claims.`);
