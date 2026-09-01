/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { cockpitManifest } from '@threadplane/cockpit-registry';
import { ThemeProvider, type ControlPlaneMode } from '@threadplane/ui-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNavigationTree } from '../../lib/route-resolution';
import {
  createRuntimeSnapshot,
  parseRuntimeTarget,
  type RuntimePhase,
} from '../../lib/runtime/runtime-state';
import type { SessionActivityEvent } from '../../lib/runtime/session-activity';
import {
  CockpitControlPlane,
  type CockpitControlPlaneProps,
  type CockpitUtility,
} from './cockpit-control-plane';

const entry = cockpitManifest.find(
  (candidate) =>
    candidate.product === 'langgraph' &&
    candidate.section === 'core-capabilities' &&
    candidate.topic === 'streaming' &&
    candidate.language === 'python'
)!;

const activity: SessionActivityEvent[] = [
  {
    id: 'event-1',
    at: '2026-08-31T17:00:00.000Z',
    kind: 'runtime_unresponsive',
    severity: 'error',
    capability: 'streaming',
    summary: 'Runtime unresponsive',
  },
];

const runtimeSnapshot = (phase: RuntimePhase) => ({
  ...createRuntimeSnapshot(
    parseRuntimeTarget('https://runtime.example.test'),
    'streaming'
  ),
  phase,
});

type HarnessOverrides = Partial<
  Omit<
    CockpitControlPlaneProps,
    'activeMode' | 'onModeChange' | 'activeUtility' | 'onActiveUtilityChange'
  >
> & {
  initialMode?: ControlPlaneMode;
  initialUtility?: CockpitUtility;
};

const renderControlPlane = (overrides: HarnessOverrides = {}) => {
  const onModeChange = vi.fn();
  const onActiveUtilityChange = vi.fn();
  const onExpandedChange = vi.fn();
  const actions = {
    onClearActivity: vi.fn(),
    onRecheck: vi.fn(),
    onReload: vi.fn(),
    onOpenRuntime: vi.fn().mockReturnValue('requested' as const),
    onCopyDiagnostics: vi.fn().mockResolvedValue('succeeded' as const),
  };

  function Harness() {
    const [activeMode, setActiveMode] = useState<ControlPlaneMode>(
      overrides.initialMode ?? 'Run'
    );
    const [activeUtility, setActiveUtility] = useState<CockpitUtility>(
      overrides.initialUtility ?? null
    );
    return (
      <ThemeProvider theme="light">
        <CockpitControlPlane
          navigationTree={buildNavigationTree(cockpitManifest)}
          manifest={cockpitManifest}
          entry={entry}
          activeMode={activeMode}
          onModeChange={(mode) => {
            onModeChange(mode);
            setActiveMode(mode);
          }}
          activeUtility={activeUtility}
          onActiveUtilityChange={(utility) => {
            onActiveUtilityChange(utility);
            setActiveUtility(utility);
          }}
          activityOpenCycle={1}
          runtimeSnapshot={runtimeSnapshot('ready')}
          events={activity}
          expanded={{ Capability: true, Runtime: true }}
          onExpandedChange={onExpandedChange}
          {...actions}
          {...overrides}
        />
      </ThemeProvider>
    );
  }

  render(<Harness />);
  return { onModeChange, onActiveUtilityChange, onExpandedChange, ...actions };
};

describe('CockpitControlPlane', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders four primary modes plus Runtime after Scope and Capability', () => {
    renderControlPlane();

    const rail = screen.getByRole('navigation', { name: 'Cockpit modes' });
    expect(
      within(rail)
        .getAllByRole('button')
        .slice(0, 4)
        .map((button) => button.textContent)
    ).toEqual(['Docs', 'Run', 'Code', 'API']);
    expect(
      screen.getByRole('button', { name: 'Run' }).getAttribute('aria-pressed')
    ).toBe('true');

    const pane = screen.getByRole('complementary', {
      name: 'Cockpit context',
    });
    const scope = within(pane).getByRole('heading', { name: 'Scope' });
    const capability = within(pane).getByRole('button', {
      name: 'Capability',
    });
    const runtime = within(pane).getByRole('button', { name: 'Runtime' });
    expect(
      scope.compareDocumentPosition(capability) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      capability.compareDocumentPosition(runtime) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(pane.textContent).toContain('Python · LangGraph');
    expect(within(pane).queryByText('Environment')).toBeNull();
    expect(within(pane).queryByText('Actions')).toBeNull();
  });

  it('renders Activity above Settings with a nonnumeric attention indicator that opening does not clear', () => {
    renderControlPlane({ runtimeSnapshot: runtimeSnapshot('unresponsive') });
    const rail = screen.getByRole('navigation', { name: 'Cockpit modes' });
    const utilities = within(rail).getAllByRole('button').slice(4);
    expect(
      utilities.map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Activity, attention required', 'Settings']);
    expect(
      document.querySelector('[data-cockpit-activity-attention]')?.textContent
    ).toBe('');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Activity, attention required',
      })
    );
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Activity, attention required',
      })
    ).toBeTruthy();
  });

  it('keeps Activity and Settings mutually exclusive without changing the primary mode', () => {
    const result = renderControlPlane();
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Run' }).getAttribute('aria-pressed')
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Activity' })).toBeNull();
    expect(result.onModeChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Capability' })).toBeTruthy();
  });

  it('dismisses a utility before invoking a primary mode callback', () => {
    const result = renderControlPlane({ initialUtility: 'activity' });

    fireEvent.click(screen.getByRole('button', { name: 'Code' }));

    expect(result.onActiveUtilityChange).toHaveBeenLastCalledWith(null);
    expect(result.onModeChange).toHaveBeenCalledWith('Code');
    const utilityOrder =
      result.onActiveUtilityChange.mock.invocationCallOrder.at(-1);
    const modeOrder = result.onModeChange.mock.invocationCallOrder.at(-1);
    if (utilityOrder === undefined || modeOrder === undefined) {
      throw new Error('Expected utility and mode callbacks');
    }
    expect(utilityOrder).toBeLessThan(modeOrder);
    expect(screen.queryByRole('heading', { name: 'Activity' })).toBeNull();
  });

  it.each([
    ['Activity', 'Close Activity'],
    ['Settings', 'Close Settings'],
  ] as const)(
    'restores the matching %s invoker on panel close',
    (utility, closeName) => {
      renderControlPlane();
      const invoker = screen.getByRole('button', { name: utility });
      fireEvent.click(invoker);
      fireEvent.click(screen.getByRole('button', { name: closeName }));
      expect(document.activeElement).toBe(invoker);
    }
  );

  it('forwards the controlled Runtime disclosure and operational actions', () => {
    const result = renderControlPlane();
    fireEvent.click(screen.getByRole('button', { name: 'Runtime' }));
    expect(result.onExpandedChange).toHaveBeenCalledWith('Runtime', false);
    fireEvent.click(screen.getByRole('button', { name: 'Recheck' }));
    expect(result.onRecheck).toHaveBeenCalledTimes(1);
  });
});
