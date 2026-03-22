import React from 'react';
import type {
  CockpitManifestEntry,
} from '../../../../../libs/cockpit-registry/src/index';
import type { NavigationProduct } from '../../lib/route-resolution';
import { LanguagePicker } from './language-picker';
import { NavigationGroups } from './navigation-groups';

interface CockpitSidebarProps {
  navigationTree: NavigationProduct[];
  manifest: CockpitManifestEntry[];
  entry: CockpitManifestEntry;
}

export function CockpitSidebar({
  navigationTree,
  manifest,
  entry,
}: CockpitSidebarProps) {
  return (
    <aside aria-label="Cockpit sidebar" className="cockpit-sidebar">
      <header className="cockpit-sidebar__header">
        <p className="cockpit-eyebrow">Cockpit</p>
        <h1>Explore the example surface</h1>
        <p>Switch language or jump between grouped capabilities.</p>
      </header>
      <LanguagePicker manifest={manifest} entry={entry} />
      <NavigationGroups tree={navigationTree} currentEntry={entry} />
      <p>Run mode stays ready while you browse.</p>
    </aside>
  );
}
