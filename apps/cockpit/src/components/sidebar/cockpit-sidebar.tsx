import React from 'react';
import type {
  CockpitManifestEntry,
} from '@ngaf/cockpit-registry';
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
    <aside
      aria-label="Cockpit sidebar"
      className="grid gap-4 py-6 px-0 border-r border-[var(--ds-glass-border)] bg-[var(--ds-glass-bg)] backdrop-blur-[var(--ds-glass-blur)] content-start overflow-y-auto"
      style={{ position: 'sticky', top: 0, minHeight: '100vh' }}
    >
      <header className="flex items-center justify-between px-4">
        <p className="text-[var(--ds-text-muted)] font-mono text-xs font-medium tracking-wide uppercase">Cockpit</p>
        <LanguagePicker manifest={manifest} entry={entry} />
      </header>
      <NavigationGroups tree={navigationTree} currentEntry={entry} />
    </aside>
  );
}
