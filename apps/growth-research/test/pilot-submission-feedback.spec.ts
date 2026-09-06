import { afterEach, expect, it, vi } from 'vitest';
import tool from '../src/app/enrichment/company-pilot/tools/submitCandidate.js';
import { createPilotContext, withPilotContext } from '../src/pilot/context.js';
import { syntheticCorpus } from '../src/pilot/fixtures.js';
afterEach(() => vi.unstubAllEnvs());
it('locates bad citations for repair while retaining the unchanged validation contract', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  const fixture = syntheticCorpus.cases[0];
  if (!fixture) throw new Error('fixture required');
  const context = createPilotContext(fixture);
  const response = await withPilotContext(context, () =>
    tool({
      profile: { name: 'Atlas', description: null, industry: null },
      unknowns: ['description', 'industry'],
      claims: [
        {
          text: 'Atlas builds tools.',
          citations: [
            { sourceId: 'source-1', quote: 'Joined missing excerpt.' },
            { sourceId: 'invalid', quote: 'Also missing.' },
          ],
        },
      ],
    })
  );
  expect(response).toMatchObject({
    invalidCitations: [
      { claimIndex: 0, citationIndex: 0, reason: 'quote_not_found' },
      { claimIndex: 0, citationIndex: 1, reason: 'invalid_source' },
    ],
    citationInstruction: expect.stringContaining('citationOptions'),
  });
  expect(context.validation).toEqual({
    status: 'rejected',
    reasonCodes: [
      'claim_not_exact_excerpt',
      'quote_not_found',
      'invalid_source',
    ],
  });
  expect(context.attempts[0]?.validation).toEqual(context.validation);
});
