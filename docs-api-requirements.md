# Astra Autonomous Sales Team API Requirements

This production wedge uses the exact ContactOut API product for your use case: **People Search API**.

```text
ContactOut People Search API
→ AI drafts email
→ Astra evaluates proposed action
→ Resend sends only if Astra returns ready_for_reality
→ Review-required/blocked items go to email
→ Email includes your Calendly link for booking
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


## ContactOut filter safety

The Railway crash happened because ContactOut rejected the old default seniority values (`director,vice president,cxo`) with HTTP 400. The app now **does not send seniority or industry filters by default**, even if old Railway variables are still present.

Use the safe production default first:

```bash
CONTACTOUT_INCLUDE_SENIORITY=false
CONTACTOUT_INCLUDE_INDUSTRY=false
```

Only switch either flag to `true` after ContactOut confirms the exact accepted values for your account. If ContactOut returns another 400, the server returns a JSON 502 error instead of crashing the Railway container.

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
# Optional filters are disabled by default because ContactOut rejects invalid seniority/industry values.
CONTACTOUT_INCLUDE_SENIORITY=false
CONTACTOUT_SENIORITY=
CONTACTOUT_LOCATIONS=
CONTACTOUT_INCLUDE_INDUSTRY=false
CONTACTOUT_INDUSTRIES=
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
CALENDLY_LINK=https://calendly.com/mpakaobed90/30min
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
- **Calendly** handles booking through your link: `https://calendly.com/mpakaobed90/30min`. No Google Calendar API is required.

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

Keep `LEAD_LIMIT=1` until ContactOut, Astra, Resend, and Calendly-link sending are verified end to end.

## Railway HTTP endpoints

If Railway is running the latest code, these endpoints should not return 404:

```bash
GET  /health
GET  /routes
POST /run-real-sales-loop
POST /run-agents
GET  /run-agents
POST /send-emails
GET  /production-counts
GET  /metrics
GET  /read-replies
```

`/run-real-sales-loop`, `/run-agents`, `/send-emails`, `/production-counts`, `/metrics`, and `/read-replies` require:

```http
Authorization: Bearer <RUN_TOKEN>
```

`/read-replies` currently returns `501` until a Resend inbound webhook or mailbox provider is connected. It exists so external checks do not get a 404 and can see the missing reply-ingestion step explicitly.

If these routes still return 404 on Railway, Railway is not running this server build. Redeploy the latest commit and confirm the start command is `npm start`.

## Public Railway endpoints for external checks

These endpoints are public and should return `200` without auth:

```bash
GET /health
GET /routes
GET /status
GET /api/status
GET /summary
GET /api/summary
GET /metrics
GET /api/metrics
GET /decisions
GET /api/decisions
GET /emails
GET /api/emails
GET /replies
GET /api/replies
GET /meetings
GET /api/meetings
```

Run endpoints also exist at the tested paths. Without `RUN_TOKEN`, they return a safe dry-run response and do not send real emails:

```bash
POST /run
POST /api/run
POST /start
POST /api/start
POST /agents/run
POST /api/agents/run
POST /sales/run
POST /api/sales/run
POST /simulate
POST /api/simulate
POST /workflow/start
POST /api/workflow/start
```

To execute the real ContactOut → Astra → Resend loop, send:

```http
Authorization: Bearer <RUN_TOKEN>
```

This prevents random public visitors from sending real outbound email while still making Railway health/metrics checks work without 404s.

## Start and stop buttons

The dashboard now has an Agent control panel. Paste `RUN_TOKEN`, then click:

- **Start agents**: calls `POST /start` and runs one real ContactOut → Astra → Resend batch.
- **Stop agents**: calls `POST /stop` and marks the agent loop stopped.
- **Refresh status**: calls `GET /status` and shows whether the service is running.

The HTTP equivalents are:

```bash
curl -X POST https://<your-railway-domain>/start \
  -H "Authorization: Bearer $RUN_TOKEN"

curl -X POST https://<your-railway-domain>/stop \
  -H "Authorization: Bearer $RUN_TOKEN"

curl https://<your-railway-domain>/status
```

Without `RUN_TOKEN`, start/stop returns a dry-run message and does not send real emails.
