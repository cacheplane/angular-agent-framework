import { describe, expect, it } from 'vitest';
import {
  cockpitManifest,
  getWorkspaceDestinationPath,
} from '@threadplane/cockpit-registry';
import WorkspacePage, { generateMetadata, generateStaticParams } from './page';

const route = (product: string, topic: string) =>
  WorkspacePage({ params: Promise.resolve({ product, topic }) });

describe('workspace-only Website routes', () => {
  it('statically exposes only usable identity-preserving workspace routes', () => {
    const params = generateStaticParams();
    const expected = new Set(
      cockpitManifest
        .filter(
          (entry) =>
            getWorkspaceDestinationPath(entry) === entry.workspacePath &&
            entry.availableModes.length > 0
        )
        .map((entry) => `${entry.product}/${entry.topic}`)
    );

    expect(
      new Set(params.map(({ product, topic }) => `${product}/${topic}`))
    ).toEqual(expected);
    expect(params).toHaveLength(expected.size);
    expect(expected).not.toContain('deep-agents/planning');
    expect(expected).not.toContain('deep-agents/overview');
    expect(expected).not.toContain('langgraph/streaming');
    expect(expected).toContain('langgraph/durable-execution');
  });

  it('rejects Docs-backed aliases and workspace identities with no usable mode', async () => {
    await expect(route('langgraph', 'streaming')).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
    await expect(route('deep-agents', 'planning')).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
    await expect(route('deep-agents', 'overview')).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
  });

  it('publishes a workspace route when a shared Docs path would lose identity', async () => {
    const page = await route('langgraph', 'durable-execution');

    expect(page.props).toMatchObject({
      routePath: '/workspace/langgraph/durable-execution',
      routeKind: 'workspace',
      resolution: {
        kind: 'mapped',
        identity: {
          id: 'langgraph:core-capabilities:durable-execution:overview:python',
        },
      },
    });
  });

  it('does not publish workspace metadata for a Docs-backed capability', async () => {
    await expect(
      generateMetadata({
        params: Promise.resolve({ product: 'deep-agents', topic: 'planning' }),
      })
    ).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
  });

  it('uses Next not-found for an invalid workspace path', async () => {
    await expect(
      route('deep-agents', 'not-a-capability')
    ).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
  });
});
