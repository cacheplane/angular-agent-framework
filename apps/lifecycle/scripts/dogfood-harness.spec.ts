import type { SqlExecutor, SqlTransaction } from '@threadplane-internal/growth';

import dispatchState from '../src/app/dispatch/state.js';
import {
  assertDogfoodTargets,
  cleanupDogfoodFixtures,
  cleanupDawnFixtures,
  cleanupGrowthFixture,
  mainDogfoodHarness,
  parseDogfoodManifest,
  probeLifecyclePreview,
  setupGrowthFixture,
  type DogfoodManifest,
} from './dogfood-harness.mts';

const lifecycleOriginA = 'https://lifecycle-a.example.test';
const lifecycleOriginB = 'https://lifecycle-b.example.test';
const databaseUrl =
  'postgresql://secret-user:secret-password@growth.example.test/growth?sslmode=require';
const growthDatabaseSentinel = 'threadplane:growth-target:store_growth_preview';

function manifest(overrides: Record<string, unknown> = {}): DogfoodManifest {
  return parseDogfoodManifest({
    schema_version: 1,
    environment_label: 'preview-lifecycle-dogfood',
    fixture_namespace: 'threadplane-preview-dogfood-v1',
    targets: {
      lifecycle_instance_a_deployment_id: 'dpl_preview_a',
      lifecycle_instance_b_deployment_id: 'dpl_preview_b',
      growth_database_sentinel: growthDatabaseSentinel,
    },
    growth: {
      alias: 'cleanup-growth-fixtures-01',
      expected_count: 4,
      contact_id: '00000000-0000-4000-8000-000000000101',
      project_id: '00000000-0000-4000-8000-000000000102',
      posthog_distinct_id: '00000000-0000-4000-8000-000000000103',
      job_id: '00000000-0000-4000-8000-000000000104',
      submission_id: '00000000-0000-4000-8000-000000000105',
      activity_event_key: 'form:00000000-0000-4000-8000-000000000105:accepted',
      job_idempotency_key:
        'dogfood:duplicate-fixture-01:00000000-0000-4000-8000-000000000104',
    },
    dawn: {
      alias: 'cleanup-dawn-fixtures-01',
      expected_count: 4,
      threads: [
        {
          alias: 'thread-dogfood-01',
          id: '00000000-0000-4000-8000-000000000201',
        },
        {
          alias: 'duplicate-fixture-01-a',
          id: '00000000-0000-4000-8000-000000000202',
        },
        {
          alias: 'duplicate-fixture-01-b',
          id: '00000000-0000-4000-8000-000000000203',
        },
        {
          alias: 'abort-fixture-01',
          id: '00000000-0000-4000-8000-000000000204',
        },
      ],
    },
    ...overrides,
  });
}

interface RecordedQuery {
  marker: string;
  parameters: readonly unknown[];
  sql: string;
}

function executorWith(
  handlers: Record<
    string,
    (query: RecordedQuery) => { rows: Record<string, unknown>[] }
  >
): { calls: RecordedQuery[]; executor: SqlExecutor } {
  const calls: RecordedQuery[] = [];
  const transaction: SqlTransaction = {
    async execute(sql, parameters = []) {
      const placeholders = [...sql.matchAll(/\$(\d+)/gu)].map((match) =>
        Number(match[1])
      );
      const expectedParameterCount = Math.max(0, ...placeholders);
      const actualSequence = [...new Set(placeholders)].sort(
        (left, right) => left - right
      );
      const expectedSequence = Array.from(
        { length: expectedParameterCount },
        (_, index) => index + 1
      );
      if (JSON.stringify(actualSequence) !== JSON.stringify(expectedSequence)) {
        throw new Error(
          `placeholder sequence mismatch: expected ${expectedSequence.join(
            ','
          )}, received ${actualSequence.join(',')}`
        );
      }
      if (parameters.length !== expectedParameterCount) {
        throw new Error(
          `bind parameter mismatch: expected ${expectedParameterCount}, received ${parameters.length}`
        );
      }
      const marker =
        /\/\* lifecycle-dogfood:([a-z0-9-]+) \*\//u.exec(sql)?.[1] ??
        'unmarked';
      const query = { marker, parameters, sql };
      calls.push(query);
      const fallback =
        marker === 'read-growth-target-sentinel'
          ? { rows: [{ target_sentinel: growthDatabaseSentinel }] }
          : { rows: [] };
      return (handlers[marker]?.(query) ?? fallback) as never;
    },
  };
  return {
    calls,
    executor: {
      ...transaction,
      async transaction<T>(operation: (tx: SqlTransaction) => Promise<T>) {
        return operation(transaction);
      },
    },
  };
}

