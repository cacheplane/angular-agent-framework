// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsControlPlane, DocsContextContent } from './DocsControlPlane';
import { docsConfig } from '../../lib/docs-config';

const LIBRARY_TITLES = docsConfig.filter((l) => l.group === 'library').map((l) => l.title);

const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/docs/langgraph/guides/streaming',
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  window.localStorage.clear();
  push.mockClear();
});

describe('DocsControlPlane', () => {
  it('renders the stable labeled mode rail with deterministic Cockpit links', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />,
    );

    const rail = screen.getByRole('navigation', { name: 'Docs modes' });
    expect(rail).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Run' }).getAttribute('href')).toContain('/langgraph/core-capabilities/streaming/overview/python?mode=run');
    expect(screen.getByRole('link', { name: 'Code' }).getAttribute('href')).toContain('mode=code');
    expect(screen.getByRole('link', { name: 'API' }).getAttribute('href')).toContain('mode=api');
    expect(screen.queryByRole('button', { name: 'Activity' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('shows truthful scope and collapsed environment defaults', async () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />,
    );

    const scope = screen.getByRole('heading', { name: 'Scope' }).closest('section');
    if (!scope) throw new Error('Expected Scope section');
    expect(within(scope).getByText('LangGraph')).toBeTruthy();
    expect(within(scope).getByText('Guides')).toBeTruthy();
    expect(within(scope).getByText('Streaming')).toBeTruthy();
    const environment = screen.getByRole('button', { name: 'Environment' });
    expect(environment.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(environment);
    expect(screen.getByText('Angular')).toBeTruthy();
    expect(screen.getByText('npm')).toBeTruthy();
    await waitFor(() => expect(window.localStorage.getItem('threadplane:control-plane:v1')).toContain('Environment'));
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
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search docs' }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ key: 'k', metaKey: true }));
    document.removeEventListener('keydown', listener);
  });

  it('connects nested Learn disclosures to their controlled content', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />,
    );

    const guides = screen.getByRole('button', { name: 'Guides' });
    const controlledId = guides.getAttribute('aria-controls');
    expect(controlledId).toBeTruthy();
    if (!controlledId) throw new Error('Expected Guides to control its page links');
    expect(document.getElementById(controlledId)).toBeTruthy();
  });

  it('stacks the adapter title and tagline on separate lines', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />,
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
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'LangGraph' }));
    const adapters = screen.getByRole('group', { name: 'Adapters' });
    const libraries = screen.getByRole('group', { name: 'Libraries' });

    // Adapters are asserted exactly: there are two, and only they carry
    // taglines. A new library must not quietly land in this group.
    expect(within(adapters).getAllByRole('menuitemradio').map((i) => i.textContent)).toEqual([
      'LangGraphTalk to LangGraph directly',
      'AG-UIAny AG-UI backend',
    ]);
    // Libraries are checked against config so adding one does not churn this
    // test — misclassifying one still fails the assertion above.
    expect(within(libraries).getAllByRole('menuitemradio').map((i) => i.textContent)).toEqual(
      LIBRARY_TITLES,
    );
  });

  it('renders menu entries as real links with the current one checked', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'LangGraph' }));
    const agUi = screen.getByRole('menuitemradio', { name: /AG-UI/ });
    expect(agUi.tagName).toBe('A');
    expect(agUi.getAttribute('href')).toBe('/docs/ag-ui/getting-started/introduction');
    expect(agUi.getAttribute('aria-checked')).toBe('false');
    expect(
      screen.getByRole('menuitemradio', { name: /LangGraph/ }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('drops the library row from environment now the picker owns it', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Environment' }));
    expect(screen.getByText('Angular')).toBeTruthy();
    expect(screen.getByText('npm')).toBeTruthy();
    expect(screen.queryByText('Library')).toBeNull();
  });

  it('caps the open menu to the space left below the trigger', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />,
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
      />,
    );

    const trigger = screen.getByRole('button', { name: 'LangGraph' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const firstItem = screen.getByRole('menuitemradio', { name: /LangGraph/ });
    expect(document.activeElement).toBe(firstItem);

    // Traversal must still cross the Adapters/Libraries group boundary.
    fireEvent.keyDown(firstItem, { key: 'End' });
    expect(document.activeElement).toBe(
      screen.getByRole('menuitemradio', { name: LIBRARY_TITLES[LIBRARY_TITLES.length - 1] }),
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
      />,
    );

    expect(screen.getByRole('heading', { name: 'Scope' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Learn' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Environment' })).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: 'Docs actions' })).toBeTruthy();
  });
});
