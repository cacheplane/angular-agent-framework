// SPDX-License-Identifier: MIT
/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NavigationGroups } from './navigation-groups';
import { buildNavigationTree } from '@threadplane/cockpit-shell';
import { cockpitManifest } from '@threadplane/cockpit-registry';
import type { WorkspaceHostServices } from '../../workspace-contracts';

const createHostServices = (): WorkspaceHostServices => ({
  resolveEntryHref: (entry) =>
    `/workspace/${entry.product}/${entry.topic}/${entry.language}`,
  navigate: vi.fn(),
});

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
        candidate.language === 'python'
    )!;

    const trackNavigation = vi.fn();
    const hostServices = createHostServices();
    act(() => {
      root!.render(
        <NavigationGroups
          tree={buildNavigationTree(cockpitManifest)}
          currentEntry={currentEntry}
          trackNavigation={trackNavigation}
          hostServices={hostServices}
        />
      );
    });

    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[data-capability-link]')
    );
    expect(links.length).toBeGreaterThan(0);

    // Find a link with a different capability (not the current one).
    const otherLink = links.find(
      (l) => l.getAttribute('aria-current') !== 'page'
    );
    expect(otherLink).toBeDefined();

    act(() => {
      otherLink!.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });

    expect(trackNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: expect.any(String),
        category: expect.any(String),
        fromCapability: 'streaming',
      })
    );
    expect(otherLink?.getAttribute('href')).toMatch(/^\/workspace\//);
    expect(hostServices.navigate).toHaveBeenCalledWith({
      path: otherLink?.getAttribute('href'),
      restoreFocus: 'workspace-panel',
    });
  });

  it('leaves modified clicks to the progressive-enhancement anchor', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const currentEntry = cockpitManifest.find(
      (candidate) =>
        candidate.topic === 'streaming' && candidate.language === 'python'
    )!;
    const hostServices = createHostServices();

    act(() => {
      root!.render(
        <NavigationGroups
          tree={buildNavigationTree(cockpitManifest)}
          currentEntry={currentEntry}
          hostServices={hostServices}
        />
      );
    });

    const link = container.querySelector<HTMLAnchorElement>(
      'a[data-capability-link]:not([aria-current="page"])'
    );
    expect(link).toBeTruthy();
    expect(
      link?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        })
      )
    ).toBe(true);
    expect(hostServices.navigate).not.toHaveBeenCalled();
  });

  it('uses sentence-case headings and modern chevrons', () => {
    const currentEntry = cockpitManifest.find(
      (candidate) =>
        candidate.topic === 'streaming' && candidate.language === 'python'
    )!;
    const html = renderToStaticMarkup(
      <NavigationGroups
        tree={buildNavigationTree(cockpitManifest)}
        currentEntry={currentEntry}
        hostServices={createHostServices()}
      />
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
      (candidate) =>
        candidate.topic === 'streaming' && candidate.language === 'python'
    )!;

    act(() => {
      root!.render(
        <NavigationGroups
          tree={buildNavigationTree(cockpitManifest)}
          currentEntry={currentEntry}
          hostServices={createHostServices()}
        />
      );
    });

    const landmarks = container.querySelectorAll('nav');
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]?.getAttribute('aria-label')).toBe('Cockpit navigation');
    const disclosure = container.querySelector<HTMLButtonElement>(
      'button[aria-expanded]'
    );
    const controlledId = disclosure?.getAttribute('aria-controls');
    expect(controlledId).toBeTruthy();
    expect(container.querySelector(`#${controlledId}`)).toBeTruthy();
  });
});
