import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { simulateXOpportunityDay } from './src/core/x-growth.js';
import { createXLiveAgent } from './src/core/x-live-agent.js';

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const port = Number(process.env.PORT ?? 4173);
const summaryRoutes = new Set(['/summary', '/api/summary', '/x/summary', '/api/x/summary', '/twitter/summary', '/api/twitter/summary']);
const decisionRoutes = new Set(['/decisions', '/api/decisions', '/x/decisions', '/api/x/decisions']);
const runRoutes = new Set(['/run', '/start', '/api/run', '/api/start', '/x/run', '/api/x/run']);
const stopRoutes = new Set(['/stop', '/api/stop', '/x/stop', '/api/x/stop']);
const actionsRoutes = new Set(['/actions', '/api/actions', '/x/actions', '/api/x/actions']);
let liveAgent;

createServer(async (req, res) => {
  try {
    const rawPathname = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`).pathname;
    const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, '') : rawPathname;
    if (pathname === '/health' || pathname === '/api/health') return json(res, 200, { status: 'ok' });
    if (pathname === '/routes' || pathname === '/api/routes') return json(res, 200, routeList());
    if ((pathname === '/status' || pathname === '/api/status') && req.method === 'GET') return json(res, 200, await publicStatus());
    if (summaryRoutes.has(pathname) && req.method === 'GET') return json(res, 200, await publicXSummary());
    if (decisionRoutes.has(pathname) && req.method === 'GET') return json(res, 200, await publicXSummary());
    if (actionsRoutes.has(pathname) && req.method === 'GET') return json(res, 200, await recentActions());
    if (runRoutes.has(pathname) && ['GET', 'POST'].includes(req.method)) return startAgent(req, res);
    if (stopRoutes.has(pathname) && ['GET', 'POST'].includes(req.method)) return stopAgent(req, res);

    const path = pathname === '/' ? 'index.html' : pathname.slice(1);
    const body = await readFile(join(process.cwd(), path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'text/plain' });
    res.end(body);
  } catch (error) {
    if (error.code === 'ENOENT') return json(res, 404, { error: 'Not found' });
    json(res, 500, { error: error.message });
  }
}).listen(port, () => console.log(`Autonomous X Growth Agent running on port ${port}`));

async function publicXSummary() {
  const simulated = simulateXOpportunityDay({
    opportunities: Number(process.env.X_DAILY_OPPORTUNITIES_TARGET ?? 10000),
    maxPostsPerDay: Number(process.env.X_MAX_POSTS_PER_DAY ?? 50),
    maxRepliesPerDay: Number(process.env.X_MAX_REPLIES_PER_DAY ?? 200)
  });
  if (!liveAgent) return { mode: 'simulation', ...simulated };
  const status = await liveAgent.status();
  return { mode: 'live_runtime', ...simulated, runtime: status };
}

async function publicStatus() {
  if (!liveAgent) return { status: 'ok', service: 'autonomous-x-growth-agent', running: false, configured: isRuntimeConfigured(), mode: 'not_started' };
  return { status: 'ok', service: 'autonomous-x-growth-agent', configured: isRuntimeConfigured(), ...(await liveAgent.status()) };
}

async function recentActions() {
  if (!liveAgent) return { mode: 'not_started', actions: [] };
  return { mode: 'live_runtime', actions: await liveAgent.recentActions(50) };
}

async function startAgent(req, res) {
  if (!isAuthorized(req)) return json(res, 401, { error: 'Unauthorized. Send Authorization: Bearer <RUN_TOKEN>.' });
  try {
    liveAgent ??= await createXLiveAgent();
    const status = await liveAgent.start();
    json(res, 202, { mode: 'live_runtime', ...status, note: status.live_posting ? 'The agent is running with live X publishing enabled. Approved replies publish only when X_HUMAN_REVIEW=false.' : 'The agent is running in safe mode. Set X_LIVE_POSTING=true only after reviewing real drafts.' });
  } catch (error) {
    json(res, 422, { error: error.message, hint: 'Add OPENAI_API_KEY, X_BEARER_TOKEN, X_USER_ACCESS_TOKEN, RUN_TOKEN, and DATABASE_URL to Railway before starting.' });
  }
}

async function stopAgent(req, res) {
  if (!isAuthorized(req)) return json(res, 401, { error: 'Unauthorized. Send Authorization: Bearer <RUN_TOKEN>.' });
  if (!liveAgent) return json(res, 200, { mode: 'not_started', running: false });
  json(res, 200, { mode: 'live_runtime', ...(await liveAgent.stop()) });
}

function routeList() {
  return { public: ['GET /health', 'GET /status', 'GET /x/summary', 'GET /x/decisions', 'GET /x/actions'], control: ['POST /start', 'POST /stop'], api_aliases: ['GET /api/status', 'GET /api/x/summary', 'GET /api/x/actions', 'POST /api/start', 'POST /api/stop'] };
}

function isRuntimeConfigured() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.X_BEARER_TOKEN && process.env.X_USER_ACCESS_TOKEN && process.env.DATABASE_URL);
}

function isAuthorized(req) {
  return Boolean(process.env.RUN_TOKEN) && req.headers.authorization === `Bearer ${process.env.RUN_TOKEN}`;
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}
