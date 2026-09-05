import {
  cockpitManifest,
  getWorkspaceDestinationPath,
  type WorkspaceMode,
} from '@threadplane/cockpit-registry';
import { describe, expect, it } from 'vitest';
import {
  getCockpitWebsiteOrigin,
  getLegacyWebsiteRedirect,
  getRootWebsiteRedirect,
} from './cockpit-page';

const productionEnvironment = {
  COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai',
  NODE_ENV: 'production',
} as const;

const expectedHref = (
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

describe('Cockpit Website origin validation', () => {
  it('accepts only the canonical Website HTTPS origin in production', () => {
    expect(getCockpitWebsiteOrigin(productionEnvironment)).toBe(
      'https://threadplane.ai'
    );
    expect(
      getCockpitWebsiteOrigin({
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai/',
        NODE_ENV: 'production',
      })
    ).toBe('https://threadplane.ai');
  });

  it('accepts explicit HTTP localhost only in development', () => {
    expect(
      getCockpitWebsiteOrigin({
        COCKPIT_WEBSITE_ORIGIN: 'http://localhost/',
        NODE_ENV: 'development',
      })
    ).toBe('http://localhost');
    expect(
      getCockpitWebsiteOrigin({
        COCKPIT_WEBSITE_ORIGIN: 'http://localhost:4200/',
        NODE_ENV: 'development',
      })
    ).toBe('http://localhost:4200');
  });

  it.each([
    [{ NODE_ENV: 'production' }, 'missing'],
    [
      { COCKPIT_WEBSITE_ORIGIN: 'not a URL', NODE_ENV: 'production' },
      'invalid',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://preview.threadplane.ai',
        NODE_ENV: 'production',
      },
      'production preview origin',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai:8443',
        NODE_ENV: 'production',
      },
      'production non-default port',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://preview.threadplane.ai',
        NODE_ENV: 'development',
      },
      'development preview HTTPS origin',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://user:secret@threadplane.ai',
        NODE_ENV: 'production',
      },
      'credentials',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai/docs',
        NODE_ENV: 'production',
      },
      'non-root path',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai?next=/docs',
        NODE_ENV: 'production',
      },
      'query',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai#fragment',
        NODE_ENV: 'production',
      },
      'fragment',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai?',
        NODE_ENV: 'production',
      },
      'empty query delimiter',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai#',
        NODE_ENV: 'production',
      },
      'empty fragment delimiter',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: ' https://threadplane.ai',
        NODE_ENV: 'production',
      },
      'leading whitespace',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai\n',
        NODE_ENV: 'production',
      },
      'trailing whitespace',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai/%2e',
        NODE_ENV: 'production',
      },
      'encoded dot path',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai/a/..',
        NODE_ENV: 'production',
      },
      'normalized dot path',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'HTTPS://THREADPLANE.AI',
        NODE_ENV: 'production',
      },
      'case-normalized origin',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'https://threadplane.ai:443',
        NODE_ENV: 'production',
      },
      'normalized default port',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'http://threadplane.ai',
        NODE_ENV: 'production',
      },
      'production HTTP',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'http://127.0.0.1:4200',
        NODE_ENV: 'development',
      },
      'non-localhost development HTTP',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'http://localhost.evil.test:4200',
        NODE_ENV: 'development',
      },
      'lookalike localhost',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'javascript:alert(1)',
        NODE_ENV: 'development',
      },
      'unsafe protocol',
    ],
    [
      {
        COCKPIT_WEBSITE_ORIGIN: 'file:///tmp/threadplane',
        NODE_ENV: 'development',
      },
      'file protocol',
    ],
  ] as const)('rejects %s origin configuration', (environment) => {
    expect(() => getCockpitWebsiteOrigin(environment)).toThrow(
      /COCKPIT_WEBSITE_ORIGIN/
    );
  });
});

describe('registry-derived legacy Website redirects', () => {
  it('maps every exact manifest path using its old Cockpit default mode', () => {
    for (const entry of cockpitManifest) {
      const defaultMode = entry.availableModes.includes('Run') ? 'Run' : 'Docs';
      expect(
        getLegacyWebsiteRedirect(entry.legacyPath, [], productionEnvironment),
        entry.id
      ).toBe(expectedHref(entry, defaultMode));
    }
  });

  it('honors every single available mode case-insensitively', () => {
    for (const entry of cockpitManifest) {
      for (const mode of entry.availableModes) {
        expect(
          getLegacyWebsiteRedirect(
            entry.legacyPath,
            [mode.toUpperCase()],
            productionEnvironment
          ),
          `${entry.id} ${mode}`
        ).toBe(expectedHref(entry, mode));
      }
    }
  });

  it('uses the old default for invalid, duplicate, or unavailable modes', () => {
    const runnable = cockpitManifest.find((entry) =>
      entry.availableModes.includes('Run')
    );
    const docsOnly = cockpitManifest.find(
      (entry) => !entry.availableModes.includes('Run')
    );
    if (!runnable || !docsOnly) throw new Error('Expected manifest fixtures');

    expect(
      getLegacyWebsiteRedirect(
        runnable.legacyPath,
        ['preview'],
        productionEnvironment
      )
    ).toBe(expectedHref(runnable, 'Run'));
    expect(
      getLegacyWebsiteRedirect(
        runnable.legacyPath,
        ['docs', 'code'],
        productionEnvironment
      )
    ).toBe(expectedHref(runnable, 'Run'));
    expect(
      getLegacyWebsiteRedirect(
        docsOnly.legacyPath,
        ['run'],
        productionEnvironment
      )
    ).toBe(expectedHref(docsOnly, 'Docs'));
  });

  it('serializes Docs mode truthfully for docs destinations', () => {
    const docsDestination = cockpitManifest.find((entry) =>
      getWorkspaceDestinationPath(entry).startsWith('/docs/')
    );
    if (!docsDestination) {
      throw new Error('Expected a docs fixture');
    }

    expect(
      getLegacyWebsiteRedirect(
        docsDestination.legacyPath,
        ['docs'],
        productionEnvironment
      )
    ).toBe(expectedHref(docsDestination, 'Docs'));
  });

  it('returns null for unknown, partial, extra, malformed, and trailing paths', () => {
    const exact = cockpitManifest[0].legacyPath;
    const partial = exact.split('/').slice(0, -1).join('/');

    for (const pathname of [
      '/not-a-capability',
      partial,
      `${exact}/extra`,
      `${exact}/`,
      exact.replace('/', '//'),
      exact.replace('/overview/', '/%2Foverview/'),
    ]) {
      expect(
        getLegacyWebsiteRedirect(pathname, [], productionEnvironment),
        pathname
      ).toBeNull();
    }
  });

  it('redirects root to the representative streaming Run surface', () => {
    expect(getRootWebsiteRedirect(productionEnvironment)).toBe(
      'https://threadplane.ai/docs/langgraph/guides/streaming?mode=run'
    );
  });
});
