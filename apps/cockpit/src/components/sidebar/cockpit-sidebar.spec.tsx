import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildNavigationTree } from '../../lib/route-resolution';
import { cockpitManifest } from '../../../../../libs/cockpit-registry/src/index';
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
        manifest={cockpitManifest}
      />
    );

    expect(html).toContain('Deep Agents');
    expect(html).toContain('LangGraph');
    expect(html).toContain(entry.title);
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('<select');
    expect(html).toContain('Python');
  });
});
