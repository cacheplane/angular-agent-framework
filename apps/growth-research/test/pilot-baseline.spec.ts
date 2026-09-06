import { describe, expect, it } from 'vitest';
import { runBaseline } from '../src/pilot/baseline.js';

const page = {
  canonicalUrl: 'https://atlas.example/',
  retrievedAt: '2026-09-05T00:00:00.000Z',
  contentHash: 'a'.repeat(64),
  facts: ['Atlas builds developer tools.'],
  snippets: ['Atlas builds developer tools.'],
};
const output = {
  summary: 'Company context',
  confidence: 'low',
  company_profile: {
    name: 'Atlas',
    description: 'Developer tools',
    industry: null,
  },
  cited_signals: [
    { signal: 'Developer tools', source_ids: ['source-1', 'invented'] },
  ],
  recommended_angle: 'Unknown',
  drafts: [null, null, null],
};

describe('pilot baseline adapter', () => {
  it('preserves identical company evidence and raw invalid citations without inventing quotes', async () => {
    let body: unknown;
    const result = await runBaseline(
      { domain: 'atlas.example', pages: [page] },
      AbortSignal.timeout(1000),
      {
        getApiKey: () => 'fixture',
        getModel: () => 'test-model',
        createClient: (options) => {
          expect(options).toMatchObject({ maxRetries: 0, timeout: 30000 });
          return {
            messages: {
              parse: async (params) => {
                body = JSON.parse(String(params.messages[0].content));
                return {
                  parsed_output: output,
                  stop_reason: 'end_turn',
                  usage: { input_tokens: 10, output_tokens: 20 },
                };
              },
            },
          };
        },
      }
    );
    expect(body).toMatchObject({
      researchMode: 'company',
      companyPages: [{ id: 'source-1', ...page }],
      deterministicScore: { score: 0, reasons: [] },
    });
    expect(result.invalidCitationCount).toBe(1);
    expect(result.claims[0]).toEqual({
      text: 'Developer tools',
      sourceIds: ['source-1', 'invented'],
      quoteStatus: 'not_provided',
    });
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
  });
  it('reports missing usage as unavailable', async () => {
    const result = await runBaseline(
      { domain: 'atlas.example', pages: [page] },
      new AbortController().signal,
      {
        getApiKey: () => 'fixture',
        getModel: () => undefined,
        createClient: () => ({
          messages: {
            parse: async () => ({
              parsed_output: output,
              stop_reason: 'end_turn',
            }),
          },
        }),
      }
    );
    expect(result.usage).toEqual({ inputTokens: null, outputTokens: null });
  });
  it('rejects publication after cancellation', async () => {
    const abort = new AbortController();
    await expect(
      runBaseline({ domain: 'atlas.example', pages: [page] }, abort.signal, {
        getApiKey: () => 'fixture',
        getModel: () => undefined,
        createClient: () => ({
          messages: {
            parse: async () => {
              abort.abort();
              return { parsed_output: output, stop_reason: 'end_turn' };
            },
          },
        }),
      })
    ).rejects.toThrow();
  });
  it('retains attempted request counts and a safe billing code on provider failure', async () => {
    const error = Object.assign(new Error('secret message'), {
      status: 400,
      error: { error: { message: 'credit balance too low; billing required' } },
    });
    await expect(
      runBaseline(
        { domain: 'atlas.example', pages: [page] },
        new AbortController().signal,
        {
          getApiKey: () => 'fixture',
          getModel: () => undefined,
          createClient: () => ({
            messages: {
              parse: async () => {
                throw error;
              },
            },
          }),
        }
      )
    ).rejects.toMatchObject({
      message: 'provider_billing',
      modelCalls: 1,
      usage: { inputTokens: null, outputTokens: null },
    });
  });
});
