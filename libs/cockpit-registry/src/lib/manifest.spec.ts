import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { cockpitManifest } from './manifest';
import type { CockpitManifestEntry } from './manifest.types';

const expectedTopics = {
  'deep-agents': [
    ['getting-started', 'overview'],
    ['core-capabilities', 'planning'],
    ['core-capabilities', 'filesystem'],
    ['core-capabilities', 'subagents'],
    ['core-capabilities', 'memory'],
    ['core-capabilities', 'skills'],
    ['core-capabilities', 'sandboxes'],
  ],
  langgraph: [
    ['getting-started', 'overview'],
    ['core-capabilities', 'persistence'],
    ['core-capabilities', 'durable-execution'],
    ['core-capabilities', 'streaming'],
    ['core-capabilities', 'interrupts'],
    ['core-capabilities', 'memory'],
    ['core-capabilities', 'subgraphs'],
    ['core-capabilities', 'time-travel'],
    ['core-capabilities', 'deployment-runtime'],
  ],
  render: [
    ['getting-started', 'overview'],
    ['core-capabilities', 'spec-rendering'],
    ['core-capabilities', 'element-rendering'],
    ['core-capabilities', 'state-management'],
    ['core-capabilities', 'registry'],
    ['core-capabilities', 'repeat-loops'],
    ['core-capabilities', 'computed-functions'],
  ],
  chat: [
    ['getting-started', 'overview'],
    ['core-capabilities', 'messages'],
    ['core-capabilities', 'input'],
    ['core-capabilities', 'interrupts'],
    ['core-capabilities', 'tool-calls'],
    ['core-capabilities', 'subagents'],
    ['core-capabilities', 'threads'],
    ['core-capabilities', 'timeline'],
    ['core-capabilities', 'generative-ui'],
    ['core-capabilities', 'debug'],
    ['core-capabilities', 'theming'],
  ],
} as const;

describe('cockpitManifest', () => {
  it('uses the canonical registry identity and metadata contract', () => {
    const entry: CockpitManifestEntry = cockpitManifest[0];

    expect(entry).toMatchObject({
      product: 'deep-agents',
      section: 'getting-started',
      topic: 'overview',
      page: 'overview',
      language: 'python',
      entryKind: 'docs-only',
      runtimeClass: 'docs-only',
      canonicalLanguage: 'python',
    });
  });

  it('contains the approved initial inventory as python overview entries', () => {
    const identities = cockpitManifest.map(
      ({ product, section, topic, page, language }) =>
        `${product}/${section}/${topic}/${page}/${language}`
    );

    for (const [product, topics] of Object.entries(expectedTopics)) {
      for (const [section, topic] of topics) {
        expect(identities).toContain(`${product}/${section}/${topic}/overview/python`);
      }
    }
  });

  it('marks only getting-started overview entries as docs-only in the initial inventory', () => {
    const docsOnlyEntries = cockpitManifest
      .filter((entry) => entry.entryKind === 'docs-only')
      .map(({ product, section, topic }) => `${product}/${section}/${topic}`);

    expect(docsOnlyEntries).toEqual([
      'deep-agents/getting-started/overview',
      'langgraph/getting-started/overview',
      'render/getting-started/overview',
      'chat/getting-started/overview',
    ]);
  });

  it('tracks implemented python assets for every approved capability topic', () => {
    const capabilityEntries = cockpitManifest.filter(
      (entry) => entry.entryKind === 'capability'
    );

    expect(capabilityEntries).toHaveLength(30);

    for (const entry of capabilityEntries) {
      expect(entry.supportedLanguages).toEqual(['python']);
      expect(entry.docsPath).toBe(
        `/docs/${entry.product}/${entry.section}/${entry.topic}/overview/python`
      );
      expect(entry.implementationStatus).toBe('implemented');
      expect(entry.docsStatus).toBe('docs-authored');
      expect(entry.testStatus).toBe('smoke-tested');
      expect(entry.promptAssetPaths.length).toBeGreaterThan(0);
      expect(entry.codeAssetPaths.length).toBeGreaterThan(0);

      for (const assetPath of [...entry.promptAssetPaths, ...entry.codeAssetPaths]) {
        expect(fs.existsSync(assetPath)).toBe(true);
      }
    }
  });

  it('marks secret-gated integration explicitly for deployment runtime', () => {
    const deploymentRuntimeEntry = cockpitManifest.find(
      (entry) =>
        entry.product === 'langgraph' &&
        entry.section === 'core-capabilities' &&
        entry.topic === 'deployment-runtime'
    );

    expect(deploymentRuntimeEntry).toMatchObject({
      runtimeClass: 'deployed-service',
      testingContract: {
        smokeTarget: 'cockpit-langgraph-deployment-runtime-python:smoke',
        integrationTarget: 'cockpit-langgraph-deployment-runtime-python:integration',
        integrationMode: 'secret-gated',
        deploySmokePath:
          '/langgraph/core-capabilities/deployment-runtime/overview/python',
      },
    });
  });
});
