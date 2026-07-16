import { analyzeOpportunityPath, buildRecommendation, buildXAction, createConversationMemory, createXApiClient, evaluateXContent, scoreXPost } from './x-growth.js';
import { createOpenAIClient } from './openai-client.js';
import { createDatabase } from './database.js';

const DEFAULT_QUERY = '("AI agents" OR "workflow automation" OR "invoice approval" OR "manual review" OR "finance automation") -is:retweet lang:en';

export async function createXLiveAgent({ xClient, aiClient, database, config = readConfig() } = {}) {
  const db = database ?? await createDatabase();
  const x = xClient ?? createXApiClient();
  const ai = aiClient ?? createOpenAIClient();
  let timer;
  let running = false;
  let lastRun;
  let lastError;

  async function runCycle() {
    await db.initialize();
    const search = await x.searchRecent(config.searchQuery, { maxResults: config.maxCandidatesPerCycle });
    const posts = (search.data ?? []).map(normalizeXPost);
    const result = { discovered: posts.length, high_intent: 0, drafted: 0, approved: 0, review_required: 0, rejected: 0, published: 0 };
    const counts = await db.dailyCounts();

    for (const post of posts) {
      const score = scoreXPost(post);
      if (!score.worthDrafting) continue;
      result.high_intent += 1;
      const userId = post.author_username ?? post.author_id ?? post.id;
      const storedMemory = await db.getMemory(userId);
      const memory = createConversationMemory({ [userId]: storedMemory });
      const path = analyzeOpportunityPath(post);
      const recommendation = buildRecommendation({ post, path });
      const draft = await ai.draftReply({ post, path, recommendation });
      result.drafted += 1;
      const decision = evaluateXContent({ post, draft, kind: 'reply', plannedPostsToday: counts.posts, plannedRepliesToday: counts.replies, maxPostsPerDay: config.maxPostsPerDay, maxRepliesPerDay: config.maxRepliesPerDay, memory });
      result[decision.route] += 1;
      const action = buildXAction({ post, draft, kind: 'reply', plannedPostsToday: counts.posts, plannedRepliesToday: counts.replies, memory, maxPostsPerDay: config.maxPostsPerDay, maxRepliesPerDay: config.maxRepliesPerDay });
      const status = decision.route === 'approved' && config.livePosting && !config.humanReview ? 'approved_pending_publish' : decision.route;
      const record = await db.createAction({ source_post_id: post.id, author_id: userId, action, route: decision.route, status });

      if (decision.route === 'approved' && config.livePosting && !config.humanReview) {
        const published = await x.replyToPost({ postId: post.id, text: draft.text });
        await db.markPublished(record.id, published.data?.id);
        memory.upsertInteraction(userId, { reply: draft.text, mentionedAstra: draft.text.toLowerCase().includes('astra') });
        await db.saveMemory(userId, memory.get(userId));
        counts.replies += 1;
        result.published += 1;
      }
    }
    lastRun = { at: new Date().toISOString(), ...result };
    lastError = undefined;
    return lastRun;
  }

  return {
    async start() {
      if (running) return { running, already_running: true, last_run: lastRun };
      running = true;
      try { await runCycle(); } catch (error) { lastError = error.message; }
      timer = setInterval(() => runCycle().catch((error) => { lastError = error.message; }), config.pollIntervalMs);
      return this.status();
    },
    async stop() { running = false; clearInterval(timer); timer = undefined; return this.status(); },
    async runOnce() { return runCycle(); },
    async status() { return { running, live_posting: config.livePosting, human_review: config.humanReview, database: db.persistent ? 'postgres' : 'in_memory', last_run: lastRun ?? null, last_error: lastError ?? null, daily_counts: await db.dailyCounts() }; },
    async recentActions(limit) { return db.recentActions(limit); },
    async close() { await this.stop(); await db.close(); }
  };
}

function readConfig() {
  return {
    searchQuery: process.env.X_SEARCH_QUERY ?? DEFAULT_QUERY,
    maxCandidatesPerCycle: Math.max(10, Math.min(100, Number(process.env.X_MAX_CANDIDATES_PER_CYCLE ?? 20))),
    maxPostsPerDay: Number(process.env.X_MAX_POSTS_PER_DAY ?? 50),
    maxRepliesPerDay: Number(process.env.X_MAX_REPLIES_PER_DAY ?? 200),
    pollIntervalMs: Math.max(60_000, Number(process.env.X_POLL_INTERVAL_MS ?? 300_000)),
    livePosting: process.env.X_LIVE_POSTING === 'true',
    humanReview: process.env.X_HUMAN_REVIEW !== 'false'
  };
}

function normalizeXPost(post) {
  return { id: post.id, text: post.text, author_id: post.author_id, author_username: post.author_id, like_count: post.public_metrics?.like_count ?? 0, reply_count: post.public_metrics?.reply_count ?? 0, repost_count: post.public_metrics?.retweet_count ?? 0 };
}
