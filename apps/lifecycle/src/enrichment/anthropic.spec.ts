import { describe, expect, it, vi } from 'vitest';

import { EnrichmentArtifactSchema, type EnrichmentArtifact } from './schema.js';
import {
  generateEnrichmentArtifact,
  type AnthropicEnrichmentDependencies,
} from './anthropic.js';
import type { ResearchInput } from './research-input.js';

const SIGNAL = new AbortController().signal;

const INPUT: ResearchInput = {
  researchMode: 'company',
  formFacts: {
    source: 'contact',
    displayName: 'Ada',
    companyName: 'Threadplane',
    companyDomain: 'threadplane.ai',
    timeline: 'this_quarter',
  },
  deterministicScore: {
    score: 72,
    scoreVersion: 'growth-score:v1',
    reasons: [
      {
        code: 'contact.approved_work_email_form',
        points: 30,
        identifiers: ['once'],
      },
    ],
  },
  companyPages: [
    {
      canonicalUrl: 'https://threadplane.ai/',
      retrievedAt: '2026-09-01T12:00:00.000Z',
      contentHash: 'a'.repeat(64),
      facts: ['Threadplane publishes Angular agent libraries.'],
      snippets: ['Production Angular primitives for agent interfaces.'],
    },
  ],
  linkedProjectSummary: {
    projectId: '00000000-0000-4000-8000-000000000001',
    summary: 'One linked Angular project reached its first agent run.',
    signals: ['runtime.first_stream_completed'],
  },
};

const ARTIFACT: EnrichmentArtifact = {
  summary: 'A bounded factual summary.',
  confidence: 'medium',
  cited_signals: [
    {
      signal: 'Uses Angular for agent interfaces.',
      source_ids: ['source-1'],
    },
  ],
  company_profile: {
    name: 'Threadplane',
    description: 'Angular agent-interface tooling.',
    industry: 'Developer tools',
  },
  score_version: 'growth-score:v1',
  score_reasons: [
    {
      code: 'contact.approved_work_email_form',
      points: 30,
      identifiers: ['once'],
    },
  ],
  recommended_angle: 'Offer a concise architecture review.',
  sources: [
    {
      id: 'source-1',
      url: 'https://threadplane.ai/',
      retrieved_at: '2026-09-01T12:00:00.000Z',
      content_hash: 'a'.repeat(64),
    },
  ],
  drafts: [
    { angle_id: 'streaming_foundation', source_id: 'source-1' },
    { angle_id: 'debugging_layers', source_id: 'source-1' },
    { angle_id: 'event_state_boundary', source_id: 'source-1' },
  ],
};

const NEUTRAL_INPUT: ResearchInput = {
  ...INPUT,
  researchMode: 'neutral',
  formFacts: { source: 'contact', displayName: 'Ada' },
  companyPages: [],
};

const NEUTRAL_ARTIFACT: EnrichmentArtifact = {
  ...ARTIFACT,
  cited_signals: [],
  company_profile: { name: null, description: null, industry: null },
  sources: [],
  drafts: [null, null, null],
};

function dependencies(parsedOutput: unknown = ARTIFACT) {
  const parse = vi.fn().mockResolvedValue({
    parsed_output: parsedOutput,
    stop_reason: 'end_turn',
  });
  const createClient = vi.fn(() => ({ messages: { parse } }));
  const deps: AnthropicEnrichmentDependencies = {
    createClient,
    getApiKey: vi.fn(() => 'test-key'),
    getModel: vi.fn(() => undefined),
  };
  return { deps, createClient, parse };
}

