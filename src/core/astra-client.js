const DEFAULT_TIMEOUT_MS = 30000;

export function createAstraClient({
  baseUrl = process.env.ASTRA_BASE_URL,
  apiKey = process.env.ASTRA_API_KEY,
  worldId = process.env.ASTRA_WORLD_ID,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  if (!baseUrl) throw new Error('ASTRA_BASE_URL is required, for example https://app.codeastra.dev or your Astra Private base URL.');
  if (!apiKey) throw new Error('ASTRA_API_KEY is required. Store the Astra key as a secret.');
  if (!worldId) throw new Error('ASTRA_WORLD_ID is required, for example finance_world or sales_world.');

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const worldBasePath = `/v1/${encodeURIComponent(apiKey)}/${encodeURIComponent(worldId)}`;

  return {
    baseUrl: normalizedBaseUrl,
    worldId,

    async health() {
      return requestJson(`${normalizedBaseUrl}/health`, { method: 'GET', timeoutMs });
    },

    async workflowSchemas() {
      return requestJson(`${normalizedBaseUrl}${worldBasePath}/astra/workflows/schemas`, { method: 'GET', timeoutMs });
    },

    async normalizeWorkflow(workflowId, payload) {
      return requestJson(`${normalizedBaseUrl}${worldBasePath}/astra/workflows/${encodeURIComponent(workflowId)}/normalize`, {
        method: 'POST',
        payload,
        timeoutMs
      });
    },

    async evaluateWorkflowAction(workflowId, action) {
      return requestJson(`${normalizedBaseUrl}${worldBasePath}/astra/workflows/${encodeURIComponent(workflowId)}/twin/actions`, {
        method: 'POST',
        payload: action,
        timeoutMs
      });
    },

    async reportWorkflowOutcome(workflowId, outcome) {
      return requestJson(`${normalizedBaseUrl}${worldBasePath}/astra/workflows/${encodeURIComponent(workflowId)}/outcomes`, {
        method: 'POST',
        payload: outcome,
        timeoutMs
      });
    },

    async authorityCheck(workflowId, payload) {
      return requestJson(`${normalizedBaseUrl}${worldBasePath}/astra/workflows/${encodeURIComponent(workflowId)}/authority/check`, {
        method: 'POST',
        payload,
        timeoutMs
      });
    },

    async dashboard() {
      return requestJson(`${normalizedBaseUrl}${worldBasePath}/astra/dashboard`, { method: 'GET', timeoutMs });
    },

    async status() {
      return requestJson(`${normalizedBaseUrl}${worldBasePath}/astra/status`, { method: 'GET', timeoutMs });
    },

    async usage() {
      return requestJson(`${normalizedBaseUrl}${worldBasePath}/astra/billing/usage`, { method: 'GET', timeoutMs });
    }
  };
}

export function routeToExecution(route) {
  if (route?.reality_route === 'ready_for_reality') return 'execute';
  if (route?.reality_route === 'review_required') return 'review';
  return 'block';
}

export async function evaluateThenMaybeExecute({ astra, workflowId, action, executeRealAction, sendToReview, blockAction }) {
  const route = await astra.evaluateWorkflowAction(workflowId, action);
  const executionRoute = routeToExecution(route);

  if (executionRoute === 'execute') {
    const realOutcome = await executeRealAction(route);
    await astra.reportWorkflowOutcome(workflowId, buildOutcome(action, realOutcome));
    return { route, executionRoute, realOutcome };
  }

  if (executionRoute === 'review') {
    const reviewOutcome = await sendToReview(route);
    await astra.reportWorkflowOutcome(workflowId, buildOutcome(action, reviewOutcome ?? 'manual_review'));
    return { route, executionRoute, realOutcome: reviewOutcome ?? 'manual_review' };
  }

  const blockedOutcome = await blockAction(route);
  await astra.reportWorkflowOutcome(workflowId, buildOutcome(action, blockedOutcome ?? 'blocked'));
  return { route, executionRoute, realOutcome: blockedOutcome ?? 'blocked' };
}

function buildOutcome(action, outcome) {
  return {
    operation: action.operation,
    outcome: typeof outcome === 'string' ? outcome : outcome?.outcome,
    amount_usd: action.amount_usd,
    customer_id: action.params?.customer_id,
    finance_schema: action.finance_schema,
    metadata: action.metadata
  };
}

async function requestJson(url, { method, payload, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Astra request failed with ${response.status}: ${details}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
