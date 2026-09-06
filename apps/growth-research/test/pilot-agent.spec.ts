import { expect, it, vi, afterEach, afterAll, beforeAll } from 'vitest';
import { cp, mkdtemp, rm, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BoundedChatOpenAI } from '../src/runtime/model-boundary.js';
import { createPilotContext, withPilotContext } from '../src/pilot/context.js';
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
  await symlink(
    join(appRoot, 'node_modules'),
    join(generatedRoot, 'node_modules'),
    'dir'
  );
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
            text: 'Atlas builds observability software.',
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
    expect(result.modelCalls).toBe(3);
    expect(result.evidenceReads).toBe(1);
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
