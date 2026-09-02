/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('redirect() should not be called for a canonical slug');
  }),
}));

vi.mock('@threadplane/cockpit-shell', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@threadplane/cockpit-shell')>();
  return {
    ...actual,
    getContentBundle: vi.fn().mockResolvedValue({
      codeFiles: {},
      promptFiles: {},
      runtimeUrl: null,
      docSections: [],
      narrativeDocs: [],
    }),
  };
});

import CockpitRoutePage, {
  getCockpitRouteRedirect,
  getLegacyRouteRedirect,
} from './page';
import { getCockpitPageModel } from '../../lib/cockpit-page';

const enabledEnv = {
  UNIFIED_WORKSPACE_REDIRECTS_ENABLED: 'true',
  NEXT_PUBLIC_WEBSITE_ORIGIN: 'https://threadplane.ai',
  NODE_ENV: 'production',
};

const renderRoute = (slug: string[]) =>
  CockpitRoutePage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({}),
  });

describe('CockpitRoutePage', () => {
  it('keys the rendered CockpitShell on the canonical path', async () => {
    const slug = [
      'langgraph',
      'core-capabilities',
      'streaming',
      'overview',
      'python',
    ];
    const { canonicalPath } = getCockpitPageModel(slug);

    const element = await renderRoute(slug);

    expect(element.key).toBe(canonicalPath);
  });

  it('gives two different capabilities two different keys', async () => {
    const streamingSlug = [
      'langgraph',
      'core-capabilities',
      'streaming',
      'overview',
      'python',
    ];
    const persistenceSlug = [
      'langgraph',
      'core-capabilities',
      'persistence',
      'overview',
      'python',
    ];

    const streamingElement = await renderRoute(streamingSlug);
    const persistenceElement = await renderRoute(persistenceSlug);

    expect(streamingElement.key).not.toBe(persistenceElement.key);
    expect(streamingElement.key).toBe(
      getCockpitPageModel(streamingSlug).canonicalPath
    );
    expect(persistenceElement.key).toBe(
      getCockpitPageModel(persistenceSlug).canonicalPath
    );
  });
});

describe('canonical Cockpit route redirects', () => {
  it('preserves a valid mode query that is available on the canonical entry', () => {
    expect(
      getCockpitRouteRedirect(
        [
          'langgraph',
          'core-capabilities',
          'streaming',
          'overview',
          'python',
          'extra',
        ],
        'code'
      )
    ).toBe('/langgraph/core-capabilities/streaming/overview/python?mode=code');
  });

  it('keeps the external adapter disabled by default', () => {
    expect(
      getLegacyRouteRedirect(
        ['langgraph', 'core-capabilities', 'streaming', 'overview', 'python'],
        'run',
        {}
      )
    ).toBeNull();
  });

  it('redirects only exact registry legacy routes when enabled', () => {
    expect(
      getLegacyRouteRedirect(
        ['deep-agents', 'core-capabilities', 'planning', 'overview', 'python'],
        'api',
        enabledEnv
      )
    ).toBe(
      'https://threadplane.ai/docs/deep-agents/capabilities/planning?mode=api'
    );
    expect(
      getLegacyRouteRedirect(
        ['deep-agents', 'core-capabilities', 'planning'],
        'run',
        enabledEnv
      )
    ).toBeNull();
  });
});
