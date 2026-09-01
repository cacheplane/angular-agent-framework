// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsControlPlane, DocsContextContent } from './DocsControlPlane';

const workspaceRoot = process.cwd().endsWith('/apps/website')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const docsCss = readFileSync(
  resolve(workspaceRoot, 'apps/website/src/styles/docs.css'),
  'utf8',
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

  it('shows truthful scope and a collapsed configuration-only Runtime preview', async () => {
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
    expect(within(runtimeSection).getByRole('link', { name: 'Open controls in Cockpit' }).getAttribute('href')).toContain(
      '/langgraph/core-capabilities/streaming/overview/python?mode=run',
    );
    expect(within(runtimeSection).queryByText(/ready|unresponsive|last checked/i)).toBeNull();
    await waitFor(() => expect(window.localStorage.getItem('threadplane:control-plane:v1')).toContain('Runtime'));
  });

  it.each([
    ['Run', 'run'],
    ['Code', 'code'],
    ['API', 'api'],
  ] as const)('tracks the %s rail handoff at the anchor boundary', (label, requestedMode) => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />,
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
  });

  it('tracks Open controls as a mapped Run handoff without a URL property', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Runtime' }));

    fireEvent.click(screen.getByRole('link', { name: 'Open controls in Cockpit' }));

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
      />,
    );

    const run = screen.getByRole('link', { name: 'Run' });
    expect(run.getAttribute('href')).toBe('https://cockpit.threadplane.ai/?mode=run');
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
    expect(screen.getByRole('button', { name: 'Runtime' })).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: 'Docs actions' })).toBeTruthy();
  });
});
