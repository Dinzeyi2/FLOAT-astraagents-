export const requiredConnectors = [
  {
    id: 'astra',
    name: 'Self-hosted Astra API',
    required: true,
    env: ['ASTRA_API_BASE_URL', 'ASTRA_API_KEY'],
    purpose: 'Validate every proposed action in Astra before it reaches customers, money, CRM, GitHub, or production.'
  },
  {
    id: 'crm',
    name: 'CRM API',
    required: true,
    examples: ['HubSpot', 'Salesforce', 'Pipedrive'],
    env: ['CRM_API_BASE_URL', 'CRM_API_KEY'],
    purpose: 'Read accounts, contacts, lifecycle stage, owner, deal value, opt-out status, and write approved CRM updates.'
  },
  {
    id: 'email',
    name: 'Email sending API',
    required: true,
    examples: ['Postmark', 'SendGrid', 'Resend', 'Gmail API'],
    env: ['EMAIL_API_KEY', 'EMAIL_FROM_DOMAIN'],
    purpose: 'Send only Astra-approved outbound and follow-up emails with audit IDs attached.'
  },
  {
    id: 'calendar',
    name: 'Calendar API',
    required: true,
    examples: ['Google Calendar', 'Microsoft Graph'],
    env: ['CALENDAR_CLIENT_ID', 'CALENDAR_CLIENT_SECRET'],
    purpose: 'Schedule demos and internal reviews only after Astra validates the meeting action.'
  },
  {
    id: 'github',
    name: 'GitHub API',
    required: true,
    env: ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'],
    purpose: 'Create issues, prioritize bugs, and prepare release plans after validation.'
  },
  {
    id: 'content',
    name: 'Publishing APIs',
    required: false,
    examples: ['LinkedIn', 'Webflow', 'Markdown CMS'],
    env: ['LINKEDIN_ACCESS_TOKEN', 'CMS_API_KEY'],
    purpose: 'Publish only approved thought leadership, launch notes, and social posts.'
  },
  {
    id: 'finance',
    name: 'Finance/ledger APIs',
    required: false,
    examples: ['Stripe', 'QuickBooks', 'Ramp', 'Mercury'],
    env: ['FINANCE_API_KEY'],
    purpose: 'Evaluate refunds, payments, expenses, and cash-impacting operations before execution.'
  }
];
