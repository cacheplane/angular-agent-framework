import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const topicNames = [
  'planning',
  'filesystem',
  'subagents',
  'memory',
  'skills',
] as const;

const pageNames = ['overview', 'build', 'prompts', 'code', 'testing'] as const;

const deepAgentsRoot = path.join(process.cwd(), 'cockpit', 'deep-agents');
const websiteDocsRoot = path.join(
  process.cwd(),
  'apps',
  'website',
  'content',
  'docs',
  'deep-agents'
);

describe('Deep Agents Phase 5 footprint', () => {
  it('keeps the getting-started overview in place', () => {
    expect(
      fs.existsSync(
        path.join(
          websiteDocsRoot,
          'getting-started',
          'overview',
          'python',
          'overview.mdx'
        )
      )
    ).toBe(true);
  });

  it('creates the approved topic modules and docs pages', () => {
    for (const topic of topicNames) {
      const moduleRoot = path.join(deepAgentsRoot, topic, 'python');
      const projectJson = JSON.parse(
        fs.readFileSync(path.join(moduleRoot, 'project.json'), 'utf8')
      );

      expect(fs.existsSync(path.join(moduleRoot, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(moduleRoot, 'project.json'))).toBe(true);
      expect(fs.existsSync(path.join(moduleRoot, 'tsconfig.json'))).toBe(true);
      expect(fs.existsSync(path.join(moduleRoot, 'src', 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(moduleRoot, 'prompts', `${topic}.md`))).toBe(true);
      expect(projectJson.targets?.smoke?.executor).toBe('nx:run-commands');
      expect(projectJson.targets?.smoke?.options?.command).toContain(
        'src/index.ts'
      );

      for (const page of pageNames) {
        expect(
          fs.existsSync(
            path.join(
              websiteDocsRoot,
              'core-capabilities',
              topic,
              'python',
              `${page}.mdx`
            )
          )
        ).toBe(true);
      }
    }
  });
});
