import { COCKPIT_DOCS_LINKS, cockpitManifest } from '@threadplane/cockpit-registry';
import { describe, expect, it } from 'vitest';
import { findDocsPage } from './docs-config';
import {
  buildCockpitHandoffProperties,
  buildCockpitModeHref,
  docsCockpitMappings,
  resolveCockpitIdentity,
} from './cockpit-links';

describe('Docs-to-Cockpit links', () => {
  it('contains the exhaustive first-iteration mapping set', () => {
    expect(docsCockpitMappings).toEqual({
      'deep-agents/getting-started/introduction': {
        product: 'deep-agents', section: 'getting-started', topic: 'overview', page: 'overview', language: 'python',
      },
      'deep-agents/capabilities/planning': {
        product: 'deep-agents', section: 'core-capabilities', topic: 'planning', page: 'overview', language: 'python',
      },
      'deep-agents/capabilities/filesystem': {
        product: 'deep-agents', section: 'core-capabilities', topic: 'filesystem', page: 'overview', language: 'python',
      },
      'deep-agents/capabilities/subagents': {
        product: 'deep-agents', section: 'core-capabilities', topic: 'subagents', page: 'overview', language: 'python',
      },
      'deep-agents/capabilities/memory': {
        product: 'deep-agents', section: 'core-capabilities', topic: 'memory', page: 'overview', language: 'python',
      },
      'deep-agents/capabilities/skills': {
        product: 'deep-agents', section: 'core-capabilities', topic: 'skills', page: 'overview', language: 'python',
      },
      'runtimes/getting-started/introduction': {
        product: 'runtimes', section: 'getting-started', topic: 'overview', page: 'overview', language: 'python',
      },
      'runtimes/aws-strands/overview': {
        product: 'runtimes', section: 'core-capabilities', topic: 'aws-strands', page: 'overview', language: 'python',
      },
      'runtimes/aws-strands/quickstart': {
        product: 'runtimes', section: 'core-capabilities', topic: 'aws-strands', page: 'overview', language: 'python',
      },
      'runtimes/aws-strands/how-it-connects': {
        product: 'runtimes', section: 'core-capabilities', topic: 'aws-strands', page: 'overview', language: 'python',
      },
      'runtimes/microsoft-agent-framework/overview': {
        product: 'runtimes', section: 'core-capabilities', topic: 'microsoft-agent-framework', page: 'overview', language: 'python',
      },
      'runtimes/microsoft-agent-framework/quickstart': {
        product: 'runtimes', section: 'core-capabilities', topic: 'microsoft-agent-framework', page: 'overview', language: 'python',
      },
      'runtimes/microsoft-agent-framework/how-it-connects': {
        product: 'runtimes', section: 'core-capabilities', topic: 'microsoft-agent-framework', page: 'overview', language: 'python',
      },
      'runtimes/mastra/overview': {
        product: 'runtimes', section: 'core-capabilities', topic: 'mastra', page: 'overview', language: 'python',
      },
      'runtimes/mastra/quickstart': {
        product: 'runtimes', section: 'core-capabilities', topic: 'mastra', page: 'overview', language: 'python',
      },
      'runtimes/mastra/how-it-connects': {
        product: 'runtimes', section: 'core-capabilities', topic: 'mastra', page: 'overview', language: 'python',
      },
      'langgraph/guides/streaming': {
        product: 'langgraph', section: 'core-capabilities', topic: 'streaming', page: 'overview', language: 'python',
      },
      'langgraph/guides/deployment': {
        product: 'langgraph', section: 'core-capabilities', topic: 'deployment-runtime', page: 'overview', language: 'python',
      },
      'render/guides/specs': {
        product: 'render', section: 'core-capabilities', topic: 'spec-rendering', page: 'overview', language: 'python',
      },
      'render/guides/registry': {
        product: 'render', section: 'core-capabilities', topic: 'registry', page: 'overview', language: 'python',
      },
      'chat/guides/generative-ui': {
        product: 'chat', section: 'core-capabilities', topic: 'generative-ui', page: 'overview', language: 'python',
      },
    });
  });

  it('resolves only explicit mappings', () => {
    expect(resolveCockpitIdentity('render', 'guides', 'specs')?.topic).toBe('spec-rendering');
    expect(resolveCockpitIdentity('langgraph', 'api', 'inject-agent')).toBeNull();
    expect(resolveCockpitIdentity('docs', 'special', 'choosing-an-adapter')).toBeNull();
  });

  it('targets a mapped capability and appends the requested mode', () => {
    expect(
      buildCockpitModeHref(
        { library: 'langgraph', section: 'guides', slug: 'deployment' },
        'Code',
        'https://local-cockpit.example/base',
      ),
    ).toBe(
      'https://local-cockpit.example/langgraph/core-capabilities/deployment-runtime/overview/python?mode=code',
    );
  });

  it('uses Cockpit home for unsupported pages without guessing', () => {
    expect(
      buildCockpitModeHref(
        { library: 'langgraph', section: 'api', slug: 'inject-agent' },
        'API',
        'https://cockpit.example',
      ),
    ).toBe('https://cockpit.example/?mode=api');
  });

  it('builds safe mapped handoff properties separately from the destination URL', () => {
    expect(
      buildCockpitHandoffProperties(
        { library: 'langgraph', section: 'guides', slug: 'streaming' },
        'Run',
      ),
    ).toEqual({
      library: 'langgraph',
      source_section: 'guides',
      source_slug: 'streaming',
      destination_product: 'langgraph',
      destination_capability: 'streaming',
      requested_mode: 'run',
      mapped: true,
    });
  });

  it('marks unsupported pages as fallback handoffs without leaking a URL', () => {
    const properties = buildCockpitHandoffProperties(
      { library: 'langgraph', section: 'api', slug: 'inject-agent' },
      'API',
    );

    expect(properties).toEqual({
      library: 'langgraph',
      source_section: 'api',
      source_slug: 'inject-agent',
      requested_mode: 'api',
      mapped: false,
    });
    expect(properties).not.toHaveProperty('destination_url');
  });

  it('normalizes libraries outside the analytics allowlist to unknown', () => {
    expect(
      buildCockpitHandoffProperties(
        { library: 'telemetry', section: 'guides', slug: 'overview' },
        'Code',
      ).library,
    ).toBe('unknown');
  });

  it('uses the configured public Cockpit origin by default', () => {
    const original = process.env.NEXT_PUBLIC_COCKPIT_BASE_URL;
    process.env.NEXT_PUBLIC_COCKPIT_BASE_URL = 'https://configured-cockpit.example';
    try {
      expect(
        buildCockpitModeHref(
          { library: 'chat', section: 'guides', slug: 'generative-ui' },
          'Run',
        ),
      ).toContain('https://configured-cockpit.example/chat/core-capabilities/generative-ui/overview/python?mode=run');
    } finally {
      process.env.NEXT_PUBLIC_COCKPIT_BASE_URL = original;
    }
  });

  it('keeps every mapped target aligned with the Cockpit manifest', () => {
    for (const target of Object.values(docsCockpitMappings)) {
      expect(cockpitManifest.some((entry) =>
        entry.product === target.product &&
        entry.section === target.section &&
        entry.topic === target.topic &&
        entry.page === target.page &&
        entry.language === target.language,
      )).toBe(true);
    }
  });

  // A typo'd key is invisible at runtime: the page just never resolves and the
  // reader silently keeps the Cockpit-home fallback. Pin the keys to the real
  // content tree so a typo (or a docs rename) fails here instead.
  it('keys every mapping to a docs page that exists', () => {
    for (const key of Object.keys(docsCockpitMappings)) {
      const [library, section, slug] = key.split('/');
      expect(findDocsPage(library, section, slug), key).toBeDefined();
    }
  });

  // The two directions are separate tables in separate packages. Where the
  // Cockpit side already points at a docs page, that page must point back at
  // the same capability, or the round trip lands somewhere else.
  it('round-trips the deep-agents and runtimes links back to their capability', () => {
    const forward = Object.entries(COCKPIT_DOCS_LINKS).filter(([key]) =>
      key.startsWith('deep-agents/') || key.startsWith('runtimes/'),
    );
    expect(forward).toHaveLength(10);

    for (const [key, docsPath] of forward) {
      const [product, section, topic] = key.split('/');
      const [library, docsSection, slug] = docsPath.replace('/docs/', '').split('/');

      expect(resolveCockpitIdentity(library, docsSection, slug), key).toEqual(
        expect.objectContaining({ product, section, topic }),
      );
    }
  });

  it('reports deep-agents and runtimes as themselves, not unknown', () => {
    expect(
      buildCockpitHandoffProperties(
        { library: 'deep-agents', section: 'capabilities', slug: 'planning' },
        'Run',
      ),
    ).toEqual({
      library: 'deep-agents',
      source_section: 'capabilities',
      source_slug: 'planning',
      destination_product: 'deep-agents',
      destination_capability: 'planning',
      requested_mode: 'run',
      mapped: true,
    });

    expect(
      buildCockpitHandoffProperties(
        { library: 'runtimes', section: 'mastra', slug: 'quickstart' },
        'Code',
      ).library,
    ).toBe('runtimes');
  });

  // Every page of a runtime's docs section shares that runtime's one demo, so
  // a reader on the quickstart gets the same handoff as one on the overview.
  it('sends every page of a runtime section to that runtime demo', () => {
    for (const slug of ['overview', 'quickstart', 'how-it-connects']) {
      expect(
        buildCockpitModeHref(
          { library: 'runtimes', section: 'aws-strands', slug },
          'Run',
          'https://cockpit.example',
        ),
      ).toBe(
        'https://cockpit.example/runtimes/core-capabilities/aws-strands/overview/python?mode=run',
      );
    }
  });

  it('sends a deep-agents capability page to its capability demo', () => {
    expect(
      buildCockpitModeHref(
        { library: 'deep-agents', section: 'capabilities', slug: 'skills' },
        'Code',
        'https://cockpit.example',
      ),
    ).toBe(
      'https://cockpit.example/deep-agents/core-capabilities/skills/overview/python?mode=code',
    );
  });
});
