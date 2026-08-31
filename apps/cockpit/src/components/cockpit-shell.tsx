'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cockpitManifest } from '@threadplane/cockpit-registry';
import { Menu } from 'lucide-react';
import {
  parseControlPlaneMode,
  useControlPlanePreferences,
  type ControlPlaneMode,
} from '@threadplane/ui-react';
import type { ContentBundle } from '../lib/content-bundle';
import type { CapabilityPresentation, NavigationProduct } from '../lib/route-resolution';
import { PRODUCT_LABELS } from '../lib/navigation-labels';
import { CodeMode } from './code-mode/code-mode';
import { ApiMode } from './api-mode/api-mode';
import { NarrativeDocs } from './narrative-docs/narrative-docs';
import { RunMode } from './run-mode/run-mode';
import { MobileNavOverlay } from './mobile-nav-overlay';
import { CockpitControlPlane } from './control-plane/cockpit-control-plane';


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

export function CockpitShell({
  navigationTree,
  presentation,
  entryTitle,
  contentBundle,
}: CockpitShellProps) {
  const preferences = useControlPlanePreferences('cockpit');
  const queryHandled = useRef(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isCapability = presentation.kind === 'capability';
  const codeAssetPaths = isCapability ? presentation.codeAssetPaths : [];
  const backendAssetPaths = isCapability ? (presentation.backendAssetPaths ?? []) : [];
  const entry = presentation.entry;
  const contextLabel = `${PRODUCT_LABELS[entry.product] ?? toLabel(entry.product)} / ${toLabel(entry.section)} / ${toLabel(entry.topic)}`;

  useEffect(() => {
    if (!preferences.hydrated || queryHandled.current) return;
    queryHandled.current = true;
    const url = new URL(window.location.href);
    const rawMode = url.searchParams.get('mode');
    const requestedMode = parseControlPlaneMode(rawMode);
    if (requestedMode) preferences.setActiveMode(requestedMode);
    if (rawMode !== null) {
      url.searchParams.delete('mode');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [preferences]);

  const activeMode: ControlPlaneMode = preferences.activeMode;

  return (
    <main
      aria-label="Cockpit shell"
      className="cockpit-shell h-screen overflow-hidden"
      data-hydrated={preferences.hydrated ? 'true' : 'false'}
    >
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block min-h-0 overflow-hidden">
        <CockpitControlPlane
          navigationTree={navigationTree}
          manifest={cockpitManifest}
          entry={entry}
          activeMode={activeMode}
          onModeChange={preferences.setActiveMode}
          runtimeUrl={contentBundle.runtimeUrl}
        />
      </div>

      {/* Mobile full-screen nav overlay */}
      <MobileNavOverlay
        navigationTree={navigationTree}
        manifest={cockpitManifest}
        entry={entry}
        activeMode={activeMode}
        onModeChange={preferences.setActiveMode}
        runtimeUrl={contentBundle.runtimeUrl}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        triggerRef={mobileTriggerRef}
      />

      <section className="grid grid-rows-[auto_1fr] grid-cols-[minmax(0,1fr)] overflow-hidden bg-[var(--ds-surface)]">
        <header
          className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--ds-border)]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              ref={mobileTriggerRef}
              className="md:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={isSidebarOpen}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-text-secondary)' }}
            >
              <Menu size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            <p className="hidden md:block text-[var(--ds-text-muted)] font-mono text-xs truncate">{contextLabel}</p>
          </div>
        </header>

        <div className="min-h-0 relative">
          {/* RunMode stays mounted to preserve iframe state across tab switches */}
          <div className={`h-full ${activeMode === 'Run' ? '' : 'invisible absolute inset-0'}`}>
            <RunMode
              entryTitle={entryTitle}
              runtimeUrl={contentBundle.runtimeUrl}
              capabilitySlug={entry.topic}
            />
          </div>
          {activeMode === 'Code' ? (
            <CodeMode
              entryTitle={entryTitle}
              codeAssetPaths={codeAssetPaths}
              backendAssetPaths={backendAssetPaths}
              codeFiles={contentBundle.codeFiles}
              promptFiles={contentBundle.promptFiles}
              capability={entry.topic}
            />
          ) : null}
          {activeMode === 'Docs' ? (
            <NarrativeDocs narrativeDocs={contentBundle.narrativeDocs} capability={entry.topic} />
          ) : null}
          {activeMode === 'API' ? (
            <ApiMode docSections={contentBundle.docSections} />
          ) : null}
        </div>
      </section>
    </main>
  );
}
