import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const topicNames = [
  'spec-rendering',
  'element-rendering',
  'state-management',
  'registry',
  'repeat-loops',
  'computed-functions',
] as const;

const pageNames = ['overview', 'build', 'prompts', 'code', 'testing'] as const;

const renderRoot = path.join(process.cwd(), 'cockpit', 'render');
const websiteDocsRoot = path.join(
  process.cwd(), 'apps', 'website', 'content', 'docs', 'render'
);

describe('Render footprint', () => {
  it('keeps the getting-started overview in place', () => {
    expect(
      fs.existsSync(
        path.join(websiteDocsRoot, 'getting-started', 'overview', 'python', 'overview.mdx')
      )
    ).toBe(true);
  });

  it('creates the approved topic modules and docs pages', () => {
    for (const topic of topicNames) {
      const moduleRoot = path.join(renderRoot, topic, 'python');
      const projectJsonPath = path.join(renderRoot, topic, 'angular', 'project.json');

      expect(fs.existsSync(path.join(moduleRoot, 'src', 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(moduleRoot, 'prompts', `${topic}.md`))).toBe(true);
      expect(fs.existsSync(projectJsonPath)).toBe(true);

      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
      expect(projectJson.targets?.smoke?.executor).toBe('nx:run-commands');

      for (const page of pageNames) {
        expect(
          fs.existsSync(
            path.join(websiteDocsRoot, 'core-capabilities', topic, 'python', `${page}.mdx`)
          )
        ).toBe(true);
      }
    }
  });
});
