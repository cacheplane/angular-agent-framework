import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  parseCompanyRequest,
  hashCompanyEvidence,
} from '../src/production/contracts.js';
import { createCompanyExecutor } from '../src/production/executor.js';
import type { ClaimStore, ClaimStatus } from '../src/production/claims.js';
import {
  getPilotContext,
  submitCandidate,
  trackPilotOperation,
  countModelRequest,
} from '../src/pilot/context.js';
import { AsyncLocalStorageProviderSingleton } from '@langchain/core/singletons';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RunTree } from 'langsmith/run_trees';
import { getCurrentRunTree, withRunTree } from 'langsmith/traceable';
import { RunnableLambda } from '@langchain/core/runnables';

function request() {
  const domain = 'example.com';
  const pages = [
    {
      canonicalUrl: 'https://example.com/',
      retrievedAt: new Date().toISOString(),
      contentHash: 'a'.repeat(64),
      facts: ['Example builds software.'],
      snippets: [],
    },
  ];
  return {
    version: 'company_research.request.v1',
    attemptId: randomUUID(),
    domain,
    pages,
    evidenceHash: hashCompanyEvidence(domain, pages),
    expiresAt: new Date(Date.now() + 90_000).toISOString(),
    generationRef: 'dawn-company-v1',
  };
}
function claims(): ClaimStore {
  const rows = new Map<string, ClaimStatus>();
  return {
    async rejectExpired(attemptId, expiresAt) {
      if (rows.has(attemptId) || Date.parse(expiresAt) > Date.now()) return;
      rows.set(attemptId, {
        attemptId,
        expiresAt,
        settledAt: new Date().toISOString(),
      });
    },
    async acquire(attemptId, expiresAt) {
      if (rows.has(attemptId)) return false;
      rows.set(attemptId, { attemptId, expiresAt, settledAt: null });
      return true;
    },
    async settle(attemptId) {
      const row = rows.get(attemptId);
      if (!row) throw new Error('missing claim');
      row.settledAt = new Date().toISOString();
    },
    async get(attemptId) {
      return rows.get(attemptId) ?? null;
    },
  };
}
afterEach(() => vi.unstubAllEnvs());
it('records expired-before-execution rejection without invoking or settling an existing writer', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', 'managed-company-only');
  const store = claims();
  const invoke = vi.fn();
  const execute = createCompanyExecutor({ claims: store, invoke });
  const r = {
    ...request(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  };
  await expect(execute(r)).rejects.toThrow('invalid_expiry');
  expect((await store.get(r.attemptId))?.settledAt).toEqual(expect.any(String));
  expect(invoke).not.toHaveBeenCalled();
  const active = { ...r, attemptId: randomUUID() };
  await store.acquire(active.attemptId, active.expiresAt);
  await expect(execute(active)).rejects.toThrow('invalid_expiry');
  expect((await store.get(active.attemptId))?.settledAt).toBeNull();
});

it('does not record an expired rejection for invalid captured evidence', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', 'managed-company-only');
  const store = claims();
  const r = {
    ...request(),
    expiresAt: new Date(0).toISOString(),
    evidenceHash: 'f'.repeat(64),
  };
  await expect(createCompanyExecutor({ claims: store })(r)).rejects.toThrow();
  expect(await store.get(r.attemptId)).toBeNull();
});

