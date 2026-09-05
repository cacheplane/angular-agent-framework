import { describe, expect, it, vi, afterEach } from 'vitest';
import { syntheticCorpus } from '../src/pilot/fixtures.js';
import { validateCorpus, corpusHash } from '../src/pilot/corpus.js';
import { validateCandidate } from '../src/pilot/validation.js';
import {
  createPilotContext,
  withPilotContext,
  readEvidence,
  submitCandidate,
  countModelRequest,
} from '../src/pilot/context.js';
const candidate = {
  profile: { name: 'Atlas Synthetic', description: null, industry: null },
  unknowns: ['description', 'industry'],
  claims: [
    {
      text: 'Atlas builds tools.',
      citations: [
        {
          sourceId: 'source-1',
          quote: 'Atlas Synthetic builds observability software.',
        },
      ],
    },
  ],
};
afterEach(() => vi.unstubAllEnvs());
describe('company pilot contracts', () => {
  it('keeps asynchronous evidence reads within their server-selected cases', async () => {
    vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
    const cases = syntheticCorpus.cases.slice(0, 2);
    const results = await Promise.all(
      cases.map((c) =>
        withPilotContext(createPilotContext(c), async () => {
          await Promise.resolve();
          return readEvidence({ sourceId: 'source-1' });
        })
      )
    );
    expect(results[0]).toMatchObject({
      facts: ['Atlas Synthetic builds observability software.'],
    });
    expect(results[1]).toMatchObject({
      facts: ['Beacon Synthetic is a company.'],
    });
  });
  it('validates six labeled fixtures and rejects extra identity fields and mutated hashes', () => {
    expect(validateCorpus(syntheticCorpus).cases).toHaveLength(6);
    expect(corpusHash(syntheticCorpus)).toMatch(/^[a-f0-9]{64}$/);
    expect(() =>
      validateCorpus({ ...syntheticCorpus, email: 'a@example.com' })
    ).toThrow();
    const mutated = structuredClone(syntheticCorpus);
    const page = mutated.cases[0]?.pages[0];
    if (!page) throw new Error('Fixture page required');
    page.facts = ['changed'];
    expect(() => validateCorpus(mutated)).toThrow(/hash/);
  });
  it('validates exact source excerpts and rejects cross-case IDs, duplicates and identity fields', () => {
    const c = fixtureCase(0);
    expect(validateCandidate(candidate, c).status).toBe('structurally_valid');
    expect(
      validateCandidate({ ...candidate, email: 'bad' }, c).reasonCodes
    ).toContain('schema');
    expect(
      validateCandidate(
        { ...candidate, claims: [candidate.claims[0], candidate.claims[0]] },
        c
      ).reasonCodes
    ).toContain('duplicate_claim');
    expect(
      validateCandidate(
        {
          ...candidate,
          claims: [
            {
              text: 'Bad',
              citations: [{ sourceId: 'foreign', quote: 'fake' }],
            },
          ],
        },
        c
      ).reasonCodes
    ).toContain('invalid_source');
    expect(
      validateCandidate(
        {
          ...candidate,
          claims: [
            {
              text: 'Bad',
              citations: [{ sourceId: 'source-1', quote: 'fake' }],
            },
          ],
        },
        c
      ).reasonCodes
    ).toContain('quote_not_found');
  });
  it('requires local operator authorization and counts failed reads before enforcing caps', () => {
    expect(() => readEvidence({ sourceId: 'source-1' })).toThrow();
    vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
    const ctx = createPilotContext(fixtureCase(0));
    withPilotContext(ctx, () => {
      for (let i = 0; i < 6; i++)
        expect(() => readEvidence({ sourceId: 'foreign' })).toThrow(/source/);
      expect(() => readEvidence({ sourceId: 'source-1' })).toThrow(
        /evidence_limit/
      );
    });
    expect(ctx.evidenceReads).toBe(6);
  });
  it('fences late submissions and enforces six model requests', () => {
    vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
    const ctx = createPilotContext(fixtureCase(0));
    withPilotContext(ctx, () => {
      for (let i = 0; i < 6; i++) countModelRequest();
      expect(() => countModelRequest()).toThrow(/model_limit/);
      ctx.controller.abort();
      expect(() => submitCandidate(candidate)).toThrow();
      expect(ctx.candidate).toBeUndefined();
    });
  });
  it('rejects identity text, unsupported nonnull profiles and retains rejected submissions', () => {
    const c = fixtureCase(0);
    expect(
      validateCandidate(
        {
          ...candidate,
          profile: { ...candidate.profile, name: 'a@example.com' },
        },
        c
      ).reasonCodes
    ).toContain('identity_content');
    expect(
      validateCandidate({ ...candidate, claims: [] }, c).reasonCodes
    ).toContain('profile_without_claims');
    vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
    const ctx = createPilotContext(c);
    withPilotContext(ctx, () => {
      submitCandidate(candidate);
      submitCandidate({ ...candidate, email: 'bad' });
    });
    expect(ctx.candidate).toBeUndefined();
    expect(ctx.validation?.reasonCodes).toContain('schema');
    expect(ctx.attempts).toHaveLength(2);
    expect(ctx.attempts[0]?.candidate).toBeDefined();
    expect(ctx.attempts[1]?.candidate).toBeUndefined();
  });
});

function fixtureCase(index: number) {
  const fixture = syntheticCorpus.cases[index];
  if (!fixture) throw new Error('Synthetic fixture is required');
  return fixture;
}
