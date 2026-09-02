import { z } from 'zod';

import {
  CompanyPageEvidenceSchema,
  DeterministicScoreReasonSchema,
  type CompanyPageEvidence,
} from './schema.js';

const PERSONAL_EMAIL_DOMAINS = new Set([
  'aol.com',
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'me.com',
  'msn.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'yahoo.com',
  'ymail.com',
]);

const DomainSchema = z
  .string()
  .min(3)
  .max(253)
  .regex(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu
  )
  .transform((domain) => domain.toLowerCase());

const FormFactsSchema = z
  .object({
    source: z.enum([
      'whitepaper',
      'newsletter',
      'contact',
      'pricing',
      'project-claim',
    ]),
    emailClassification: z.enum(['work', 'personal', 'unknown']),
    displayName: z.string().min(1).max(120).optional(),
    companyName: z.string().min(1).max(160).optional(),
    companyDomain: DomainSchema.optional(),
    paper: z.enum(['overview', 'angular', 'render', 'chat']).optional(),
    pilotInterest: z.enum(['yes', 'maybe', 'no']).optional(),
    teamSize: z.enum(['1-5', '6-25', '26-100', '100+']).optional(),
    timeline: z
      .enum(['this_quarter', 'next_quarter', '6_plus_months', 'exploring'])
      .optional(),
  })
  .strict();

const DeterministicScoreSchema = z
  .object({
    score: z.number().int().min(0).max(10_000),
    scoreVersion: z.string().min(1).max(200),
    reasons: z.array(DeterministicScoreReasonSchema).max(10),
  })
  .strict();

const LinkedProjectSummarySchema = z
  .object({
    projectId: z.uuid(),
    summary: z.string().min(1).max(600),
    signals: z
      .array(
        z.enum([
          'transport.connected',
          'runtime.first_stream_completed',
          'thread.persisted',
          'interrupt.handled',
          'generative_ui.rendered',
          'project.returned_7d',
        ])
      )
      .max(8),
  })
  .strict();

const ResearchCandidateSchema = z
  .object({
    formFacts: FormFactsSchema,
    deterministicScore: DeterministicScoreSchema,
    companyPages: z.array(CompanyPageEvidenceSchema).max(3),
    linkedProjectSummary: LinkedProjectSummarySchema.optional(),
  })
  .strict();

type ParsedCandidate = z.infer<typeof ResearchCandidateSchema>;

export interface ResearchInput {
  researchMode: 'company' | 'neutral';
  formFacts: Omit<ParsedCandidate['formFacts'], 'emailClassification'>;
  deterministicScore: ParsedCandidate['deterministicScore'];
  companyPages: CompanyPageEvidence[];
  linkedProjectSummary?: ParsedCandidate['linkedProjectSummary'];
}

export function buildResearchInput(candidate: unknown): ResearchInput {
  const parsed = ResearchCandidateSchema.parse(candidate);
  const { emailClassification, ...formFacts } = parsed.formFacts;
  const domain = parsed.formFacts.companyDomain;
  const researchMode =
    emailClassification !== 'personal' &&
    domain &&
    !PERSONAL_EMAIL_DOMAINS.has(domain)
      ? 'company'
      : 'neutral';

  return {
    researchMode,
    formFacts,
    deterministicScore: parsed.deterministicScore,
    companyPages: researchMode === 'company' ? parsed.companyPages : [],
    ...(parsed.linkedProjectSummary
      ? { linkedProjectSummary: parsed.linkedProjectSummary }
      : {}),
  };
}