it('rejects identity fields, expired input, foreign sources and evidence tampering', () => {
  const r = request();
  expect(() =>
    parseCompanyRequest({ ...r, email: 'person@example.com' })
  ).toThrow();
  expect(() =>
    parseCompanyRequest({ ...r, expiresAt: new Date(0).toISOString() })
  ).toThrow();
  expect(() =>
    parseCompanyRequest({ ...r, evidenceHash: 'f'.repeat(64) })
  ).toThrow();
  expect(() =>
    parseCompanyRequest({
      ...r,
      pages: [{ ...r.pages[0], facts: ['x'.repeat(241)] }],
    })
  ).toThrow();
  const pages = [{ ...r.pages[0], canonicalUrl: 'https://foreign.com/' }];
  expect(() =>
    parseCompanyRequest({
      ...r,
      pages,
      evidenceHash: hashCompanyEvidence(r.domain, pages),
    })
  ).toThrow();
});
it('requires server authorization and rejects replay across executor instances', async () => {
  const store = claims();
  const invoke = vi.fn(async () => undefined);
  const r = request();
  await expect(
    createCompanyExecutor({ claims: store, invoke })(r)
  ).rejects.toThrow('production_mode_required');
  vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', 'managed-company-only');
  await createCompanyExecutor({ claims: store, invoke })(r);
  await expect(
    createCompanyExecutor({ claims: store, invoke })(r)
  ).rejects.toThrow('attempt_already_claimed');
  expect(invoke).toHaveBeenCalledTimes(1);
});
it('isolates concurrent evidence and drains work before declaring settled', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', 'managed-company-only');
  const store = claims();
  const a = request();
  const b = request();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const execute = createCompanyExecutor({
    claims: store,
    invoke: async () => {
      const c = getPilotContext();
      if (!c) throw new Error('missing context');
      if (c.case.id === a.attemptId) {
        void trackPilotOperation(c, () => gate);
        await Promise.resolve();
      }
      expect(getPilotContext()?.case.id).toBe(c.case.id);
      submitCandidate({
        profile: { name: null, description: null, industry: null },
        unknowns: ['name', 'description', 'industry'],
        claims: [],
      });
    },
  });
  const pending = execute(a);
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect((await store.get(a.attemptId))?.settledAt).toBeNull();
  expect((await execute(b)).outcome).toBe('completed');
  release();
  expect((await pending).outcome).toBe('completed');
  expect((await store.get(a.attemptId))?.settledAt).not.toBeNull();
});
it('does not inherit server callbacks or checkpoint config into company execution', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', 'managed-company-only');
  const execute = createCompanyExecutor({
    claims: claims(),
    invoke: async () => {
      const config = AsyncLocalStorageProviderSingleton.getRunnableConfig();
      expect(config?.configurable?.['__pregel_checkpointer']).toBeUndefined();
      expect(config?.metadata?.['private_marker']).toBeUndefined();
    },
  });
  await AsyncLocalStorageProviderSingleton.runWithConfig(
    {
      configurable: { __pregel_checkpointer: { private: true } },
      metadata: { private_marker: 'not-for-child' },
    },
    () => execute(request())
  );
});
it('rejects publication on cancellation while operations drain and settles only afterward', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', 'managed-company-only');
  const controller = new AbortController();
  const store = claims();
  const r = request();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = createCompanyExecutor({
    claims: store,
    invoke: async () => {
      const context = getPilotContext();
      if (!context) throw new Error('missing context');
      void trackPilotOperation(context, () => gate);
      submitCandidate({
        profile: { name: null, description: null, industry: null },
        unknowns: ['name', 'description', 'industry'],
        claims: [],
      });
    },
  })(r, controller.signal);
  await new Promise((resolve) => setTimeout(resolve, 5));
  controller.abort();
  expect((await store.get(r.attemptId))?.settledAt).toBeNull();
  release();
  const result = await pending;
  expect(result.outcome).toBe('cancelled');
  expect(result.candidate).toBeUndefined();
});
it('skips empty evidence without invoking a model and ignores telemetry failure', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', 'managed-company-only');
  const r = request();
  r.pages = [];
  r.evidenceHash = hashCompanyEvidence(r.domain, r.pages);
  const invoke = vi.fn();
  const result = await createCompanyExecutor({
    claims: claims(),
    invoke,
    telemetry: async () => {
      throw new Error('offline');
    },
  })(r);
  expect(result.outcome).toBe('skipped');
  expect(invoke).not.toHaveBeenCalled();
});
it('enforces the model cap in a managed context', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', 'managed-company-only');
  const result = await createCompanyExecutor({
    claims: claims(),
    invoke: async () => {
      for (let i = 0; i < 7; i++) countModelRequest();
    },
  })(request());
  expect(result.outcome).toBe('model_limit');
  expect(result.modelCalls).toBe(6);
});
it('creates an explicitly nontracing child beneath a live automatic parent RunTree', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PRODUCTION_MODE', 'managed-company-only');
  vi.stubEnv('LANGSMITH_TRACING', 'true');
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new AsyncLocalStorage()
  );
  const observed: unknown[] = [];
  const createRun = vi.fn();
  const updateRun = vi.fn();
  const handleChainStart = vi.fn();
  const execute = createCompanyExecutor({
    claims: claims(),
    invoke: async () => {
      observed.push(getCurrentRunTree().tracingEnabled);
      observed.push(
        AsyncLocalStorageProviderSingleton.getRunnableConfig()?.configurable?.[
          '__pregel_checkpointer'
        ]
      );
      await RunnableLambda.from(async (value: string) => value).invoke(
        'RAW_PAGE_SENTINEL'
      );
    },
  });
  const parent = new RunTree({
    name: 'server-parent',
    tracingEnabled: true,
    client: { createRun, updateRun } as never,
  });
  await withRunTree(parent, () =>
    AsyncLocalStorageProviderSingleton.runWithConfig(
      {
        configurable: { __pregel_checkpointer: { sentinel: true } },
        callbacks: [{ name: 'parent-observer', handleChainStart }],
      },
      () => execute(request())
    )
  );
  expect(observed).toEqual([false, undefined]);
  expect(createRun).not.toHaveBeenCalled();
  expect(updateRun).not.toHaveBeenCalled();
  expect(handleChainStart).not.toHaveBeenCalled();
});
