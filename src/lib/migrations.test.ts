import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Migration literal validation ─────────────────────────────────────────────
// The defect this exists to prevent: the owner-scoped RLS rewrite carried a
// sentinel UUID with 13 hex digits in its final group instead of 12. Postgres
// rejected it with 22P02, and because the surrounding handler only catches
// `insufficient_privilege`, the malformed literal aborted the entire migration.
//
// The consequence was larger than a failed script. That migration installs the
// owner-scoped row-level security floor, so for as long as the typo existed the
// security model could not be applied to any database at all, and nothing
// reported it: the project's Supabase credentials were placeholders, so no
// migration had ever been run against a real instance.
//
// SQL is not exercised by any other test in this repo. This is the cheapest
// check that catches the whole class: every UUID-shaped literal in every
// migration must actually parse as a UUID.

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

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
  // They are applied by hand through the SQL editor, so the filename is the
  // only thing carrying the ordering. A file that does not lead with a
  // sortable timestamp would silently run in the wrong place.
  for (const file of migrationFiles()) {
    assert.match(file, /^\d{14}_[a-z0-9_]+\.sql$/, `${file} is not timestamp-prefixed`);
  }
});

test('the quarantine sentinel is identical everywhere it appears', () => {
  // It is written three times in one file: a comment, the auth.users insert,
  // and the orphan-row backfill. If the insert and the backfill ever disagree,
  // the backfill points at a row that does not exist and the FK fails.
  const file = migrationFiles().find(f => f.includes('owner_scoped_rls_rewrite'));
  assert.ok(file, 'owner_scoped_rls_rewrite migration not found');

  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  const sentinels = [...sql.matchAll(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g)]
    .map(m => m[1]);

  assert.ok(sentinels.length >= 3, `expected at least 3 sentinel occurrences, found ${sentinels.length}`);
  assert.equal(new Set(sentinels).size, 1, `sentinel disagrees across occurrences: ${[...new Set(sentinels)].join(', ')}`);
});
