import React from 'react';
import { ThemeToggle } from '@ngaf/ui-react';
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
      className="flex flex-col gap-4 py-6 px-0 border-r border-[var(--ds-border-strong)] bg-[var(--ds-surface-tinted)] overflow-y-auto"
      style={{
        position: 'sticky',
        top: 0,
        minHeight: '100vh',
      }}
    >
      <header className="flex items-center justify-between px-4">
        <p className="text-[var(--ds-text-muted)] font-mono text-xs font-medium tracking-wide uppercase">Cockpit</p>
        <LanguagePicker manifest={manifest} entry={entry} />
      </header>
      <NavigationGroups tree={navigationTree} currentEntry={entry} />
      <div className="mt-auto border-t border-[var(--ds-border)] px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-[var(--ds-text-muted)]">Theme</span>
        <ThemeToggle className="rounded-md p-1.5 text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-tinted)] hover:text-[var(--ds-text-primary)] transition-colors" />
      </div>
    </aside>
  );
}
