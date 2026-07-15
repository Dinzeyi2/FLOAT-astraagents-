import assert from 'node:assert/strict';
import test from 'node:test';
import { validateWithAstra } from '../core/astra.js';
import { createSalesTeam, salesTeamCapacity } from '../core/sales-team.js';
import { generateDecision, simulateBusinessDay } from '../core/simulator.js';

test('creates 100 autonomous sales reps', () => {
  assert.equal(createSalesTeam().length, 100);
});

test('targets 100,000 sales decisions per day through Astra', () => {
  assert.equal(salesTeamCapacity(createSalesTeam()), 100000);
});

test('routes unsafe sales decisions away from reality', () => {
  const validation = validateWithAstra({ ...generateDecision(1), id: 'dangerous-outreach', valueUsd: 500000, confidence: 0.3, marginImpact: -0.5, cashImpact: -0.5, customerImpact: -0.4, reversible: false });
  assert.equal(validation.outcome, 'contained');
});

test('produces a governed daily sales operating metric', () => {
  const summary = simulateBusinessDay(1000);
  assert.equal(summary.agents, 100);
  assert.equal(summary.total, 100000);
  assert.ok(summary.byOutcome.reality + summary.byOutcome.review + summary.byOutcome.contained >= summary.total - 2);
});
