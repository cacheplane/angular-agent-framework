import { expect, it } from 'vitest';
import { companyArtifact } from './dawn-result.js';
// eslint-disable-next-line @nx/enforce-module-boundaries -- exercise the actual managed wire hash
import { hashCompanyEvidence } from '../../../growth-research/src/production/contracts.js';

const pages = [
  {
    canonicalUrl: 'https://example.com/',
    retrievedAt: '2026-09-05T00:00:00.000Z',
    contentHash: 'a'.repeat(64),
    facts: ['Example builds test software.'],
    snippets: [],
  },
];
const request = {
  version: 'company_research.request.v1' as const,
  attemptId: '650e8400-e29b-41d4-a716-446655440000',
  domain: 'example.com',
  pages,
  evidenceHash: hashCompanyEvidence('example.com', pages),
  expiresAt: '2026-09-05T00:02:00.000Z',
  generationRef: 'fixture',
};
const result = {
  version: 'company_research.result.v1',
  attemptId: request.attemptId,
  evidenceHash: request.evidenceHash,
  generationRef: request.generationRef,
  outcome: 'completed',
  candidate: {
    profile: {
      name: 'Example',
      description: 'Builds test software.',
      industry: null,
    },
    unknowns: ['industry'],
    claims: [
      {
        text: 'Example builds test software.',
        citations: [
          { sourceId: 'source-1', quote: 'Example builds test software.' },
        ],
      },
    ],
  },
  validation: { status: 'structurally_valid', reasonCodes: [] },
  modelCalls: 4,
  evidenceReads: 2,
  usage: { inputTokens: 100, outputTokens: 30 },
  model: 'gpt-4.1-mini',
  settledAt: '2026-09-05T00:01:00.000Z',
};
const remote = {
  threadId: '550e8400-e29b-41d4-a716-446655440000',
  runId: '750e8400-e29b-41d4-a716-446655440000',
};

it('retains exact evidence and execution provenance without old campaign fields', () => {
  const artifact = companyArtifact(request, result, remote);
  expect(artifact['evidenceScope']).toBe('first_party_company_pages');
  expect(artifact).toMatchObject({
    profile: result.candidate.profile,
    claims: result.candidate.claims,
    unknowns: ['industry'],
    execution: { ...remote, attemptId: request.attemptId },
  });
  expect(artifact).not.toHaveProperty('confidence');
  expect(artifact).not.toHaveProperty('drafts');
});
it('rejects mismatched, late, unsuccessful and unsupported remote results', () => {
  for (const invalid of [
    { ...result, evidenceHash: 'b'.repeat(64) },
    { ...result, generationRef: 'another' },
    { ...result, settledAt: '2026-09-05T00:03:00.000Z' },
    { ...result, outcome: 'cancelled' },
    {
      ...result,
      candidate: {
        ...result.candidate,
        claims: [
          {
            text: 'Invented',
            citations: [{ sourceId: 'source-1', quote: 'not in source' }],
          },
        ],
      },
    },
  ])
    expect(() => companyArtifact(request, invalid, remote)).toThrow();
});
