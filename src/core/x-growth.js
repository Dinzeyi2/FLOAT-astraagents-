export const X_DAILY_OPPORTUNITIES_TARGET = 10000;
export const DEFAULT_MAX_X_POSTS_PER_DAY = 50;
export const DEFAULT_MAX_X_REPLIES_PER_DAY = 200;
export const OPPORTUNITY_LIFECYCLE = ['DISCOVERED', 'ANALYZED', 'DIAGNOSED', 'DRAFTED', 'QUALITY_CHECKED', 'APPROVED', 'PUBLISHED', 'ENGAGED', 'CONVERTED'];

const HIGH_INTENT_TERMS = ['ai agent', 'ai agents', 'finance automation', 'workflow automation', 'refund automation', 'invoice approval', 'payment approval', 'manual review', 'risk controls', 'operational risk', 'automate approvals', 'autonomous workflows'];

export function scoreXPost(post) {
  const text = `${post.text ?? ''} ${post.author_description ?? ''}`.toLowerCase();
  const matchedTerms = HIGH_INTENT_TERMS.filter((term) => text.includes(term));
  const engagementScore = Math.min(1, (Number(post.like_count ?? 0) + Number(post.reply_count ?? 0) * 2 + Number(post.repost_count ?? 0)) / 500);
  const relevanceScore = Math.min(1, matchedTerms.length / 3 + engagementScore * 0.25);
  return { relevanceScore, matchedTerms, worthDrafting: relevanceScore >= 0.45 && matchedTerms.length > 0 };
}


export function analyzeOpportunityPath(post) {
  const text = `${post.text ?? ''} ${post.author_description ?? ''}`.toLowerCase();
  const goal = inferGoal(text);
  const blocker = inferBlocker(text);
  const missingStep = inferMissingStep(text, blocker);
  const productRelevance = scoreAstraRelevance({ goal, blocker, missingStep });
  const recommendedPath = buildRecommendedPath(goal, missingStep);
  return {
    user_goal: goal,
    current_stage: inferCurrentStage(text),
    current_blocker: blocker,
    belief_to_change: inferBeliefToChange(text, blocker),
    missing_knowledge: missingStep,
    missing_step: missingStep,
    recommended_path: recommendedPath,
    astra_relevance: productRelevance,
    product_relevance: productRelevance >= 0.75 ? 'high' : productRelevance >= 0.45 ? 'medium' : 'low',
    appropriate_cta: productRelevance >= 0.75 ? 'Ask how they currently validate high-impact actions before execution.' : 'Offer the next practical step without mentioning the product.'
  };
}

export function buildRecommendation({ post, path = analyzeOpportunityPath(post) }) {
  const astraRelevance = path.product_relevance === 'high' ? 0.96 : path.product_relevance === 'medium' ? 0.62 : 0.25;
  return {
    problem_detected: path.current_blocker,
    teaching_point: path.missing_step,
    astra_relevance: astraRelevance,
    mention_astra: astraRelevance >= 0.75,
    mention_style: astraRelevance >= 0.75 ? 'educational' : 'do_not_mention',
    call_to_action: path.appropriate_cta
  };
}

export function draftContextualXReply({ post, path = analyzeOpportunityPath(post), recommendation = buildRecommendation({ post, path }) }) {
  const pathStep = path.recommended_path[0] ?? 'start with one decision you can evaluate safely';
  if (recommendation.mention_astra) {
    return { text: `First step: ${pathStep}. The issue is usually not whether the workflow can run, but whether each live decision should affect the business. That is what we are building Astra around. What keeps this manual today?` };
  }
  return { text: `First step: ${pathStep}. The issue is usually not whether the workflow can run, but whether each live decision should affect the business. What part is hardest to trust?` };
}

export function buildXAction({ post, draft, kind = 'reply', agentId = 'x-agent-001', plannedPostsToday = 0, plannedRepliesToday = 0, maxPostsPerDay, maxRepliesPerDay, memory }) {
  const decision = evaluateXContent({ post, draft, kind, plannedPostsToday, plannedRepliesToday, maxPostsPerDay, maxRepliesPerDay, memory });
  return {
    operation: kind === 'post' ? 'x.post.propose' : 'x.reply.propose',
    params: {
      agent_id: agentId,
      source_post_id: post?.id,
      source_author: post?.author_username,
      proposed_text: draft.text,
      content_kind: kind,
      relevance_score: decision.relevanceScore,
      originality_score: decision.originalityScore,
      link_count: decision.linkCount,
      planned_posts_today: plannedPostsToday,
      planned_replies_today: plannedRepliesToday,
      human_review_required: decision.route !== 'approved'
    },
    metadata: {
      source: 'x_autonomous_growth_loop',
      internal_decision: decision.route,
      decision_reasons: decision.reasons
    }
  };
}

