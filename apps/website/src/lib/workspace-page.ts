import {
  cockpitManifest,
  getWorkspaceDestinationPath,
  resolveDocsWorkspace,
  resolveWorkspacePath,
  type CockpitManifestEntry,
  type WorkspaceResolution,
} from '@threadplane/cockpit-registry';
import {
  buildNavigationTree,
  getContentBundle,
  getWorkspacePresentation,
  type ContentBundle,
  type NavigationProduct,
  type WorkspacePresentation,
} from '@threadplane/cockpit-shell';

export interface WebsiteWorkspacePageModel {
  readonly resolution: WorkspaceResolution;
  readonly presentation: WorkspacePresentation;
  readonly contentBundle: ContentBundle;
  readonly navigationTree: NavigationProduct[];
}

export async function getWebsiteWorkspacePage(options: {
  docsPath: string;
  title: string;
}): Promise<WebsiteWorkspacePageModel> {
  const resolution = resolveDocsWorkspace(options.docsPath, options.title);
  const presentation = getWorkspacePresentation(resolution);

  return {
    resolution,
    presentation,
    contentBundle: await getContentBundle(presentation),
    navigationTree: buildNavigationTree(cockpitManifest),
  };
}

export async function getWebsiteWorkspaceRoutePage(
  workspacePath: string
): Promise<WebsiteWorkspacePageModel | null> {
  const resolution = resolveWorkspacePath(workspacePath);
  if (!resolution) return null;
  const presentation = getWorkspacePresentation(resolution);

  return {
    resolution,
    presentation,
    contentBundle: await getContentBundle(presentation),
    navigationTree: buildNavigationTree(cockpitManifest),
  };
}

export function getWebsiteWorkspaceHref(entry: CockpitManifestEntry): string {
  return getWorkspaceDestinationPath(entry);
}
