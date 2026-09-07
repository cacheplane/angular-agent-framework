import { expect, it, vi, afterEach, afterAll, beforeAll } from 'vitest';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { linkFixtureDependencies } from './fixture-dependencies.js';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BoundedChatOpenAI } from '../src/runtime/model-boundary.js';
import {
  createPilotContext,
  withPilotContext,
  submitCandidate,
  getPilotContext,
} from '../src/pilot/context.js';
import { syntheticCorpus } from '../src/pilot/fixtures.js';
import { runAgent } from '../src/pilot/agent-runner.js';
let sharedMock:
  | Awaited<ReturnType<typeof import('@dawn-ai/testing')['createAimock']>>
  | undefined;
let generatedRoot: string;
let generated: { invoke: (...args: unknown[]) => Promise<unknown> };
beforeAll(async () => {
  const appRoot = resolve(import.meta.dirname, '..');
  generatedRoot = await mkdtemp(join(tmpdir(), 'company-pilot-graph-'));
  for (const file of [
    'src',
    'dawn.config.ts',
    'package.json',
    'scripts/dawn-cli.mts',
  ]) {
    await cp(join(appRoot, file), join(generatedRoot, file), {
      recursive: true,
    });
  }
  await linkFixtureDependencies(appRoot, generatedRoot);
  execFileSync(process.execPath, ['scripts/dawn-cli.mts', 'build'], {
    cwd: generatedRoot,
    stdio: 'pipe',
  });
}, 60_000);
const invokeGenerated: NonNullable<
  NonNullable<Parameters<typeof runAgent>[1]>['invoke']
