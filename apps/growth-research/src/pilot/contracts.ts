import { z } from 'zod';
const field = z.enum(['name', 'description', 'industry']);
export const PageSchema = z.strictObject({
  canonicalUrl: z.url().refine((v) => new URL(v).protocol === 'https:'),
  retrievedAt: z.iso.datetime(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  facts: z.array(z.string().min(1).max(240)).max(6),
  snippets: z.array(z.string().min(1).max(240)).max(6),
});
export const CaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  kind: z.enum(['synthetic', 'public']),
  domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
  pages: z.array(PageSchema).max(3),
  expected: z.strictObject({
    claims: z.array(z.string().min(1).max(500)).max(20),
    unknowns: z.array(field).max(3),
    contradiction: z.boolean(),
  }),
  acquisitionError: z.string().max(200).optional(),
});
export const CorpusSchema = z.strictObject({
  version: z.string().min(1).max(80),
  repetitions: z.union([z.literal(1), z.literal(2)]),
  cases: z.array(CaseSchema).min(1).max(6),
});
export const CandidateSchema = z.strictObject({
  profile: z.strictObject({
    name: z.string().min(1).max(120).nullable(),
    description: z.string().min(1).max(500).nullable(),
    industry: z.string().min(1).max(120).nullable(),
  }),
  unknowns: z.array(field).max(3),
  claims: z
    .array(
      z.strictObject({
        text: z.string().min(1).max(300),
        citations: z
          .array(
            z.strictObject({
              sourceId: z.string().min(1).max(40),
              quote: z.string().min(1).max(240),
            })
          )
          .min(1)
          .max(3),
      })
    )
    .max(12),
});
export type PilotCase = z.infer<typeof CaseSchema>;
export type Corpus = z.infer<typeof CorpusSchema>;
export type Candidate = z.infer<typeof CandidateSchema>;
export type Validation = {
  status: 'structurally_valid' | 'rejected';
  reasonCodes: string[];
};
export type SubmissionAttempt = {
  validation: Validation;
  candidate?: Candidate;
};
export const sourceIds = (c: PilotCase) =>
  c.pages.map((_, i) => `source-${i + 1}`);
