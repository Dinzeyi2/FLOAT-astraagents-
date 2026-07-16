import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeOpportunityPath, buildOpportunityLifecycle, buildRecommendation, buildXAction, createConversationMemory, createXApiClient, draftContextualXReply, evaluateBusinessFit, evaluateContentQuality, evaluatePlatformPolicy, evaluateXContent, recordOutcome, scoreXPost, simulateXOpportunityDay, summarizeOutcomes } from '../core/x-growth.js';

const highIntentPost = { id: '1888888888888888888', author_username: 'financeops', text: 'AI agents for invoice approval sound useful, but how are teams handling manual review and operational risk?', like_count: 180, reply_count: 32, repost_count: 12 };
const usefulDraft = { text: 'The hard part is not whether the agent can execute the workflow. It is whether each live action deserves to affect customers, cash, or finance systems. Start narrow, keep uncertain actions in review, and expand from outcomes.' };

test('scores high-intent X posts for finance automation conversations', () => {
  const score = scoreXPost(highIntentPost);
  assert.equal(score.worthDrafting, true);
  assert.ok(score.relevanceScore > 0.45);
});

test('returns review_required for promotional or risky X content', () => {
  const decision = evaluateXContent({ post: highIntentPost, draft: { text: `${usefulDraft.text} https://example.com` }, kind: 'reply' });
  assert.equal(decision.route, 'review_required');
  assert.match(decision.reasons.join(' '), /Links require review/);
});

test('builds a proposed X action with internal decision metadata', () => {
  const action = buildXAction({ post: highIntentPost, draft: usefulDraft, kind: 'reply', plannedRepliesToday: 5 });
  assert.equal(action.operation, 'x.reply.propose');
  assert.equal(action.metadata.source, 'x_autonomous_growth_loop');
  assert.equal(action.params.source_post_id, highIntentPost.id);
});

test('models 10,000 X opportunities without mass posting', () => {
  const summary = simulateXOpportunityDay({ opportunities: 10000, maxPostsPerDay: 50, maxRepliesPerDay: 200 });
  assert.equal(summary.opportunities, 10000);
  assert.ok(summary.eligible_posts <= 50);
  assert.ok(summary.eligible_replies <= 200);
  assert.match(summary.positioning, /not 10,000 automated posts or replies/);
});



test('path agent diagnoses blocker and recommended path before writing', () => {
  const path = analyzeOpportunityPath(highIntentPost);
  assert.equal(path.user_goal, 'Automate invoice approvals');
  assert.equal(path.current_blocker, 'Too many manual reviews');
  assert.equal(path.missing_step, 'Decision-level validation before execution');
  assert.equal(path.product_relevance, 'high');
  assert.deepEqual(path.recommended_path.slice(0, 2), ['Define which invoice actions can execute automatically', 'Evaluate each proposed approval against business constraints']);
});

test('recommendation agent mentions Astra only when relevant', () => {
  const path = analyzeOpportunityPath(highIntentPost);
  const recommendation = buildRecommendation({ post: highIntentPost, path });
  assert.equal(recommendation.mention_astra, true);
  assert.equal(recommendation.mention_style, 'educational');
  assert.ok(recommendation.astra_relevance >= 0.75);
});

test('writer creates a contextual reply that teaches before mentioning Astra', () => {
  const reply = draftContextualXReply({ post: highIntentPost });
  assert.match(reply.text, /first step/i);
  assert.match(reply.text, /not whether the workflow can run/i);
  assert.match(reply.text, /Astra/);
  assert.ok(reply.text.length <= 280);
});



test('separates quality, platform policy, and business fit evaluators', () => {
  const quality = evaluateContentQuality({ draft: usefulDraft });
  const policy = evaluatePlatformPolicy({ draft: usefulDraft, kind: 'reply', memory: createConversationMemory(), post: highIntentPost });
  const business = evaluateBusinessFit({ post: highIntentPost, draft: draftContextualXReply({ post: highIntentPost }) });
  assert.equal(quality.passed, true);
  assert.equal(policy.passed, true);
  assert.equal(business.passed, true);
});

test('conversation memory prevents repeated Astra mentions to the same user', () => {
  const memory = createConversationMemory({ financeops: { replies: [], astraMentions: 1, outcomes: [] } });
  const decision = evaluateXContent({ post: highIntentPost, draft: draftContextualXReply({ post: highIntentPost }), memory });
  assert.equal(decision.route, 'review_required');
  assert.match(decision.reasons.join(' '), /already mentioned/);
});

test('opportunity lifecycle tracks publishing and conversion progress', () => {
  const lifecycle = buildOpportunityLifecycle({ route: 'approved', published: true, engaged: true });
  assert.equal(lifecycle.find((item) => item.stage === 'PUBLISHED').reached, true);
  assert.equal(lifecycle.find((item) => item.stage === 'ENGAGED').reached, true);
  assert.equal(lifecycle.find((item) => item.stage === 'CONVERTED').reached, false);
});

test('outcome agent records and summarizes learning metrics', () => {
  const memory = createConversationMemory();
  const action = buildXAction({ post: highIntentPost, draft: draftContextualXReply({ post: highIntentPost }) });
  const updated = recordOutcome({ memory, userId: 'financeops', action, metrics: { impressions: 1000, replies: 3, likes: 12, website_clicks: 2, demo_requests: 1 } });
  const summary = summarizeOutcomes(updated.outcomes);
  assert.equal(summary.impressions, 1000);
  assert.equal(summary.demo_requests, 1);
  assert.equal(updated.astraMentions, 1);
});

test('X API client posts to official v2 tweet endpoint', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.x.com/2/tweets');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.authorization, 'Bearer user_token');
    assert.equal(JSON.parse(options.body).reply.in_reply_to_tweet_id, highIntentPost.id);
    return new Response(JSON.stringify({ data: { id: 'tweet_1', text: 'posted' } }), { status: 201, headers: { 'content-type': 'application/json' } });
  };
  try {
    const client = createXApiClient({ userAccessToken: 'user_token' });
    const response = await client.replyToPost({ postId: highIntentPost.id, text: usefulDraft.text });
    assert.equal(response.data.id, 'tweet_1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
