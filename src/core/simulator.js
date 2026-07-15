import { validateWithAstra } from './astra.js';
import { createSalesTeam, createSalesWorkflowAction, salesTeamCapacity } from './sales-team.js';

export function generateDecision(seed) {
  const team = createSalesTeam();
  const rep = team[seed % team.length];
  const action = createSalesWorkflowAction({ rep, seed });
  const volatility = ((seed * 9301 + 49297) % 233280) / 233280;
  return {
    id: `sales-decision-${seed}`,
    agentId: rep.id,
    department: 'Sales',
    kind: action.operation,
    description: `${rep.name} asks Astra before ${action.operation.replaceAll('.', ' ')} reaches email, calendar, or CRM reality.`,
    valueUsd: action.amount_usd,
    confidence: 0.6 + (volatility * 0.38),
    marginImpact: Math.sin(seed) * 0.2,
    cashImpact: Math.cos(seed / 3) * 0.16,
    customerImpact: Math.sin(seed / 7) * 0.24,
    reversible: !['email.follow_up', 'meeting.book'].includes(action.operation),
    workflowAction: action
  };
}

export function simulateBusinessDay(sampleSize = 4000) {
  const team = createSalesTeam();
  const validations = Array.from({ length: sampleSize }, (_, index) => validateWithAstra(generateDecision(index + 1)));
  const byOutcome = validations.reduce((acc, validation) => ({ ...acc, [validation.outcome]: acc[validation.outcome] + 1 }), { reality: 0, review: 0, contained: 0 });
  const totalCapacity = salesTeamCapacity(team);
  const scale = totalCapacity / sampleSize;
  return {
    total: Math.round(totalCapacity),
    byOutcome: { reality: Math.round(byOutcome.reality * scale), review: Math.round(byOutcome.review * scale), contained: Math.round(byOutcome.contained * scale) },
    annualized: Math.round(totalCapacity * 365),
    agents: team.length,
    validations: validations.slice(0, 12)
  };
}
