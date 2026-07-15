import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleCalendarClient, createProductionDecisionCounts } from '../core/production-connectors.js';

test('books real calendar events through Google Calendar when a demo window exists', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ id: 'event_1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    await createGoogleCalendarClient({ token: 'google_token', calendarId: 'primary' }).bookDemo({ lead: { company_name: 'Acme', prospect_title: 'CFO', email: 'cfo@example.com', demo_start_at: '2026-07-15T15:00:00Z', demo_end_at: '2026-07-15T15:30:00Z' } });
    assert.equal(calls[0].url, 'https://www.googleapis.com/calendar/v3/calendars/primary/events');
    assert.equal(calls[0].options.headers.authorization, 'Bearer google_token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reads production counts from Astra dashboard', async () => {
  const counts = await createProductionDecisionCounts({ astra: { dashboard: async () => ({ total_decisions: 10, routes: { ready_for_reality: 7, review_required: 2, blocked: 1 } }) } }).read();
  assert.equal(counts.total, 10);
  assert.equal(counts.ready, 7);
});
