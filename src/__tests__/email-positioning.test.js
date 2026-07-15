import assert from 'node:assert/strict';
import test from 'node:test';
import { ASTRA_OUTBOUND_EMAIL_GUIDE, buildAstraOutboundDraftMessages } from '../core/email-positioning.js';

test('Astra outbound guide enforces short outcome-focused first email', () => {
  assert.match(ASTRA_OUTBOUND_EMAIL_GUIDE, /90-150 words/);
  assert.match(ASTRA_OUTBOUND_EMAIL_GUIDE, /Do not ask for a demo/);
  assert.match(ASTRA_OUTBOUND_EMAIL_GUIDE, /automate more financial work/);
  assert.match(ASTRA_OUTBOUND_EMAIL_GUIDE, /Twin World/);
});

test('draft messages include lead context and conversation goal', () => {
  const messages = buildAstraOutboundDraftMessages({ lead: { company_name: 'Acme', prospect_title: 'CFO' } });
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[1].role, 'user');
  assert.match(messages[1].content, /Acme/);
  assert.match(messages[1].content, /allowed to handle/);
});
