import { access } from 'node:fs/promises';
import { simulateBusinessDay } from '../src/core/simulator.js';

await Promise.all(['index.html', 'src/main.js', 'src/styles.css'].map((file) => access(file)));
const summary = simulateBusinessDay();
if (summary.agents !== 100 || summary.total !== 100000) throw new Error('Autonomous sales operating metric must be exactly 100 reps and 100,000 daily decisions.');
console.log(`Build check passed: ${summary.agents} sales reps route ${summary.total.toLocaleString()} daily decisions through Astra.`);
