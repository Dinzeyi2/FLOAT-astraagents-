# Astra Autonomous Sales Team API Requirements

This production wedge now uses only the connectors needed for the first real loop:

```text
ContactOut
→ AI drafts email
→ Astra evaluates proposed action
→ Resend sends only if Astra returns ready_for_reality
→ Review-required/blocked items go to email
→ Google Calendar books demos when a demo window exists
→ Astra records outcomes and production decision counts
```

## Railway environment

```bash
# Railway runtime
PORT=4173
RUN_TOKEN=<long_random_token>
LEAD_LIMIT=1

# ContactOut lead source
CONTACTOUT_API_URL=https://api.contactout.com/v1/<your-enabled-endpoint>
CONTACTOUT_API_TOKEN=<contactout_token>

# Astra
ASTRA_BASE_URL=https://app.codeastra.dev
ASTRA_API_KEY=<astra_key>
ASTRA_WORLD_ID=<world_id>

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

## What each connector does

- **ContactOut** supplies real prospects and email addresses. `CONTACTOUT_API_URL` is the exact ContactOut endpoint enabled for your account; `CONTACTOUT_API_TOKEN` is the API key/token from ContactOut.
- **AI** researches/profiles the lead context you provide and drafts the outbound email.
- **Astra** evaluates the proposed outbound action before it can reach a prospect.
- **Resend** sends approved outbound emails and sends review-required emails to `REVIEW_EMAIL`.
- **Google Calendar** books meetings only when the lead includes `demo_start_at` and `demo_end_at` and Astra has allowed the outbound action.

## Lead record shape

ContactOut or your ContactOut proxy should return leads shaped like this:

```json
{
  "id": "lead_1",
  "company_name": "Acme Corp",
  "prospect_title": "CFO",
  "email": "cfo@acme.example",
  "prospect_email_hash": "sha256_hash",
  "estimated_deal_value_usd": 42000,
  "demo_start_at": "2026-07-15T15:00:00Z",
  "demo_end_at": "2026-07-15T15:30:00Z"
}
```

`demo_start_at` and `demo_end_at` are optional. If they are absent, the loop sends the approved email but skips calendar booking.

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

## Outbound email style

The AI drafting prompt now writes emails in the Astra founder-led style:

- Short, 90-150 words.
- Opens with a curiosity question.
- Makes the prospect think about where they stop trusting automation.
- Explains Astra only after the problem is clear.
- Focuses on outcomes: automate more, reduce manual review, protect customers/money/critical systems.
- Ends with a low-pressure conversation question instead of a demo ask.

Example direction:

```text
As AI agents and workflows become more capable, what determines how much financial work you're actually willing to let them handle?
```

The point of the email is not to close the sale immediately. The point is to earn a reply by making the prospect recognize the automation-confidence problem Astra solves.


## ContactOut URL and token

Use `CONTACTOUT_API_URL` for the exact ContactOut endpoint your account is allowed to call. ContactOut's API base is `https://api.contactout.com`, and their docs show authenticated requests passing your key in a `token: <YOUR_API_TOKEN>` header. The code sends that `token` header for you; you only put the token value in Railway as `CONTACTOUT_API_TOKEN`.

If you are not sure which endpoint to use, open your ContactOut API documentation/dashboard or ask ContactOut which endpoint is enabled for your token. Paste that full endpoint into `CONTACTOUT_API_URL`.

## Astra world ID

The code does not create an Astra world for you. `ASTRA_WORLD_ID` must already exist in Astra. If you already created a world like `sales_world`, put that exact value in Railway. If you have not created one, create it in Astra first, then set `ASTRA_WORLD_ID` to the world ID Astra gives you.
