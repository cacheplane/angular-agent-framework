import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import {
  CampaignEvidenceAngleSchema,
  EnrichmentArtifactSchema,
  type EnrichmentArtifact,
} from './schema.js';
import type { ResearchInput } from './research-input.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1_200;
const TIMEOUT_MS = 30_000;
const CAMPAIGN_SLOT_COUNT = 3;
// The model judges only what it can judge. Provenance (`sources`) and the
// deterministic score fields are owned by this code and absent from the wire
// schema. The API's structured-output grammar also drops every length, min,
// and enum bound, so none appear here; normalizeArtifact applies them before
// the strict EnrichmentArtifactSchema parse. SDK 0.79's declaration resolves
// `zod` from the workspace root while its implementation consumes `zod/v4`;
// this app pins its own Zod 4, hence the cast at zodOutputFormat.
const WIRE_ARTIFACT_SCHEMA = z
  .object({
    summary: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
    cited_signals: z.array(
      z.object({ signal: z.string(), source_ids: z.array(z.string()) })
    ),
    company_profile: z.object({
      name: z.string().nullable(),
      description: z.string().nullable(),
      industry: z.string().nullable(),
    }),
    recommended_angle: z.string(),
    drafts: z.array(
      z.object({ angle_id: z.string(), source_id: z.string() }).nullable()
    ),
  })
  .strip();
const ARTIFACT_OUTPUT_FORMAT = zodOutputFormat(
  WIRE_ARTIFACT_SCHEMA as unknown as Parameters<typeof zodOutputFormat>[0]
);
const ANGLE_IDS = CampaignEvidenceAngleSchema.options.join(', ');
const SYSTEM_PROMPT =
  'Produce one bounded factual research artifact from the supplied evidence. ' +
  'The only citable source ids are the ids of the supplied companyPages entries; score identifiers, form fields, and project ids are not sources. ' +
  'Use neutral language for unknowns and leave company_profile fields null when no companyPages evidence supports them. ' +
  `drafts must contain exactly three entries, one per campaign slot in order. Each entry is either null or an object selecting one angle_id from [${ANGLE_IDS}] plus one cited companyPages source_id; use null for a slot with no cited angle. ` +
  'Never write recipient prose or personalized claims.';

type WireArtifact = z.infer<typeof WIRE_ARTIFACT_SCHEMA>;

// Any echo of the code-owned fields is discarded before the strict wire parse.
const CODE_OWNED_FIELDS = new Set([
  'sources',
  'score_version',
  'score_reasons',
]);
function stripCodeOwnedFields(parsedOutput: unknown): unknown {
  if (typeof parsedOutput !== 'object' || parsedOutput === null) {
    return parsedOutput;
  }
  return Object.fromEntries(
    Object.entries(parsedOutput as Record<string, unknown>).filter(
      ([key]) => !CODE_OWNED_FIELDS.has(key)
    )
  );
}

const MAX_CITED_SIGNALS = 8;
const MAX_SIGNAL_SOURCE_IDS = 3;

function nullIfBlank(value: string | null): string | null {
  return value !== null && value.trim().length > 0 ? value : null;
}

function normalizeArtifact(
  wire: WireArtifact,
  input: ResearchInput
): EnrichmentArtifact {
  const evidence = new Map(
    input.companyPages.map((page, index) => [`source-${index + 1}`, page])
  );
  const neutral = input.researchMode === 'neutral';
  const citedSignals = neutral
    ? []
    : wire.cited_signals
        .flatMap((signal) => {
          const sourceIds = [
            ...new Set(signal.source_ids.filter((id) => evidence.has(id))),
          ].slice(0, MAX_SIGNAL_SOURCE_IDS);
          return sourceIds.length === 0 || signal.signal.trim().length === 0
            ? []
            : [{ signal: signal.signal, source_ids: sourceIds }];
        })
        .slice(0, MAX_CITED_SIGNALS);
  const citedIds = new Set(citedSignals.flatMap((signal) => signal.source_ids));
  const sources = [...evidence]
    .filter(([id]) => citedIds.has(id))
    .map(([id, page]) => ({
      id,
      url: page.canonicalUrl,
      retrieved_at: page.retrievedAt,
      content_hash: page.contentHash,
    }));
  const drafts = Array.from({ length: CAMPAIGN_SLOT_COUNT }, (_, index) => {
    const draft = wire.drafts[index] ?? null;
    if (draft === null || !citedIds.has(draft.source_id)) return null;
    const angle = CampaignEvidenceAngleSchema.safeParse(draft.angle_id);
    return angle.success
      ? { angle_id: angle.data, source_id: draft.source_id }
      : null;
  });
  return {
    summary: wire.summary,
    confidence: wire.confidence,
    cited_signals: citedSignals,
    company_profile: neutral
      ? { name: null, description: null, industry: null }
      : {
          name: nullIfBlank(wire.company_profile.name),
          description: nullIfBlank(wire.company_profile.description),
          industry: nullIfBlank(wire.company_profile.industry),
        },
    score_version: input.deterministicScore.scoreVersion,
    score_reasons: input.deterministicScore.reasons,
    recommended_angle: wire.recommended_angle,
    sources,
    drafts,
  };
}

