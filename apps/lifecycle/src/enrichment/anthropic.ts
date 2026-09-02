import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { EnrichmentArtifactSchema, type EnrichmentArtifact } from './schema.js';
import type { ResearchInput } from './research-input.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1_200;
const TIMEOUT_MS = 30_000;
// SDK 0.79's declaration resolves `zod` from the workspace root while its
// implementation deliberately consumes `zod/v4`. This app pins its own Zod 4.
const ARTIFACT_OUTPUT_FORMAT = zodOutputFormat(
  EnrichmentArtifactSchema as unknown as Parameters<typeof zodOutputFormat>[0]
);

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

function verifyDeterministicFields(
  artifact: EnrichmentArtifact,
  input: ResearchInput
): void {
  if (
    artifact.score_version !== input.deterministicScore.scoreVersion ||
    JSON.stringify(artifact.score_reasons) !==
      JSON.stringify(input.deterministicScore.reasons)
  ) {
    throw new Error('Model altered immutable deterministic score metadata');
  }

  if (input.researchMode === 'neutral') {
    const profileValues = Object.values(artifact.company_profile);
    if (
      artifact.sources.length !== 0 ||
      artifact.cited_signals.length !== 0 ||
      profileValues.some((value) => value !== null)
    ) {
      throw new Error('Neutral provenance must contain no company claims');
    }
    return;
  }

  if (
    input.companyPages.length > 0 &&
    (artifact.sources.length === 0 || artifact.cited_signals.length === 0)
  ) {
    throw new Error('Company evidence requires non-empty provenance');
  }

  const expectedSources = new Map(
    input.companyPages.map((page, index) => [`source-${index + 1}`, page])
  );
  const citedSourceIds = new Set(
    artifact.cited_signals.flatMap((signal) => signal.source_ids)
  );
  const sourceIds = new Set<string>();
  for (const source of artifact.sources) {
    if (sourceIds.has(source.id))
      throw new Error('Artifact source ids must be unique');
    sourceIds.add(source.id);
    const evidence = expectedSources.get(source.id);
    if (
      !evidence ||
      evidence.canonicalUrl !== source.url ||
      evidence.retrievedAt !== source.retrieved_at ||
      evidence.contentHash !== source.content_hash
    ) {
      throw new Error('Artifact cited a source outside the bounded evidence');
    }
    if (!citedSourceIds.has(source.id)) {
      throw new Error(`Artifact emitted uncited source: ${source.id}`);
    }
  }
  for (const signal of artifact.cited_signals) {
    if (signal.source_ids.some((sourceId) => !sourceIds.has(sourceId))) {
      throw new Error('Artifact signal cited an unknown source');
    }
  }
  for (const selection of artifact.drafts) {
    if (selection !== null && !citedSourceIds.has(selection.source_id)) {
      throw new Error('Artifact campaign angle selected uncited evidence');
    }
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
      system:
        'Produce one bounded factual research artifact from the supplied evidence. Cite only supplied source ids, use neutral language for unknowns, and preserve score_version and score_reasons exactly. For each campaign slot select only one allowed angle_id and a cited source_id; never write recipient prose or personalized claims.',
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
  const artifact = EnrichmentArtifactSchema.parse(response.parsed_output);
  verifyDeterministicFields(artifact, input);
  return artifact;
}
