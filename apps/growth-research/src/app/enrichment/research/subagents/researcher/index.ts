import { agent } from '@dawn-ai/sdk';

export default agent({
  model: 'gpt-4.1-mini',
  description: 'Review a bounded synthetic fixture and return its evidence.',
  systemPrompt: 'You are the synthetic evidence specialist. Read only the named atlas or beacon fixture with readFixture. Return evidence with its fixture source. Never access real subjects or promote candidate claims.',
  tools: { allow: ['readFixture'], deny: ['coordinatorSummary'] },
  delegation: { default: 'deny' },
  recursionLimit: 12,
  retry: { maxAttempts: 1 },
});
