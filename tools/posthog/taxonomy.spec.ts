import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const INSIGHTS_DIR = join(HERE, 'insights');
const TAXONOMY_PATH = join(HERE, '..', '..', 'docs', 'gtm', 'taxonomy.md');

test('every event in any insight JSON appears in docs/gtm/taxonomy.md', async () => {
  // 1. Collect events referenced in insights.
  const referenced = new Set<string>();
  const files = (await readdir(INSIGHTS_DIR)).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const json = JSON.parse(await readFile(join(INSIGHTS_DIR, f), 'utf8'));
    for (const step of json.steps ?? []) {
      if (typeof step.event === 'string') referenced.add(step.event);
    }
    for (const ev of json.events ?? []) {
      if (typeof ev.event === 'string') referenced.add(ev.event);
    }
  }

  // 2. Collect events documented in taxonomy.md.
  const taxonomy = await readFile(TAXONOMY_PATH, 'utf8');
  const matches = taxonomy.matchAll(/`(\$pageview|(?:marketing|cockpit|tplane|docs):[a-z_]+)`/g);
  const documented = new Set<string>();
  for (const m of matches) documented.add(m[1]);

  // 3. Difference.
  const undocumented = [...referenced].filter((e) => !documented.has(e));
  assert.deepEqual(
    undocumented,
    [],
    `Events used in dashboards but missing from docs/gtm/taxonomy.md:\n${undocumented.join('\n')}`,
  );
});