interface AnthropicClientOptions {
  apiKey: string;
  maxRetries: 0;
  timeout: 30_000;
}

interface ParseResponse {
  parsed_output: unknown;
  stop_reason: string | null;
}

interface MessagesParseClient {
  messages: {
    parse: (
      params: Parameters<Anthropic['messages']['parse']>[0],
      options: Parameters<Anthropic['messages']['parse']>[1]
    ) => Promise<ParseResponse>;
  };
}

export interface AnthropicEnrichmentDependencies {
  createClient: (options: AnthropicClientOptions) => MessagesParseClient;
  getApiKey: () => string | undefined;
  getModel: () => string | undefined;
}

const defaultDependencies: AnthropicEnrichmentDependencies = {
  createClient: (options) => new Anthropic(options),
  getApiKey: () => process.env['ANTHROPIC_API_KEY'],
  getModel: () => process.env['LIFECYCLE_ENRICHMENT_MODEL'],
};

function modelInput(input: ResearchInput): object {
  return {
    researchMode: input.researchMode,
    formFacts: input.formFacts,
    deterministicScore: input.deterministicScore,
    companyPages: input.companyPages.map((page, index) => ({
      id: `source-${index + 1}`,
      ...page,
    })),
    ...(input.linkedProjectSummary
      ? { linkedProjectSummary: input.linkedProjectSummary }
      : {}),
  };
}

function verifyArtifactInvariants(
  artifact: EnrichmentArtifact,
  input: ResearchInput
): void {
  if (input.researchMode === 'neutral') return;
  if (
    input.companyPages.length > 0 &&
    (artifact.sources.length === 0 || artifact.cited_signals.length === 0)
  ) {
    throw new Error('Company evidence requires non-empty provenance');
  }
}

export async function generateEnrichmentArtifact(
  input: ResearchInput,
  signal: AbortSignal,
  dependencies: AnthropicEnrichmentDependencies = defaultDependencies
): Promise<EnrichmentArtifact> {
  signal.throwIfAborted();
  const apiKey = dependencies.getApiKey();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required');
  const configuredModel = dependencies.getModel()?.trim();
  const client = dependencies.createClient({
    apiKey,
    maxRetries: 0,
    timeout: TIMEOUT_MS,
  });
  const response = await client.messages.parse(
    {
      model: configuredModel || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(modelInput(input)),
        },
      ],
      output_config: {
        format: ARTIFACT_OUTPUT_FORMAT,
      },
    },
    { maxRetries: 0, signal, timeout: TIMEOUT_MS }
  );

  if (response.stop_reason === 'refusal') {
    throw new Error('Anthropic refused the enrichment request');
  }
  if (response.stop_reason !== 'end_turn') {
    throw new Error(
      `Anthropic returned unsafe stop reason: ${
        response.stop_reason ?? 'missing'
      }`
    );
  }
  if (response.parsed_output === null) {
    throw new Error('Anthropic returned no structured enrichment output');
  }
  const wire = WIRE_ARTIFACT_SCHEMA.parse(
    stripCodeOwnedFields(response.parsed_output)
  );
  const artifact = EnrichmentArtifactSchema.parse(
    normalizeArtifact(wire, input)
  );
  verifyArtifactInvariants(artifact, input);
  return artifact;
}
