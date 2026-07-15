export function createContactOutLeadSource({
  apiUrl = process.env.CONTACTOUT_API_URL,
  apiToken = process.env.CONTACTOUT_API_TOKEN
} = {}) {
  if (!apiUrl) throw new Error('CONTACTOUT_API_URL is required for ContactOut lead sourcing.');
  if (!apiToken) throw new Error('CONTACTOUT_API_TOKEN is required for ContactOut lead sourcing.');
  return {
    async listLeads() {
      const response = await fetch(apiUrl, { headers: { authorization: `Bearer ${apiToken}`, accept: 'application/json' } });
      if (!response.ok) throw new Error(`ContactOut lead source failed with ${response.status}: ${await response.text()}`);
      const payload = await response.json();
      return payload.leads ?? payload.contacts ?? payload.data ?? [];
    }
  };
}

export function createLeadSourceFromEnv() {
  return createContactOutLeadSource();
}

export function createGoogleCalendarClient({ token = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN, calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary' } = {}) {
  if (!token) throw new Error('GOOGLE_CALENDAR_ACCESS_TOKEN is required for real calendar booking.');
  return {
    async bookDemo({ lead }) {
      if (!lead.demo_start_at || !lead.demo_end_at) return { skipped: true, reason: 'No demo window on lead.' };
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          summary: `Astra demo with ${lead.company_name}`,
          description: `Booked by Astra-gated autonomous sales loop for ${lead.prospect_title}.`,
          start: { dateTime: lead.demo_start_at },
          end: { dateTime: lead.demo_end_at },
          attendees: [{ email: lead.email }]
        })
      });
      if (!response.ok) throw new Error(`Google Calendar booking failed with ${response.status}: ${await response.text()}`);
      return response.json();
    }
  };
}

export function createEmailReviewQueue({ email, to = process.env.REVIEW_EMAIL, from = process.env.EMAIL_FROM } = {}) {
  if (!email) throw new Error('An email client is required for the email review queue.');
  if (!to) throw new Error('REVIEW_EMAIL is required for the email review queue.');
  return {
    async create({ lead, draft, route, blocked = false }) {
      return email.send({
        to,
        subject: `${blocked ? 'Blocked' : 'Review required'}: Astra sales action for ${lead.company_name}`,
        html: `<p><strong>${blocked ? 'Blocked' : 'Review required'}</strong></p><p>Company: ${lead.company_name}</p><p>Prospect: ${lead.prospect_title}</p><p>Route: ${route.reality_route}</p><p>Draft subject: ${draft.subject}</p>`,
        text: `${blocked ? 'Blocked' : 'Review required'}\nCompany: ${lead.company_name}\nProspect: ${lead.prospect_title}\nRoute: ${route.reality_route}\nDraft subject: ${draft.subject}`,
        tags: [{ name: 'review_queue', value: blocked ? 'blocked' : 'review_required' }],
        from
      });
    }
  };
}

export function createReviewQueueFromEnv({ email }) {
  return createEmailReviewQueue({ email });
}

export function createProductionDecisionCounts({ astra }) {
  return {
    async read() {
      const dashboard = await astra.dashboard();
      return {
        source: 'astra_dashboard',
        total: dashboard.total_decisions ?? dashboard.evaluations_total ?? dashboard.usage?.evaluations_this_month,
        ready: dashboard.ready_for_reality ?? dashboard.routes?.ready_for_reality,
        review: dashboard.review_required ?? dashboard.routes?.review_required,
        blocked: dashboard.blocked ?? dashboard.routes?.blocked,
        raw: dashboard
      };
    }
  };
}
