import React from 'react';
import { CockpitShell } from '../components/cockpit-shell';
import { getContentBundle } from '../lib/content-bundle';
import { getCockpitPageModel } from '../lib/cockpit-page';

export default async function CockpitHomePage() {
  const { entry, presentation, navigationTree } = getCockpitPageModel();
  const contentBundle = await getContentBundle(presentation);

  return (
    <CockpitShell
      navigationTree={navigationTree}
      presentation={presentation}
      entryTitle={entry.title}
      contentBundle={contentBundle}
    />
  );
}
