import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Migration literal validation ─────────────────────────────────────────────
// The defect this exists to prevent: a migration carried a sentinel UUID with
// 13 hex digits in its final group instead of 12. Postgres rejected it with
// 22P02 and the malformed literal aborted the entire migration, which at the
// time was the one installing the security floor. Nothing reported it, because
// no migration had ever been run against a real instance.
//
// The migration in question is gone, replaced by a provider-neutral founding
// schema, but the class of defect is not: a literal that only a database can
// reject still costs a failed deploy to discover. This is the cheapest check
// that catches it without a database.
//
// db/schema.test.ts covers what this cannot, by applying the schema to a real
// PostgreSQL, and is skipped when DATABASE_URL is unset.

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
}

/** Anything that looks like someone intended a UUID: 5 hyphen-separated hex groups. */
const UUID_SHAPED = /'([0-9a-fA-F]{4,12}(?:-[0-9a-fA-F]{2,14}){4})'/g;
const VALID_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

test('the migrations directory is present and non-empty', () => {
  const files = migrationFiles();
  assert.ok(files.length > 0, 'no migrations found');
});

test('every UUID-shaped literal in every migration is a valid UUID', () => {
  const failures: string[] = [];

  for (const file of migrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    for (const match of sql.matchAll(UUID_SHAPED)) {
      const literal = match[1];
      if (VALID_UUID.test(literal)) continue;
      const groups = literal.split('-').map(g => g.length);
      failures.push(
        `${file}: '${literal}' has group lengths [${groups}], expected [8,4,4,4,12]`,
      );
    }
  }

  assert.deepEqual(failures, [], `malformed UUID literals:\n  ${failures.join('\n  ')}`);
});

test('migrations are named so alphabetical order is execution order', () => {
  // The filename is the only thing carrying the ordering, so it has to lead
  // with a zero-padded sequence. A file without one would silently run in the
  // wrong place.
  for (const file of migrationFiles()) {
    assert.match(file, /^\d{4,}_[a-z0-9_]+\.sql$/, `${file} is not sequence-prefixed`);
  }
});
