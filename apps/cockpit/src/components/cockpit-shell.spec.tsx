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
