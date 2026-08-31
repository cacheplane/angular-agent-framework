import { cockpitManifest } from '@threadplane/cockpit-registry';
import { describe, expect, it } from 'vitest';
import {
  buildCockpitModeHref,
  docsCockpitMappings,
  resolveCockpitIdentity,
} from './cockpit-links';

describe('Docs-to-Cockpit links', () => {
  it('contains the exhaustive first-iteration mapping set', () => {
    expect(docsCockpitMappings).toEqual({
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
});
