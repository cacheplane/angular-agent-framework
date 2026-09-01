import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const topicNames = [
  'spec-rendering',
  'element-rendering',
  'state-management',
  'registry',
  'repeat-loops',
  'computed-functions',
] as const;

// Resolve from this file, not process.cwd(). These specs run under
// `nx test cockpit`, whose cwd is apps/cockpit — a cwd-relative root silently
// points at apps/cockpit/cockpit/... and turns every existence assertion into
// a vacuous pass (or an unrelated ENOENT).
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const renderRoot = path.join(repoRoot, 'cockpit', 'render');

// The per-topic website .mdx assertions this spec used to carry asserted the
// five-segment docs shape #918 removed (see
// libs/cockpit-registry/src/lib/docs-links.ts: it "produced a URL that 404s for
// every product"). The website tree is organised by guide, not by cockpit
// topic. That coupling is now a table checked against the website's real
// content tree by apps/cockpit/src/lib/docs-links.spec.ts.
describe('Render footprint', () => {
  it('creates the approved topic modules', () => {
    for (const topic of topicNames) {
      const moduleRoot = path.join(renderRoot, topic, 'python');
      const projectJsonPath = path.join(
        renderRoot,
        topic,
        'angular',
        'project.json'
      );

      expect(fs.existsSync(path.join(moduleRoot, 'src', 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(moduleRoot, 'prompts', `${topic}.md`))).toBe(
        true
      );
      expect(fs.existsSync(projectJsonPath)).toBe(true);

      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
      expect(projectJson.targets?.smoke?.executor).toBe('nx:run-commands');
    }
  });
});
