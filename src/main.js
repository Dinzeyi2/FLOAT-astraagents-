import { createSalesTeam, salesTeamCapacity } from './core/sales-team.js';
import { objectives } from './core/astra.js';
import { simulateBusinessDay } from './core/simulator.js';

const salesTeam = createSalesTeam();
const summary = simulateBusinessDay();
const app = document.querySelector('#root');
const salesFunctions = [
  ['Find companies', 'Identify target accounts that match Astra ICP.'],
  ['Research prospects', 'Gather approved context before outreach.'],
  ['Score leads', 'Prioritize accounts by urgency, fit, and value.'],
  ['Write emails', 'Draft personalized outreach for review by Astra.'],
  ['Follow up', 'Continue conversations only when evidence supports it.'],
  ['Book meetings', 'Schedule demos after Astra validates the action.'],
  ['Update CRM', 'Write clean, approved state back to the source of truth.']
];

app.innerHTML = `
  <main>
    <section class="hero">
      <div><p class="eyebrow">Autonomous Sales Team</p><h1>100 AI sales reps. 100,000 sales decisions a day. Astra before reality.</h1><p class="lede">The reps find companies, research prospects, score leads, write emails, follow up, book meetings, and update CRM. Before any email is sent, meeting is booked, or CRM record changes, Astra Cloud or Astra Private evaluates the action in a Twin World.</p><div class="actions"><a href="#fleet">Explore sales team</a><a class="secondary" href="#proof">See governed decisions</a></div></div>
      <div class="metric-card" id="proof"><span>Today's Sales Decisions</span><strong>${summary.total.toLocaleString()}</strong><p>Sent through Astra first</p><div class="outcomes">${outcome('Ready', summary.byOutcome.reality)}${outcome('Review', summary.byOutcome.review)}${outcome('Blocked', summary.byOutcome.contained)}</div><small>${summary.annualized.toLocaleString()} annualized sales decisions governed.</small></div>
    </section>
    <section class="control-panel"><p class="eyebrow">Agent control</p><h2>Start or stop the live sales loop.</h2><p>Paste your Railway RUN_TOKEN, then start one protected ContactOut → Astra → Resend batch. Stop disables future protected runs.</p><input id="run-token" type="password" placeholder="RUN_TOKEN"/><div class="actions"><button id="start-agents">Start agents</button><button class="secondary-button" id="stop-agents">Stop agents</button><button class="secondary-button" id="refresh-status">Refresh status</button></div><pre id="agent-status">Status not loaded.</pre></section>
    <section class="proofline"><b>✓</b><p>No outbound email or Calendly CTA executes until Astra returns ready_for_reality. Review and blocked routes never touch reality automatically.</p></section>
    <section id="fleet"><p class="eyebrow">Sales operating loop</p><h2>Autonomous selling, gated before reality.</h2><div class="grid">${salesFunctions.map(functionCard).join('')}</div></section>
    <section><p class="eyebrow">Team capacity</p><h2>${salesTeam.length} reps × ${salesTeam[0].decisionsPerDay.toLocaleString()} decisions per rep = ${salesTeamCapacity(salesTeam).toLocaleString()} Astra evaluations/day.</h2><div class="objectives">${objectives.map((objective) => `<article><h3>${objective.label}</h3><p>${objective.description}</p><span>${Math.round(objective.weight * 100)}% weight</span></article>`).join('')}</div></section>
    <section><p class="eyebrow">Recent sales decisions</p><h2>Astra validates each sales action before it touches prospects or CRM.</h2><div class="table">${summary.validations.map((validation) => `<div class="row"><span>${validation.decisionId}</span><b class="${validation.outcome}">${validation.outcome}</b><em>${Math.round(validation.score * 100)}%</em><p>${validation.reasons[0]}</p></div>`).join('')}</div></section>
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
callAgentEndpoint('/status').catch(() => {});
