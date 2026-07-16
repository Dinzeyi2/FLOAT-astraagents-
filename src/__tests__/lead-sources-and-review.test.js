import assert from 'node:assert/strict';
import test from 'node:test';
import { contactOutSearchFromEnv, createContactOutLeadSource, createEmailReviewQueue } from '../core/production-connectors.js';

test('reads and normalizes leads from ContactOut People Search API', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.contactout.com/v1/people/search');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.token, 'contactout_token');
    assert.deepEqual(JSON.parse(options.body).job_title, ['CFO']);
    return new Response(JSON.stringify({ profiles: { 'https://linkedin.com/in/jane': { full_name: 'Jane Doe', title: 'CFO', company: { name: 'Acme', domain: 'acme.com' }, contact_info: { work_emails: ['jane@acme.com'] } } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const leads = await createContactOutLeadSource({ apiToken: 'contactout_token', search: { job_title: ['CFO'] } }).listLeads();
    assert.equal(leads[0].company_name, 'Acme');
    assert.equal(leads[0].email, 'jane@acme.com');
    assert.equal(leads[0].prospect_title, 'CFO');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('omits ContactOut seniority and industry unless explicitly enabled', () => {
  const original = {
    CONTACTOUT_INCLUDE_SENIORITY: process.env.CONTACTOUT_INCLUDE_SENIORITY,
    CONTACTOUT_SENIORITY: process.env.CONTACTOUT_SENIORITY,
    CONTACTOUT_INCLUDE_INDUSTRY: process.env.CONTACTOUT_INCLUDE_INDUSTRY,
    CONTACTOUT_INDUSTRIES: process.env.CONTACTOUT_INDUSTRIES
  };
  process.env.CONTACTOUT_INCLUDE_SENIORITY = 'false';
  process.env.CONTACTOUT_SENIORITY = 'director,vice president,cxo';
  process.env.CONTACTOUT_INCLUDE_INDUSTRY = 'false';
  process.env.CONTACTOUT_INDUSTRIES = 'Financial Services,Fintech,Software';

  try {
    const search = contactOutSearchFromEnv();
    assert.equal('seniority' in search, false);
    assert.equal('industry' in search, false);
    assert.deepEqual(search.job_title, ['Head of Finance', 'VP Finance', 'Director of Finance', 'CFO']);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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
