import { agent } from '@dawn-ai/sdk';
import researcher from './subagents/researcher/index.js';

export default agent({
  model: 'gpt-4.1-mini',
  systemPrompt: 'Coordinate synthetic fixture research only. Accept atlas or beacon fixture IDs. Load the company-evidence skill, maintain the authored plan, and read the compiled fixture directly or delegate a bounded task to researcher. Cite fixture source identifiers. Do not research real people or companies or promote candidate memories to accepted facts.',
  tools: { allow: ['readFixture', 'coordinatorSummary'] },
  subagents: { researcher },
  delegation: { default: 'deny', rules: { researcher: { action: 'allow' } } },
  recursionLimit: 12,
  retry: { maxAttempts: 1 },
});
