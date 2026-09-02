import { describe, expect, it } from 'vitest';
import {
  getCanonicalCockpitRedirect,
  getCockpitPageModel,
  getLegacyWebsiteRedirect,
  getRootWebsiteRedirect,
  getUnifiedWorkspaceRedirectOrigin,
  normalizeRequestedMode,
} from './cockpit-page';
import { cockpitManifest } from '@threadplane/cockpit-registry';
import { getWorkspaceDestinationPath } from '@threadplane/cockpit-registry';

const enabledProductionEnv = {
  UNIFIED_WORKSPACE_REDIRECTS_ENABLED: 'true',
  NEXT_PUBLIC_WEBSITE_ORIGIN: 'https://threadplane.ai',
  NODE_ENV: 'production',
};

describe('Cockpit page query normalization', () => {
  it('keeps repeated mode params explicitly invalid for provider normalization', () => {
    expect(normalizeRequestedMode(['code', 'docs'])).toBe('code,docs');
    expect(normalizeRequestedMode('code')).toBe('code');
    expect(normalizeRequestedMode(undefined)).toBeNull();
  });

  it('preserves only a syntactically valid mode available on the canonical entry', () => {
    const model = getCockpitPageModel([
      'langgraph',
      'core-capabilities',
      'streaming',
      'overview',
      'python',
    ]);
    expect(getCanonicalCockpitRedirect(model, 'code')).toBe(
      `${model.canonicalPath}?mode=code`
    );
    expect(getCanonicalCockpitRedirect(model, 'preview')).toBe(
      model.canonicalPath
    );
    expect(getCanonicalCockpitRedirect(model, ['code', 'docs'])).toBe(
      model.canonicalPath
    );

    const docsOnly = getCockpitPageModel([
      'langgraph',
      'getting-started',
      'overview',
      'overview',
      'python',
    ]);
    expect(getCanonicalCockpitRedirect(docsOnly, 'run')).toBe(
      docsOnly.canonicalPath
    );
  });
});

describe('unified Website redirect gate', () => {
  it('is disabled unless the explicit flag and a valid origin are both present', () => {
    expect(
      getUnifiedWorkspaceRedirectOrigin({
        NEXT_PUBLIC_WEBSITE_ORIGIN: 'https://threadplane.ai',
        NODE_ENV: 'production',
      })
    ).toBeNull();
    expect(
      getUnifiedWorkspaceRedirectOrigin({
        ...enabledProductionEnv,
        NEXT_PUBLIC_WEBSITE_ORIGIN: 'http://threadplane.ai',
      })
    ).toBeNull();
    expect(
      getUnifiedWorkspaceRedirectOrigin({
        ...enabledProductionEnv,
        NEXT_PUBLIC_WEBSITE_ORIGIN: 'https://threadplane.ai/docs',
      })
    ).toBeNull();
    expect(getUnifiedWorkspaceRedirectOrigin(enabledProductionEnv)).toBe(
      'https://threadplane.ai'
    );
  });

  it('allows HTTP localhost only in development', () => {
    const localhost = {
      UNIFIED_WORKSPACE_REDIRECTS_ENABLED: 'true',
      NEXT_PUBLIC_WEBSITE_ORIGIN: 'http://localhost:3000',
    };
    expect(
      getUnifiedWorkspaceRedirectOrigin({
        ...localhost,
        NODE_ENV: 'development',
      })
    ).toBe('http://localhost:3000');
    expect(
      getUnifiedWorkspaceRedirectOrigin({
        ...localhost,
        NODE_ENV: 'production',
      })
    ).toBeNull();
  });
});

describe('registry-derived legacy Website redirects', () => {
  it('maps every legacy path to its registry-owned Website destination', () => {
    for (const entry of cockpitManifest) {
      expect(
        getLegacyWebsiteRedirect(
          entry.legacyPath,
          undefined,
          enabledProductionEnv
        )
      ).toBe(
        `https://threadplane.ai${getWorkspaceDestinationPath(entry)}`
      );
    }
  });

  it('preserves only a single valid mode available at the destination', () => {
    const streaming = cockpitManifest.find(
      (entry) =>
        entry.id === 'langgraph:core-capabilities:streaming:overview:python'
    );
    const overview = cockpitManifest.find(
      (entry) =>
        entry.id === 'langgraph:getting-started:overview:overview:python'
    );
    if (!streaming || !overview) throw new Error('Expected fixture entries');

    expect(
      getLegacyWebsiteRedirect(
        streaming.legacyPath,
        'code',
        enabledProductionEnv
      )
    ).toBe('https://threadplane.ai/docs/langgraph/guides/streaming?mode=code');
    expect(
      getLegacyWebsiteRedirect(
        streaming.legacyPath,
        ['code', 'run'],
        enabledProductionEnv
      )
    ).toBe('https://threadplane.ai/docs/langgraph/guides/streaming');
    expect(
      getLegacyWebsiteRedirect(overview.legacyPath, 'run', enabledProductionEnv)
    ).toBe(
      'https://threadplane.ai/docs/langgraph/getting-started/introduction'
    );
    expect(
      getLegacyWebsiteRedirect(
        streaming.legacyPath,
        'preview',
        enabledProductionEnv
      )
    ).toBe('https://threadplane.ai/docs/langgraph/guides/streaming');
  });

  it('preserves secondary capability identity and its available modes', () => {
    const jsonRender = cockpitManifest.find(
      (entry) =>
        entry.id === 'ag-ui:core-capabilities:json-render:overview:python'
    );
    if (!jsonRender) throw new Error('Expected AG-UI JSON Render fixture');

    expect(jsonRender.availableModes).toContain('Run');
    expect(
      getLegacyWebsiteRedirect(
        jsonRender.legacyPath,
        'run',
        enabledProductionEnv
      )
    ).toBe('https://threadplane.ai/workspace/ag-ui/json-render?mode=run');
    expect(
      getLegacyWebsiteRedirect(
        jsonRender.legacyPath,
        'docs',
        enabledProductionEnv
      )
    ).toBe('https://threadplane.ai/workspace/ag-ui/json-render?mode=docs');
  });

  it('does not redirect invalid or unmapped legacy paths', () => {
    expect(
      getLegacyWebsiteRedirect(
        '/langgraph/core-capabilities/not-real/overview/python',
        'run',
        enabledProductionEnv
      )
    ).toBeNull();
  });

  it('redirects the Cockpit root through its default registry identity', () => {
    expect(getRootWebsiteRedirect('run', enabledProductionEnv)).toBe(
      'https://threadplane.ai/docs/langgraph/guides/streaming?mode=run'
    );
  });
});