describe('dogfood manifest and target identity', () => {
  it('allows only the exact dogfood fixture marker in persisted dispatch state', () => {
    expect(
      dispatchState.parse({
        trigger: 'cron',
        dogfood_fixture_marker: 'threadplane-preview-dogfood-v1',
      })
    ).toMatchObject({
      dogfood_fixture_marker: 'threadplane-preview-dogfood-v1',
    });
    expect(() =>
      dispatchState.parse({
        trigger: 'cron',
        dogfood_fixture_marker: 'wrong-marker',
      })
    ).toThrow();
  });

  it('requires positive expected counts and the complete closed alias set', () => {
    expect(() =>
      manifest({
        dawn: {
          alias: 'cleanup-dawn-fixtures-01',
          expected_count: 0,
          threads: [],
        },
      })
    ).toThrow();
  });

  it('fails closed before work when the database-owned sentinel mismatches', async () => {
    const { calls, executor } = executorWith({
      'read-growth-target-sentinel': () => ({
        rows: [{ target_sentinel: 'threadplane:growth-target:wrong' }],
      }),
    });
    await expect(
      assertDogfoodTargets(executor, manifest(), {
        databaseUrl,
        lifecycleOriginA,
        lifecycleOriginB,
      })
    ).rejects.toThrow('target_identity_mismatch');
    expect(calls.map(({ marker }) => marker)).toEqual([
      'read-growth-target-sentinel',
    ]);
  });

  it('validates target URLs in memory without returning them', async () => {
    const { executor } = executorWith({});
    await expect(
      assertDogfoodTargets(executor, manifest(), {
        databaseUrl: 'not-a-database-url',
        lifecycleOriginA,
        lifecycleOriginB,
      })
    ).rejects.toThrow('target_url_invalid');
  });

  it.each([
    'https://user:password@lifecycle-a.example.test',
    'https://lifecycle-a.example.test/path',
    'https://lifecycle-a.example.test?preview=1',
    'https://lifecycle-a.example.test#fragment',
    'https://lifecycle-a.example.test/',
  ])(
    'requires a canonical bare HTTPS lifecycle origin: %s',
    async (invalidOrigin) => {
      const { executor } = executorWith({});
      await expect(
        assertDogfoodTargets(executor, manifest(), {
          databaseUrl,
          lifecycleOriginA: invalidOrigin,
          lifecycleOriginB,
        })
      ).rejects.toThrow('target_url_invalid');
    }
  );
});

