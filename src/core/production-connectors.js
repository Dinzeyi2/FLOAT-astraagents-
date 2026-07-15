export function createContactOutLeadSource({
  apiUrl = process.env.CONTACTOUT_API_URL ?? 'https://api.contactout.com/v1/people/search',
  apiToken = process.env.CONTACTOUT_API_TOKEN,
  search = contactOutSearchFromEnv()
} = {}) {
  if (!apiUrl) throw new Error('CONTACTOUT_API_URL is required for ContactOut lead sourcing.');
  if (!apiToken) throw new Error('CONTACTOUT_API_TOKEN is required for ContactOut lead sourcing.');
  return {
    async listLeads() {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', token: apiToken },
        body: JSON.stringify(search)
      });
      if (!response.ok) throw new Error(`ContactOut lead source failed with ${response.status}: ${await response.text()}`);
      return normalizeContactOutProfiles(await response.json());
    }
  };
}

export function createLeadSourceFromEnv() {
  return createContactOutLeadSource();
}

export function contactOutSearchFromEnv() {
  return {
    page: Number(process.env.CONTACTOUT_PAGE ?? 1),
    page_size: Number(process.env.CONTACTOUT_PAGE_SIZE ?? 25),
    job_title: csv(process.env.CONTACTOUT_JOB_TITLES ?? 'Head of Finance,VP Finance,Director of Finance,CFO'),
    seniority: csv(process.env.CONTACTOUT_SENIORITY ?? 'director,vice president,cxo'),
    location: csv(process.env.CONTACTOUT_LOCATIONS ?? ''),
    industry: csv(process.env.CONTACTOUT_INDUSTRIES ?? 'Financial Services,Fintech,Software'),
    data_types: ['work_email'],
    reveal_info: true,
    current_titles_only: true
  };
}

export function normalizeContactOutProfiles(payload) {
  const rawProfiles = Array.isArray(payload.profiles) ? payload.profiles : Object.entries(payload.profiles ?? {}).map(([linkedinUrl, profile]) => ({ ...profile, linkedin_url: linkedinUrl }));
  return rawProfiles.map((profile, index) => {
    const workEmail = first(profile.contact_info?.work_emails) ?? first(profile.work_email) ?? first(profile.email);
    return {
      id: profile.id ?? profile.li_vanity ?? profile.linkedin_url ?? `contactout_${index}`,
      company_name: profile.company?.name ?? profile.company_name ?? profile.company,
      company_domain: profile.company?.domain,
      prospect_title: profile.title ?? profile.headline ?? profile.job_title,
      full_name: profile.full_name ?? profile.name,
      email: workEmail,
      prospect_email_hash: profile.linkedin_url ?? profile.url ?? profile.li_vanity ?? workEmail,
      linkedin_url: profile.linkedin_url ?? profile.url,
      estimated_deal_value_usd: Number(process.env.DEFAULT_DEAL_VALUE_USD ?? 42000),
      raw_contactout_profile: profile
    };
  }).filter((lead) => lead.company_name && lead.prospect_title && lead.email);
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

function csv(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}
