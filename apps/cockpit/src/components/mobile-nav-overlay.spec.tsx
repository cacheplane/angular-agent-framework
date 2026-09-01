/** @vitest-environment jsdom */
import React, { createRef, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { cockpitManifest } from '@threadplane/cockpit-registry';
import { ThemeProvider } from '@threadplane/ui-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNavigationTree } from '../lib/route-resolution';
import {
  createRuntimeSnapshot,
  parseRuntimeTarget,
} from '../lib/runtime/runtime-state';
import type { CockpitUtility } from './control-plane/cockpit-control-plane';
import { MobileNavOverlay } from './mobile-nav-overlay';

const tree = buildNavigationTree(cockpitManifest);
const entry = cockpitManifest.find(
  (candidate) =>
    candidate.product === 'render' &&
    candidate.section === 'core-capabilities' &&
    candidate.topic === 'spec-rendering' &&
    candidate.language === 'python'
)!;
const snapshot = createRuntimeSnapshot(parseRuntimeTarget(null), entry.topic);

const renderOverlay = (
  overrides: Partial<React.ComponentProps<typeof MobileNavOverlay>> = {}
) => {
  const onClose = vi.fn();
  const onModeChange = vi.fn();
  const onActiveUtilityChange = vi.fn();
  const triggerRef = createRef<HTMLButtonElement>();

  function Harness() {
    const [activeUtility, setActiveUtility] = useState<CockpitUtility>(null);
    return (
      <ThemeProvider theme="light">
        <button ref={triggerRef}>Shell trigger</button>
        <MobileNavOverlay
          controlPlaneProps={{
            navigationTree: tree,
            manifest: cockpitManifest,
            entry,
            activeMode: 'Run',
            onModeChange,
            activeUtility,
            onActiveUtilityChange: (utility) => {
              onActiveUtilityChange(utility);
              setActiveUtility(utility);
            },
            activityOpenCycle: 0,
            runtimeSnapshot: snapshot,
            events: [],
            expanded: { Capability: true, Runtime: true },
            onExpandedChange: vi.fn(),
            onClearActivity: vi.fn(),
            onRecheck: vi.fn(),
            onReload: vi.fn(),
            onOpenRuntime: vi.fn(),
            onCopyDiagnostics: vi.fn(),
          }}
          isOpen
          onClose={onClose}
          triggerRef={triggerRef}
          {...overrides}
        />
      </ThemeProvider>
    );
  }

  render(<Harness />);
  return { onClose, onModeChange, onActiveUtilityChange, triggerRef };
};

describe('MobileNavOverlay', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders nothing when closed', () => {
    renderOverlay({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('exposes the same operational control-plane state through the adaptive drawer', () => {
    renderOverlay();
    const dialog = screen.getByRole('dialog', {
      name: 'Cockpit control plane',
    });
    for (const mode of ['Run', 'Code', 'Docs', 'API']) {
      expect(within(dialog).getByRole('button', { name: mode })).toBeTruthy();
    }
    expect(
      within(dialog).getByRole('link', { name: 'Spec Rendering' })
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Activity' })
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Settings' })
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Runtime' })
    ).toBeTruthy();
    expect(dialog.getAttribute('style') ?? '').not.toContain('width:');
  });

  it.each(['Activity', 'Settings'] as const)(
    'replaces only the drawer body for %s and restores matching utility focus',
    (utility) => {
      const result = renderOverlay();
      const dialog = screen.getByRole('dialog', {
        name: 'Cockpit control plane',
      });
      const invoker = within(dialog).getByRole('button', { name: utility });
      fireEvent.click(invoker);

      expect(
        within(dialog).getByRole('heading', { name: utility })
      ).toBeTruthy();
      expect(within(dialog).getByRole('button', { name: 'Run' })).toBeTruthy();
      expect(
        within(dialog).queryByRole('button', { name: 'Capability' })
      ).toBeNull();

      fireEvent.keyDown(
        within(dialog).getByRole('heading', { name: utility }),
        { key: 'Escape' }
      );

      expect(result.onClose).not.toHaveBeenCalled();
      expect(
        within(dialog).getByRole('button', { name: 'Capability' })
      ).toBeTruthy();
      expect(document.activeElement).toBe(invoker);
    }
  );

  it('closes from Escape, backdrop, and close control and restores shell focus', () => {
    const result = renderOverlay();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(result.onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(result.triggerRef.current);

    result.onClose.mockClear();
    const dialog = screen.getByRole('dialog', {
      name: 'Cockpit control plane',
    });
    fireEvent.mouseDown(dialog);
    expect(result.onClose).toHaveBeenCalledTimes(1);

    result.onClose.mockClear();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Close navigation' })
    );
    expect(result.onClose).toHaveBeenCalledTimes(1);
  });
});
