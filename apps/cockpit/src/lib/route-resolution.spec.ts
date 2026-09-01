import { describe, expect, it } from 'vitest';
import { cockpitManifest } from '@threadplane/cockpit-registry';
import {
  buildNavigationTree,
  getCapabilityPresentation,
  resolveCockpitEntry,
} from './route-resolution';

describe('resolveCockpitEntry', () => {
  it('resolves exact entries from shared manifest metadata', () => {
    expect(
      resolveCockpitEntry({
        manifest: cockpitManifest,
        product: 'langgraph',
        section: 'core-capabilities',
        topic: 'streaming',
        page: 'overview',
        language: 'python',
      })
    ).toMatchObject({
      product: 'langgraph',
      topic: 'streaming',
      language: 'python',
    });
  });

  it('falls back to the product getting-started overview when the requested language has no equivalent', () => {
    expect(
      resolveCockpitEntry({
        manifest: cockpitManifest,
        product: 'langgraph',
        section: 'core-capabilities',
        topic: 'streaming',
        page: 'overview',
        language: 'typescript',
      })
    ).toMatchObject({
      product: 'langgraph',
      section: 'getting-started',
      topic: 'overview',
      language: 'python',
    });
  });
});

describe('buildNavigationTree', () => {
  it('groups manifest entries by product and section', () => {
    const tree = buildNavigationTree(cockpitManifest);

    expect(tree.map((product) => product.product)).toEqual([
      'deep-agents',
      'langgraph',
      'ag-ui',
      'render',
      'chat',
      'runtimes',
    ]);
  });

  it('lists every runtimes topic under core-capabilities', () => {
    const runtimes = buildNavigationTree(cockpitManifest).find(
      (product) => product.product === 'runtimes'
    );
    const coreCapabilities = runtimes?.sections.find(
      (section) => section.section === 'core-capabilities'
    );

    expect(coreCapabilities?.entries.map((entry) => entry.topic)).toEqual([
      'microsoft-agent-framework',
      'aws-strands',
      'mastra',
    ]);
  });
});

describe('runtimes capability presentation', () => {
  const resolveRuntime = (topic: string, language: 'python' | 'typescript' = 'python') =>
    resolveCockpitEntry({
      manifest: cockpitManifest,
      product: 'runtimes',
      section: 'core-capabilities',
      topic,
      page: 'overview',
      language,
    });

  it('resolves each runtime topic instead of throwing', () => {
    for (const topic of ['microsoft-agent-framework', 'aws-strands', 'mastra']) {
      expect(resolveRuntime(topic)).toMatchObject({
        product: 'runtimes',
        topic,
        entryKind: 'capability',
      });
    }
  });

  it('serves Python-lane runtimes from their registered module assets', () => {
    const presentation = getCapabilityPresentation(resolveRuntime('aws-strands'));

    expect(presentation.kind).toBe('capability');
    if (presentation.kind !== 'capability') return;
    expect(presentation.runtimeUrl).toBe('runtimes/aws-strands');
    expect(presentation.backendAssetPaths).toContain(
      'cockpit/runtimes/aws-strands/python/src/agent.py'
    );
  });

  it('falls back to the Angular-lane module for a runtime with no Python lane', () => {
    const presentation = getCapabilityPresentation(resolveRuntime('mastra'));

    expect(presentation.kind).toBe('capability');
    if (presentation.kind !== 'capability') return;
    // The manifest entry's language is 'python' (the canonical URL lane) but
    // Mastra's only descriptor is the Angular one — the lookup must still find
    // it rather than falling through to non-existent cockpit/runtimes/mastra/python paths.
    expect(presentation.codeAssetPaths).toContain(
      'cockpit/runtimes/mastra/angular/src/app/mastra.component.ts'
    );
    expect(presentation.promptAssetPaths).toEqual([
      'cockpit/runtimes/mastra/angular/prompts/mastra.md',
    ]);
  });
});

