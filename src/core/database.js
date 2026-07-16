export async function createDatabase({ connectionString = process.env.DATABASE_URL } = {}) {
  if (!connectionString) return createInMemoryDatabase();
  const { default: pg } = await import('pg');
  const { Pool } = pg;
  const pool = new Pool({ connectionString, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
  let initialized = false;

  async function initialize() {
    if (initialized) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS x_agent_memory (
        user_id TEXT PRIMARY KEY,
        replies JSONB NOT NULL DEFAULT '[]'::jsonb,
        astra_mentions INTEGER NOT NULL DEFAULT 0,
        outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS x_agent_actions (
        id BIGSERIAL PRIMARY KEY,
        source_post_id TEXT,
        author_id TEXT,
        action JSONB NOT NULL,
        route TEXT NOT NULL,
        status TEXT NOT NULL,
        x_post_id TEXT,
        outcome JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        published_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS x_agent_actions_created_at_idx ON x_agent_actions (created_at DESC);
    `);
    initialized = true;
  }

  return createDatabaseInterface({ initialize, query: (text, params) => pool.query(text, params), persistent: true, close: () => pool.end() });
}

function createInMemoryDatabase() {
  const memories = new Map();
  const actions = [];
  return {
    persistent: false,
    async initialize() {},
    async getMemory(userId) { return memories.get(userId) ?? emptyMemory(); },
    async saveMemory(userId, memory) { memories.set(userId, memory); return memory; },
    async createAction(record) { const saved = { id: actions.length + 1, ...record, created_at: new Date().toISOString() }; actions.push(saved); return saved; },
    async markPublished(id, xPostId) { const action = actions.find((item) => item.id === id); if (action) Object.assign(action, { status: 'published', x_post_id: xPostId, published_at: new Date().toISOString() }); return action; },
    async dailyCounts() { return countActions(actions); },
    async recentActions(limit = 25) { return actions.slice(-limit).reverse(); },
    async close() {}
  };
}

function createDatabaseInterface({ initialize, query, persistent, close }) {
  return {
    persistent,
    initialize,
    async getMemory(userId) {
      await initialize();
      const result = await query('SELECT replies, astra_mentions, outcomes FROM x_agent_memory WHERE user_id = $1', [userId]);
      return result.rows[0] ?? emptyMemory();
    },
    async saveMemory(userId, memory) {
      await initialize();
      await query(`INSERT INTO x_agent_memory (user_id, replies, astra_mentions, outcomes)
        VALUES ($1, $2::jsonb, $3, $4::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET replies = EXCLUDED.replies, astra_mentions = EXCLUDED.astra_mentions, outcomes = EXCLUDED.outcomes, updated_at = NOW()`, [userId, JSON.stringify(memory.replies ?? []), memory.astraMentions ?? 0, JSON.stringify(memory.outcomes ?? [])]);
      return memory;
    },
    async createAction({ source_post_id, author_id, action, route, status }) {
      await initialize();
      const result = await query('INSERT INTO x_agent_actions (source_post_id, author_id, action, route, status) VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING *', [source_post_id, author_id, JSON.stringify(action), route, status]);
      return result.rows[0];
    },
    async markPublished(id, xPostId) {
      await initialize();
      const result = await query("UPDATE x_agent_actions SET status = 'published', x_post_id = $2, published_at = NOW() WHERE id = $1 RETURNING *", [id, xPostId]);
      return result.rows[0];
    },
    async dailyCounts() {
      await initialize();
      const result = await query(`SELECT
        COUNT(*) FILTER (WHERE status = 'published' AND action->>'operation' = 'x.post.propose')::int AS posts,
        COUNT(*) FILTER (WHERE status = 'published' AND action->>'operation' = 'x.reply.propose')::int AS replies
        FROM x_agent_actions WHERE created_at >= date_trunc('day', NOW())`);
      return { posts: result.rows[0].posts, replies: result.rows[0].replies };
    },
    async recentActions(limit = 25) {
      await initialize();
      return (await query('SELECT * FROM x_agent_actions ORDER BY created_at DESC LIMIT $1', [limit])).rows;
    },
    close
  };
}

function emptyMemory() { return { replies: [], astraMentions: 0, outcomes: [] }; }

function countActions(actions) {
  const today = new Date().toDateString();
  return actions.filter((item) => item.status === 'published' && new Date(item.created_at).toDateString() === today)
    .reduce((total, item) => ({ posts: total.posts + (item.action.operation === 'x.post.propose' ? 1 : 0), replies: total.replies + (item.action.operation === 'x.reply.propose' ? 1 : 0) }), { posts: 0, replies: 0 });
}