> = async (...args) => {
  generated ??= (
    await import(
      pathToFileURL(
        join(generatedRoot, '.dawn/build/enrichment-company-pilot.ts')
      ).href
    )
  ).graph;
  return generated.invoke(...args);
};
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await sharedMock?.close();
  if (generatedRoot) await rm(generatedRoot, { recursive: true, force: true });
});
it('pilot env alone cannot authorize the model', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', '');
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  await expect(
    new BoundedChatOpenAI({ apiKey: 'test' }).invoke('deny')
  ).rejects.toThrow();
});
it('requires an in-process context for the pilot route even when synthetic mode is enabled', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  await expect(
    new BoundedChatOpenAI({
      apiKey: 'test',
      configuration: { baseURL: 'http://127.0.0.1:1/v1' },
    }).invoke([{ role: 'system', content: '[LOCAL_COMPANY_PILOT]' }])
  ).rejects.toThrow(/pilot_mode_required/);
});
it('cancels settled graph work and fences a late candidate', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  const controller = new AbortController();
  const result = await runAgent(fixtureCase(0), {
    signal: controller.signal,
    invoke: async (_input, config) => {
      controller.abort();
      expect(config.signal.aborted).toBe(true);
    },
  });
  expect(result.outcome).toBe('cancelled');
  expect(result.candidate).toBeUndefined();
});
it('disables automatic raw tracing during graph invocation', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  vi.stubEnv('LANGSMITH_TRACING', 'true');
  await runAgent(fixtureCase(0), {
    invoke: async () => {
      expect(process.env['LANGSMITH_TRACING']).toBe('false');
    },
  });
  expect(process.env['LANGSMITH_TRACING']).toBe('true');
});
it('does not allow fixture authorization to bypass a cancelled pilot context', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  const ctx = createPilotContext(fixtureCase(0));
  ctx.controller.abort();
  await withPilotContext(ctx, () =>
    expect(
      new BoundedChatOpenAI({ apiKey: 'test' }).invoke('deny')
    ).rejects.toThrow()
  );
});
it('invokes the actual generated local graph with only company tools', async () => {
  const { createAimock, script } = await import('@dawn-ai/testing');
  const mock =
    sharedMock ?? (sharedMock = await createAimock({ fixtures: [] }));
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', '');
  vi.stubEnv('OPENAI_API_KEY', 'test');
  vi.stubEnv('OPENAI_BASE_URL', mock.baseUrl);
  mock.addFixtures(
    script()
      .user(
        'Research company case clear. Read the company-review skill and captured evidence, then submit a candidate.'
      )
      .callsTool('readEvidence', { sourceId: 'source-1' })
      .callsTool('submitCandidate', {
        profile: {
          name: 'Atlas Synthetic',
          description: 'Builds observability software.',
          industry: 'Software',
        },
        unknowns: [],
        claims: [
          {
            text: 'Atlas Synthetic builds observability software.',
            citations: [
              {
                sourceId: 'source-1',
                quote: 'Atlas Synthetic builds observability software.',
              },
            ],
          },
        ],
      })
      .replies('Submitted.')
      .build()
  );
  try {
    const result = await runAgent(fixtureCase(0), {
      invoke: invokeGenerated,
    });
    expect(result.outcome).toBe('completed');
    expect(result.modelCalls).toBe(2);
    // Authored guidance must reach the actual generated provider request.
    // This guards prompt delivery, not semantic correctness of model output.
    const systemMessage = mock
      .getRequests()[0]
      ?.body?.messages?.find((message) => message.role === 'system');
    expect(systemMessage?.content).toContain(
      'claim.text must equal its sole citation.quote exactly'
    );
    expect(systemMessage?.content).toContain(
      'two or three concrete product capabilities'
    );
    expect(systemMessage?.content).toContain('promotional superlatives');
    expect(systemMessage?.content).toContain('omit disputed claims');

    expect(result.evidenceReads).toBe(1);
    const evidenceMessage = mock
      .getRequests()
      .flatMap((request) => request.body?.messages ?? [])
      .find(
        (message) =>
          message.role === 'tool' &&
          typeof message.content === 'string' &&
          message.content.includes('Atlas Synthetic builds')
      );
    if (typeof evidenceMessage?.content !== 'string')
      throw new Error('evidence tool message required');
    expect(JSON.parse(evidenceMessage.content)).toMatchObject({
      facts: ['Atlas Synthetic builds observability software.'],
      citationOptions: [
        {
          sourceId: 'source-1',
          quote: 'Atlas Synthetic builds observability software.',
        },
      ],
    });

    const names = mock
      .getRequests()[0]
      ?.body?.tools?.map((t) => t.function?.name);
    expect(names?.sort()).toEqual([
      'readEvidence',
      'readSkill',
      'submitCandidate',
      'writeTodos',
    ]);
  } finally {
    /* Shared endpoint survives cached generated model instances. */
  }
}, 60_000);
it('halts a generated graph at six model requests without publishing', async () => {
  const { createAimock, script } = await import('@dawn-ai/testing');
  const mock =
    sharedMock ?? (sharedMock = await createAimock({ fixtures: [] }));
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', '');
  vi.stubEnv('OPENAI_API_KEY', 'test');
  vi.stubEnv('OPENAI_BASE_URL', mock.baseUrl);
  let sequence = script().user(
    'Research company case sparse. Read the company-review skill and captured evidence, then submit a candidate.'
  );
  for (let i = 0; i < 6; i++)
    sequence = sequence.callsTool('readEvidence', { sourceId: 'source-1' });
  mock.addFixtures(sequence.replies('Too late.').build());
  try {
    const result = await runAgent(fixtureCase(1), {
      invoke: invokeGenerated,
    });
    expect(result.outcome).toBe('model_limit');
    expect(result.modelCalls).toBe(6);
    expect(result.candidate).toBeUndefined();
  } finally {
    /* Shared endpoint survives cached generated model instances. */
  }
}, 60_000);
it('settles a valid submission on the sixth request without another model request', async () => {
  const { createAimock, script } = await import('@dawn-ai/testing');
  const mock =
    sharedMock ?? (sharedMock = await createAimock({ fixtures: [] }));
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', '');
  vi.stubEnv('OPENAI_API_KEY', 'test');
  vi.stubEnv('OPENAI_BASE_URL', mock.baseUrl);
  const c = { ...fixtureCase(1), id: 'terminal-budget' };
  let sequence = script().user(
    'Research company case terminal-budget. Read the company-review skill and captured evidence, then submit a candidate.'
  );
  for (let i = 0; i < 5; i++)
    sequence = sequence.callsTool('readEvidence', { sourceId: 'source-1' });
  const candidate = {
    profile: { name: null, description: null, industry: null },
    unknowns: ['name', 'description', 'industry'],
    claims: [],
  };
  mock.addFixtures(
    sequence
      .callsTool('submitCandidate', candidate)
      .replies('Unnecessary')
      .build()
  );
  const result = await runAgent(c, { invoke: invokeGenerated });
  expect(result.outcome).toBe('completed');
  expect(result.modelCalls).toBe(6);
  expect(result.candidate).toEqual(candidate);
  expect(result.attempts).toHaveLength(1);
}, 60_000);
it('uses the authored Zod schema for actual generated null-field abstention', async () => {
  const { createAimock, script } = await import('@dawn-ai/testing');
  const mock =
    sharedMock ?? (sharedMock = await createAimock({ fixtures: [] }));
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', '');
  vi.stubEnv('OPENAI_API_KEY', 'test');
  vi.stubEnv('OPENAI_BASE_URL', mock.baseUrl);
  const missing = syntheticCorpus.cases.find((c) => c.id === 'missing');
  if (!missing) throw new Error('missing fixture required');
  const candidate = {
    profile: { name: null, description: null, industry: null },
    unknowns: ['name', 'description', 'industry'],
    claims: [],
  };
  mock.addFixtures(
    script()
      .user(
        'Research company case missing. Read the company-review skill and captured evidence, then submit a candidate.'
      )
      .callsTool('submitCandidate', candidate)
      .replies('No evidence; abstained.')
      .build()
  );
  const result = await runAgent(missing, { invoke: invokeGenerated });
  expect(result.outcome).toBe('completed');
  expect(result.candidate).toEqual(candidate);
  const request = mock
    .getRequests()
    .find((r) =>
      JSON.stringify(r.body?.messages).includes(
        'Research company case missing.'
      )
    );
  const tool = request?.body?.tools?.find(
    (t) => t.function?.name === 'submitCandidate'
  );
  expect(
    JSON.stringify(
      (tool?.function as { parameters?: unknown } | undefined)?.parameters
    )
  ).toContain('null');
}, 60_000);
it('deadline aborts stalled work, waits for settlement and rejects a late publication', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  vi.useFakeTimers();
  let settled = false;
  const work = runAgent(fixtureCase(1), {
    invoke: async (_input, { signal }) => {
      await new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true })
      );
      settled = true;
    },
  });
  await vi.advanceTimersByTimeAsync(90_000);
  const result = await work;
  vi.useRealTimers();
  expect(settled).toBe(true);
  expect(result.outcome).toBe('deadline');
  expect(result.candidate).toBeUndefined();
});