describe('growth dogfood fixture lifecycle', () => {
  it('sets up only the four exact, namespaced records after an empty preflight', async () => {
    let countCalls = 0;
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({
        rows: [
          countCalls++ === 0
            ? { count: '0', markers_valid: false }
            : { count: '4', markers_valid: true },
        ],
      }),
      'count-other-due-jobs': () => ({ rows: [{ count: '0' }] }),
      'insert-growth-fixture': () => ({ rows: [{ inserted_count: '4' }] }),
    });

    const result = await setupGrowthFixture(executor, manifest());

    expect(result).toEqual({
      alias: 'cleanup-growth-fixtures-01',
      expectedCount: 4,
      preflightCount: 0,
      postSetupCount: 4,
      status: 'VERIFIED',
    });
    const insert = calls.find(
      ({ marker }) => marker === 'insert-growth-fixture'
    );
    expect(insert?.sql).toMatch(/fixture_namespace/u);
    expect(insert?.sql).not.toMatch(/like|ilike|delete\s+from/u);
    expect(insert?.parameters).toContain('threadplane-preview-dogfood-v1');
  });

  it('refuses setup when an exact fixture record already exists', async () => {
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({ rows: [{ count: '1' }] }),
    });

    await expect(setupGrowthFixture(executor, manifest())).rejects.toThrow(
      'growth_setup_preflight_mismatch'
    );
    expect(calls.map(({ marker }) => marker)).toEqual([
      'read-growth-target-sentinel',
      'count-growth-fixture',
    ]);
  });

  it('refuses setup before inserts when another lifecycle job is due', async () => {
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({
        rows: [{ count: '0', markers_valid: false }],
      }),
      'count-other-due-jobs': () => ({ rows: [{ count: '1' }] }),
    });

    await expect(setupGrowthFixture(executor, manifest())).rejects.toThrow(
      'non_fixture_jobs_due'
    );
    expect(calls.map(({ marker }) => marker)).toEqual([
      'read-growth-target-sentinel',
      'count-growth-fixture',
      'count-other-due-jobs',
    ]);
  });

  it('deletes dependents before owners only after the exact positive count matches', async () => {
    let count = 4;
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({
        rows: [{ count: String(count), markers_valid: count === 4 }],
      }),
      'delete-growth-fixture': () => {
        count = 0;
        return { rows: [{ deleted_count: '4' }] };
      },
    });

    const result = await cleanupGrowthFixture(executor, manifest());

    expect(result).toEqual({
      alias: 'cleanup-growth-fixtures-01',
      expectedCount: 4,
      preflightCount: 4,
      postCleanupCount: 0,
      status: 'VERIFIED',
    });
    const cleanupSql = calls.find(
      ({ marker }) => marker === 'delete-growth-fixture'
    )?.sql;
    expect(cleanupSql).toMatch(
      /delete from growth_artifacts[\s\S]*delete from growth_activity[\s\S]*delete from growth_jobs[\s\S]*delete from growth_projects[\s\S]*delete from growth_contacts/u
    );
    expect(cleanupSql).not.toMatch(/like|ilike|truncate|drop\s+schema/u);
  });

  it('does not delete anything on a cleanup count mismatch', async () => {
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({ rows: [{ count: '3' }] }),
    });

    await expect(cleanupGrowthFixture(executor, manifest())).rejects.toThrow(
      'growth_cleanup_preflight_mismatch'
    );
    expect(calls.map(({ marker }) => marker)).toEqual([
      'read-growth-target-sentinel',
      'count-growth-fixture',
    ]);
  });

  it('does not delete anything when the exact count has invalid markers', async () => {
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({
        rows: [{ count: '4', markers_valid: false }],
      }),
    });

    await expect(cleanupGrowthFixture(executor, manifest())).rejects.toThrow(
      'growth_cleanup_preflight_mismatch'
    );
    expect(calls.some(({ marker }) => marker === 'delete-growth-fixture')).toBe(
      false
    );
  });
});

