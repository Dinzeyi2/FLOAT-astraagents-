# Astra Autonomous Sales Team API Requirements

This production wedge uses the exact ContactOut API product for your use case: **People Search API**.

```text
ContactOut People Search API
→ AI drafts email
→ Astra evaluates proposed action
→ Resend sends only if Astra returns ready_for_reality
→ Review-required/blocked items go to email
→ Google Calendar books demos when a demo window exists
→ Astra records outcomes and production decision counts
```

## ContactOut endpoint

Use this endpoint:

```bash
CONTACTOUT_API_URL=https://api.contactout.com/v1/people/search
```

Why this one? Because you said you want to build targeted prospect lists. ContactOut documents that as **People Search API**, with:

```http
POST https://api.contactout.com/v1/people/search
```

The request uses the ContactOut API token header:

```http
token: <YOUR_API_TOKEN>
```

The code now posts a search body with finance buyer filters and normalizes ContactOut `profiles` into leads.

## Railway environment

```bash
# Railway runtime
PORT=4173
RUN_TOKEN=<long_random_token>
LEAD_LIMIT=1

# ContactOut People Search API
CONTACTOUT_API_URL=https://api.contactout.com/v1/people/search
CONTACTOUT_API_TOKEN=<contactout_token>
CONTACTOUT_JOB_TITLES=Head of Finance,VP Finance,Director of Finance,CFO
CONTACTOUT_SENIORITY=director,vice president,cxo
CONTACTOUT_LOCATIONS=
CONTACTOUT_INDUSTRIES=Financial Services,Fintech,Software
CONTACTOUT_PAGE=1
CONTACTOUT_PAGE_SIZE=25
DEFAULT_DEAL_VALUE_USD=42000

# Astra
ASTRA_BASE_URL=https://app.codeastra.dev
ASTRA_API_KEY=<astra_key>
ASTRA_WORLD_ID=sales_world

# AI drafting
AI_API_KEY=<openai_or_compatible_key>
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-5.6-luna

# Resend email delivery and email review queue
RESEND_API_KEY=<resend_key>
EMAIL_FROM=sales@yourdomain.com
REVIEW_EMAIL=founder@yourdomain.com

# Google Calendar
GOOGLE_CALENDAR_ACCESS_TOKEN=<google_oauth_access_token>
GOOGLE_CALENDAR_ID=primary
```

## Astra world ID

I cannot create the Astra world from this repo unless you give the running service a real Astra key and Astra exposes a world-creation endpoint. The current documented Astra workflow endpoints assume the world already exists because the world ID is part of the URL.

Use:

```bash
ASTRA_WORLD_ID=sales_world
```

If `sales_world` does not exist yet, create that world in Astra Cloud first, then put the same value in Railway.

## What each connector does

- **ContactOut** searches for finance buyers and returns verified work emails.
- **AI** drafts the short Astra founder-style email.
- **Astra** evaluates the proposed outbound action before it reaches a prospect.
- **Resend** sends approved outbound emails and review-required emails.
- **Google Calendar** books meetings only when the lead includes `demo_start_at` and `demo_end_at` and Astra has allowed the outbound action.

## Railway deployment

1. Create a Railway service from this repo.
2. Railway uses `railway.json` and runs `npm start`.
3. Add the variables above in Railway Variables.
4. Confirm health:

```bash
curl https://<your-railway-domain>/health
```

5. Trigger the loop:

```bash
curl -X POST https://<your-railway-domain>/run-real-sales-loop \
  -H "Authorization: Bearer $RUN_TOKEN"
```

6. Read Astra production counts:

```bash
curl https://<your-railway-domain>/production-counts \
  -H "Authorization: Bearer $RUN_TOKEN"
```

Keep `LEAD_LIMIT=1` until ContactOut, Astra, Resend, and Google Calendar are verified end to end.
