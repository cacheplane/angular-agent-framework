import { z } from 'zod';

const HttpsUrlSchema = z.url({ protocol: /^https$/u }).max(500);

export const CompanyPageEvidenceSchema = z
  .object({
    canonicalUrl: HttpsUrlSchema,
    retrievedAt: z.iso.datetime(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
    facts: z.array(z.string().min(1).max(240)).max(6),
    snippets: z.array(z.string().min(1).max(240)).max(6),
  })
  .strict();

export type CompanyPageEvidence = z.infer<typeof CompanyPageEvidenceSchema>;