describe('preview dogfood probes', () => {
  it('probes auth, health, named state, duplicate leasing, and persistence without disclosing fixture ids', async () => {
    const fixture = manifest();
    let jobActivated = false;
    const { executor } = executorWith({
      'count-other-due-jobs': () => ({ rows: [{ count: '0' }] }),
      'activate-duplicate-fixture': () => {
        jobActivated = true;
        return { rows: [{ activated_count: '1' }] };
      },
      'read-duplicate-fixture': () => ({
        rows: [
          {
            attempts: 1,
            delivery_status: 'not_submitted',
            last_error_code: 'delivery_disabled',
            provider_email_id: null,
            rfc_message_id: null,
            status: 'pending',
          },
        ],
      }),
    });
    const calls: {
      authorization: string | null;
      method: string;
      path: string;
    }[] = [];
    let duplicateRuns = 0;
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        calls.push({
          authorization: request.headers.get('authorization'),
          method: request.method,
          path: url.pathname,
        });
        if (request.headers.get('authorization') !== 'Bearer service-secret') {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (url.pathname === '/healthz') {
          return Response.json(
            { status: 'ready' },
            {
              headers: {
                'x-threadplane-deployment-id':
                  url.origin === lifecycleOriginA
                    ? 'dpl_preview_a'
                    : 'dpl_preview_b',
              },
            }
          );
        }
        if (url.pathname.endsWith('/cancel')) {
          return Response.json({ code: 'no_run_in_flight' }, { status: 409 });
        }
        if (url.pathname.endsWith('/state')) {
          return Response.json({
            values: {
              trigger: 'cron',
              dogfood_fixture_marker: 'threadplane-preview-dogfood-v1',
              result: {
                leased: 0,
                dispatched: 0,
                recoveryPaused: false,
                operatorAlerts: [],
              },
            },
          });
        }
        if (url.pathname.endsWith('/runs/wait')) {
          const isDuplicate = url.pathname.includes('00000000020');
          if (isDuplicate && jobActivated) duplicateRuns += 1;
          return Response.json({
            trigger: 'cron',
            dogfood_fixture_marker: 'threadplane-preview-dogfood-v1',
            result: {
              leased: isDuplicate && duplicateRuns === 1 ? 1 : 0,
              dispatched: isDuplicate && duplicateRuns === 1 ? 1 : 0,
              recoveryPaused: false,
              operatorAlerts: [],
            },
          });
        }
        return Response.json({ status: 'idle' });
      }
    );

    const result = await probeLifecyclePreview(
      {
        database: executor,
        fetch,
        lifecycleOriginA,
        lifecycleOriginB,
        serviceSecret: 'service-secret',
      },
      fixture
    );

    expect(result.gates.map(({ name, status }) => [name, status])).toEqual([
      ['outer-auth', 'PASS'],
      ['real-generated-health', 'PASS'],
      ['named-thread-run', 'PASS'],
      ['duplicate-effects', 'PASS'],
      ['recovery-pause-resume', 'BLOCKED'],
      ['abort-and-cancel', 'BLOCKED'],
      ['fresh-instance-persistence', 'PASS'],
    ]);
    expect(JSON.stringify(result)).not.toContain('00000000-0000');
    expect(JSON.stringify(result)).not.toContain('service-secret');
    expect(JSON.stringify(result)).not.toContain('example.test');
    expect(
      calls.filter(({ authorization }) => authorization === null)
    ).not.toHaveLength(0);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: '/agui/%2Fdispatch%23workflow' })
    );
  });

  it('deletes only exact Dawn thread ids and verifies absence through instance B', async () => {
    const fixture = manifest();
    const existing = new Set(fixture.dawn.threads.map(({ id }) => id));
    const deleted: string[] = [];
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        if (url.pathname === '/healthz') {
          return Response.json(
            { status: 'ready' },
            {
              headers: {
                'x-threadplane-deployment-id':
                  url.origin === lifecycleOriginA
                    ? 'dpl_preview_a'
                    : 'dpl_preview_b',
              },
            }
          );
        }
        const segments = url.pathname.split('/');
        const id = decodeURIComponent(
          request.method === 'DELETE'
            ? segments.at(-1) ?? ''
            : segments.at(-2) ?? ''
        );
        if (request.method === 'DELETE') {
          deleted.push(id);
          existing.delete(id);
          return new Response(null, { status: 204 });
        }
        return existing.has(id)
          ? Response.json({
              values: {
                trigger: 'cron',
                dogfood_fixture_marker: 'threadplane-preview-dogfood-v1',
                result: {
                  leased: 0,
                  dispatched: 0,
                  recoveryPaused: false,
                  operatorAlerts: [],
                },
              },
            })
          : Response.json({ error: 'Thread not found' }, { status: 404 });
      }
    );

    const result = await cleanupDawnFixtures(
      {
        fetch,
        lifecycleOriginA,
        lifecycleOriginB,
        serviceSecret: 'service-secret',
      },
      fixture
    );

    expect(result).toEqual({
      alias: 'cleanup-dawn-fixtures-01',
      expectedCount: 4,
      preflightCount: 4,
      postCleanupCount: 0,
      status: 'VERIFIED',
    });
    expect(deleted).toEqual(fixture.dawn.threads.map(({ id }) => id));
  });

  it('refuses all Dawn deletes when the bounded preflight count mismatches', async () => {
    let deleteCalled = false;
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        if (url.pathname === '/healthz') {
          return Response.json(
            { status: 'ready' },
            {
              headers: {
                'x-threadplane-deployment-id':
                  url.origin === lifecycleOriginA
                    ? 'dpl_preview_a'
                    : 'dpl_preview_b',
              },
            }
          );
        }
        deleteCalled ||= init?.method === 'DELETE';
        return Response.json({ error: 'Thread not found' }, { status: 404 });
      }
    );

    await expect(
      cleanupDawnFixtures(
        {
          fetch,
          lifecycleOriginA,
          lifecycleOriginB,
          serviceSecret: 'service-secret',
        },
        manifest()
      )
    ).rejects.toThrow('dawn_cleanup_preflight_mismatch');
    expect(deleteCalled).toBe(false);
  });

  it('refuses Dawn reads and deletes when a deployment id mismatches', async () => {
    const calls: string[] = [];
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        calls.push(url.pathname);
        return Response.json(
          { status: 'ready' },
          {
            headers: {
              'x-threadplane-deployment-id':
                url.origin === lifecycleOriginA ? 'dpl_wrong' : 'dpl_preview_b',
            },
          }
        );
      }
    );

    await expect(
      cleanupDawnFixtures(
        {
          fetch,
          lifecycleOriginA,
          lifecycleOriginB,
          serviceSecret: 'service-secret',
        },
        manifest()
      )
    ).rejects.toThrow('target_identity_mismatch');
    expect(calls.every((path) => path === '/healthz')).toBe(true);
  });

  it('refuses every Dawn delete when any exact thread has a wrong fixture marker', async () => {
    let deleteCalled = false;
    const wrongId = manifest().dawn.threads[1]?.id;
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        if (url.pathname === '/healthz') {
          return Response.json(
            { status: 'ready' },
            {
              headers: {
                'x-threadplane-deployment-id':
                  url.origin === lifecycleOriginA
                    ? 'dpl_preview_a'
                    : 'dpl_preview_b',
              },
            }
          );
        }
        deleteCalled ||= request.method === 'DELETE';
        const id = decodeURIComponent(url.pathname.split('/').at(-2) ?? '');
        return Response.json({
          values: {
            trigger: 'cron',
            dogfood_fixture_marker:
              id === wrongId
                ? 'wrong-marker'
                : 'threadplane-preview-dogfood-v1',
            result: {
              leased: 0,
              dispatched: 0,
              recoveryPaused: false,
              operatorAlerts: [],
            },
          },
        });
      }
    );

    await expect(
      cleanupDawnFixtures(
        {
          fetch,
          lifecycleOriginA,
          lifecycleOriginB,
          serviceSecret: 'service-secret',
        },
        manifest()
      )
    ).rejects.toThrow('dawn_fixture_marker_mismatch');
    expect(deleteCalled).toBe(false);
  });

  it.each([1, 2, 3])(
    'recovers cleanup when exactly %i marked Dawn fixtures remain',
    async (remainingCount) => {
      const fixture = manifest();
      const remaining = new Set(
        fixture.dawn.threads.slice(0, remainingCount).map(({ id }) => id)
      );
      const deleted: string[] = [];
      const fetch = vi.fn(
        async (input: string | URL | Request, init?: RequestInit) => {
          const request =
            input instanceof Request ? input : new Request(input, init);
          const url = new URL(request.url);
          if (url.pathname === '/healthz') {
            return Response.json(
              { status: 'ready' },
              {
                headers: {
                  'x-threadplane-deployment-id':
                    url.origin === lifecycleOriginA
                      ? 'dpl_preview_a'
                      : 'dpl_preview_b',
                },
              }
            );
          }
          const segments = url.pathname.split('/');
          const id = decodeURIComponent(
            request.method === 'DELETE'
              ? segments.at(-1) ?? ''
              : segments.at(-2) ?? ''
          );
          if (request.method === 'DELETE') {
            deleted.push(id);
            remaining.delete(id);
            return new Response(null, { status: 204 });
          }
          return remaining.has(id)
            ? Response.json({
                values: {
                  trigger: 'cron',
                  dogfood_fixture_marker: 'threadplane-preview-dogfood-v1',
                  result: {
                    leased: 0,
                    dispatched: 0,
                    recoveryPaused: false,
                    operatorAlerts: [],
                  },
                },
              })
            : Response.json({ error: 'missing' }, { status: 404 });
        }
      );

      const result = await cleanupDawnFixtures(
        {
          fetch,
          lifecycleOriginA,
          lifecycleOriginB,
          serviceSecret: 'service-secret',
        },
        fixture
      );

      expect(result.preflightCount).toBe(remainingCount);
      expect(result.postCleanupCount).toBe(0);
      expect(deleted).toHaveLength(remainingCount);
    }
  );

  it('preflights both stores before combined cleanup mutates either store', async () => {
    const fixture = manifest();
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({
        rows: [{ count: '3', markers_valid: false }],
      }),
    });
    const fetch = vi.fn(async () => Response.json({ status: 'idle' }));

    await expect(
      cleanupDogfoodFixtures(
        {
          database: executor,
          fetch,
          lifecycleOriginA,
          lifecycleOriginB,
          serviceSecret: 'service-secret',
        },
        fixture
      )
    ).rejects.toThrow('growth_cleanup_preflight_mismatch');
    expect(calls.map(({ marker }) => marker)).toEqual([
      'read-growth-target-sentinel',
      'count-growth-fixture',
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not mutate growth when any Dawn fixture marker mismatches', async () => {
    const fixture = manifest();
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({
        rows: [{ count: '4', markers_valid: true }],
      }),
      'delete-growth-fixture': () => ({ rows: [{ deleted_count: '4' }] }),
    });
    const wrongId = fixture.dawn.threads[2]?.id;
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        if (url.pathname === '/healthz') {
          return Response.json(
            { status: 'ready' },
            {
              headers: {
                'x-threadplane-deployment-id':
                  url.origin === lifecycleOriginA
                    ? 'dpl_preview_a'
                    : 'dpl_preview_b',
              },
            }
          );
        }
        const id = decodeURIComponent(url.pathname.split('/').at(-2) ?? '');
        return Response.json({
          values: {
            dogfood_fixture_marker:
              id === wrongId
                ? 'wrong-marker'
                : 'threadplane-preview-dogfood-v1',
          },
        });
      }
    );

    await expect(
      cleanupDogfoodFixtures(
        {
          database: executor,
          fetch,
          lifecycleOriginA,
          lifecycleOriginB,
          serviceSecret: 'service-secret',
        },
        fixture
      )
    ).rejects.toThrow('dawn_fixture_marker_mismatch');
    expect(calls.some(({ marker }) => marker === 'delete-growth-fixture')).toBe(
      false
    );
  });

  it('cleans growth after setup-only when all verified Dawn selectors are absent', async () => {
    let growthCount = 4;
    const fixture = manifest();
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({
        rows: [
          {
            count: String(growthCount),
            markers_valid: growthCount === 4,
          },
        ],
      }),
      'delete-growth-fixture': () => {
        growthCount = 0;
        return { rows: [{ deleted_count: '4' }] };
      },
    });
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        if (url.pathname === '/healthz') {
          return Response.json(
            { status: 'ready' },
            {
              headers: {
                'x-threadplane-deployment-id':
                  url.origin === lifecycleOriginA
                    ? 'dpl_preview_a'
                    : 'dpl_preview_b',
              },
            }
          );
        }
        return Response.json({ error: 'missing' }, { status: 404 });
      }
    );

    const result = await cleanupDogfoodFixtures(
      {
        database: executor,
        fetch,
        lifecycleOriginA,
        lifecycleOriginB,
        serviceSecret: 'service-secret',
      },
      fixture
    );

    expect(result.growth.preflightCount).toBe(4);
    expect(result.growth.postCleanupCount).toBe(0);
    expect(result.dawn.preflightCount).toBe(0);
    expect(result.dawn.postCleanupCount).toBe(0);
    expect(growthCount).toBe(0);
    expect(
      calls.filter(({ marker }) => marker === 'delete-growth-fixture')
    ).toHaveLength(1);
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
      false
    );
  });

  it('does not mutate growth when instance A is empty but instance B retains a marked fixture', async () => {
    const fixture = manifest();
    const retainedId = fixture.dawn.threads[0]?.id;
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({
        rows: [{ count: '4', markers_valid: true }],
      }),
      'delete-growth-fixture': () => ({ rows: [{ deleted_count: '4' }] }),
    });
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        if (url.pathname === '/healthz') {
          return Response.json(
            { status: 'ready' },
            {
              headers: {
                'x-threadplane-deployment-id':
                  url.origin === lifecycleOriginA
                    ? 'dpl_preview_a'
                    : 'dpl_preview_b',
              },
            }
          );
        }
        const id = decodeURIComponent(url.pathname.split('/').at(-2) ?? '');
        if (url.origin === lifecycleOriginB && id === retainedId) {
          return Response.json({
            values: {
              dogfood_fixture_marker: 'threadplane-preview-dogfood-v1',
            },
          });
        }
        return Response.json({ error: 'missing' }, { status: 404 });
      }
    );

    await expect(
      cleanupDogfoodFixtures(
        {
          database: executor,
          fetch,
          lifecycleOriginA,
          lifecycleOriginB,
          serviceSecret: 'service-secret',
        },
        fixture
      )
    ).rejects.toThrow('dawn_cleanup_postflight_mismatch');
    expect(calls.some(({ marker }) => marker === 'delete-growth-fixture')).toBe(
      false
    );
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
      false
    );
  });

  it('recovers a partial cross-store cleanup without deleting growth twice', async () => {
    const fixture = manifest();
    let growthCount = 4;
    const existing = new Set(fixture.dawn.threads.map(({ id }) => id));
    let failOneDelete = true;
    const { calls, executor } = executorWith({
      'count-growth-fixture': () => ({
        rows: [
          {
            count: String(growthCount),
            markers_valid: growthCount === 4,
          },
        ],
      }),
      'delete-growth-fixture': () => {
        growthCount = 0;
        return { rows: [{ deleted_count: '4' }] };
      },
    });
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        if (url.pathname === '/healthz') {
          return Response.json(
            { status: 'ready' },
            {
              headers: {
                'x-threadplane-deployment-id':
                  url.origin === lifecycleOriginA
                    ? 'dpl_preview_a'
                    : 'dpl_preview_b',
              },
            }
          );
        }
        const segments = url.pathname.split('/');
        const id = decodeURIComponent(
          request.method === 'DELETE'
            ? segments.at(-1) ?? ''
            : segments.at(-2) ?? ''
        );
        if (request.method === 'DELETE') {
          if (failOneDelete && existing.size === 3) {
            failOneDelete = false;
            return Response.json({ error: 'transient' }, { status: 500 });
          }
          existing.delete(id);
          return new Response(null, { status: 204 });
        }
        return existing.has(id)
          ? Response.json({
              values: {
                dogfood_fixture_marker: 'threadplane-preview-dogfood-v1',
              },
            })
          : Response.json({ error: 'missing' }, { status: 404 });
      }
    );
    const dependencies = {
      database: executor,
      fetch,
      lifecycleOriginA,
      lifecycleOriginB,
      serviceSecret: 'service-secret',
    };

    await expect(cleanupDogfoodFixtures(dependencies, fixture)).rejects.toThrow(
      'dawn_cleanup_delete_failed'
    );
    expect(growthCount).toBe(0);
    expect(existing.size).toBe(3);

    const recovered = await cleanupDogfoodFixtures(dependencies, fixture);
    expect(recovered.growth.preflightCount).toBe(0);
    expect(recovered.dawn.preflightCount).toBe(3);
    expect(existing.size).toBe(0);
    expect(
      calls.filter(({ marker }) => marker === 'delete-growth-fixture')
    ).toHaveLength(1);
  });
});