export function evaluateXContent({ post = {}, draft, kind = 'reply', plannedPostsToday = 0, plannedRepliesToday = 0, maxPostsPerDay = Number(process.env.X_MAX_POSTS_PER_DAY ?? DEFAULT_MAX_X_POSTS_PER_DAY), maxRepliesPerDay = Number(process.env.X_MAX_REPLIES_PER_DAY ?? DEFAULT_MAX_X_REPLIES_PER_DAY), memory = createConversationMemory() }) {
  const quality = evaluateContentQuality({ draft });
  const policy = evaluatePlatformPolicy({ draft, kind, plannedPostsToday, plannedRepliesToday, maxPostsPerDay, maxRepliesPerDay, memory, post });
  const business = evaluateBusinessFit({ post, draft });
  const execution = decideExecution({ quality, policy, business });
  return { ...execution, relevanceScore: business.relevanceScore, originalityScore: quality.originalityScore, linkCount: policy.linkCount, quality, policy, business };
}

export function evaluateContentQuality({ draft }) {
  const text = draft.text ?? '';
  const originalityScore = estimateOriginality(text);
  const reasons = [];
  if (text.length < 80) reasons.push('Proposed X content is too short to be meaningfully useful.');
  if (text.length > 280) reasons.push('Proposed X content exceeds the standard 280 character post length.');
  if (originalityScore < 0.6) reasons.push('Proposed X content appears too generic or repetitive.');
  return { passed: reasons.length === 0, score: Math.min(1, originalityScore), originalityScore, reasons };
}

