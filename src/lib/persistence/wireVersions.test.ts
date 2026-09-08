import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { RUN_RECORD_VERSION } from '../runRecord';
import { MACHINE_RECORD_VERSION } from '../machineVersions';

// The client and the persistence API each declare the record version they
// speak, in two packages that CI tests separately. Nothing else holds the
// two together: the endgame merge bumped the client's run record to v3, the
// server kept refusing everything but v2, every suite stayed green, and
// production rejected every run write until a live check noticed. This test
// is the missing joint. It reads the server's constant as text because the
// service is its own package, deliberately outside the client's module
// graph; a shared module would be the coupling the service was built to
// avoid.

const SERVER_CONTRACT = fileURLToPath(new URL(
  '../../../services/persistence-api/src/contract.ts', import.meta.url));

function serverConstant(name: string): number {
  const source = readFileSync(SERVER_CONTRACT, 'utf8');
  const match = new RegExp(`export const ${name} = (\\d+);`).exec(source);
  assert.ok(match, `${name} is declared in the server contract`);
  return Number(match[1]);
}

test('the persistence API accepts the run record version the client writes', () => {
  assert.equal(serverConstant('RUN_RECORD_VERSION'), RUN_RECORD_VERSION,
    'bump services/persistence-api/src/contract.ts (and migrate its schema) with the client');
});

test('the persistence API accepts the machine record version the client writes', () => {
  assert.equal(serverConstant('MACHINE_RECORD_VERSION'), MACHINE_RECORD_VERSION);
});
