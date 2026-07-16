import { access } from 'node:fs/promises';
import { simulateXOpportunityDay } from '../src/core/x-growth.js';

await Promise.all(['index.html', 'src/main.js', 'src/styles.css'].map((file) => access(file)));
const summary = simulateXOpportunityDay();
if (summary.opportunities !== 10000) throw new Error('Autonomous X operating metric must be exactly 10,000 daily opportunities.');
console.log(`Build check passed: agent evaluates ${summary.opportunities.toLocaleString()} daily X opportunities.`);
