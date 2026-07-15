# Astra Autonomous Sales Team

This repo implements the first Astra operating-company wedge: **100 autonomous AI sales reps** making **100,000 sales decisions per day**, with every decision routed through Astra before it can touch email, CRM, or calendars.

## What is included

- A 100-rep autonomous sales team model with 1,000 decisions per rep per day.
- A real Astra Cloud / Astra Private Workflow Twin client matching the documented `https://app.codeastra.dev/v1/<astra_key>/<world_id>` API shape.
- A production helper that evaluates a workflow action, executes only on `ready_for_reality`, sends review-required work to review, blocks unsafe work, and reports outcomes back to Astra.
- A dependency-free browser dashboard showing 100,000 daily sales decisions governed by Astra.
- Node test coverage for the Astra client, route handling, sales capacity, unsafe-action containment, and operating metrics.

## Production API wiring

Configure Astra with:

```bash
ASTRA_BASE_URL=https://app.codeastra.dev
ASTRA_API_KEY=<astra_key>
ASTRA_WORLD_ID=<world_id>
```

Use Astra Cloud at `https://app.codeastra.dev` as the hosted production endpoint, or Astra Private when you need the runtime inside your own VPC/on-prem environment. See `docs-api-requirements.md` for the exact endpoint contract and external APIs needed.

## Run it

```bash
npm run dev
npm run simulate
npm test
```

## Operating story

```text
100 AI sales reps
    ↓
Find companies / research prospects / score leads / write emails / follow up / book meetings / update CRM
    ↓
Astra Workflow Twin
    ↓
ready_for_reality / review_required / blocked
    ↓
Only ready_for_reality reaches email, CRM, or calendar reality
```
