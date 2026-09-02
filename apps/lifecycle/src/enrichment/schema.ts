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

const CitedSignalSchema = z
  .object({
    signal: z.string().min(1).max(300),
    source_ids: z.array(z.string().min(1).max(40)).min(1).max(3),
  })
  .strict();

const CompanyProfileSchema = z
  .object({
    name: z.string().min(1).max(120).nullable(),
    description: z.string().min(1).max(500).nullable(),
    industry: z.string().min(1).max(120).nullable(),
  })
  .strict();

const SourceSchema = z
  .object({
    id: z.string().min(1).max(40),
    url: HttpsUrlSchema,
    retrieved_at: z.iso.datetime(),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();

export const CampaignEvidenceAngleSchema = z.enum([
  'streaming_foundation',
  'debugging_layers',
  'event_state_boundary',
]);

const DraftSchema = z
  .object({
    angle_id: CampaignEvidenceAngleSchema,
    source_id: z.string().min(1).max(40),
  })
  .strict()
  .nullable();

export const DeterministicScoreReasonSchema = z
  .object({
    code: z.enum([
      'content.architecture_or_comparison',
      'content.pricing_security_deployment',
      'docs.install_command_copied',
      'transport.connected',
      'runtime.first_stream_completed',
      'thread.persisted',
      'interrupt.handled',
      'generative_ui.rendered',
      'project.returned_7d',
      'contact.approved_work_email_form',
    ]),
    points: z.number().int().min(1).max(1_000),
    identifiers: z.array(z.string().min(1).max(200)).min(1).max(10),
  })
  .strict();

export const EnrichmentArtifactSchema = z
  .object({
    summary: z.string().min(1).max(1_000),
    confidence: z.enum(['low', 'medium', 'high']),
    cited_signals: z.array(CitedSignalSchema).max(8),
    company_profile: CompanyProfileSchema,
    score_version: z.string().min(1).max(200),
    score_reasons: z.array(DeterministicScoreReasonSchema).max(10),
    recommended_angle: z.string().min(1).max(500),
    sources: z.array(SourceSchema).max(3),
    drafts: z.array(DraftSchema).length(3),
  })
  .strict();

export type CompanyPageEvidence = z.infer<typeof CompanyPageEvidenceSchema>;
export type EnrichmentArtifact = z.infer<typeof EnrichmentArtifactSchema>;
