import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabase } from '../core/database.js';
import { createXLiveAgent } from '../core/x-live-agent.js';

test('live agent searches, drafts, persists, and publishes an approved reply when enabled', async () => {
  const database = await createDatabase({ connectionString: undefined });
  let published;
  const agent = await createXLiveAgent({
    database,
    xClient: {
      async searchRecent() { return { data: [{ id: 'tweet-1', author_id: 'financeops', text: 'AI agents for invoice approval are useful, but manual review creates operational risk.', public_metrics: { like_count: 100, reply_count: 20, retweet_count: 3 } }] }; },
      async replyToPost(input) { published = input; return { data: { id: 'reply-1' } }; }
    },
    aiClient: { async draftReply() { return { text: 'Start by separating the proposed approval from execution, then evaluate each decision against business constraints. That is the problem we are building Astra around. What keeps reviews manual today?' }; } },
    config: { searchQuery: 'invoice approval', maxCandidatesPerCycle: 10, maxPostsPerDay: 50, maxRepliesPerDay: 200, pollIntervalMs: 60_000, livePosting: true, humanReview: false }
  });
  const result = await agent.runOnce();
  const actions = await agent.recentActions();
  assert.equal(result.published, 1);
  assert.equal(published.postId, 'tweet-1');
  assert.equal(actions[0].status, 'published');
  await agent.close();
});
