'use client';

import React, { useMemo, useState } from 'react';
import { cockpitManifest } from '../../../../libs/cockpit-registry/src/index';
import type { CapabilityPresentation, NavigationProduct } from '../lib/route-resolution';
import { CodeMode } from './code-mode/code-mode';
import { DocsMode } from './docs-mode/docs-mode';
import { ModeSwitcher } from './modes/mode-switcher';
import { PromptDrawer } from './prompt-drawer/prompt-drawer';
import { RunMode } from './run-mode/run-mode';
import { CockpitSidebar } from './sidebar/cockpit-sidebar';

const PRIMARY_MODES = ['Run', 'Code', 'Docs'] as const;
type PrimaryMode = (typeof PRIMARY_MODES)[number];

const DEFAULT_FRONTEND_ASSET_PATHS = [
  'apps/cockpit/src/app/page.tsx',
  'apps/cockpit/src/components/cockpit-shell.tsx',
] as const;

interface CockpitShellProps {
  navigationTree: NavigationProduct[];
  presentation: CapabilityPresentation;
  entryTitle: string;
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
}: CockpitShellProps) {
  const [activeMode, setActiveMode] = useState<PrimaryMode>('Run');
  const [isPromptDrawerOpen, setIsPromptDrawerOpen] = useState(false);
  const isCapability = presentation.kind === 'capability';
  const codeAssetPaths = useMemo(
    () =>
      isCapability
        ? Array.from(new Set([...DEFAULT_FRONTEND_ASSET_PATHS, ...presentation.codeAssetPaths]))
        : [...DEFAULT_FRONTEND_ASSET_PATHS],
    [isCapability, presentation]
  );
  const promptAssetPaths = isCapability ? presentation.promptAssetPaths : [];
  const entry = presentation.entry;
  const contextLabel = `${toLabel(entry.product)} / ${toLabel(entry.section)} / ${entry.topic}`;
  const docsSections = [
    {
      title: 'Start from the runnable surface',
      body: `Run ${entryTitle} first, then switch to Code to inspect the frontend shell and capability module paths that power it.`,
      code: codeAssetPaths[0] ?? presentation.docsPath,
    },
    {
      title: 'Keep prompts close',
      body:
        promptAssetPaths.length > 0
          ? 'Use the prompt drawer when you want the prompt path without losing the current workspace mode.'
          : 'Prompt assets are not available for this entry, so the guide stays focused on the runnable surface and implementation files.',
      code: promptAssetPaths[0],
    },
  ].filter((section) => Boolean(section.code || section.body));

  return (
    <main aria-label="Cockpit shell" className="cockpit-shell">
      <CockpitSidebar
        navigationTree={navigationTree}
        manifest={cockpitManifest}
        entry={entry}
      />

      <section className="cockpit-shell__workspace">
        <header className="cockpit-shell__header">
          <div>
            <p className="cockpit-eyebrow">{contextLabel}</p>
            <h2>{entryTitle}</h2>
            <p>
              Start in Run, then move into the implementation files or guided docs as
              needed.
            </p>
          </div>

          <div className="cockpit-shell__actions">
            <button type="button" onClick={() => setIsPromptDrawerOpen(true)}>
              Open prompt assets
            </button>
            {isCapability ? <button type="button">Run example</button> : null}
          </div>
        </header>

        <ModeSwitcher
          modes={PRIMARY_MODES}
          activeMode={activeMode}
          onChange={setActiveMode}
        />

        <div className="cockpit-shell__mode-surface">
          {activeMode === 'Run' ? (
            <RunMode
              entryTitle={entryTitle}
              codeAssetPaths={codeAssetPaths}
              docsPath={presentation.docsPath}
            />
          ) : null}
          {activeMode === 'Code' ? (
            <CodeMode entryTitle={entryTitle} codeAssetPaths={codeAssetPaths} />
          ) : null}
          {activeMode === 'Docs' ? (
            <DocsMode
              entryTitle={entryTitle}
              docsPath={presentation.docsPath}
              summary={`Follow the live example, inspect the relevant implementation files, and keep prompt assets within reach for ${entryTitle}.`}
              sections={docsSections}
              promptCopy="Open prompt assets"
            />
          ) : null}
        </div>
      </section>

      <PromptDrawer
        isOpen={isPromptDrawerOpen}
        entryTitle={entryTitle}
        paths={promptAssetPaths}
        onClose={() => setIsPromptDrawerOpen(false)}
      />
    </main>
  );
}
