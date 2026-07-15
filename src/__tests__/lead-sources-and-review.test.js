import assert from 'node:assert/strict';
import test from 'node:test';
import { createContactOutLeadSource, createEmailReviewQueue } from '../core/production-connectors.js';

test('reads leads from a ContactOut-compatible API response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.authorization, 'Bearer contactout_token');
    return new Response(JSON.stringify({ contacts: [{ id: 'lead_2', company_name: 'Beta' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const leads = await createContactOutLeadSource({ apiUrl: 'https://api.contactout.test/leads', apiToken: 'contactout_token' }).listLeads();
    assert.equal(leads[0].company_name, 'Beta');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uses Resend email as the review queue', async () => {
  const sent = [];
  const email = { send: async (message) => { sent.push(message); return { outcome: 'successful' }; } };
  await createEmailReviewQueue({ email, to: 'founder@example.com' }).create({
    lead: { company_name: 'Acme', prospect_title: 'CFO' },
    draft: { subject: 'Astra for Acme' },
    route: { reality_route: 'review_required' }
  });
  assert.equal(sent[0].to, 'founder@example.com');
  assert.match(sent[0].subject, /Review required/);
});
