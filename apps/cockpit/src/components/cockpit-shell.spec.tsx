/** @vitest-environment jsdom */
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  CONTROL_PLANE_STORAGE_KEY,
  ThemeProvider,
} from '@threadplane/ui-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCockpitPageModel } from '../lib/cockpit-page';
import type {
  UseRuntimeControllerOptions,
  WorkspaceProviderProps,
  WorkspaceShellProps,
} from '@threadplane/workspace-react';

type CockpitSharedShellProps = WorkspaceShellProps & {
  modeNavigationLabel?: string;
  contextPaneLabel?: string;
  mobileDialogLabel?: string;
  mobileTitle?: string;
};

const operationalMocks = vi.hoisted(() => ({
  controllerInstances: 0,
  latestControllerOptions: null as UseRuntimeControllerOptions | null,
  activityShouldThrow: false,
  latestProviderProps: null as WorkspaceProviderProps | null,
  latestShellProps: null as CockpitSharedShellProps | null,
  track: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: operationalMocks.push,
    refresh: vi.fn(),
    replace: operationalMocks.replace,
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('../lib/analytics/client', () => ({ track: operationalMocks.track }));

vi.mock('@threadplane/workspace-react', async (importOriginal) => {
  const ReactModule = await import('react');
  const actual = await importOriginal<
    typeof import('@threadplane/workspace-react')
  >();
  return {
    ...actual,
    WorkspaceProvider(props: WorkspaceProviderProps) {
      operationalMocks.latestProviderProps = props;
      return ReactModule.createElement(actual.WorkspaceProvider, props);
    },
    WorkspaceShell(props: WorkspaceShellProps) {
      operationalMocks.latestShellProps = props;
      return ReactModule.createElement(actual.WorkspaceShell, props);
    },
  };
});

vi.mock(
  '../../../../libs/workspace-react/src/lib/runtime/use-runtime-controller',
  async (importOriginal) => {
    const ReactModule = await import('react');
    const actual = await importOriginal<
      typeof import('../../../../libs/workspace-react/src/lib/runtime/use-runtime-controller')
    >();
    return {
      ...actual,
      useRuntimeController(options: UseRuntimeControllerOptions) {
        const mounted = ReactModule.useRef(false);
        if (!mounted.current) {
          mounted.current = true;
          operationalMocks.controllerInstances += 1;
        }
        ReactModule.useLayoutEffect(() => {
          operationalMocks.latestControllerOptions = options;
        }, [options]);
        return actual.useRuntimeController(options);
      },
    };
  }
);

vi.mock(
  '../../../../libs/workspace-react/src/lib/components/control-plane/activity-panel',
  async (importOriginal) => {
    const ReactModule = await import('react');
    const actual = await importOriginal<
      typeof import('../../../../libs/workspace-react/src/lib/components/control-plane/activity-panel')
    >();
    return {
      ...actual,
      ActivityPanel(props: React.ComponentProps<typeof actual.ActivityPanel>) {
        if (operationalMocks.activityShouldThrow) {
          throw new Error('sensitive activity render failure');
        }
        return ReactModule.createElement(actual.ActivityPanel, props);
      },
    };
  }
);

import { CockpitShell } from './cockpit-shell';

const model = getCockpitPageModel();
const persistenceModel = getCockpitPageModel([
  'langgraph',
  'core-capabilities',
  'persistence',
  'overview',
  'python',
]);
const baseContentBundle = {
  codeFiles: {},
  promptFiles: {},
  runtimeUrl: null,
  docSections: [],
  narrativeDocs: [],
};

const seedExpanded = (
  expanded: Record<string, boolean> = {
    Capability: true,
    Runtime: true,
  }
) => {
  window.localStorage.setItem(
    CONTROL_PLANE_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      docs: { expanded: { Learn: true, Environment: false } },
      cockpit: { expanded },
    })
  );
};

const renderShell = (runtimeUrl: string | null = null) =>
  render(
    <ThemeProvider theme="light">
      <CockpitShell
        navigationTree={model.navigationTree}
        resolution={model.resolution}
        presentation={model.presentation}
        contentBundle={{ ...baseContentBundle, runtimeUrl }}
        routePath={model.canonicalPath}
        requestedMode={new URL(window.location.href).searchParams.get('mode')}
      />
    </ThemeProvider>
  );

const renderShellFor = (slug: string[]) => {
  const pageModel = getCockpitPageModel(slug);
  return render(
    <ThemeProvider theme="light">
      <CockpitShell
        navigationTree={pageModel.navigationTree}
        resolution={pageModel.resolution}
        presentation={pageModel.presentation}
        contentBundle={baseContentBundle}
        routePath={pageModel.canonicalPath}
        requestedMode={new URL(window.location.href).searchParams.get('mode')}
      />
    </ThemeProvider>
  );
};

// The Run rail item's accessible name carries the live runtime phase
// ('Run, runtime ready'), so these mode assertions match the label prefix
// instead of a name that depends on which phase the fixture happens to be in.
const RUN_RAIL_ITEM = /^Run(,|$)/;

const openActivity = () => {
  fireEvent.click(screen.getByRole('button', { name: /^Activity/ }));
  return screen.getByRole('heading', {
    name: /Activity(?: unavailable)?/,
  });
};

describe('CockpitShell operational composition', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    operationalMocks.controllerInstances = 0;
    operationalMocks.latestControllerOptions = null;
    operationalMocks.activityShouldThrow = false;
    operationalMocks.latestProviderProps = null;
    operationalMocks.latestShellProps = null;
    operationalMocks.track.mockClear();
    operationalMocks.push.mockClear();
    operationalMocks.replace.mockClear();
    document.documentElement.dataset.theme = 'light';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({}));
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('adapts Cockpit route, content, navigation, analytics, session, telemetry, theme, and labels into the shared workspace', () => {
    renderShell();

    expect(operationalMocks.latestProviderProps).toMatchObject({
      contentBundle: baseContentBundle,
      routeKind: 'workspace',
      routePath: model.canonicalPath,
      requestedMode: null,
      runtimeTelemetry: {
        posthogToken: process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_TOKEN,
        ingestHost: process.env.NEXT_PUBLIC_COCKPIT_INGEST_HOST,
      },
    });
    expect(operationalMocks.latestProviderProps?.resolution.kind).toBe(
      'mapped'
    );
    expect(
      operationalMocks.latestProviderProps?.resolution.kind === 'mapped'
        ? operationalMocks.latestProviderProps.resolution.identity.id
        : null
    ).toBe('langgraph:core-capabilities:streaming:overview:python');
    expect(operationalMocks.latestProviderProps?.presentation.kind).toBe(
      'capability'
    );
    expect(operationalMocks.latestProviderProps?.getSessionId).toBeTypeOf(
      'function'
    );
    expect(operationalMocks.latestProviderProps?.pushIdentity).toBeTypeOf(
      'function'
    );
    expect(operationalMocks.latestProviderProps?.pushMode).toBeTypeOf(
      'function'
    );
    expect(operationalMocks.latestProviderProps?.replaceMode).toBeTypeOf(
      'function'
    );
    expect(operationalMocks.latestProviderProps?.trackNavigation).toBeTypeOf(
      'function'
    );
    expect(
      operationalMocks.latestProviderProps?.trackNarrativeAction
    ).toBeTypeOf('function');
    expect(operationalMocks.latestProviderProps?.trackModeChange).toBeTypeOf(
      'function'
    );
    expect(operationalMocks.latestProviderProps?.trackRuntimeAction).toBeTypeOf(
      'function'
    );
    expect(
      operationalMocks.latestProviderProps?.trackRuntimeTransition
    ).toBeTypeOf('function');
    expect(operationalMocks.latestShellProps).toMatchObject({
      navigationTree: model.navigationTree,
      ariaLabel: 'Cockpit shell',
      modeNavigationLabel: 'Cockpit modes',
      contextPaneLabel: 'Cockpit context',
      mobileDialogLabel: 'Cockpit control plane',
      mobileTitle: 'Cockpit',
    });
    expect(operationalMocks.latestShellProps?.themeControl).toBeTruthy();
  });

  it('uses the truthful workspace route default when no mode query is present', async () => {
    renderShell();

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: RUN_RAIL_ITEM })
          .getAttribute('aria-pressed')
      ).toBe('true');
    });
    expect(screen.getByRole('region', { name: 'Run mode' })).toBeTruthy();
  });

  it('keeps a valid mode query as route state without persisting the mode', async () => {
    window.history.replaceState({}, '', '/?mode=code&keep=1');
    renderShell();

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'Code' })
          .getAttribute('aria-pressed')
      ).toBe('true');
    });
    expect(window.location.search).toBe('?mode=code&keep=1');
    expect(window.localStorage.getItem(CONTROL_PLANE_STORAGE_KEY)).toBeNull();
  });

  it('normalizes invalid mode queries to the truthful route default', async () => {
    window.history.replaceState({}, '', '/?mode=preview');
    renderShell();

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: RUN_RAIL_ITEM })
          .getAttribute('aria-pressed')
      ).toBe('true');
    });
    expect(operationalMocks.replace).toHaveBeenCalledWith('/?mode=run');
  });

  it('owns one controller and one Activity store shared by desktop and mobile adapters', async () => {
    renderShell();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: RUN_RAIL_ITEM })).toBeTruthy()
    );
    expect(operationalMocks.controllerInstances).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    openActivity();
    expect(screen.getAllByText('Mode changed to Code')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = screen.getByRole('dialog', {
      name: 'Cockpit control plane',
    });
    expect(within(dialog).getByText('Mode changed to Code')).toBeTruthy();
    expect(operationalMocks.controllerInstances).toBe(1);
  });

  it('flags an unread runtime problem until Activity is opened, and survives recovery', async () => {
    renderShell();
    await waitFor(() =>
      expect(operationalMocks.latestControllerOptions).not.toBeNull()
    );

    // Routine activity must not light the indicator.
    act(() => {
      operationalMocks.latestControllerOptions?.onActivity({
        id: 'ready-event',
        at: '2026-08-31T17:00:00.000Z',
        kind: 'runtime_ready',
        capability: 'streaming',
      });
    });
    expect(screen.getByRole('button', { name: 'Activity' })).toBeTruthy();

    act(() => {
      operationalMocks.latestControllerOptions?.onActivity({
        id: 'unresponsive-event',
        at: '2026-08-31T17:01:00.000Z',
        kind: 'runtime_unresponsive',
        capability: 'streaming',
      });
    });
    expect(
      screen.getAllByRole('button', { name: 'Activity, 1 unread problem' })
    ).not.toHaveLength(0);

    // A self-recovering runtime clears the phase but not the unread problem.
    act(() => {
      operationalMocks.latestControllerOptions?.onActivity({
        id: 'recovered-event',
        at: '2026-08-31T17:02:00.000Z',
        kind: 'runtime_recovered',
        capability: 'streaming',
      });
    });
    expect(
      screen.getAllByRole('button', { name: 'Activity, 1 unread problem' })
    ).not.toHaveLength(0);

    openActivity();
    expect(
      screen.getAllByRole('button', { name: 'Activity' })
    ).not.toHaveLength(0);

    // Clearing the log must reset the marker too. If it did not, the marker
    // would stay at N over an empty log and silently swallow the next N
    // problems for the rest of the page visit.
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Activity actions' })[0]
    );
    fireEvent.click(
      screen.getAllByRole('menuitem', { name: 'Clear session activity' })[0]
    );
    act(() => {
      operationalMocks.latestControllerOptions?.onActivity({
        id: 'post-clear-event',
        at: '2026-08-31T17:03:00.000Z',
        kind: 'runtime_unresponsive',
        capability: 'streaming',
      });
    });
    expect(
      screen.getAllByRole('button', { name: 'Activity, 1 unread problem' })
    ).not.toHaveLength(0);
  });

  it('does not reset drawer focus when shared operational state rerenders', async () => {
    renderShell();
    await waitFor(() =>
      expect(operationalMocks.latestControllerOptions).not.toBeNull()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = screen.getByRole('dialog', {
      name: 'Cockpit control plane',
    });
    const capability = within(dialog).getByRole('button', {
      name: 'Capability',
    });
    capability.focus();

    act(() => {
      operationalMocks.latestControllerOptions?.onActivity({
        id: 'background-event',
        at: '2026-08-31T17:00:00.000Z',
        kind: 'runtime_ready',
        capability: 'streaming',
      });
    });

    expect(document.activeElement).toBe(capability);
  });

  it('keeps both background siblings inert through the mobile closing transition', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16)
    );
    vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
      window.clearTimeout(handle)
    );
    const rendered = renderShell();
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const shell = screen.getByRole('main', { name: 'Cockpit shell' });
    const desktopNavigation = shell.querySelector(
      '[data-cockpit-desktop-navigation]'
    );
    const workspace = shell.querySelector('[data-cockpit-workspace]');
    const trigger = shell.querySelector<HTMLButtonElement>(
      '.cockpit-mobile-navigation-trigger'
    );
    if (!desktopNavigation || !workspace || !trigger) {
      throw new Error('Expected named shell boundaries and mobile trigger');
    }
    const inertAtFocusAttempt: boolean[] = [];
    const nativeFocus = trigger.focus.bind(trigger);
    vi.spyOn(trigger, 'focus').mockImplementation(() => {
      inertAtFocusAttempt.push(Boolean(trigger.closest('[inert]')));
      nativeFocus();
    });

    fireEvent.click(trigger);

    expect(desktopNavigation.hasAttribute('inert')).toBe(true);
    expect(desktopNavigation.getAttribute('aria-hidden')).toBe('true');
    expect(workspace.hasAttribute('inert')).toBe(true);
    expect(workspace.getAttribute('aria-hidden')).toBe('true');
    expect(trigger.getAttribute('aria-label')).toBe('Open navigation');
    expect(trigger.tabIndex).toBe(-1);
    expect(
      screen.queryByRole('button', { name: 'Open navigation' })
    ).toBeNull();
    expect(
      screen.getAllByRole('button', { name: 'Close navigation', hidden: true })
    ).toHaveLength(1);

    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Cockpit control plane' })
      ).getByRole('button', { name: 'Close navigation' })
    );

    expect(
      screen
        .getByRole('dialog', { name: 'Cockpit control plane' })
        .getAttribute('data-state')
    ).toBe('closing');
    expect(desktopNavigation.hasAttribute('inert')).toBe(true);
    expect(workspace.hasAttribute('inert')).toBe(true);
    expect(trigger.tabIndex).toBe(-1);

    act(() => vi.advanceTimersByTime(149));
    expect(desktopNavigation.hasAttribute('inert')).toBe(true);
    expect(workspace.hasAttribute('inert')).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(desktopNavigation.hasAttribute('inert')).toBe(false);
    expect(desktopNavigation.hasAttribute('aria-hidden')).toBe(false);
    expect(workspace.hasAttribute('inert')).toBe(false);
    expect(workspace.hasAttribute('aria-hidden')).toBe(false);
    expect(trigger.tabIndex).toBe(0);
    expect(document.activeElement).not.toBe(trigger);

    act(() => vi.advanceTimersByTime(16));
    expect(inertAtFocusAttempt).toEqual([false]);
    expect(document.activeElement).toBe(trigger);

    rendered.unmount();
    vi.useRealTimers();
  });

  it('closes before routing and restores destination-panel focus after navigation exactly once', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16)
    );
    vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
      window.clearTimeout(handle)
    );
    const rendered = renderShell();
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    const panel = screen.getByRole('heading', {
      name: 'LangGraph Streaming Run',
    });
    fireEvent.click(trigger);
    const overlay = screen.getByRole('dialog', {
      name: 'Cockpit control plane',
    });
    const workspace = trigger.closest('[data-cockpit-workspace]');
    if (!workspace) throw new Error('Expected the workspace boundary');
    const destination = within(overlay).getByRole('link', {
      name: 'Persistence',
    });
    const destinationPath = new URL(
      destination.getAttribute('href') ?? '',
      window.location.href
    ).pathname;
    const triggerFocus = vi.spyOn(trigger, 'focus');
    const panelFocus = vi.spyOn(panel, 'focus');
    operationalMocks.track.mockClear();

    expect(fireEvent.click(destination)).toBe(false);
    expect(overlay.getAttribute('data-state')).toBe('closing');
    expect(operationalMocks.push).not.toHaveBeenCalled();
    expect(operationalMocks.track).toHaveBeenCalledTimes(1);
    expect(operationalMocks.track).toHaveBeenCalledWith(
      'cockpit:recipe_opened',
      expect.objectContaining({ capability: 'persistence' })
    );

    act(() => vi.advanceTimersByTime(150));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(workspace.hasAttribute('inert')).toBe(false);
    expect(operationalMocks.push).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(16));
    expect(triggerFocus).not.toHaveBeenCalled();
    expect(panelFocus).not.toHaveBeenCalled();
    expect(operationalMocks.push).toHaveBeenCalledTimes(1);
    expect(operationalMocks.push).toHaveBeenCalledWith(destinationPath);

    act(() => window.history.replaceState({}, '', destinationPath));
    rendered.rerender(
      <ThemeProvider theme="light">
        <CockpitShell
          navigationTree={persistenceModel.navigationTree}
          resolution={persistenceModel.resolution}
          presentation={persistenceModel.presentation}
          contentBundle={baseContentBundle}
          routePath={persistenceModel.canonicalPath}
          requestedMode={null}
        />
      </ThemeProvider>
    );
    act(() => vi.advanceTimersByTime(16));
    expect(triggerFocus).not.toHaveBeenCalled();
    expect(panelFocus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(panel);
    expect(operationalMocks.push).toHaveBeenCalledTimes(1);

    rendered.unmount();
    vi.useRealTimers();
  });

  it('focuses the selected mobile destination panel instead of the navigation trigger', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16)
    );
    vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
      window.clearTimeout(handle)
    );
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    const triggerFocus = vi.spyOn(trigger, 'focus');

    fireEvent.click(trigger);
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Cockpit control plane' })
      ).getByRole('button', { name: 'Code' })
    );
    const codePanel = screen.getByRole('heading', {
      name: 'LangGraph Streaming Code',
      hidden: true,
    });
    act(() => vi.advanceTimersByTime(150));
    act(() => vi.advanceTimersByTime(16));

    expect(triggerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(codePanel);
  });

  it('uses the Cockpit host adapter for desktop capability navigation', async () => {
    const rendered = renderShell();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Persistence' })).toBeTruthy()
    );
    const destination = screen.getByRole('link', { name: 'Persistence' });
    const destinationPath = new URL(
      destination.getAttribute('href') ?? '',
      window.location.href
    ).pathname;

    expect(fireEvent.click(destination)).toBe(false);

    expect(operationalMocks.push).toHaveBeenCalledWith(destinationPath);
    expect(
      JSON.parse(
        window.sessionStorage.getItem(
          'threadplane:cockpit:workspace-panel-focus'
        ) ?? '{}'
      )
    ).toEqual({
      destination: destinationPath,
      requestedAt: expect.any(Number),
    });
    rendered.unmount();
  });

  it('does not focus the mobile trigger on an ordinary shell load', async () => {
    const rendered = renderShell();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Open navigation' })
      ).toBeTruthy()
    );
    const trigger = screen.getByRole('button', { name: 'Open navigation' });

    expect(document.activeElement).not.toBe(trigger);
    rendered.unmount();
  });

  it('consumes a cross-route focus intent into the active destination panel', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16)
    );
    vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
      window.clearTimeout(handle)
    );
    window.history.replaceState({}, '', persistenceModel.canonicalPath);
    window.sessionStorage.setItem(
      'threadplane:cockpit:workspace-panel-focus',
      JSON.stringify({
        destination: persistenceModel.canonicalPath,
        requestedAt: Date.now(),
      })
    );
    const rendered = render(
      <ThemeProvider theme="light">
        <CockpitShell
          navigationTree={persistenceModel.navigationTree}
          resolution={persistenceModel.resolution}
          presentation={persistenceModel.presentation}
          contentBundle={baseContentBundle}
          routePath={persistenceModel.canonicalPath}
          requestedMode={null}
        />
      </ThemeProvider>
    );
    const trigger = screen.getByRole('button', {
      name: 'Open navigation',
      hidden: true,
    });
    const focus = vi.spyOn(trigger, 'focus');
    const panel = screen.getByRole('heading', {
      name: 'LangGraph Persistence Run',
    });
    const panelFocus = vi.spyOn(panel, 'focus');

    act(() => vi.advanceTimersByTime(16));

    expect(focus).not.toHaveBeenCalled();
    expect(panelFocus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(panel);
    rendered.unmount();
    vi.useRealTimers();
  });

  it('uses a persistent tablet rail while Activity and Settings replace the context surface', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches:
          query === '(min-width: 48rem)' ||
          query === '(min-width: 48rem) and (max-width: 63.999rem)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }))
    );
    renderShell();

    const settings = screen.getByRole('button', { name: 'Settings' });
    fireEvent.click(settings);
    const surface = screen.getByRole('dialog', {
      name: 'Cockpit control plane context',
    });
    expect(
      within(surface).getByRole('heading', { name: 'Settings' })
    ).toBeTruthy();
    expect(
      screen.getByRole('navigation', { name: 'Cockpit modes' })
    ).toBeTruthy();

    const activity = screen.getByRole('button', { name: 'Activity' });
    fireEvent.click(activity);
    expect(
      within(surface).getByRole('heading', { name: 'Activity' })
    ).toBeTruthy();
    fireEvent.click(
      within(surface).getByRole('button', { name: 'Close Activity' })
    );

    expect(document.activeElement).toBe(activity);
    expect(
      within(surface).getByRole('button', { name: 'Capability' })
    ).toBeTruthy();
  });

  it('closes the tablet context surface and focuses the selected mode panel', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches:
          query === '(min-width: 48rem)' ||
          query === '(min-width: 48rem) and (max-width: 63.999rem)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }))
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16)
    );
    vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
      window.clearTimeout(handle)
    );
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: 'Open context' }));
    expect(
      screen.getByRole('dialog', { name: 'Cockpit control plane context' })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    const codePanel = screen.getByRole('heading', {
      name: 'LangGraph Streaming Code',
      hidden: true,
    });

    act(() => vi.advanceTimersByTime(150));
    act(() => vi.advanceTimersByTime(16));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(codePanel);
  });

  it('restores the tablet context trigger after explicit dismissal', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches:
          query === '(min-width: 48rem)' ||
          query === '(min-width: 48rem) and (max-width: 63.999rem)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }))
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16)
    );
    vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
      window.clearTimeout(handle)
    );
    renderShell();

    const trigger = screen.getByRole('button', { name: 'Open context' });
    fireEvent.click(trigger);
    fireEvent.click(
      within(
        screen.getByRole('dialog', {
          name: 'Cockpit control plane context',
        })
      ).getByRole('button', { name: 'Close navigation' })
    );
    act(() => vi.advanceTimersByTime(150));
    act(() => vi.advanceTimersByTime(16));

    expect(document.activeElement).toBe(trigger);
  });

  it('records one fixed Activity event and one existing analytics event only for an actual mode change', async () => {
    renderShell();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: RUN_RAIL_ITEM })).toBeTruthy()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    openActivity();

    expect(screen.getAllByText('Mode changed to Code')).toHaveLength(1);
    expect(operationalMocks.track).toHaveBeenCalledTimes(1);
    expect(operationalMocks.track).toHaveBeenCalledWith(
      'cockpit:mode_switched',
      {
        capability: 'streaming',
        from_mode: 'run',
        to_mode: 'code',
      }
    );
    expect(operationalMocks.push).toHaveBeenCalledTimes(1);
    expect(operationalMocks.push).toHaveBeenCalledWith('/?mode=code');
    expect(operationalMocks.replace).not.toHaveBeenCalled();
  });

  it('keeps the exact Run iframe mounted while Activity and Settings replace only context', async () => {
    renderShell('https://runtime.test/path');
    const frame = await screen.findByTitle('LangGraph Streaming live example');

    openActivity();
    expect(screen.getByTitle('LangGraph Streaming live example')).toBe(frame);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByTitle('LangGraph Streaming live example')).toBe(frame);
  });

  it('renders non-empty Run, Code, narrative Docs, and API fixtures through the shared panels without remounting Run', async () => {
    if (model.presentation.kind !== 'capability') {
      throw new Error('Expected the streaming capability presentation');
    }
    const codePath = model.presentation.codeAssetPaths[0];
    if (!codePath) throw new Error('Expected a streaming code asset');
    window.history.replaceState({}, '', '/?mode=run');

    render(
      <ThemeProvider theme="light">
        <CockpitShell
          navigationTree={model.navigationTree}
          resolution={model.resolution}
          presentation={model.presentation}
          contentBundle={{
            codeFiles: {
              [codePath]:
                '<pre class="shiki"><code>const adapterFixture = true;</code></pre>',
            },
            promptFiles: {},
            runtimeUrl: 'https://runtime.test/parity',
            narrativeDocs: [
              {
                title: 'Adapter narrative',
                html: '<h1>Adapter narrative</h1><p>Shared Docs fixture.</p>',
                sourceFile: 'adapter.md',
              },
            ],
            docSections: [
              {
                title: 'adapterApi',
                signature: 'adapterApi(value: string): boolean',
                description: 'Shared API fixture.',
                params: [{ name: 'value', description: 'Fixture input.' }],
                returns: 'Whether the fixture is active.',
                sourceFile: 'adapter.ts',
                language: 'typescript',
              },
            ],
          }}
          routePath={model.canonicalPath}
          requestedMode="run"
        />
      </ThemeProvider>
    );

    const frame = await screen.findByTitle('LangGraph Streaming live example');
    expect(screen.getByRole('region', { name: 'Run mode' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    expect(screen.getByRole('region', { name: 'Code mode' })).toBeTruthy();
    expect(screen.getByText('const adapterFixture = true;')).toBeTruthy();
    expect(screen.getByTitle('LangGraph Streaming live example')).toBe(frame);

    fireEvent.click(screen.getByRole('button', { name: 'Docs' }));
    expect(screen.getByRole('region', { name: 'Docs mode' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Adapter narrative' })
    ).toBeTruthy();
    expect(screen.getByText('Shared Docs fixture.')).toBeTruthy();
    expect(screen.getByTitle('LangGraph Streaming live example')).toBe(frame);

    fireEvent.click(screen.getByRole('button', { name: 'API' }));
    expect(screen.getByRole('region', { name: 'API mode' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'adapterApi' })).toBeTruthy();
    expect(screen.getByText('Shared API fixture.')).toBeTruthy();
    expect(screen.getByTitle('LangGraph Streaming live example')).toBe(frame);

    fireEvent.click(screen.getByRole('button', { name: RUN_RAIL_ITEM }));
    expect(screen.getByRole('region', { name: 'Run mode' })).toBeTruthy();
    expect(screen.getByTitle('LangGraph Streaming live example')).toBe(frame);
  });

  it('reloads only the iframe while preserving shell state and session Activity', async () => {
    seedExpanded({ Capability: true, Runtime: true });
    renderShell('https://runtime.test/path?secret=hidden');
    const firstFrame = await screen.findByTitle(
      'LangGraph Streaming live example'
    );
    const routeBefore = window.location.pathname;

    fireEvent.click(screen.getByRole('button', { name: 'Capability' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to dark theme' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload runtime' }));

    await waitFor(() =>
      expect(screen.getByTitle('LangGraph Streaming live example')).not.toBe(
        firstFrame
      )
    );
    expect(
      screen
        .getByRole('button', { name: 'Run, runtime starting' })
        .getAttribute('aria-pressed')
    ).toBe('true');
    expect(window.location.pathname).toBe(routeBefore);
    expect(
      screen
        .getByRole('button', { name: 'Capability' })
        .getAttribute('aria-expanded')
    ).toBe('false');
    expect(document.documentElement.dataset.theme).toBe('dark');
    openActivity();
    expect(screen.getByText('Runtime reload requested')).toBeTruthy();
  });

  it('copies sanitized diagnostics from the current snapshot and at most 20 safe current events', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderShell('https://runtime.test/path?secret=hidden#fragment');
    await screen.findByTitle('LangGraph Streaming live example');

    for (let index = 0; index < 22; index += 1) {
      fireEvent.click(
        screen.getByRole('button', {
          name: index % 2 === 0 ? 'Code' : 'Run, runtime starting',
        })
      );
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'More runtime actions' })
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Copy diagnostics' })
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const clipboardCall = writeText.mock.calls[0];
    if (!clipboardCall) throw new Error('Expected one clipboard write');
    const diagnostics = JSON.parse(clipboardCall[0]);
    expect(diagnostics.runtime).toBe('https://runtime.test/path');
    expect(diagnostics.state).toBe('connecting');
    expect(diagnostics.recentEvents).toHaveLength(20);
    expect(JSON.stringify(diagnostics)).not.toMatch(
      /secret|nonce|cockpit_did|cockpit_phk|session_id|raw_error/i
    );
    expect(operationalMocks.track).toHaveBeenCalledWith(
      'cockpit:runtime_action',
      {
        capability: 'streaming',
        action: 'copy_diagnostics',
        state_before: 'connecting',
        outcome: 'succeeded',
      }
    );
    openActivity();
    expect(screen.getByText('Diagnostics copied')).toBeTruthy();
  });

  it('records a failed diagnostics outcome locally and analytically without false success', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    renderShell('https://runtime.test/path');
    await screen.findByTitle('LangGraph Streaming live example');

    fireEvent.click(
      screen.getByRole('button', { name: 'More runtime actions' })
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Copy diagnostics' })
    );
    await waitFor(() =>
      expect(operationalMocks.track).toHaveBeenCalledWith(
        'cockpit:runtime_action',
        {
          capability: 'streaming',
          action: 'copy_diagnostics',
          state_before: 'connecting',
          outcome: 'failed',
        }
      )
    );

    openActivity();
    expect(screen.getByText('Diagnostics copy failed')).toBeTruthy();
    expect(screen.queryByText('Diagnostics copied')).toBeNull();
  });

  it('tracks runtime commands from the shell with the captured state and no runtime details', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => {
      throw new Error('popup blocked');
    });
    renderShell('https://runtime.test/path?secret=hidden');
    await screen.findByTitle('LangGraph Streaming live example');

    fireEvent.click(screen.getByRole('button', { name: 'Reload runtime' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open runtime' }));

    expect(operationalMocks.track).toHaveBeenCalledWith(
      'cockpit:runtime_action',
      {
        capability: 'streaming',
        action: 'reload',
        state_before: 'connecting',
        outcome: 'requested',
      }
    );
    expect(operationalMocks.track).toHaveBeenCalledWith(
      'cockpit:runtime_action',
      {
        capability: 'streaming',
        action: 'open',
        state_before: 'reloading',
        outcome: 'failed',
      }
    );
    for (const [, properties] of operationalMocks.track.mock.calls) {
      expect(Object.keys(properties)).not.toEqual(
        expect.arrayContaining([
          'url',
          'runtime_url',
          'nonce',
          'raw_error',
          'diagnostics_id',
          'session_id',
        ])
      );
    }
  });

  it('tracks one semantic terminal transition while Activity remains controller-owned', async () => {
    renderShell();
    await waitFor(() =>
      expect(operationalMocks.latestControllerOptions).not.toBeNull()
    );
    const options = operationalMocks.latestControllerOptions;
    if (options === null)
      throw new Error('Expected committed controller options');

    act(() => {
      options.onActivity({
        id: 'recovered-event',
        at: '2026-08-31T17:00:00.000Z',
        kind: 'runtime_recovered',
        capability: 'streaming',
      });
      options.onTerminalTransition({
        capability: 'streaming',
        fromState: 'unresponsive',
        toState: 'ready',
        transition: 'recovered',
        elapsedMs: 25,
      });
    });

    expect(operationalMocks.track).toHaveBeenCalledTimes(1);
    expect(operationalMocks.track).toHaveBeenCalledWith(
      'cockpit:runtime_status_changed',
      {
        capability: 'streaming',
        from_state: 'unresponsive',
        to_state: 'ready',
        transition: 'recovered',
        elapsed_ms: 25,
      }
    );
    openActivity();
    expect(screen.getAllByText('Runtime recovered')).toHaveLength(1);
  });

  it('contains an Activity render failure without replacing or remounting Run and restores focus on dismiss', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    renderShell('https://runtime.test/path');
    const frame = await screen.findByTitle('LangGraph Streaming live example');
    const activity = screen.getByRole('button', { name: 'Activity' });
    operationalMocks.activityShouldThrow = true;

    fireEvent.click(activity);

    expect(
      screen.getByRole('heading', { name: 'Activity unavailable' })
    ).toBeTruthy();
    expect(screen.getByTitle('LangGraph Streaming live example')).toBe(frame);
    expect(document.body.textContent).not.toContain(
      'sensitive activity render failure'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Close Activity unavailable' })
    );
    expect(document.activeElement).toBe(activity);
    expect(screen.getByTitle('LangGraph Streaming live example')).toBe(frame);
    consoleError.mockRestore();
  });
});

describe('CockpitShell documentation link', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('links a capability to its page on the docs site', () => {
    renderShellFor([
      'langgraph',
      'core-capabilities',
      'streaming',
      'overview',
      'python',
    ]);

    const link = screen.getByRole('link', { name: /read docs/i });
    expect(link.getAttribute('href')).toBe(
      'https://threadplane.ai/docs/langgraph/guides/streaming'
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('links a docs-only legacy entry to its published canonical page', () => {
    renderShellFor([
      'langgraph',
      'getting-started',
      'overview',
      'overview',
      'python',
    ]);

    expect(
      screen.getByRole('link', { name: /read docs/i }).getAttribute('href')
    ).toBe(
      'https://threadplane.ai/docs/langgraph/getting-started/introduction'
    );
  });

  it('links a deep-agents capability at the deep-agents docs library', () => {
    renderShellFor([
      'deep-agents',
      'core-capabilities',
      'planning',
      'overview',
      'python',
    ]);

    const link = screen.getByRole('link', { name: /read docs/i });
    expect(link.getAttribute('href')).toBe(
      'https://threadplane.ai/docs/deep-agents/capabilities/planning'
    );
  });

});
