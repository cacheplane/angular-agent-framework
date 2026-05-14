import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DashboardLocal, InsightLocal, CohortLocal } from './schema.js';

const TOOLS_POSTHOG = new URL('.', import.meta.url).pathname;

test('DashboardLocal accepts minimal valid input', () => {
  const result = DashboardLocal.safeParse({
    slug: 'developer-funnel',
    posthog_id: null,
    name: 'GTM · Developer funnel',
    description: 'Pageview → install → activation.',
    tiles: [{ insight: 'pageviews-by-landing' }],
  });
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data.tags, []);  // default
});

test('DashboardLocal rejects uppercase slug', () => {
  const result = DashboardLocal.safeParse({
    slug: 'Bad-Slug',
    posthog_id: null,
    name: 'x',
    description: 'x',
    tiles: [],
  });
  assert.equal(result.success, false);
});

test('InsightLocal accepts a trend with breakdown', () => {
  const result = InsightLocal.safeParse({
    slug: 'pageviews-by-landing',
    posthog_id: null,
    kind: 'trends',
    name: 'Pageviews by landing path',
    events: [{ event: '$pageview', math: 'total' }],
    breakdown: '$pathname',
    date_from: '-30d',
  });
  assert.equal(result.success, true);
});

test('InsightLocal funnel requires steps', () => {
  const result = InsightLocal.safeParse({
    slug: 'six-signal',
    posthog_id: null,
    kind: 'funnel',
    name: 'six',
    window_minutes: 30,
    date_from: '-30d',
  });
  assert.equal(result.success, false);
});

test('InsightLocal funnel with steps validates', () => {
  const result = InsightLocal.safeParse({
    slug: 'six-signal',
    posthog_id: null,
    kind: 'funnel',
    name: 'six',
    window_minutes: 30,
    steps: [{ event: 'cockpit:install_command_copied' }],
    date_from: '-30d',
  });
  assert.equal(result.success, true);
});

test('CohortLocal accepts pass-through query', () => {
  const result = CohortLocal.safeParse({
    slug: 'activated-developers',
    posthog_id: null,
    name: 'Activated developers',
    description: 'last 30d',
    query: { kind: 'ActorsQuery', source: {} },
  });
  assert.equal(result.success, true);
});

test('every committed JSON in dashboards/insights/cohorts parses', async () => {
  const root = TOOLS_POSTHOG;
  const checks = [
    { dir: 'dashboards', schema: DashboardLocal },
    { dir: 'insights', schema: InsightLocal },
    { dir: 'cohorts', schema: CohortLocal },
  ];
  for (const { dir, schema } of checks) {
    // readdir + filter is Node 20 compatible; fs.glob requires Node 22+.
    let files: string[];
    try {
      files = (await readdir(join(root, dir))).filter((f) => f.endsWith('.json'));
    } catch {
      continue;  // missing directory is fine
    }
    for (const f of files) {
      const path = join(root, dir, f);
      const json = JSON.parse(await readFile(path, 'utf8'));
      const result = schema.safeParse(json);
      assert.equal(result.success, true, `${path}: ${result.success ? '' : JSON.stringify(result.error.issues)}`);
    }
  }
});
