import assert from 'node:assert/strict';
import test from 'node:test';
import { createAstraClient, evaluateThenMaybeExecute, routeToExecution } from '../core/astra-client.js';

test('requires Astra Cloud or Private base URL', () => {
  assert.throws(() => createAstraClient({ apiKey: 'key', worldId: 'sales_world' }), /ASTRA_BASE_URL/);
});

test('requires an Astra API key and world ID', () => {
  assert.throws(() => createAstraClient({ baseUrl: 'https://app.codeastra.dev', worldId: 'sales_world' }), /ASTRA_API_KEY/);
  assert.throws(() => createAstraClient({ baseUrl: 'https://app.codeastra.dev', apiKey: 'sk_test' }), /ASTRA_WORLD_ID/);
});

test('posts workflow actions to the documented Astra Twin endpoint', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ root_object: 'workflow_twin_action', reality_route: 'ready_for_reality' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const client = createAstraClient({ baseUrl: 'https://app.codeastra.dev/', apiKey: 'sk_test', worldId: 'sales_world' });
    const result = await client.evaluateWorkflowAction('autonomous_sales_team', { operation: 'email.follow_up', amount_usd: 1000 });
    assert.equal(calls[0].url, 'https://app.codeastra.dev/v1/sk_test/sales_world/astra/workflows/autonomous_sales_team/twin/actions');
    assert.equal(JSON.parse(calls[0].options.body).operation, 'email.follow_up');
    assert.equal(result.reality_route, 'ready_for_reality');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('maps Astra routes to execution decisions', () => {
  assert.equal(routeToExecution({ reality_route: 'ready_for_reality' }), 'execute');
  assert.equal(routeToExecution({ reality_route: 'review_required' }), 'review');
  assert.equal(routeToExecution({ reality_route: 'blocked' }), 'block');
});

test('executes and reports outcome only after Astra returns ready_for_reality', async () => {
  const events = [];
  const astra = {
    evaluateWorkflowAction: async () => ({ reality_route: 'ready_for_reality' }),
    reportWorkflowOutcome: async (_workflowId, outcome) => events.push(['outcome', outcome.outcome])
  };
  const result = await evaluateThenMaybeExecute({
    astra,
    workflowId: 'autonomous_sales_team',
    action: { operation: 'email.follow_up', amount_usd: 1000, params: { customer_id: 'cus_1' }, finance_schema: 'sales_pipeline_action' },
    executeRealAction: async () => { events.push(['execute']); return 'successful'; },
    sendToReview: async () => 'manual_review',
    blockAction: async () => 'blocked'
  });
  assert.deepEqual(events, [['execute'], ['outcome', 'successful']]);
  assert.equal(result.executionRoute, 'execute');
});
