#!/usr/bin/env node
// ─── Authored player data gate (CLAUDE.md §0 rule 21) ─────────────────────────
//
// A screen may hold authored CONTENT. It may never hold authored PLAYER DATA.
//
// The defect this exists to prevent shipped twice. AlphaProfileScreen rendered
// the specification's example dimension scores as though they were the
// player's own, identical for everyone, and AutopsyScreen still renders a
// fabricated four-checkpoint run history on the screen that is meant to be the
// player's audit trail. Both passed every other gate in this repo, because
// nothing here reads a screen and asks whether its numbers are earned.
//
// The check is deliberately shallow and mechanical: a module-level array
// literal in src/screens whose objects carry a player-data key. Content arrays
// (arena definitions, boot lines, help sections) do not carry these keys.
//
// To allow a genuine exception, add the marker comment on the line above the
// declaration:  // player-data-gate: allow <reason>
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/screens';
// Keys that describe a player's own performance rather than authored content.
const PLAYER_KEYS = ['score', 'pnl', 'quality', 'passPct', 'sampleSize', 'conviction', 'xp', 'streak'];
const ALLOW = 'player-data-gate: allow';

const offences = [];
for (const file of readdirSync(DIR).filter(f => f.endsWith('.tsx')).sort()) {
  const path = join(DIR, file);
  const lines = readFileSync(path, 'utf8').split('\n');

  lines.forEach((line, i) => {
    // Module-level declaration opening an array literal.
    if (!/^const [A-Z_][A-Z0-9_]* *(:[^=]*)?= *\[/.test(line)) return;
    // Scan the whole contiguous comment block above the declaration, so an
    // exception can carry a real justification rather than a one-line excuse.
    let allowed = false;
    for (let k = i - 1; k >= 0; k--) {
      const prev = (lines[k] ?? '').trim();
      if (!prev.startsWith('//')) break;
      if (prev.includes(ALLOW)) { allowed = true; break; }
    }
    if (allowed) return;

    // Read the literal to its closing bracket.
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
  console.error('player-data-gate FAILED — authored player data in a screen:\n');
  for (const o of offences) console.error('  ✗ ' + o);
  console.error('\nA screen may hold authored content. It may never hold authored player data.');
  console.error('Read it from state, or mark a genuine exception with:');
  console.error(`  // ${ALLOW} <reason>`);
  process.exit(1);
}

console.log(`player-data-gate OK — ${readdirSync(DIR).filter(f => f.endsWith('.tsx')).length} screen(s) scanned, no authored player data.`);
