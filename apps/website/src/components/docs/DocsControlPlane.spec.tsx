// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsControlPlane, DocsContextContent } from './DocsControlPlane';
import { docsConfig } from '../../lib/docs-config';
import { declarationsFor } from '../../styles/style-contract';

const LIBRARY_TITLES = docsConfig
  .filter((l) => l.group === 'library')
  .map((l) => l.title);

const workspaceRoot = process.cwd().endsWith('/apps/website')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const docsCss = readFileSync(
  resolve(workspaceRoot, 'apps/website/src/styles/docs.css'),
  'utf8'
);

const { track } = vi.hoisted(() => ({
  track: vi.fn(),
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/docs/langgraph/guides/streaming',
  useRouter: () => ({ push }),
}));

vi.mock('../../lib/analytics/client', () => ({ track }));

beforeEach(() => {
  window.localStorage.clear();
  push.mockClear();
  track.mockClear();
});

describe('DocsControlPlane', () => {
  it('keeps context headings on the shared sentence-case sans contract', () => {
    for (const selector of [
      '[data-docs-control-plane-context] [data-control-plane-section-trigger]',
      '[data-docs-control-plane-context] [data-control-plane-section-heading]',
    ]) {
      const declarations = declarationsFor(docsCss, selector);
      expect(declarations).toMatch(/font-family:\s*var\(--font-inter\)/);
      expect(declarations).toMatch(/font-size:\s*12px/);
      expect(declarations).toMatch(/font-weight:\s*600/);
      expect(declarations).toMatch(/letter-spacing:\s*normal/);
      expect(declarations).toMatch(/color:\s*var\(--color-text-muted\)/);
      expect(declarations).toMatch(/text-transform:\s*none/);
    }
  });

  it('rotates the shared disclosure chevron as a complete icon', () => {
    const chevron = declarationsFor(
      docsCss,
      '[data-docs-control-plane-context] [data-control-plane-section-trigger] [data-control-plane-section-chevron]'
    );
    const expanded = declarationsFor(
      docsCss,
      '[data-docs-control-plane-context] [data-control-plane-section-trigger][aria-expanded="true"] [data-control-plane-section-chevron]'
    );

    expect(chevron).toMatch(/transition:[^;]*transform\s+150ms\s+ease/);
    expect(chevron).toMatch(/transform:\s*rotate\(0deg\)/);
    expect(expanded).toMatch(/transform:\s*rotate\(90deg\)/);
  });

  it('uses complete rounded sidebar states without a left marker', () => {
    for (const selector of [
      '.docs-sidebar-top-link',
      '.docs-sidebar-section-link',
    ]) {
      const declarations = declarationsFor(docsCss, selector);
      expect(declarations).toMatch(/border-radius:\s*7px/);
      expect(declarations).not.toMatch(
        /border-(?:left|inline-start)(?:-(?:color|style|width))?\s*:/
      );
    }

    const hover = declarationsFor(
      docsCss,
      '[data-docs-navlink]:not([data-active]):hover'
    );
    const active = declarationsFor(
      docsCss,
      '[data-docs-navlink][data-active]'
    );
    expect(hover).toMatch(/background:\s*var\(--color-surface-dim\)/);
    expect(active).toMatch(/background:\s*var\(--color-accent-surface\)/);
    expect(hover).not.toMatch(
      /border-(?:left|inline-start)(?:-(?:color|style|width))?\s*:/
    );
    expect(active).not.toMatch(
      /border-(?:left|inline-start)(?:-(?:color|style|width))?\s*:/
    );
  });

  it('styles the preview hooks for forced colors and reduced motion', () => {
    expect(docsCss).toMatch(/\[data-docs-runtime-preview\]/);
    expect(docsCss).toMatch(/@media \(forced-colors:\s*active\)/);
    expect(docsCss).toMatch(/Canvas/);
    expect(docsCss).toMatch(/HighlightText/);
    expect(docsCss).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition:\s*none/
    );
  });

  it('renders the stable labeled mode rail with deterministic Cockpit links', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    const rail = screen.getByRole('navigation', { name: 'Docs modes' });
    expect(rail).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Docs' }).getAttribute('aria-current')
    ).toBe('page');
    expect(
      screen.getByRole('link', { name: 'Run' }).getAttribute('href')
    ).toContain(
      '/langgraph/core-capabilities/streaming/overview/python?mode=run'
    );
    expect(
      screen.getByRole('link', { name: 'Code' }).getAttribute('href')
    ).toContain('mode=code');
    expect(
      screen.getByRole('link', { name: 'API' }).getAttribute('href')
    ).toContain('mode=api');
    expect(screen.queryByRole('button', { name: 'Activity' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('renders Lucide rail and action icons with the accepted stroke', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    const rail = screen.getByRole('navigation', { name: 'Docs modes' });
    const icons = [
      ...rail.querySelectorAll('[data-control-plane-rail-icon] svg.lucide'),
      screen.getByRole('button', { name: 'Search docs' }).querySelector('svg'),
    ];
    expect(icons).toHaveLength(5);
    for (const icon of icons) {
      expect(icon?.getAttribute('stroke-width')).toBe('2');
    }
  });

  it('shows truthful scope and a collapsed configuration-only Runtime preview', async () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    const scope = screen
      .getByRole('heading', { name: 'Scope' })
      .closest('section');
    if (!scope) throw new Error('Expected Scope section');
    expect(within(scope).getByText('LangGraph')).toBeTruthy();
    expect(within(scope).getByText('Guides')).toBeTruthy();
    expect(within(scope).getByText('Streaming')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Environment' })).toBeNull();
    const runtime = screen.getByRole('button', { name: 'Runtime' });
    const preview = document.querySelector('[data-docs-runtime-preview]');
    expect(preview).toBeTruthy();
    expect(preview?.contains(runtime)).toBe(true);
    expect(runtime.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(runtime);
    const runtimeSection = runtime.closest('section');
    if (!runtimeSection) throw new Error('Expected Runtime section');
    const configuration = runtimeSection.querySelector('dl');
    if (!configuration) throw new Error('Expected Runtime configuration');
    expect(within(configuration).getByText('Shared development')).toBeTruthy();
    expect(within(configuration).getByText('Cockpit')).toBeTruthy();
    expect(within(configuration).getByText('streaming')).toBeTruthy();
    expect(within(configuration).getByText('Run')).toBeTruthy();
    expect(
      within(runtimeSection)
        .getByRole('link', { name: 'Open controls in Cockpit' })
        .getAttribute('href')
    ).toContain(
      '/langgraph/core-capabilities/streaming/overview/python?mode=run'
    );
    expect(
      within(runtimeSection).queryByText(/ready|unresponsive|last checked/i)
    ).toBeNull();
    await waitFor(() =>
      expect(
        window.localStorage.getItem('threadplane:control-plane:v1')
      ).toContain('Runtime')
    );
  });

  it.each([
    ['Run', 'run'],
    ['Code', 'code'],
    ['API', 'api'],
  ] as const)(
    'tracks the %s rail handoff at the anchor boundary',
    (label, requestedMode) => {
      render(
        <DocsControlPlane
          activeLibrary="langgraph"
          activeSection="guides"
          activeSlug="streaming"
          pageTitle="Streaming"
        />
      );

      fireEvent.click(screen.getByRole('link', { name: label }));

      expect(track).toHaveBeenCalledWith('docs:cockpit_handoff', {
        library: 'langgraph',
        source_section: 'guides',
        source_slug: 'streaming',
        destination_product: 'langgraph',
        destination_capability: 'streaming',
        requested_mode: requestedMode,
        mapped: true,
      });
    }
  );

  it('tracks Open controls as a mapped Run handoff without a URL property', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Runtime' }));

    fireEvent.click(
      screen.getByRole('link', { name: 'Open controls in Cockpit' })
    );

    expect(track).toHaveBeenCalledWith('docs:cockpit_handoff', {
      library: 'langgraph',
      source_section: 'guides',
      source_slug: 'streaming',
      destination_product: 'langgraph',
      destination_capability: 'streaming',
      requested_mode: 'run',
      mapped: true,
    });
    expect(track.mock.calls[0]?.[1]).not.toHaveProperty('destination_url');
  });

  it('uses and tracks the Cockpit home fallback for unsupported pages', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="api"
        activeSlug="inject-agent"
        pageTitle="Inject agent"
      />
    );

    const run = screen.getByRole('link', { name: 'Run' });
    expect(run.getAttribute('href')).toBe(
      'https://cockpit.threadplane.ai/?mode=run'
    );
    fireEvent.click(run);
    expect(track).toHaveBeenCalledWith('docs:cockpit_handoff', {
      library: 'langgraph',
      source_section: 'api',
      source_slug: 'inject-agent',
      requested_mode: 'run',
      mapped: false,
    });
  });

  it('keeps search as a real icon action', () => {
    const listener = vi.fn();
    document.addEventListener('keydown', listener);
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search docs' }));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'k', metaKey: true })
    );
    document.removeEventListener('keydown', listener);
  });

  it('connects nested Learn disclosures to their controlled content', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    const guides = screen.getByRole('button', { name: 'Guides' });
    const controlledId = guides.getAttribute('aria-controls');
    expect(controlledId).toBeTruthy();
    if (!controlledId)
      throw new Error('Expected Guides to control its page links');
    expect(document.getElementById(controlledId)).toBeTruthy();
  });

  it('stacks the adapter title and tagline on separate lines', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'LangGraph' }));
    const item = screen.getByRole('menuitemradio', { name: /LangGraph/ });
    const title = item.querySelector('.docs-sidebar-lib-item-title');
    const tagline = item.querySelector('.docs-sidebar-lib-item-desc');
    if (!title || !tagline) throw new Error('Expected a title and a tagline');

    // The collision regression: both spans rendered inline on one line, so the
    // row read as "LangGraphTalk to LangGraph directly".
    expect(title.textContent).toBe('LangGraph');
    expect(tagline.textContent).toBe('Talk to LangGraph directly');
    const wrapper = title.parentElement;
    if (!wrapper) throw new Error('Expected a text wrapper');
    expect(wrapper.className).toContain('docs-sidebar-lib-item-text');
  });

  it('splits the menu into labelled adapter and library groups', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'LangGraph' }));
    const adapters = screen.getByRole('group', { name: 'Adapters' });
    const libraries = screen.getByRole('group', { name: 'Libraries' });

    // Adapters are asserted exactly: there are two, and only they carry
    // taglines. A new library must not quietly land in this group.
    expect(
      within(adapters)
        .getAllByRole('menuitemradio')
        .map((i) => i.textContent)
    ).toEqual([
      'LangGraphTalk to LangGraph directly',
      'AG-UIAny AG-UI backend',
    ]);
    // Libraries are checked against config so adding one does not churn this
    // test — misclassifying one still fails the assertion above.
    expect(
      within(libraries)
        .getAllByRole('menuitemradio')
        .map((i) => i.textContent)
    ).toEqual(LIBRARY_TITLES);
  });

  it('renders menu entries as real links with the current one checked', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'LangGraph' }));
    const agUi = screen.getByRole('menuitemradio', { name: /AG-UI/ });
    expect(agUi.tagName).toBe('A');
    expect(agUi.getAttribute('href')).toBe(
      '/docs/ag-ui/getting-started/introduction'
    );
    expect(agUi.getAttribute('aria-checked')).toBe('false');
    expect(
      screen
        .getByRole('menuitemradio', { name: /LangGraph/ })
        .getAttribute('aria-checked')
    ).toBe('true');
  });

  it('keeps Runtime focused on the handoff instead of duplicating picker metadata', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Runtime' }));
    const runtime = screen
      .getByRole('button', { name: 'Runtime' })
      .closest('section');
    if (!runtime) throw new Error('Expected Runtime section');
    expect(within(runtime).getByText('Shared development')).toBeTruthy();
    expect(within(runtime).queryByText('Library')).toBeNull();
    expect(within(runtime).queryByText('Framework')).toBeNull();
    expect(within(runtime).queryByText('Package manager')).toBeNull();
  });

  it('caps the open menu to the space left below the trigger', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'LangGraph' }));
    const menu = screen.getByRole('menu');

    // A viewport-percentage cap cannot work: the menu opens ~342px down the
    // pane, so `60vh` still overflows a short window by ~100px. The cap has to
    // be measured from the trigger's own position.
    expect(menu.style.maxHeight).toMatch(/^\d+(\.\d+)?px$/);
  });

  it('supports keyboard entry and dismissal for the library menu', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    const trigger = screen.getByRole('button', { name: 'LangGraph' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const firstItem = screen.getByRole('menuitemradio', { name: /LangGraph/ });
    expect(document.activeElement).toBe(firstItem);

    // Traversal must still cross the Adapters/Libraries group boundary.
    fireEvent.keyDown(firstItem, { key: 'End' });
    expect(document.activeElement).toBe(
      screen.getByRole('menuitemradio', {
        name: LIBRARY_TITLES[LIBRARY_TITLES.length - 1],
      })
    );
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(document.activeElement).toBe(firstItem);

    fireEvent.keyDown(firstItem, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('DocsControlPlane — library-neutral', () => {
  it('states only what it knows in Scope', () => {
    render(
      <DocsControlPlane
        activeLibrary={null}
        activeSection=""
        activeSlug=""
        pageTitle="Choosing an adapter"
      />,
    );

    const scope = screen.getByRole('heading', { name: 'Scope' }).closest('section');
    if (!scope) throw new Error('Expected Scope section');
    expect(within(scope).getByText('Choosing an adapter')).toBeTruthy();
    expect(within(scope).queryByText('LangGraph')).toBeNull();
    expect(within(scope).queryByText('Getting Started')).toBeNull();
  });

  it('offers an unselected picker and no section tree', () => {
    render(
      <DocsControlPlane
        activeLibrary={null}
        activeSection=""
        activeSlug=""
        pageTitle="Choosing an adapter"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Choose a library' });
    fireEvent.click(trigger);
    const items = screen.getAllByRole('menuitemradio');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.getAttribute('aria-checked') === 'false')).toBe(true);

    // No library means there is no section tree to show.
    expect(screen.queryByRole('button', { name: 'Getting Started' })).toBeNull();
  });
});

describe('DocsContextContent', () => {
  it('reuses the same sentence-case navigation content for mobile', () => {
    render(
      <DocsContextContent
        activeLibrary="render"
        activeSection="guides"
        activeSlug="specs"
        pageTitle="Specs & Elements"
        mobile
      />
    );

    expect(screen.getByRole('heading', { name: 'Scope' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Learn' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Runtime' })).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: 'Docs actions' })).toBeTruthy();
  });
});
