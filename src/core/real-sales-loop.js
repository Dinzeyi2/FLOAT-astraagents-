import { createAstraClient, evaluateThenMaybeExecute } from './astra-client.js';
import { buildAstraOutboundDraftMessages } from './email-positioning.js';
import { SALES_FINANCE_SCHEMA, SALES_WORKFLOW_ID } from './sales-team.js';
import { createLeadSourceFromEnv, createProductionDecisionCounts, createReviewQueueFromEnv } from './production-connectors.js';

export function buildOutboundEmailAction({ lead, agentId = 'sales-rep-001', draft }) {
  return {
    operation: 'email.follow_up',
    amount_usd: lead.estimated_deal_value_usd ?? 0,
    params: {
      agent_id: agentId,
      company_name: lead.company_name,
      prospect_title: lead.prospect_title,
      prospect_email_hash: lead.prospect_email_hash,
      crm_object_id: lead.crm_object_id,
      proposed_subject: draft.subject,
      proposed_body: draft.body
    },
    finance_schema: SALES_FINANCE_SCHEMA,
    metadata: {
      source: 'curated_lead_outbound_loop',
      requires_astra_before_reality: true,
      lead_id: lead.id
    }
  };
}

export async function draftPersonalizedEmail({ lead, ai }) {
  return ai.draftEmail({ lead });
}

export async function runCuratedLeadOutboundLoop({ lead, astra, ai, email, reviewQueue, counts, agentId = 'sales-rep-001' }) {
  assertLeadIsSendable(lead);
  const draft = await draftPersonalizedEmail({ lead, ai });
  const action = buildOutboundEmailAction({ lead, agentId, draft });

  return evaluateThenMaybeExecute({
    astra,
    workflowId: SALES_WORKFLOW_ID,
    action,
    executeRealAction: async (route) => {
      const message = withCalendlyLink(draft);
      const sendResult = await email.send({
        to: lead.email,
        subject: message.subject,
        html: message.html ?? message.body,
        text: message.body,
        tags: [{ name: 'astra_route', value: route.reality_route }, { name: 'lead_id', value: lead.id }]
      });
      const productionCounts = counts ? await counts.read() : undefined;
      return { outcome: sendResult.outcome ?? 'successful', sendResult, productionCounts };
    },
    sendToReview: async (route) => {
      await reviewQueue.create({ lead, draft, route, action });
      return 'manual_review';
    },
    blockAction: async (route) => {
      await reviewQueue.create({ lead, draft, route, action, blocked: true });
      return 'blocked';
    }
  });
}

export function createOpenAICompatibleDraftClient({
  baseUrl = process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
  apiKey = process.env.AI_API_KEY,
  model = process.env.AI_MODEL ?? 'gpt-5.6-luna'
} = {}) {
  if (!apiKey) throw new Error('AI_API_KEY is required to draft real personalized email.');
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return {
    async draftEmail({ lead }) {
      const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: buildAstraOutboundDraftMessages({ lead })
        })
      });
      if (!response.ok) throw new Error(`AI draft failed with ${response.status}: ${await response.text()}`);
      const payload = await response.json();
      return JSON.parse(payload.choices[0].message.content);
    }
  };
}

export function createResendEmailClient({ apiKey = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM } = {}) {
  if (!apiKey) throw new Error('RESEND_API_KEY is required to send real email.');
  if (!from) throw new Error('EMAIL_FROM is required to send real email.');

  return {
    async send({ to, subject, html, text, tags = [], from: messageFrom }) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: messageFrom ?? from, to, subject, html, text, tags })
      });
      if (!response.ok) throw new Error(`Email send failed with ${response.status}: ${await response.text()}`);
      const payload = await response.json();
      return { outcome: 'successful', provider: 'resend', provider_id: payload.id };
    }
  };
}

export function createConsoleReviewQueue() {
  return {
    async create(item) {
      console.log(JSON.stringify({ type: 'review_required', item }, null, 2));
      return { outcome: item.blocked ? 'blocked' : 'manual_review' };
    }
  };
}

export function createProductionLoopFromEnv() {
  const astra = createAstraClient();
  const email = createResendEmailClient();
  return {
    leadSource: createLeadSourceFromEnv(),
    astra,
    ai: createOpenAICompatibleDraftClient(),
    email,
    reviewQueue: createReviewQueueFromEnv({ email }),
    counts: createProductionDecisionCounts({ astra })
  };
}


function withCalendlyLink(draft) {
  const calendlyLink = process.env.CALENDLY_LINK ?? 'https://calendly.com/mpakaobed90/30min';
  if (!calendlyLink || draft.body?.includes(calendlyLink)) return draft;
  const body = `${draft.body}

If it is useful to compare notes, you can grab 30 minutes here: ${calendlyLink}`;
  const html = draft.html ? `${draft.html}<p>If it is useful to compare notes, you can grab 30 minutes here: <a href="${calendlyLink}">${calendlyLink}</a></p>` : body;
  return { ...draft, body, html };
}

function assertLeadIsSendable(lead) {
  const required = ['id', 'company_name', 'prospect_title', 'email', 'prospect_email_hash'];
  const missing = required.filter((field) => !lead[field]);
  if (missing.length) throw new Error(`Lead is missing required fields: ${missing.join(', ')}`);
}
