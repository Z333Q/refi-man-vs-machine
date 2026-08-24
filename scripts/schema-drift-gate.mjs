#!/usr/bin/env node
// ─── Schema drift gate ────────────────────────────────────────────────────────
//
// Every table a service queries must exist in the founding schema.
//
// This exists because of a defect that shipped green. The handoff service
// counted a player's machine versions by joining through a link table that the
// new schema does not have. The query throws, and loadProgress catches read
// failures and degrades to zero progress, which is the right behaviour for a
// mint endpoint and exactly what made the bug invisible: no crash, no alert,
// every token quietly carrying machineVersionCount 0 for the players who had
// done the most work.
//
// Mocked tests cannot catch that, because a mock agrees with whatever SQL it is
// handed. The integration tests catch it by running against a real database.
// This catches it in a second, without one, which means it catches it while the
// schema change is being written rather than after CI.
//
// It checks table names only. Columns need a real database, and the
// integration tests are where that is done.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: a checkout under a directory with a space in
// its name yields %20 from .pathname and every readdir fails.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCHEMA_DIR = join(ROOT, 'db', 'migrations');
const SERVICE_DIR = join(ROOT, 'services');

/** Tables the application defines. */
function schemaTables() {
  const tables = new Set();
  for (const file of readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.sql'))) {
    const sql = readFileSync(join(SCHEMA_DIR, file), 'utf8');
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
      tables.add(m[1].toLowerCase());
    }
  }
  return tables;
}

/**
 * Table references in SQL embedded in service code.
 *
 * Deliberately simple: FROM, JOIN, INSERT INTO and UPDATE, followed by a bare
 * identifier. Subqueries, CTEs and aliases are filtered out below rather than
 * parsed, because a gate that needs a SQL parser to stay correct is a gate that
 * will be wrong quietly.
 */
const REFERENCE = /\b(?:from|join|insert\s+into|update)\s+(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi;

// Words that follow FROM/JOIN without naming a table.
const NOT_A_TABLE = new Set([
  'select', 'lateral', 'unnest', 'generate_series', 'values', 'dual', 'set',
]);

/**
 * Blank out comments, keeping line numbers intact.
 *
 * Without this the gate reads prose. "exp must be <= 10 minutes from mint"
 * matched FROM followed by an identifier and reported a table called "mint",
 * which is the sort of false positive that gets a gate switched off.
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  let mode = 'code';
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (mode === 'code' && two === '/*') { mode = 'block'; out += '  '; i += 2; continue; }
    if (mode === 'block' && two === '*/') { mode = 'code'; out += '  '; i += 2; continue; }
    if (mode === 'code' && two === '//') { mode = 'line'; out += '  '; i += 2; continue; }
    if (mode === 'code' && two === '--' ) { mode = 'line'; out += '  '; i += 2; continue; }
    const ch = source[i];
    if (mode === 'line' && ch === '\n') mode = 'code';
    // Newlines always survive so reported line numbers stay true.
    out += mode === 'code' || ch === '\n' ? ch : ' ';
    i += 1;
  }
  return out;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|mjs|js|sql)$/.test(full)) out.push(full);
  }
  return out;
}

const tables = schemaTables();
if (tables.size === 0) {
  console.error('schema-drift-gate FAILED: no tables found in db/migrations');
  process.exit(1);
}

const findings = [];

for (const file of walk(SERVICE_DIR)) {
  if (/\.test\.ts$/.test(file)) continue; // tests may seed and drop freely
  const rel = relative(ROOT, file);
  const source = stripComments(readFileSync(file, 'utf8'));
  const lines = source.split('\n');

  // CTE names are defined in the file itself, so collect them before matching.
  const ctes = new Set(
    [...lines.join('\n').matchAll(/\bwith\s+([a-z_][a-z0-9_]*)\s+as\s*\(/gi)].map(m => m[1].toLowerCase()),
  );

  lines.forEach((line, i) => {
    for (const m of line.matchAll(REFERENCE)) {
      const name = m[1].toLowerCase();
      if (NOT_A_TABLE.has(name) || ctes.has(name) || tables.has(name)) continue;
      findings.push({ rel, line: i + 1, name, text: line.trim() });
    }
  });
}

if (findings.length > 0) {
  console.error('schema-drift-gate FAILED: service SQL references tables the schema does not define.\n');
  for (const f of findings) {
    console.error(`  ${f.rel}:${f.line}  unknown table "${f.name}"`);
    console.error(`    ${f.text}\n`);
  }
  console.error(`${findings.length} reference(s). Known tables: ${[...tables].sort().join(', ')}`);
  process.exit(1);
}

console.log(`schema-drift-gate OK — every table referenced by a service exists in the schema (${tables.size} tables)`);
