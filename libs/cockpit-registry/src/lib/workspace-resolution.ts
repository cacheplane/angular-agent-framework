import { cockpitManifest } from './manifest';
import type {
  CockpitManifestEntry,
  WorkspaceIdentity,
  WorkspaceMode,
  WorkspaceResolution,
} from './manifest.types';

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
  if (!identity.docsPath) {
    throw new Error(`Manifest entry without a docs path: ${identity.id}`);
  }
  return identity.docsPath;
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
  if (matches.length === 1) return mapped(matches[0]);
  if (matches.length > 1) {
    throw new Error(
      `Docs path ${docsPath} is published by ${matches.length} manifest entries`
    );
  }

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

const LEGACY_REQUEST_MODES: Readonly<Record<string, WorkspaceMode>> = {
  docs: 'Docs',
  run: 'Run',
  code: 'Code',
  api: 'API',
};

export const resolveLegacyRequestMode = (
  rawMode: string | string[] | undefined,
  resolution: WorkspaceResolution
): WorkspaceMode => {
  const fallback = getRouteDefaultMode(resolution, 'workspace');
  if (typeof rawMode !== 'string' || resolution.kind !== 'mapped') {
    return fallback;
  }

  const requested = LEGACY_REQUEST_MODES[rawMode.toLowerCase()];
  return requested && resolution.identity.availableModes.includes(requested)
    ? requested
    : fallback;
};

export const getCanonicalWebsiteWorkspaceHref = (
  resolution: WorkspaceResolution,
  mode: WorkspaceMode
): string => {
  const destinationPath =
    resolution.kind === 'mapped'
      ? getWorkspaceDestinationPath(resolution.identity)
      : resolution.docsPath;
  const canonicalDocsRoute =
    destinationPath === '/docs' || destinationPath.startsWith('/docs/');

  return mode === 'Docs' && canonicalDocsRoute
    ? destinationPath
    : `${destinationPath}?mode=${mode.toLowerCase()}`;
};
