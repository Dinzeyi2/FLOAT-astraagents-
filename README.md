# Autonomous X/Twitter Growth Agent

This repo is now a standalone Autonomous X Growth Agent. It monitors X, finds meaningful posts, uses OpenAI to draft posts or replies, checks quality and policy signals, approves/reviews/rejects proposed actions, and can publish approved replies through the X API.

## What is included

- X opportunity scoring for AI agents, finance automation, workflow automation, invoice approvals, refunds, operational risk, and manual reviews.
- Proposed X actions: `x.post.propose` and `x.reply.propose`.
- Internal decisions: `approved`, `review_required`, and `rejected`.
- A real OpenAI Responses API drafting client.
- A real X API v2 client for recent search, original posts, and replies.
- Railway Postgres storage for conversation memory, action history, and daily publication counts.
- Separate Quality, Platform Policy, Business Fit, and Execution evaluators.
- Conversation memory to avoid repeated outreach patterns and repeated Astra mentions.
- Path, Recommendation, Outcome, and lifecycle helpers that diagnose the user goal, blocker, missing step, useful next path, learning metrics, and whether Astra belongs in the reply.
- Public summary routes: `/x/summary`, `/api/x/summary`, `/x/decisions`, `/api/x/decisions`, `/twitter/summary`, `/api/twitter/summary`.
- Dashboard copy for the Autonomous X Growth Agent.

## Railway environment

```bash
X_API_BASE_URL=https://api.x.com
X_BEARER_TOKEN=<x_bearer_token>
X_USER_ACCESS_TOKEN=<x_user_access_token>
OPENAI_API_KEY=<openai_api_key>
OPENAI_MODEL=gpt-4.1-mini
DATABASE_URL=<railway_postgres_url>
X_DAILY_OPPORTUNITIES_TARGET=10000
X_MAX_POSTS_PER_DAY=50
X_MAX_REPLIES_PER_DAY=200
X_SEARCH_QUERY=("AI agents" OR "workflow automation" OR "invoice approval") -is:retweet lang:en
X_MAX_CANDIDATES_PER_CYCLE=20
X_POLL_INTERVAL_MS=300000
X_HUMAN_REVIEW=true
X_LIVE_POSTING=false
```

`X_HUMAN_REVIEW=true` is the safe default: approved actions are stored for review, but are not published. To permit autonomous publishing after testing, set both `X_HUMAN_REVIEW=false` and `X_LIVE_POSTING=true`. Daily caps still apply.

## Give the agent control of your X account

1. Create an X developer app/project that has permission to read posts and write posts on **your** account.
2. Generate a bearer token for recent-search access and a user access token for the account that will publish replies.
3. Add those secrets to Railway as `X_BEARER_TOKEN` and `X_USER_ACCESS_TOKEN`; never put them in browser code or commit them to Git.
4. Add `OPENAI_API_KEY`, `DATABASE_URL`, and a long random `RUN_TOKEN` to Railway.
5. Deploy, open the dashboard, paste `RUN_TOKEN`, and press **Start agents**. The agent immediately runs one X-search cycle and then polls at `X_POLL_INTERVAL_MS` until you press **Stop agents**.

The account itself—not the bearer token—sets the permissions and platform limits. The agent respects `X_MAX_POSTS_PER_DAY` and `X_MAX_REPLIES_PER_DAY`; it does not attempt to evade X limits or anti-spam systems.

## Production loop target

```text
X search
→ score opportunity
→ retrieve thread context
→ generate candidate content
→ run quality and policy checks
→ approve, review or reject
→ publish approved action
→ observe and measure outcomes
→ update memory and learning metrics
→ optimize future content
```

The agent helps first, then mentions Astra only when the diagnosed path genuinely fits. Image generation/upload, X engagement outcome retrieval, and learning optimization are still future work.
