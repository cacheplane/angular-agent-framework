/** @vitest-environment jsdom */
import React, { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { cockpitManifest } from '@threadplane/cockpit-registry';
import { ThemeProvider } from '@threadplane/ui-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNavigationTree } from '../lib/route-resolution';
import { MobileNavOverlay } from './mobile-nav-overlay';

const tree = buildNavigationTree(cockpitManifest);
const entry = cockpitManifest.find(
  (candidate) =>
    candidate.product === 'render' &&
    candidate.section === 'core-capabilities' &&
    candidate.topic === 'spec-rendering' &&
    candidate.language === 'python',
)!;

const renderOverlay = (overrides: Partial<React.ComponentProps<typeof MobileNavOverlay>> = {}) => {
  const onClose = vi.fn();
  const onModeChange = vi.fn();
  const triggerRef = createRef<HTMLButtonElement>();
  render(
    <ThemeProvider theme="light">
      <button ref={triggerRef}>Shell trigger</button>
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        activeMode="Run"
        onModeChange={onModeChange}
        runtimeUrl={null}
        isOpen
        onClose={onClose}
        triggerRef={triggerRef}
        {...overrides}
      />
    </ThemeProvider>,
  );
  return { onClose, onModeChange, triggerRef };
};

describe('MobileNavOverlay', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders nothing when closed', () => {
    renderOverlay({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('exposes every mode and capability through the adaptive drawer', () => {
    renderOverlay();
    const dialog = screen.getByRole('dialog', { name: 'Cockpit control plane' });
    for (const mode of ['Run', 'Code', 'Docs', 'API']) {
      expect(within(dialog).getByRole('button', { name: mode })).toBeTruthy();
    }
    expect(within(dialog).getByRole('link', { name: 'Spec Rendering' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(dialog.getAttribute('style') ?? '').not.toContain('width:');
  });

  it('replaces only the drawer body for Settings and restores utility focus', () => {
    const result = renderOverlay();
    const dialog = screen.getByRole('dialog', { name: 'Cockpit control plane' });
    const settings = within(dialog).getByRole('button', { name: 'Settings' });
    fireEvent.click(settings);

    expect(within(dialog).getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Run' })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Capability' })).toBeNull();

    fireEvent.keyDown(within(dialog).getByRole('heading', { name: 'Settings' }), {
      key: 'Escape',
    });

    expect(result.onClose).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Capability' })).toBeTruthy();
    expect(document.activeElement).toBe(settings);
  });

  it('closes from Escape, backdrop, and close control and restores shell focus', () => {
    const result = renderOverlay();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(result.onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(result.triggerRef.current);

    result.onClose.mockClear();
    const dialog = screen.getByRole('dialog', { name: 'Cockpit control plane' });
    fireEvent.mouseDown(dialog);
    expect(result.onClose).toHaveBeenCalledTimes(1);

    result.onClose.mockClear();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close navigation' }));
    expect(result.onClose).toHaveBeenCalledTimes(1);
  });
});