function fixtureCase(index: number) {
  const fixture = syntheticCorpus.cases[index];
  if (!fixture) throw new Error('Synthetic fixture is required');
  return fixture;
}

it.each(['cancelled', 'deadline'] as const)(
  'rejects %s while a successful submission is still settling',
  async (stop) => {
    vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
    const controller = new AbortController();
    vi.useFakeTimers();
    try {
      const result = await runAgent(fixtureCase(0), {
        signal: controller.signal,
        invoke: async (_input, { signal }) => {
          submitCandidate({
            profile: { name: null, description: null, industry: null },
            unknowns: ['name', 'description', 'industry'],
            claims: [],
          });
          expect(signal.aborted).toBe(true);
          if (stop === 'cancelled') controller.abort();
          else await vi.advanceTimersByTimeAsync(90_000);
        },
      });
      expect(result.outcome).toBe(stop);
      expect(result.candidate).toBeUndefined();
      expect(result.attempts).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  }
);
it('does not publish on a generic abort error without a terminal submission', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  const result = await runAgent(fixtureCase(0), {
    invoke: async () => {
      throw new DOMException('Aborted', 'AbortError');
    },
  });
  expect(result.outcome).toBe('failed');
  expect(result.candidate).toBeUndefined();
});

it('waits for outstanding transport settlement after graph abort before returning', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  const controller = new AbortController();
  let release!: () => void;
  let returned = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const work = runAgent(fixtureCase(0), {
    signal: controller.signal,
    invoke: async () => {
      const context = getPilotContext();
      if (!context) throw new Error('context required');
      context.pendingOperations.add(pending);
      void pending.then(() => context.pendingOperations.delete(pending));
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    },
  }).then((result) => {
    returned = true;
    return result;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(returned).toBe(false);
  release();
  expect((await work).outcome).toBe('cancelled');
});

it('authorizes production contexts only under the independent managed gate', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', '');
  vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', '');
  const context = createPilotContext(fixtureCase(0), {
    authorization: 'production',
    deadline: 123,
  });
  expect(context.deadline).toBe(123);
  const { assertPilotContext } = await import('../src/pilot/context.js');
  await withPilotContext(context, async () => {
    expect(() => assertPilotContext()).toThrow(/pilot_mode_required/);
    vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', 'managed-company-only');
    context.deadline = Date.now() + 10_000;
    expect(assertPilotContext()).toBe(context);
  });
});

