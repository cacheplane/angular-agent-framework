import type { Metadata } from 'next';
import {
  cockpitManifest,
  getWorkspaceDestinationPath,
  resolveWorkspacePath,
  type WorkspaceResolution,
} from '@threadplane/cockpit-registry';
import { notFound } from 'next/navigation';
import { WebsiteWorkspace } from '../../../../components/workspace/WebsiteWorkspace';
import { createPageMetadata } from '../../../../lib/site-metadata';
import { getWebsiteWorkspaceRoutePage } from '../../../../lib/workspace-page';

interface WorkspaceRouteProps {
  readonly params: Promise<{ product: string; topic: string }>;
}

function resolveWorkspaceOnlyRoute(
  routePath: string
): WorkspaceResolution | null {
  const resolution = resolveWorkspacePath(routePath);
  if (
    !resolution ||
    resolution.kind !== 'mapped' ||
    getWorkspaceDestinationPath(resolution.identity) !== routePath ||
    resolution.identity.availableModes.length === 0
  ) {
    return null;
  }
  return resolution;
}

export function generateStaticParams() {
  const params = new Map<string, { product: string; topic: string }>();

  for (const entry of cockpitManifest) {
    if (
      getWorkspaceDestinationPath(entry) !== entry.workspacePath ||
      entry.availableModes.length === 0
    ) {
      continue;
    }
    const segments = entry.workspacePath.split('/').filter(Boolean);
    const [prefix, product, topic, ...remainder] = segments;
    if (prefix !== 'workspace' || !product || !topic || remainder.length > 0) {
      continue;
    }
    params.set(entry.workspacePath, { product, topic });
  }

  return [...params.values()];
}

export async function generateMetadata({
  params,
}: WorkspaceRouteProps): Promise<Metadata> {
  const { product, topic } = await params;
  const routePath = `/workspace/${product}/${topic}`;
  const resolution = resolveWorkspaceOnlyRoute(routePath);
  if (!resolution || resolution.kind !== 'mapped') notFound();

  const { identity } = resolution;
  return createPageMetadata({
    title: `${identity.title} — Threadplane Workspace`,
    description: `Explore ${
      identity.title
    } in the Threadplane workspace across its available ${identity.availableModes.join(
      ', '
    )} views.`,
    pathname: identity.workspacePath,
    type: 'website',
  });
}

export default async function WorkspacePage({ params }: WorkspaceRouteProps) {
  const { product, topic } = await params;
  const routePath = `/workspace/${product}/${topic}`;
  if (!resolveWorkspaceOnlyRoute(routePath)) notFound();
  const workspacePage = await getWebsiteWorkspaceRoutePage(routePath);
  if (!workspacePage) notFound();

  return (
    <WebsiteWorkspace
      resolution={workspacePage.resolution}
      presentation={workspacePage.presentation}
      contentBundle={workspacePage.contentBundle}
      navigationTree={workspacePage.navigationTree}
      routePath={routePath}
      routeKind="workspace"
    />
  );
}
