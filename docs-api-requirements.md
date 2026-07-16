# Autonomous X/Twitter Growth Agent API Requirements

The product is a standalone Autonomous X Growth Agent.

## Runtime flow

```text
AI agent monitors X
→ finds meaningful posts
→ drafts posts or replies
→ checks relevance, originality, quality and policy compliance
→ approves, reviews or rejects the action
→ publishes approved actions to X
→ records performance and learns from results
```

## Internal decisions

```text
approved
review_required
rejected
```

## X variables

```bash
X_API_BASE_URL=https://api.x.com
X_BEARER_TOKEN=<x_bearer_token>
X_USER_ACCESS_TOKEN=<x_user_access_token_with_tweet_write>
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

## Public endpoints

```text
GET /x/summary
GET /api/x/summary
GET /x/decisions
GET /api/x/decisions
GET /twitter/summary
GET /api/twitter/summary
GET /x/actions
```

## Live runtime

`POST /start` requires `Authorization: Bearer <RUN_TOKEN>`. It starts the scheduler, runs an immediate X search, asks OpenAI to draft a contextual reply, evaluates the draft, and persists each proposal to Railway Postgres.

The live publishing switch has two required conditions:

```text
X_LIVE_POSTING=true
AND
X_HUMAN_REVIEW=false
```

With the default `X_HUMAN_REVIEW=true`, approved replies are saved as `approved` but are not published. `POST /stop` clears the scheduler and prevents subsequent search cycles.

## Required X permissions

Use X developer credentials belonging to the account that should publish. The bearer token is used to search recent posts. The user access token is used for `POST /2/tweets`, which creates posts and replies. Keep both as Railway secrets.


## Path and Recommendation agents

Before writing, the agent should diagnose the opportunity:

```json
{
  "user_goal": "Automate invoice approvals",
  "current_blocker": "Too many manual reviews",
  "missing_step": "Decision-level validation before execution",
  "recommended_path": [
    "Define which invoice actions can execute automatically",
    "Evaluate each proposed approval against business constraints",
    "Route uncertain cases to a human",
    "Expand authority as successful outcomes accumulate"
  ],
  "product_relevance": "high",
  "appropriate_cta": "Ask how they currently validate high-impact actions before execution."
}
```

The Recommendation Agent then decides whether Astra should appear. Astra should only be mentioned when it is a natural next step for the diagnosed problem, and the mention style should be educational rather than promotional.


## Evaluation layers

Every proposed X action is evaluated in separate layers:

```text
Content Quality
→ Platform Policy
→ Business Fit
→ Execution Decision
```

This keeps readability/originality separate from platform risk and business relevance.

## Conversation memory and outcome loop

The agent keeps per-user memory for previous replies, previous Astra mentions, and outcomes. After publishing, the Outcome Agent can record:

```text
impressions
replies
likes
reposts
bookmarks
profile visits
website clicks
demo requests
customers
```

Opportunities move through this lifecycle:

```text
DISCOVERED → ANALYZED → DIAGNOSED → DRAFTED → QUALITY_CHECKED → APPROVED → PUBLISHED → ENGAGED → CONVERTED
```

## Still needed for full production

```text
Image generation
Image upload to X
X engagement outcome retrieval
Learning and optimization
```
