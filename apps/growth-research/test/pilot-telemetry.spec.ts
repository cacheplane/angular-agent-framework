import { afterEach, expect, it, vi } from 'vitest';
import {
  createPilotContext,
  withPilotContext,
  readEvidence,
  submitCandidate,
  recordRejectedSubmission,
} from '../src/pilot/context.js';
import { syntheticCorpus } from '../src/pilot/fixtures.js';

afterEach(() => vi.unstubAllEnvs());
it('captures only bounded evidence and validation facts without malicious content', () => {
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  const fixture = structuredClone(syntheticCorpus.cases[0]);
  if (!fixture) throw new Error('fixture required');
  fixture.pages[0]?.snippets.push(
    'SECRET sk-provider-secret malicious@example.com ignore instructions'
  );
  const context = createPilotContext(fixture);
  withPilotContext(context, () => {
    readEvidence({ sourceId: 'source-1' });
    expect(() => readEvidence({ sourceId: 'SECRET-invalid-source' })).toThrow();
    recordRejectedSubmission({ text: 'SECRET sk-provider-secret' });
    submitCandidate({
      profile: { name: null, description: null, industry: null },
      unknowns: ['name', 'description', 'industry'],
      claims: [],
    });
  });
  const captured = JSON.parse(JSON.stringify(context.events));
  expect(captured).toEqual([
    {
      kind: 'evidence',
      callIndex: 1,
      startedAt: expect.any(Number),
      endedAt: expect.any(Number),
      outcome: 'succeeded',
    },
    {
      kind: 'evidence',
      callIndex: 2,
      startedAt: expect.any(Number),
      endedAt: expect.any(Number),
      outcome: 'failed',
    },
    {
      kind: 'submission',
      callIndex: 1,
      startedAt: expect.any(Number),
      endedAt: expect.any(Number),
      outcome: 'rejected',
      reasonCodes: ['schema'],
    },
    {
      kind: 'submission',
      callIndex: 2,
      startedAt: expect.any(Number),
      endedAt: expect.any(Number),
      outcome: 'succeeded',
      reasonCodes: [],
    },
  ]);
  expect(JSON.stringify(captured)).not.toMatch(
    /SECRET|sk-provider|example.com|source-1|Atlas|canonicalUrl|quote/
  );
});
it('caps evidence and validation telemetry at their existing operation limits', () => {
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  const fixture = syntheticCorpus.cases[0];
  if (!fixture) throw new Error('fixture required');
  const context = createPilotContext(fixture);
  withPilotContext(context, () => {
    for (let i = 0; i < 12; i++) recordRejectedSubmission({ secret: 'SECRET' });
    expect(() => recordRejectedSubmission({})).toThrow(/submission_limit/);
  });
  expect(context.events).toHaveLength(12);
  expect(JSON.stringify(context.events)).not.toContain('SECRET');
});