export function evaluatePlatformPolicy({ draft, kind, plannedPostsToday = 0, plannedRepliesToday = 0, maxPostsPerDay = DEFAULT_MAX_X_POSTS_PER_DAY, maxRepliesPerDay = DEFAULT_MAX_X_REPLIES_PER_DAY, memory, post = {} }) {
  const text = draft.text ?? '';
  const linkCount = (text.match(/https?:\/\//g) ?? []).length;
  const hashtagCount = (text.match(/#/g) ?? []).length;
  const previous = memory.get(post.author_username ?? post.author_id ?? post.id) ?? { replies: [], astraMentions: 0 };
  const reasons = [];
  if (linkCount > 0) reasons.push('Links require review because repeated links can make growth content look promotional.');
  if (hashtagCount > 2) reasons.push('Too many hashtags for a useful contextual reply.');
  if (previous.astraMentions > 0 && text.toLowerCase().includes('astra')) reasons.push('Astra was already mentioned to this user. Continue the conversation without repeating the product.');
  if (kind === 'post' && plannedPostsToday >= maxPostsPerDay) reasons.push('Daily X post cap reached; keep monitoring but stop posting.');
  if (kind === 'reply' && plannedRepliesToday >= maxRepliesPerDay) reasons.push('Daily X reply cap reached; keep monitoring but stop replying.');
  return { passed: reasons.length === 0, linkCount, hashtagCount, reasons };
}

export function evaluateBusinessFit({ post, draft }) {
  const score = scoreXPost(post);
  const path = analyzeOpportunityPath(post);
  const recommendation = buildRecommendation({ post, path });
  const reasons = [];
  if (!score.worthDrafting) reasons.push('Source post is not a high-intent growth opportunity.');
  if (recommendation.mention_astra && !draft.text?.toLowerCase().includes('astra')) reasons.push('Astra is relevant, but the draft does not connect the path to Astra.');
  return { passed: reasons.length === 0, relevanceScore: score.relevanceScore, path, recommendation, reasons };
}

export function decideExecution({ quality, policy, business }) {
  const reasons = [...quality.reasons, ...policy.reasons, ...business.reasons];
  if (reasons.some((reason) => reason.includes('cap reached') || reason.includes('not a high-intent'))) return { route: 'rejected', reasons };
  if (!quality.passed || !policy.passed || !business.passed) return { route: 'review_required', reasons };
  return { route: 'approved', reasons: ['Quality, platform policy, and business fit checks passed.'] };
}


export function createConversationMemory(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: (userId) => store.get(userId),
    upsertInteraction(userId, interaction) {
      const current = store.get(userId) ?? { replies: [], astraMentions: 0, outcomes: [] };
      const next = {
        ...current,
        replies: interaction.reply ? [...current.replies, interaction.reply] : current.replies,
        astraMentions: current.astraMentions + (interaction.mentionedAstra ? 1 : 0),
        outcomes: interaction.outcome ? [...current.outcomes, interaction.outcome] : current.outcomes
      };
      store.set(userId, next);
      return next;
    },
    entries: () => Array.from(store.entries())
  };
}

export function buildOpportunityLifecycle({ route, published = false, engaged = false, converted = false }) {
  const terminal = converted ? 'CONVERTED' : engaged ? 'ENGAGED' : published ? 'PUBLISHED' : route === 'approved' ? 'APPROVED' : 'QUALITY_CHECKED';
  return OPPORTUNITY_LIFECYCLE.map((stage) => ({ stage, reached: OPPORTUNITY_LIFECYCLE.indexOf(stage) <= OPPORTUNITY_LIFECYCLE.indexOf(terminal) }));
}

export function recordOutcome({ memory, userId, action, metrics }) {
  const outcome = { action_id: action?.params?.source_post_id, impressions: metrics.impressions ?? 0, replies: metrics.replies ?? 0, likes: metrics.likes ?? 0, reposts: metrics.reposts ?? 0, bookmarks: metrics.bookmarks ?? 0, profile_visits: metrics.profile_visits ?? 0, website_clicks: metrics.website_clicks ?? 0, demo_requests: metrics.demo_requests ?? 0, customers: metrics.customers ?? 0 };
  return memory.upsertInteraction(userId, { outcome, mentionedAstra: action?.params?.proposed_text?.toLowerCase().includes('astra'), reply: action?.params?.proposed_text });
}

export function summarizeOutcomes(outcomes = []) {
  return outcomes.reduce((total, outcome) => ({ impressions: total.impressions + (outcome.impressions ?? 0), replies: total.replies + (outcome.replies ?? 0), likes: total.likes + (outcome.likes ?? 0), reposts: total.reposts + (outcome.reposts ?? 0), bookmarks: total.bookmarks + (outcome.bookmarks ?? 0), profile_visits: total.profile_visits + (outcome.profile_visits ?? 0), website_clicks: total.website_clicks + (outcome.website_clicks ?? 0), demo_requests: total.demo_requests + (outcome.demo_requests ?? 0), customers: total.customers + (outcome.customers ?? 0) }), { impressions: 0, replies: 0, likes: 0, reposts: 0, bookmarks: 0, profile_visits: 0, website_clicks: 0, demo_requests: 0, customers: 0 });
}

export function createXApiClient({ bearerToken = process.env.X_BEARER_TOKEN, userAccessToken = process.env.X_USER_ACCESS_TOKEN, baseUrl = process.env.X_API_BASE_URL ?? 'https://api.x.com' } = {}) {
  if (!bearerToken && !userAccessToken) throw new Error('X_BEARER_TOKEN or X_USER_ACCESS_TOKEN is required.');
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  return {
    async searchRecent(query, { maxResults = 10 } = {}) {
      if (!bearerToken) throw new Error('X_BEARER_TOKEN is required for recent search.');
      const url = new URL(`${normalizedBaseUrl}/2/tweets/search/recent`);
      url.searchParams.set('query', query);
      url.searchParams.set('max_results', String(maxResults));
      url.searchParams.set('tweet.fields', 'author_id,created_at,public_metrics');
      const response = await fetch(url, { headers: { authorization: `Bearer ${bearerToken}` } });
      if (!response.ok) throw new Error(`X recent search failed with ${response.status}: ${await response.text()}`);
      return response.json();
    },
    async createPost({ text, madeWithAi = true }) {
      return createTweet({ normalizedBaseUrl, token: userAccessToken, body: { text, made_with_ai: madeWithAi } });
    },
    async replyToPost({ postId, text, madeWithAi = true }) {
      return createTweet({ normalizedBaseUrl, token: userAccessToken, body: { text, made_with_ai: madeWithAi, reply: { in_reply_to_tweet_id: postId } } });
    }
  };
}

export function simulateXOpportunityDay({ opportunities = X_DAILY_OPPORTUNITIES_TARGET, maxPostsPerDay = DEFAULT_MAX_X_POSTS_PER_DAY, maxRepliesPerDay = DEFAULT_MAX_X_REPLIES_PER_DAY } = {}) {
  const highIntent = Math.round(opportunities * 0.1);
  const drafts = Math.round(highIntent * 0.4);
  const reviewRequired = Math.round(drafts * 0.45);
  const rejected = Math.round(drafts * 0.2);
  const approved = Math.max(0, drafts - reviewRequired - rejected);
  const publishedPosts = Math.min(Math.round(approved * 0.25), maxPostsPerDay);
  const publishedReplies = Math.min(approved - publishedPosts, maxRepliesPerDay);
  return { opportunities, high_intent_conversations: highIntent, replies_drafted: Math.round(drafts * 0.75), posts_drafted: Math.round(drafts * 0.25), approved, review_required: reviewRequired, rejected, published: publishedPosts + publishedReplies, eligible_posts: publishedPosts, eligible_replies: publishedReplies, lifecycle: { DISCOVERED: opportunities, ANALYZED: opportunities, DIAGNOSED: highIntent, DRAFTED: drafts, QUALITY_CHECKED: drafts, APPROVED: approved, PUBLISHED: publishedPosts + publishedReplies, ENGAGED: 0, CONVERTED: 0 }, engagement_generated: 0, qualified_conversations: 0, positioning: '10,000 X opportunities/day means monitored and evaluated opportunities, not 10,000 automated posts or replies.' };
}

async function createTweet({ normalizedBaseUrl, token, body }) {
  if (!token) throw new Error('X_USER_ACCESS_TOKEN is required to create posts or replies.');
  const response = await fetch(`${normalizedBaseUrl}/2/tweets`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`X create post failed with ${response.status}: ${await response.text()}`);
  return response.json();
}


function inferGoal(text) {
  if (text.includes('invoice')) return 'Automate invoice approvals';
  if (text.includes('refund')) return 'Automate refunds safely';
  if (text.includes('payment')) return 'Automate payment decisions';
  if (text.includes('approval')) return 'Automate approvals';
  if (text.includes('ai agent') || text.includes('ai agents')) return 'Give AI agents more operational responsibility';
  return 'Improve workflow automation';
}

function inferCurrentStage(text) {
  if (text.includes('trying') || text.includes('research')) return 'research';
  if (text.includes('built') || text.includes('using')) return 'implementation';
  if (text.includes('scale') || text.includes('more')) return 'scaling';
  return 'research';
}

function inferBeliefToChange(text, blocker) {
  if (text.includes('test')) return 'Testing the workflow is not enough; the live decision still needs validation.';
  if (blocker.includes('manual reviews')) return 'Manual review is not the only way to control risk; uncertain decisions can be routed selectively.';
  return 'The important separation is proposed decision versus real-world execution.';
}

function inferBlocker(text) {
  if (text.includes('manual review') || text.includes('manual reviews')) return 'Too many manual reviews';
  if (text.includes('risk') || text.includes('unsafe')) return 'Operational risk before execution';
  if (text.includes('trust')) return 'Lack of confidence in live decisions';
  if (text.includes('approval')) return 'Unclear approval authority';
  return 'Unclear path from workflow execution to safe business decisions';
}

function inferMissingStep(text, blocker) {
  if (text.includes('test') || blocker.includes('confidence')) return "Testing proves the workflow runs; it does not prove today's decision should affect the business.";
  if (blocker.includes('manual reviews')) return 'Decision-level validation before execution';
  if (blocker.includes('risk')) return 'A gate that evaluates each proposed action against business constraints before execution';
  return 'A way to separate proposed decisions from real-world execution';
}

function scoreAstraRelevance({ goal, blocker, missingStep }) {
  const combined = `${goal} ${blocker} ${missingStep}`.toLowerCase();
  let score = 0;
  for (const term of ['approval', 'refund', 'payment', 'manual review', 'risk', 'decision', 'execution', 'business']) {
    if (combined.includes(term)) score += 0.14;
  }
  if (combined.includes('decision-level validation')) score += 0.3;
  if (combined.includes('manual reviews')) score += 0.2;
  return Math.min(1, score);
}

function buildRecommendedPath(goal, missingStep) {
  if (goal.includes('invoice')) return ['Define which invoice actions can execute automatically', 'Evaluate each proposed approval against business constraints', 'Route uncertain cases to a human', 'Expand authority as successful outcomes accumulate'];
  if (goal.includes('refund')) return ['Separate refund proposal from refund execution', 'Evaluate margin, customer history, and risk before approving', 'Let safe refunds continue automatically', 'Route uncertain refunds to review'];
  return [missingStep, 'Start with a narrow workflow', 'Route uncertain decisions to review', 'Expand only after real outcomes prove the path is safe'];
}

function estimateOriginality(text) {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  if (words.length === 0) return 0;
  return Math.min(1, new Set(words).size / words.length + Math.min(words.length / 35, 1) * 0.15);
}
