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

  it('tells the model there are exactly three campaign slots and names the allowed angle ids', async () => {
    const { deps, parse } = dependencies();

    await generateEnrichmentArtifact(INPUT, SIGNAL, deps);

    const system = String(parse.mock.calls[0]?.[0].system ?? '');
    expect(system).toMatch(/exactly three/u);
    expect(system).toMatch(/null/u);
    for (const angle of [
      'streaming_foundation',
      'debugging_layers',
      'event_state_boundary',
    ]) {
      expect(system).toContain(angle);
    }
  });

  it('pads a short drafts array to three slots with null instead of failing', async () => {
    const { deps, parse } = dependencies({
      ...ARTIFACT,
      drafts: [ARTIFACT.drafts[0]],
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).resolves.toEqual({
      ...ARTIFACT,
      drafts: [ARTIFACT.drafts[0], null, null],
    });
    expect(parse).toHaveBeenCalledOnce();
  });

  it('pads an empty drafts array to three null slots', async () => {
    const { deps } = dependencies({ ...ARTIFACT, drafts: [] });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).resolves.toEqual({ ...ARTIFACT, drafts: [null, null, null] });
  });

  it('nulls a repeated angle so that slot falls back to default copy', async () => {
    const { deps } = dependencies({
      ...ARTIFACT,
      drafts: [
        { angle_id: 'streaming_foundation', source_id: 'source-1' },
        { angle_id: 'streaming_foundation', source_id: 'source-1' },
        { angle_id: 'debugging_layers', source_id: 'source-1' },
      ],
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).resolves.toMatchObject({
      drafts: [
        { angle_id: 'streaming_foundation', source_id: 'source-1' },
        null,
        { angle_id: 'debugging_layers', source_id: 'source-1' },
      ],
    });
  });

  it('asks the model for distinct angles across the three slots', async () => {
    const { deps, parse } = dependencies();

    await generateEnrichmentArtifact(INPUT, SIGNAL, deps);

    expect(String(parse.mock.calls[0]?.[0].system ?? '')).toMatch(/distinct/u);
  });

  it('truncates more than three drafts to the three campaign slots', async () => {
    const { deps, parse } = dependencies({
      ...ARTIFACT,
      drafts: [...ARTIFACT.drafts, ARTIFACT.drafts[0]],
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).resolves.toEqual(ARTIFACT);
    expect(parse).toHaveBeenCalledOnce();
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

  it('omits sources and deterministic score fields from the wire schema so the model cannot echo them', async () => {
    const { deps, parse } = dependencies();

    await generateEnrichmentArtifact(INPUT, SIGNAL, deps);

    const format = parse.mock.calls[0]?.[0].output_config?.format as
      | { schema?: { properties?: Record<string, unknown> } }
      | undefined;
    const properties = format?.schema?.properties ?? {};
    expect(properties).not.toHaveProperty('sources');
    expect(properties).not.toHaveProperty('score_version');
    expect(properties).not.toHaveProperty('score_reasons');
    expect(properties).toHaveProperty('cited_signals');
    expect(properties).toHaveProperty('drafts');
  });

  it('always carries the deterministic score metadata from the input, ignoring model output', async () => {
    const { deps, parse } = dependencies({
      ...ARTIFACT,
      score_version: 'tampered',
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
    ).resolves.toEqual(ARTIFACT);
    expect(parse).toHaveBeenCalledOnce();
  });

  it('derives sources from the bounded evidence for cited ids instead of trusting model provenance', async () => {
    const { deps } = dependencies({
      ...ARTIFACT,
      sources: [
        {
          id: 'source-1',
          url: 'https://elsewhere.invalid/',
          retrieved_at: '2026-09-01T12:00:00Z',
          content_hash: 'f'.repeat(64),
        },
      ],
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).resolves.toEqual(ARTIFACT);
  });

  it('drops signals that cite ids outside the bounded evidence and nulls drafts that pointed at them', async () => {
    const { deps } = dependencies({
      ...ARTIFACT,
      cited_signals: [
        ...ARTIFACT.cited_signals,
        { signal: 'Invented', source_ids: ['once'] },
        { signal: 'Mixed', source_ids: ['source-1', 'source-99'] },
      ],
      drafts: [
        ARTIFACT.drafts[0],
        { angle_id: 'debugging_layers', source_id: 'source-99' },
        null,
      ],
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).resolves.toEqual({
      ...ARTIFACT,
      cited_signals: [
        ...ARTIFACT.cited_signals,
        { signal: 'Mixed', source_ids: ['source-1'] },
      ],
      drafts: [ARTIFACT.drafts[0], null, null],
    });
  });

  it('emits each cited evidence page once, in evidence order, with exact provenance', async () => {
    const secondPage = {
      canonicalUrl: 'https://threadplane.ai/about',
      retrievedAt: '2026-09-01T12:01:00.000Z',
      contentHash: 'b'.repeat(64),
      facts: ['Second fact.'],
      snippets: ['Second snippet.'],
    };
    const { deps } = dependencies({
      ...ARTIFACT,
      cited_signals: [
        { signal: 'About claim', source_ids: ['source-2', 'source-2'] },
        { signal: 'Home claim', source_ids: ['source-1'] },
      ],
      sources: [],
    });

    await expect(
      generateEnrichmentArtifact(
        { ...INPUT, companyPages: [...INPUT.companyPages, secondPage] },
        SIGNAL,
        deps
      )
    ).resolves.toMatchObject({
      cited_signals: [
        { signal: 'About claim', source_ids: ['source-2'] },
        { signal: 'Home claim', source_ids: ['source-1'] },
      ],
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
  });

  it('fails closed when company evidence exists but no signal survives filtering', async () => {
    const { deps, parse } = dependencies({
      ...ARTIFACT,
      cited_signals: [{ signal: 'Invented', source_ids: ['source-99'] }],
    });

    await expect(
      generateEnrichmentArtifact(INPUT, SIGNAL, deps)
    ).rejects.toThrow(/provenance/u);
    expect(parse).toHaveBeenCalledOnce();
  });

  it('tolerates grammar-unenforceable bounds on the wire and normalizes them before the strict parse', async () => {
    const { deps } = dependencies({
      ...ARTIFACT,
      summary: ARTIFACT.summary,
      cited_signals: [
        { signal: 'No ids', source_ids: [] },
        { signal: '', source_ids: ['source-1'] },
        ...Array.from({ length: 9 }, (_, index) => ({
          signal: `Signal ${index + 1}`,
          source_ids: ['source-1', 'source-1', 'source-1', 'source-1'],
        })),
      ],
      company_profile: { name: '', description: 'Desc', industry: '' },
      drafts: [
        { angle_id: 'not_an_angle', source_id: 'source-1' },
        { angle_id: 'debugging_layers', source_id: '' },
        { angle_id: 'event_state_boundary', source_id: 'source-1' },
      ],
    });

    const artifact = await generateEnrichmentArtifact(INPUT, SIGNAL, deps);

    expect(artifact.cited_signals).toHaveLength(8);
    expect(artifact.cited_signals[0]).toEqual({
      signal: 'Signal 1',
      source_ids: ['source-1'],
    });
    expect(artifact.company_profile).toEqual({
      name: null,
      description: 'Desc',
      industry: null,
    });
    expect(artifact.drafts).toEqual([
      null,
      null,
      { angle_id: 'event_state_boundary', source_id: 'source-1' },
    ]);
  });

  it('accepts a neutral response whose only signal has no source ids', async () => {
    const { deps } = dependencies({
      ...NEUTRAL_ARTIFACT,
      cited_signals: [{ signal: 'Form submitted', source_ids: [] }],
    });

    await expect(
      generateEnrichmentArtifact(NEUTRAL_INPUT, SIGNAL, deps)
    ).resolves.toEqual(NEUTRAL_ARTIFACT);
  });

  it('accepts a null-profile neutral artifact without company provenance', async () => {
    const { deps } = dependencies(NEUTRAL_ARTIFACT);

    await expect(
      generateEnrichmentArtifact(NEUTRAL_INPUT, SIGNAL, deps)
    ).resolves.toEqual(NEUTRAL_ARTIFACT);
  });

  it('strips neutral-mode company claims, fabricated sources, and drafts', async () => {
    const { deps, parse } = dependencies({
      ...NEUTRAL_ARTIFACT,
      company_profile: {
        name: 'Claimed Company',
        description: 'Made up',
        industry: null,
      },
      cited_signals: [{ signal: 'Invented', source_ids: ['contact'] }],
      sources: [
        {
          id: 'contact',
          url: 'https://placeholder.invalid/contact',
          retrieved_at: '2024-01-01T00:00:00.000Z',
          content_hash: '0'.repeat(64),
        },
      ],
      drafts: [{ angle_id: 'streaming_foundation', source_id: 'contact' }],
    });

    await expect(
      generateEnrichmentArtifact(NEUTRAL_INPUT, SIGNAL, deps)
    ).resolves.toEqual(NEUTRAL_ARTIFACT);
    expect(parse).toHaveBeenCalledOnce();
  });
});
