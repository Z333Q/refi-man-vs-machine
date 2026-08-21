#!/usr/bin/env node
// ─── Vendor coupling gate ─────────────────────────────────────────────────────
//
// PostgreSQL moves between hosts with ordinary tooling. What does not move is
// everything built around it: a browser that speaks a vendor's query language,
// and SQL that depends on a vendor's auth schema. That work is an application
// migration rather than a database one, and it gets more expensive every week
// it is allowed to grow.
//
// So two rules, enforced rather than agreed:
//
//   1. The browser talks to the persistence port, never to a database vendor.
//      One quarantined file may still hold the legacy telemetry sink, because
//      it is the only remote write that currently succeeds and deleting it
//      would lose the data for nothing. It disappears when /v1/events exists.
//
//   2. New SQL does not depend on vendor auth. No auth.uid(), no foreign keys
//      into auth.users, no policies granted to the vendor's anon and
//      authenticated roles. Identity belongs to an application table so the
//      provider behind it can change without touching the schema.
//
// The migrations that already break rule 2 are listed below rather than fixed
// here: they are being replaced wholesale by a provider-neutral schema, and a
// gate that fails on work already scheduled for deletion teaches people to
// ignore the gate.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/** The one file allowed to import a database vendor's client. */
const VENDOR_CLIENT_ALLOWLIST = new Set([
  'src/lib/persistence/legacyEventSink.ts',
]);

/**
 * Migrations written before this rule, awaiting replacement by a
 * provider-neutral schema. Nothing may be added to this list.
 */
const LEGACY_SQL = new Set([
  'supabase/migrations/20260707233113_refi_alpha_game_schema.sql',
  'supabase/migrations/20260708002624_refi_alpha_equity_scope.sql',
  'supabase/migrations/20260708030048_refi_alpha_tip_states.sql',
  'supabase/migrations/20260716140000_owner_scoped_rls_rewrite.sql',
  'supabase/migrations/20260716150000_canonical_objects.sql',
]);

const VENDOR_IMPORT = /@supabase\/supabase-js/;
const VENDOR_SQL = [
  { pattern: /auth\.uid\(\)/, what: 'auth.uid()' },
  { pattern: /auth\.users/, what: 'auth.users' },
  { pattern: /\bTO\s+(anon|authenticated)\b/i, what: 'vendor role grant (anon / authenticated)' },
];

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, test, out);
    else if (test(full)) out.push(full);
  }
  return out;
}

const findings = [];

// ── Rule 1: no vendor client in the application ──────────────────────────────
for (const file of walk(join(ROOT, 'src'), f => /\.tsx?$/.test(f))) {
  const rel = relative(ROOT, file);
  if (VENDOR_CLIENT_ALLOWLIST.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (VENDOR_IMPORT.test(line)) {
      findings.push({
        rel, line: i + 1, text: line.trim(),
        rule: 'the browser talks to the persistence port, not a database vendor',
      });
    }
  });
}

// ── Rule 2: no vendor auth in new SQL ────────────────────────────────────────
const sqlDirs = [join(ROOT, 'db'), join(ROOT, 'supabase')];
for (const dir of sqlDirs) {
  for (const file of walk(dir, f => f.endsWith('.sql'))) {
    const rel = relative(ROOT, file);
    if (LEGACY_SQL.has(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.trim().startsWith('--')) return;
      for (const { pattern, what } of VENDOR_SQL) {
        if (pattern.test(line)) {
          findings.push({
            rel, line: i + 1, text: line.trim(),
            rule: `new SQL does not depend on vendor auth (${what})`,
          });
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error('vendor-coupling-gate FAILED\n');
  for (const f of findings) {
    console.error(`  ${f.rel}:${f.line}`);
    console.error(`    ${f.text}`);
    console.error(`    rule: ${f.rule}\n`);
  }
  console.error(`${findings.length} violation(s).`);
  process.exit(1);
}

console.log('vendor-coupling-gate OK');
console.log(`  ✓ no vendor database client outside ${VENDOR_CLIENT_ALLOWLIST.size} quarantined file(s)`);
console.log(`  ✓ no vendor auth in SQL outside ${LEGACY_SQL.size} legacy migration(s) awaiting replacement`);
