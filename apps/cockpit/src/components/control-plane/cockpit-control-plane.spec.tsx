/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { cockpitManifest } from '@threadplane/cockpit-registry';
import { ThemeProvider } from '@threadplane/ui-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNavigationTree } from '../../lib/route-resolution';
import { CockpitControlPlane } from './cockpit-control-plane';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('../../lib/analytics/client', () => ({ track }));

const entry = cockpitManifest.find(
  (candidate) =>
    candidate.product === 'langgraph' &&
    candidate.section === 'core-capabilities' &&
    candidate.topic === 'streaming' &&
    candidate.language === 'python',
)!;

const renderControlPlane = (
  overrides: Partial<React.ComponentProps<typeof CockpitControlPlane>> = {},
) => {
  const onModeChange = vi.fn();
  render(
    <ThemeProvider theme="light">
      <CockpitControlPlane
        navigationTree={buildNavigationTree(cockpitManifest)}
        manifest={cockpitManifest}
        entry={entry}
        activeMode="Run"
        onModeChange={onModeChange}
        runtimeUrl="https://runtime.example.test"
        {...overrides}
      />
    </ThemeProvider>,
  );
  return { onModeChange };
};

describe('CockpitControlPlane', () => {
  beforeEach(() => {
    window.localStorage.clear();
    track.mockClear();
  });

  it('renders labeled primary modes and truthful context', () => {
    renderControlPlane();

    const rail = screen.getByRole('navigation', { name: 'Cockpit modes' });
    expect(within(rail).getAllByRole('button').slice(0, 4).map((button) => button.textContent)).toEqual([
      'Docs',
      'Run',
      'Code',
      'API',
    ]);
    for (const mode of ['Run', 'Code', 'Docs', 'API']) {
      expect(screen.getByRole('button', { name: mode })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Run' }).getAttribute('aria-pressed')).toBe('true');
    const settings = screen.getByRole('button', { name: 'Settings' });
    const settingsTooltip = screen.getByRole('tooltip', { name: 'Settings' });
    expect(settings.getAttribute('aria-describedby')).toBe(settingsTooltip.id);
    expect(screen.queryByRole('button', { name: 'Activity' })).toBeNull();

    const pane = screen.getByRole('complementary', { name: 'Cockpit context' });
    expect(within(pane).getByRole('heading', { name: 'Scope' })).toBeTruthy();
    expect(pane.textContent).toContain('LangGraph');
    expect(pane.textContent).toContain('Streaming');
    expect(within(pane).getByRole('button', { name: 'Capability' })).toBeTruthy();
    expect(within(pane).getByRole('button', { name: 'Environment' })).toBeTruthy();
    expect(within(pane).getByRole('link', { name: 'Open runtime' }).getAttribute('href')).toBe(
      'https://runtime.example.test',
    );
    expect(within(pane).queryByText('Theme')).toBeNull();
  });

  it('switches modes, clears utilities, and preserves mode analytics', () => {
    const { onModeChange } = renderControlPlane();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Code' }));

    expect(onModeChange).toHaveBeenCalledWith('Code');
    expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
    expect(track).toHaveBeenCalledWith('cockpit:mode_switched', {
      capability: 'streaming',
      from_mode: 'run',
      to_mode: 'code',
    });
  });

  it('keeps language and theme controls inside the Settings utility', () => {
    renderControlPlane();
    expect(screen.queryByRole('button', { name: 'Python' })).toBeNull();

    const settings = screen.getByRole('button', { name: 'Settings' });
    fireEvent.click(settings);

    const heading = screen.getByRole('heading', { name: 'Settings' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole('button', { name: 'Python' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Capability' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close Settings' }));
    expect(document.activeElement).toBe(settings);
  });

  it('keeps Settings open when Escape dismisses the nested language menu', () => {
    renderControlPlane();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const language = screen.getByRole('button', { name: 'Python' });
    fireEvent.click(language);
    expect(screen.getByRole('menu', { name: 'Language picker' })).toBeTruthy();

    fireEvent.keyDown(language, { key: 'Escape' });

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByRole('menu', { name: 'Language picker' })).toBeNull();
    expect(document.activeElement).toBe(language);
  });

  it('omits the runtime action when no runtime exists', () => {
    renderControlPlane({ runtimeUrl: null });
    expect(screen.queryByRole('link', { name: 'Open runtime' })).toBeNull();
    expect(screen.queryByText('Runtime')).toBeNull();
  });
});
