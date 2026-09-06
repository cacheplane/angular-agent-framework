import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CandidateSchema, PageSchema } from '../pilot/contracts.js';

export const productionGraphId = 'growth_company';
export const requestMaxAgeMs = 120_000;
export const CompanyRequestSchema = z.strictObject({
  version: z.literal('company_research.request.v1'),
  attemptId: z.uuid(),
  domain: z
    .string()
    .max(253)
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/),
  pages: z
    .array(
      PageSchema.extend({
        canonicalUrl: PageSchema.shape.canonicalUrl.max(2048),
      })
    )
    .max(3),
  evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.iso.datetime(),
  generationRef: z.string().regex(/^[a-zA-Z0-9._-]{1,100}$/),
});
export type CompanyRequest = z.infer<typeof CompanyRequestSchema>;
export function hashCompanyEvidence(
  domain: string,
  pages: CompanyRequest['pages']
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        domain,
        pages: pages.map((page) => PageSchema.parse(page)),
      })
    )
    .digest('hex');
}
export function parseCompanyRequest(
  input: unknown,
  now = Date.now(),
  options: { allowExpired?: boolean } = {}
): CompanyRequest {
  const r = CompanyRequestSchema.parse(input);
  const remaining = Date.parse(r.expiresAt) - now;
  if ((!options.allowExpired && remaining <= 0) || remaining > requestMaxAgeMs)
    throw new Error('invalid_expiry');
  const host = (value: string) => value.replace(/^www\./, '');
  if (
    r.pages.some((page) => {
      const url = new URL(page.canonicalUrl);
      return (
        url.username ||
        url.password ||
        url.hash ||
        url.port ||
        host(url.hostname) !== host(r.domain)
      );
    })
  )
    throw new Error('invalid_source');
  if (hashCompanyEvidence(r.domain, r.pages) !== r.evidenceHash)
    throw new Error('evidence_hash_mismatch');
  return r;
}
export const CompanyResultSchema = z.strictObject({
  version: z.literal('company_research.result.v1'),
  attemptId: z.uuid(),
  evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
  generationRef: z.string(),
  outcome: z.enum([
    'completed',
    'rejected',
    'cancelled',
    'deadline',
    'model_limit',
    'evidence_limit',
    'submission_limit',
    'failed',
    'skipped',
  ]),
  candidate: CandidateSchema.optional(),
  validation: z.strictObject({
    status: z.enum(['structurally_valid', 'rejected']),
    reasonCodes: z.array(z.string()),
  }),
  modelCalls: z.number().int().min(0).max(6),
  evidenceReads: z.number().int().min(0).max(6),
  usage: z.strictObject({
    inputTokens: z.number().nonnegative().nullable(),
    outputTokens: z.number().nonnegative().nullable(),
  }),
  model: z.literal('gpt-4.1-mini'),
  settledAt: z.iso.datetime().nullable(),
});
export type CompanyResult = z.infer<typeof CompanyResultSchema>;
