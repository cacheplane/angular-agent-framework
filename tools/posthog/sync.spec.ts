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

import { applyPlan, type ApplyResult } from './sync.js';

test('applyPlan: apply order — insights POSTed before dashboards', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'dashboards/d.json'), JSON.stringify({
    slug: 'd', posthog_id: null, name: 'D', description: '', tiles: [{ insight: 'i' }],
  }));
  await writeFile(join(root, 'insights/i.json'), JSON.stringify({
    slug: 'i', posthog_id: null, kind: 'trends', name: 'I', events: [{ event: '$pageview' }],
  }));
  const createCalls: string[] = [];
  const client: SyncClient = {
    ...fakeClient(),
    createInsight: async (body) => { createCalls.push('insight'); return { ...body, id: 2001 }; },
    createDashboard: async (body) => { createCalls.push('dashboard'); return { ...body, id: 1001 }; },
  };
  const plan = await computePlan({ root, client });
  await applyPlan({ root, client, plan });
  assert.deepEqual(createCalls, ['insight', 'dashboard']);
});

test('applyPlan: writeback updates posthog_id in source JSON', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/i.json'), JSON.stringify({
    slug: 'i', posthog_id: null, kind: 'trends', name: 'I', events: [{ event: '$pageview' }],
  }, null, 2));
  const client: SyncClient = { ...fakeClient(), createInsight: async (body) => ({ ...body, id: 7777 }) };
  const plan = await computePlan({ root, client });
  await applyPlan({ root, client, plan });
  const updated = JSON.parse(await readFile(join(root, 'insights/i.json'), 'utf8'));
  assert.equal(updated.posthog_id, 7777);
});

test('applyPlan: dashboard with unknown insight slug throws', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'dashboards/d.json'), JSON.stringify({
    slug: 'd', posthog_id: null, name: 'D', description: '', tiles: [{ insight: 'missing-insight' }],
  }));
  const client = fakeClient();
  const plan = await computePlan({ root, client });
  await assert.rejects(
    () => applyPlan({ root, client, plan }),
    /missing-insight/,
  );
});

test('applyPlan: partial success — failed insight does not block other creates', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/a.json'), JSON.stringify({
    slug: 'a', posthog_id: null, kind: 'trends', name: 'A', events: [{ event: '$pageview' }],
  }));
  await writeFile(join(root, 'insights/fail.json'), JSON.stringify({
    slug: 'fail', posthog_id: null, kind: 'trends', name: 'Fail', events: [{ event: '$pageview' }],
  }));
  let calls = 0;
  const client: SyncClient = {
    ...fakeClient(),
    createInsight: async (body) => {
      calls += 1;
      if (body.name === 'Fail') throw new Error('500');
      return { ...body, id: 100 + calls };
    },
  };
  const plan = await computePlan({ root, client });
  const result: ApplyResult = await applyPlan({ root, client, plan });
  assert.equal(result.applied, 1);
  assert.equal(result.failed, 1);
});

test('applyPlan: --plan mode never writes to disk', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/i.json'), JSON.stringify({
    slug: 'i', posthog_id: null, kind: 'trends', name: 'I', events: [{ event: '$pageview' }],
  }));
  const before = await readFile(join(root, 'insights/i.json'), 'utf8');
  const client = fakeClient();
  const plan = await computePlan({ root, client });
  // computePlan never writes; applyPlan({ dryRun: true }) also never writes
  await applyPlan({ root, client, plan, dryRun: true });
  const after = await readFile(join(root, 'insights/i.json'), 'utf8');
  assert.equal(before, after);
});

test('applyPlan: orphans are never deleted unless deleteOrphans:true', async () => {
  const root = await fixtureRoot();
  const deleteCalls: number[] = [];
  const client: SyncClient = {
    ...fakeClient({ dashboards: [{ id: 999, name: 'Stray' }] }),
    deleteDashboard: async (id) => { deleteCalls.push(id); },
  };
  const plan = await computePlan({ root, client });
  await applyPlan({ root, client, plan });
  assert.deepEqual(deleteCalls, []);
  await applyPlan({ root, client, plan, deleteOrphans: true });
  assert.deepEqual(deleteCalls, [999]);
});

