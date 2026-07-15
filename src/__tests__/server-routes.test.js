import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('server exposes Railway-friendly endpoint aliases', async () => {
  const server = await readFile('server.js', 'utf8');
  for (const route of ['/run-agents', '/send-emails', '/metrics', '/read-replies', '/routes', '/status', '/summary', '/decisions', '/emails', '/replies', '/meetings', '/run', '/start', '/agents/run', '/sales/run', '/workflow/start']) {
    assert.match(server, new RegExp(route.replaceAll('/', '\\/')));
  }
});
