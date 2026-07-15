import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductionDecisionCounts } from '../core/production-connectors.js';

test('reads production counts from Astra dashboard', async () => {
  const counts = await createProductionDecisionCounts({ astra: { dashboard: async () => ({ total_decisions: 10, routes: { ready_for_reality: 7, review_required: 2, blocked: 1 } }) } }).read();
  assert.equal(counts.total, 10);
  assert.equal(counts.ready, 7);
});
