export const SALES_WORKFLOW_ID = 'autonomous_sales_team';
export const SALES_FINANCE_SCHEMA = 'sales_pipeline_action';

const salesActions = [
  'lead.find_company',
  'lead.research_prospect',
  'lead.score',
  'email.write',
  'email.follow_up',
  'meeting.book',
  'crm.update'
];

export function createSalesTeam({ reps = 100, decisionsPerRepPerDay = 1000 } = {}) {
  return Array.from({ length: reps }, (_, index) => ({
    id: `sales-rep-${String(index + 1).padStart(3, '0')}`,
    name: `Autonomous Sales Rep ${index + 1}`,
    workflowId: SALES_WORKFLOW_ID,
    decisionsPerDay: decisionsPerRepPerDay,
    actions: salesActions,
    authority: {
      maxDealValueUsd: 250000,
      canSendEmail: true,
      canUpdateCrm: true,
      canBookMeeting: true
    }
  }));
}

export function createSalesWorkflowAction({ rep, seed, companyName = `Company ${seed}`, prospectTitle = 'CFO' }) {
  const operation = rep.actions[seed % rep.actions.length];
  const dealValue = 5000 + ((seed * 7919) % 245000);
  return {
    operation,
    amount_usd: dealValue,
    params: {
      agent_id: rep.id,
      company_name: companyName,
      prospect_title: prospectTitle,
      prospect_email_hash: `prospect_${seed}_hash`,
      crm_object_id: `crm_${seed}`,
      proposed_subject: operation.startsWith('email') ? `Can Astra help ${companyName} automate financial reviews?` : undefined,
      meeting_duration_minutes: operation === 'meeting.book' ? 30 : undefined
    },
    finance_schema: SALES_FINANCE_SCHEMA,
    metadata: {
      source: 'autonomous_sales_team',
      requires_astra_before_reality: true,
      generated_at: new Date(0).toISOString()
    }
  };
}

export function salesTeamCapacity(team = createSalesTeam()) {
  return team.reduce((sum, rep) => sum + rep.decisionsPerDay, 0);
}
