/** @vitest-environment jsdom */
import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  WorkspaceIdentity,
  WorkspaceResolution,
} from '@threadplane/cockpit-registry';
import type {
  ContentBundle,
  WorkspacePresentation,
} from '@threadplane/cockpit-shell';
import {
  WorkspaceProvider,
  useWorkspace,
  type WorkspaceProviderProps,
} from './workspace-provider';

const identity: WorkspaceIdentity = {
  id: 'langgraph:core-capabilities:streaming:overview:python',
  product: 'langgraph',
  section: 'core-capabilities',
  topic: 'streaming',
  page: 'overview',
  language: 'python',
  title: 'Streaming',
  docsPath: '/docs/langgraph/guides/streaming',
  workspacePath: '/workspace/langgraph/streaming',
  legacyPath: '/langgraph/core-capabilities/streaming/overview/python',
  runtimeAdapter: 'langgraph',
  availableModes: ['Docs', 'Run', 'Code', 'API'],
};

const resolution: WorkspaceResolution = { kind: 'mapped', identity };

const presentation: WorkspacePresentation = {
  kind: 'capability',
  identity,
  docsPath: identity.docsPath ?? '',
  promptAssetPaths: [],
  codeAssetPaths: ['example.ts'],
  backendAssetPaths: [],
  docsAssetPaths: ['guide.md'],
  runtimeUrl: 'langgraph/streaming',
  devPort: 4300,
  runnable: true,
};

const contentBundle: ContentBundle = {
  codeFiles: { 'example.ts': '<pre>source</pre>' },
  promptFiles: {},
  runtimeUrl: null,
  docSections: [],
  narrativeDocs: [],
};

function Readout() {
  const workspace = useWorkspace();
  return (
    <div>
      <output aria-label="Active mode">{workspace.activeMode}</output>
      <output aria-label="Active utility">
        {workspace.activeUtility ?? 'none'}
      </output>
      <output aria-label="Activity count">{workspace.events.length}</output>
      <button type="button" onClick={() => workspace.selectMode('Run')}>
        Select Run
      </button>
      <button
        type="button"
        onClick={() => workspace.setActiveUtility('settings')}
      >
        Open Settings
      </button>
      <button
        type="button"
        onClick={() =>
          workspace.hostServices.navigate({
            path: identity.legacyPath,
            restoreFocus: 'mobile-navigation-trigger',
          })
        }
      >
        Navigate with focus
      </button>
    </div>
  );
}

type ProviderHarnessProps = Omit<WorkspaceProviderProps, 'children'>;

const providerProps = (
  overrides: Partial<ProviderHarnessProps> = {}
): ProviderHarnessProps => ({
  resolution,
  presentation,
  contentBundle,
  routeKind: 'docs',
  routePath: identity.docsPath ?? identity.workspacePath,
  requestedMode: 'code',
  docsSlot: <article>Server docs</article>,
  pushIdentity: vi.fn(),
  pushMode: vi.fn(),
  replaceMode: vi.fn(),
  getSessionId: () => 'session-1',
  ...overrides,
});

