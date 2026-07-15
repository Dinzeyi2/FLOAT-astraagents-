import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createProductionLoopFromEnv, runCuratedLeadOutboundLoop } from './src/core/real-sales-loop.js';

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const port = Number(process.env.PORT ?? 4173);
const runRoutes = new Set(['/run-real-sales-loop', '/run-agents', '/start-agents', '/send-emails', '/api/run-real-sales-loop', '/api/run-agents', '/api/send-emails']);
const metricsRoutes = new Set(['/production-counts', '/metrics', '/api/production-counts', '/api/metrics']);

createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`).pathname;
    if (pathname === '/health') return json(res, 200, { status: 'ok' });
    if (pathname === '/routes') return json(res, 200, routeList());
    if (runRoutes.has(pathname) && ['GET', 'POST'].includes(req.method)) return runRealSalesLoop(req, res);
    if (metricsRoutes.has(pathname) && req.method === 'GET') return readProductionCounts(req, res);
    if ((pathname === '/read-replies' || pathname === '/api/read-replies') && req.method === 'GET') return readReplies(req, res);

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

async function runRealSalesLoop(req, res) {
  if (!isAuthorized(req)) return json(res, 401, { error: 'Unauthorized' });
  const production = createProductionLoopFromEnv();
  const leads = await production.leadSource.listLeads();
  const limit = Number(process.env.LEAD_LIMIT ?? 1);
  const selectedLeads = leads.slice(0, limit);
  const results = [];

  for (const lead of selectedLeads) {
    results.push(await runCuratedLeadOutboundLoop({ lead, ...production }));
  }

  return json(res, 200, { processed: selectedLeads.length, results });
}

async function readProductionCounts(req, res) {
  if (!isAuthorized(req)) return json(res, 401, { error: 'Unauthorized' });
  const production = createProductionLoopFromEnv();
  return json(res, 200, await production.counts.read());
}

function readReplies(req, res) {
  if (!isAuthorized(req)) return json(res, 401, { error: 'Unauthorized' });
  return json(res, 501, {
    error: 'Reply ingestion is not configured yet.',
    next_step: 'Connect a Resend inbound webhook or mailbox provider, then map replies into Astra outcomes.'
  });
}

function routeList() {
  return {
    health: 'GET /health',
    discover: 'GET /routes',
    run_agents: ['POST /run-real-sales-loop', 'POST /run-agents', 'GET /run-agents', 'POST /send-emails'],
    metrics: ['GET /production-counts', 'GET /metrics'],
    replies: 'GET /read-replies',
    auth: 'Use Authorization: Bearer $RUN_TOKEN for run, metrics, and replies.'
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
