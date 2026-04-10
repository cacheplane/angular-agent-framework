'use client';

import React, { useEffect, useState } from 'react';
import { cockpitManifest } from '@cacheplane/cockpit-registry';
import type { ContentBundle } from '../lib/content-bundle';
import type { CapabilityPresentation, NavigationProduct } from '../lib/route-resolution';
import { CodeMode } from './code-mode/code-mode';
import { ApiMode } from './api-mode/api-mode';
import { NarrativeDocs } from './narrative-docs/narrative-docs';
import { ModeSwitcher } from './modes/mode-switcher';
import { RunMode } from './run-mode/run-mode';
import { CockpitSidebar } from './sidebar/cockpit-sidebar';
import { MobileNavOverlay } from './mobile-nav-overlay';

const PRIMARY_MODES = ['Run', 'Code', 'Docs', 'API'] as const;
type PrimaryMode = (typeof PRIMARY_MODES)[number];

interface CockpitShellProps {
  navigationTree: NavigationProduct[];
  presentation: CapabilityPresentation;
  entryTitle: string;
  contentBundle: ContentBundle;
}

const toLabel = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

function MenuIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

export function CockpitShell({
  navigationTree,
  presentation,
  entryTitle,
  contentBundle,
}: CockpitShellProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeMode, setActiveMode] = useState<PrimaryMode>('Run');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isCapability = presentation.kind === 'capability';
  const codeAssetPaths = isCapability ? presentation.codeAssetPaths : [];
  const backendAssetPaths = isCapability ? (presentation.backendAssetPaths ?? []) : [];
  const entry = presentation.entry;
  const contextLabel = `${toLabel(entry.product)} / ${toLabel(entry.section)} / ${entry.topic}`;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <main
      aria-label="Cockpit shell"
      className="grid md:grid-cols-[16rem_minmax(0,1fr)] h-screen overflow-hidden"
      data-hydrated={isHydrated ? 'true' : 'false'}
    >
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block overflow-y-auto">
        <CockpitSidebar
          navigationTree={navigationTree}
          manifest={cockpitManifest}
          entry={entry}
        />
      </div>

      {/* Mobile full-screen nav overlay */}
      <MobileNavOverlay
        navigationTree={navigationTree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <section className="grid grid-rows-[auto_1fr] gap-2 p-4 overflow-hidden bg-[var(--ds-glass-bg)] backdrop-blur-[var(--ds-glass-blur)]">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={isSidebarOpen}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-text-secondary)' }}
            >
              <MenuIcon />
            </button>
            <p className="hidden md:block text-[var(--ds-text-muted)] font-mono text-xs">{contextLabel}</p>
            <span className="hidden md:block text-[var(--ds-accent-border)]">|</span>
            <h2 className="text-sm font-medium text-[var(--ds-text-primary)]">{entryTitle}</h2>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <ModeSwitcher
              modes={PRIMARY_MODES}
              activeMode={activeMode}
              onChange={setActiveMode}
            />
          </div>
        </header>

        <div className="min-h-0">
          {activeMode === 'Run' ? (
            <RunMode
              entryTitle={entryTitle}
              runtimeUrl={contentBundle.runtimeUrl}
            />
          ) : null}
          {activeMode === 'Code' ? (
            <CodeMode
              entryTitle={entryTitle}
              codeAssetPaths={codeAssetPaths}
              backendAssetPaths={backendAssetPaths}
              codeFiles={contentBundle.codeFiles}
              promptFiles={contentBundle.promptFiles}
            />
          ) : null}
          {activeMode === 'Docs' ? (
            <NarrativeDocs narrativeDocs={contentBundle.narrativeDocs} />
          ) : null}
          {activeMode === 'API' ? (
            <ApiMode docSections={contentBundle.docSections} />
          ) : null}
        </div>
      </section>
    </main>
  );
}
