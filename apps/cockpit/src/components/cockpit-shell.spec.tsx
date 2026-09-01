/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CONTROL_PLANE_STORAGE_KEY, ThemeProvider } from '@threadplane/ui-react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCockpitPageModel } from '../lib/cockpit-page';
import { CockpitShell } from './cockpit-shell';

const model = getCockpitPageModel();
const contentBundle = {
  codeFiles: {},
  promptFiles: {},
  runtimeUrl: null,
  docSections: [],
  narrativeDocs: [],
};

const seedMode = (activeMode: 'Run' | 'Code' | 'Docs' | 'API') => {
  window.localStorage.setItem(CONTROL_PLANE_STORAGE_KEY, JSON.stringify({
    version: 1,
    docs: { expanded: { Learn: true, Environment: false } },
    cockpit: { activeMode, expanded: { Capability: true, Environment: true } },
  }));
};

const renderShellFor = (slug: string[]) => {
  const pageModel = getCockpitPageModel(slug);
  return render(
    <ThemeProvider theme="light">
      <CockpitShell
        navigationTree={pageModel.navigationTree}
        presentation={pageModel.presentation}
        entryTitle={pageModel.entry.title}
        contentBundle={contentBundle}
      />
    </ThemeProvider>,
  );
};

const renderShell = () => render(
  <ThemeProvider theme="light">
    <CockpitShell
      navigationTree={model.navigationTree}
      presentation={model.presentation}
      entryTitle={model.entry.title}
      contentBundle={contentBundle}
    />
  </ThemeProvider>,
);

describe('CockpitShell control-plane mode state', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('initializes from the saved Cockpit mode after hydration', async () => {
    seedMode('Docs');
    renderShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Docs' }).getAttribute('aria-pressed')).toBe('true');
    });
    expect(screen.getByRole('region', { name: 'Docs mode' })).toBeTruthy();
  });

  it('consumes a valid mode query once and persists it over the saved mode', async () => {
    seedMode('Docs');
    window.history.replaceState({}, '', '/?mode=code&keep=1');
    renderShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Code' }).getAttribute('aria-pressed')).toBe('true');
    });
    expect(window.location.search).toBe('?keep=1');
    expect(JSON.parse(window.localStorage.getItem(CONTROL_PLANE_STORAGE_KEY) ?? '{}').cockpit.activeMode).toBe('Code');
  });

  it('ignores invalid mode queries and uses the saved mode', async () => {
    seedMode('API');
    window.history.replaceState({}, '', '/?mode=preview');
    renderShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'API' }).getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('keeps Run mounted while another mode is selected', async () => {
    renderShell();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Code' }));

    expect(screen.getByRole('region', { name: 'Run mode' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Code mode' })).toBeTruthy();
  });
});

describe('CockpitShell documentation link', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('links a capability to its page on the docs site', () => {
    renderShellFor(['langgraph', 'core-capabilities', 'streaming', 'overview', 'python']);

    const link = screen.getByRole('link', { name: /read docs/i });
    expect(link.getAttribute('href')).toBe(
      'https://threadplane.ai/docs/langgraph/guides/streaming'
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders no link for a capability with no published docs page', () => {
    // deep-agents carries the NO_COCKPIT_DOCS_LINK sentinel: the website has no
    // deep-agents library yet, so there is nothing to link to.
    renderShellFor(['deep-agents', 'core-capabilities', 'planning', 'overview', 'python']);

    expect(screen.queryByRole('link', { name: /read docs/i })).toBeNull();
  });
});
