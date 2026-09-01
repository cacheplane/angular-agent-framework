import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildNavigationTree } from '../../lib/route-resolution';
import { cockpitManifest } from '@threadplane/cockpit-registry';
import { CockpitSidebar } from './cockpit-sidebar';

describe('CockpitSidebar', () => {
  it('renders grouped navigation with the current entry highlighted', () => {
    const entry = cockpitManifest.find(
      (candidate) =>
        candidate.product === 'langgraph' &&
        candidate.section === 'core-capabilities' &&
        candidate.topic === 'streaming' &&
        candidate.language === 'python'
    )!;

    const html = renderToStaticMarkup(
      <CockpitSidebar
        entry={entry}
        navigationTree={buildNavigationTree(cockpitManifest)}
      />
    );

    expect(html).toContain('Deep Agents');
    expect(html).toContain('LangGraph');
    // Title is stripped of product prefix: "LangGraph Streaming" → "Streaming"
    expect(html).toContain('Streaming');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Scope');
    expect(html).toContain('Capability');
    expect(html).not.toContain('Environment');
    expect(html).not.toContain('Actions');
    expect(html).not.toContain('aria-label="Open runtime"');
    expect(html).not.toContain('Theme');
  });
});
