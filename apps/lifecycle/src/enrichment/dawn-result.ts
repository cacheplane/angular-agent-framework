// Shared wire contract is staged with the standalone research app and imported
// here without importing its graph, model bootstrap or runtime credentials.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  CompanyRequestSchema,
  CompanyResultSchema,
  hashCompanyEvidence,
} from '../../../growth-research/src/production/contracts.js';
// eslint-disable-next-line @nx/enforce-module-boundaries -- use the managed candidate validator at publication
import { validateCandidate } from '../../../growth-research/src/pilot/validation.js';

/** Revalidate the remote candidate against the original persisted snapshot. */
export function companyArtifact(
  input: unknown,
  output: unknown,
  remote: { threadId: string; runId: string }
): Record<string, unknown> {
  const request = CompanyRequestSchema.parse(input);
  const result = CompanyResultSchema.parse(output);
  if (
    result.attemptId !== request.attemptId ||
    result.evidenceHash !== request.evidenceHash ||
    result.generationRef !== request.generationRef ||
    hashCompanyEvidence(request.domain, request.pages) !==
      request.evidenceHash ||
    result.outcome !== 'completed' ||
    !result.candidate ||
    !result.settledAt ||
    Date.parse(result.settledAt) > Date.parse(request.expiresAt)
  )
    throw new Error('dawn_result_mismatch');
  const validation = validateCandidate(result.candidate, {
    id: request.attemptId,
    kind: 'public',
    domain: request.domain,
    pages: request.pages,
    expected: { claims: [], unknowns: [], contradiction: false },
  });
  if (validation.status !== 'structurally_valid')
    throw new Error('dawn_candidate_rejected');
  return {
    ...result.candidate,
    evidenceScope: 'first_party_company_pages',
    sources: request.pages.map((page, index) => ({
      id: `source-${index + 1}`,
      canonicalUrl: page.canonicalUrl,
      retrievedAt: page.retrievedAt,
      contentHash: page.contentHash,
    })),
    execution: {
      ...remote,
      attemptId: request.attemptId,
      generationRef: request.generationRef,
      model: result.model,
      generatorVersion: 'dawn-company-v1',
    },
    validation,
  };
}
