import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const TAXONOMY_PATH = join(REPO_ROOT, 'docs', 'gtm', 'taxonomy.md');

const SCAN_ROOTS = [
  'apps/website/src',
  'apps/website/instrumentation-client.ts',
  'apps/cockpit/src',
  'apps/cockpit/instrumentation-client.ts',
  'libs/cockpit-telemetry/src',
  'libs/telemetry/src',
];

const EVENT_NAME_RE = /^(?:\$pageview|(?:marketing|cockpit|tplane|docs):[a-z_]+)$/;

const CAPTURE_PATTERNS: RegExp[] = [
  /posthog\.capture\(\s*['"]([^'"]+)['"]/g,
  /\btrack\(\s*['"]([^'"]+)['"]/g,
  /captureServerEvent\(\s*\{\s*[^}]*?event:\s*['"]([^'"]+)['"]/gs,
];

const ANALYTICS_EVENTS_REF_RE = /analyticsEvents\.([a-zA-Z]+)/g;

async function walk(path: string, files: string[]): Promise<void> {
  let info;
  try {
    info = await stat(path);
  } catch {
    return;
  }
  if (info.isFile()) {
    files.push(path);
    return;
  }
  if (!info.isDirectory()) return;
  const entries = await readdir(path, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist') continue;
    const full = join(path, e.name);
    if (e.isDirectory()) {
      await walk(full, files);
    } else if (
      (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) &&
      !e.name.endsWith('.spec.ts') &&
      !e.name.endsWith('.spec.tsx')
    ) {
      files.push(full);
    }
  }
}

async function loadAnalyticsEventsMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const path = join(REPO_ROOT, 'apps', 'website', 'src', 'lib', 'analytics', 'events.ts');
  let body: string;
  try {
    body = await readFile(path, 'utf8');
  } catch {
    return map;
  }
  const entryRe = /(\w+):\s*['"]([^'"]+)['"]/g;
  for (const m of body.matchAll(entryRe)) {
    map.set(m[1], m[2]);
  }
  return map;
}

test('every event fired in code appears in docs/gtm/taxonomy.md', async () => {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    await walk(join(REPO_ROOT, root), files);
  }

  const aliasMap = await loadAnalyticsEventsMap();

  const referenced = new Set<string>();
  for (const file of files) {
    const body = await readFile(file, 'utf8');

    for (const pattern of CAPTURE_PATTERNS) {
      pattern.lastIndex = 0;
      for (const m of body.matchAll(pattern)) {
        const candidate = m[1];
        if (EVENT_NAME_RE.test(candidate)) referenced.add(candidate);
      }
    }

    ANALYTICS_EVENTS_REF_RE.lastIndex = 0;
    for (const m of body.matchAll(ANALYTICS_EVENTS_REF_RE)) {
      const key = m[1];
      const resolved = aliasMap.get(key);
      if (resolved && EVENT_NAME_RE.test(resolved)) referenced.add(resolved);
    }
  }

  const taxonomy = await readFile(TAXONOMY_PATH, 'utf8');
  const documented = new Set<string>();
  for (const m of taxonomy.matchAll(/`(\$pageview|(?:marketing|cockpit|tplane|docs):[a-z_]+)`/g)) {
    documented.add(m[1]);
  }

  const undocumented = [...referenced].filter((e) => !documented.has(e)).sort();
  assert.deepEqual(
    undocumented,
    [],
    `Events fired in code but missing from docs/gtm/taxonomy.md:\n${undocumented.join('\n')}\n\n` +
      `Add a row to taxonomy.md (Marketing / Cockpit / tplane / Docs section as appropriate) ` +
      `so the dashboards-as-code guard knows the event is intentional.`,
  );
});
