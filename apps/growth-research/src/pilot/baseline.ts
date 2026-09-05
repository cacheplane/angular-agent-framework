import Anthropic from '@anthropic-ai/sdk';
import {
  generateEnrichmentArtifact,
  type AnthropicEnrichmentDependencies,
} from '../../../lifecycle/src/enrichment/anthropic.js';
import { buildResearchInput } from '../../../lifecycle/src/enrichment/research-input.js';
import type { CompanyPageEvidence } from '../../../lifecycle/src/enrichment/schema.js';

export interface BaselineResult {
  profile: {
    name: string | null;
    description: string | null;
    industry: string | null;
  };
  claims: { text: string; sourceIds: string[]; quoteStatus: 'not_provided' }[];
  invalidCitationCount: number;
  usage: { inputTokens: number | null; outputTokens: number | null };
  model: string;
  modelCalls: number;
}

const defaults: AnthropicEnrichmentDependencies = {
  createClient: (options) => new Anthropic(options),
  getApiKey: () => process.env['ANTHROPIC_API_KEY'],
  getModel: () => process.env['LIFECYCLE_ENRICHMENT_MODEL'],
};

export class BaselineFailure extends Error {
  constructor(
    code: string,
    readonly modelCalls: number,
    readonly usage: BaselineResult['usage'],
    readonly claims: BaselineResult['claims'],
    readonly invalidCitationCount: number
  ) {
    super(code);
  }
}
function safeFailureCode(error: unknown) {
  const value = error as {
    status?: number;
    error?: { error?: { message?: string } };
  } | null;
  if (
    value?.status === 400 &&
    /credit|billing/i.test(value.error?.error?.message ?? '')
  )
    return 'provider_billing';
  if (value?.status === 401 || value?.status === 403) return 'provider_auth';
  if (value?.status === 429) return 'provider_rate_limit';
  return 'research_failed';
}

export async function runBaseline(
  input: { domain: string; pages: CompanyPageEvidence[] },
  signal: AbortSignal,
  dependencies: AnthropicEnrichmentDependencies = defaults
): Promise<BaselineResult> {
  signal.throwIfAborted();
  const research = buildResearchInput({
    formFacts: {
      source: 'contact',
      emailClassification: 'unknown',
      companyDomain: input.domain,
    },
    companyPages: input.pages,
    deterministicScore: {
      score: 0,
      scoreVersion: 'company-pilot-v1',
      reasons: [],
    },
  });
  if (research.researchMode !== 'company')
    throw new Error('pilot_company_domain_required');
  const claims: BaselineResult['claims'] = [];
  const allowed = new Set(input.pages.map((_, index) => `source-${index + 1}`));
  const invalidCount = () =>
    claims.flatMap((claim) => claim.sourceIds).filter((id) => !allowed.has(id))
      .length;
  const usage: BaselineResult['usage'] = {
    inputTokens: null,
    outputTokens: null,
  };
  let modelCalls = 0;
  const artifact = await generateEnrichmentArtifact(research, signal, {
    ...dependencies,
    createClient: (options) => {
      const client = dependencies.createClient(options);
      return {
        messages: {
          parse: async (params, options) => {
            signal.throwIfAborted();
            modelCalls++;
            const response = await client.messages.parse(params, options);
            signal.throwIfAborted();
            const raw = response.parsed_output as {
              cited_signals?: unknown;
            } | null;
            if (Array.isArray(raw?.cited_signals))
              for (const entry of raw.cited_signals) {
                if (
                  entry &&
                  typeof entry.signal === 'string' &&
                  Array.isArray(entry.source_ids) &&
                  entry.source_ids.every(
                    (id: unknown) => typeof id === 'string'
                  )
                ) {
                  claims.push({
                    text: entry.signal,
                    sourceIds: entry.source_ids,
                    quoteStatus: 'not_provided',
                  });
                }
              }
            const tokens = (
              response as typeof response & {
                usage?: { input_tokens?: number; output_tokens?: number };
              }
            ).usage;
            if (
              typeof tokens?.input_tokens === 'number' &&
              Number.isSafeInteger(tokens.input_tokens) &&
              tokens.input_tokens >= 0
            )
              usage.inputTokens = tokens.input_tokens;
            if (
              typeof tokens?.output_tokens === 'number' &&
              Number.isSafeInteger(tokens.output_tokens) &&
              tokens.output_tokens >= 0
            )
              usage.outputTokens = tokens.output_tokens;
            return response;
          },
        },
      };
    },
  }).catch((error) => {
    throw new BaselineFailure(
      safeFailureCode(error),
      modelCalls,
      usage,
      claims,
      invalidCount()
    );
  });
  signal.throwIfAborted();
  return {
    profile: artifact.company_profile,
    claims,
    invalidCitationCount: invalidCount(),
    usage,
    model: dependencies.getModel()?.trim() || 'claude-sonnet-4-6',
    modelCalls,
  };
}
