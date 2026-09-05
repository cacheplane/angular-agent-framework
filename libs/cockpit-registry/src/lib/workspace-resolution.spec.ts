import { describe, expect, it } from 'vitest';
import { cockpitManifest } from './manifest';
import {
  getCanonicalWebsiteWorkspaceHref,
  getWorkspaceDestinationPath,
  getRouteDefaultMode,
  resolveLegacyRequestMode,
  resolveDocsWorkspace,
  resolveLegacyPath,
  resolveWorkspacePath,
} from './workspace-resolution';

describe('workspace identity resolution', () => {
  it('assigns a unique stable ID to every manifest entry', () => {
    const ids = cockpitManifest.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of cockpitManifest) {
      expect(entry.id).toBe(
        `${entry.product}:${entry.section}:${entry.topic}:${entry.page}:${entry.language}`
      );
    }
  });

  it('round-trips canonical workspace and legacy paths', () => {
    for (const entry of cockpitManifest) {
      expect(resolveWorkspacePath(entry.workspacePath)).toMatchObject({
        kind: 'mapped',
        identity: { id: entry.id },
      });
      expect(resolveLegacyPath(entry.legacyPath)).toMatchObject({
        kind: 'mapped',
        identity: { id: entry.id },
      });
    }
  });

  it('round-trips every canonical Website destination to the same stable identity', () => {
    for (const entry of cockpitManifest) {
      const destination = getWorkspaceDestinationPath(entry);
      const resolution = destination.startsWith('/docs/')
        ? resolveDocsWorkspace(destination, entry.title)
        : resolveWorkspacePath(destination);

      expect(resolution).toMatchObject({
        kind: 'mapped',
        identity: { id: entry.id },
      });
    }
  });

  it('round-trips unique canonical Docs paths', () => {
    const publishedEntries = cockpitManifest.filter(
      (entry) => entry.docsPath.length > 0
    );
    const counts = new Map<string, number>();
    for (const entry of publishedEntries) {
      counts.set(entry.docsPath, (counts.get(entry.docsPath) ?? 0) + 1);
    }

    for (const entry of publishedEntries.filter(
      (candidate) => counts.get(candidate.docsPath) === 1
    )) {
      expect(resolveDocsWorkspace(entry.docsPath, entry.title)).toMatchObject({
        kind: 'mapped',
        identity: { id: entry.id, docsPath: entry.docsPath },
      });
    }
  });

  it('gives every manifest entry a unique docs path so no override table is needed', () => {
    const seen = new Map<string, string>();
    for (const entry of cockpitManifest) {
      expect(entry.docsPath, entry.id).not.toBe('');
      const previous = seen.get(entry.docsPath);
      expect(
        previous,
        `${entry.id} shares ${entry.docsPath} with ${previous}`
      ).toBeUndefined();
      seen.set(entry.docsPath, entry.id);
    }
    expect(
      resolveDocsWorkspace(
        '/docs/langgraph/guides/durable-execution',
        'Durable Execution'
      )
    ).toMatchObject({
      kind: 'mapped',
      identity: {
        id: 'langgraph:core-capabilities:durable-execution:overview:python',
      },
    });
    expect(
      getWorkspaceDestinationPath({
        id: 'langgraph:core-capabilities:durable-execution:overview:python',
        docsPath: '/docs/langgraph/guides/durable-execution',
        workspacePath: '/workspace/langgraph/durable-execution',
      })
    ).toBe('/docs/langgraph/guides/durable-execution');
  });

  it('returns a discriminated docs-only resolution for an unmapped valid Docs page', () => {
    expect(
      resolveDocsWorkspace(
        '/docs/langgraph/api/inject-agent',
        'Inject an agent into Angular'
      )
    ).toEqual({
      kind: 'docs-only',
      docsPath: '/docs/langgraph/api/inject-agent',
      title: 'Inject an agent into Angular',
      unavailableReason: 'no-workspace-capability',
    });
  });

  it('uses Docs for Docs and docs-only routes and Run only for runnable workspace routes', () => {
    const mappedDocs = resolveDocsWorkspace(
      '/docs/langgraph/guides/streaming',
      'Streaming'
    );
    const runnableWorkspace = resolveWorkspacePath(
      '/workspace/langgraph/streaming'
    );
    const narrativeOnlyWorkspace = resolveWorkspacePath(
      '/workspace/langgraph/overview'
    );
    const docsOnly = resolveDocsWorkspace(
      '/docs/langgraph/api/inject-agent',
      'Inject an agent into Angular'
    );

    expect(getRouteDefaultMode(mappedDocs, 'docs')).toBe('Docs');
    expect(getRouteDefaultMode(docsOnly, 'docs')).toBe('Docs');
    expect(getRouteDefaultMode(runnableWorkspace, 'workspace')).toBe('Run');
    expect(getRouteDefaultMode(narrativeOnlyWorkspace, 'workspace')).toBe(
      'Docs'
    );
  });

  it('never fuzzy-matches Docs slugs', () => {
    expect(
      resolveDocsWorkspace('/docs/langgraph/guides/stream', 'Stream')
    ).toMatchObject({ kind: 'docs-only' });
  });
});

