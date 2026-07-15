import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOutboundEmailAction, runCuratedLeadOutboundLoop } from '../core/real-sales-loop.js';

const lead = {
  id: 'lead_1',
  company_name: 'Acme',
  prospect_title: 'CFO',
  email: 'cfo@example.com',
  prospect_email_hash: 'hash_1',
  crm_object_id: 'crm_1',
  estimated_deal_value_usd: 42000
};
const draft = { subject: 'Astra for Acme', body: 'Hi — worth a quick look?', html: '<p>Hi — worth a quick look?</p>' };

test('builds an Astra sales email action from a curated lead and draft', () => {
  const action = buildOutboundEmailAction({ lead, draft });
  assert.equal(action.operation, 'email.follow_up');
  assert.equal(action.amount_usd, 42000);
  assert.equal(action.params.company_name, 'Acme');
  assert.equal(action.params.proposed_subject, 'Astra for Acme');
  assert.equal(action.metadata.requires_astra_before_reality, true);
});

test('sends email only after Astra returns ready_for_reality and reports outcome', async () => {
  const events = [];
  const astra = {
    evaluateWorkflowAction: async () => ({ reality_route: 'ready_for_reality' }),
    reportWorkflowOutcome: async (_workflowId, outcome) => events.push(['outcome', outcome.outcome])
  };
  const ai = { draftEmail: async () => draft };
  const email = { send: async () => { events.push(['send']); return { outcome: 'successful', provider_id: 'email_1' }; } };
  const calendar = { bookDemo: async () => events.push(['calendar']) };
  const counts = { read: async () => { events.push(['counts']); return { total: 1 }; } };
  const reviewQueue = { create: async () => events.push(['review']) };
  await runCuratedLeadOutboundLoop({ lead: { ...lead, demo_start_at: '2026-07-15T15:00:00Z', demo_end_at: '2026-07-15T15:30:00Z' }, astra, ai, email, calendar, counts, reviewQueue });
  assert.deepEqual(events, [['send'], ['calendar'], ['counts'], ['outcome', 'successful']]);
});

test('routes review_required email drafts to review without sending', async () => {
  const events = [];
  const astra = {
    evaluateWorkflowAction: async () => ({ reality_route: 'review_required' }),
    reportWorkflowOutcome: async (_workflowId, outcome) => events.push(['outcome', outcome.outcome])
  };
  const ai = { draftEmail: async () => draft };
  const email = { send: async () => events.push(['send']) };
  const reviewQueue = { create: async () => events.push(['review']) };
  await runCuratedLeadOutboundLoop({ lead, astra, ai, email, reviewQueue });
  assert.deepEqual(events, [['review'], ['outcome', 'manual_review']]);
});
