import { describe, expect, it } from 'vitest';
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
    ]);
  });
});
