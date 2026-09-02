import {
  cockpitManifest,
  getWorkspaceDestinationPath,
  type WorkspaceMode,
} from '@threadplane/cockpit-registry';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from './route';

const originalOrigin = process.env.COCKPIT_WEBSITE_ORIGIN;
const originalNodeEnvironment = process.env.NODE_ENV;

const request = (path: string, headers?: HeadersInit) =>
  new NextRequest(`https://cockpit.threadplane.ai${path}`, { headers });

const expectedLocation = (
  entry: (typeof cockpitManifest)[number],
  mode: WorkspaceMode
): string => {
  const path = getWorkspaceDestinationPath(entry);
  const query =
    mode === 'Docs' && path.startsWith('/docs')
      ? ''
      : `?mode=${mode.toLowerCase()}`;
  return `https://threadplane.ai${path}${query}`;
};

describe('legacy Cockpit redirect route', () => {
  beforeEach(() => {
    process.env.COCKPIT_WEBSITE_ORIGIN = 'https://threadplane.ai';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    if (originalOrigin === undefined) {
      delete process.env.COCKPIT_WEBSITE_ORIGIN;
    } else {
      process.env.COCKPIT_WEBSITE_ORIGIN = originalOrigin;
    }
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  });

  it.each([
    '/',
    '/?mode=docs',
    '/?mode=run',
    '/?mode=code',
    '/?mode=api',
    '/?mode=invalid',
    '/?mode=docs&mode=run',
    '/?return_to=https%3A%2F%2Fattacker.test&utm_source=old-bookmark',
  ])('always redirects root to representative Streaming Run for %s', (path) => {
    const response = GET(request(path));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://threadplane.ai/docs/langgraph/guides/streaming?mode=run'
    );
  });

  it('redirects every exact manifest path permanently', () => {
    for (const entry of cockpitManifest) {
      const response = GET(request(`${entry.legacyPath}?ignored=1`));
      const defaultMode = entry.availableModes.includes('Run') ? 'Run' : 'Docs';

      expect(response.status, entry.id).toBe(308);
      expect(response.headers.get('location'), entry.id).toBe(
        expectedLocation(entry, defaultMode)
      );
      expect(response.headers.get('location'), entry.id).not.toContain(
        'ignored'
      );
    }
  });

  it('honors every available mode for every manifest path', () => {
    for (const entry of cockpitManifest) {
      for (const mode of entry.availableModes) {
        const response = GET(
          request(`${entry.legacyPath}?mode=${mode.toUpperCase()}`)
        );

        expect(response.status, `${entry.id} ${mode}`).toBe(308);
        expect(response.headers.get('location'), `${entry.id} ${mode}`).toBe(
          expectedLocation(entry, mode)
        );
      }
    }
  });

  it('reads only mode and strips every unrelated query parameter', () => {
    const streaming = cockpitManifest.find(
      (entry) =>
        entry.id === 'langgraph:core-capabilities:streaming:overview:python'
    );
    if (!streaming) throw new Error('Expected streaming fixture');

    const response = GET(
      request(
        `${streaming.legacyPath}?return_to=https://attacker.test&mode=code&utm_source=x`
      )
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://threadplane.ai/docs/langgraph/guides/streaming?mode=code'
    );
  });

  it('treats duplicate mode values as invalid and uses the old default', () => {
    const streaming = cockpitManifest.find(
      (entry) =>
        entry.id === 'langgraph:core-capabilities:streaming:overview:python'
    );
    if (!streaming) throw new Error('Expected streaming fixture');

    const response = GET(
      request(`${streaming.legacyPath}?mode=docs&mode=code`)
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://threadplane.ai/docs/langgraph/guides/streaming?mode=run'
    );
  });

  it('falls back to Docs when a mode is unavailable on a docs-only entry', () => {
    const docsOnly = cockpitManifest.find(
      (entry) => !entry.availableModes.includes('Run')
    );
    if (!docsOnly) throw new Error('Expected docs-only fixture');

    const response = GET(request(`${docsOnly.legacyPath}?mode=run`));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      expectedLocation(docsOnly, 'Docs')
    );
  });

  it.each([
    '/unknown',
    '/langgraph/core-capabilities/streaming',
    '/langgraph/core-capabilities/streaming/overview/python/extra',
    '/langgraph/core-capabilities/streaming/overview/python/',
    '//langgraph/core-capabilities/streaming/overview/python',
    '/langgraph/core-capabilities/streaming/%2Foverview/python',
  ])('returns a real 404 for %s', (pathname) => {
    const response = GET(request(pathname));

    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });

  it('ignores hostile request authorities and forwarding metadata', () => {
    const streaming = cockpitManifest.find(
      (entry) =>
        entry.id === 'langgraph:core-capabilities:streaming:overview:python'
    );
    if (!streaming) throw new Error('Expected streaming fixture');

    const response = GET(
      request(streaming.legacyPath, {
        host: 'attacker.example',
        forwarded: 'host=attacker.example;proto=http',
        'x-forwarded-host': 'attacker.example',
        'x-forwarded-proto': 'http',
        referer: 'https://attacker.example/redirect',
      })
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://threadplane.ai/docs/langgraph/guides/streaming?mode=run'
    );
  });

  it.each([
    'https://attacker@threadplane.ai',
    'https://threadplane.ai?',
    'https://threadplane.ai#',
    'https://threadplane.ai/%2e',
    'https://threadplane.ai/a/..',
  ])('fails closed when the server-only destination origin is %s', (origin) => {
    process.env.COCKPIT_WEBSITE_ORIGIN = origin;

    expect(() => GET(request('/'))).toThrow(/COCKPIT_WEBSITE_ORIGIN/);
  });
});
