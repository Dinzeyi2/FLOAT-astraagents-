import assert from 'node:assert/strict';
import test from 'node:test';
import { createOpenAIClient, extractOutputText } from '../core/openai-client.js';

test('extracts Responses API output text', () => {
  assert.equal(extractOutputText({ output: [{ content: [{ type: 'output_text', text: 'Useful reply' }] }] }), 'Useful reply');
});

test('OpenAI client requests a contextual draft through Responses API', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-4.1-mini');
    assert.match(body.instructions, /Mention Astra only/);
    return new Response(JSON.stringify({ id: 'resp_1', output_text: 'Start by separating the proposed approval from execution, then route uncertain cases to review.' }), { status: 200 });
  };
  try {
    const client = createOpenAIClient({ apiKey: 'test-key', baseUrl: 'https://api.openai.com/v1' });
    const draft = await client.draftReply({ post: { text: 'How do we automate invoice approvals?' }, path: { current_blocker: 'manual reviews' }, recommendation: { mention_astra: false } });
    assert.match(draft.text, /separating/);
    assert.equal(draft.response_id, 'resp_1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
