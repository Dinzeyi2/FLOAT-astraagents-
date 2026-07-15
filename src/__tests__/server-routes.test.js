import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('server exposes Railway-friendly endpoint aliases', async () => {
  const server = await readFile('server.js', 'utf8');
  assert.match(server, /\/run-agents/);
  assert.match(server, /\/send-emails/);
  assert.match(server, /\/metrics/);
  assert.match(server, /\/read-replies/);
  assert.match(server, /\/routes/);
});
