import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createProductionLoopFromEnv, runCuratedLeadOutboundLoop } from './src/core/real-sales-loop.js';

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const port = Number(process.env.PORT ?? 4173);

createServer(async (req, res) => {
  try {
    if (req.url === '/health') return json(res, 200, { status: 'ok' });
    if (req.url === '/run-real-sales-loop' && req.method === 'POST') return runRealSalesLoop(req, res);
    if (req.url === '/production-counts' && req.method === 'GET') return readProductionCounts(req, res);

    const path = req.url === '/' ? 'index.html' : req.url.slice(1).split('?')[0];
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

function isAuthorized(req) {
  if (!process.env.RUN_TOKEN) return false;
  return req.headers.authorization === `Bearer ${process.env.RUN_TOKEN}`;
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}
