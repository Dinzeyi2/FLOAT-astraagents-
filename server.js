import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createProductionLoopFromEnv, runCuratedLeadOutboundLoop } from './src/core/real-sales-loop.js';
import { simulateBusinessDay } from './src/core/simulator.js';

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const port = Number(process.env.PORT ?? 4173);
const runRoutes = new Set(['/run-real-sales-loop', '/run-agents', '/start-agents', '/send-emails', '/run', '/start', '/agents/run', '/sales/run', '/simulate', '/workflow/start', '/api/run-real-sales-loop', '/api/run-agents', '/api/send-emails', '/api/run', '/api/start', '/api/agents/run', '/api/sales/run', '/api/simulate', '/api/workflow/start']);
const metricsRoutes = new Set(['/production-counts', '/metrics', '/api/production-counts', '/api/metrics']);
const statusRoutes = new Set(['/status', '/api/status']);
const summaryRoutes = new Set(['/summary', '/api/summary']);
const decisionRoutes = new Set(['/decisions', '/api/decisions']);
const emailRoutes = new Set(['/emails', '/api/emails']);
const replyRoutes = new Set(['/replies', '/api/replies', '/read-replies', '/api/read-replies']);
const meetingRoutes = new Set(['/meetings', '/api/meetings']);
const stopRoutes = new Set(['/stop', '/api/stop', '/agents/stop', '/api/agents/stop', '/sales/stop', '/api/sales/stop']);
const automationState = { running: false, lastStartedAt: null, lastStoppedAt: null, lastRun: null };

createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`).pathname;
    if (pathname === '/health') return json(res, 200, { status: 'ok' });
    if (pathname === '/routes') return json(res, 200, routeList());
    if (statusRoutes.has(pathname) && req.method === 'GET') return json(res, 200, publicStatus());
    if (stopRoutes.has(pathname) && ['GET', 'POST'].includes(req.method)) return stopAgents(req, res);
    if (summaryRoutes.has(pathname) && req.method === 'GET') return json(res, 200, publicSummary());
    if (decisionRoutes.has(pathname) && req.method === 'GET') return json(res, 200, publicDecisions());
    if (emailRoutes.has(pathname) && req.method === 'GET') return json(res, 200, publicEmails());
    if (replyRoutes.has(pathname) && req.method === 'GET') return json(res, 200, publicReplies());
    if (meetingRoutes.has(pathname) && req.method === 'GET') return json(res, 200, publicMeetings());
    if (metricsRoutes.has(pathname) && req.method === 'GET') return readProductionCounts(req, res);
    if (runRoutes.has(pathname) && ['GET', 'POST'].includes(req.method)) return runRealSalesLoop(req, res, pathname);

    const path = pathname === '/' ? 'index.html' : pathname.slice(1);
    const body = await readFile(join(process.cwd(), path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'text/plain' });
    res.end(body);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    json(res, 500, { error: error.message });
  }
}).listen(port, () => console.log(`Astra autonomous sales team running on port ${port}`));

async function runRealSalesLoop(req, res, pathname) {
  if (pathname.includes('simulate') || !isAuthorized(req)) return json(res, 200, publicRunDryRun(pathname));
  automationState.running = true;
  automationState.lastStartedAt = new Date().toISOString();

  const production = createProductionLoopFromEnv();
  const leads = await production.leadSource.listLeads();
  const limit = Number(process.env.LEAD_LIMIT ?? 1);
  const selectedLeads = leads.slice(0, limit);
  const results = [];

  for (const lead of selectedLeads) {
    results.push(await runCuratedLeadOutboundLoop({ lead, ...production }));
  }

  automationState.lastRun = { processed: selectedLeads.length, finishedAt: new Date().toISOString() };
  return json(res, 200, { mode: 'real', running: automationState.running, processed: selectedLeads.length, results });
}

function stopAgents(req, res) {
  if (!isAuthorized(req)) return json(res, 200, { mode: 'dry_run', running: automationState.running, note: 'Send Authorization: Bearer <RUN_TOKEN> to stop real agents.' });
  automationState.running = false;
  automationState.lastStoppedAt = new Date().toISOString();
  return json(res, 200, { mode: 'real', running: false, stopped_at: automationState.lastStoppedAt });
}

async function readProductionCounts(req, res) {
  if (!isAuthorized(req)) return json(res, 200, publicMetrics());
  const production = createProductionLoopFromEnv();
  return json(res, 200, await production.counts.read());
}

function publicStatus() {
  return {
    status: 'ok',
    service: 'astra-autonomous-sales-team',
    mode: 'public_status',
    running: automationState.running,
    last_started_at: automationState.lastStartedAt,
    last_stopped_at: automationState.lastStoppedAt,
    last_run: automationState.lastRun,
    real_execution_requires: 'Authorization: Bearer <RUN_TOKEN>'
  };
}

function publicSummary() {
  const summary = simulateBusinessDay();
  return {
    agents: summary.agents,
    daily_decisions_modeled: summary.total,
    annualized_decisions_modeled: summary.annualized,
    routes: summary.byOutcome,
    running: automationState.running,
    last_started_at: automationState.lastStartedAt,
    last_stopped_at: automationState.lastStoppedAt,
    last_run: automationState.lastRun,
    real_execution_requires: 'Authorization: Bearer <RUN_TOKEN>'
  };
}

function publicMetrics() {
  const summary = simulateBusinessDay();
  return {
    source: 'public_simulation',
    total: summary.total,
    ready: summary.byOutcome.reality,
    review: summary.byOutcome.review,
    blocked: summary.byOutcome.contained,
    note: 'Send Authorization: Bearer <RUN_TOKEN> to read Astra production counts.'
  };
}

function publicDecisions() {
  const summary = simulateBusinessDay();
  return { source: 'public_simulation', decisions: summary.validations };
}

function publicEmails() {
  const summary = simulateBusinessDay();
  return {
    source: 'public_simulation',
    drafted: summary.total,
    ready_to_send: summary.byOutcome.reality,
    review_required: summary.byOutcome.review,
    blocked: summary.byOutcome.contained,
    real_sending_requires: 'Authorization: Bearer <RUN_TOKEN>'
  };
}

function publicReplies() {
  return {
    source: 'not_connected',
    replies: 0,
    note: 'Reply ingestion is not configured yet. Connect a Resend inbound webhook or mailbox provider.'
  };
}

function publicMeetings() {
  return {
    source: 'calendly_link',
    calendly_link: process.env.CALENDLY_LINK ?? 'https://calendly.com/mpakaobed90/30min',
    booked_meetings: null,
    note: 'Calendly booking counts require Calendly webhook/API integration.'
  };
}

function publicRunDryRun(pathname) {
  const summary = simulateBusinessDay();
  return {
    mode: 'dry_run',
    route: pathname,
    processed: 0,
    modeled_agents: summary.agents,
    modeled_daily_decisions: summary.total,
    running: automationState.running,
    note: 'No real emails were sent. Send Authorization: Bearer <RUN_TOKEN> to start the real ContactOut → Astra → Resend loop.'
  };
}

function routeList() {
  return {
    health: 'GET /health',
    discover: 'GET /routes',
    public: ['GET /status', 'GET /summary', 'GET /metrics', 'GET /decisions', 'GET /emails', 'GET /replies', 'GET /meetings'],
    run_dry_run_or_real_with_token: ['POST /run', 'POST /start', 'POST /run-agents', 'POST /agents/run', 'POST /sales/run', 'POST /workflow/start', 'POST /send-emails', 'POST /simulate'],
    stop: ['POST /stop', 'POST /agents/stop', 'POST /sales/stop'],
    api_aliases: ['GET /api/status', 'GET /api/summary', 'GET /api/metrics', 'GET /api/decisions', 'GET /api/emails', 'GET /api/replies', 'GET /api/meetings', 'POST /api/run', 'POST /api/start', 'POST /api/agents/run', 'POST /api/sales/run', 'POST /api/workflow/start', 'POST /api/simulate'],
    auth: 'Real execution and real Astra production counts require Authorization: Bearer $RUN_TOKEN.'
  };
}

function isAuthorized(req) {
  if (!process.env.RUN_TOKEN) return false;
  return req.headers.authorization === `Bearer ${process.env.RUN_TOKEN}`;
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}
