import { expect, it, vi } from 'vitest';
import type { GrowthJob, SqlExecutor } from '../growth.js';
import {
  createLifecycleAppJobHandlers,
  type LifecycleJobDependencies,
} from './send.js';

const dawn = vi.hoisted(() => ({
  enrich: vi.fn().mockResolvedValue('completed'),
  research_cleanup: vi.fn().mockResolvedValue('completed'),
}));
vi.mock('../enrichment/dawn-jobs.js', () => ({
  createDawnJobHandlers: () => dawn,
}));
const job = {
  id: 'job',
  kind: 'enrich',
  status: 'leased',
  leaseToken: 'lease',
  payload: {},
} as GrowthJob;
const db = {} as SqlExecutor;

it.each([undefined, 'true'])(
  'routes new work to Dawn with rollout %s',
  async (enabled) => {
    const legacy = vi.fn(() => {
      throw new Error('retired generator');
    });
    const handlers = createLifecycleAppJobHandlers(legacy, {
      environment: { GROWTH_DAWN_ENRICHMENT_ENABLED: enabled },
    });
    await expect(handlers.enrich(db, job, {})).resolves.toBe('completed');
    expect(legacy).not.toHaveBeenCalled();
  }
);

it('defers paused new work without capture or a model call', async () => {
  dawn.enrich.mockClear();
  const now = new Date('2026-09-06T00:00:00Z');
  const deferJob = vi.fn().mockResolvedValue(job);
  const handlers = createLifecycleAppJobHandlers(
    () => ({ now: () => now, deferJob } as unknown as LifecycleJobDependencies),
    { environment: { GROWTH_DAWN_ENRICHMENT_ENABLED: 'false' } }
  );
  await expect(handlers.enrich(db, job, {})).resolves.toBe('deferred');
  expect(deferJob).toHaveBeenCalledWith(db, {
    jobId: 'job',
    leaseToken: 'lease',
    now,
    availableAt: new Date(now.getTime() + 60000),
    errorCode: 'dawn_enrichment_paused',
  });
  expect(dawn.enrich).not.toHaveBeenCalled();
});

it('continues in-flight reconciliation and cleanup while paused', async () => {
  const legacy = vi.fn(() => {
    throw new Error('retired generator');
  });
  const handlers = createLifecycleAppJobHandlers(legacy, {
    environment: { GROWTH_DAWN_ENRICHMENT_ENABLED: 'false' },
  });
  await expect(
    handlers.enrich(db, { ...job, payload: { research_attempt: {} } }, {})
  ).resolves.toBe('completed');
  await expect(
    handlers.research_cleanup(db, { ...job, kind: 'research_cleanup' }, {})
  ).resolves.toBe('completed');
  expect(legacy).not.toHaveBeenCalled();
});
