export const objectives = [
  { id: 'margin', label: 'Protect margins', description: 'Reject or review actions that sacrifice profitability without strategic value.', weight: 0.32 },
  { id: 'cash', label: 'Protect cash flow', description: 'Keep payments and commitments aligned with reserve goals.', weight: 0.24 },
  { id: 'customer', label: 'Protect customers', description: 'Prevent confusing, risky, or low-quality customer interactions.', weight: 0.24 },
  { id: 'velocity', label: 'Increase velocity', description: 'Let safe actions continue automatically instead of waiting for manual review.', weight: 0.2 }
];

export function validateWithAstra(decision) {
  const marginScore = clamp(0.5 + decision.marginImpact / 2);
  const cashScore = clamp(0.5 + decision.cashImpact / 2);
  const customerScore = clamp(0.5 + decision.customerImpact / 2);
  const velocityScore = decision.reversible ? 0.92 : 0.58;
  const score = objectives.reduce((sum, objective) => {
    const value = objective.id === 'margin' ? marginScore : objective.id === 'cash' ? cashScore : objective.id === 'customer' ? customerScore : velocityScore;
    return sum + value * objective.weight;
  }, 0) * decision.confidence;

  const reasons = [];
  if (decision.valueUsd > 50000) reasons.push('High financial exposure requires additional authority.');
  if (decision.marginImpact < -0.18) reasons.push('Potential margin degradation detected.');
  if (decision.cashImpact < -0.22) reasons.push('Potential cash-flow pressure detected.');
  if (decision.customerImpact < -0.2) reasons.push('Customer impact is uncertain or negative.');
  if (!decision.reversible) reasons.push('Action is difficult to reverse once it reaches reality.');

  if (score >= 0.6 && reasons.length === 0) return { decisionId: decision.id, outcome: 'reality', score, reasons: ['Aligned with objectives; safe to execute automatically.'] };
  if (score < 0.42 || reasons.length >= 3) return { decisionId: decision.id, outcome: 'contained', score, reasons, routedTo: 'Astra containment queue' };
  return { decisionId: decision.id, outcome: 'review', score, reasons: reasons.length ? reasons : ['Material uncertainty requires human judgment.'], routedTo: `${decision.department} review lane` };
}

function clamp(value) { return Math.max(0, Math.min(1, value)); }
