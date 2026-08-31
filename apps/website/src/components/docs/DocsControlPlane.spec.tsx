// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsControlPlane, DocsContextContent } from './DocsControlPlane';

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
    const firstItem = screen.getByRole('menuitem', { name: /LangGraph/ });
    expect(document.activeElement).toBe(firstItem);

    fireEvent.keyDown(firstItem, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
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
