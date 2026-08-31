// SPDX-License-Identifier: MIT
/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../../lib/analytics/client', () => ({ track: vi.fn() }));

import { track } from '../../lib/analytics/client';
import { NavigationGroups } from './navigation-groups';
import { buildNavigationTree } from '../../lib/route-resolution';
import { cockpitManifest } from '@threadplane/cockpit-registry';

describe('NavigationGroups capability link instrumentation', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    vi.clearAllMocks();
  });

  it('fires cockpit:recipe_opened on capability link click', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    const currentEntry = cockpitManifest.find(
      (candidate) =>
        candidate.product === 'langgraph' &&
        candidate.section === 'core-capabilities' &&
        candidate.topic === 'streaming' &&
        candidate.language === 'python',
    )!;

    act(() => {
      root!.render(
        <NavigationGroups
          tree={buildNavigationTree(cockpitManifest)}
          currentEntry={currentEntry}
        />,
      );
    });

    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[data-capability-link]'),
    );
    expect(links.length).toBeGreaterThan(0);

    // Find a link with a different capability (not the current one).
    const otherLink = links.find((l) => l.getAttribute('aria-current') !== 'page');
    expect(otherLink).toBeDefined();

    act(() => {
      otherLink!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(track).toHaveBeenCalledWith(
      'cockpit:recipe_opened',
      expect.objectContaining({
        capability: expect.any(String),
        category: expect.any(String),
        from_capability: 'streaming',
      }),
    );
  });

  it('uses sentence-case headings and modern chevrons', () => {
    const currentEntry = cockpitManifest.find(
      (candidate) => candidate.topic === 'streaming' && candidate.language === 'python',
    )!;
    const html = renderToStaticMarkup(
      <NavigationGroups
        tree={buildNavigationTree(cockpitManifest)}
        currentEntry={currentEntry}
      />,
    );

    expect(html).toContain('cockpit-nav-group-label');
    expect(html).toContain('lucide-chevron-right');
    expect(html).not.toContain('text-transform:uppercase');
  });

  it('uses one labeled navigation landmark and connected disclosures', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const currentEntry = cockpitManifest.find(
      (candidate) => candidate.topic === 'streaming' && candidate.language === 'python',
    )!;

    act(() => {
      root!.render(
        <NavigationGroups
          tree={buildNavigationTree(cockpitManifest)}
          currentEntry={currentEntry}
        />,
      );
    });

    const landmarks = container.querySelectorAll('nav');
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]?.getAttribute('aria-label')).toBe('Cockpit navigation');
    const disclosure = container.querySelector<HTMLButtonElement>('button[aria-expanded]');
    const controlledId = disclosure?.getAttribute('aria-controls');
    expect(controlledId).toBeTruthy();
    expect(container.querySelector(`#${controlledId}`)).toBeTruthy();
  });
});