test('applyPlan: wiring pass PATCHes insights with dashboards: [<dashboard_id>]', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'dashboards/d.json'), JSON.stringify({
    slug: 'd', posthog_id: null, name: 'D', description: '', tiles: [{ insight: 'i' }],
  }));
  await writeFile(join(root, 'insights/i.json'), JSON.stringify({
    slug: 'i', posthog_id: null, kind: 'trends', name: 'I', events: [{ event: '$pageview' }],
  }));
  const updateCalls: Array<{ id: number; body: any }> = [];
  const client: SyncClient = {
    ...fakeClient(),
    createInsight: async (body) => ({ ...body, id: 5001 }),
    createDashboard: async (body) => ({ ...body, id: 6001 }),
    updateInsight: async (id, body) => { updateCalls.push({ id, body }); return { ...body, id }; },
  };
  const plan = await computePlan({ root, client });
  await applyPlan({ root, client, plan });
  // The wiring pass should have PATCHed insight 5001 with dashboards: [6001].
  const wiringCalls = updateCalls.filter((c) => c.id === 5001 && Array.isArray(c.body.dashboards));
  assert.equal(wiringCalls.length, 1);
  assert.deepEqual(wiringCalls[0].body.dashboards, [6001]);
});

test('applyPlan: toPostHogDashboard — body excludes tiles and slug, keeps name/description/tags', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'dashboards/d.json'), JSON.stringify({
    slug: 'd', posthog_id: null, name: 'D', description: 'desc', tags: ['gtm'], tiles: [],
  }));
  let createdBody: any = null;
  const client: SyncClient = {
    ...fakeClient(),
    createDashboard: async (body) => { createdBody = body; return { ...body, id: 6001 }; },
  };
  const plan = await computePlan({ root, client });
  await applyPlan({ root, client, plan });
  assert.equal(createdBody !== null, true);
  assert.equal('tiles' in createdBody, false);
  assert.equal('slug' in createdBody, false);
  assert.equal(createdBody.name, 'D');
  assert.equal(createdBody.description, 'desc');
  assert.deepEqual(createdBody.tags, ['gtm']);
});

import { toPostHogInsight, toPostHogDashboard } from './sync.js';

test('toPostHogInsight: trends maps to InsightVizNode/TrendsQuery', () => {
  const out = toPostHogInsight({
    slug: 'x',
    posthog_id: null,
    kind: 'trends',
    name: 'X',
    events: [{ event: '$pageview', math: 'total' }],
    breakdown: '$pathname',
    breakdown_limit: 15,
    date_from: '-30d',
    interval: 'day',
  });
  assert.equal(out.name, 'X');
  assert.equal(out.query.kind, 'InsightVizNode');
  assert.equal(out.query.source.kind, 'TrendsQuery');
  assert.equal(out.query.source.series.length, 1);
  assert.equal(out.query.source.series[0].kind, 'EventsNode');
  assert.equal(out.query.source.series[0].event, '$pageview');
  assert.equal(out.query.source.series[0].math, 'total');
  assert.equal(out.query.source.interval, 'day');
  assert.equal(out.query.source.dateRange.date_from, '-30d');
  assert.equal(out.query.source.breakdownFilter.breakdown, '$pathname');
  assert.equal(out.query.source.breakdownFilter.breakdown_type, 'event');
  assert.equal(out.query.source.breakdownFilter.breakdown_limit, 15);
});

test('toPostHogInsight: funnel maps to InsightVizNode/FunnelsQuery', () => {
  const out = toPostHogInsight({
    slug: 'f',
    posthog_id: null,
    kind: 'funnel',
    name: 'F',
    window_minutes: 30,
    steps: [{ event: 'cockpit:install_command_copied' }, { event: 'cockpit:transport_connected' }],
    date_from: '-30d',
  });
  assert.equal(out.query.kind, 'InsightVizNode');
  assert.equal(out.query.source.kind, 'FunnelsQuery');
  assert.equal(out.query.source.series.length, 2);
  assert.equal(out.query.source.series[0].kind, 'EventsNode');
  assert.equal(out.query.source.series[0].event, 'cockpit:install_command_copied');
  assert.equal(out.query.source.funnelsFilter.funnelWindowInterval, 30);
  assert.equal(out.query.source.funnelsFilter.funnelWindowIntervalUnit, 'minute');
  assert.equal(out.query.source.dateRange.date_from, '-30d');
});

test('toPostHogDashboard: returns name/description/tags, drops slug/tiles/posthog_id', () => {
  const out = toPostHogDashboard({
    slug: 'developer-funnel',
    posthog_id: 1234,
    name: 'GTM · Developer funnel',
    description: 'desc',
    tags: ['gtm', 'developer-track'],
    tiles: [{ insight: 'x' }],
  });
  assert.equal(out.name, 'GTM · Developer funnel');
  assert.equal(out.description, 'desc');
  assert.deepEqual(out.tags, ['gtm', 'developer-track']);
  assert.equal('slug' in out, false);
  assert.equal('tiles' in out, false);
  assert.equal('posthog_id' in out, false);
});
