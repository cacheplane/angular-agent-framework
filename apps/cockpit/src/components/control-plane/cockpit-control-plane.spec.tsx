/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
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

const cockpitCss = readFileSync(
  resolve(fileURLToPath(import.meta.url), '../../../app/cockpit.css'),
  'utf8'
);

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
        .map(
          (button) =>
            button.querySelector('[data-control-plane-rail-label]')?.textContent
        )
    ).toEqual(['Docs', 'Run', 'Code', 'API']);
    expect(
      screen
        .getByRole('button', { name: 'Run, runtime ready' })
        .getAttribute('aria-pressed')
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
      screen
        .getByRole('button', { name: 'Run, runtime ready' })
        .getAttribute('aria-pressed')
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

  it('separates the mode group from the utilities and lifts resting contrast', () => {
    // The utilities separator must resolve to --ds-border-strong, not
    // --ds-border: in dark mode --ds-border (rgb(45,45,45)) sits one value
    // away from --ds-surface-tinted, the rail background (rgb(44,44,44)),
    // which is an invisible 1.01:1 hairline. --ds-border-strong is what the
    // pane divider already uses for the same reason. This is a text
    // assertion, not a rendered-contrast check -- jsdom's getComputedStyle
    // does not resolve var(), so it can't verify the resolved colour, only
    // that the correct token is referenced.
    expect(cockpitCss).toMatch(
      /\[data-control-plane-rail-group="utilities"\][^}]*border-top:\s*1px solid var\(--ds-border-strong\)/
    );
    expect(cockpitCss).not.toMatch(
      /\[data-control-plane-rail-item\]\s*\{[^}]*--ds-text-muted/
    );
  });

  it('puts the runtime phase on the Run rail item', () => {
    renderControlPlane({ runtimeSnapshot: runtimeSnapshot('unresponsive') });
    const run = screen.getByRole('button', { name: 'Run, runtime error' });
    expect(
      run
        .querySelector('[data-control-plane-rail-status]')
        ?.getAttribute('data-control-plane-rail-status')
    ).toBe('error');
  });

  it('shows no dot on Run when no runtime is configured', () => {
    renderControlPlane({
      runtimeSnapshot: runtimeSnapshot('not_configured'),
    });
    const run = screen.getByRole('button', { name: 'Run' });
    expect(run.querySelector('[data-control-plane-rail-status]')).toBeNull();
  });

  it('keeps the status dot ring on the item background and visible in forced colors', () => {
    // jsdom does not resolve var() in getComputedStyle, so this asserts the
    // authored rules, not a rendered colour. The ring must track the rail
    // item's own background: --ds-surface-tinted at rest, --ds-surface on
    // hover, which in dark is rgb(28,28,28) inside the rail's rgb(44,44,44)
    // -- a fixed ring would read as a lighter halo whenever Run is hovered.
    expect(cockpitCss).toMatch(
      /\[data-control-plane-rail-status\]\s*\{[^}]*border:\s*2px solid var\(--cockpit-rail-status-ring\)/
    );
    expect(cockpitCss).toMatch(
      /\[data-control-plane-rail-item\]\s*\{[^}]*--cockpit-rail-status-ring:\s*var\(--ds-surface-tinted\)/
    );
    expect(cockpitCss).toMatch(
      /\[data-control-plane-rail-item\]:hover\s*\{[^}]*--cockpit-rail-status-ring:\s*var\(--ds-surface\)/
    );
    // Forced colors overrides background, so the dot needs an explicit
    // treatment like the runtime pill it sits beside.
    expect(
      cockpitCss.slice(cockpitCss.indexOf('@media (forced-colors: active)'))
    ).toMatch(
      /\[data-control-plane-rail-status\]\s*\{[^}]*border:\s*1px solid CanvasText/
    );
  });

  it('names the mode group as an ARIA group announced to screen readers', () => {
    renderControlPlane();
    const rail = screen.getByRole('navigation', { name: 'Cockpit modes' });
    const group = screen.getByRole('group', { name: 'View' });
    expect(rail.contains(group)).toBe(true);
    const cap = group.querySelector('[data-control-plane-rail-group-label]');
    expect(cap?.textContent).toBe('View');
    expect(cap?.getAttribute('aria-hidden')).toBeNull();
  });
});
