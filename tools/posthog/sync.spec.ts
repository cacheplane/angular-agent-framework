import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computePlan, type SyncClient } from './sync.js';

async function fixtureRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'posthog-tools-test-'));
  await mkdir(join(dir, 'dashboards'), { recursive: true });
  await mkdir(join(dir, 'insights'), { recursive: true });
  await mkdir(join(dir, 'cohorts'), { recursive: true });
  return dir;
}

function fakeClient(remote: { dashboards?: any[]; insights?: any[]; cohorts?: any[] } = {}): SyncClient {
  return {
    listDashboards: async () => remote.dashboards ?? [],
    listInsights: async () => remote.insights ?? [],
    listCohorts: async () => remote.cohorts ?? [],
    createDashboard: async (body) => ({ ...body, id: 1000 }),
    createInsight: async (body) => ({ ...body, id: 2000 }),
    createCohort: async (body) => ({ ...body, id: 3000 }),
    updateDashboard: async (id, body) => ({ ...body, id }),
    updateInsight: async (id, body) => ({ ...body, id }),
    updateCohort: async (id, body) => ({ ...body, id }),
    deleteDashboard: async () => undefined,
    deleteInsight: async () => undefined,
    deleteCohort: async () => undefined,
  };
}

test('computePlan: all-new local artifacts produce [create] for each', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'dashboards/d1.json'), JSON.stringify({
    slug: 'd1', posthog_id: null, name: 'D1', description: '', tiles: [{ insight: 'i1' }],
  }));
  await writeFile(join(root, 'insights/i1.json'), JSON.stringify({
    slug: 'i1', posthog_id: null, kind: 'trends', name: 'I1', events: [{ event: '$pageview', math: 'total' }],
  }));
  const plan = await computePlan({ root, client: fakeClient() });
  assert.equal(plan.create.length, 2);  // 1 dashboard + 1 insight
  assert.equal(plan.update.length, 0);
  assert.equal(plan.orphan.length, 0);
});

test('computePlan: existing posthog_id matches remote and produces [update]', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/i1.json'), JSON.stringify({
    slug: 'i1', posthog_id: 42, kind: 'trends', name: 'I1', events: [{ event: '$pageview' }],
  }));
  const plan = await computePlan({
    root,
    client: fakeClient({ insights: [{ id: 42, name: 'I1', filters: {} }] }),
  });
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].local.slug, 'i1');
});

test('computePlan: remote without local match becomes [orphan]', async () => {
  const root = await fixtureRoot();
  const plan = await computePlan({
    root,
    client: fakeClient({ dashboards: [{ id: 999, name: 'Stray dashboard' }] }),
  });
  assert.equal(plan.orphan.length, 1);
  assert.equal(plan.orphan[0].remote.name, 'Stray dashboard');
});

test('computePlan: name-fallback match when posthog_id is null', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/by-name.json'), JSON.stringify({
    slug: 'by-name', posthog_id: null, kind: 'trends', name: 'Existing Insight',
    events: [{ event: '$pageview' }],
  }));
  const plan = await computePlan({
    root,
    client: fakeClient({ insights: [{ id: 77, name: 'Existing Insight' }] }),
  });
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].remoteId, 77);
});

test('computePlan: ambiguous name match (two remotes same name) forces create', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/x.json'), JSON.stringify({
    slug: 'x', posthog_id: null, kind: 'trends', name: 'Same Name',
    events: [{ event: '$pageview' }],
  }));
  const plan = await computePlan({
    root,
    client: fakeClient({
      insights: [{ id: 1, name: 'Same Name' }, { id: 2, name: 'Same Name' }],
    }),
  });
  assert.equal(plan.create.length, 1);
  assert.equal(plan.orphan.length, 2);  // both ambiguous remotes become orphans
});

test('computePlan: invalid local JSON throws with file path in message', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/bad.json'), JSON.stringify({ slug: 'BAD-SLUG', posthog_id: null }));
  await assert.rejects(
    () => computePlan({ root, client: fakeClient() }),
    /insights\/bad\.json/,
  );
});
