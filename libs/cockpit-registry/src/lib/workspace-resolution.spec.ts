import { describe, expect, it } from 'vitest';
import { cockpitManifest } from './manifest';
import {
  PRIMARY_CAPABILITY_BY_DOCS_PATH,
  getWorkspaceDestinationPath,
  getRouteDefaultMode,
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

  it('uses an explicit primary capability for duplicate Docs paths, not manifest order', () => {
    const docsPath = '/docs/render/guides/specs';
    const reversedManifest = [...cockpitManifest].reverse();

    expect(PRIMARY_CAPABILITY_BY_DOCS_PATH[docsPath]).toBe(
      'render:core-capabilities:spec-rendering:overview:python'
    );
    expect(
      resolveDocsWorkspace(docsPath, 'Specs', reversedManifest)
    ).toMatchObject({
      kind: 'mapped',
      identity: {
        id: 'render:core-capabilities:spec-rendering:overview:python',
      },
    });
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
