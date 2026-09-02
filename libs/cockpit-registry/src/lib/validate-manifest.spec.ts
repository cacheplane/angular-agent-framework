import { describe, expect, it } from 'vitest';
import { cockpitManifest } from './manifest';
import { PRIMARY_CAPABILITY_BY_DOCS_PATH } from './workspace-resolution';
import { validateCockpitManifest, validateManifest } from './validate-manifest';
import type { CockpitManifestEntry } from './manifest.types';

const getLangGraphEntry = (topic: string): CockpitManifestEntry => {
  const entry = cockpitManifest.find(
    (candidate) =>
      candidate.product === 'langgraph' && candidate.topic === topic
  );
  if (!entry) throw new Error(`Missing LangGraph manifest entry: ${topic}`);
  return entry;
};

describe('validateCockpitManifest', () => {
  it('accepts the authoritative manifest and explicit reverse mappings', () => {
    expect(validateManifest(cockpitManifest)).toEqual([]);

    const docsPathCounts = new Map<string, number>();
    for (const entry of cockpitManifest) {
      if (!entry.docsPath) continue;
      docsPathCounts.set(
        entry.docsPath,
        (docsPathCounts.get(entry.docsPath) ?? 0) + 1
      );
    }
    const duplicateDocsPaths = [...docsPathCounts]
      .filter(([, count]) => count > 1)
      .map(([docsPath]) => docsPath)
      .sort();

    expect(Object.keys(PRIMARY_CAPABILITY_BY_DOCS_PATH).sort()).toEqual(
      duplicateDocsPaths
    );
  });

  it('rejects duplicate canonical identities', () => {
    const duplicateManifest: CockpitManifestEntry[] = [
      cockpitManifest[0],
      {
        ...cockpitManifest[0],
        title: 'Duplicate entry',
      },
    ];

    expect(validateCockpitManifest(duplicateManifest)).toContain(
      'Duplicate canonical identity: deep-agents/getting-started/overview/overview/python'
    );
  });

  it('rejects fallback targets that do not exist in the manifest', () => {
    const invalidFallbackManifest: CockpitManifestEntry[] = [
      {
        ...cockpitManifest[0],
        fallbackTarget: {
          product: 'langgraph',
          section: 'core-capabilities',
          topic: 'missing-target',
          page: 'overview',
          language: 'typescript',
        },
      },
    ];

    expect(validateCockpitManifest(invalidFallbackManifest)).toEqual([
      'Invalid fallback target for deep-agents/getting-started/overview/overview/python: langgraph/core-capabilities/missing-target/overview/typescript',
    ]);
  });

  it('rejects capability entries without explicit testing metadata', () => {
    const capabilityEntry = getLangGraphEntry('streaming');
    const invalidManifest = [{ ...(capabilityEntry as CockpitManifestEntry) }];

    delete (
      invalidManifest[0] as CockpitManifestEntry & { testingContract?: unknown }
    ).testingContract;

    expect(validateCockpitManifest(invalidManifest)).toContain(
      'Missing testing contract for langgraph/core-capabilities/streaming/overview/python'
    );
  });

  it('rejects secret-gated entries without an integration target', () => {
    const capabilityEntry = getLangGraphEntry('deployment-runtime');
    const invalidManifest = [
      {
        ...capabilityEntry,
        testingContract: {
          ...capabilityEntry.testingContract,
          integrationMode: 'secret-gated' as const,
          integrationTarget: null,
        },
      },
    ];

    expect(validateCockpitManifest(invalidManifest)).toContain(
      'Missing integration target for langgraph/core-capabilities/deployment-runtime/overview/python'
    );
  });

  it('rejects a unique stable ID that does not match its canonical identity', () => {
    const entry = getLangGraphEntry('streaming');
    const invalidId = 'langgraph:core-capabilities:streaming:overview:pythno';

    expect(validateManifest([{ ...entry, id: invalidId }])).toContain(
      `Invalid stable ID for langgraph/core-capabilities/streaming/overview/python: ${invalidId}; expected ${entry.id}`
    );
  });

  it.each([
    ['stable ID', 'id', 'Duplicate stable ID'],
    ['workspace path', 'workspacePath', 'Duplicate workspace path'],
    ['legacy path', 'legacyPath', 'Duplicate legacy path'],
  ] as const)('rejects duplicate %ss', (_label, field, errorCategory) => {
    const first = getLangGraphEntry('streaming');
    const second = getLangGraphEntry('interrupts');
    const invalidManifest = [first, { ...second, [field]: first[field] }];

    expect(validateManifest(invalidManifest)).toContain(
      `${errorCategory}: ${first[field]}`
    );
  });

  it('rejects ambiguous reverse Docs mappings without an explicit primary mapping', () => {
    const persistenceEntries = cockpitManifest.filter(
      (entry) => entry.docsPath === '/docs/langgraph/guides/persistence'
    );

    expect(
      validateManifest(persistenceEntries, { primaryDocsMappings: {} })
    ).toContain(
      'Ambiguous Docs path without an explicit primary capability: /docs/langgraph/guides/persistence'
    );
    expect(
      validateManifest(persistenceEntries, {
        primaryDocsMappings: PRIMARY_CAPABILITY_BY_DOCS_PATH,
      })
    ).not.toContain(
      'Ambiguous Docs path without an explicit primary capability: /docs/langgraph/guides/persistence'
    );
  });

  it.each([
    ['docsPath', 'docs/not-absolute'],
    ['workspacePath', 'workspace/langgraph/streaming'],
    ['legacyPath', 'langgraph/core-capabilities/streaming/overview/python'],
  ] as const)('rejects an invalid %s', (field, value) => {
    const entry = getLangGraphEntry('streaming');

    expect(validateManifest([{ ...entry, [field]: value }])).toContain(
      `Invalid ${field} for ${entry.id}: ${value}`
    );
  });

  it('accepts runnable static entries with no configurable runtime adapter', () => {
    const entry = getLangGraphEntry('streaming');
    const baseline = validateManifest([entry]);

    expect(validateManifest([{ ...entry, runtimeAdapter: 'none' }])).toEqual(
      baseline
    );
  });

  it('does not derive configurable transport compatibility from Run availability', () => {
    const entry = getLangGraphEntry('streaming');
    const baseline = validateManifest([entry]);

    expect(
      validateManifest([
        { ...entry, runtimeAdapter: 'langgraph', availableModes: ['Docs'] },
      ])
    ).toEqual(baseline);
  });
});
