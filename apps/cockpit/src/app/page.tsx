import React from 'react';
import { redirect } from 'next/navigation';
import { CockpitShell } from '../components/cockpit-shell';
import { getContentBundle } from '@threadplane/cockpit-shell';
import {
  getCockpitPageModel,
  getRootWebsiteRedirect,
  normalizeRequestedMode,
} from '../lib/cockpit-page';

export default async function CockpitHomePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const { mode } = await searchParams;
  const websiteRedirect = getRootWebsiteRedirect(mode);
  if (websiteRedirect) {
    redirect(websiteRedirect);
  }
  const { resolution, presentation, navigationTree } = getCockpitPageModel();
  const contentBundle = await getContentBundle(presentation);

  return (
    <CockpitShell
      navigationTree={navigationTree}
      resolution={resolution}
      presentation={presentation}
      contentBundle={contentBundle}
      routePath="/"
      requestedMode={normalizeRequestedMode(mode)}
    />
  );
}
