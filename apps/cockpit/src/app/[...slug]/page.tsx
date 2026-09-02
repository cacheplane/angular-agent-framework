import React from 'react';
import { redirect } from 'next/navigation';
import { CockpitShell } from '../../components/cockpit-shell';
import { getContentBundle } from '@threadplane/cockpit-shell';
import {
  cockpitManifest,
  getCanonicalCockpitRedirect,
  getCockpitPageModel,
  getLegacyWebsiteRedirect,
  normalizeRequestedMode,
  type UnifiedWorkspaceRedirectEnvironment,
} from '../../lib/cockpit-page';

export async function generateStaticParams() {
  return cockpitManifest.map((entry) => ({
    slug: [
      entry.product,
      entry.section,
      entry.topic,
      entry.page,
      entry.language,
    ],
  }));
}

export function getCockpitRouteRedirect(
  slug: string[],
  mode: string | string[] | undefined
): string | null {
  const model = getCockpitPageModel(slug);
  const requestedPath = `/${slug.join('/')}`;
  return slug.length > 0 && requestedPath !== model.canonicalPath
    ? getCanonicalCockpitRedirect(model, mode)
    : null;
}

export function getLegacyRouteRedirect(
  slug: string[],
  mode: string | string[] | undefined,
  environment: UnifiedWorkspaceRedirectEnvironment = process.env
): string | null {
  if (slug.length === 0) return null;
  return getLegacyWebsiteRedirect(`/${slug.join('/')}`, mode, environment);
}

export default async function CockpitRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const { slug = [] } = await params;
  const { mode } = await searchParams;
  const legacyRedirectDestination = getLegacyRouteRedirect(slug, mode);
  if (legacyRedirectDestination) {
    redirect(legacyRedirectDestination);
  }
  const model = getCockpitPageModel(slug);
  const { resolution, presentation, navigationTree, canonicalPath } = model;
  const redirectDestination = getCockpitRouteRedirect(slug, mode);
  if (redirectDestination) {
    redirect(redirectDestination);
  }

  const contentBundle = await getContentBundle(presentation);

  return (
    <CockpitShell
      key={canonicalPath}
      navigationTree={navigationTree}
      resolution={resolution}
      presentation={presentation}
      contentBundle={contentBundle}
      routePath={canonicalPath}
      requestedMode={normalizeRequestedMode(mode)}
    />
  );
}