describe('EnrichmentArtifactSchema', () => {
  it('requires exactly three drafts', () => {
    expect(
      EnrichmentArtifactSchema.safeParse({
        ...ARTIFACT,
        drafts: ARTIFACT.drafts.slice(0, 2),
      }).success
    ).toBe(false);
    expect(
      EnrichmentArtifactSchema.safeParse({
        ...ARTIFACT,
        drafts: [...ARTIFACT.drafts, ARTIFACT.drafts[0]],
      }).success
    ).toBe(false);
  });

  it.each([
    ['outreachApprovedAt', '2026-09-01T12:00:00.000Z'],
    ['outreach_approved_at', '2026-09-01T12:00:00.000Z'],
    ['recipientEmail', 'ada@example.com'],
    ['recipient_email', 'ada@example.com'],
    ['dueAt', '2026-09-02T12:00:00.000Z'],
    ['due_at', '2026-09-02T12:00:00.000Z'],
    ['deliveryStatus', 'approved'],
    ['delivery_status', 'approved'],
    ['sendState', 'ready'],
    ['send_state', 'ready'],
  ])('forbids model-controlled %s', (field, value) => {
    expect(
      EnrichmentArtifactSchema.safeParse({ ...ARTIFACT, [field]: value })
        .success
    ).toBe(false);
  });

  it('rejects bounded fields and arrays that exceed their limits', () => {
    expect(
      EnrichmentArtifactSchema.safeParse({
        ...ARTIFACT,
        summary: 'x'.repeat(1_001),
      }).success
    ).toBe(false);
    expect(
      EnrichmentArtifactSchema.safeParse({
        ...ARTIFACT,
        cited_signals: Array.from(
          { length: 9 },
          () => ARTIFACT.cited_signals[0]
        ),
      }).success
    ).toBe(false);
    expect(
      EnrichmentArtifactSchema.safeParse({
        ...ARTIFACT,
        drafts: [
          { angle_id: 'streaming_foundation', source_id: 'x'.repeat(41) },
          null,
          null,
        ],
      }).success
    ).toBe(false);
  });

  it('rejects a non-HTTPS source URL', () => {
    expect(
      EnrichmentArtifactSchema.safeParse({
        ...ARTIFACT,
        sources: [{ ...ARTIFACT.sources[0], url: 'http://threadplane.ai/' }],
      }).success
    ).toBe(false);
  });
});

