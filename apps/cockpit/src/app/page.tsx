import React from 'react';
import { cockpitManifest } from '../../../../libs/cockpit-registry/src/index';
import { CodePane } from '../components/code-pane/code-pane';
import { DocsPane } from '../components/docs-pane/docs-pane';
import { LanguageSwitcher } from '../components/language-switcher';
import { NavigationTree } from '../components/navigation/navigation-tree';
import { PromptPane } from '../components/prompt-pane/prompt-pane';
import {
  buildNavigationTree,
  getCapabilityPresentation,
  resolveCockpitEntry,
} from '../lib/route-resolution';

export default function CockpitHomePage() {
  const entry = resolveCockpitEntry({
    manifest: cockpitManifest,
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'streaming',
    page: 'overview',
    language: 'python',
  });
  const presentation = getCapabilityPresentation(entry);
  const navigationTree = buildNavigationTree(cockpitManifest);

  return (
    <main>
      <h1>Cockpit</h1>
      <p>Manifest-driven shell for representative cockpit capabilities.</p>
      <NavigationTree tree={navigationTree} />
      <LanguageSwitcher manifest={cockpitManifest} entry={entry} />
      <DocsPane path={presentation.docsPath} />
      {presentation.kind === 'capability' ? (
        <>
          <CodePane paths={presentation.codeAssetPaths} />
          <PromptPane paths={presentation.promptAssetPaths} />
        </>
      ) : null}
    </main>
  );
}
