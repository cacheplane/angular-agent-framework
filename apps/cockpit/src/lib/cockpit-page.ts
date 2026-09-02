import {
  cockpitManifest,
  getWorkspaceDestinationPath,
  resolveLegacyPath,
  toWorkspaceIdentity,
  type CockpitProduct,
  type CockpitSection,
  type CockpitPageId,
  type CockpitLanguage,
  type WorkspaceMode,
  type WorkspaceResolution,
} from '@threadplane/cockpit-registry';
import {
  buildNavigationTree,
  getWorkspacePresentation,
  resolveCockpitEntry,
  toCockpitPath,
  type NavigationProduct,
  type WorkspacePresentation,
} from '@threadplane/cockpit-shell';

export { cockpitManifest };

export interface CockpitPageModel {
  entry: ReturnType<typeof resolveCockpitEntry>;
  resolution: WorkspaceResolution;
  presentation: WorkspacePresentation;
  navigationTree: NavigationProduct[];
  canonicalPath: string;
}

const DEFAULT_COCKPIT_SLUG = [
  'langgraph',
  'core-capabilities',
  'streaming',
  'overview',
  'python',
] as const;

const QUERY_MODES: Record<string, WorkspaceMode> = {
  docs: 'Docs',
  run: 'Run',
  code: 'Code',
  api: 'API',
};

export interface UnifiedWorkspaceRedirectEnvironment {
  readonly UNIFIED_WORKSPACE_REDIRECTS_ENABLED?: string;
  readonly NEXT_PUBLIC_WEBSITE_ORIGIN?: string;
  readonly NODE_ENV?: string;
}

export function getUnifiedWorkspaceRedirectOrigin(
  environment: UnifiedWorkspaceRedirectEnvironment = process.env
): string | null {
  if (environment.UNIFIED_WORKSPACE_REDIRECTS_ENABLED !== 'true') return null;
  const rawOrigin = environment.NEXT_PUBLIC_WEBSITE_ORIGIN;
  if (!rawOrigin) return null;

  try {
    const url = new URL(rawOrigin);
    if (
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    const secure = url.protocol === 'https:';
    const developmentLocalhost =
      environment.NODE_ENV === 'development' &&
      url.protocol === 'http:' &&
      url.hostname === 'localhost';
    return secure || developmentLocalhost ? url.origin : null;
  } catch {
    return null;
  }
}

const appendAvailableMode = (
  destinationPath: string,
  mode: string | string[] | undefined,
  availableModes: readonly WorkspaceMode[]
): string => {
  if (typeof mode !== 'string') return destinationPath;
  const parsed = QUERY_MODES[mode.toLowerCase()];
  if (!parsed || !availableModes.includes(parsed)) return destinationPath;
  return `${destinationPath}?mode=${parsed.toLowerCase()}`;
};

const toWebsiteRedirect = (
  origin: string,
  resolution: WorkspaceResolution,
  mode: string | string[] | undefined
): string | null => {
  if (resolution.kind !== 'mapped') return null;
  const destinationPath = getWorkspaceDestinationPath(resolution.identity);
  return new URL(
    appendAvailableMode(
      destinationPath,
      mode,
      resolution.identity.availableModes
    ),
    `${origin}/`
  ).toString();
};

export function getLegacyWebsiteRedirect(
  legacyPath: string,
  mode: string | string[] | undefined,
  environment: UnifiedWorkspaceRedirectEnvironment = process.env
): string | null {
  const origin = getUnifiedWorkspaceRedirectOrigin(environment);
  if (!origin) return null;
  const resolution = resolveLegacyPath(legacyPath);
  return resolution ? toWebsiteRedirect(origin, resolution, mode) : null;
}

export function getRootWebsiteRedirect(
  mode: string | string[] | undefined,
  environment: UnifiedWorkspaceRedirectEnvironment = process.env
): string | null {
  const origin = getUnifiedWorkspaceRedirectOrigin(environment);
  if (!origin) return null;
  return toWebsiteRedirect(origin, getCockpitPageModel().resolution, mode);
}

export function normalizeRequestedMode(
  mode: string | string[] | undefined
): string | null {
  return Array.isArray(mode) ? mode.join(',') : mode ?? null;
}

export function getCanonicalCockpitRedirect(
  model: CockpitPageModel,
  mode: string | string[] | undefined
): string {
  if (typeof mode !== 'string') return model.canonicalPath;
  const parsed = QUERY_MODES[mode.toLowerCase()];
  if (
    !parsed ||
    model.resolution.kind !== 'mapped' ||
    !model.resolution.identity.availableModes.includes(parsed)
  ) {
    return model.canonicalPath;
  }
  return `${model.canonicalPath}?mode=${parsed.toLowerCase()}`;
}

export function getCockpitPageModel(slug: string[] = []): CockpitPageModel {
  const resolvedEntry = resolveCockpitEntry({
    manifest: cockpitManifest,
    product: (slug[0] ?? DEFAULT_COCKPIT_SLUG[0]) as CockpitProduct,
    section: (slug[1] ?? DEFAULT_COCKPIT_SLUG[1]) as CockpitSection,
    topic: slug[2] ?? DEFAULT_COCKPIT_SLUG[2],
    page: (slug[3] ?? DEFAULT_COCKPIT_SLUG[3]) as CockpitPageId,
    language: (slug[4] ?? DEFAULT_COCKPIT_SLUG[4]) as CockpitLanguage,
  });
  const resolution: WorkspaceResolution = {
    kind: 'mapped',
    identity: toWorkspaceIdentity(resolvedEntry),
  };

  return {
    entry: resolvedEntry,
    resolution,
    presentation: getWorkspacePresentation(resolution),
    navigationTree: buildNavigationTree(cockpitManifest),
    canonicalPath: toCockpitPath(resolvedEntry),
  };
}