describe('getCapabilityPresentation', () => {
  it('distinguishes docs-only entries from capability entries', () => {
    const docsEntry = resolveCockpitEntry({
      manifest: cockpitManifest,
      product: 'deep-agents',
      section: 'getting-started',
      topic: 'overview',
      page: 'overview',
      language: 'python',
    });
    const capabilityEntry = resolveCockpitEntry({
      manifest: cockpitManifest,
      product: 'langgraph',
      section: 'core-capabilities',
      topic: 'streaming',
      page: 'overview',
      language: 'python',
    });

    expect(getCapabilityPresentation(docsEntry)).toMatchObject({
      kind: 'docs-only',
      docsPath: '/docs/deep-agents/getting-started/overview/overview/python',
    });
    expect(getCapabilityPresentation(capabilityEntry)).toMatchObject({
      kind: 'capability',
      docsPath: '/docs/langgraph/core-capabilities/streaming/overview/python',
      promptAssetPaths: ['cockpit/langgraph/streaming/python/prompts/streaming.md'],
      codeAssetPaths: [
        'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts',
        'cockpit/langgraph/streaming/angular/src/app/app.config.ts',
      ],
    });
  });

  it('includes backendAssetPaths from the capability module', () => {
    const entry = resolveCockpitEntry({
      manifest: cockpitManifest,
      product: 'langgraph',
      section: 'core-capabilities',
      topic: 'streaming',
      page: 'overview',
      language: 'python',
    });
    const presentation = getCapabilityPresentation(entry);

    expect(presentation).toMatchObject({
      kind: 'capability',
      backendAssetPaths: ['cockpit/langgraph/streaming/python/src/graph.py'],
    });
  });

  it('includes runtimeUrl and devPort from the capability module', () => {
    const entry = resolveCockpitEntry({
      manifest: cockpitManifest,
      product: 'langgraph',
      section: 'core-capabilities',
      topic: 'streaming',
      page: 'overview',
      language: 'python',
    });
    const presentation = getCapabilityPresentation(entry);

    expect(presentation).toMatchObject({
      kind: 'capability',
      runtimeUrl: 'langgraph/streaming',
      devPort: 4300,
    });
  });

  it('includes durable execution docs assets from the capability module', () => {
    const entry = resolveCockpitEntry({
      manifest: cockpitManifest,
      product: 'langgraph',
      section: 'core-capabilities',
      topic: 'durable-execution',
      page: 'overview',
      language: 'python',
    });
    const presentation = getCapabilityPresentation(entry);

    expect(presentation).toMatchObject({
      kind: 'capability',
      docsPath: '/docs/langgraph/core-capabilities/durable-execution/overview/python',
      docsAssetPaths: ['cockpit/langgraph/durable-execution/python/docs/guide.md'],
    });
  });

  it('presents render capabilities with module-backed metadata', () => {
    const entry = resolveCockpitEntry({
      manifest: cockpitManifest,
      product: 'render',
      section: 'core-capabilities',
      topic: 'spec-rendering',
      page: 'overview',
      language: 'python',
    });
    const presentation = getCapabilityPresentation(entry);

    expect(presentation).toMatchObject({
      kind: 'capability',
      docsPath: '/docs/render/core-capabilities/spec-rendering/overview/python',
    });
  });

  it('presents chat capabilities with module-backed metadata', () => {
    const entry = resolveCockpitEntry({
      manifest: cockpitManifest,
      product: 'chat',
      section: 'core-capabilities',
      topic: 'messages',
      page: 'overview',
      language: 'python',
    });
    const presentation = getCapabilityPresentation(entry);

    expect(presentation).toMatchObject({
      kind: 'capability',
      docsPath: '/docs/chat/core-capabilities/messages/overview/python',
    });
  });

  it('resolves module-backed metadata for every implemented capability topic', () => {
    const capabilityEntries = cockpitManifest.filter(
      (entry) => entry.entryKind === 'capability'
    );

    for (const entry of capabilityEntries) {
      expect(getCapabilityPresentation(entry)).toMatchObject({
        kind: 'capability',
      });
      expect(
        (getCapabilityPresentation(entry).kind === 'capability' &&
          getCapabilityPresentation(entry).promptAssetPaths.length > 0) ||
          false
      ).toBe(true);
      expect(
        (getCapabilityPresentation(entry).kind === 'capability' &&
          getCapabilityPresentation(entry).codeAssetPaths.length > 0) ||
          false
      ).toBe(true);
    }
  });
});
