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
import type { UseRuntimeControllerOptions } from '../lib/runtime/use-runtime-controller';

const operationalMocks = vi.hoisted(() => ({
  controllerInstances: 0,
  latestControllerOptions: null as UseRuntimeControllerOptions | null,
  activityShouldThrow: false,
  track: vi.fn(),
}));

vi.mock('../lib/analytics/client', () => ({ track: operationalMocks.track }));

vi.mock('../lib/runtime/use-runtime-controller', async (importOriginal) => {
  const ReactModule = await import('react');
  const actual = await importOriginal<
    typeof import('../lib/runtime/use-runtime-controller')
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
});

vi.mock('./control-plane/activity-panel', async (importOriginal) => {
  const ReactModule = await import('react');
  const actual = await importOriginal<
    typeof import('./control-plane/activity-panel')
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
});

import { CockpitShell } from './cockpit-shell';

const model = getCockpitPageModel();
const baseContentBundle = {
  codeFiles: {},
  promptFiles: {},
  runtimeUrl: null,
  docSections: [],
  narrativeDocs: [],
};

const seedMode = (
  activeMode: 'Run' | 'Code' | 'Docs' | 'API',
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
      cockpit: { activeMode, expanded },
    })
  );
};

const renderShell = (runtimeUrl: string | null = null) =>
  render(
    <ThemeProvider theme="light">
      <CockpitShell
        navigationTree={model.navigationTree}
        presentation={model.presentation}
        entryTitle={model.entry.title}
        contentBundle={{ ...baseContentBundle, runtimeUrl }}
      />
    </ThemeProvider>
  );

const openActivity = () => {
  fireEvent.click(screen.getByRole('button', { name: /^Activity/ }));
  return screen.getByRole('heading', {
    name: /Activity(?: unavailable)?/,
  });
};

describe('CockpitShell operational composition', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
    operationalMocks.controllerInstances = 0;
    operationalMocks.latestControllerOptions = null;
    operationalMocks.activityShouldThrow = false;
    operationalMocks.track.mockClear();
    document.documentElement.dataset.theme = 'light';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({}));
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('initializes from the saved Cockpit mode after hydration', async () => {
    seedMode('Docs');
    renderShell();

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'Docs' })
          .getAttribute('aria-pressed')
      ).toBe('true');
    });
    expect(screen.getByRole('region', { name: 'Docs mode' })).toBeTruthy();
  });

  it('consumes a valid mode query once and persists it over the saved mode', async () => {
    seedMode('Docs');
    window.history.replaceState({}, '', '/?mode=code&keep=1');
    renderShell();

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'Code' })
          .getAttribute('aria-pressed')
      ).toBe('true');
    });
    expect(window.location.search).toBe('?keep=1');
    expect(
      JSON.parse(window.localStorage.getItem(CONTROL_PLANE_STORAGE_KEY) ?? '{}')
        .cockpit.activeMode
    ).toBe('Code');
  });

  it('ignores invalid mode queries and uses the saved mode', async () => {
    seedMode('API');
    window.history.replaceState({}, '', '/?mode=preview');
    renderShell();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'API' }).getAttribute('aria-pressed')
      ).toBe('true');
    });
  });

  it('owns one controller and one Activity store shared by desktop and mobile adapters', async () => {
    renderShell();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy()
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

  it('records one fixed Activity event and one existing analytics event only for an actual mode change', async () => {
    renderShell();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy()
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
  });

  it('keeps the exact Run iframe mounted while Activity and Settings replace only context', async () => {
    renderShell('https://runtime.test/path');
    const frame = await screen.findByTitle('LangGraph Streaming live example');

    openActivity();
    expect(screen.getByTitle('LangGraph Streaming live example')).toBe(frame);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByTitle('LangGraph Streaming live example')).toBe(frame);
  });

  it('reloads only the iframe while preserving shell state and session Activity', async () => {
    seedMode('Run', { Capability: true, Runtime: true });
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
      screen.getByRole('button', { name: 'Run' }).getAttribute('aria-pressed')
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
          name: index % 2 === 0 ? 'Code' : 'Run',
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
