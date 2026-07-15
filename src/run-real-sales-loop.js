import { createProductionLoopFromEnv, runCuratedLeadOutboundLoop } from './core/real-sales-loop.js';

const limit = Number(process.env.LEAD_LIMIT ?? 1);
const production = createProductionLoopFromEnv();
const leads = await production.leadSource.listLeads();
const selectedLeads = leads.slice(0, limit);
const results = [];

for (const lead of selectedLeads) {
  results.push(await runCuratedLeadOutboundLoop({ lead, ...production }));
}

console.log(JSON.stringify({ processed: selectedLeads.length, results }, null, 2));
