import { cockpitManifest } from './manifest';
import type {
  CockpitManifestEntry,
  WorkspaceIdentity,
  WorkspaceMode,
  WorkspaceResolution,
} from './manifest.types';

/**
 * Published Docs paths shared by more than one capability need an explicit
 * reverse mapping. This table is deliberately independent of manifest order.
 */
export const PRIMARY_CAPABILITY_BY_DOCS_PATH: Readonly<Record<string, string>> =
  {
    '/docs/langgraph/guides/persistence':
      'langgraph:core-capabilities:persistence:overview:python',
    '/docs/chat/guides/client-tools':
      'langgraph:core-capabilities:client-tools:overview:python',
    '/docs/chat/components/chat-tool-calls':
      'chat:core-capabilities:tool-calls:overview:python',
    '/docs/render/getting-started/introduction':
      'render:getting-started:overview:overview:python',
    '/docs/chat/components/chat-subagent-card':
      'chat:core-capabilities:subagents:overview:python',
    '/docs/render/guides/specs':
      'render:core-capabilities:spec-rendering:overview:python',
  };

export const toWorkspaceIdentity = (
  entry: CockpitManifestEntry
): WorkspaceIdentity => ({
  id: entry.id,
  product: entry.product,
  section: entry.section,
  topic: entry.topic,
  page: entry.page,
  language: entry.language,
  title: entry.title,
  docsPath: entry.docsPath || null,
  workspacePath: entry.workspacePath,
  legacyPath: entry.legacyPath,
  runtimeAdapter: entry.runtimeAdapter,
  availableModes: entry.availableModes,
});

export const getWorkspaceDestinationPath = (
  identity: Pick<WorkspaceIdentity, 'id' | 'docsPath' | 'workspacePath'>
): string => {
  if (!identity.docsPath) return identity.workspacePath;
  const primaryId = PRIMARY_CAPABILITY_BY_DOCS_PATH[identity.docsPath];
  return primaryId && primaryId !== identity.id
    ? identity.workspacePath
    : identity.docsPath;
};

const mapped = (entry: CockpitManifestEntry): WorkspaceResolution => ({
  kind: 'mapped',
  identity: toWorkspaceIdentity(entry),
});

export const resolveDocsWorkspace = (
  docsPath: string,
  title: string,
  manifest: readonly CockpitManifestEntry[] = cockpitManifest
): WorkspaceResolution => {
  const matches = manifest.filter((entry) => entry.docsPath === docsPath);
  const primaryId = PRIMARY_CAPABILITY_BY_DOCS_PATH[docsPath];
  const primary = primaryId
    ? matches.find((entry) => entry.id === primaryId)
    : matches.length === 1
    ? matches[0]
    : undefined;

  if (primary) return mapped(primary);

  return {
    kind: 'docs-only',
    docsPath,
    title,
    unavailableReason: 'no-workspace-capability',
  };
};

export const resolveWorkspacePath = (
  workspacePath: string,
  manifest: readonly CockpitManifestEntry[] = cockpitManifest
): WorkspaceResolution | null => {
  const entry = manifest.find(
    (candidate) => candidate.workspacePath === workspacePath
  );
  return entry ? mapped(entry) : null;
};

export const resolveLegacyPath = (
  legacyPath: string,
  manifest: readonly CockpitManifestEntry[] = cockpitManifest
): WorkspaceResolution | null => {
  const entry = manifest.find(
    (candidate) => candidate.legacyPath === legacyPath
  );
  return entry ? mapped(entry) : null;
};

export const getRouteDefaultMode = (
  resolution: WorkspaceResolution | null,
  routeKind: 'docs' | 'workspace'
): WorkspaceMode => {
  if (routeKind === 'docs' || !resolution || resolution.kind === 'docs-only') {
    return 'Docs';
  }

  return resolution.identity.availableModes.includes('Run') ? 'Run' : 'Docs';
};