describe('dogfood CLI failure boundaries', () => {
  it('sanitizes a secret-bearing database close failure', async () => {
    let countCalls = 0;
    const { executor } = executorWith({
      'count-growth-fixture': () => ({
        rows: [
          countCalls++ === 0
            ? { count: '0', markers_valid: false }
            : { count: '4', markers_valid: true },
        ],
      }),
      'count-other-due-jobs': () => ({ rows: [{ count: '0' }] }),
      'insert-growth-fixture': () => ({ rows: [{ inserted_count: '4' }] }),
    });
    executor.close = async () => {
      throw new Error(`close failed for ${databaseUrl}`);
    };
    const output: string[] = [];
    const errors: string[] = [];

    const exitCode = await mainDogfoodHarness(
      ['setup', '--manifest', '/private/fixture.json'],
      {
        DATABASE_URL: databaseUrl,
        LIFECYCLE_DOGFOOD_INSTANCE_A_ORIGIN: lifecycleOriginA,
        LIFECYCLE_DOGFOOD_INSTANCE_B_ORIGIN: lifecycleOriginB,
        LIFECYCLE_SERVICE_SECRET: 'service-secret',
      },
      {
        createDatabase: () => executor,
        fetch: vi.fn(),
        loadManifest: async () => manifest(),
        writeError: (value) => errors.push(value),
        writeOutput: (value) => output.push(value),
      }
    );

    expect(exitCode).toBe(1);
    expect(output).toEqual([]);
    expect(errors).toEqual([
      '{"status":"FAILED","error":"database_close_failed"}\n',
    ]);
    expect(JSON.stringify(errors)).not.toContain('secret-password');
    expect(JSON.stringify(errors)).not.toContain('growth.example.test');
  });
});
