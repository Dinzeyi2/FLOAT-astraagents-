import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('server exposes Autonomous X Growth Agent routes', async () => {
  const server = await readFile('server.js', 'utf8');
  for (const route of ['/x/summary', '/api/x/summary', '/x/decisions', '/api/x/decisions', '/twitter/summary', '/api/twitter/summary', '/x/actions', '/start', '/stop', '/status']) {
    assert.match(server, new RegExp(route.replaceAll('/', '\\/')));
  }
});