it('delivers actionable citation repair through the actual generated tool message', async () => {
  const { createAimock, script } = await import('@dawn-ai/testing');
  const mock =
    sharedMock ?? (sharedMock = await createAimock({ fixtures: [] }));
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', '');
  vi.stubEnv('OPENAI_API_KEY', 'test');
  vi.stubEnv('OPENAI_BASE_URL', mock.baseUrl);
  const c = { ...fixtureCase(0), id: 'citation-repair' };
  const candidate = {
    profile: { name: 'Atlas Synthetic', description: null, industry: null },
    unknowns: ['description', 'industry'],
    claims: [
      {
        text: 'Atlas Synthetic builds observability software.',
        citations: [
          {
            sourceId: 'source-1',
            quote: 'Atlas Synthetic builds observability software.',
          },
        ],
      },
    ],
  };
  const bad = structuredClone(candidate);
  const claim = bad.claims[0];
  if (!claim) throw new Error('claim required');
  claim.citations = [
    { sourceId: 'source-1', quote: 'Joined missing excerpt.' },
  ];
  mock.addFixtures(
    script()
      .user(
        'Research company case citation-repair. Read the company-review skill and captured evidence, then submit a candidate.'
      )
      .callsTool('readEvidence', { sourceId: 'source-1' })
      .callsTool('submitCandidate', bad)
      .callsTool('submitCandidate', candidate)
      .replies('Unnecessary.')
      .build()
  );
  const result = await runAgent(c, { invoke: invokeGenerated });
  expect(result.outcome).toBe('completed');
  expect(result.modelCalls).toBe(3);
  expect(result.attempts).toHaveLength(2);
  const feedback = mock
    .getRequests()
    .flatMap((request) => request.body?.messages ?? [])
    .find(
      (message) =>
        message.role === 'tool' &&
        typeof message.content === 'string' &&
        message.content.includes('invalidCitations')
    );
  if (typeof feedback?.content !== 'string')
    throw new Error('feedback required');
  expect(JSON.parse(feedback.content)).toMatchObject({
    invalidCitations: [
      { claimIndex: 0, citationIndex: 0, reason: 'quote_not_found' },
    ],
    citationInstruction: expect.stringContaining('citationOptions'),
  });
}, 60_000);