describe('generateEnrichmentArtifact', () => {
  it('sends a concrete homogeneous drafts item schema to messages.parse', async () => {
    const { deps, parse } = dependencies();

    await generateEnrichmentArtifact(INPUT, SIGNAL, deps);

    const format = parse.mock.calls[0]?.[0].output_config?.format as
      | {
          schema?: {
            properties?: {
              drafts?: {
                items?: unknown;
              };
            };
          };
        }
      | undefined;
    expect(format?.schema?.properties?.drafts).toMatchObject({
      items: expect.objectContaining({
        anyOf: expect.arrayContaining([
          expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              angle_id: expect.any(Object),
              source_id: expect.any(Object),
            }),
          }),
        ]),
      }),
    });
  });

  it('makes exactly one strict messages.parse call with fixed limits, signal, timeout, and retries disabled', async () => {
    const { deps, createClient, parse } = dependencies();

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).resolves.toEqual(ARTIFACT);

    expect(createClient).toHaveBeenCalledOnce();
    expect(createClient).toHaveBeenCalledWith({
      apiKey: 'test-key',
      maxRetries: 0,
      timeout: 30_000,
    });
    expect(parse).toHaveBeenCalledOnce();
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        max_tokens: 1_200,
        messages: [
          expect.objectContaining({
            role: 'user',
            content: expect.any(String),
          }),
        ],
        output_config: {
          format: expect.objectContaining({ type: 'json_schema' }),
        },
      }),
      { maxRetries: 0, signal: SIGNAL, timeout: 30_000 }
    );
  });

  it('uses the configured model without changing the other call limits', async () => {
    const { deps, parse } = dependencies();
    deps.getModel = vi.fn(() => 'claude-custom');

    await generateEnrichmentArtifact(INPUT, SIGNAL, deps);

    expect(parse.mock.calls[0]?.[0]).toMatchObject({
      max_tokens: 1_200,
      model: 'claude-custom',
    });
  });

  it('does not place authorization, recipient, delivery, prompt, chat, tool, or raw telemetry fields in model input', async () => {
    const { deps, parse } = dependencies();

    await generateEnrichmentArtifact(INPUT, SIGNAL, deps);

    const message = parse.mock.calls[0]?.[0].messages[0];
    const content =
      message && typeof message.content === 'string'
        ? JSON.parse(message.content)
        : null;
    expect(content).not.toBeNull();
    expect(JSON.stringify(content)).not.toMatch(
      /outreach_approved|recipientEmail|dueAt|deliveryStatus|sendState|prompt|chat|toolData|telemetry/iu
    );
  });

  it.each([
    ['missing output', { parsed_output: null, stop_reason: 'end_turn' }],
    ['refusal', { parsed_output: null, stop_reason: 'refusal' }],
    [
      'malformed output',
      { parsed_output: { summary: 'partial' }, stop_reason: 'end_turn' },
    ],
  ])(
    'fails closed for %s without making a repair call',
    async (_label, response) => {
      const { deps, parse } = dependencies();
      parse.mockResolvedValue(response);

      await expect(
        generateEnrichmentArtifact(INPUT, SIGNAL, deps)
      ).rejects.toThrow();
      expect(parse).toHaveBeenCalledOnce();
    }
  );

  it('fails closed when the response stops at the output-token cap', async () => {
    const { deps, parse } = dependencies();
    parse.mockResolvedValue({
      parsed_output: ARTIFACT,
      stop_reason: 'max_tokens',
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).rejects.toThrow(/stop reason/u);
    expect(parse).toHaveBeenCalledOnce();
  });

  it('rejects model attempts to alter immutable deterministic score metadata', async () => {
    const { deps, parse } = dependencies({
      ...ARTIFACT,
      score_reasons: [
        {
          code: 'docs.install_command_copied',
          points: 5,
          identifiers: ['once'],
        },
      ],
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).rejects.toThrow(/deterministic score/u);
    expect(parse).toHaveBeenCalledOnce();
  });

  it('rejects an invented source id even when the evidence metadata matches', async () => {
    const { deps, parse } = dependencies({
      ...ARTIFACT,
      cited_signals: [{ signal: 'Claim', source_ids: ['source-99'] }],
      sources: [{ ...ARTIFACT.sources[0], id: 'source-99' }],
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).rejects.toThrow(/source/u);
    expect(parse).toHaveBeenCalledOnce();
  });

  it('rejects source ids swapped across two bounded evidence pages', async () => {
    const secondPage = {
      canonicalUrl: 'https://threadplane.ai/about',
      retrievedAt: '2026-09-01T12:01:00.000Z',
      contentHash: 'b'.repeat(64),
      facts: ['Second fact.'],
      snippets: ['Second snippet.'],
    };
    const { deps, parse } = dependencies({
      ...ARTIFACT,
      sources: [
        {
          id: 'source-1',
          url: secondPage.canonicalUrl,
          retrieved_at: secondPage.retrievedAt,
          content_hash: secondPage.contentHash,
        },
        { ...ARTIFACT.sources[0], id: 'source-2' },
      ],
    });

    await expect(
      generateEnrichmentArtifact(
        { ...INPUT, companyPages: [...INPUT.companyPages, secondPage] },
        SIGNAL,
        deps
      )
    ).rejects.toThrow(/source/u);
    expect(parse).toHaveBeenCalledOnce();
  });

  it('rejects duplicate source ids', async () => {
    const { deps, parse } = dependencies({
      ...ARTIFACT,
      sources: [ARTIFACT.sources[0], ARTIFACT.sources[0]],
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).rejects.toThrow(/unique/u);
    expect(parse).toHaveBeenCalledOnce();
  });

  it('rejects company evidence without non-empty sources and cited signals', async () => {
    const { deps, parse } = dependencies({
      ...ARTIFACT,
      sources: [],
      cited_signals: [],
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).rejects.toThrow(/provenance/u);
    expect(parse).toHaveBeenCalledOnce();
  });

  it('rejects an emitted source that no cited signal references', async () => {
    const secondPage = {
      canonicalUrl: 'https://threadplane.ai/about',
      retrievedAt: '2026-09-01T12:01:00.000Z',
      contentHash: 'b'.repeat(64),
      facts: ['Second fact.'],
      snippets: ['Second snippet.'],
    };
    const { deps, parse } = dependencies({
      ...ARTIFACT,
      sources: [
        ARTIFACT.sources[0],
        {
          id: 'source-2',
          url: secondPage.canonicalUrl,
          retrieved_at: secondPage.retrievedAt,
          content_hash: secondPage.contentHash,
        },
      ],
    });

    await expect(
      generateEnrichmentArtifact(
        { ...INPUT, companyPages: [...INPUT.companyPages, secondPage] },
        SIGNAL,
        deps
      )
    ).rejects.toThrow(/uncited source/u);
    expect(parse).toHaveBeenCalledOnce();
  });

  it('accepts a null-profile neutral artifact without company provenance', async () => {
    const { deps } = dependencies(NEUTRAL_ARTIFACT);

    await expect(
      generateEnrichmentArtifact(NEUTRAL_INPUT, SIGNAL, deps)
    ).resolves.toEqual(NEUTRAL_ARTIFACT);
  });

  it('rejects neutral-mode company claims', async () => {
    const { deps, parse } = dependencies({
      ...NEUTRAL_ARTIFACT,
      company_profile: {
        name: 'Claimed Company',
        description: null,
        industry: null,
      },
    });

    await expect(
      generateEnrichmentArtifact(NEUTRAL_INPUT, SIGNAL, deps)
    ).rejects.toThrow(/neutral provenance/iu);
    expect(parse).toHaveBeenCalledOnce();
  });
});
