import { simulateXOpportunityDay } from './core/x-growth.js';

const summary = simulateXOpportunityDay();
const app = document.querySelector('#root');
const functions = [
  ['Monitor X', 'Search recent posts and track high-intent conversations.'],
  ['Score opportunities', 'Rank posts by topic relevance, engagement, and buyer context.'],
  ['Draft content', 'Prepare candidate posts and replies for meaningful conversations.'],
  ['Quality gate', 'Check relevance, originality, usefulness, links, character length, and daily caps.'],
  ['Decide', 'Approve, route to review, or reject each proposed action.'],
  ['Publish', 'Use X API primitives to publish only approved posts and replies.'],
  ['Learn', 'Record performance and improve future targeting and content.']
];

app.innerHTML = `
  <main>
    <section class="hero">
      <div><p class="eyebrow">Autonomous X Growth Agent</p><h1>10,000 X opportunities monitored per day.</h1><p class="lede">AI agents find meaningful X conversations, draft useful posts or replies, run internal quality checks, and publish only approved actions.</p><div class="actions"><a href="#fleet">Explore engine</a><a class="secondary" href="#proof">See summary</a></div></div>
      <div class="metric-card" id="proof"><span>Today's X Opportunities</span><strong>${summary.opportunities.toLocaleString()}</strong><p>Monitored and evaluated</p><div class="outcomes">${outcome('Approved', summary.approved)}${outcome('Review', summary.review_required)}${outcome('Rejected', summary.rejected)}</div><small>${summary.published.toLocaleString()} actions eligible for publishing under configured caps.</small></div>
    </section>
    <section class="control-panel"><p class="eyebrow">Agent control</p><h2>Start or stop the Autonomous X Growth Agent.</h2><p>Start launches the real scheduled loop. It searches X, asks OpenAI to draft contextual replies, saves every action to Railway Postgres, and publishes only if <code>X_LIVE_POSTING=true</code> and <code>X_HUMAN_REVIEW=false</code>.</p><input id="run-token" type="password" placeholder="RUN_TOKEN"/><div class="actions"><button id="start-agents">Start agents</button><button class="secondary-button" id="stop-agents">Stop agents</button><button class="secondary-button" id="refresh-status">Refresh status</button><button class="secondary-button" id="x-summary">X summary</button><button class="secondary-button" id="x-actions">Recent actions</button></div><pre id="agent-status">Status not loaded.</pre></section>
    <section class="proofline"><b>✓</b><p>Approved / review_required / rejected are internal quality decisions before publishing.</p></section>
    <section id="fleet"><p class="eyebrow">Operating loop</p><h2>Autonomous X growth, quality-gated before publishing.</h2><div class="grid">${functions.map(functionCard).join('')}</div></section>
    <section><p class="eyebrow">Decision summary</p><h2>Opportunities become drafts, approvals, reviews, rejections, and publishable actions.</h2><div class="table">${Object.entries(summary).map(([key, value]) => `<div class="row"><span>${key}</span><b>${typeof value === 'number' ? value.toLocaleString() : value}</b></div>`).join('')}</div></section>
  </main>`;

function outcome(label, value) { return `<div><span>${label}</span><b>${value.toLocaleString()}</b></div>`; }
function functionCard([title, description]) { return `<article class="department"><div class="icon">${title[0]}</div><h3>${title}</h3><p>${description}</p></article>`; }

async function callAgentEndpoint(path, method = 'GET') {
  const token = document.querySelector('#run-token')?.value;
  const response = await fetch(path, { method, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const payload = await response.json();
  document.querySelector('#agent-status').textContent = JSON.stringify(payload, null, 2);
}

document.querySelector('#start-agents')?.addEventListener('click', () => callAgentEndpoint('/start', 'POST'));
document.querySelector('#stop-agents')?.addEventListener('click', () => callAgentEndpoint('/stop', 'POST'));
document.querySelector('#refresh-status')?.addEventListener('click', () => callAgentEndpoint('/status'));
document.querySelector('#x-summary')?.addEventListener('click', () => callAgentEndpoint('/x/summary'));
document.querySelector('#x-actions')?.addEventListener('click', () => callAgentEndpoint('/x/actions'));
callAgentEndpoint('/status').catch(() => {});
