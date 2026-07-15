const departmentPlan = [
  { department: 'Sales', count: 25, decisionsPerAgent: 820, responsibilities: ['send_email', 'update_crm', 'schedule_demo'], limit: 25000, risk: 0.62 },
  { department: 'Marketing', count: 20, decisionsPerAgent: 640, responsibilities: ['publish_content', 'change_pricing'], limit: 15000, risk: 0.58 },
  { department: 'Customer Success', count: 15, decisionsPerAgent: 520, responsibilities: ['respond_customer', 'update_crm'], limit: 12000, risk: 0.66 },
  { department: 'Engineering', count: 25, decisionsPerAgent: 720, responsibilities: ['create_issue', 'prioritize_bug', 'plan_release'], limit: 50000, risk: 0.7 },
  { department: 'Product', count: 15, decisionsPerAgent: 560, responsibilities: ['plan_release', 'change_pricing', 'create_issue'], limit: 35000, risk: 0.61 },
  { department: 'Operations', count: 10, decisionsPerAgent: 500, responsibilities: ['schedule_demo', 'update_crm', 'approve_expense'], limit: 18000, risk: 0.65 },
  { department: 'Finance', count: 10, decisionsPerAgent: 460, responsibilities: ['approve_expense', 'change_pricing'], limit: 100000, risk: 0.48 }
];

export function createAgentFleet() {
  return departmentPlan.flatMap(({ department, count, decisionsPerAgent, responsibilities, limit, risk }) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${department.toLowerCase().replaceAll(' ', '-')}-${String(index + 1).padStart(2, '0')}`,
      name: `${department} Autonomous Function ${index + 1}`,
      department,
      decisionsPerDay: decisionsPerAgent + (index % 5) * 37,
      responsibilities,
      authorityLimitUsd: limit,
      riskTolerance: risk
    }))
  );
}

export const agents = createAgentFleet();
