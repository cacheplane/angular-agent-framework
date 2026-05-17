import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NGAF_RUNTIME_EVENTS,
  TELEMETRY_EVENT_CONTRACT,
  TELEMETRY_FORBIDDEN_PROPERTIES,
} from './telemetry-contract.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const INSIGHTS_DIR = join(HERE, 'insights');

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function insightFiles(): Promise<string[]> {
  return (await readdir(INSIGHTS_DIR)).filter((file) => file.endsWith('.json')).sort();
}

test('every insight event is registered in the telemetry contract', async () => {
  const referenced = new Set<string>();
  for (const file of await insightFiles()) {
    const insight = await readJson<{ events?: Array<{ event?: string }>; steps?: Array<{ event?: string }> }>(
      join(INSIGHTS_DIR, file),
    );
    for (const item of [...(insight.events ?? []), ...(insight.steps ?? [])]) {
      if (item.event) referenced.add(item.event);
    }
  }

  const unregistered = [...referenced].filter((event) => !(event in TELEMETRY_EVENT_CONTRACT)).sort();
  assert.deepEqual(
    unregistered,
    [],
    `Insights reference events missing from TELEMETRY_EVENT_CONTRACT:\n${unregistered.join('\n')}`,
  );
});

test('insight breakdown properties are allowed by the event contract', async () => {
  const violations: string[] = [];
  for (const file of await insightFiles()) {
    const insight = await readJson<{ slug: string; breakdown?: string; events?: Array<{ event?: string }> }>(
      join(INSIGHTS_DIR, file),
    );
    if (!insight.breakdown) continue;
    for (const item of insight.events ?? []) {
      const event = item.event;
      if (!event) continue;
      const allowed = TELEMETRY_EVENT_CONTRACT[event]?.allowedBreakdowns ?? [];
      if (!allowed.includes(insight.breakdown)) {
        violations.push(`${insight.slug}: ${event} breaks down by ${insight.breakdown}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Insight breakdowns are not allowed by the telemetry contract:\n${violations.join('\n')}`,
  );
});

test('insight property filters are allowed by the event contract', async () => {
  const violations: string[] = [];
  for (const file of await insightFiles()) {
    const insight = await readJson<{
      slug: string;
      events?: Array<{ event?: string; properties?: Array<{ key?: string }> }>;
    }>(join(INSIGHTS_DIR, file));

    for (const item of insight.events ?? []) {
      const event = item.event;
      if (!event) continue;
      const allowed = TELEMETRY_EVENT_CONTRACT[event]?.allowedProperties ?? [];
      for (const property of item.properties ?? []) {
        if (property.key && !allowed.includes(property.key)) {
          violations.push(`${insight.slug}: ${event} filters by ${property.key}`);
        }
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Insight property filters are not allowed by the telemetry contract:\n${violations.join('\n')}`,
  );
});

test('runtime dashboard covers every runtime event exactly once', async () => {
  const dashboard = await readJson<{ tiles: Array<{ insight: string }> }>(
    join(HERE, 'dashboards', 'runtime-telemetry.json'),
  );

  const coveredEventCounts = new Map<string, number>();
  for (const tile of dashboard.tiles) {
    const insight = await readJson<{ events?: Array<{ event?: string }> }>(
      join(INSIGHTS_DIR, `${tile.insight}.json`),
    );
    for (const item of insight.events ?? []) {
      if (item.event) {
        coveredEventCounts.set(item.event, (coveredEventCounts.get(item.event) ?? 0) + 1);
      }
    }
  }

  const actualCoverage = [...coveredEventCounts.entries()]
    .sort(([leftEvent], [rightEvent]) => leftEvent.localeCompare(rightEvent));
  const expectedCoverage: Array<[string, number]> = NGAF_RUNTIME_EVENTS
    .map((event): [string, number] => [event, 1])
    .sort(([leftEvent], [rightEvent]) => leftEvent.localeCompare(rightEvent));

  assert.deepEqual(actualCoverage, expectedCoverage);
});

test('public AgentRuntimeTelemetryEvent union matches the runtime event contract', async () => {
  const runtimeTelemetrySource = await readFile(
    join(REPO_ROOT, 'libs', 'chat', 'src', 'lib', 'agent', 'runtime-telemetry.ts'),
    'utf8',
  );
  const match = runtimeTelemetrySource.match(/export type AgentRuntimeTelemetryEvent =([\s\S]*?);/);
  assert(match, 'AgentRuntimeTelemetryEvent type not found');

  const exportedEvents = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(exportedEvents, [...NGAF_RUNTIME_EVENTS].sort());
});

test('sensitive runtime fields are forbidden and never allowed by any event contract', () => {
  assert.deepEqual(
    [...TELEMETRY_FORBIDDEN_PROPERTIES].sort(),
    ['apiUrl', 'assistantId', 'error', 'errorMessage', 'messages', 'prompt', 'query', 'threadId'].sort(),
  );

  const forbiddenProperties = new Set<string>(TELEMETRY_FORBIDDEN_PROPERTIES);
  const violations = Object.entries(TELEMETRY_EVENT_CONTRACT)
    .flatMap(([event, contract]) =>
      contract.allowedProperties
        .filter((property) => forbiddenProperties.has(property))
        .map((property) => `${event}: ${property}`),
    );

  assert.deepEqual(
    violations,
    [],
    `Sensitive properties must not be allowed by telemetry contracts:\n${violations.join('\n')}`,
  );
});