describe('WorkspaceProvider route mode ownership', () => {
  beforeEach(() => {
    window.history.replaceState(
      {},
      '',
      identity.docsPath ?? identity.workspacePath
    );
  });

  it('initializes a syntactically valid and available query mode', () => {
    render(
      <WorkspaceProvider {...providerProps()}>
        <Readout />
      </WorkspaceProvider>
    );

    expect(screen.getByLabelText('Active mode').textContent).toBe('Code');
  });

  it('replaces invalid and valid-but-unavailable modes with the truthful route default', async () => {
    const limitedIdentity: WorkspaceIdentity = {
      ...identity,
      availableModes: ['Docs', 'Code'],
    };
    const limitedResolution: WorkspaceResolution = {
      kind: 'mapped',
      identity: limitedIdentity,
    };
    const replaceMode = vi.fn();
    const rendered = render(
      <WorkspaceProvider
        {...providerProps({
          resolution: limitedResolution,
          presentation: { ...presentation, identity: limitedIdentity },
          routeKind: 'workspace',
          requestedMode: 'run',
          replaceMode,
        })}
      >
        <Readout />
      </WorkspaceProvider>
    );

    expect(screen.getByLabelText('Active mode').textContent).toBe('Docs');
    await waitFor(() => expect(replaceMode).toHaveBeenCalledWith('Docs'));

    replaceMode.mockClear();
    rendered.rerender(
      <WorkspaceProvider
        {...providerProps({
          resolution: limitedResolution,
          presentation: { ...presentation, identity: limitedIdentity },
          routeKind: 'workspace',
          requestedMode: 'preview',
          replaceMode,
        })}
      >
        <Readout />
      </WorkspaceProvider>
    );
    await waitFor(() => expect(replaceMode).toHaveBeenCalledWith('Docs'));
  });

  it('restores modes from route updates and browser Back/Forward events', async () => {
    const rendered = render(
      <WorkspaceProvider {...providerProps({ requestedMode: 'code' })}>
        <Readout />
      </WorkspaceProvider>
    );
    expect(screen.getByLabelText('Active mode').textContent).toBe('Code');

    rendered.rerender(
      <WorkspaceProvider {...providerProps({ requestedMode: 'docs' })}>
        <Readout />
      </WorkspaceProvider>
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Active mode').textContent).toBe('Docs')
    );

    act(() => {
      window.history.replaceState({}, '', `${identity.docsPath}?mode=api`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() =>
      expect(screen.getByLabelText('Active mode').textContent).toBe('API')
    );
  });

  it('normalizes repeated popstate mode values through the route default', async () => {
    const replaceMode = vi.fn();
    render(
      <WorkspaceProvider
        {...providerProps({
          routeKind: 'workspace',
          routePath: identity.workspacePath,
          requestedMode: 'code',
          replaceMode,
        })}
      >
        <Readout />
      </WorkspaceProvider>
    );
    expect(screen.getByLabelText('Active mode').textContent).toBe('Code');

    act(() => {
      window.history.replaceState(
        {},
        '',
        `${identity.workspacePath}?mode=api&mode=docs`
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() =>
      expect(screen.getByLabelText('Active mode').textContent).toBe('Run')
    );
    expect(replaceMode).toHaveBeenCalledWith('Run');
  });

  it('pushes explicit user mode changes, records Activity, and preserves the mode through utility switches', () => {
    const pushMode = vi.fn();
    const replaceMode = vi.fn();
    const trackModeChange = vi.fn();
    render(
      <WorkspaceProvider
        {...providerProps({
          requestedMode: 'docs',
          pushMode,
          replaceMode,
          trackModeChange,
        })}
      >
        <Readout />
      </WorkspaceProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Run' }));
    expect(screen.getByLabelText('Active mode').textContent).toBe('Run');
    expect(pushMode).toHaveBeenCalledWith('Run');
    expect(replaceMode).not.toHaveBeenCalled();
    expect(trackModeChange).toHaveBeenCalledWith({
      capability: identity.topic,
      fromMode: 'Docs',
      toMode: 'Run',
    });
    expect(screen.getByLabelText('Activity count').textContent).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(screen.getByLabelText('Active utility').textContent).toBe(
      'settings'
    );
    expect(screen.getByLabelText('Active mode').textContent).toBe('Run');
  });

  it('forwards focus restoration intent to the identity navigation adapter', () => {
    const pushIdentity = vi.fn();
    render(
      <WorkspaceProvider {...providerProps({ pushIdentity })}>
        <Readout />
      </WorkspaceProvider>
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Navigate with focus' })
    );
    expect(pushIdentity).toHaveBeenCalledWith(identity.legacyPath, {
      restoreFocus: 'mobile-navigation-trigger',
    });
  });

  it('defers a cross-identity popstate until the host provides the destination resolution', async () => {
    const limitedIdentity: WorkspaceIdentity = {
      ...identity,
      availableModes: ['Docs'],
    };
    const destinationIdentity: WorkspaceIdentity = {
      ...identity,
      id: 'langgraph:core-capabilities:memory:overview:python',
      topic: 'memory',
      title: 'Memory',
      docsPath: '/docs/langgraph/guides/memory',
      workspacePath: '/workspace/langgraph/memory',
      availableModes: ['Docs', 'Run'],
    };
    const replaceMode = vi.fn();
    const rendered = render(
      <WorkspaceProvider
        {...providerProps({
          resolution: { kind: 'mapped', identity: limitedIdentity },
          presentation: { ...presentation, identity: limitedIdentity },
          requestedMode: 'docs',
          replaceMode,
        })}
      >
        <Readout />
      </WorkspaceProvider>
    );

    act(() => {
      window.history.replaceState(
        {},
        '',
        `${destinationIdentity.docsPath}?mode=run`
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByLabelText('Active mode').textContent).toBe('Docs');
    expect(replaceMode).not.toHaveBeenCalled();

    rendered.rerender(
      <WorkspaceProvider
        {...providerProps({
          resolution: { kind: 'mapped', identity: destinationIdentity },
          presentation: { ...presentation, identity: destinationIdentity },
          routePath: destinationIdentity.docsPath ?? '',
          requestedMode: 'run',
          replaceMode,
        })}
      >
        <Readout />
      </WorkspaceProvider>
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Active mode').textContent).toBe('Run')
    );
    expect(replaceMode).not.toHaveBeenCalled();
  });
});
