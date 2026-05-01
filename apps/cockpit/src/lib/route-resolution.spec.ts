import { describe, expect, it } from 'vitest';
import { cockpitManifest } from '@ngaf/cockpit-registry';
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

    expect(tree).toHaveLength(4);
    expect(tree[0]).toMatchObject({
      product: 'deep-agents',
    });
    expect(tree[1]).toMatchObject({
      product: 'langgraph',
    });
    expect(tree[2]).toMatchObject({
      product: 'render',
    });
    expect(tree[3]).toMatchObject({
      product: 'chat',
    });
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