describe('canonical Website workspace destinations', () => {
  it('applies the legacy Cockpit default to absent, duplicate, invalid, and unavailable modes for every manifest entry', () => {
    for (const entry of cockpitManifest) {
      const resolution = resolveLegacyPath(entry.legacyPath);
      expect(resolution).not.toBeNull();
      if (!resolution) continue;

      const expectedDefault = getRouteDefaultMode(resolution, 'workspace');
      const unavailableMode = (['Run', 'Code', 'API', 'Docs'] as const).find(
        (mode) => !entry.availableModes.includes(mode)
      );

      expect(resolveLegacyRequestMode(undefined, resolution)).toBe(
        expectedDefault
      );
      expect(resolveLegacyRequestMode(['run', 'code'], resolution)).toBe(
        expectedDefault
      );
      expect(resolveLegacyRequestMode('invalid', resolution)).toBe(
        expectedDefault
      );
      if (unavailableMode) {
        expect(
          resolveLegacyRequestMode(unavailableMode.toLowerCase(), resolution)
        ).toBe(expectedDefault);
      }
    }
  });

  it('resolves valid legacy modes case-insensitively and defaults runnable and narrative-only requests correctly', () => {
    const runnable = resolveLegacyPath(
      '/langgraph/core-capabilities/streaming/overview/python'
    );
    const narrativeOnly = resolveLegacyPath(
      '/langgraph/getting-started/overview/overview/python'
    );
    expect(runnable).not.toBeNull();
    expect(narrativeOnly).not.toBeNull();
    if (!runnable || !narrativeOnly) return;

    expect(resolveLegacyRequestMode('CoDe', runnable)).toBe('Code');
    expect(resolveLegacyRequestMode(undefined, runnable)).toBe('Run');
    expect(resolveLegacyRequestMode('run', narrativeOnly)).toBe('Docs');
    expect(resolveLegacyRequestMode(['docs'], narrativeOnly)).toBe('Docs');
  });

  it('serializes every manifest entry and mode to its canonical relative Website href', () => {
    for (const entry of cockpitManifest) {
      const resolution = resolveLegacyPath(entry.legacyPath);
      expect(resolution).not.toBeNull();
      if (!resolution) continue;

      const destinationPath = getWorkspaceDestinationPath(entry);
      for (const mode of ['Docs', 'Run', 'Code', 'API'] as const) {
        const expectedHref =
          mode === 'Docs' && destinationPath.startsWith('/docs/')
            ? destinationPath
            : `${destinationPath}?mode=${mode.toLowerCase()}`;
        expect(getCanonicalWebsiteWorkspaceHref(resolution, mode)).toBe(
          expectedHref
        );
      }
    }
  });

  it('omits Docs mode on every canonical Docs path', () => {
    const primary = resolveLegacyPath(
      '/langgraph/core-capabilities/persistence/overview/python'
    );
    const secondary = resolveLegacyPath(
      '/langgraph/core-capabilities/durable-execution/overview/python'
    );
    expect(primary).not.toBeNull();
    expect(secondary).not.toBeNull();
    if (!primary || !secondary) return;

    expect(getCanonicalWebsiteWorkspaceHref(primary, 'Docs')).toBe(
      '/docs/langgraph/guides/persistence'
    );
    expect(getCanonicalWebsiteWorkspaceHref(secondary, 'Docs')).toBe(
      '/docs/langgraph/guides/durable-execution'
    );
    expect(getCanonicalWebsiteWorkspaceHref(secondary, 'Run')).toBe(
      '/docs/langgraph/guides/durable-execution?mode=run'
    );
    expect(getCanonicalWebsiteWorkspaceHref(primary, 'Code')).toBe(
      '/docs/langgraph/guides/persistence?mode=code'
    );
  });

  it('serializes docs-only resolutions without accepting source query data', () => {
    const resolution = resolveDocsWorkspace(
      '/docs/langgraph/api/inject-agent',
      'Inject an agent into Angular'
    );

    expect(getCanonicalWebsiteWorkspaceHref(resolution, 'Docs')).toBe(
      '/docs/langgraph/api/inject-agent'
    );
    expect(getCanonicalWebsiteWorkspaceHref(resolution, 'Run')).toBe(
      '/docs/langgraph/api/inject-agent?mode=run'
    );
  });
});
