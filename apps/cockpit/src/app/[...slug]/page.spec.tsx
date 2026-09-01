/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('redirect() should not be called for a canonical slug');
  }),
}));

vi.mock('../../lib/content-bundle', () => ({
  getContentBundle: vi.fn().mockResolvedValue({
    codeFiles: {},
    promptFiles: {},
    runtimeUrl: null,
    docSections: [],
    narrativeDocs: [],
  }),
}));

import CockpitRoutePage from './page';
import { getCockpitPageModel } from '../../lib/cockpit-page';

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

    const element = await CockpitRoutePage({
      params: Promise.resolve({ slug }),
    });

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

    const streamingElement = await CockpitRoutePage({
      params: Promise.resolve({ slug: streamingSlug }),
    });
    const persistenceElement = await CockpitRoutePage({
      params: Promise.resolve({ slug: persistenceSlug }),
    });

    expect(streamingElement.key).not.toBe(persistenceElement.key);
    expect(streamingElement.key).toBe(
      getCockpitPageModel(streamingSlug).canonicalPath
    );
    expect(persistenceElement.key).toBe(
      getCockpitPageModel(persistenceSlug).canonicalPath
    );
  });
});
